# -*- coding: utf-8 -*-
"""
传染病动力学模拟引擎（SEIR 分室模型）
========================================
【重要声明】
  本模块是【教学与决策支持工具】，用于理解流行病动力学机制
 （R0、潜伏期、隔离、压平曲线等概念）。
  它【不是】疫情指挥系统：不接入真实病例数据、不输出医疗建议、
  不替代公共卫生专业人员与医疗机构。
  真实疫情处置请以当地疾控中心（CDC）与卫生行政部门发布为准。

模型：
  S(t) 易感者  E(t) 潜伏期(已感染未发病)  I(t) 传染期  R(t) 移出(康复+死亡)
  D(t) 累计死亡
  dS/dt = -β·S·I/N
  dE/dt =  β·S·I/N - σ·E        σ = 1/潜伏期
  dI/dt =  σ·E - γ·I            γ = 1/传染期
  dR/dt =  (1-IFR)·γ·I
  dD/dt =  IFR·γ·I
  干预用时间函数表示：
    接触率降低（隔离/口罩/停课）   c(t)
    病例隔离有效性（减少传染期有效传播） q(t)
    疫苗接种覆盖率（进入免疫）     v(t)
  有效再生数 Re(t) = R0 · c(t) · (1-q(t)) · S(t)/N
  床位需求按 I(t) 的住院率推算（可调）。
数值方法：4 阶 Runge-Kutta，自适应固定步长，质量守恒检查。
"""
import math


def seir(params):
    N = float(params.get("N", 100000))                 # 人口
    days = int(params.get("days", 180))
    dt = float(params.get("dt", 0.1))

    # 病原参数（各场景预设给参考值，可手调）
    R0 = float(params.get("R0", 2.6))
    latent = float(params.get("latent_days", 5.2))     # 潜伏期
    infectious = float(params.get("infectious_days", 6.0))  # 传染期
    IFR = float(params.get("IFR_pct", 0.6)) / 100.0    # 感染病死率
    I0 = float(params.get("I0", 20))                   # 初始病例
    E0 = float(params.get("E0", 60))                   # 初始潜伏

    gamma = 1.0 / infectious
    sigma = 1.0 / latent
    beta = R0 * gamma                                   # β = R0·γ（S≈N 时）

    # 干预（时间序列或标量；缺省无干预）
    def series(key, default):
        v = params.get(key)
        if isinstance(v, (int, float)):
            return lambda t: float(v)
        # 列表 [ [t0,t1,value], ... ] 分段阶梯
        def f(t):
            out = default
            for seg in (v or []):
                if len(seg) >= 3 and seg[0] <= t < seg[1]:
                    out = float(seg[2])
            return out
        return f

    c_of_t = series("contact_series", 1.0)      # 接触率保留比例 0~1
    q_of_t = series("isolation_series", 0.0)    # 病例有效隔离比例 0~1
    v_of_t = series("vaccine_series", 0.0)      # 累计接种覆盖率 0~1
    hosp_rate = float(params.get("hosp_rate_pct", 5.0)) / 100.0
    hosp_cap = float(params.get("hosp_capacity", 800))   # 可用床位
    ventil_rate = float(params.get("ventil_rate_pct", 0.5)) / 100.0
    ventil_cap = float(params.get("ventil_capacity", 80))

    S, E, I, R, D = N - E0 - I0, E0, I0, 0.0, 0.0
    V = 0.0
    t = 0.0
    out = []
    peakI = 0.0
    peakT = 0.0
    peakHosp = 0.0
    peakHospT = 0.0
    peakVent = 0.0
    peakVentT = 0.0
    R0_eff0 = None
    total_infected = 0.0
    nsteps = 0
    max_rel_err = 0.0

    def rk4():
        nonlocal S, E, I, R, D, V
        def f(st):
            s, e, i = st[0], st[1], st[2]
            c = c_of_t(t)
            q = q_of_t(t)
            v = v_of_t(t)
            Sv = max(s - v * N, 0.0)
            lam = beta * c * (1.0 - q) * Sv * i / N
            return [-lam,                      # dS
                    lam - sigma * e,           # dE
                    sigma * e - gamma * i]     # dI
        st = [S, E, I]
        k1 = f(st)
        k2 = f([st[j] + 0.5 * dt * k1[j] for j in range(3)])
        k3 = f([st[j] + 0.5 * dt * k2[j] for j in range(3)])
        k4 = f([st[j] + dt * k3[j] for j in range(3)])
        for j in range(3):
            st[j] = st[j] + dt / 6.0 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])
        S, E, I = st[0], max(st[1], 0.0), max(st[2], 0.0)
        # 康复与死亡流
        dR = (1 - IFR) * gamma * I * dt
        dD = IFR * gamma * I * dt
        R += dR
        D += dD
        V = max(V, v_of_t(t) * N)

    while t < days - 1e-9:
        nsteps += 1
        rk4()
        t += dt
        # 质量守恒检查（每 10 步）
        if nsteps % 10 == 0:
            err = abs((S + E + I + R + D) / N - 1.0)
            if err > max_rel_err:
                max_rel_err = err
        hosp = I * hosp_rate
        vent = I * ventil_rate
        if I > peakI:
            peakI, peakT = I, t
        if hosp > peakHosp:
            peakHosp, peakHospT = hosp, t
        if vent > peakVent:
            peakVent, peakVentT = vent, t
        if R0_eff0 is None:
            R0_eff0 = R0 * c_of_t(t) * (1 - q_of_t(t)) * max(S, 0) / N
        out.append({
            "day": round(t, 2),
            "S": round(S, 0), "E": round(E, 0), "I": round(I, 0),
            "R": round(R, 0), "D": round(D, 0),
            "new_cases": round(max(0.0, (I - (out[-1]["I"] if out else I0)) + gamma * I * dt) if False else gamma * I * dt * 0 + max(0.0, 0.0), 1),
            "hospitalized": round(hosp, 0),
            "ventilator": round(vent, 0),
            "Re": round(R0 * c_of_t(t) * (1 - q_of_t(t)) * max(S, 0) / N, 3),
        })
        if len(out) % 100 == 0 and len(out) > 10000:
            break

    # 后处理：新增病例 = -ΔS（每报告日近似取日步进）
    daily = []
    prev_S = N - E0 - I0
    for i, row in enumerate(out):
        dS = prev_S - row["S"]
        daily.append(dS)
        prev_S = row["S"]
    for i in range(len(out)):
        out[i]["new_cases"] = round(max(0.0, daily[i]), 1)
    # 压峰后每 1 日抽样（页面画图与表格用）
    sampled = [r for r in out if (r["day"] * 10) % 10 < dt + 1e-9 or r["day"] >= days - 1]

    final = out[-1]
    attack_rate = (final["R"] + final["D"] + final["I"] + final["E"]) / N * 100.0
    return {
        "model": "SEIR (RK4)",
        "params": {"N": N, "R0": R0, "latent": latent, "infectious": infectious,
                   "IFR": IFR, "gamma": round(gamma, 4), "sigma": round(sigma, 4),
                   "beta": round(beta, 4), "hosp_rate": hosp_rate,
                   "ventil_rate": ventil_rate},
        "R0_eff0": round(R0_eff0 if R0_eff0 is not None else R0, 3),
        "peak": {"I": round(peakI, 0), "day": round(peakT, 1),
                 "hosp": round(peakHosp, 0), "hosp_day": round(peakHospT, 1),
                 "vent": round(peakVent, 0), "vent_day": round(peakVentT, 1)},
        "final": {"S": round(final["S"], 0), "R": round(final["R"], 0),
                  "D": round(final["D"], 0), "attack_rate_pct": round(attack_rate, 2)},
        "capacity": {"hosp_cap": hosp_cap, "vent_cap": ventil_cap,
                     "hosp_exceeded_days": sum(1 for r in out if r["hospitalized"] > hosp_cap),
                     "vent_exceeded_days": sum(1 for r in out if r["ventilator"] > ventil_cap)},
        "quality": {"mass_error_max": round(max_rel_err, 8), "steps": nsteps,
                    "dt": dt, "note": "质量守恒检查 |S+E+I+R+D - N|/N 的最大值"},
        "series": sampled,
        "daily": [{"day": r["day"], "new_cases": r["new_cases"]} for r in sampled],
        "disclaimer": "教学模型：SEIR 分室模型 + 理想均匀混合假设。真实决策请依据当地疾控中心数据与专业模型（多空间/年龄结构/实际接触矩阵）。",
    }


PRESETS = {
    "flu": {"name": "流感样（参考）", "R0": 1.5, "latent_days": 2.0, "infectious_days": 4.0,
            "IFR_pct": 0.05, "hosp_rate_pct": 1.2, "ventil_rate_pct": 0.05,
            "desc": "潜伏 2 天、传染 4 天、R0≈1.5，病死率很低"},
    "covid": {"name": "新冠早期株（参考）", "R0": 2.6, "latent_days": 5.2, "infectious_days": 6.0,
              "IFR_pct": 0.6, "hosp_rate_pct": 5.0, "ventil_rate_pct": 0.5,
              "desc": "潜伏 5.2 天、传染 6 天、R0≈2.6（原始株公开文献量级，非当前变异株）"},
    "measles": {"name": "麻疹（参考）", "R0": 15.0, "latent_days": 10.0, "infectious_days": 8.0,
                "IFR_pct": 0.1, "hosp_rate_pct": 2.0, "ventil_rate_pct": 0.1,
                "desc": "R0 极高（15），说明疫苗接种覆盖必须 >93% 才能阻断"},
    "mild": {"name": "轻度呼吸道（假设）", "R0": 1.8, "latent_days": 4.0, "infectious_days": 5.0,
             "IFR_pct": 0.2, "hosp_rate_pct": 2.5, "ventil_rate_pct": 0.2,
             "desc": "自定义起点：中等传染性、低病死率"},
    "severe": {"name": "高重症假设（教学）", "R0": 3.2, "latent_days": 6.0, "infectious_days": 8.0,
               "IFR_pct": 1.8, "hosp_rate_pct": 9.0, "ventil_rate_pct": 1.5,
               "desc": "教学极端情景：用于演示医疗资源挤兑，勿对应任何真实疾病"},
}


def intervention_compare(base):
    """对比三种干预策略：不干预 / 强隔离 / 隔离+疫苗，返回各自峰值与曲线。"""
    scenarios = []
    p = dict(base)
    p.pop("contact_series", None); p.pop("isolation_series", None); p.pop("vaccine_series", None)

    r0 = seir(dict(p))
    scenarios.append({"name": "不干预", "res": r0,
                      "curve": [{"day": r["day"], "I": r["I"]} for r in r0["series"]]})

    p1 = dict(p)
    p1["contact_series"] = [[0, 30, 0.60], [30, 999, 0.45]]
    p1["isolation_series"] = [[0, 999, 0.35]]
    r1 = seir(p1)
    scenarios.append({"name": "隔离+降低接触（第0天起）", "res": r1,
                      "curve": [{"day": r["day"], "I": r["I"]} for r in r1["series"]]})

    p2 = dict(p)
    p2["contact_series"] = [[0, 999, 0.55]]
    p2["isolation_series"] = [[0, 999, 0.30]]
    p2["vaccine_series"] = [[0, 60, 0.0], [60, 120, 0.50], [120, 999, 0.80]]
    r2 = seir(p2)
    scenarios.append({"name": "隔离+接种（60天后达50%，120天80%）", "res": r2,
                      "curve": [{"day": r["day"], "I": r["I"]} for r in r2["series"]]})
    return scenarios
