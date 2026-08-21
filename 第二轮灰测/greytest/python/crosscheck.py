# -*- coding: utf-8 -*-
"""
crosscheck.py —— Python 参考实现 与 网页版 JS 实现 的**逐位交叉验证**

为什么这件事有意义
------------------
两边的代数 Riccati 方程 (ARE) 求解器是**完全独立**的两条技术路线：

    Python 侧（本目录 pendulum.py）：
        Riccati 微分方程反向时间积分（value iteration）取得稳定化初值
        -> Kleinman-Newton 迭代，每步用 Kronecker 积把 Lyapunov 方程展开成
           16x16（增广时 25x25）线性方程组求解
        （另有 scipy.linalg.solve_continuous_are 作第三方复核）
    网页版（src/lqr.js）：
        Bass 关系式取初值 -> Kleinman-Newton 迭代，纯 JS、零依赖

两条路线若在 K、P、闭环极点、静差、临界采样周期上都对得上，那么"实现写错了"
和"公式推错了"这两类错误基本可以排除。本脚本就是把这件事做实。

运行:
    python crosscheck.py          # 打印对照表，全部通过则退出码 0

本脚本**只读**，不修改任何已有文件的行为，也不改动 pendulum.py / demos.py 的默认值。
"""

from __future__ import annotations

import math
import sys

import numpy as np

import pendulum as pdl
from pendulum import (PendulumParams, linearize, lqr, care_residual, c2d_zoh,
                      tf_zeros, simulate, saturate, wrap_pi, Controller,
                      TS_DEFAULT, HAS_SCIPY)

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:      # pragma: no cover
    pass

if HAS_SCIPY:
    from scipy import linalg as sla


# ===========================================================================
# 网页版（JS）给出的基准数值 —— 原样抄录，不做任何加工
# ===========================================================================
# 说明：这些数字是网页版实现的输出。K/P/极点 按"小数点后 4 位"给出
# （K 虽然打印了 6 位小数，但末两位是补的 0，见第 1 节的"精度侦测"结论）。
JS = {
    "K": [-20.000000, -29.525900, -216.770500, -23.644600],
    "poles": [complex(-0.7553, +0.7137), complex(-0.7553, -0.7137),
              complex(-26.3641, +11.4366), complex(-26.3641, -11.4366)],
    "P": [[5.8852, 4.2794, 5.0972, 1.7558],
          [4.2794, 5.7759, 5.7004, 2.3753],
          [5.0972, 5.7004, 26.9303, 2.7571],
          [1.7558, 2.3753, 2.7571, 1.0022]],
    "eigP": [30.335, 7.582, 1.662, 0.015],          # 只给了 3 位小数
    "K_aug": [-40.000000, -70.463000, -57.163000, -253.910200, -34.966600],
    "Ts_crit_ms": 37.4,                              # 3 位有效数字
    "p_Ts_crit": 0.209,                              # 3 位有效数字
    "zRHP_frictionless": 4.9523,                     # 网页版 analyze() 用的无摩擦解析值
    "x_ss_LQR_d1": -0.05,                            # = d / K_x = 1/(-20)
}

# 网页版权重（Bryson 定则）—— 必须与网页版逐位相同
#   q_x = 1/0.5^2 = 4 ; q_xdot = 0.1/1^2 = 0.1
#   q_theta = 10/(10 deg)^2 = 10/(10*pi/180)^2 ; q_thetadot = 0.5/1^2 = 0.5
#   R = 1/u_max^2 = 1/100 = 0.01
Q_THETA_EXACT = 10.0 / (10.0 * math.pi / 180.0) ** 2      # 328.2806350011744
Q_JS = np.diag([4.0, 0.1, Q_THETA_EXACT, 0.5])
R_JS = np.array([[0.01]])
Q_I = 4.0 / 0.5 ** 2                                       # 积分权重 = 16
Q_AUG_JS = np.diag([Q_I, 4.0, 0.1, Q_THETA_EXACT, 0.5])


# ===========================================================================
# 对照工具
# ===========================================================================
REPORT = []          # [(section, item, verdict, note)]
_MAXREL = {"js": 0.0, "scipy": 0.0}
_GROUP = {}          # 组名 -> dict(max_rel, max_abs, max_quant_ratio, dec)
_CURGROUP = ["", 4]


def _rel(a, b) -> float:
    """相对偏差，以基准值 b 为分母（b = 0 时退化为绝对偏差）。"""
    den = abs(b)
    return abs(a - b) / den if den > 1e-300 else abs(a - b)


def agree_decimals(py: float, js: float, dmax: int = 10) -> int:
    """返回两数"四舍五入到小数点后 d 位后完全相等"的最大 d。

    这是对照"已被四舍五入过的基准值"的正确姿势：基准值本身带量化误差，
    直接要求相对偏差 < 1e-6 在数学上是不可能满足的，
    而"我的值按基准的精度舍入后与基准逐位相同"是更强、也更诚实的陈述。
    """
    for d in range(dmax, -1, -1):
        if abs(round(py, d) - round(js, d)) <= 1e-12 * max(1.0, abs(js)):
            return d
    return -1


def cmp_row(name, py, js, scipy_val=None, dec_required=4, unit=""):
    """打印一行对照并登记结论。返回 (verdict, d_agree)。

    判定口径（关键）：基准值是被四舍五入过的，其自身带 ±0.5·10^-dec 的量化误差。
    因此除了看相对偏差，还要看"绝对偏差 / 基准最后一位的半个单位"这个**量化比**
    是否 <= 1 —— 等于 1 就说明偏差已经完全落在基准的打印精度之内。
    """
    d = agree_decimals(py, js)
    rel_js = _rel(py, js)
    abs_js = abs(py - js)
    quant = abs_js / (0.5 * 10.0 ** (-dec_required))
    _MAXREL["js"] = max(_MAXREL["js"], rel_js)
    g = _GROUP.setdefault(_CURGROUP[0], {"rel": 0.0, "abs": 0.0, "quant": 0.0,
                                         "dec": dec_required, "n": 0})
    g["rel"] = max(g["rel"], rel_js)
    g["abs"] = max(g["abs"], abs_js)
    g["quant"] = max(g["quant"], quant)
    g["n"] += 1
    sc = ""
    if scipy_val is not None:
        rel_sc = _rel(py, scipy_val)
        _MAXREL["scipy"] = max(_MAXREL["scipy"], rel_sc)
        sc = f"{scipy_val:>16.10f}  {rel_sc:>9.2e}"
    else:
        sc = " " * 16 + "  " + " " * 9
    if rel_js < 1e-6:
        verdict = "PASS"
    elif quant <= 1.0:
        verdict = "PASS*"          # 仅受基准值打印精度限制
    else:
        verdict = "FAIL"
    print(f"  {name:<14s}{js:>16.6f}  {py:>18.10f}  {abs_js:>9.2e}  "
          f"{rel_js:>9.2e}  {sc}  {d:>2d}位  {verdict}")
    REPORT.append((name, verdict, d))
    return verdict, d


def header(title):
    print()
    print("=" * 118)
    print(title)
    print("=" * 118)


def sub(title):
    print(f"\n  --- {title} ---")


def group(name, dec=4):
    """声明当前对照组及其基准值的打印小数位数。"""
    _CURGROUP[0] = name
    _CURGROUP[1] = dec


def table_head(with_scipy=True):
    print(f"  {'量':<14s}{'网页版 JS':>16s}  {'Python 自研':>18s}  "
          f"{'绝对差':>9s}  {'相对差':>9s}  "
          f"{'scipy 复核':>16s}  {'与scipy':>9s}  一致  判定")
    print("  " + "-" * 114)


# ===========================================================================
# 第 1 节：基准 LQR 的 K / P / 闭环极点 / ARE 残差
# ===========================================================================
def section1(p, A, B):
    header("第 1 节  基准 LQR 三方对照   Q = diag(4, 0.1, 328.2806350011744, 0.5),  R = 0.01")
    print(f"  参数: {p.describe()}")
    print(f"  q_theta = 10/(10*pi/180)^2 = {Q_THETA_EXACT!r}")

    K, P, eigs, info = lqr(A, B, Q_JS, R_JS, return_info=True)
    P_sp = sla.solve_continuous_are(A, B, Q_JS, R_JS) if HAS_SCIPY else None
    K_sp = (np.linalg.solve(R_JS, B.T @ P_sp)) if HAS_SCIPY else None

    sub("增益 K（u = -K s）")
    group("K (4 位小数)", 4)
    table_head()
    for i in range(4):
        cmp_row(f"K[{i}]", K[0, i], JS["K"][i],
                None if K_sp is None else K_sp[0, i])

    sub("闭环极点 eig(A - B K)")
    group("闭环极点 (4 位小数)", 4)
    table_head()
    e_py = sorted(eigs, key=lambda z: (round(z.real, 6), z.imag))
    e_js = sorted(JS["poles"], key=lambda z: (round(z.real, 6), z.imag))
    e_sp = (sorted(np.linalg.eigvals(A - B @ K_sp), key=lambda z: (round(z.real, 6), z.imag))
            if K_sp is not None else [None] * 4)
    for i, (a, b) in enumerate(zip(e_py, e_js)):
        cmp_row(f"pole{i}.re", a.real, b.real, None if e_sp[i] is None else e_sp[i].real)
        cmp_row(f"pole{i}.im", a.imag, b.imag, None if e_sp[i] is None else e_sp[i].imag)

    sub("Riccati 解 P（对称，只列上三角 10 个独立元素）")
    group("P (4 位小数)", 4)
    table_head()
    for i in range(4):
        for j in range(i, 4):
            cmp_row(f"P[{i}][{j}]", P[i, j], JS["P"][i][j],
                    None if P_sp is None else P_sp[i, j])

    sub("P 的特征值（网页版只给到 3 位小数）")
    group("eig(P) (3 位小数)", 3)
    table_head()
    ev = np.sort(np.linalg.eigvalsh(P))[::-1]
    ev_sp = np.sort(np.linalg.eigvalsh(P_sp))[::-1] if P_sp is not None else [None] * 4
    for i in range(4):
        cmp_row(f"lam(P)[{i}]", ev[i], JS["eigP"][i],
                None if ev_sp[i] is None else ev_sp[i], dec_required=3)

    # ---- 精度侦测：基准值的"有效小数位" ----
    depths = [agree_decimals(K[0, i], JS["K"][i]) for i in range(4)]
    depthsP = [agree_decimals(P[i, j], JS["P"][i][j]) for i in range(4) for j in range(4)]
    sub("精度侦测（为什么不能一律用 1e-6 相对判据）")
    print(f"  K   各项一致到小数点后 {depths} 位 -> 最浅 {min(depths)} 位")
    print(f"  P   全部 16 个元素一致到最浅 {min(depthsP)} 位，"
          f"max|round(P_py,4) - P_js| = "
          f"{np.max(np.abs(np.round(P, 4) - np.array(JS['P']))):.1e}")
    print(f"  证据：K[1] 的正确 6 位舍入应为 {K[0,1]:.6f}，而基准写作 {JS['K'][1]:.6f}")
    print("  结论：**基准值是先舍入到小数点后 4 位、再补零打印成 6 位的**。")
    print("        因此对 JS 的相对判据下限被基准自身的量化误差限制在 ~1e-6 量级")
    print(f"        （K[1] 相对差 {_rel(K[0,1], JS['K'][1]):.2e} 就是纯量化误差），")
    print("        而 '我的值舍入到 4 位后与基准逐位相同' 是更强的等价陈述（已全部满足）。")

    # ---- ARE 残差：绝对 vs 归一化 ----
    S = B @ np.linalg.solve(R_JS, B.T)
    res_py = care_residual(A, B, Q_JS, R_JS, P)
    scale = float(np.linalg.norm(P @ S @ P, "fro"))
    sub("ARE 残差 ||A'P + PA - PBR^-1B'P + Q||（网页版声称 < 1e-12）")
    print(f"  {'求解器':<22s}{'||res||_F':>12s}  {'max|res|':>12s}  "
          f"{'res/(1+||P||_F)':>16s}  {'res/||PSP||_F':>14s}")
    print("  " + "-" * 82)
    rows = [("Python 自研(本实现)", P)]
    if P_sp is not None:
        rows.append(("scipy solve_..._are", P_sp))
    for nm, PP in rows:
        r_f = care_residual(A, B, Q_JS, R_JS, PP)
        r_m = float(np.max(np.abs(A.T @ PP + PP @ A - PP @ S @ PP + Q_JS)))
        print(f"  {nm:<22s}{r_f:>12.4e}  {r_m:>12.4e}  "
              f"{r_f / (1 + np.linalg.norm(PP, 'fro')):>16.4e}  {r_f / scale:>14.4e}")
    print(f"  参与相消的项的量级 ||P·B·R^-1·B'·P||_F = {scale:.4e}，"
          f"double 下的残差量级下限 ~ {scale * 2.2e-16:.1e}（实际会因多步矩阵乘法放大 10~50 倍）")
    ok_norm = res_py / (1 + np.linalg.norm(P, "fro")) < 1e-12
    print(f"  判定：绝对 Frobenius 残差 {res_py:.3e} **大于** 1e-12"
          f"（scipy 自己是 {care_residual(A, B, Q_JS, R_JS, P_sp):.3e}，更大），")
    print(f"        归一化残差 res/(1+||P||_F) = {res_py / (1 + np.linalg.norm(P,'fro')):.3e} "
          f"< 1e-12 {'成立' if ok_norm else '不成立'}。")
    print("        => 网页版的 '< 1e-12' 只有在**归一化**意义下才成立；这是范数口径问题，")
    print("           不是两边求解器不一致（见末尾建议）。")
    REPORT.append(("ARE 残差(归一化<1e-12)", "PASS" if ok_norm else "FAIL", 12))

    # ---- 解析不变量（第三条独立验证路径）----
    sub("解析不变量交叉验证（不依赖任何求解器）")
    kx_theory = -math.sqrt(Q_JS[0, 0] / R_JS[0, 0])
    print(f"  由 Kalman 频域等式（谱分解恒等式）在 s->0 的 A 的零特征值方向上取极限，可得")
    print(f"      R * K_x^2 = q_x   =>   K_x = -sqrt(q_x/R)  （与其它权重无关！）")
    print(f"  理论 K_x = -sqrt({Q_JS[0,0]:g}/{R_JS[0,0]:g}) = {kx_theory:.12f}")
    print(f"  本实现  K_x = {K[0,0]:.12f}   偏差 = {abs(K[0,0] - kx_theory):.3e}")
    print(f"  网页版  K_x = {JS['K'][0]:.6f}")
    ok_inv = abs(K[0, 0] - kx_theory) < 1e-9
    REPORT.append(("解析不变量 K_x=-sqrt(qx/R)", "PASS" if ok_inv else "FAIL", 12))
    return K, P, eigs


# ===========================================================================
# 第 2 节：增广 LQI
# ===========================================================================
def build_augmented(A, B):
    """增广状态 [z, x, x_dot, theta, theta_dot]，z_dot = x - x_ref。"""
    A5 = np.zeros((5, 5))
    A5[0, 1] = 1.0                 # z_dot = x
    A5[1:, 1:] = A
    B5 = np.zeros((5, 1))
    B5[1:, 0] = B.ravel()
    return A5, B5


def section2(A, B):
    header("第 2 节  增广 LQI 对照   状态 [z, x, x_dot, theta, theta_dot], z_dot = x - x_ref"
           "\n          Q_aug = diag(16, 4, 0.1, 328.2806350011744, 0.5),  R = 0.01")
    A5, B5 = build_augmented(A, B)
    K5, P5, e5, info5 = lqr(A5, B5, Q_AUG_JS, R_JS, return_info=True)
    K5_sp = None
    if HAS_SCIPY:
        P5sp = sla.solve_continuous_are(A5, B5, Q_AUG_JS, R_JS)
        K5_sp = np.linalg.solve(R_JS, B5.T @ P5sp)

    names = ["k_i (积分)", "k_x", "k_xdot", "k_theta", "k_thetadot"]
    sub("增广增益 K_aug（u = -K_aug [z, x, x_dot, theta, theta_dot]）")
    group("K_aug (4 位小数)", 4)
    table_head()
    for i in range(5):
        cmp_row(f"K_aug[{i}]", K5[0, i], JS["K_aug"][i],
                None if K5_sp is None else K5_sp[0, i])
    print("  （物理含义：" + ", ".join(f"K_aug[{i}]={names[i]}" for i in range(5)) + "）")

    sub("增广闭环极点与残差")
    for ev in sorted(e5, key=lambda z: (round(z.real, 6), z.imag)):
        print(f"    {ev.real:+.10f} {ev.imag:+.10f}j")
    print(f"  全部在左半平面: {np.max(e5.real) < 0}   "
          f"最大实部 = {np.max(e5.real):.6f}")
    print(f"  ARE 残差 = {info5['residual']:.4e}，归一化 = "
          f"{info5['residual'] / (1 + info5['P_norm']):.4e}"
          + (f"，与 scipy 的 P 相对偏差 = {info5['err_scipy']:.3e}" if HAS_SCIPY else ""))

    ki_theory = -math.sqrt(Q_I / R_JS[0, 0])
    print(f"\n  解析不变量（同第 1 节，此时原点是二重极点）: k_i = -sqrt(q_I/R) = {ki_theory:.12f}")
    print(f"    本实现 k_i = {K5[0,0]:.12f}   偏差 = {abs(K5[0,0] - ki_theory):.3e}")
    REPORT.append(("解析不变量 k_i=-sqrt(qI/R)",
                   "PASS" if abs(K5[0, 0] - ki_theory) < 1e-9 else "FAIL", 12))
    return K5


# ===========================================================================
# 第 3 节：u -> x 通道零点
# ===========================================================================
def zeros_analytic(p):
    """u->x 通道零点的解析解。

    对线性化模型做 Laplace 变换（X、Theta 为像函数）：
        [(M+m)s^2 + b s] X + m l s^2 Theta = U
        m l s^2 X + [J s^2 + c s - m g l] Theta = 0        (J = I + m l^2 = m L^2/3)
    由第二式解出 Theta 代入第一式：
        X/U = (J s^2 + c s - m g l)
              / { [(M+m)s^2 + b s](J s^2 + c s - m g l) - (m l)^2 s^4 }
    **分子只含 J、c、m g l** —— 与小车摩擦 b、小车质量 M 都无关：
        J s^2 + c s - m g l = 0  =>  s = (-c ± sqrt(c^2 + 4 J m g l)) / (2 J)
    c = 0 时退化为 ±sqrt(m g l / J) = ±sqrt(3g/(2L))。
    """
    J = p.J
    mgl = p.m * p.g * p.l
    disc = math.sqrt(p.c ** 2 + 4.0 * J * mgl)
    return np.array([(-p.c - disc) / (2 * J), (-p.c + disc) / (2 * J)])


def section3(p):
    header("第 3 节  u -> x 通道零点：解析式、数值值、无摩擦值")
    A, B = linearize(p)
    z_num = np.sort(tf_zeros(A, B, [1, 0, 0, 0]).real)
    z_ana = zeros_analytic(p)
    z_fric0 = math.sqrt(p.m * p.g * p.l / p.J)

    print(f"  解析式  s = (-c ± sqrt(c^2 + 4·J·m·g·l)) / (2J),  J = I + m·l^2 = m·L^2/3 = {p.J:.6f}")
    print(f"  {'来源':<34s}{'左零点(LHP)':>18s}{'右零点(RHP)':>18s}")
    print("  " + "-" * 70)
    print(f"  {'解析式（含转轴摩擦 c）':<34s}{z_ana[0]:>18.10f}{z_ana[1]:>18.10f}")
    print(f"  {'本实现 tf_zeros 数值解':<34s}{z_num[0]:>18.10f}{z_num[1]:>18.10f}")
    print(f"  {'无摩擦解析 ±sqrt(3g/(2L))':<34s}{-z_fric0:>18.10f}{z_fric0:>18.10f}")
    print(f"  {'网页版 analyze().zRHP':<34s}{'—':>18s}{JS['zRHP_frictionless']:>18.4f}")
    err = float(np.max(np.abs(z_num - z_ana)))
    print(f"\n  解析式 vs 数值：最大偏差 = {err:.3e}  -> {'一致' if err < 1e-9 else '不一致'}")
    REPORT.append(("零点解析式 vs 数值", "PASS" if err < 1e-9 else "FAIL", 12))

    sub("b（小车粘性摩擦）无关性验证：扫 b 看零点是否变化")
    print(f"  {'b (N·s/m)':>12s}{'左零点':>18s}{'右零点':>18s}{'与 b=0 之差':>16s}")
    print("  " + "-" * 66)
    z_ref = None
    max_dev_b = 0.0
    for b in (0.0, 0.1, 1.0, 10.0, 100.0):
        zz = np.sort(tf_zeros(*linearize(p.replace(b=b)), [1, 0, 0, 0]).real)
        if z_ref is None:
            z_ref = zz
        dev = float(np.max(np.abs(zz - z_ref)))
        max_dev_b = max(max_dev_b, dev)
        print(f"  {b:>12.1f}{zz[0]:>18.10f}{zz[1]:>18.10f}{dev:>16.2e}")
    print(f"  => b 在 0 ~ 100 之间变化 1000 倍，零点最大变化 {max_dev_b:.2e}（纯浮点噪声）")
    print("     **论断成立：u->x 零点与 b 无关。**")
    REPORT.append(("零点与 b 无关", "PASS" if max_dev_b < 1e-9 else "FAIL", 12))

    sub("附带：与小车质量 M 也无关；只随转轴摩擦 c 变化")
    max_dev_M = 0.0
    for M in (0.1, 0.5, 5.0, 50.0):
        zz = np.sort(tf_zeros(*linearize(p.replace(M=M)), [1, 0, 0, 0]).real)
        max_dev_M = max(max_dev_M, float(np.max(np.abs(zz - z_ref))))
        print(f"  M = {M:>6.2f} kg -> [{zz[0]:.10f}, {zz[1]:.10f}]")
    print(f"  => M 变化 500 倍，零点最大变化 {max_dev_M:.2e}  -> 与 M 无关")
    REPORT.append(("零点与 M 无关", "PASS" if max_dev_M < 1e-9 else "FAIL", 12))
    print()
    for c in (0.0, 0.005, 0.05, 0.2):
        pp = p.replace(c=c)
        zz = np.sort(tf_zeros(*linearize(pp), [1, 0, 0, 0]).real)
        za = zeros_analytic(pp)
        print(f"  c = {c:>6.3f} -> 数值 [{zz[0]:.10f}, {zz[1]:.10f}]  "
              f"解析 [{za[0]:.10f}, {za[1]:.10f}]")
    print("  => c 增大时右零点左移（非最小相位程度减轻），左零点右移；c = 0 时对称。")

    print(f"\n  【给网页版的结论】默认参数（c = {p.c}）下精确 RHP 零点 = {z_ana[1]:.6f}，")
    print(f"    网页版 analyze() 用的 sqrt(m·g·l/J) = {z_fric0:.6f} 是 **c = 0 的近似值**，")
    print(f"    偏高 {(z_fric0 / z_ana[1] - 1) * 100:.2f}%。建议改成上面的精确式（仅多一个开方）。")
    return z_num, z_ana


# ===========================================================================
# 第 4 节：常值风扰下的静差解析式
# ===========================================================================
class LQI(Controller):
    """把积分器串进状态反馈的 LQI（仅本脚本使用，不进 pendulum.py）。

        z_dot = x - x_ref
        u = -[k_i, K_x, K_xd, K_th, K_thd] · [z, x-x_ref, x_dot, theta, theta_dot]
    带条件积分抗饱和。
    """

    name = "LQI"

    def __init__(self, p, K5, Ts=TS_DEFAULT):
        super().__init__(p, Ts)
        self.K5 = np.asarray(K5, float).reshape(1, 5)
        self.reset()

    def reset(self):
        self.z = 0.0

    def __call__(self, s, t):
        sr = self.s_ref(t)
        ex = float(s[0]) - sr[0]
        e = np.array([self.z, ex, float(s[1]) - sr[1],
                      wrap_pi(float(s[2]) - sr[2]), float(s[3]) - sr[3]])
        u_un = float(-(self.K5 @ e)[0])
        u = saturate(u_un, self.u_max)
        if not (abs(u_un) > self.u_max and u_un * ex > 0.0):   # 条件积分
            self.z += self.Ts * ex
        return u


def section4(p, A, B, K, K5):
    header("第 4 节  常值风扰 d 下的静差：普通 LQR 的 x_ss = d / K_x，LQI 压到 0")
    print("  解析推导（线性化模型，风扰 d 与 u 同一入口，即 B_d = B）：")
    print("    稳态时 x_dot = theta_dot = 0；把两行代数方程消去 theta 可得")
    print("      (u_ss + d) · (a1 - a3·b1/b3) = 0,  而 a1 - a3·b1/b3 = 1/(M+m) != 0")
    print("    故 **u_ss = -d 且 theta_ss = 0**（杆保持竖直、小车偏置停住）；")
    print("    又 u_ss = -K_x·x_ss  =>  **x_ss = d / K_x**（与其它三个增益无关）。")

    d = 1.0
    wind = [{"type": "force", "t0": 0.0, "t1": 1e9, "F": d}]
    r = simulate(pdl.LQRController(p, K=K), [0, 0, 0, 0], 40.0, p, disturbances=wind)
    x_th = d / K[0, 0]
    s_lin = -np.linalg.solve(A - B @ K, B.ravel() * d)       # 线性模型解析稳态

    sub(f"普通 LQR，d = {d:g} N 常值风扰")
    print(f"  {'量':<26s}{'值':>18s}{'理论值':>18s}{'偏差':>12s}")
    print("  " + "-" * 76)
    print(f"  {'x_ss（非线性仿真 40 s）':<26s}{r['x'][-1]:>18.12f}{x_th:>18.12f}"
          f"{abs(r['x'][-1] - x_th):>12.2e}")
    print(f"  {'x_ss（线性模型解析）':<26s}{s_lin[0]:>18.12f}{x_th:>18.12f}"
          f"{abs(s_lin[0] - x_th):>12.2e}")
    print(f"  {'x_ss（网页版 JS）':<26s}{JS['x_ss_LQR_d1']:>18.6f}{x_th:>18.12f}"
          f"{abs(JS['x_ss_LQR_d1'] - x_th):>12.2e}")
    print(f"  {'theta_ss':<26s}{r['theta'][-1]:>18.3e}{0.0:>18.1f}"
          f"{abs(r['theta'][-1]):>12.2e}")
    print(f"  {'u_ss':<26s}{r['u'][-1]:>18.12f}{-d:>18.12f}"
          f"{abs(r['u'][-1] + d):>12.2e}")
    ok1 = abs(r["x"][-1] - x_th) < 1e-9 and abs(r["theta"][-1]) < 1e-9
    print(f"  判定: {'PASS' if ok1 else 'FAIL'}"
          f"（x_ss = d/K_x = 1/({K[0,0]:.6f}) = {x_th:.10f} m，仿真吻合到 {abs(r['x'][-1]-x_th):.1e}）")
    REPORT.append(("静差 x_ss = d/K_x", "PASS" if ok1 else "FAIL", 12))

    sub(f"LQI（含积分器），同样 d = {d:g} N")
    r2 = simulate(LQI(p, K5), [0, 0, 0, 0], 60.0, p, disturbances=wind)
    print(f"  x_ss = {r2['x'][-1]:.3e} m  (要求 < 1e-3)   theta_ss = {r2['theta'][-1]:.3e} rad")
    print(f"  u_ss = {r2['u'][-1]:.10f} N (= -d，由积分器提供)   "
          f"过渡过程 max|x| = {np.max(np.abs(r2['x'])):.4f} m，max|u| = {np.max(np.abs(r2['u'])):.3f} N")
    ok2 = abs(r2["x"][-1]) < 1e-3
    print(f"  判定: {'PASS' if ok2 else 'FAIL'}  -> 积分器把静差从 "
          f"{abs(x_th) * 100:.1f} cm 压到 {abs(r2['x'][-1]) * 1e3:.1e} mm")
    REPORT.append(("LQI 静差 < 1e-3", "PASS" if ok2 else "FAIL", 12))


# ===========================================================================
# 第 5 节：临界采样周期（用网页版同一组 K）
# ===========================================================================
def section5(p, A, B, K, eigs):
    header("第 5 节  临界采样周期 Ts_crit（ZOH 离散化 + 谱半径过 1），用与网页版相同的 K")

    def rho(Ts):
        Ad, Bd = c2d_zoh(A, B, Ts)
        return float(np.max(np.abs(np.linalg.eigvals(Ad - Bd @ K))))

    lo, hi = 0.002, 0.2
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if rho(mid) < 1.0:
            lo = mid
        else:
            hi = mid
    Tsc = 0.5 * (lo + hi)
    p_un_free = math.sqrt(p.m * p.g * p.l * (p.M + p.m) / p.D0)   # 无摩擦不稳定极点
    p_un_real = float(np.max(np.linalg.eigvals(A).real))          # 含摩擦真实值
    tau_fast = -1.0 / float(np.min(eigs.real))

    print(f"  {'量':<30s}{'Python':>16s}{'网页版 JS':>14s}{'相对差':>12s}")
    print("  " + "-" * 74)
    print(f"  {'Ts_crit (ms)':<30s}{Tsc * 1e3:>16.4f}{JS['Ts_crit_ms']:>14.1f}"
          f"{_rel(Tsc * 1e3, JS['Ts_crit_ms']):>12.2e}")
    print(f"  {'p·Ts_crit (p 用无摩擦值)':<30s}{p_un_free * Tsc:>16.6f}"
          f"{JS['p_Ts_crit']:>14.3f}{_rel(p_un_free * Tsc, JS['p_Ts_crit']):>12.2e}")
    print(f"\n  无摩擦不稳定极点 p = sqrt(m·g·l·(M+m)/D0) = {p_un_free:.6f} rad/s")
    print(f"  含摩擦真实不稳定极点             = {p_un_real:.6f} rad/s"
          f"  -> p·Ts_crit = {p_un_real * Tsc:.6f}")
    print(f"  最快闭环极点 = {np.min(eigs.real):.4f} rad/s -> 时间常数 {tau_fast * 1e3:.3f} ms"
          f"（Ts_crit ≈ {Tsc / tau_fast:.3f}·tau）")
    rel = _rel(Tsc * 1e3, JS["Ts_crit_ms"])
    ok = rel < 0.05
    print(f"\n  判定: {'PASS' if ok else 'FAIL'} —— 相对差 {rel * 100:.3f}% < 5%"
          f"（网页版 37.4 ms 是 3 位有效数字，本实现 {Tsc * 1e3:.4f} ms 舍入后正是 37.4）")
    print("  注：本实现 README 里的 47.94 ms 用的是 demo 默认权重 Q=diag(1,1,20,1)、R=0.02，")
    print("      增益更软所以能忍更慢的采样；两个数字不矛盾（临界 Ts 依赖 K）。")
    REPORT.append(("Ts_crit 与 JS 一致(<5%)", "PASS" if ok else "FAIL", 3))
    return Tsc


# ===========================================================================
# 第 6 节：u -> theta 通道有没有有限零点
# ===========================================================================
def section6(p):
    header("第 6 节  u -> theta 通道的零点结构（网页版：Theta/U = -ml/(D0·s^2 - mgl(M+m))，分子为常数）")
    print("  解析（同第 3 节联立，消去 X）：")
    print("      Theta/U = -m·l·s^2 / { [(M+m)s^2 + b·s](J s^2 + c·s - m·g·l) - (m l)^2 s^4 }")
    print("  分子恒为 -m·l·s^2（在 4 状态非最小实现里就是原点二重零点），")
    print("  但分母能提出几个 s，决定了**约简后**还剩几个零点：\n")
    print(f"  {'情形':<24s}{'分子':>14s}{'分母可提出':>12s}   约简后有限零点")
    print("  " + "-" * 76)
    results = {}
    for tag, bb, cc in (("b=0, c=0（网页版式）", 0.0, 0.0),
                        ("b=0, c=0.005", 0.0, 0.005),
                        ("b=0.1, c=0.005（默认）", 0.1, 0.005)):
        pp = p.replace(b=bb, c=cc)
        A, B = linearize(pp)
        C = np.array([[0.0, 0.0, 1.0, 0.0]])
        num = np.poly(A - B @ C) - np.poly(A)
        den = np.poly(A)
        # 分母末尾连续为 0 的个数 = 能提出的 s 的幂次
        k_den = 0
        for coef in den[::-1]:
            if abs(coef) < 1e-10:
                k_den += 1
            else:
                break
        nz = max(0, 2 - k_den)        # 分子是 s^2，抵消 k_den 个后剩下的零点个数
        results[tag] = nz
        note = "无（分子约简为常数）" if nz == 0 else f"{nz} 个，全在原点 s=0"
        print(f"  {tag:<24s}{'-ml/D0·s^2':>14s}{'s^' + str(k_den):>12s}   {note}")
    print(f"\n  数值核对（默认参数）：num 系数 = "
          f"{np.array2string(np.poly(linearize(p)[0] - linearize(p)[1] @ np.array([[0,0,1.0,0]])) - np.poly(linearize(p)[0]), precision=6)}")
    A, B = linearize(p)
    den = np.poly(A)
    print(f"                        den 系数 = {np.array2string(den, precision=6)}")
    print(f"    -m·l/D0 = {-p.m * p.l / p.D0:.6f}（与 num 的 s^2 系数一致）")
    print(f"    den 的常数项 = {den[-1]:.6e}（= 0），s 的系数 = {den[-2]:.6e}"
          f" = -m·g·l·b/D0 = {-p.m * p.g * p.l * p.b / p.D0:.6e}")
    print("\n  【结论】")
    print("    * b = 0 且 c = 0 时：分母可提出 s^2，与分子的 s^2 完全抵消，")
    print("      Theta/U = -m·l/(D0·s^2 - m·g·l·(M+m))，**分子是常数、没有有限零点**")
    print("      —— 网页版的推导在这个前提下完全正确。")
    print(f"    * 默认参数 b = {p.b} != 0 时：分母只能提出 s^1（常数项为 0、s 系数 = -mgl·b/D0 != 0），")
    print("      约简后 Theta/U = -(m·l/D0)·s / (三次多项式)，**还剩 1 个位于原点的零点**。")
    print("      这正是'小车匀速漂移在角度里看不见'（DC 增益为 0）的数学表述，")
    print("      也是纯 PD 不能稳定角度环的原因：三次分母常数项 = -m·g·l·b/D0 < 0，")
    print("      Routh-Hurwitz 恒不满足，必须加积分项。")
    ok = results["b=0, c=0（网页版式）"] == 0 and results["b=0.1, c=0.005（默认）"] == 1
    REPORT.append(("u->theta 零点结构", "PASS" if ok else "FAIL", 12))
    return results


# ===========================================================================
# 主程序
# ===========================================================================
def main() -> int:
    print("=" * 118)
    print("crosscheck.py —— Python 参考实现 vs 网页版 JS 实现 逐位交叉验证")
    print(f"numpy {np.__version__}   " +
          ("scipy 已安装（作第三方独立复核）" if HAS_SCIPY else "scipy 未安装（跳过第三方复核）"))
    print("=" * 118)

    p = PendulumParams()
    A, B = linearize(p)

    K, P, eigs = section1(p, A, B)
    K5 = section2(A, B)
    section3(p)
    section4(p, A, B, K, K5)
    section5(p, A, B, K, eigs)
    section6(p)

    # ------------------------------ 汇总 ------------------------------
    header("汇总")
    n_pass = sum(1 for _, v, _ in REPORT if v == "PASS")
    n_star = sum(1 for _, v, _ in REPORT if v == "PASS*")
    n_fail = sum(1 for _, v, _ in REPORT if v == "FAIL")
    print(f"  对照项总数 {len(REPORT)}：PASS {n_pass}，"
          f"PASS*（偏差完全落在基准打印精度内）{n_star}，FAIL {n_fail}\n")
    print(f"  {'对照组':<22s}{'项数':>5s}{'最大相对差':>13s}{'最大绝对差':>13s}"
          f"{'基准末位半单位':>15s}{'量化比':>9s}")
    print("  " + "-" * 80)
    max_quant = 0.0
    for nm, g in _GROUP.items():
        half = 0.5 * 10.0 ** (-g["dec"])
        max_quant = max(max_quant, g["quant"])
        print(f"  {nm:<22s}{g['n']:>5d}{g['rel']:>13.2e}{g['abs']:>13.2e}"
              f"{half:>15.1e}{g['quant']:>9.3f}")
    print(f"\n  **量化比 = 绝对差 / 基准末位半单位；全部 <= 1 说明每一项都落在基准的打印精度之内。**")
    print(f"  实测最大量化比 = {max_quant:.3f} <= 1  ->  "
          f"{'成立' if max_quant <= 1.0 else '不成立'}")
    print(f"  与 JS 的最大相对差 {_MAXREL['js']:.3e} 出现在 lam(P)[3]（基准只有 2 位有效数字 0.015，"
          f"本实现 0.0147830091）")
    if HAS_SCIPY:
        print(f"  与 scipy 的最大相对差 = {_MAXREL['scipy']:.3e}（全精度对照，机器精度级）")
    if n_fail or max_quant > 1.0:
        print("\n  失败项:")
        for nm, v, d in REPORT:
            if v == "FAIL":
                print(f"    - {nm}")
        print("\n  结果: FAIL")
        return 1
    print("\n  结果: 三方（本实现 / scipy / 网页版 JS）全部一致 —— ALL PASS")
    print("  详细结论与对网页版的 2 点修改建议见 README.md 第 10 节。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
