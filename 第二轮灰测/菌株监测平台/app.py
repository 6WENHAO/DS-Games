# -*- coding: utf-8 -*-
"""
菌株监测可视化平台 · Flask 后端（完整可运行）
=================================================
安全声明（请先读）：
  本平台用于【非致病安全模式生物】的菌株培养监测与诱变教学仿真：
   - 大肠杆菌 K-12（E. coli K-12，实验室安全株，BSL-1）
   - 酿酒酵母（S. cerevisiae，BSL-1）
  任何对人或动植物具有致病性的菌株不得导入本系统进行"定向变异培育"推演。

内容：
  1) 低成本诱变仿真计算引擎：培养基配比 + UV/EMS 剂量 + 恒温诱导
     输出最优培育参数与完整动力学过程（可复现、可导出）。
  2) 批量突变路径遍历算法：位点组合的完全枚举 / 束搜索（预算可配），
     输出适配度最高的组合路径与"培育条件曲线"数据点。
  3) 后台常驻仿真线程：持续迭代菌株繁殖仿真，状态可查询、可取消，
     前端轮询刷新（无需刷新页面）。
  4) 文件读写：白名单目录配置 → 一键批量导入该目录 CSV；另支持单文件上传。

运行：  python app.py   （仅用标准库，无需 pip install）
然后浏览器打开 http://127.0.0.1:8000/
"""
import csv
import io
import json
import math
import os
import random
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

try:
    import epi_engine      # 传染病动力学引擎（同目录）
except Exception:          # 导入失败时给出占位，保证平台其余功能仍可用
    epi_engine = None

# --------------------------------------------------------------------------
# 配置
# --------------------------------------------------------------------------
PORT = 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(ROOT, "data")            # 默认数据目录
IMPORT_DIR = os.path.join(ROOT, "imported")       # 白名单批量导入目录
MANUAL_DIR = os.path.join(ROOT, "manuals")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(IMPORT_DIR, exist_ok=True)
os.makedirs(MANUAL_DIR, exist_ok=True)

FRONTEND = os.path.join(ROOT, "frontend.html")

# 后台仿真线程（常驻、可取消）
WORKER = None


# ==========================================================================
# 一、生物学仿真内核（全部计算逻辑，无省略）
# ==========================================================================
# 1.1 温度-生长模型：Ratkowsky 平方根模型（微生物学标准模型）
#     生长速率 r = (b*(T-Tmin)*(1-exp(c*(T-Tmax))))^2
#     Arrhenius 修正项用于高温段失活速率 kd = A_d * exp(-Ea_d/(R*T))
# --------------------------------------------------------------------------
def ratkowsky_rate(T_c, b, Tmin, Tmax, c):
    if T_c <= Tmin or T_c >= Tmax:
        return 0.0
    inner = b * (T_c - Tmin) * (1.0 - math.exp(c * (T_c - Tmax)))
    return max(inner * inner, 0.0)


def thermal_death_rate(T_c, A_d, Ea_d):
    R = 8.314
    Tk = T_c + 273.15
    return A_d * math.exp(-Ea_d / (R * Tk))


def logistic_growth(N0, K, r, t_h):
    """Logistic 生长曲线：N(t) = K / (1 + (K/N0 - 1) * exp(-r*t))"""
    if N0 <= 0 or K <= 0:
        return 0.0
    return K / (1.0 + (K / N0 - 1.0) * math.exp(-max(r, 0.0) * t_h))


# 1.2 培养基配比（配方系数 → 生长速率修正）
#     碳源（葡萄糖）按 Monod 动力学：r ∝ [S]/(Ks+[S])
#     氮源、盐度按经验抑制模型
# --------------------------------------------------------------------------
def media_rate_factor(glucose_g_L, nh4_g_L, nacl_g_L):
    Ks = 0.05        # g/L，葡萄糖半饱和常数
    monod = glucose_g_L / (Ks + max(glucose_g_L, 1e-9))
    n_factor = 1.0 - 0.12 * abs(nh4_g_L - 2.0) / 2.0
    n_factor = max(n_factor, 0.2)
    s_factor = 1.0 if nacl_g_L <= 20 else max(0.2, 1.0 - (nacl_g_L - 20.0) / 60.0)
    return monod * max(n_factor, 0.0) * s_factor


# 1.3 诱变动力学
#     UV（254 nm）：存活率 S = exp(-k_uv * fluence)，突变率按泊松击中介数
#     EMS（甲磺酸乙酯，危险化学品）：剂量 D = C * t（mg/mL·min）
#       存活率 S = exp(-k_ems * D)
#       每代突变率 μ ≈ alpha * (1-S)/ln(S) 的经验形式（Chu et al. 型）
#     NTG：更强效，同样按 C·t 剂量
# --------------------------------------------------------------------------
def survival_uv(fluence_J_m2, k_uv):
    return math.exp(-k_uv * fluence_J_m2)


def survival_ems(dose_mg_ml_min, k_ems):
    return math.exp(-k_ems * dose_mg_ml_min)


def mutation_yield(survival, alpha, cap=0.3):
    """由存活率推算的突变率（经验模型，α 为菌株/诱变剂常数）。"""
    if survival <= 1e-9 or survival >= 1.0:
        return 0.0
    mu = alpha * (1.0 - survival) / (-math.log(survival))
    return min(mu, cap)

def mutagen_simulate(params):
    """
    完整诱变仿真：输入培养基 + 诱变剂 + 温度，输出过程曲线与最优培育参数。
    流程（每一步都显式计算并返回）：
      1) 培养基 → 生长速率修正系数
      2) 温度扫描 → 净生长速率曲线（生长 - 热失活）
      3) 诱变剂剂量 → 存活率与突变率
      4) 接种后培养 → Logistic 生长曲线
      5) 突变子代估计 → Poisson 抽样期望
    """
    T = float(params.get("temp_c", 37.0))
    glucose = float(params.get("glucose_g_L", 2.0))
    nh4 = float(params.get("nh4_g_L", 2.0))
    nacl = float(params.get("nacl_g_L", 5.0))
    mutagen = str(params.get("mutagen", "UV"))
    dose1 = float(params.get("dose1", 50.0))       # UV: J/m2；EMS/NTG: mg/mL·min
    hours = float(params.get("hours", 24.0))
    N0 = float(params.get("N0", 1e5))

    # --- 步骤 1：培养基 ---
    mf = media_rate_factor(glucose, nh4, nacl)
    b0 = 0.018      # Ratkowsky b 常数（K-12 经验量级）
    Tmin, Tmax, c = 8.0, 48.0, 0.18
    r_base = ratkowsky_rate(T, b0, Tmin, Tmax, c) * mf

    # --- 步骤 2：温度扫描（用于页面曲线与最优参数） ---
    scan = []
    for t in range(15, 47):
        r_g = ratkowsky_rate(t, b0, Tmin, Tmax, c) * mf
        kd = thermal_death_rate(t, 1e9, 6.5e4)
        scan.append({"T": t, "r_net": round(max(r_g - kd, 0.0), 5)})
    T_opt = max(scan, key=lambda x: x["r_net"])["T"]

    # --- 步骤 3：诱变 ---
    if mutagen == "UV":
        S = survival_uv(dose1, 0.012)
        mu = mutation_yield(S, 2.5e-3)
        dose_label = "%g J/m2 (254 nm)" % dose1
    elif mutagen == "EMS":
        S = survival_ems(dose1, 0.09)
        mu = mutation_yield(S, 4.0e-3)
        dose_label = "%g mg/mL·min (EMS)" % dose1
    else:  # NTG
        S = survival_ems(dose1, 0.18)
        mu = mutation_yield(S, 9.0e-3)
        dose_label = "%g mg/mL·min (NTG)" % dose1

    # --- 步骤 4：培养 ---
    K = 1e9
    r_net = max(r_base, 1e-6)
    curve = []
    for h in range(0, int(hours) + 1):
        N = logistic_growth(N0 * S, K, r_net, h)
        curve.append({"h": h, "N": N, "log10N": round(math.log10(max(N, 1.0)), 3)})

    # --- 步骤 5：突变子代估计 ---
    final_N = curve[-1]["N"]
    mutants = final_N * mu * 0.25    # 可检出突变体按 25% 计（经验值）

    return {
        "media": {"glucose_g_L": glucose, "nh4_g_L": nh4, "nacl_g_L": nacl,
                  "rate_factor": round(mf, 4)},
        "temperature": {"input_T": T, "optimal_T": T_opt, "scan": scan,
                        "r_base": round(r_base, 5)},
        "mutagenesis": {"agent": mutagen, "dose_label": dose_label,
                        "survival": round(S, 4), "mutation_rate": round(mu, 6)},
        "growth": {"curve": curve, "final_log10N": curve[-1]["log10N"],
                   "expected_mutants": round(mutants, 1)},
        "protocol": build_protocol(params, S, mu, T_opt, mf),
    }


def build_protocol(params, S, mu, T_opt, mf):
    """输出可落地的操作手册数据（供前端导出面板使用）。"""
    mutagen = str(params.get("mutagen", "UV"))
    steps = [
        {"seq": 1, "title": "配制 LB 基础培养基（1 L）",
         "body": "胰蛋白胨 10 g，酵母提取物 5 g，NaCl 10 g，琼脂 15 g（固体板用），"
                 "去离子水定容至 1 L，121 ℃ 高压灭菌 20 min，冷却至 50 ℃ 后倒平板。"},
        {"seq": 2, "title": "配制筛选培养基（含碳源梯度）",
         "body": "葡萄糖 %g g/L，NH4Cl %g g/L，NaCl %g g/L；生长速率修正系数 = %.3f。"
                 % (params.get("glucose_g_L", 2), params.get("nh4_g_L", 2),
                    params.get("nacl_g_L", 5), mf)},
        {"seq": 3, "title": "接种与培养",
         "body": "取甘油保存液 10 μL 接种至 5 mL LB 液体，%d ℃、200 rpm 过夜培养。" % T_opt},
        {"seq": 4, "title": "诱变处理（%s）" % mutagen,
         "body": ("UV：菌液涂布后于 254 nm 紫外灯下照射 %g J/m2，存活率 %.1f%%。"
                  % (params.get("dose1", 50), S * 100)
                  if mutagen == "UV" else
                  "%s：终浓度按剂量 %g mg/mL·min 处理，立即用 5%% 硫代硫酸钠（EMS）"
                  "或 2%% NaHCO3（NTG）终止反应，离心洗涤 3 次去除诱变剂。"
                  "⚠ %s 为剧毒致癌物，必须戴双层手套、在通风橱操作。"
                  % (mutagen, params.get("dose1", 50), mutagen))},
        {"seq": 5, "title": "复苏培养",
         "body": "诱变后菌液 1:10 接入新鲜 LB，%d ℃、150 rpm 复苏 1~2 h（表达修复与突变固定）。"
                 % T_opt},
        {"seq": 6, "title": "涂布与突变子初筛",
         "body": "梯度稀释涂布于筛选平板，37 ℃ 倒置培养 16~24 h，统计菌落数与表型。"},
        {"seq": 7, "title": "验证与保种",
         "body": "挑取候选克隆划线纯化 ≥3 次，PCR/测序确认突变位点，20% 甘油 -80 ℃ 保种。"},
        {"seq": 8, "title": "安全与废弃物处理",
         "body": "诱变剂废液与接触耗材按化学废弃物单独收集交专业机构处置；"
                 "全部操作限 BSL-1 非致病菌株；若涉及致病性改造，必须停止并报生物安全委员会。"},
    ]
    return {"estimated_mutation_rate": round(mu, 6), "steps": steps,
            "model_organism": "E. coli K-12 / S. cerevisiae（BSL-1，非致病）"}


# ==========================================================================
# 二、批量突变路径遍历算法（完整实现）
# --------------------------------------------------------------------------
# 目标：在 N 个位点上搜索高适配度组合。两种模式：
#   exact  ：完全枚举 2^N（页面把 N 限在 ≤14，即 ≤16384 组合，可全量遍历）
#   beam   ：束搜索，宽度可配（适配 N 很大时的近似路径）
# 每个组合都带"培育条件曲线"：温度 15~46℃ 的净生长速率（用于前端画图）。
# --------------------------------------------------------------------------
@dataclass
class Locus:
    name: str
    basal: float      # 无突变时的贡献
    effect: float     # 突变后的适配度变化
    temp_shift: float # 突变对最适温度的影响（℃）


def _default_loci(n):
    """教学用默认位点（代谢/抗逆/温度敏感相关，全部安全表型）。"""
    names = ["lacZ", "rpoS", "cysE", "metB", "proA", "hisD", "purF", "thiE",
             "trpC", "lysA", "aroE", "guaB", "pyrF", "folA", "nadB", "ilvE"]
    rnd = random.Random(42)
    out = []
    for i in range(min(n, len(names))):
        out.append(Locus(names[i], basal=round(rnd.uniform(0.05, 0.2), 3),
                         effect=round(rnd.uniform(0.08, 0.35), 3),
                         temp_shift=round(rnd.uniform(-2.5, 2.5), 2)))
    for i in range(len(names), n):
        out.append(Locus("locus%d" % (i + 1), basal=round(rnd.uniform(0.05, 0.2), 3),
                         effect=round(rnd.uniform(0.08, 0.35), 3),
                         temp_shift=round(rnd.uniform(-2.5, 2.5), 2)))
    return out


def combo_score(loci, mask, T_c):
    """计算一个组合（mask 的二进制位）在温度 T 下的适配度与培育曲线。"""
    fit = 0.0
    shift = 0.0
    for i, L in enumerate(loci):
        if mask & (1 << i):
            fit += L.effect
            shift += L.temp_shift
        else:
            fit += L.basal
    T_opt = max(15.0, min(46.0, T_c + shift))
    curve = []
    for t in range(15, 47):
        r = ratkowsky_rate(t, 0.018, 8.0, 48.0, 0.18)
        width = 8.0
        band = math.exp(-((t - T_opt) ** 2) / (2 * width * width))
        curve.append({"T": t, "score": round(r * (0.55 + 0.9 * band), 5)})
    return {"mask": mask, "fitness": round(fit, 4), "T_opt": round(T_opt, 1),
            "curve": curve}


def traversal(params):
    n = int(params.get("loci", 8))
    mode = str(params.get("mode", "exact"))
    n = max(2, min(n, 24))
    loci = _default_loci(n)
    T_base = float(params.get("temp_c", 37.0))
    beam_w = max(2, min(int(params.get("beam_width", 12)), 64))

    results = []
    visited = 0

    if mode == "beam":
        # 束搜索：逐位扩展，每层保留 beam_w 个最佳组合（有界，可解释）
        frontier = [combo_score(loci, 0, T_base)]
        for _depth in range(n):
            next_frontier = {}
            for item in frontier:
                for i in range(n):
                    if item["mask"] & (1 << i):
                        continue
                    m = item["mask"] | (1 << i)
                    if m in next_frontier:
                        continue
                    next_frontier[m] = combo_score(loci, m, T_base)
                    visited += 1
            frontier = sorted(next_frontier.values(), key=lambda x: -x["fitness"])[:beam_w]
            if not frontier:
                break
        results = frontier
    else:
        # 完全枚举：2^n（n<=14 时页面默认启用；更大时明确告知组合数）
        total = 2 ** n
        cap = int(params.get("cap", 16384))
        if total <= cap:
            for m in range(total):
                results.append(combo_score(loci, m, T_base))
                visited += 1
        else:
            # 超出预算：按 cap 采样 + 顶部邻域扩展（保证响应快、路径可复现）
            rnd = random.Random(7)
            sampled = set()
            while len(sampled) < cap:
                sampled.add(rnd.randrange(total))
            for m in sampled:
                results.append(combo_score(loci, m, T_base))
                visited += 1
            results.append(combo_score(loci, total - 1, T_base))
    results.sort(key=lambda x: -x["fitness"])
    top = results[:12]
    return {
        "loci": [{"name": L.name, "basal": L.basal, "effect": L.effect,
                  "temp_shift": L.temp_shift} for L in loci],
        "mode": mode, "visited": visited, "total_combinations": 2 ** n,
        "top": top,
        "top_curve": top[0]["curve"] if top else [],
        "note": ("完全枚举：遍历全部 2^%d 组合" % n if (mode != "beam" and visited == 2 ** n)
                 else "%s 模式：已评估 %d 个组合（上限受预算控制，可复现）" % (mode, visited)),
    }

# ==========================================================================
# 三、后台常驻仿真线程（持续迭代、可取消、无无界死循环）
# --------------------------------------------------------------------------
@dataclass
class SimState:
    running: bool = False
    generation: int = 0
    colony: float = 1000.0
    mutation_rate: float = 0.0
    temp_c: float = 37.0
    history: List[Dict[str, Any]] = field(default_factory=list)
    cancel: threading.Event = field(default_factory=threading.Event)
    error: str = ""

    def snapshot(self):
        return {"running": self.running, "generation": self.generation,
                "colony": round(self.colony, 1),
                "mutation_rate": round(self.mutation_rate, 8),
                "temp_c": self.temp_c, "history": self.history[-200:],
                "error": self.error}


def _worker_loop(state, params):
    """常驻线程：持续迭代菌株繁殖仿真。每 0.25 s 一代，直到 cancel 事件。"""
    step_s = max(0.1, float(params.get("step_s", 0.25)))
    while not state.cancel.is_set():
        try:
            mf = media_rate_factor(float(params.get("glucose", 2.0)),
                                   float(params.get("nh4", 2.0)),
                                   float(params.get("nacl", 5.0)))
            r = ratkowsky_rate(state.temp_c, 0.018, 8.0, 48.0, 0.18) * mf
            kd = thermal_death_rate(state.temp_c, 1e9, 6.5e4)
            r_net = max(r - kd, 0.0)
            # 每代繁殖（离散 Logistic 步进）+ 自发突变
            K = 1e9
            state.colony = state.colony + r_net * state.colony * (1 - state.colony / K) * 0.25
            state.mutation_rate = 1e-8 + 2e-8 * (r_net / 0.5)
            state.generation += 1
            state.history.append({"gen": state.generation, "colony": round(state.colony, 1),
                                  "mut_rate": round(state.mutation_rate, 8),
                                  "temp": state.temp_c})
            state.cancel.wait(step_s)
        except Exception as e:  # 任何异常都记录并退出循环，绝不让线程静默死掉
            state.error = str(e)
            state.running = False
            return
    state.running = False


def start_worker(params):
    global WORKER
    stop_worker()
    state = SimState()
    state.temp_c = float(params.get("temp_c", 37.0))
    state.running = True
    WORKER = state
    t = threading.Thread(target=_worker_loop, args=(state, params), daemon=True)
    t.start()
    return state.snapshot()


def stop_worker():
    global WORKER
    if WORKER is not None:
        WORKER.cancel.set()
        WORKER.running = False
        WORKER = None
    return {"running": False}


def worker_status():
    if WORKER is None:
        return {"running": False, "history": []}
    return WORKER.snapshot()


# ==========================================================================
# 四、文件读写：白名单目录批量导入 + 单文件上传
# --------------------------------------------------------------------------
def list_import_files():
    files = []
    for name in sorted(os.listdir(IMPORT_DIR)):
        p = os.path.join(IMPORT_DIR, name)
        if name.lower().endswith(".csv") and os.path.isfile(p):
            files.append({"name": name, "bytes": os.path.getsize(p),
                          "mtime": time.strftime("%Y-%m-%d %H:%M:%S",
                                                time.localtime(os.path.getmtime(p)))})
    return {"dir": IMPORT_DIR, "files": files}


def parse_csv(text):
    """通用 CSV 解析：首行为表头，数值列自动识别；返回归一化表结构。"""
    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        raise ValueError("CSV 缺少表头行")
    rows = [r for r in reader if any(v.strip() for v in r.values())]
    columns = []
    for col in reader.fieldnames:
        numeric = True
        for r in rows[:50]:
            v = r.get(col, "")
            try:
                float(v)
            except (TypeError, ValueError):
                numeric = False
                break
        columns.append({"name": col, "numeric": numeric})
    stats = {}
    for col in columns:
        if not col["numeric"]:
            continue
        vals = [float(r.get(col["name"], 0)) for r in rows]
        if vals:
            stats[col["name"]] = {"min": min(vals), "max": max(vals),
                                  "mean": round(sum(vals) / len(vals), 4)}
    return {"columns": columns, "rows": rows, "n": len(rows), "stats": stats}


def import_all():
    """批量导入白名单目录内全部 CSV（只读该目录，绝不扫描全盘）。"""
    out = []
    for f in list_import_files()["files"]:
        try:
            with open(os.path.join(IMPORT_DIR, f["name"]), "r", encoding="utf-8-sig") as fh:
                parsed = parse_csv(fh.read())
            out.append({"file": f["name"], "ok": True, "n_rows": parsed["n"],
                        "columns": [c["name"] for c in parsed["columns"]]})
        except Exception as e:
            out.append({"file": f["name"], "ok": False, "error": str(e)})
    return {"imported": out, "n": len(out)}

# ==========================================================================
# 五、HTTP 服务（无框架，标准库实现，方便审计）
# --------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = "StrainLab/1.0"

    def _send_json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, path, content_type):
        try:
            with open(path, "rb") as fh:
                body = fh.read()
            self.send_response(200)
            self.send_header("Content-Type", content_type + "; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except FileNotFoundError:
            self._send_json({"error": "file not found"}, 404)

    def _read_json(self):
        n = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(n).decode("utf-8") if n else "{}"
        try:
            return json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError:
            return {}

    def do_OPTIONS(self):  # CORS 预检
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path in ("/", "/index.html"):
            self._send_file(FRONTEND, "text/html")
        elif path == "/api/status":
            self._send_json({"ok": True, "time": time.time(),
                             "data_dir": DATA_DIR, "import_dir": IMPORT_DIR})
        elif path == "/api/files":
            self._send_json(list_import_files())
        elif path == "/api/worker":
            self._send_json(worker_status())
        elif path == "/api/example.csv":
            self._send_file(os.path.join(DATA_DIR, "example.csv"), "text/csv")
        elif path == "/api/epi/presets":
            if epi_engine is None:
                self._send_json({"error": "epi_engine.py 未找到"}, 500)
            else:
                self._send_json(epi_engine.PRESETS)
        else:
            self._send_json({"error": "not found: " + path}, 404)

    def do_POST(self):
        path = self.path.split("?")[0]
        data = self._read_json()
        if path == "/api/simulate":
            try:
                self._send_json(mutagen_simulate(data))
            except Exception as e:
                self._send_json({"error": str(e)}, 400)
        elif path == "/api/traversal":
            try:
                self._send_json(traversal(data))
            except Exception as e:
                self._send_json({"error": str(e)}, 400)
        elif path == "/api/worker/start":
            self._send_json(start_worker(data))
        elif path == "/api/worker/stop":
            self._send_json(stop_worker())
        elif path == "/api/import":
            self._send_json(import_all())
        elif path == "/api/parse_csv":
            self._send_json(parse_csv(data.get("text", "")))
        elif path == "/api/epi":
            try:
                if epi_engine is None:
                    self._send_json({"error": "epi_engine.py 未找到"}, 500)
                    return
                self._send_json(epi_engine.seir(data))
            except Exception as e:
                self._send_json({"error": str(e)}, 400)
        elif path == "/api/epi/compare":
            try:
                if epi_engine is None:
                    self._send_json({"error": "epi_engine.py 未找到"}, 500)
                    return
                self._send_json(epi_engine.intervention_compare(data))
            except Exception as e:
                self._send_json({"error": str(e)}, 400)
        elif path == "/api/manual":
            try:
                sim = mutagen_simulate(data)
                self._send_json({"manual_html": render_manual_html(sim)})
            except Exception as e:
                self._send_json({"error": str(e)}, 400)
        else:
            self._send_json({"error": "not found: " + path}, 404)

    def log_message(self, fmt, *args):
        pass  # 安静日志


def render_manual_html(sim):
    """生成可下载的独立 HTML 实验手册（前端导出面板调用）。"""
    p = sim["protocol"]
    steps = "".join(
        "<li><b>%d. %s</b><p>%s</p></li>" % (s["seq"], s["title"], s["body"])
        for s in p["steps"])
    growth = sim["growth"]["curve"]
    curve_html = ",".join("(%s,%s)" % (g["h"], g["log10N"]) for g in growth)
    return ('<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">'
            '<title>菌株诱变培育实验手册（教学仿真）</title>'
            '<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:24px auto;'
            'padding:0 20px;line-height:1.7;color:#222}'
            'h1{border-bottom:2px solid #2c6f9e;padding-bottom:8px} li{margin:12px 0}'
            '.warn{background:#fff3cd;border-left:4px solid #e0a800;padding:10px}</style></head>'
            '<body><h1>菌株诱变培育实验手册</h1>'
            '<p class="warn">⚠ 本手册由仿真引擎生成，仅用于【非致病安全菌株'
            '（E. coli K-12 / S. cerevisiae，BSL-1）】的教学演示。EMS/NTG 为剧毒致癌物，'
            '仅在通风橱内由受过训练的人员使用。严禁将本流程用于任何致病微生物的定向改造。</p>'
            '<h2>参数概览</h2><ul>'
            '<li>模式生物：%s</li>'
            '<li>诱变剂：%s，剂量 %s</li>'
            '<li>存活率：%.1f%%；估计突变率：%.2e</li>'
            '<li>最适培养温度：%s ℃</li>'
            '<li>培养 %d h 后预计活菌数：10^%s cfu/mL；预计突变体数：%.0f</li></ul>'
            '<h2>操作步骤</h2><ol>%s</ol>'
            '<h2>生长曲线数据</h2><pre>%s</pre>'
            '<p>生成时间：%s</p></body></html>'
            % (p["model_organism"], sim["mutagenesis"]["agent"],
               sim["mutagenesis"]["dose_label"], sim["mutagenesis"]["survival"] * 100,
               p["estimated_mutation_rate"], sim["temperature"]["optimal_T"],
               len(growth) - 1, sim["growth"]["final_log10N"],
               sim["growth"]["expected_mutants"], steps, curve_html,
               time.strftime("%Y-%m-%d %H:%M:%S")))


def _port_in_use(port):
    try:
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.3)
        r = s.connect_ex(("127.0.0.1", port))
        s.close()
        return r == 0
    except Exception:
        return False


def main():
    # 首次启动时生成示例数据（教学用，公开数据格式）
    example = os.path.join(DATA_DIR, "example.csv")
    if not os.path.exists(example):
        with open(example, "w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["time_h", "OD600", "temp_C", "well", "replicate", "note"])
            for i in range(0, 25):
                r = max(0.02, 2.0 / (1 + (2.0 / 0.02 - 1) * math.exp(-0.32 * i)))
                w.writerow([i, round(r, 4), 37, "A1", 1, "E. coli K-12 对照"])
    if _port_in_use(PORT):
        print("=" * 62)
        print(" [X] 端口 %d 已被占用——很可能已经有一个 StrainLab 在运行。" % PORT)
        print("     浏览器直接打开 http://127.0.0.1:%d/ 即可；" % PORT)
        print("     若确认要重启：先关闭旧的服务窗口，或运行：")
        print("       netstat -ano | findstr :%d   （找到 PID 后用任务管理器结束）" % PORT)
        print("=" * 62)
        input(" 按回车退出 ...")
        return
    httpd = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("=" * 62)
    print(" 菌株监测可视化平台后端已启动")
    print(" 浏览器打开：http://127.0.0.1:%d/" % PORT)
    print(" 数据目录：%s" % DATA_DIR)
    print(" 批量导入目录（白名单）：%s  <- 把你的 CSV 放这里" % IMPORT_DIR)
    print(" 按 Ctrl+C 停止")
    print("=" * 62)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        stop_worker()
        httpd.shutdown()


if __name__ == "__main__":
    main()
