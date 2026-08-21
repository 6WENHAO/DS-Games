# -*- coding: utf-8 -*-
"""
test_pendulum.py —— 小车-倒立摆参考实现的自检脚本（纯 assert 风格，不需要 pytest）

用法:
    python test_pendulum.py            # 跑全部自检，打印 PASS/FAIL 汇总
    python test_pendulum.py -v         # 额外打印每项自检的关键数值

覆盖内容（编号与 README 对应）：
  1  无控制、无摩擦时的总机械能守恒（theta=pi/2 自由摆动 5 s，相对误差 < 1e-6）
  2  线性化矩阵 A、B 与非线性动力学的一致性（中心差分数值雅可比，误差 < 1e-6）
  3  线性化的二阶精度：|f(s,u) - (A s + B u)| = O(|s|^2)
  4  Riccati 残差范数 < 1e-8，且闭环极点全部严格位于左半平面
  5  与 scipy.linalg.solve_continuous_are 的解一致（1e-6；无 scipy 自动跳过）
  6  Kleinman-Newton 得到的 P 对称正定，且 K = R^{-1} B^T P
  7  可控性矩阵满秩（rank = 4）
  8  LQR 闭环从 theta0 = 0.2 rad 收敛到 |theta| < 1e-3 且小车静止
  9  串级 PID 同时稳住角度与位置
 10  单环 PID 稳住角度但小车漂移（教学要点的"反例"自检）
 11  RK4 的 4 阶收敛性（步长减半，误差约降到 1/16）
 12  ZOH 采样保持与整数采样周期控制延迟的实现正确性
 13  控制量饱和与抗积分饱和（|u| <= u_max 恒成立，积分项不发散）
 14  能量法摆起：从 theta = pi 摆起并被 LQR 接住（只切换一次，最终收敛）
 15  wrap_pi、质量阵行列式为正、expm/c2d_zoh 的基本正确性
"""

from __future__ import annotations

import math
import sys
import time
import traceback

import numpy as np

import pendulum as pdl
from pendulum import (PendulumParams, dynamics, rk4_step, linearize, energy,
                      pendulum_energy, lqr, care_residual, ctrb, is_controllable,
                      expm, c2d_zoh, wrap_pi, mass_matrix, simulate, metrics,
                      PID, CascadePID, LQRController, SwingUpController,
                      DEFAULT_Q, DEFAULT_R, HAS_SCIPY)

# Windows 控制台默认 GBK，强制 UTF-8 输出，保证中文不乱码
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:      # pragma: no cover
    pass

VERBOSE = any(a in ("-v", "--verbose") for a in sys.argv[1:])
_TESTS = []


def test(title):
    """把函数注册为一项自检。函数可返回字符串作为附加信息。"""
    def deco(fn):
        _TESTS.append((title, fn))
        return fn
    return deco


def info(msg):
    if VERBOSE:
        print("        · " + msg)


# ===========================================================================
# 1. 能量守恒
# ===========================================================================
@test("1  能量守恒：无控制、无摩擦，theta=pi/2 自由摆动 5 s，相对误差 < 1e-6")
def t_energy():
    p = PendulumParams(b=0.0, c=0.0)          # 关掉两处粘性摩擦
    s = np.array([0.0, 0.0, math.pi / 2, 0.0])
    dt = 0.002
    E0 = energy(s, p)                          # 以直立静止为势能零点 -> E0 = -m*g*l
    assert abs(E0) > 1e-3, "参考能量不应为 0，否则相对误差无意义"
    Emax = Emin = E0
    n = int(round(5.0 / dt))
    for _ in range(n):
        s = rk4_step(s, 0.0, p, dt)            # u = 0
        E = energy(s, p)
        Emax = max(Emax, E)
        Emin = min(Emin, E)
    rel = max(abs(Emax - E0), abs(Emin - E0)) / abs(E0)
    info(f"E0 = {E0:.12f} J, 最大相对漂移 = {rel:.3e}")
    assert rel < 1e-6, f"能量相对漂移 {rel:.3e} 超过 1e-6"
    # 顺带检查：摆杆自身能量在小车静止时与总能量一致
    s2 = np.array([0.0, 0.0, 0.7, 0.0])
    assert abs(energy(s2, p) - pendulum_energy(s2, p)) < 1e-14
    return f"相对能量漂移 {rel:.2e}"


# ===========================================================================
# 2/3. 线性化一致性
# ===========================================================================
@test("2  线性化一致性：中心差分数值雅可比 vs 解析 A、B，误差 < 1e-6")
def t_jacobian():
    p = PendulumParams()
    A, B = linearize(p)
    s0 = np.zeros(4)
    h = 1e-6
    A_num = np.zeros((4, 4))
    for j in range(4):
        e = np.zeros(4)
        e[j] = h
        A_num[:, j] = (dynamics(s0 + e, 0.0, p) - dynamics(s0 - e, 0.0, p)) / (2 * h)
    B_num = ((dynamics(s0, h, p) - dynamics(s0, -h, p)) / (2 * h)).reshape(4, 1)
    errA = float(np.max(np.abs(A_num - A)))
    errB = float(np.max(np.abs(B_num - B)))
    info(f"max|A_num - A| = {errA:.3e},  max|B_num - B| = {errB:.3e}")
    assert errA < 1e-6, f"A 误差 {errA:.3e}"
    assert errB < 1e-6, f"B 误差 {errB:.3e}"
    # 平衡点校验：f(0, 0) = 0
    assert np.max(np.abs(dynamics(s0, 0.0, p))) < 1e-15
    # B[3] < 0 是本项目的关键符号事实（向右推小车、摆杆向左倒）
    assert B[3, 0] < 0.0 and B[1, 0] > 0.0
    return f"errA = {errA:.2e}, errB = {errB:.2e}"


@test("3  线性化的高阶精度：|f(s,u) - (A s + B u)| = O(|s|^3)")
def t_lin_order():
    """本系统的线性化残差其实是**三阶**的，不是通常的二阶。

    原因：所有非线性项要么是 sin(theta) = theta - theta^3/6，要么是
    cos(theta) = 1 - theta^2/2 出现在（分母）质量阵里再乘以本身已是一阶小量的
    右端项，要么是离心项 m*l*sin(theta)*theta_dot^2（本身就是三阶）。
    因此二阶项系数恒为零 —— 这也是倒立摆线性化控制器在中等角度下依然好用的原因。
    """
    p = PendulumParams()
    A, B = linearize(p)
    rng = np.random.default_rng(1)
    d = rng.normal(size=4)
    d /= np.linalg.norm(d)
    r2, r3 = [], []
    for eps in (1e-2, 1e-3, 1e-4):
        s = eps * d
        u = eps
        r = dynamics(s, u, p) - (A @ s + (B * u).ravel())
        nr = float(np.linalg.norm(r))
        r2.append(nr / eps ** 2)
        r3.append(nr / eps ** 3)
    info("残差/eps^2 = " + ", ".join(f"{e:.3e}" for e in r2))
    info("残差/eps^3 = " + ", ".join(f"{e:.6f}" for e in r3))
    # 残差/eps^2 -> 0 说明至少是二阶；残差/eps^3 三个尺度一致说明恰好是三阶
    assert r2[0] > r2[1] > r2[2], f"残差不是高于二阶: {r2}"
    assert max(r3) / min(r3) < 5.0, f"不是三阶收敛: {r3}"
    return "残差/eps^3 ≈ %.4f（三个尺度一致，说明二阶项恒为零）" % r3[-1]


# ===========================================================================
# 4/5/6. Riccati / LQR
# ===========================================================================
@test("4  Riccati 残差 < 1e-8，闭环极点全部严格在左半平面")
def t_riccati():
    p = PendulumParams()
    A, B = linearize(p)
    K, P, eigs, meta = lqr(A, B, DEFAULT_Q, DEFAULT_R, return_info=True)
    res = care_residual(A, B, DEFAULT_Q, DEFAULT_R, P)
    info(f"残差 = {res:.3e}, Newton 迭代 {meta['newton_iters']} 次, "
         f"值迭代反向时间 {meta['vi_tau']:.2f} s")
    info("K = " + np.array2string(K.ravel(), precision=6))
    info("闭环极点 = " + np.array2string(np.sort_complex(eigs), precision=6))
    assert res < 1e-8, f"Riccati 残差 {res:.3e} >= 1e-8"
    assert np.max(eigs.real) < -1e-9, f"闭环极点未严格在左半平面: {eigs}"
    # 多组权重都要满足
    for Rv in (0.005, 0.05, 1.0, 20.0):
        Ki, Pi, ei = lqr(A, B, DEFAULT_Q, [[Rv]])
        r_i = care_residual(A, B, DEFAULT_Q, [[Rv]], Pi)
        assert r_i < 1e-8 * max(1.0, np.linalg.norm(Pi, "fro")), (Rv, r_i)
        assert np.max(ei.real) < -1e-9, (Rv, ei)
    return f"残差 {res:.2e}，最大极点实部 {np.max(eigs.real):.4f}"


@test("5  与 scipy.linalg.solve_continuous_are 交叉校验（相对误差 < 1e-6）")
def t_scipy():
    if not HAS_SCIPY:
        return "SKIP（未安装 scipy）"
    from scipy import linalg as sla
    p = PendulumParams()
    A, B = linearize(p)
    worst = 0.0
    for Rv in (0.005, 0.02, 0.5, 10.0):
        K, P, eigs = lqr(A, B, DEFAULT_Q, [[Rv]], verify=False)
        P_sp = sla.solve_continuous_are(A, B, DEFAULT_Q, np.array([[Rv]]))
        rel = float(np.linalg.norm(P - P_sp, "fro") / np.linalg.norm(P_sp, "fro"))
        K_sp = (np.array([[1.0 / Rv]]) @ B.T @ P_sp)
        relK = float(np.linalg.norm(K - K_sp) / np.linalg.norm(K_sp))
        worst = max(worst, rel, relK)
        assert rel < 1e-6, f"R={Rv}: P 相对误差 {rel:.3e}"
        assert relK < 1e-6, f"R={Rv}: K 相对误差 {relK:.3e}"
    info(f"4 组权重下最大相对误差 = {worst:.3e}")
    return f"最大相对误差 {worst:.2e}"


@test("6  P 对称正定，且 K = R^{-1} B^T P")
def t_p_props():
    p = PendulumParams()
    A, B = linearize(p)
    K, P, eigs = lqr(A, B, DEFAULT_Q, DEFAULT_R)
    asym = float(np.max(np.abs(P - P.T)))
    evP = np.linalg.eigvalsh(P)
    K_chk = np.linalg.inv(np.atleast_2d(DEFAULT_R)) @ B.T @ P
    errK = float(np.max(np.abs(K - K_chk)))
    info(f"非对称度 = {asym:.3e}, P 最小特征值 = {evP.min():.6f}, |K - R^-1 B^T P| = {errK:.3e}")
    assert asym < 1e-12
    assert evP.min() > 0.0, "P 不是正定的"
    assert errK < 1e-12
    return f"lambda_min(P) = {evP.min():.4f}"


# ===========================================================================
# 7. 可控性
# ===========================================================================
@test("7  可控性矩阵满秩（rank = 4）")
def t_ctrb():
    p = PendulumParams()
    A, B = linearize(p)
    C, rank, cond = ctrb(A, B)
    info(f"rank = {rank}, cond = {cond:.4g}")
    assert C.shape == (4, 4)
    assert rank == 4, f"秩 {rank} != 4，系统不可控"
    assert is_controllable(A, B)
    assert np.isfinite(cond) and cond < 1e8
    # 反例：注意 B = [0,1,0,0]（只推小车速度）其实**仍然可控**——
    # 小车加速度会通过转轴反作用到摆杆上，这正是倒立摆能被控制的物理基础。
    assert is_controllable(A, np.array([[0.0], [1.0], [0.0], [0.0]]))
    # 真正不可控的反例：双积分器只驱动位置、不驱动速度
    A_bad = np.array([[0.0, 1.0], [0.0, 0.0]])
    B_bad = np.array([[1.0], [0.0]])
    _, rank_bad, _ = ctrb(A_bad, B_bad)
    assert rank_bad == 1 and not is_controllable(A_bad, B_bad)
    return f"rank = 4, cond = {cond:.1f}"


# ===========================================================================
# 8/9/10. 闭环行为
# ===========================================================================
@test("8  LQR 闭环：theta0 = 0.2 rad -> |theta| < 1e-3 且小车静止")
def t_lqr_closed():
    p = PendulumParams()
    c = LQRController(p)
    r = simulate(c, [0.0, 0.0, 0.2, 0.0], 8.0, p, Q=DEFAULT_Q, R=DEFAULT_R)
    th, x, xd = r["theta"][-1], r["x"][-1], r["x_dot"][-1]
    info(f"末态 x = {x:.3e}, x_dot = {xd:.3e}, theta = {th:.3e}, J = {r['J']:.6f}")
    assert not r["diverged"]
    assert abs(th) < 1e-3, f"|theta| = {abs(th):.3e}"
    assert abs(xd) < 1e-3, f"小车未静止, x_dot = {xd:.3e}"
    assert abs(x) < 2e-2, f"小车未回到原点, x = {x:.3e}"
    assert np.max(np.abs(r["u"])) <= p.u_max + 1e-12
    return f"|theta_end| = {abs(th):.2e}, |x_dot_end| = {abs(xd):.2e}"


@test("9  串级 PID：角度与小车位置同时稳定（含 0.4 N·s 冲量扰动）")
def t_cascade():
    p = PendulumParams()
    c = CascadePID(p)
    r = simulate(c, [0.0, 0.0, 0.05, 0.0], 14.0, p,
                 disturbances=[{"type": "impulse", "t": 2.0, "force": 0.4}],
                 Q=DEFAULT_Q, R=DEFAULT_R)
    m = metrics(r)
    info(f"末态 x = {r['x'][-1]:.4f}, theta = {r['theta'][-1]:.2e}, "
         f"max|theta| = {m['max_abs_theta']:.4f}, J = {m['J']:.4f}")
    assert not r["diverged"]
    assert abs(r["theta"][-1]) < 5e-3
    assert abs(r["x"][-1]) < 0.05, "串级 PID 应把小车拉回原点"
    assert m["max_abs_theta"] < 0.25
    return f"x_end = {r['x'][-1]:.4f} m, max|theta| = {m['max_abs_theta']:.3f} rad"


@test("10 单环 PID：角度稳住但小车漂移（教学反例）")
def t_pid_drift():
    p = PendulumParams()
    c = PID(p)
    dist = [{"type": "impulse", "t": 3.0, "force": 0.4},
            {"type": "impulse", "t": 8.0, "force": 0.4}]
    r = simulate(c, [0.0, 0.0, 0.05, 0.0], 14.0, p, disturbances=dist)
    info(f"末态 theta = {r['theta'][-1]:.2e} rad, x = {r['x'][-1]:.3f} m, "
         f"x_dot = {r['x_dot'][-1]:.3f} m/s")
    assert not r["diverged"]
    assert abs(r["theta"][-1]) < 1e-2, "单环 PID 应该能稳住角度"
    assert abs(r["x"][-1]) > 0.3, "单环 PID 的小车本应漂走（教学要点）"
    return f"theta_end = {r['theta'][-1]:.1e} rad，但 x_end = {r['x'][-1]:.2f} m（漂移）"


# ===========================================================================
# 11/12/13. 数值与实现细节
# ===========================================================================
@test("11 RK4 的 4 阶收敛性：步长减半，误差约降到 1/16")
def t_rk4_order():
    p = PendulumParams()
    s0 = np.array([0.1, -0.2, 0.4, 0.5])

    def run(dt, T=1.0):
        s = s0.copy()
        for _ in range(int(round(T / dt))):
            s = rk4_step(s, 1.0, p, dt)       # 常值 u = 1 N
        return s

    ref = run(1e-4)                            # 视为"精确解"
    e1 = np.linalg.norm(run(8e-3) - ref)
    e2 = np.linalg.norm(run(4e-3) - ref)
    e3 = np.linalg.norm(run(2e-3) - ref)
    r1, r2 = e1 / e2, e2 / e3
    info(f"误差 {e1:.3e} -> {e2:.3e} -> {e3:.3e}，比值 {r1:.1f}, {r2:.1f}")
    assert 8.0 < r1 < 40.0, f"收敛阶不对: {r1}"
    assert 8.0 < r2 < 40.0, f"收敛阶不对: {r2}"
    return f"误差比 {r1:.1f} 与 {r2:.1f}（理论 16）"


@test("12 ZOH 采样保持与整数采样周期的控制延迟")
def t_zoh_delay():
    p = PendulumParams()
    Ts, dt = 0.01, 0.002
    n_sub = int(round(Ts / dt))

    class Ramp:
        """第 k 次被调用就输出 k+1（便于追踪哪一次的指令被施加）。"""
        name = "ramp"

        def reset(self):
            self.k = 0

        def set_reference(self, fn):
            pass

        def __call__(self, s, t):
            self.k += 1
            return float(self.k)

    # --- 无延迟：每个采样周期内 u 必须完全保持不变 ---
    r = simulate(Ramp(), [0, 0, 0.0, 0], 0.1, p, dt=dt, Ts=Ts, delay_steps=0)
    for k in range(10):
        seg = r["u"][k * n_sub: (k + 1) * n_sub]
        assert np.allclose(seg, k + 1.0), f"第 {k} 个采样周期内 u 不恒定: {seg}"
    assert np.allclose(r["us"], np.arange(1, 11))

    # --- 延迟 3 个采样周期 ---
    d = 3
    r = simulate(Ramp(), [0, 0, 0.0, 0], 0.1, p, dt=dt, Ts=Ts, delay_steps=d)
    for k in range(10):
        seg = r["u"][k * n_sub: (k + 1) * n_sub]
        expect = 0.0 if k < d else float(k + 1 - d)
        assert np.allclose(seg, expect), f"延迟错位: k={k}, u={seg[0]}, 期望 {expect}"
    info(f"n_sub = {n_sub}，延迟 {d} 个采样周期的施加序列核对通过")

    # --- Ts 不是 dt 整数倍时应自动对齐 ---
    r2 = simulate(None, [0, 0, 0.01, 0], 0.1, p, dt=0.003, Ts=0.01)
    assert abs(r2["dt"] * round(0.01 / 0.003) - 0.01) < 1e-15
    return "保持与延迟均正确"


@test("13 饱和与抗积分饱和：|u| <= u_max 恒成立，积分项不发散")
def t_saturation():
    p = PendulumParams(u_max=3.0)               # 故意把限幅压得很小，逼出饱和
    for ctrl in (PID(p), CascadePID(p), LQRController(p)):
        r = simulate(ctrl, [0.0, 0.0, 0.30, 0.0], 6.0, p)
        umax = float(np.max(np.abs(r["u"])))
        assert umax <= p.u_max + 1e-12, f"{ctrl.name} 超限: {umax}"
        assert umax > 0.99 * p.u_max, f"{ctrl.name} 未触发饱和，该用例无意义"
        # 抗饱和：积分器不应无界增长
        if isinstance(ctrl, PID):
            assert abs(ctrl.core.integ) < 50.0 * p.u_max, ctrl.core.integ
        if isinstance(ctrl, CascadePID):
            assert abs(ctrl.inner.integ) < 50.0 * p.u_max
            assert abs(ctrl.outer.integ) <= ctrl.theta_max * 5.0 + 1e-9
    # 抗饱和两种实现都要能用
    for aw in ("cond", "backcalc"):
        c = PID(p, aw=aw)
        r = simulate(c, [0.0, 0.0, 0.25, 0.0], 6.0, p)
        assert float(np.max(np.abs(r["u"]))) <= p.u_max + 1e-12
    info("PID / CascadePID / LQR 在 u_max = 3 N 下均未越界，积分项有界")
    return "三种控制器均满足 |u| <= u_max"


# ===========================================================================
# 14. 摆起
# ===========================================================================
@test("14 能量法摆起：theta0 = pi -> LQR 接住并收敛（切换次数 = 1）")
def t_swingup():
    p = PendulumParams()
    c = SwingUpController(p)
    r = simulate(c, [0.0, 0.0, math.pi, 0.0], 14.0, p, Q=DEFAULT_Q, R=DEFAULT_R)
    sw = [t for t, kind in r["switch_times"] if kind == "to_lqr"]
    info(f"切换记录 = {[(round(t,3), k) for t, k in r['switch_times']]}")
    info(f"末态 x = {r['x'][-1]:.2e}, theta = {wrap_pi(r['theta'][-1]):.2e}, "
         f"最大小车行程 = {np.max(np.abs(r['x'])):.2f} m")
    assert not r["diverged"]
    assert len(sw) == 1, f"应当只切换一次，实际 {r['switch_times']}"
    assert 0.3 < sw[0] < 6.0, f"切换时刻异常: {sw[0]}"
    assert abs(wrap_pi(r["theta"][-1])) < 1e-3
    assert abs(r["x"][-1]) < 0.05 and abs(r["x_dot"][-1]) < 1e-2
    assert float(np.max(np.abs(r["u"]))) <= p.u_max + 1e-12
    # 能量确实被泵上去了
    E0 = pendulum_energy([0, 0, math.pi, 0], p)
    assert E0 < -2.0 * p.m * p.g * p.l + 1e-9
    return f"t_switch = {sw[0]:.2f} s，末态 |theta| = {abs(wrap_pi(r['theta'][-1])):.1e} rad"


# ===========================================================================
# 15. 其它工具
# ===========================================================================
@test("15 wrap_pi / 质量阵正定 / expm 与 ZOH 离散化")
def t_utils():
    # wrap_pi
    assert abs(wrap_pi(0.0)) < 1e-15
    assert abs(wrap_pi(2 * math.pi) - 0.0) < 1e-12
    assert abs(wrap_pi(3 * math.pi) - math.pi) < 1e-12
    assert abs(wrap_pi(-math.pi - 0.1) - (math.pi - 0.1)) < 1e-12
    assert np.allclose(wrap_pi(np.array([0.0, 7.0, -7.0])),
                       np.array([0.0, 7.0 - 2 * math.pi, -7.0 + 2 * math.pi]))
    # 质量阵行列式恒正（Cauchy-Schwarz），theta 全周扫一遍
    p = PendulumParams()
    dets = [np.linalg.det(mass_matrix(th, p)) for th in np.linspace(-math.pi, math.pi, 361)]
    assert min(dets) > 0.0, f"质量阵奇异: min det = {min(dets)}"
    info(f"min det M(theta) = {min(dets):.6f}（理论下界 D0 = {p.D0:.6f}）")
    assert abs(min(dets) - p.D0) < 1e-12

    # expm：与解析结果比较（2x2 旋转型）
    Mrot = np.array([[0.0, 1.0], [-1.0, 0.0]])
    Eref = np.array([[math.cos(1.0), math.sin(1.0)], [-math.sin(1.0), math.cos(1.0)]])
    err = float(np.max(np.abs(expm(Mrot) - Eref)))
    assert err < 1e-12, err
    if HAS_SCIPY:
        from scipy import linalg as sla
        A, B = linearize(p)
        err2 = float(np.max(np.abs(expm(A * 0.05) - sla.expm(A * 0.05))))
        info(f"expm 与 scipy.linalg.expm 的最大偏差 = {err2:.3e}")
        assert err2 < 1e-11, err2

    # ZOH 离散化：Ts -> 0 时 Ad -> I, Bd -> 0；小 Ts 下一步应与 RK4 一致
    A, B = linearize(p)
    Ad, Bd = c2d_zoh(A, B, 1e-9)
    assert np.max(np.abs(Ad - np.eye(4))) < 1e-7 and np.max(np.abs(Bd)) < 1e-7
    Ts = 0.005
    Ad, Bd = c2d_zoh(A, B, Ts)
    s0 = np.array([0.01, 0.0, 0.01, 0.0])
    u0 = 0.5
    s_lin = Ad @ s0 + (Bd * u0).ravel()
    s_num = s0.copy()
    for _ in range(50):                     # 用线性模型的 RK4 细分积分做对照
        def f(s):
            return A @ s + (B * u0).ravel()
        h = Ts / 50
        k1 = f(s_num); k2 = f(s_num + 0.5 * h * k1)
        k3 = f(s_num + 0.5 * h * k2); k4 = f(s_num + h * k3)
        s_num = s_num + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    err3 = float(np.max(np.abs(s_lin - s_num)))
    info(f"c2d_zoh 与细分 RK4 的最大偏差 = {err3:.3e}")
    assert err3 < 1e-12, err3
    return "工具函数全部正确"


@test("16 传递函数零点：u->x 通道存在右半平面零点 sqrt(3g/(2L))")
def t_zeros():
    """非最小相位性的定量自检：也用于和网页版 analyze() 里的 zRHP 交叉验证。"""
    p0 = PendulumParams(b=0.0, c=0.0)          # 无摩擦时有解析解
    A, B = linearize(p0)
    zx = np.sort(pdl.tf_zeros(A, B, [1, 0, 0, 0]).real)
    z_theory = math.sqrt(3 * p0.g / (2 * p0.L))     # = sqrt(m*g*l/J)
    assert abs(math.sqrt(p0.m * p0.g * p0.l / p0.J) - z_theory) < 1e-12
    err = max(abs(zx[0] + z_theory), abs(zx[1] - z_theory))
    info(f"u->x 零点 = {zx}, 理论 ±{z_theory:.6f}, 误差 = {err:.3e}")
    assert zx.size == 2 and err < 1e-9, f"零点不对: {zx}"
    assert zx[1] > 0, "右半平面零点应为正实数"
    # u->theta 通道：原点双重零点（小车漂移模态被零极点对消）
    zt = pdl.tf_zeros(A, B, [0, 0, 1, 0])
    assert zt.size == 2 and np.max(np.abs(zt)) < 1e-9, f"u->theta 零点不对: {zt}"
    # 带摩擦时零点仍一正一负（非最小相位不会因摩擦消失）
    A2, B2 = linearize(PendulumParams())
    zx2 = np.sort(pdl.tf_zeros(A2, B2, [1, 0, 0, 0]).real)
    assert zx2[0] < 0 < zx2[1]
    info(f"含摩擦时 u->x 零点 = {zx2}")
    return f"RHP 零点 = +{zx[1]:.4f} rad/s（理论 {z_theory:.4f}）"


# ===========================================================================
# 主程序
# ===========================================================================
def main() -> int:
    print("=" * 78)
    print("小车-倒立摆参考实现自检  (python test_pendulum.py)")
    print("numpy %s   scipy %s" % (np.__version__, "已安装" if HAS_SCIPY else "未安装（相关项跳过）"))
    print("=" * 78)
    n_pass = n_fail = n_skip = 0
    t_start = time.perf_counter()
    failures = []

    for title, fn in _TESTS:
        t0 = time.perf_counter()
        try:
            extra = fn()
            dt_ms = (time.perf_counter() - t0) * 1e3
            if isinstance(extra, str) and extra.startswith("SKIP"):
                n_skip += 1
                print(f"[SKIP] {title}\n        {extra}  ({dt_ms:.0f} ms)")
            else:
                n_pass += 1
                tail = f"\n        -> {extra}" if extra else ""
                print(f"[PASS] {title}{tail}  ({dt_ms:.0f} ms)")
        except Exception as exc:                     # noqa: BLE001
            dt_ms = (time.perf_counter() - t0) * 1e3
            n_fail += 1
            failures.append((title, exc))
            print(f"[FAIL] {title}  ({dt_ms:.0f} ms)")
            print("        " + "".join(traceback.format_exception_only(type(exc), exc)).strip())

    print("=" * 78)
    print(f"汇总: {n_pass} PASS / {n_fail} FAIL / {n_skip} SKIP"
          f"   总耗时 {time.perf_counter() - t_start:.2f} s")
    if failures:
        print("失败项:")
        for title, exc in failures:
            print(f"  - {title}: {exc}")
        print("结果: FAIL")
        return 1
    print("结果: 全部通过 (ALL PASS)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
