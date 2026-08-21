# -*- coding: utf-8 -*-
"""
demos.py —— 小车-倒立摆教学演示（绘图入口）

用法示例:
    python demos.py --list                     # 列出所有 demo
    python demos.py --demo lqr                 # 交互显示
    python demos.py --demo lqr --save          # 存 PNG 到 python/figures/
    python demos.py --demo all --save          # 一次跑完所有非动画 demo
    python demos.py --demo animate --mode swingup          # 实时动画
    python demos.py --demo animate --mode lqr --save --gif # 存 GIF（需 Pillow）

全部 demo:
    pid       单环 PID：角度稳住了，小车却漂走（并解释为什么）
    cascade   串级 PID：外环位置 -> 内环角度，角度与位置同时稳住
    lqr       LQR 响应，并打印 K、闭环极点、Riccati 解 P
    compare   同一扰动下 串级PID vs LQR 的定量对比（含指标表）
    qr-sweep  扫描 Q/R 权重：闭环极点轨迹 + "响应快慢 vs 控制能量"权衡曲线
    swingup   能量法摆起（theta=pi -> 直立）并由 LQR 接住，标注切换时刻
    sampling  扫描采样周期 Ts，给出 ZOH 下 LQR 失稳的临界值
    robust    模型失配（真实摆长/质量 != 设计值）时 PID 与 LQR 的鲁棒性对比
    animate   小车+摆杆实时动画（--mode pid|cascade|lqr|swingup）
"""

from __future__ import annotations

import argparse
import logging
import math
import os
import sys
import warnings

import numpy as np

import pendulum as pdl
from pendulum import (PendulumParams, DEFAULT_Q, DEFAULT_R, linearize, lqr, ctrb,
                      simulate, metrics, make_reference, wrap_pi, c2d_zoh,
                      PID, CascadePID, LQRController, SwingUpController,
                      pendulum_energy, HAS_SCIPY)

# Windows 控制台默认 GBK，强制 UTF-8 输出，保证中文不乱码
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:       # pragma: no cover
    pass

HERE = os.path.dirname(os.path.abspath(__file__))
FIGDIR = os.path.join(HERE, "figures")

plt = None          # 由 _setup_matplotlib() 赋值
mpl = None
CN = False          # 是否有可用中文字体


# ===========================================================================
# matplotlib 初始化：后端选择 + 中文字体回退
# ===========================================================================
def _setup_matplotlib(save: bool, show: bool):
    """必须在 import pyplot **之前**选好后端，否则 Agg 设置无效。"""
    global plt, mpl, CN
    import matplotlib
    mpl = matplotlib
    if not show:
        matplotlib.use("Agg")      # 无头/保存模式：绝不弹窗、绝不阻塞
    import matplotlib.pyplot as _plt
    plt = _plt

    # --- 中文字体回退：找不到就退回英文标签，既不抛异常也不满屏警告 ---
    from matplotlib import font_manager
    installed = {f.name for f in font_manager.fontManager.ttflist}
    for cand in ("Microsoft YaHei", "SimHei", "DengXian", "SimSun", "KaiTi",
                 "Noto Sans CJK SC", "Source Han Sans SC", "WenQuanYi Micro Hei",
                 "PingFang SC", "Heiti SC", "Arial Unicode MS"):
        if cand in installed:
            plt.rcParams["font.sans-serif"] = [cand, "DejaVu Sans"]
            plt.rcParams["font.family"] = "sans-serif"
            CN = True
            break
    plt.rcParams["axes.unicode_minus"] = False        # 负号用 ASCII，避免缺字形
    # 即便字体齐全，个别符号也可能缺失：统一压掉 glyph 警告，保持输出干净
    warnings.filterwarnings("ignore", message=".*[Mm]issing from font.*")
    warnings.filterwarnings("ignore", message=".*Glyph.*")
    logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)
    _build_glyph_fallback()
    plt.rcParams.update({
        "figure.autolayout": False,
        "axes.grid": True,
        "grid.alpha": 0.3,
        "axes.titlesize": 11,
        "axes.labelsize": 10,
        "legend.fontsize": 9,
        "figure.titlesize": 13,
    })
    return CN


# 标签里用到的特殊符号 -> 该字体缺失时的 ASCII 替代
_SPECIAL = {"°": " deg", "²": "^2", "³": "^3", "·": ".", "±": "+/-",
            "≈": "~", "∫": "int ", "μ": "u", "×": "x"}
_TRANS = {}


def _build_glyph_fallback():
    """检查所选字体是否真的有这些符号；缺失的登记成 ASCII 替代（由 L() 施加）。

    这样即使换到只有基本汉字的字体（或只有 DejaVu 的裸环境），
    图上也不会出现"豆腐块"，更不会满屏 glyph 警告。
    """
    global _TRANS
    _TRANS = {}
    try:
        from matplotlib import font_manager
        from matplotlib.ft2font import FT2Font
        fam = plt.rcParams["font.sans-serif"][0]
        path = font_manager.findfont(font_manager.FontProperties(family=fam))
        face = FT2Font(path)
        _TRANS = {ord(k): v for k, v in _SPECIAL.items()
                  if face.get_char_index(ord(k)) == 0}
    except Exception:            # 字体探测失败就当作全都可用，绝不因此报错
        _TRANS = {}


def L(cn: str, en: str) -> str:
    """标签双语回退：有中文字体用中文，否则用英文；再按字体覆盖情况替换特殊符号。"""
    s = cn if CN else en
    return s.translate(_TRANS) if _TRANS else s


def _finish(fig, name: str, args):
    """统一收尾：保存 / 显示 / 关闭。"""
    out = None
    if args.save:
        os.makedirs(FIGDIR, exist_ok=True)
        out = os.path.join(FIGDIR, f"{name}.png")
        fig.savefig(out, dpi=args.dpi, bbox_inches="tight")
        print(f"  [图] 已保存: {out}")
    if args.show:
        plt.show()
    plt.close(fig)
    return out


def _hline(ax, y, **kw):
    kw.setdefault("color", "0.5")
    kw.setdefault("lw", 0.8)
    kw.setdefault("ls", ":")
    ax.axhline(y, **kw)


def _mark_events(ax, events, color="tab:red"):
    for te, lab in events:
        ax.axvline(te, color=color, lw=0.9, ls="--", alpha=0.8)
        ax.annotate(lab, xy=(te, ax.get_ylim()[1]), xytext=(3, -10),
                    textcoords="offset points", fontsize=8, color=color,
                    va="top", ha="left")


def _print_table(title, rows, headers):
    """控制台等宽表格输出。"""
    print("\n  " + title)
    w = [max(len(str(h)), max((len(str(r[i])) for r in rows), default=0)) + 2
         for i, h in enumerate(headers)]
    line = "  " + "".join(str(h).ljust(w[i]) for i, h in enumerate(headers))
    print(line)
    print("  " + "-" * (sum(w) - 1))
    for r in rows:
        print("  " + "".join(str(c).ljust(w[i]) for i, c in enumerate(r)))


# ===========================================================================
# demo 1: 单环 PID —— 角度稳住、小车漂走
# ===========================================================================
def demo_pid(args):
    """教学要点：单环 PID 只反馈角度，闭环里小车位置/速度方向是**中性稳定**的，
    受扰后小车会一路漂走，且推导可证明这不是调参问题（见下面的打印说明）。"""
    p = PendulumParams()
    ctrl = PID(p)
    dist = [{"type": "impulse", "t": 3.0, "force": 0.4},
            {"type": "impulse", "t": 8.0, "force": 0.4}]
    r = simulate(ctrl, [0.0, 0.0, 0.05, 0.0], 16.0, p, Ts=args.Ts,
                 disturbances=dist, Q=DEFAULT_Q, R=DEFAULT_R)
    m = metrics(r)

    A, B = linearize(p)
    a1, a2 = B[1, 0], A[1, 1]
    b1, b2 = B[3, 0], A[3, 1]
    print(f"  PID 增益: kp={ctrl.gains[0]}, ki={ctrl.gains[1]}, kd={ctrl.gains[2]}"
          f"   (误差取 e = theta - theta_ref)")
    print(f"  角度: max|theta| = {m['max_abs_theta']:.4f} rad, "
          f"末态 theta = {r['theta'][-1]:+.2e} rad  -> 角度被稳住了")
    print(f"  小车: 末态 x = {r['x'][-1]:+.3f} m, x_dot = {r['x_dot'][-1]:+.4f} m/s"
          f"  -> 一路漂走，没有任何回中的趋势")
    print("  为什么？u -> theta 的传递函数分子上，小车速度那一项的系数"
          f"\n    a1*b2 - a2*b1 = {a1 * b2 - a2 * b1:.3e} ≈ 0，")
    print("    即'小车匀速漂移'这个模态在角度测量里**完全看不见**（零点极点对消）。")
    print("    因此对任意 x_dot，只要 u = b*x_dot、theta = 0，两条运动方程同时满足：")
    print("    存在一整族'匀速漂移平衡点'。单环角度反馈无法分辨它们 —— 这不是调参能解决的，")
    print("    必须把 x 也纳入反馈（见 cascade / lqr）。")

    fig, axes = plt.subplots(3, 1, figsize=(9, 8), sharex=True)
    fig.suptitle(L("demo: 单环 PID —— 角度稳住，小车漂走",
                   "demo: single-loop PID - angle stabilized, cart drifts away"))
    ax = axes[0]
    ax.plot(r["t"], np.rad2deg(r["theta"]), color="tab:blue")
    _hline(ax, 0)
    ax.set_ylabel(L("摆角 theta (度)", "theta (deg)"))
    ax.set_title(L("角度：被 PID 稳定在 0 附近", "angle: regulated to zero"))
    _mark_events(ax, [(3.0, L("冲量扰动", "impulse")), (8.0, L("冲量扰动", "impulse"))])

    ax = axes[1]
    ax.plot(r["t"], r["x"], color="tab:red", label=L("小车位置 x", "cart position x"))
    ax.plot(r["t"], r["x_dot"], color="tab:orange", lw=1.0,
            label=L("小车速度 x_dot", "cart velocity"))
    _hline(ax, 0)
    ax.set_ylabel(L("位置 (m) / 速度 (m/s)", "x (m) / x_dot (m/s)"))
    ax.set_title(L("小车：位置无人管，扰动后一路漂走（中性稳定模态）",
                   "cart: unregulated, drifts away (neutrally stable mode)"))
    ax.legend(loc="lower left")

    ax = axes[2]
    ax.step(r["t"], r["u"], where="post", color="tab:green", lw=1.0)
    _hline(ax, p.u_max, color="0.3", ls="--")
    _hline(ax, -p.u_max, color="0.3", ls="--")
    ax.set_ylabel(L("控制力 u (N)", "u (N)"))
    ax.set_xlabel(L("时间 t (s)", "time t (s)"))
    ax.set_title(L(f"控制力（限幅 ±{p.u_max:g} N，ZOH 采样周期 {r['Ts'] * 1e3:g} ms）",
                   f"control force (sat ±{p.u_max:g} N, Ts = {r['Ts'] * 1e3:g} ms)"))
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    return _finish(fig, "pid", args)


# ===========================================================================
# demo 2: 串级 PID
# ===========================================================================
def demo_cascade(args):
    """教学要点：外环（慢）把'位置误差'翻译成'该往哪边倒'的角度给定，
    内环（快）跟踪这个角度给定 —— 时标分离是串级能工作的前提。"""
    p = PendulumParams()
    ctrl = CascadePID(p)
    ref = make_reference("step", amp=0.3, t0=8.0)
    dist = [{"type": "impulse", "t": 3.0, "force": 0.4}]
    r = simulate(ctrl, [0.0, 0.0, 0.05, 0.0], 16.0, p, Ts=args.Ts, ref=ref,
                 disturbances=dist, Q=DEFAULT_Q, R=DEFAULT_R)
    m = metrics(r)
    m_dist = metrics(r, theta_tol=math.radians(0.5), x_tol=0.01, t_from=3.0, t_to=8.0)
    m_step = metrics(r, theta_tol=math.radians(0.5), x_tol=0.01, t_from=8.0)
    tref = np.array(ctrl.theta_ref_log)

    print(f"  内环(角度) kp,ki,kd = {ctrl.gains_inner}")
    print(f"  外环(位置) kpx,kix,kdx = {ctrl.gains_outer}, "
          f"角度给定限幅 ±{ctrl.theta_max} rad, 外环每 {ctrl.outer_div} 个采样周期更新一次")
    print(f"  max|theta| = {m['max_abs_theta']:.4f} rad = {np.rad2deg(m['max_abs_theta']):.2f}°")
    print(f"  3 s 冲量扰动后 {m_dist['settle_both']:.2f} s 内回到 |theta|<0.5° 且 |x|<1 cm")
    print(f"  8 s 位置阶跃后 {m_step['settle_both']:.2f} s 内跟踪到位（同样判据）")
    print(f"  末态 x = {r['x'][-1]:+.4f} m（参考 {r['ref'][-1, 0]:+.2f} m）, "
          f"theta = {r['theta'][-1]:+.2e} rad -> 位置与角度**同时**稳住")
    print("  注意 8 s 处位置给定阶跃到 +0.3 m 时，小车先**向反方向**动一下：")
    print("    因为要往 +x 走必须先让摆杆往 +x 倒，而让摆杆往 +x 倒必须先把小车往 -x 推。")

    fig, axes = plt.subplots(3, 1, figsize=(9, 8.5), sharex=True)
    fig.suptitle(L("demo: 串级 PID —— 外环位置 / 内环角度",
                   "demo: cascade PID - outer position / inner angle"))
    ax = axes[0]
    ax.plot(r["t"], np.rad2deg(r["theta"]), color="tab:blue",
            label=L("实际角度 theta", "actual theta"))
    if tref.size:
        ax.plot(tref[:, 0], np.rad2deg(tref[:, 1]), color="tab:purple", lw=1.0, ls="--",
                label=L("外环给出的角度给定 theta_ref", "theta_ref from outer loop"))
    _hline(ax, 0)
    ax.set_ylabel(L("角度 (度)", "angle (deg)"))
    ax.set_title(L("内环：角度跟踪外环给定", "inner loop: angle tracks outer setpoint"))
    ax.legend(loc="upper right")
    _mark_events(ax, [(3.0, L("冲量扰动", "impulse")), (8.0, L("位置阶跃", "position step"))])

    ax = axes[1]
    ax.plot(r["t"], r["x"], color="tab:red", label=L("小车位置 x", "cart x"))
    ax.plot(r["t"], r["ref"][:, 0], color="0.4", lw=1.0, ls="--",
            label=L("位置给定 x_ref", "x_ref"))
    ax.set_ylabel(L("位置 (m)", "x (m)"))
    ax.set_title(L("外环：小车位置被拉回给定（对比 pid demo 的漂移）",
                   "outer loop: cart position regulated (cf. drift in 'pid' demo)"))
    ax.legend(loc="upper left")

    ax = axes[2]
    ax.step(r["t"], r["u"], where="post", color="tab:green", lw=1.0)
    _hline(ax, p.u_max, color="0.3", ls="--")
    _hline(ax, -p.u_max, color="0.3", ls="--")
    ax.set_ylabel(L("控制力 u (N)", "u (N)"))
    ax.set_xlabel(L("时间 t (s)", "time t (s)"))
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    return _finish(fig, "cascade", args)


# ===========================================================================
# demo 3: LQR
# ===========================================================================
def demo_lqr(args):
    """教学要点：一次性把 4 个状态都用上，权重 Q/R 直接对应"你在乎什么"。"""
    p = PendulumParams()
    A, B = linearize(p)
    Cm, rank, cond = ctrb(A, B)
    K, P, eigs, meta = lqr(A, B, DEFAULT_Q, DEFAULT_R, return_info=True)

    np.set_printoptions(precision=6, suppress=True, linewidth=120)
    print("  A =\n", np.array2string(A, prefix="     "))
    print("  B^T =", B.ravel())
    print("  开环极点 =", np.sort_complex(np.linalg.eigvals(A)))
    print(f"  可控性矩阵秩 = {rank}（满秩=4 -> 可任意配置极点）, 条件数 = {cond:.1f}")
    zx = np.sort_complex(pdl.tf_zeros(A, B, [1, 0, 0, 0]))
    zt = np.sort_complex(pdl.tf_zeros(A, B, [0, 0, 1, 0]))
    print(f"  u -> x     通道零点 = {np.array2string(zx.real, precision=4)}"
          f"   <- 有一个**右半平面零点** +{zx.real.max():.4f}（非最小相位！）")
    print(f"    理论值 sqrt(3g/(2L)) = {math.sqrt(3 * p.g / (2 * p.L)):.4f}"
          f"（无摩擦时精确相等），这就是'先反向动一下'的数学根源")
    print(f"  u -> theta 通道零点 = {np.array2string(zt.real, precision=4)}"
          f"   <- 原点处双重零点：小车漂移模态被零极点对消，单环角度 PID 看不见它")
    print(f"  Q = diag({', '.join(f'{v:g}' for v in np.diag(DEFAULT_Q))}),  "
          f"R = {DEFAULT_R[0, 0]:g}")
    print("  LQR 增益 K =", K.ravel())
    print("  闭环极点 =", np.sort_complex(eigs))
    print("  Riccati 解 P =\n", np.array2string(P, prefix="     "))
    print(f"  CARE 残差 = {meta['residual']:.3e}（Newton {meta['newton_iters']} 次迭代，"
          f"值迭代反向积分 {meta['vi_tau']:.2f} s）")
    if HAS_SCIPY:
        print(f"  与 scipy.solve_continuous_are 相对误差 = {meta['err_scipy']:.3e}")
    print(f"  u = -K(s - s_ref)：注意 K[2] = {K[0, 2]:.3f} < 0，即 theta > 0 时 u > 0")
    print("    （摆杆往 +x 倒，就要把小车往 +x 推去接住它）")

    ctrl = LQRController(p, K=K)
    r1 = simulate(ctrl, [0.0, 0.0, 0.2, 0.0], 6.0, p, Ts=args.Ts, Q=DEFAULT_Q, R=DEFAULT_R)
    r2 = simulate(LQRController(p, K=K), [-0.4, 0.0, 0.0, 0.0], 6.0, p, Ts=args.Ts,
                  Q=DEFAULT_Q, R=DEFAULT_R)
    r3 = simulate(LQRController(p, K=K), [0.0, 0.0, 0.0, 0.0], 10.0, p, Ts=args.Ts,
                  ref=make_reference("square", amp=0.25, t0=1.0, period=6.0),
                  Q=DEFAULT_Q, R=DEFAULT_R)

    fig = plt.figure(figsize=(11, 8.5))
    fig.suptitle(L("demo: LQR 状态反馈 u = -K(s - s_ref)",
                   "demo: LQR state feedback u = -K(s - s_ref)"))
    gs = fig.add_gridspec(3, 2, height_ratios=[1, 1, 1.1], hspace=0.45, wspace=0.28)

    ax = fig.add_subplot(gs[0, 0])
    ax.plot(r1["t"], np.rad2deg(r1["theta"]), label=L("theta (度)", "theta (deg)"))
    ax.plot(r1["t"], r1["x"] * 100, label=L("x (cm)", "x (cm)"))
    ax.set_title(L("初值 theta0 = 0.2 rad", "initial theta0 = 0.2 rad"))
    ax.set_xlabel(L("t (s)", "t (s)")); ax.legend()

    ax = fig.add_subplot(gs[0, 1])
    ax.plot(r2["t"], np.rad2deg(r2["theta"]), label=L("theta (度)", "theta (deg)"))
    ax.plot(r2["t"], r2["x"] * 100, label=L("x (cm)", "x (cm)"))
    ax.set_title(L("初值 x0 = -0.4 m（先反向倒杆再走过去）",
                   "initial x0 = -0.4 m (lean first, then move)"))
    ax.set_xlabel(L("t (s)", "t (s)")); ax.legend()

    ax = fig.add_subplot(gs[1, :])
    ax.plot(r3["t"], r3["x"], label=L("小车位置 x", "cart x"))
    ax.plot(r3["t"], r3["ref"][:, 0], "0.4", ls="--", lw=1.0, label=L("方波给定", "square ref"))
    ax2 = ax.twinx()
    ax2.plot(r3["t"], np.rad2deg(r3["theta"]), color="tab:red", lw=0.9, alpha=0.8,
             label=L("theta (度)", "theta (deg)"))
    ax2.set_ylabel(L("theta (度)", "theta (deg)"), color="tab:red")
    ax2.grid(False)
    ax.set_title(L("位置方波跟踪（摆角始终 < 3 度）",
                   "square-wave position tracking (|theta| < 3 deg)"))
    ax.set_xlabel(L("t (s)", "t (s)")); ax.set_ylabel(L("x (m)", "x (m)")); ax.legend(loc="upper left")

    ax = fig.add_subplot(gs[2, 0])
    op = np.linalg.eigvals(A)
    ax.axhline(0, color="0.6", lw=0.8); ax.axvline(0, color="0.6", lw=0.8)
    ax.plot(op.real, op.imag, "x", ms=10, color="tab:red", label=L("开环极点", "open-loop"))
    ax.plot(eigs.real, eigs.imag, "o", ms=7, mfc="none", color="tab:blue",
            label=L("闭环极点", "closed-loop"))
    ax.set_title(L("极点：开环有一个 +5.44 的不稳定极点", "poles: unstable OL pole at +5.44"))
    ax.set_xlabel("Re"); ax.set_ylabel("Im"); ax.legend(loc="upper left")

    ax = fig.add_subplot(gs[2, 1])
    ax.axis("off")
    txt = (f"K = [{K[0,0]:.4f}, {K[0,1]:.4f}, {K[0,2]:.4f}, {K[0,3]:.4f}]\n\n"
           + L("闭环极点:\n", "closed-loop poles:\n")
           + "\n".join(f"   {ev.real:+.5f} {ev.imag:+.5f}j" for ev in np.sort_complex(eigs))
           + f"\n\nJ({L('累积代价', 'cost')}, theta0=0.2) = {r1['J']:.5f}"
           + f"\nCARE {L('残差', 'residual')} = {meta['residual']:.2e}")
    ax.text(0.0, 1.0, txt, va="top", ha="left", family="monospace", fontsize=9)
    ax.set_title(L("参考数值（可用于交叉验证）", "reference numbers (for cross-check)"))
    return _finish(fig, "lqr", args)


# ===========================================================================
# demo 4: 串级 PID vs LQR
# ===========================================================================
def demo_compare(args):
    """教学要点：同一扰动下比"最大角偏 / 稳定时间 / 控制能量 / 累积代价"。
    LQR 是在 J = ∫(s^T·Q·s + u^T·R·u)dt 意义下的最优解，J 一栏它必然更小。"""
    p = PendulumParams()
    dist = [{"type": "impulse", "t": 1.0, "force": 0.15}]
    s0 = [0.0, 0.0, 0.0, 0.0]
    t_end = 12.0
    runs = {}
    A, B = linearize(p)
    K, P, eigs = lqr(A, B, DEFAULT_Q, DEFAULT_R)
    for name, ctrl in ((L("串级 PID", "cascade PID"), CascadePID(p)),
                       ("LQR", LQRController(p, K=K))):
        runs[name] = simulate(ctrl, s0, t_end, p, Ts=args.Ts, disturbances=dist,
                              Q=DEFAULT_Q, R=DEFAULT_R)

    rows = []
    for name, r in runs.items():
        m = metrics(r, theta_tol=math.radians(0.5), x_tol=0.01)
        rows.append([name,
                     f"{np.rad2deg(m['max_abs_theta']):.3f}",
                     f"{m['max_abs_x'] * 100:.2f}",
                     f"{m['settle_both']:.2f}",
                     f"{m['u_energy']:.3f}",
                     f"{m['max_abs_u']:.2f}",
                     f"{m['J']:.4f}"])
    headers = [L("控制器", "controller"), L("最大角偏(度)", "max|theta|(deg)"),
               L("最大位偏(cm)", "max|x|(cm)"), L("稳定时间(s)", "settling(s)"),
               L("控制能量∫u²dt", "energy ∫u²dt"), L("峰值|u|(N)", "peak|u|(N)"),
               L("累积代价J", "cost J")]
    _print_table(L("同一 0.15 N·s 冲量扰动下的定量指标（稳定判据: |theta|<0.5°, |x|<1cm）",
                   "metrics under the same 0.15 N*s impulse"), rows, headers)
    print("\n  结论：LQR 用更小的控制能量得到更小的累积代价 J（它就是 J 的最优解）；")
    print("        串级 PID 结构简单、只需两个 SISO 回路，但要手工分配时标，代价更大。")

    fig, axes = plt.subplots(4, 1, figsize=(9.5, 10),
                            gridspec_kw={"height_ratios": [1, 1, 1, 0.75]})
    fig.suptitle(L("demo: 串级 PID vs LQR（同一冲量扰动 0.15 N·s @ t=1 s）",
                   "demo: cascade PID vs LQR (same 0.15 N*s impulse at t=1 s)"))
    colors = {list(runs)[0]: "tab:orange", "LQR": "tab:blue"}
    for name, r in runs.items():
        axes[0].plot(r["t"], np.rad2deg(r["theta"]), color=colors[name], label=name)
        axes[1].plot(r["t"], r["x"] * 100, color=colors[name], label=name)
        axes[2].step(r["t"], r["u"], where="post", color=colors[name], lw=1.0, label=name)
    axes[0].set_ylabel(L("theta (度)", "theta (deg)")); axes[0].legend()
    axes[0].set_title(L("摆角响应", "angle response"))
    axes[1].set_ylabel(L("x (cm)", "x (cm)")); axes[1].legend()
    axes[1].set_title(L("小车位置响应", "cart position response"))
    axes[2].set_ylabel(L("u (N)", "u (N)")); axes[2].legend()
    axes[2].set_title(L("控制力", "control force"))
    axes[2].set_xlabel(L("时间 t (s)", "time t (s)"))
    for ax in axes[:3]:
        _hline(ax, 0)
        ax.axvline(1.0, color="tab:red", lw=0.9, ls="--", alpha=0.8)

    ax = axes[3]
    ax.axis("off")
    tb = ax.table(cellText=rows, colLabels=headers, loc="center", cellLoc="center")
    tb.auto_set_font_size(False)
    tb.set_fontsize(8.5)
    tb.scale(1.0, 1.35)
    ax.set_title(L("定量指标对比", "quantitative comparison"), pad=18)
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    return _finish(fig, "compare", args)


# ===========================================================================
# demo 5: Q/R 权重扫描（Bryson 定则）
# ===========================================================================
def demo_qr_sweep(args):
    """教学要点：R 越大 -> 越"舍不得用力" -> 极点越慢、控制能量越小；
    Bryson 定则给出量纲上合理的初值：Q_ii = 1/x_i,max², R = 1/u_max²。"""
    p = PendulumParams()
    A, B = linearize(p)
    Rs = np.logspace(-2, 2, 17)          # R 从 0.01 到 100
    data = []
    for Rv in Rs:
        K, P, eigs = lqr(A, B, DEFAULT_Q, [[Rv]])
        r = simulate(LQRController(p, K=K), [0.0, 0.0, 0.1, 0.0], 25.0, p,
                     Ts=args.Ts, Q=DEFAULT_Q, R=[[Rv]])
        m = metrics(r, theta_tol=math.radians(0.5), x_tol=0.01)
        data.append(dict(R=Rv, K=K.ravel().copy(), eigs=eigs.copy(),
                         settle=m["settle_both"], energy=m["u_energy"],
                         maxu=m["max_abs_u"], J=m["J"],
                         slowest=float(np.max(eigs.real))))
    # Bryson 定则参考点：x_max=0.5 m, x_dot_max=1, theta_max=0.2 rad, thetadot_max=1
    R_bryson = 1.0 / p.u_max ** 2
    Q_bryson = np.diag([1 / 0.5 ** 2, 1.0, 1 / 0.2 ** 2, 1.0])
    K_b, P_b, e_b = lqr(A, B, Q_bryson, [[R_bryson]])

    rows = [[f"{d['R']:.3g}", f"{d['slowest']:.3f}", f"{d['settle']:.2f}",
             f"{d['energy']:.4f}", f"{d['maxu']:.2f}",
             f"[{', '.join(f'{k:.2f}' for k in d['K'])}]"]
            for d in data[::4]]
    _print_table(L("R 扫描（Q = diag(1,1,20,1) 固定，初值 theta0 = 0.1 rad）",
                   "R sweep (Q fixed, theta0 = 0.1 rad)"),
                 rows, ["R", L("主导极点实部", "dominant Re"), L("稳定时间(s)", "settling(s)"),
                        L("∫u²dt", "∫u²dt"), L("峰值|u|(N)", "peak|u|"), "K"])
    print(f"\n  Bryson 定则参考点: Q = diag(4, 1, 25, 1), R = 1/u_max² = {R_bryson:g}")
    print(f"    -> K = [{', '.join(f'{k:.3f}' for k in K_b.ravel())}]")
    print(f"    -> 闭环极点 = {np.sort_complex(e_b)}")
    print("  教学要点：R 增大 10 倍，控制能量显著下降但响应变慢；这条权衡曲线就是"
          "\n    '性能 vs 代价'的帕累托前沿，Bryson 定则只是选一个量纲合理的起点。")

    fig = plt.figure(figsize=(11, 8))
    fig.suptitle(L("demo: LQR 权重扫描 —— 极点轨迹与'快慢 vs 能量'权衡",
                   "demo: LQR weight sweep - pole locus and speed/energy trade-off"))
    gs = fig.add_gridspec(2, 2, hspace=0.35, wspace=0.3)

    ax = fig.add_subplot(gs[:, 0])
    cmap = plt.get_cmap("viridis")
    norm = mpl.colors.LogNorm(vmin=Rs[0], vmax=Rs[-1])
    for d in data:
        ax.plot(d["eigs"].real, d["eigs"].imag, "o", ms=5, mfc="none",
                color=cmap(norm(d["R"])))
    op = np.linalg.eigvals(A)
    ax.plot(op.real, op.imag, "x", ms=11, color="tab:red", label=L("开环极点", "open-loop"))
    ax.axhline(0, color="0.6", lw=0.8); ax.axvline(0, color="0.7", lw=1.2)
    ax.set_xlim(-45, 8)
    ax.set_title(L("闭环极点轨迹（颜色 = R）", "closed-loop pole locus (color = R)"))
    ax.set_xlabel("Re"); ax.set_ylabel("Im"); ax.legend(loc="upper left")
    fig.colorbar(mpl.cm.ScalarMappable(norm=norm, cmap=cmap), ax=ax,
                 label=L("控制权重 R", "control weight R"))

    ax = fig.add_subplot(gs[0, 1])
    ax.loglog([d["energy"] for d in data], [d["settle"] for d in data], "o-", ms=4)
    for d in data[::4]:
        ax.annotate(f"R={d['R']:.2g}", (d["energy"], d["settle"]), fontsize=8,
                    textcoords="offset points", xytext=(4, 4))
    ax.set_xlabel(L("控制能量 ∫u²dt (N²·s)", "control energy ∫u²dt"))
    ax.set_ylabel(L("稳定时间 (s)", "settling time (s)"))
    ax.set_title(L("权衡曲线：省力 <-> 快速（帕累托前沿）",
                   "trade-off: cheap control <-> fast response"))

    ax = fig.add_subplot(gs[1, 1])
    ax.semilogx(Rs, [-d["slowest"] for d in data], "o-", ms=4,
                label=L("主导极点 |Re| (rad/s)", "|Re| of dominant pole"))
    ax.semilogx(Rs, [d["maxu"] for d in data], "s-", ms=4,
                label=L("峰值控制力 |u| (N)", "peak |u| (N)"))
    ax.axvline(R_bryson, color="tab:red", ls="--", lw=1.0,
               label=L(f"Bryson: R = 1/u_max² = {R_bryson:g}",
                       f"Bryson R = 1/u_max² = {R_bryson:g}"))
    ax.set_xlabel("R"); ax.set_title(L("响应速度与峰值力随 R 的变化",
                                       "speed and peak force vs R"))
    ax.legend()
    # 这张图里有 colorbar 自建的 Axes，tight_layout 会报"不兼容"警告，改用手工留边
    fig.subplots_adjust(top=0.92, bottom=0.08, left=0.07, right=0.97)
    return _finish(fig, "qr-sweep", args)


# ===========================================================================
# demo 6: 能量法摆起
# ===========================================================================
def demo_swingup(args):
    """教学要点：摆起阶段控制的是**能量**（不是角度），
    E_p 泵到直立所需值后，状态自然进入 LQR 的吸引域，再切成 LQR 接住。"""
    p = PendulumParams()
    ctrl = SwingUpController(p)
    r = simulate(ctrl, [0.0, 0.0, math.pi, 0.0], 12.0, p, Ts=args.Ts,
                 Q=DEFAULT_Q, R=DEFAULT_R)
    log = np.array([(t, e, v) for t, mode, e, v in ctrl.mode_log])
    modes = [mode for _, mode, _, _ in ctrl.mode_log]
    sw = [t for t, kind in ctrl.switch_times if kind == "to_lqr"]
    t_sw = sw[0] if sw else float("nan")

    print(f"  能量法参数: k_E = {ctrl.k_E}, 回中增益 k_x = {ctrl.k_x}, k_xd = {ctrl.k_xd}")
    print(f"  能量目标 E_target = {ctrl.E_target:.4f} J = {ctrl.E_margin:g}·m·g·l"
          f"（略高于直立能量 0，用于补偿上行途中的摩擦损耗）")
    print(f"  初始摆杆能量 E_p(theta=pi) = {pendulum_energy([0, 0, math.pi, 0], p):.4f} J"
          f"  -> 需要泵入约 {-pendulum_energy([0, 0, math.pi, 0], p):.3f} J")
    print(f"  切换判据: |theta| < {ctrl.theta_sw} rad 且 V(e) = e^T·P·e < {ctrl.V_switch}"
          f"（用 LQR 代价函数估计吸引域）")
    print(f"  切换记录: {[(round(t, 3), k) for t, k in ctrl.switch_times]}"
          f"  -> 只切换一次，t_switch = {t_sw:.3f} s")
    print(f"  末态: x = {r['x'][-1]:+.2e} m, theta = {wrap_pi(r['theta'][-1]):+.2e} rad, "
          f"最大小车行程 = {np.max(np.abs(r['x'])):.2f} m")

    fig, axes = plt.subplots(4, 1, figsize=(9.5, 10), sharex=True)
    fig.suptitle(L("demo: 能量法摆起（theta=pi -> 直立）+ LQR 接住",
                   "demo: energy-based swing-up (theta=pi -> upright) + LQR catch"))
    ax = axes[0]
    ax.plot(r["t"], np.rad2deg(wrap_pi(r["theta"])), color="tab:blue",
            label=L("theta（折叠到 ±180°）", "theta (wrapped)"))
    ax.plot(r["t"], np.rad2deg(r["theta"]), color="0.7", lw=0.8,
            label=L("theta（未折叠）", "theta (unwrapped)"))
    _hline(ax, 0); _hline(ax, 180); _hline(ax, -180)
    ax.set_ylabel(L("角度 (度)", "angle (deg)")); ax.legend(loc="lower right")
    ax.set_title(L("摆角：从下垂 180° 摆到 0°", "angle: from hanging 180 deg to 0"))

    ax = axes[1]
    ax.plot(log[:, 0], log[:, 1], color="tab:purple", label=L("摆杆能量 E_p", "pendulum energy E_p"))
    ax.axhline(ctrl.E_target, color="tab:red", ls="--", lw=1.0,
               label=L(f"目标 E_target = {ctrl.E_target:.3f} J", f"E_target = {ctrl.E_target:.3f} J"))
    ax.axhline(0.0, color="0.5", ls=":", lw=0.9, label=L("直立能量 = 0", "upright energy = 0"))
    ax.set_ylabel(L("能量 (J)", "energy (J)")); ax.legend(loc="lower right")
    ax.set_title(L("能量泵：被控量其实是能量，不是角度",
                   "energy pump: the controlled quantity is energy, not angle"))

    ax = axes[2]
    ax.plot(r["t"], r["x"], color="tab:red", label=L("小车位置 x", "cart x"))
    ax.plot(r["t"], r["x_dot"], color="tab:orange", lw=0.9, label=L("小车速度", "cart velocity"))
    _hline(ax, 0)
    ax.set_ylabel(L("x (m) / x_dot (m/s)", "x (m) / x_dot (m/s)")); ax.legend(loc="lower right")

    ax = axes[3]
    ax.step(r["t"], r["u"], where="post", color="tab:green", lw=1.0)
    _hline(ax, p.u_max, color="0.3", ls="--"); _hline(ax, -p.u_max, color="0.3", ls="--")
    ax.set_ylabel(L("u (N)", "u (N)")); ax.set_xlabel(L("时间 t (s)", "time t (s)"))

    # 模式背景带 + 切换时刻标注
    tarr = log[:, 0]
    in_lqr = np.array([m == "lqr" for m in modes])
    for ax in axes:
        ax.fill_between(tarr, *ax.get_ylim(), where=in_lqr, color="tab:blue",
                        alpha=0.07, step="post")
        if not math.isnan(t_sw):
            ax.axvline(t_sw, color="tab:red", lw=1.2, ls="--")
    axes[0].annotate(L(f"切换到 LQR @ t = {t_sw:.2f} s", f"switch to LQR @ t = {t_sw:.2f} s"),
                     xy=(t_sw, 0), xytext=(t_sw + 0.6, 100), fontsize=9, color="tab:red",
                     arrowprops=dict(arrowstyle="->", color="tab:red", lw=1.0))
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    return _finish(fig, "swingup", args)


# ===========================================================================
# demo 7: 采样周期扫描
# ===========================================================================
def demo_sampling(args):
    """教学要点：连续域设计的 LQR 用 ZOH 离散实现时，采样太慢一定会失稳。
    临界 Ts 可以精确算出来：离散闭环 (Ad - Bd K) 的谱半径 = 1。"""
    p = PendulumParams()
    A, B = linearize(p)
    K, P, eigs = lqr(A, B, DEFAULT_Q, DEFAULT_R)
    tau_fast = -1.0 / float(np.min(eigs.real))

    def rho(Ts):
        Ad, Bd = c2d_zoh(A, B, Ts)
        return float(np.max(np.abs(np.linalg.eigvals(Ad - Bd @ K))))

    Tss = np.linspace(0.004, 0.09, 44)
    rhos = np.array([rho(t) for t in Tss])
    # 二分求 rho = 1 的临界采样周期
    lo, hi = 0.004, 0.09
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        if rho(mid) < 1.0:
            lo = mid
        else:
            hi = mid
    Ts_crit = 0.5 * (lo + hi)

    # 经验指标：末段 25% 时间里 theta 的 RMS（稳住 -> ~1e-5；抖振/失稳 -> 1e-2 以上）
    rms = []
    for Ts in Tss:
        r = simulate(LQRController(p, K=K), [0.0, 0.0, 0.05, 0.0], 8.0, p,
                     dt=Ts / 10, Ts=Ts)
        tail = r["theta"][int(0.75 * len(r["t"])):]
        rms.append(float(np.sqrt(np.mean(tail ** 2))))
    rms = np.array(rms)

    show_Ts = [0.01, min(Tss[-1], round(Ts_crit * 0.95, 4)), round(Ts_crit * 1.25, 4)]
    runs = []
    for Ts in show_Ts:
        runs.append((Ts, simulate(LQRController(p, K=K), [0.0, 0.0, 0.05, 0.0], 4.0, p,
                                  dt=Ts / 10, Ts=Ts)))

    print(f"  连续闭环最快极点 = {np.min(eigs.real):.3f} rad/s -> 时间常数 tau = {tau_fast * 1e3:.1f} ms")
    print(f"  ZOH 离散闭环谱半径 = 1 的**临界采样周期 Ts_crit = {Ts_crit * 1e3:.2f} ms**"
          f"（≈ {Ts_crit / tau_fast:.2f} tau）")
    print(f"  默认 Ts = {pdl.TS_DEFAULT * 1e3:g} ms 时谱半径 = {rho(pdl.TS_DEFAULT):.4f} < 1，"
          f"安全裕度约 {Ts_crit / pdl.TS_DEFAULT:.1f} 倍")
    rows = [[f"{t * 1e3:.1f}", f"{rho(t):.4f}", f"{rr:.2e}",
             L("稳定", "stable") if rho(t) < 1 else L("失稳/抖振", "unstable/chatter")]
            for t, rr in zip(Tss[::5], rms[::5])]
    _print_table(L("采样周期扫描", "sampling period sweep"), rows,
                 [L("Ts (ms)", "Ts (ms)"), L("谱半径 rho", "spectral radius"),
                  L("末段 theta RMS (rad)", "tail theta RMS"), L("判定", "verdict")])
    print("  注意：实物/本仿真里超过临界 Ts 后**不会真的发散到无穷**，")
    print("        因为控制力有 ±10 N 饱和，最终表现为持续的极限环抖振（实物上就是嗡嗡抖）。")

    fig = plt.figure(figsize=(11, 8))
    fig.suptitle(L("demo: 采样周期 Ts 对 ZOH 实现的 LQR 稳定性的影响",
                   "demo: effect of sampling period Ts on ZOH-implemented LQR"))
    gs = fig.add_gridspec(2, 2, hspace=0.35, wspace=0.28)

    ax = fig.add_subplot(gs[0, 0])
    ax.semilogy(Tss * 1e3, rhos, "o-", ms=3.5)
    ax.axhline(1.0, color="tab:red", ls="--", lw=1.0, label=L("|z| = 1 稳定边界", "|z| = 1"))
    ax.axvline(Ts_crit * 1e3, color="tab:red", lw=1.0, ls=":")
    ax.annotate(L(f"Ts_crit = {Ts_crit * 1e3:.1f} ms", f"Ts_crit = {Ts_crit * 1e3:.1f} ms"),
                xy=(Ts_crit * 1e3, 1.0), xytext=(-95, 30), textcoords="offset points",
                fontsize=9, color="tab:red",
                arrowprops=dict(arrowstyle="->", color="tab:red"))
    ax.set_xlabel(L("采样周期 Ts (ms)", "Ts (ms)"))
    ax.set_ylabel(L("离散闭环谱半径", "spectral radius"))
    ax.set_title(L("理论判据：rho(Ad - Bd·K)", "theory: rho(Ad - Bd K)"))
    ax.legend()

    ax = fig.add_subplot(gs[0, 1])
    ax.semilogy(Tss * 1e3, np.maximum(rms, 1e-8), "s-", ms=3.5, color="tab:purple")
    ax.axvline(Ts_crit * 1e3, color="tab:red", lw=1.0, ls=":",
               label=L("理论临界 Ts", "theoretical Ts_crit"))
    ax.set_xlabel(L("采样周期 Ts (ms)", "Ts (ms)"))
    ax.set_ylabel(L("末段 theta 的 RMS (rad)", "tail RMS of theta (rad)"))
    ax.set_title(L("仿真实测：末段残余抖动突然跳升 600 倍",
                   "simulation: tail jitter jumps by ~600x"))
    ax.legend()

    ax = fig.add_subplot(gs[1, :])
    for Ts, r in runs:
        ax.plot(r["t"], np.rad2deg(r["theta"]), lw=1.1,
                label=f"Ts = {Ts * 1e3:.1f} ms  (rho = {rho(Ts):.3f})")
    _hline(ax, 0)
    ax.set_xlabel(L("时间 t (s)", "time t (s)")); ax.set_ylabel(L("theta (度)", "theta (deg)"))
    ax.set_title(L("同一初值 theta0 = 0.05 rad 下的时域响应",
                   "time response from the same theta0 = 0.05 rad"))
    ax.legend()
    fig.subplots_adjust(top=0.91, bottom=0.08, left=0.08, right=0.97)
    return _finish(fig, "sampling", args)


# ===========================================================================
# demo 8: 模型失配鲁棒性
# ===========================================================================
def demo_robust(args):
    """教学要点：控制器按标称参数设计，真实系统的摆长/质量却不一样。
    LQR 用了 4 个状态的全部信息，增益裕度大；单看角度的 PID 更早失效。"""
    p = PendulumParams()                      # 标称（设计用）
    A, B = linearize(p)
    K, P, eigs = lqr(A, B, DEFAULT_Q, DEFAULT_R)
    factors = np.linspace(0.4, 3.0, 27)       # 真实摆长与摆杆质量的倍数
    dist = [{"type": "impulse", "t": 1.0, "force": 0.3}]

    def run(kind, f):
        p_true = p.replace(L=p.L * f, m=p.m * f)
        ctrl = CascadePID(p) if kind == "pid" else LQRController(p, K=K)
        r = simulate(ctrl, [0.0, 0.0, 0.05, 0.0], 10.0, p, Ts=args.Ts,
                     disturbances=dist, p_true=p_true, Q=DEFAULT_Q, R=DEFAULT_R)
        tail = r["theta"][int(0.7 * len(r["t"])):]
        ok = (not r["diverged"]) and float(np.max(np.abs(tail))) < math.radians(1.0)
        return r, ok, float(np.max(np.abs(wrap_pi(r["theta"]))))

    curves = {}
    for kind, label in (("pid", L("串级 PID", "cascade PID")), ("lqr", "LQR")):
        maxth, okv = [], []
        for f in factors:
            _, ok, mx = run(kind, f)
            maxth.append(np.rad2deg(mx))
            okv.append(ok)
        curves[label] = (np.array(maxth), np.array(okv))

    rows = []
    for label, (mx, ok) in curves.items():
        good = factors[ok]
        rows.append([label,
                     f"{good.min():.2f}" if good.size else "-",
                     f"{good.max():.2f}" if good.size else "-",
                     f"{int(ok.sum())}/{len(factors)}"])
    _print_table(L("失配鲁棒性（同时缩放真实摆长 L 与摆杆质量 m）",
                   "robustness to mismatch (true L and m scaled together)"),
                 rows, [L("控制器", "controller"), L("可稳定倍数下限", "min factor"),
                        L("可稳定倍数上限", "max factor"), L("成功数", "success")])
    f_demo = 1.9
    print(f"\n  下图左侧取失配倍数 = {f_demo}（真实 L = {p.L * f_demo:.2f} m, "
          f"m = {p.m * f_demo:.2f} kg，而控制器仍按 L = {p.L} m, m = {p.m} kg 设计）")
    print("  教学要点：LQR 的失配容限更宽；PID 只看角度，模型一变，"
          "内外环的时标分离假设最先被破坏。")

    fig, axes = plt.subplots(2, 2, figsize=(11, 7.5))
    fig.suptitle(L("demo: 模型失配下的鲁棒性对比（控制器按标称参数设计）",
                   "demo: robustness under model mismatch (controllers designed on nominal)"))
    r_pid, ok_pid, _ = run("pid", f_demo)
    r_lqr, ok_lqr, _ = run("lqr", f_demo)
    ax = axes[0, 0]
    ok_tag = {True: L("（稳住）", " (ok)"), False: L("（失稳）", " (fail)")}
    ax.plot(r_pid["t"], np.rad2deg(wrap_pi(r_pid["theta"])), color="tab:orange",
            label=L("串级 PID", "cascade PID") + ok_tag[ok_pid])
    ax.plot(r_lqr["t"], np.rad2deg(wrap_pi(r_lqr["theta"])), color="tab:blue",
            label="LQR" + ok_tag[ok_lqr])
    _hline(ax, 0)
    ax.set_title(L(f"失配倍数 {f_demo}× 时的摆角", f"angle at mismatch factor {f_demo}x"))
    ax.set_xlabel(L("t (s)", "t (s)")); ax.set_ylabel(L("theta (度)", "theta (deg)"))
    ax.legend()

    ax = axes[0, 1]
    ax.plot(r_pid["t"], r_pid["x"], color="tab:orange", label=L("串级 PID", "cascade PID"))
    ax.plot(r_lqr["t"], r_lqr["x"], color="tab:blue", label="LQR")
    _hline(ax, 0)
    ax.set_title(L(f"失配倍数 {f_demo}× 时的小车位置",
                   f"cart position at mismatch {f_demo}x"))
    ax.set_xlabel(L("t (s)", "t (s)")); ax.set_ylabel(L("x (m)", "x (m)")); ax.legend()

    ax = axes[1, 0]
    for (label, (mx, ok)), col in zip(curves.items(), ("tab:orange", "tab:blue")):
        ax.semilogy(factors, np.maximum(mx, 1e-3), "o-", ms=4, color=col, label=label)
        bad = ~ok
        if bad.any():
            ax.semilogy(factors[bad], np.maximum(mx[bad], 1e-3), "x", ms=9, color=col)
    ax.axvline(1.0, color="0.4", ls="--", lw=1.0, label=L("标称", "nominal"))
    ax.set_xlabel(L("真实 L、m 相对设计值的倍数", "true L, m / design value"))
    ax.set_ylabel(L("最大角偏 (度)", "max|theta| (deg)"))
    ax.set_title(L("× 表示未能稳住（末段 |theta| > 1°）",
                   "x marks failure (tail |theta| > 1 deg)"))
    ax.legend()

    ax = axes[1, 1]
    ax.axis("off")
    txt = [L("失配倍数下的稳定性（o = 稳住 / x = 失稳）:",
             "stability vs mismatch factor (o = ok / x = fail):"), ""]
    for label, (mx, ok) in curves.items():
        txt.append(f"{label}:")
        txt.append("  " + " ".join(("o" if o else "x") for o in ok))
    txt.append("")
    txt.append(L("倍数刻度: " + " ".join(f"{f:.1f}" for f in factors[::6]),
                 "factors: " + " ".join(f"{f:.1f}" for f in factors[::6])))
    txt.append("")
    txt.append(L("失配容限区间:", "stabilizable range:"))
    for row in rows:
        txt.append(f"  {row[0]}: {row[1]} ~ {row[2]}  ({row[3]})")
    ax.text(0.0, 1.0, "\n".join(txt), va="top", ha="left", fontsize=9, family="monospace")
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    return _finish(fig, "robust", args)


# ===========================================================================
# demo 9: 动画
# ===========================================================================
def demo_animate(args):
    """matplotlib FuncAnimation 实时动画：小车 + 摆杆。
    --mode pid|cascade|lqr|swingup 选择控制器。"""
    from matplotlib.patches import Rectangle

    p = PendulumParams()
    A, B = linearize(p)
    K, P, eigs = lqr(A, B, DEFAULT_Q, DEFAULT_R)
    mode = args.mode
    if mode == "pid":
        ctrl, s0, t_end = PID(p), [0.0, 0.0, 0.10, 0.0], args.t_end or 12.0
        dist = [{"type": "impulse", "t": 4.0, "force": 0.4}]
    elif mode == "cascade":
        ctrl, s0, t_end = CascadePID(p), [0.0, 0.0, 0.10, 0.0], args.t_end or 12.0
        dist = [{"type": "impulse", "t": 4.0, "force": 0.4}]
    elif mode == "lqr":
        ctrl, s0, t_end = LQRController(p, K=K), [0.0, 0.0, 0.15, 0.0], args.t_end or 10.0
        dist = [{"type": "impulse", "t": 4.0, "force": 0.5}]
    elif mode == "swingup":
        ctrl, s0, t_end = SwingUpController(p), [0.0, 0.0, math.pi, 0.0], args.t_end or 10.0
        dist = None
    else:
        raise SystemExit(f"未知 --mode {mode}（可选 pid|cascade|lqr|swingup）")

    ref = (make_reference("square", amp=0.3, t0=3.0, period=6.0)
           if mode == "cascade" else None)
    r = simulate(ctrl, s0, t_end, p, Ts=args.Ts, ref=ref, disturbances=dist,
                 Q=DEFAULT_Q, R=DEFAULT_R)

    fps = 40
    stride = max(1, int(round((1.0 / fps) / r["dt"])))
    frames = list(range(0, len(r["t"]), stride))
    xmin = min(-0.6, float(np.min(r["x"])) - 0.4)
    xmax = max(0.6, float(np.max(r["x"])) + 0.4)

    fig, (axa, axb) = plt.subplots(2, 1, figsize=(9, 7.5),
                                   gridspec_kw={"height_ratios": [1.35, 1]})
    fig.suptitle(L(f"动画: {mode}（小车-倒立摆）", f"animation: {mode} (cart-pole)"))
    axa.set_xlim(xmin, xmax)
    axa.set_ylim(-p.L * 1.35, p.L * 1.35)
    axa.set_aspect("equal")
    axa.axhline(0, color="0.5", lw=1.0)
    axa.set_xlabel(L("x (m)", "x (m)"))
    cart_w, cart_h = 0.24, 0.12
    cart = Rectangle((-cart_w / 2, -cart_h / 2), cart_w, cart_h,
                     fc="tab:blue", ec="k", alpha=0.85, zorder=3)
    axa.add_patch(cart)
    rod, = axa.plot([], [], lw=5, color="tab:red", solid_capstyle="round", zorder=4)
    bob, = axa.plot([], [], "o", ms=9, color="darkred", zorder=5)
    trail, = axa.plot([], [], lw=0.8, color="tab:orange", alpha=0.6, zorder=2)
    arrow = axa.annotate("", xy=(0, 0), xytext=(0, 0),
                         arrowprops=dict(arrowstyle="-|>", color="tab:green", lw=2))
    hud = axa.text(0.02, 0.95, "", transform=axa.transAxes, va="top", fontsize=9,
                   family="monospace",
                   bbox=dict(fc="white", ec="0.7", alpha=0.85))

    axb.plot(r["t"], np.rad2deg(wrap_pi(r["theta"])), lw=1.0, color="tab:blue",
             label=L("theta (度)", "theta (deg)"))
    axb.plot(r["t"], r["x"] * 100, lw=1.0, color="tab:red", label=L("x (cm)", "x (cm)"))
    axb.step(r["t"], r["u"], where="post", lw=0.8, color="tab:green", alpha=0.6,
             label=L("u (N)", "u (N)"))
    axb.set_xlabel(L("时间 t (s)", "time t (s)")); axb.legend(loc="upper right", ncol=3)
    cursor = axb.axvline(0.0, color="k", lw=1.0)

    def update(i):
        x = r["x"][i]
        th = r["theta"][i]
        # 杆端点按 (x + L*sin(theta), L*cos(theta)) 画，与运动方程的符号约定自洽
        tipx, tipy = x + p.L * math.sin(th), p.L * math.cos(th)
        cart.set_xy((x - cart_w / 2, -cart_h / 2))
        rod.set_data([x, tipx], [0.0, tipy])
        bob.set_data([tipx], [tipy])
        j0 = max(0, i - 400)
        trail.set_data(r["x"][j0:i + 1] + p.L * np.sin(r["theta"][j0:i + 1]),
                       p.L * np.cos(r["theta"][j0:i + 1]))
        u = r["u"][i]
        arrow.set_position((x, -cart_h))
        arrow.xy = (x + 0.06 * u, -cart_h)
        mode_txt = ""
        if hasattr(ctrl, "mode_log") and ctrl.mode_log:
            k = min(int(r["t"][i] / r["Ts"]), len(ctrl.mode_log) - 1)
            mode_txt = f"\nmode = {ctrl.mode_log[k][1]}"
        hud.set_text(f"t = {r['t'][i]:6.2f} s\nx = {x:+.3f} m\n"
                     f"theta = {np.rad2deg(wrap_pi(th)):+7.2f}°\nu = {u:+6.2f} N{mode_txt}")
        cursor.set_xdata([r["t"][i], r["t"][i]])
        return cart, rod, bob, trail, hud, cursor

    fig.tight_layout(rect=(0, 0, 1, 0.96))

    out = None
    if args.gif:
        try:
            from matplotlib.animation import FuncAnimation, PillowWriter
            ani = FuncAnimation(fig, update, frames=frames, interval=1000 / fps, blit=False)
            os.makedirs(FIGDIR, exist_ok=True)
            out = os.path.join(FIGDIR, f"animate_{mode}.gif")
            ani.save(out, writer=PillowWriter(fps=fps))
            print(f"  [动画] 已保存 GIF: {out}")
        except Exception as exc:                       # pragma: no cover
            print(f"  [动画] GIF 保存失败（{exc}），退回静态图")
            args.gif = False
    if args.show:
        from matplotlib.animation import FuncAnimation
        ani = FuncAnimation(fig, update, frames=frames, interval=1000 / fps, blit=False)
        globals()["_keep_ani"] = ani        # 防止被 GC 掉
        plt.show()
    elif not args.gif:
        # 无头校验：手工走完所有帧，确认代码路径不报错，再存最后一帧
        for i in frames:
            update(i)
        fig.canvas.draw()
        update(frames[len(frames) // 2])
        out = _finish(fig, f"animate_{mode}", args)
        print(f"  [动画] 无头模式：已逐帧执行 {len(frames)} 帧，无异常")
    if not args.show:
        plt.close(fig)
    return out


# ===========================================================================
# 命令行
# ===========================================================================
DEMOS = {
    "pid": (demo_pid, "单环 PID：角度稳住但小车漂走"),
    "cascade": (demo_cascade, "串级 PID：角度与位置同时稳住"),
    "lqr": (demo_lqr, "LQR 响应 + 打印 K / 闭环极点 / P"),
    "compare": (demo_compare, "串级 PID vs LQR 定量对比"),
    "qr-sweep": (demo_qr_sweep, "Q/R 权重扫描：极点轨迹与权衡曲线"),
    "swingup": (demo_swingup, "能量法摆起 + LQR 接住"),
    "sampling": (demo_sampling, "采样周期扫描：ZOH 下的失稳临界值"),
    "robust": (demo_robust, "模型失配鲁棒性对比"),
    "animate": (demo_animate, "小车+摆杆实时动画"),
}
NO_ANIM = [k for k in DEMOS if k != "animate"]


def build_parser():
    ap = argparse.ArgumentParser(
        description="小车-倒立摆教学演示（Python 参考实现）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="可选 demo:\n" + "\n".join(f"  {k:<10s} {v[1]}" for k, v in DEMOS.items()))
    ap.add_argument("--demo", default="lqr",
                    help="demo 名称，或 all（跑所有非动画 demo）")
    ap.add_argument("--list", action="store_true", help="列出所有 demo 后退出")
    ap.add_argument("--save", action="store_true", help="保存 PNG 到 python/figures/")
    ap.add_argument("--show", action="store_true",
                    help="弹窗显示（默认：--save 时不弹窗，不加 --save 时弹窗）")
    ap.add_argument("--no-show", dest="no_show", action="store_true", help="强制不弹窗")
    ap.add_argument("--gif", action="store_true", help="animate demo 保存为 GIF（需 Pillow）")
    ap.add_argument("--mode", default="lqr", choices=["pid", "cascade", "lqr", "swingup"],
                    help="animate demo 用哪个控制器")
    ap.add_argument("--Ts", type=float, default=pdl.TS_DEFAULT, help="控制采样周期 (s)")
    ap.add_argument("--t-end", dest="t_end", type=float, default=None,
                    help="animate demo 的仿真时长 (s)")
    ap.add_argument("--dpi", type=int, default=120, help="保存 PNG 的 dpi")
    return ap


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    if args.list:
        print("可选 demo:")
        for k, (_, d) in DEMOS.items():
            print(f"  {k:<10s} {d}")
        return 0
    # 显示策略：--no-show 最高优先；其次显式 --show；否则"存图就不弹窗"
    if args.no_show:
        args.show = False
    elif not args.show:
        args.show = not args.save
    _setup_matplotlib(args.save, args.show)
    if args.show and mpl.get_backend().lower() == "agg":
        # 无 GUI 环境（例如纯服务器）：Agg 后端 show() 只会警告且什么也不显示
        print("  [提示] 当前环境没有可交互的 matplotlib 后端，已自动改为只保存图片。")
        args.show = False
        args.save = True
    if not CN:
        print("  [提示] 未找到中文字体（Microsoft YaHei / SimHei 等），图上标签改用英文。")

    names = NO_ANIM if args.demo == "all" else [args.demo]
    for name in names:
        if name not in DEMOS:
            print(f"未知 demo: {name}\n可选: {', '.join(DEMOS)} 或 all")
            return 2
    for name in names:
        fn, desc = DEMOS[name]
        print("=" * 78)
        print(f"demo: {name}  —— {desc}")
        print("=" * 78)
        fn(args)
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
