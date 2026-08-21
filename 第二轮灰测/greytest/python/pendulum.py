# -*- coding: utf-8 -*-
"""
pendulum.py —— 小车-倒立摆（cart-pole）教学仿真的**数值参考实现**（核心库，不含任何绘图）

设计目标
--------
1. 与网页交互版使用**完全一致**的符号约定与运动方程，可作为网页数值结果的交叉验证基准；
2. 代码尽量"教科书化"：每一步都能对应课堂上的公式；
3. 只依赖 numpy；scipy 仅用于可选的交叉校验（缺失时自动跳过，不报错）。

建模约定（不得改动）
-------------------
状态量  s = [x, x_dot, theta, theta_dot]
    x        : 小车水平位置 (m)
    x_dot    : 小车速度 (m/s)
    theta    : 摆杆与**竖直向上方向**的夹角 (rad)，theta = 0 为直立平衡点
    theta_dot: 摆杆角速度 (rad/s)
摆杆为**均匀细杆**：总质量 m，总长 L，质心距转轴 l = L/2，绕质心转动惯量 I = m*L^2/12。
参数：M 小车质量、m 杆质量、L 杆长、g 重力加速度、
      b 小车粘性摩擦系数（作用于 x_dot）、c 转轴粘性摩擦系数（作用于 theta_dot）、
      u 作用在小车上的水平力 (N)。

非线性运动方程（拉格朗日法，务必按此实现）：解 2x2 线性方程组得到 [x_ddot, theta_ddot]

    [ M+m            m*l*cos(theta) ] [x_ddot    ]   [ u - b*x_dot + m*l*sin(theta)*theta_dot^2 ]
    [ m*l*cos(theta)  I + m*l^2     ] [theta_ddot] = [ m*g*l*sin(theta) - c*theta_dot           ]

行列式 Delta = (M+m)*(I+m*l^2) - (m*l*cos(theta))^2 > 0 恒成立（Cauchy-Schwarz）。

上式与拉格朗日量 Lag = T - V 严格等价，其中
    T = 0.5*(M+m)*x_dot^2 + m*l*x_dot*theta_dot*cos(theta) + 0.5*(I+m*l^2)*theta_dot^2
    V = m*g*l*cos(theta)                      （以转轴所在水平面为势能零点）
因此在 u = 0、b = 0、c = 0 时总机械能守恒 —— 这正是 test_pendulum.py 的第 1 项自检。

一个必须注意的符号事实（教学要点）：
在上述方程中 theta > 0 对应杆的质心偏向 **+x** 一侧（因为耦合项取 +m*l*cos(theta)，
且 F1 中的离心项为 +m*l*sin(theta)*theta_dot^2）。于是"把小车往 +x 推"会让
theta_ddot < 0（线性化后 B[3] < 0），即**向右推小车、摆杆相对向左倒**。这就是倒立摆
"方向反直觉"的根源，也是串级 PID 外环必须靠"先反向动一下"才能移动小车的原因。
动画绘图时杆端点按 (x + L*sin(theta), L*cos(theta)) 画，与方程自洽。

模块内容
--------
* PendulumParams        : 参数数据类（含派生属性 l、I、D0）
* dynamics / rk4_step   : 非线性导数与定步长 RK4
* linearize             : theta = 0 处的解析线性化 (A, B)
* energy / pendulum_energy : 机械能（用于能量守恒自检与能量法摆起）
* lqr                   : **自己实现**的连续时间 Riccati 方程求解（值迭代 + Kleinman-Newton）
* ctrb / is_controllable : 可控性矩阵、秩、条件数
* expm / c2d_zoh        : 矩阵指数与零阶保持离散化（用于采样周期分析）
* PID / CascadePID / LQRController / SwingUpController : 控制器
* simulate              : 统一仿真入口（ZOH 采样、延迟、噪声、量化、扰动、参考轨迹、代价累积）
* metrics               : 定量性能指标
"""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, replace as _dc_replace

import numpy as np

# ---------------------------------------------------------------------------
# scipy 为**可选**依赖：仅用于交叉校验，缺失时自动跳过
# ---------------------------------------------------------------------------
try:  # pragma: no cover
    from scipy import linalg as _sla  # noqa: F401
    HAS_SCIPY = True
except Exception:  # pragma: no cover
    _sla = None
    HAS_SCIPY = False

__all__ = [
    "PendulumParams", "HAS_SCIPY",
    "dynamics", "rk4_step", "linearize", "energy", "pendulum_energy",
    "lqr", "care_residual", "ctrb", "is_controllable", "tf_zeros", "expm", "c2d_zoh",
    "wrap_pi", "saturate",
    "Controller", "PID", "CascadePID", "LQRController", "SwingUpController",
    "simulate", "metrics", "make_reference",
    "DT_DEFAULT", "TS_DEFAULT", "DEFAULT_Q", "DEFAULT_R",
]

# 默认物理积分步长与控制采样周期
DT_DEFAULT = 0.002   # s，RK4 物理步长
TS_DEFAULT = 0.01    # s，控制器采样周期（ZOH）

# LQR 默认权重（Bryson 定则：Q_ii = 1/x_i,max^2, R = 1/u_max^2 的量级，再手工微调）
#   x_max ≈ 0.5 m, x_dot_max ≈ 1 m/s, theta_max ≈ 0.2 rad, theta_dot_max ≈ 1 rad/s
DEFAULT_Q = np.diag([1.0, 1.0, 20.0, 1.0])
DEFAULT_R = np.array([[0.02]])


# ===========================================================================
# 1. 参数
# ===========================================================================
@dataclass
class PendulumParams:
    """小车-倒立摆物理参数（SI 单位）。默认值与网页版一致。"""

    M: float = 0.5        # 小车质量 (kg)
    m: float = 0.2        # 摆杆质量 (kg)
    L: float = 0.6        # 摆杆总长 (m)
    g: float = 9.81       # 重力加速度 (m/s^2)
    b: float = 0.1        # 小车粘性摩擦系数 (N/(m/s))
    c: float = 0.005      # 转轴粘性摩擦系数 (N*m/(rad/s))
    u_max: float = 10.0   # 控制力饱和限幅 (N)

    # --- 派生量 -----------------------------------------------------------
    @property
    def l(self) -> float:
        """质心到转轴距离 l = L/2（均匀细杆）。"""
        return 0.5 * self.L

    @property
    def I(self) -> float:
        """绕**质心**的转动惯量 I = m*L^2/12（均匀细杆）。"""
        return self.m * self.L ** 2 / 12.0

    @property
    def J(self) -> float:
        """绕**转轴**的转动惯量 J = I + m*l^2 = m*L^2/3（平行轴定理）。"""
        return self.I + self.m * self.l ** 2

    @property
    def D0(self) -> float:
        """theta = 0 处质量阵行列式 D0 = (M+m)*(I+m*l^2) - (m*l)^2 > 0。"""
        return (self.M + self.m) * self.J - (self.m * self.l) ** 2

    def replace(self, **kw) -> "PendulumParams":
        """返回替换若干字段后的新参数对象（用于模型失配实验）。"""
        return _dc_replace(self, **kw)

    def describe(self) -> str:
        return (f"M={self.M} kg, m={self.m} kg, L={self.L} m, l={self.l} m, "
                f"I={self.I:.6g} kg*m^2, J={self.J:.6g} kg*m^2, g={self.g}, "
                f"b={self.b}, c={self.c}, u_max={self.u_max} N, D0={self.D0:.6g}")


# ===========================================================================
# 2. 基础工具
# ===========================================================================
def wrap_pi(angle):
    """把角度折叠到 (-pi, pi]，支持标量与数组。"""
    a = np.asarray(angle, dtype=float)
    out = (a + np.pi) % (2.0 * np.pi) - np.pi
    # (a+pi) % 2pi 在 a = pi 时得到 0 -> -pi，教学上更希望是 +pi，这里做一次修正
    out = np.where(np.isclose(out, -np.pi), np.pi, out)
    return float(out) if np.isscalar(angle) or np.ndim(angle) == 0 else out


def saturate(u: float, u_max: float) -> float:
    """对称饱和限幅。"""
    if u > u_max:
        return u_max
    if u < -u_max:
        return -u_max
    return u


# ===========================================================================
# 3. 非线性动力学与积分器
# ===========================================================================
def dynamics(s, u: float, p: PendulumParams) -> np.ndarray:
    """非线性状态导数 ds/dt = f(s, u)。

    直接用 Cramer 法则解本文件头部给出的 2x2 方程组（比 np.linalg.solve 快很多，
    且完全等价），返回 np.array([x_dot, x_ddot, theta_dot, theta_ddot])。
    """
    xd = float(s[1])
    th = float(s[2])
    thd = float(s[3])

    m, M, g = p.m, p.M, p.g
    l = p.l
    st = math.sin(th)
    ct = math.cos(th)

    a11 = M + m                 # 质量阵左上
    a12 = m * l * ct            # 耦合项（对称）
    a22 = p.I + m * l * l       # = J，绕转轴转动惯量

    f1 = u - p.b * xd + m * l * st * thd * thd      # 右端第 1 行
    f2 = m * g * l * st - p.c * thd                 # 右端第 2 行

    Delta = a11 * a22 - a12 * a12                   # > 0
    xdd = (a22 * f1 - a12 * f2) / Delta
    thdd = (-a12 * f1 + a11 * f2) / Delta
    return np.array([xd, xdd, thd, thdd])


def rk4_step(s, u: float, p: PendulumParams, dt: float = DT_DEFAULT) -> np.ndarray:
    """定步长经典 4 阶 Runge-Kutta 单步推进（采样间隔内 u 恒定，即 ZOH）。"""
    s = np.asarray(s, dtype=float)
    k1 = dynamics(s, u, p)
    k2 = dynamics(s + 0.5 * dt * k1, u, p)
    k3 = dynamics(s + 0.5 * dt * k2, u, p)
    k4 = dynamics(s + dt * k3, u, p)
    return s + (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)


def mass_matrix(theta: float, p: PendulumParams) -> np.ndarray:
    """广义质量阵 M(theta)（用于把力冲量换算成速度跳变）。"""
    a12 = p.m * p.l * math.cos(theta)
    return np.array([[p.M + p.m, a12],
                     [a12, p.I + p.m * p.l ** 2]])


# ===========================================================================
# 4. 线性化、能量
# ===========================================================================
def linearize(p: PendulumParams):
    """在 theta = 0（直立）处线性化，返回 (A, B)。

    记 D0 = (M+m)*(I+m*l^2) - (m*l)^2，则

        A = [[0, 1,                 0,                0            ],
             [0, -(I+m*l^2)*b/D0,   -(m*l)^2*g/D0,    m*l*c/D0     ],
             [0, 0,                 0,                1            ],
             [0, m*l*b/D0,          (M+m)*m*g*l/D0,   -(M+m)*c/D0  ]]
        B = [[0], [(I+m*l^2)/D0], [0], [-m*l/D0]]

    注意 B[3] < 0：向右推小车会使摆杆向左倒（非最小相位式的直觉困难）。
    """
    M, m, g, b, c = p.M, p.m, p.g, p.b, p.c
    l, I = p.l, p.I
    ml = m * l
    J = I + m * l * l           # I + m*l^2
    D0 = (M + m) * J - ml ** 2

    A = np.array([
        [0.0, 1.0,             0.0,                    0.0],
        [0.0, -J * b / D0,     -(ml ** 2) * g / D0,    ml * c / D0],
        [0.0, 0.0,             0.0,                    1.0],
        [0.0, ml * b / D0,     (M + m) * m * g * l / D0, -(M + m) * c / D0],
    ])
    B = np.array([[0.0], [J / D0], [0.0], [-ml / D0]])
    return A, B


def energy(s, p: PendulumParams, ref: str = "upright") -> float:
    """系统**总机械能** E = T + V。

    T = 0.5*(M+m)*x_dot^2 + m*l*x_dot*theta_dot*cos(theta) + 0.5*(I+m*l^2)*theta_dot^2
    V = m*g*l*(cos(theta) - 1)     ref='upright'：以**直立静止**位置为势能零点（默认）
      = m*g*l*cos(theta)           ref='pivot'  ：以转轴水平面为势能零点

    默认取 'upright' 的好处：直立平衡点处 E = 0，下垂静止时 E = -2*m*g*l，
    既避免了"能量恰好为 0 导致相对误差无意义"的问题，也方便能量法摆起取 E_target = 0。
    """
    xd = float(s[1]); th = float(s[2]); thd = float(s[3])
    T = (0.5 * (p.M + p.m) * xd ** 2
         + p.m * p.l * xd * thd * math.cos(th)
         + 0.5 * (p.I + p.m * p.l ** 2) * thd ** 2)
    if ref == "upright":
        V = p.m * p.g * p.l * (math.cos(th) - 1.0)
    elif ref == "pivot":
        V = p.m * p.g * p.l * math.cos(th)
    else:
        raise ValueError("ref 只能是 'upright' 或 'pivot'")
    return T + V


def pendulum_energy(s, p: PendulumParams) -> float:
    """**摆杆自身**相对转轴的能量（能量法摆起用），以直立静止为零点：

        E_p = 0.5*(I+m*l^2)*theta_dot^2 + m*g*l*(cos(theta) - 1)

    下垂静止 E_p = -2*m*g*l；直立静止 E_p = 0。
    不含小车动能 —— 因为摆起阶段我们只关心"把杆的能量泵到直立所需值"，
    小车速度由另一项（回中项）单独管理。
    """
    th = float(s[2]); thd = float(s[3])
    return (0.5 * (p.I + p.m * p.l ** 2) * thd ** 2
            + p.m * p.g * p.l * (math.cos(th) - 1.0))


# ===========================================================================
# 5. 自己实现的连续时间 LQR（Riccati 方程求解）
# ===========================================================================
def _as_2d(X, n: int) -> np.ndarray:
    X = np.atleast_2d(np.asarray(X, dtype=float))
    if X.shape != (n, n):
        raise ValueError(f"矩阵维数应为 ({n},{n})，实际 {X.shape}")
    return X


def care_residual(A, B, Q, R, P) -> float:
    """连续时间代数 Riccati 方程 (CARE) 残差的 Frobenius 范数：

        res = || A^T P + P A - P B R^{-1} B^T P + Q ||_F
    """
    A = np.asarray(A, float); B = np.asarray(B, float)
    Q = np.asarray(Q, float); P = np.asarray(P, float)
    R = np.atleast_2d(np.asarray(R, float))
    S = B @ np.linalg.solve(R, B.T)
    return float(np.linalg.norm(A.T @ P + P @ A - P @ S @ P + Q, "fro"))


def _lyap_kron(Ac: np.ndarray, W: np.ndarray) -> np.ndarray:
    """用 Kronecker 积展开求解 Lyapunov 方程  Ac^T P + P Ac = -W。

    按**行优先**（numpy 默认 C order）把 P 拉直成 vec(P)，则
        vec(X Y) = (X ⊗ I) vec(Y),      vec(Y Z) = (I ⊗ Z^T) vec(Y)
    于是  Ac^T P + P Ac  =>  [ (Ac^T ⊗ I) + (I ⊗ Ac^T) ] vec(P)
    对 n = 4 就是一个 16x16 线性方程组，直接 np.linalg.solve 求解。
    Ac 稳定（谱在左半平面）时该方程有唯一解。
    """
    n = Ac.shape[0]
    In = np.eye(n)
    Mkr = np.kron(Ac.T, In) + np.kron(In, Ac.T)
    p = np.linalg.solve(Mkr, -W.reshape(-1))
    P = p.reshape(n, n)
    return 0.5 * (P + P.T)          # 强制对称，抵消舍入误差


def _care_value_iteration(A, B, Q, R, dtau: float = 2e-3, tau_max: float = 30.0):
    """第 1 步：Riccati **微分方程反向时间积分**（value iteration），得到粗解。

    有限时域 LQR 的 Riccati 微分方程为
        -dP/dt = A^T P + P A - P B R^{-1} B^T P + Q,   P(T) = P_f
    令 tau = T - t（反向时间），化为标准初值问题
        dP/dtau = A^T P + P A - P B R^{-1} B^T P + Q,  P(0) = 0
    tau -> ∞ 时 P 收敛到 CARE 的稳定化解。这里用 RK4 积分，
    一旦 K = R^{-1} B^T P 已经能稳定 A - B K 且残差足够小就提前退出
    （后续交给二次收敛的 Kleinman-Newton 迭代，无需在此浪费步数）。
    """
    Rinv = np.linalg.inv(R)
    S = B @ Rinv @ B.T
    P = np.zeros_like(Q)

    def f(P_):
        return A.T @ P_ + P_ @ A - P_ @ S @ P_ + Q

    n_steps = int(round(tau_max / dtau))
    scaleQ = 1.0 + np.linalg.norm(Q, "fro")
    for k in range(1, n_steps + 1):
        k1 = f(P)
        k2 = f(P + 0.5 * dtau * k1)
        k3 = f(P + 0.5 * dtau * k2)
        k4 = f(P + dtau * k3)
        P = P + (dtau / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4)
        P = 0.5 * (P + P.T)
        if k % 25 == 0:                                  # 每 25 步检查一次
            eigs = np.linalg.eigvals(A - B @ (Rinv @ B.T @ P))
            drift = np.linalg.norm(f(P), "fro") / scaleQ
            if eigs.real.max() < -1e-9 and drift < 1e-3:
                return P, k * dtau
    return P, n_steps * dtau


def lqr(A, B, Q, R, *, return_info: bool = False, verify: bool = True,
        assert_residual: bool = True):
    """连续时间 LQR：最小化 J = ∫ (s^T Q s + u^T R u) dt，返回 (K, P, eigs)。

    **不直接依赖** scipy.linalg.solve_continuous_are，自己两步求解 CARE：
      第 1 步 value iteration：Riccati 微分方程反向时间积分，得到"稳定化"的粗解；
      第 2 步 Kleinman-Newton 迭代（二次收敛）：
              K_k = R^{-1} B^T P_k
              A_c = A - B K_k
              解 Lyapunov 方程  A_c^T P_{k+1} + P_{k+1} A_c = -(Q + K_k^T R K_k)
          （Lyapunov 方程用 Kronecker 积展开成 16x16 线性方程组求解，见 _lyap_kron）
    收敛后断言 CARE 残差范数 < 1e-8；若装有 scipy，则与
    scipy.linalg.solve_continuous_are 的解交叉校验（相对误差 1e-6）。

    参数
    ----
    return_info : True 时额外返回 info 字典（含残差、迭代次数、scipy 校验误差）
    verify      : 是否做 scipy 交叉校验（无 scipy 时自动跳过）
    """
    A = np.asarray(A, float)
    B = np.asarray(B, float)
    if B.ndim == 1:
        B = B.reshape(-1, 1)
    n = A.shape[0]
    Q = _as_2d(Q, n)
    R = np.atleast_2d(np.asarray(R, float))

    # ---- 第 1 步：值迭代（Riccati 微分方程反向积分）----------------------
    P, tau_used = _care_value_iteration(A, B, Q, R)

    Rinv = np.linalg.inv(R)
    # ---- 第 2 步：Kleinman-Newton 迭代 ---------------------------------
    n_newton = 0
    for n_newton in range(1, 51):
        K = Rinv @ B.T @ P
        Ac = A - B @ K
        if np.linalg.eigvals(Ac).real.max() >= 0.0:
            raise RuntimeError("Kleinman 迭代要求初始增益稳定化闭环，值迭代未收敛，"
                               "请增大 tau_max 或检查 (A,B) 是否可稳。")
        W = Q + K.T @ R @ K
        P_new = _lyap_kron(Ac, W)
        step = np.linalg.norm(P_new - P, "fro")
        P = P_new
        if step <= 1e-13 * (1.0 + np.linalg.norm(P, "fro")):
            break

    K = Rinv @ B.T @ P
    eigs = np.linalg.eigvals(A - B @ K)

    res = care_residual(A, B, Q, R, P)
    res_scaled = res / (1.0 + np.linalg.norm(P, "fro"))
    if assert_residual:
        # 绝对残差与 ||P|| 成比例增长，故容差随 ||P|| 放大（默认参数下 res ~ 1e-12）
        tol = 1e-8 * max(1.0, np.linalg.norm(P, "fro"))
        assert res < tol, f"Riccati 残差过大: {res:.3e} >= {tol:.3e}"

    err_scipy = float("nan")
    if verify and HAS_SCIPY:
        P_sp = _sla.solve_continuous_are(A, B, Q, R)
        err_scipy = float(np.linalg.norm(P - P_sp, "fro")
                          / max(1.0, np.linalg.norm(P_sp, "fro")))
        assert err_scipy < 1e-6, f"与 scipy.solve_continuous_are 不一致: {err_scipy:.3e}"

    if return_info:
        info = {
            "residual": res,                # CARE 残差 Frobenius 范数
            "residual_scaled": res_scaled,  # 归一化残差 res/(1+||P||)
            "newton_iters": n_newton,
            "vi_tau": tau_used,             # 值迭代所用的反向时间长度
            "err_scipy": err_scipy,         # 与 scipy 的相对误差（无 scipy 为 nan）
            "P_norm": float(np.linalg.norm(P, "fro")),
        }
        return K, P, eigs, info
    return K, P, eigs


# ===========================================================================
# 6. 可控性
# ===========================================================================
def ctrb(A, B):
    """可控性矩阵 C = [B, AB, A^2 B, ..., A^(n-1) B]，返回 (C, rank, cond)。

    rank == n 即状态完全可控；cond 很大说明"数值上接近不可控"（某些方向很难控）。
    """
    A = np.asarray(A, float)
    B = np.asarray(B, float)
    if B.ndim == 1:
        B = B.reshape(-1, 1)
    n = A.shape[0]
    cols = [B]
    for _ in range(1, n):
        cols.append(A @ cols[-1])
    C = np.hstack(cols)
    rank = int(np.linalg.matrix_rank(C, tol=1e-10))
    sv = np.linalg.svd(C, compute_uv=False)
    cond = float(sv[0] / sv[-1]) if sv[-1] > 0 else float("inf")
    return C, rank, cond


def is_controllable(A, B) -> bool:
    """可控性判定：可控性矩阵是否满秩。"""
    _, rank, _ = ctrb(A, B)
    return rank == np.asarray(A).shape[0]


def tf_zeros(A, B, C):
    """SISO 传递函数 C(sI-A)^{-1}B 的零点（纯 numpy，不需要 scipy/control）。

    用矩阵行列式引理：对 SISO 有
        det(sI - A + B C) = det(sI - A) * (1 + C (sI-A)^{-1} B)
    于是分子多项式  num(s) = det(sI - A + B C) - det(sI - A)（次数 <= n-1），
    两个特征多项式相减即得，再求根就是零点。

    教学用途（本项目的两个关键结论）：
      * u -> theta 通道：零点只有 s = 0，且"小车匀速漂移"模态被零极点对消，
        所以单环角度 PID 根本看不见小车往哪走（见 demos.py 的 pid demo）；
      * u -> x 通道：存在**右半平面零点** z ≈ +sqrt(m*g*l/J) = sqrt(3g/(2L))，
        典型的非最小相位特征 —— 想让小车往右走必须先往左动一下。
    """
    A = np.asarray(A, float)
    B = np.asarray(B, float).reshape(-1, 1)
    C = np.asarray(C, float).reshape(1, -1)
    num = np.poly(A - B @ C) - np.poly(A)
    # 两个首一多项式相减，最高次项理论上恰好抵消，但浮点相减会留下 ~1e-16 的残渣；
    # 若不按相对容差剔除，np.roots 会给出 ~1e15 这样的虚假零点。
    scale = float(np.max(np.abs(num))) if num.size else 0.0
    tol = 1e-9 * max(scale, 1.0)
    while num.size and abs(num[0]) <= tol:
        num = num[1:]
    if num.size <= 1:
        return np.array([])                     # 没有有限零点
    return np.roots(num)


# ===========================================================================
# 7. 矩阵指数与 ZOH 离散化（采样周期分析用；纯 numpy 实现，不依赖 scipy）
# ===========================================================================
def expm(Mat) -> np.ndarray:
    """矩阵指数 exp(Mat)：缩放-平方 + Taylor 级数（scaling & squaring）。

    先取 k 使 ||Mat/2^k||_inf < 0.5，对缩放后的矩阵用 20 项 Taylor 级数
    （此时收敛极快，截断误差 ~1e-19），再平方 k 次还原。
    """
    Mat = np.asarray(Mat, float)
    nrm = np.abs(Mat).sum(axis=1).max()          # 无穷范数
    k = 0
    while nrm > 0.5:
        nrm /= 2.0
        k += 1
    Ms = Mat / (2.0 ** k)
    E = np.eye(Mat.shape[0])
    term = np.eye(Mat.shape[0])
    for i in range(1, 21):
        term = term @ Ms / i
        E = E + term
    for _ in range(k):
        E = E @ E
    return E


def c2d_zoh(A, B, Ts: float):
    """连续系统 (A, B) 在零阶保持下的精确离散化，返回 (Ad, Bd)。

    利用分块矩阵指数技巧（A 允许奇异，本系统 A 就有一个零特征值）：
        expm([[A, B], [0, 0]] * Ts) = [[Ad, Bd], [0, I]]
    """
    A = np.asarray(A, float)
    B = np.asarray(B, float)
    if B.ndim == 1:
        B = B.reshape(-1, 1)
    n, mm = A.shape[0], B.shape[1]
    Big = np.zeros((n + mm, n + mm))
    Big[:n, :n] = A
    Big[:n, n:] = B
    E = expm(Big * Ts)
    return E[:n, :n], E[:n, n:]


# ===========================================================================
# 8. 控制器
# ===========================================================================
class Controller:
    """控制器基类：所有控制器都提供 reset() 与 __call__(s, t) -> u。

    参考轨迹通过 set_reference(fn) 注入，fn(t) 返回长度 4 的参考状态
    s_ref = [x_ref, x_dot_ref, theta_ref, theta_dot_ref]；simulate() 会自动调用。
    """

    name = "controller"

    def __init__(self, p: PendulumParams, Ts: float = TS_DEFAULT):
        self.p = p
        self.Ts = Ts
        self.ref_fn = None
        self.u_max = p.u_max

    # -- 参考轨迹 --------------------------------------------------------
    def set_reference(self, fn):
        self.ref_fn = fn
        return self

    def s_ref(self, t: float) -> np.ndarray:
        if self.ref_fn is None:
            return np.zeros(4)
        return np.asarray(self.ref_fn(t), dtype=float).reshape(4)

    # -- 接口 ------------------------------------------------------------
    def reset(self):
        raise NotImplementedError

    def __call__(self, s, t: float) -> float:
        raise NotImplementedError


class _PIDCore:
    """离散 PID 内核（带微分低通滤波 + 抗积分饱和）。

    误差定义、限幅由外层控制器决定；本内核只做数值运算。
    * 微分项：先差分再一阶低通（时间常数 tau_d），避免噪声被放大 Kd/Ts 倍；
      并支持"**微分作用于测量值**"（derivative-on-measurement）——串级结构中必须如此：
      若微分作用于误差 e = theta - theta_ref，而 theta_ref 由外环快速变化，
      就会产生 -kd * d(theta_ref)/dt 项，它与 x_ddot 成正比、进而与 u 成正比，
      形成增益 > 1 的**代数正反馈回路**，直接把串级回路搞崩（本项目实测会发散）。
    * 抗积分饱和 anti-windup：
        'cond'     条件积分（clamping）：饱和且误差还在把输出往饱和方向推时停止积分；
        'backcalc' 反计算（back-calculation / tracking）：按 (u_sat - u_unsat)/Tt 回灌积分器。
    """

    def __init__(self, kp, ki, kd, Ts, tau_d=0.02, aw="backcalc", Tt=None):
        self.kp, self.ki, self.kd = float(kp), float(ki), float(kd)
        self.Ts = float(Ts)
        self.tau_d = float(tau_d)
        self.aw = aw
        # 反计算时间常数：经典取值 Tt = sqrt(Ti*Td)，此处给一个稳妥默认
        self.Tt = float(Tt) if Tt is not None else max(4.0 * Ts, 0.05)
        self.reset()

    def reset(self):
        self.integ = 0.0     # 积分项（已乘 ki，单位与输出相同）
        self.e_prev = None
        self.d_prev = None
        self.d_filt = 0.0

    def step(self, e: float, lo: float, hi: float, d_source: float = None):
        """输入误差 e 与输出限幅 [lo, hi]，返回 (u_sat, u_unsat)。

        d_source 为 None 时微分作用于误差 e；否则微分作用于 d_source（测量值）。
        """
        Ts = self.Ts
        # --- 微分（差分 + 一阶低通）---
        src = e if d_source is None else float(d_source)
        if self.d_prev is None:
            de = 0.0
        else:
            de = (src - self.d_prev) / Ts
        alpha = math.exp(-Ts / self.tau_d) if self.tau_d > 0 else 0.0
        self.d_filt = alpha * self.d_filt + (1.0 - alpha) * de
        self.d_prev = src
        self.e_prev = e

        u_unsat = self.kp * e + self.integ + self.kd * self.d_filt
        u_sat = min(hi, max(lo, u_unsat))

        # --- 积分 + 抗饱和 ---
        if self.aw == "cond":
            saturated = (u_unsat > hi) or (u_unsat < lo)
            pushing_out = saturated and (u_unsat * e > 0.0)
            if not pushing_out:
                self.integ += self.ki * e * Ts
        else:  # 'backcalc'
            self.integ += self.ki * e * Ts + (u_sat - u_unsat) * Ts / self.Tt
        return u_sat, u_unsat


class PID(Controller):
    """**单环** PID：只反馈摆角 theta（不看小车位置）。

    误差取 e = theta - theta_ref（**注意不是 ref - meas**）：因为 B[3] < 0
    （向右推小车、摆杆向左倒），取 e = theta - theta_ref 后正增益即为负反馈方向。

    教学结论：单环 PID 能把 theta 稳到 0，但小车位置 x 是**不受调节**的
    （闭环仍保留 A 的 s = 0 极点），受扰后小车会漂到任意位置且不返回。
    另外可以证明纯 PD 无法稳定：u->theta 的传递函数为 -k*s/(三次多项式)，
    该三次多项式常数项为负，仅靠 PD 无法让全部系数同号，**必须有积分项**。
    """

    name = "PID"

    def __init__(self, p: PendulumParams, kp=60.0, ki=40.0, kd=8.0,
                 Ts=TS_DEFAULT, tau_d=0.02, aw="backcalc"):
        super().__init__(p, Ts)
        self.core = _PIDCore(kp, ki, kd, Ts, tau_d, aw)
        self.gains = (kp, ki, kd)

    def reset(self):
        self.core.reset()

    def __call__(self, s, t: float) -> float:
        theta_ref = self.s_ref(t)[2]
        e = wrap_pi(float(s[2]) - theta_ref)
        u, _ = self.core.step(e, -self.u_max, self.u_max, d_source=float(s[2]))
        return u


class CascadePID(Controller):
    """**串级** PID：外环控小车位置 -> 生成角度给定 theta_ref -> 内环控角度。

    外环（慢）：theta_ref = clip( kpx*(x_ref - x) - kdx*x_dot + I_x , ±theta_max )
        符号说明：准静态下 x_ddot ≈ g*tan(theta) ≈ g*theta，即"杆偏向 +x -> 小车向
        +x 加速"。所以想让小车往右走（x < x_ref），就要先要求杆往右偏 theta_ref > 0。
    内环（快）：e = theta - theta_ref，与单环 PID 相同的符号约定。

    外环带宽必须显著低于内环，否则两环互相打架（教学要点：时标分离）。
    """

    name = "CascadePID"

    def __init__(self, p: PendulumParams,
                 kp=70.0, ki=45.0, kd=14.0,                # 内环（角度）
                 kpx=0.15, kix=0.01, kdx=0.25,             # 外环（位置）
                 theta_max=0.20, Ts=TS_DEFAULT, tau_d=0.02,
                 tau_dx=0.06, aw="backcalc", outer_div=2):
        super().__init__(p, Ts)
        self.inner = _PIDCore(kp, ki, kd, Ts, tau_d, aw)
        # 外环只用 P、I 作用在位置误差上；D 作用直接用实测速度（见 __call__），
        # 避免对位置误差做二次差分放大噪声，也避免与速度阻尼项重复计入。
        self.outer = _PIDCore(kpx, kix, 0.0, Ts * outer_div, tau_dx, aw)
        self.theta_max = float(theta_max)
        self.outer_div = int(outer_div)
        self.kdx = float(kdx)
        self.gains_inner = (kp, ki, kd)
        self.gains_outer = (kpx, kix, kdx)
        self.reset()

    def reset(self):
        self.inner.reset()
        self.outer.reset()
        self._k = 0
        self.theta_ref = 0.0
        self.theta_ref_log = []       # [(t, theta_ref)]，供 demos 画"外环给内环的角度给定"

    def __call__(self, s, t: float) -> float:
        sr = self.s_ref(t)
        x_ref = sr[0]
        # --- 外环：每 outer_div 个采样周期更新一次（时标分离）---
        if self._k % self.outer_div == 0:
            ex = x_ref - float(s[0])
            # 外环 P+I（限幅到 ±theta_max，含抗饱和）
            tr, _ = self.outer.step(ex, -self.theta_max, self.theta_max)
            # 叠加速度阻尼项：用实测速度做 D 作用，比对 ex 二次差分更干净
            tr = tr - self.kdx * float(s[1])
            self.theta_ref = min(self.theta_max, max(-self.theta_max, tr))
        self._k += 1
        self.theta_ref_log.append((t, self.theta_ref))

        # --- 内环：角度跟踪（微分作用于测量 theta，见 _PIDCore 说明）---
        e = wrap_pi(float(s[2]) - self.theta_ref)
        u, _ = self.inner.step(e, -self.u_max, self.u_max, d_source=float(s[2]))
        return u


class LQRController(Controller):
    """LQR 状态反馈（可带参考位置跟踪）：u = -K (s - s_ref)，再限幅。"""

    name = "LQR"

    def __init__(self, p: PendulumParams, K=None, Q=None, R=None,
                 Ts=TS_DEFAULT, p_design: PendulumParams = None):
        super().__init__(p, Ts)
        p_des = p_design if p_design is not None else p
        if K is None:
            A, B = linearize(p_des)
            Q = DEFAULT_Q if Q is None else np.asarray(Q, float)
            R = DEFAULT_R if R is None else np.atleast_2d(np.asarray(R, float))
            K, P, eigs = lqr(A, B, Q, R)
            self.P, self.eigs = P, eigs
        self.K = np.asarray(K, float).reshape(1, 4)
        self.Q, self.R = Q, R

    def reset(self):
        pass                      # 纯静态反馈，无内部状态

    def __call__(self, s, t: float) -> float:
        e = np.asarray(s, float).reshape(4) - self.s_ref(t)
        e[2] = wrap_pi(e[2])      # 角度误差按最短路折叠
        u = float(-(self.K @ e)[0])
        return saturate(u, self.u_max)


class SwingUpController(Controller):
    """Åström-Furuta **能量法摆起** + 接近直立时切换到 LQR 接住。

    能量泵：以摆杆能量 E_p（pendulum_energy，直立静止为 0）为被控量，
        dE_p/dt = -c*theta_dot^2 - m*l*theta_dot*cos(theta)*x_ddot
    取
        u = k_E * (E_p - E_target) * theta_dot * cos(theta)      (E_target = 0)
    时（k_E > 0，欠能量时 E_p - E_target < 0），可得
        dE_p/dt ≈ +m*l*k_E/(M+m) * (theta_dot*cos(theta))^2 ≥ 0，
    即能量单调上升，直到 E_p -> 0（恰好够站起来）。再叠加一个小的小车回中项
        u += -k_x*x - k_xd*x_dot
    防止小车越跑越远。下垂静止（theta_dot = 0）时该律输出为 0，是个"卡死"平衡点，
    因此加一个起振踢动 u_kick 打破对称。

    切换逻辑（带滞环，避免在边界反复抖动）：
        优先用 **LQR 的代价函数（Lyapunov 函数）V(e) = e^T P e 估计吸引域**：
            摆起 -> LQR ：|wrap(theta)| < theta_sw 且 V(e) < V_switch
            LQR -> 摆起 ：|wrap(theta)| > theta_exit 或 V(e) > V_exit（滞环：V_exit > V_switch）
        若只给了 K 而没有 P，则退化为经典的双阈值判据 |theta| < theta_sw 且
        |theta_dot| < thetadot_sw。
    每次切换的时刻记录在 self.switch_times（元素为 (t, 'to_lqr'/'to_swing')）。
    """

    name = "SwingUp+LQR"

    def __init__(self, p: PendulumParams, K=None, P=None, Q=None, R=None,
                 k_E=6.0, k_x=1.2, k_xd=1.6, u_swing=None, E_margin=0.22,
                 theta_sw=0.60, thetadot_sw=1.0, theta_exit=0.95,
                 V_switch=5.0, V_exit=15.0, u_kick=1.0, Ts=TS_DEFAULT):
        super().__init__(p, Ts)
        if K is None:
            A, B = linearize(p)
            Q = DEFAULT_Q if Q is None else np.asarray(Q, float)
            R = DEFAULT_R if R is None else np.atleast_2d(np.asarray(R, float))
            K, P, eigs = lqr(A, B, Q, R)
        self.K = np.asarray(K, float).reshape(1, 4)
        self.P = None if P is None else np.asarray(P, float)
        self.k_E, self.k_x, self.k_xd = k_E, k_x, k_xd
        self.u_swing = float(u_swing) if u_swing is not None else p.u_max
        # 能量目标略高于直立能量（0 点）：摆杆上行途中要克服转轴摩擦与小车回中项做的负功，
        # 若严格取 E_target = 0，摆杆会稳定在一个"差一点翻不过去"的极限环上
        # （实测停在 |theta| ~ 0.65 rad 处往返）。E_target = E_margin*m*g*l 给一点富余量，
        # 让摆杆带着小角速度掠过直立点附近，由 LQR 在那一刻接住。
        self.E_margin = float(E_margin)
        self.E_target = self.E_margin * p.m * p.g * p.l
        self.theta_sw = theta_sw
        self.thetadot_sw = thetadot_sw
        self.theta_exit = theta_exit
        self.V_switch = V_switch
        self.V_exit = V_exit
        self.u_kick = u_kick
        self.reset()

    def reset(self):
        self.mode = "swing"          # 'swing' 或 'lqr'
        self.switch_times = []
        self.mode_log = []           # [(t, mode, E_p, V)]，供 demos 画能量曲线与模式带

    def V(self, e) -> float:
        """LQR 二次型代价函数 V(e) = e^T P e（吸引域估计用）。"""
        if self.P is None:
            return float("nan")
        e = np.asarray(e, float).reshape(4)
        return float(e @ self.P @ e)

    def __call__(self, s, t: float) -> float:
        s = np.asarray(s, float).reshape(4)
        th = wrap_pi(float(s[2]))
        thd = float(s[3])
        sr = self.s_ref(t)
        e = s - sr
        e[2] = wrap_pi(e[2])

        # ---------- 模式切换判据（带滞环）----------
        if self.P is not None:
            v = self.V(e)
            enter = (abs(th) < self.theta_sw) and (v < self.V_switch)
            leave = (abs(th) > self.theta_exit) or (v > self.V_exit)
        else:
            enter = (abs(th) < self.theta_sw) and (abs(thd) < self.thetadot_sw)
            leave = abs(th) > self.theta_exit
        if self.mode == "swing":
            if enter:
                self.mode = "lqr"
                self.switch_times.append((t, "to_lqr"))
        else:
            if leave:
                self.mode = "swing"
                self.switch_times.append((t, "to_swing"))

        # ---------- 分模式计算控制量 ----------
        self.mode_log.append((t, self.mode, pendulum_energy(s, self.p),
                              self.V(e) if self.P is not None else float("nan")))
        if self.mode == "lqr":
            u = float(-(self.K @ e)[0])
            return saturate(u, self.u_max)

        # 能量泵 + 小车回中
        E = pendulum_energy(s, self.p)           # 目标 E_target（略大于 0，见 __init__）
        u = self.k_E * (E - self.E_target) * thd * math.cos(th)
        u += -self.k_x * (float(s[0]) - sr[0]) - self.k_xd * float(s[1])
        # 起振：几乎静止且能量远低于目标时给一个小踢动，打破"下垂静止"这个卡死平衡点
        if abs(thd) < 0.05 and (E - self.E_target) < -0.05:
            u += self.u_kick * (1.0 if th >= 0.0 else -1.0)
        return saturate(u, min(self.u_swing, self.u_max))


# ===========================================================================
# 9. 参考轨迹
# ===========================================================================
def make_reference(kind: str = "zero", amp: float = 0.2, t0: float = 1.0,
                   period: float = 8.0):
    """构造参考轨迹函数 fn(t) -> [x_ref, 0, 0, 0]（只给小车位置参考）。

    kind: 'zero' 恒零 | 'step' t>=t0 后阶跃到 amp | 'square' 周期 period 的方波
    """
    if kind == "zero":
        def fn(t):
            return np.zeros(4)
    elif kind == "step":
        def fn(t):
            return np.array([amp if t >= t0 else 0.0, 0.0, 0.0, 0.0])
    elif kind == "square":
        def fn(t):
            if t < t0:
                return np.zeros(4)
            phase = ((t - t0) % period) / period
            return np.array([amp if phase < 0.5 else -amp, 0.0, 0.0, 0.0])
    else:
        raise ValueError("kind 只能是 'zero' / 'step' / 'square'")
    return fn


# ===========================================================================
# 10. 统一仿真入口
# ===========================================================================
def simulate(controller, s0, t_end: float, p: PendulumParams = None,
             dt: float = DT_DEFAULT, Ts: float = TS_DEFAULT,
             ref=None, disturbances=None, noise=None, quantize=None,
             delay_steps: int = 0, Q=None, R=None, seed: int = 0,
             p_true: PendulumParams = None) -> dict:
    """闭环仿真主循环（物理用 RK4 定步长，控制器按 Ts 以 ZOH 更新）。

    参数
    ----
    controller : Controller 实例，或任意 callable(s, t) -> u（也可传 None 表示 u=0）
    s0         : 初始状态 [x, x_dot, theta, theta_dot]
    t_end      : 仿真时长 (s)
    p          : 控制器设计所用参数（也是默认的真实参数）
    dt, Ts     : 物理步长与采样周期。会自动调整 dt 使 Ts/dt 为整数
                 （n_sub = round(Ts/dt)，dt <- Ts/n_sub），保证 ZOH 精确对齐
    ref        : 参考轨迹 callable(t) -> 长度 4 的数组；会注入控制器
    disturbances : 扰动列表，元素为字典
                 {'type':'impulse','t':2.0,'force':0.5}   # 对小车施加 0.5 N*s 水平冲量
                 {'type':'impulse','t':2.0,'torque':0.05} # 对摆杆施加角冲量 (N*m*s)
                 {'type':'force','t0':1.0,'t1':3.0,'F':1.5} # 持续风力 (N)，直接叠加到小车
                 冲量按广义动量跳变处理：M(theta) * [dx_dot, dtheta_dot]^T = [Jx, Jth]^T
    noise      : 测量高斯噪声标准差 {'x':1e-3,'theta':5e-4,'x_dot':0,'theta_dot':0}
    quantize   : 传感器量化步长 {'x':1e-3,'theta':2e-4}（先加噪声再量化）
    delay_steps: 控制延迟（**整数个采样周期**）
    Q, R       : 用于累积 LQR 代价 J = ∫ (e^T Q e + u^T R u) dt，e = s - s_ref
    seed       : 噪声随机种子
    p_true     : 真实物理参数（默认 = p）。与 p 不同即为**模型失配**实验

    返回
    ----
    dict: t, s, x, x_dot, theta, theta_dot, u, w, ref, J, J_hist,
          ts/ys/us（采样时刻、量测、指令）, switch_times, dt, Ts, ...
    时间序列约定：t[i] 是第 i 个物理步的**起点**，u[i] 是区间 [t[i], t[i]+dt) 内
    实际施加的控制量（阶梯后置），因此 plt.step(t, u, where='post') 画出的就是
    真实的 ZOH 波形；末点 u[N] 复制 u[N-1] 以便等长绘图。
    """
    p = PendulumParams() if p is None else p
    p_sim = p if p_true is None else p_true

    # --- 时间栅格：保证 Ts 是 dt 的整数倍 ---
    n_sub = max(1, int(round(Ts / dt)))
    dt = Ts / n_sub
    n_samples = int(math.ceil(t_end / Ts - 1e-12))
    N = n_samples * n_sub

    Qm = None if Q is None else np.asarray(Q, float)
    Rm = None if R is None else np.atleast_2d(np.asarray(R, float))

    # --- 控制器准备 ---
    if controller is None:
        ctrl = lambda s_, t_: 0.0                                    # noqa: E731
    else:
        ctrl = controller
    if hasattr(ctrl, "reset"):
        ctrl.reset()
    if hasattr(ctrl, "set_reference"):
        ctrl.set_reference(ref)
    ref_fn = ref if ref is not None else (lambda t: np.zeros(4))

    rng = np.random.default_rng(seed)
    noise = noise or {}
    quantize = quantize or {}
    disturbances = list(disturbances or [])
    impulses = [d for d in disturbances if d.get("type") == "impulse"]
    winds = [d for d in disturbances if d.get("type") == "force"]

    # 控制延迟队列：长度 delay_steps+1，队首即"delay_steps 个采样周期之前"的指令
    uq = deque([0.0] * (delay_steps + 1), maxlen=delay_steps + 1)

    s = np.asarray(s0, float).reshape(4).copy()
    t = 0.0
    J = 0.0

    t_hist = np.empty(N + 1)
    s_hist = np.empty((N + 1, 4))
    u_hist = np.empty(N + 1)
    w_hist = np.empty(N + 1)
    r_hist = np.empty((N + 1, 4))
    J_hist = np.empty(N + 1)
    ts_hist = np.empty(n_samples)
    ys_hist = np.empty((n_samples, 4))
    us_hist = np.empty(n_samples)

    idx = 0
    for k in range(n_samples):
        # ---------------- 采样与控制（ZOH）----------------
        y = s.copy()
        for i, key in enumerate(("x", "x_dot", "theta", "theta_dot")):
            sd = float(noise.get(key, 0.0))
            if sd > 0.0:
                y[i] += rng.normal(0.0, sd)
        for i, key in enumerate(("x", "x_dot", "theta", "theta_dot")):
            lsb = float(quantize.get(key, 0.0))
            if lsb > 0.0:
                y[i] = round(y[i] / lsb) * lsb
        u_cmd = float(ctrl(y, t))
        u_cmd = saturate(u_cmd, p.u_max)
        uq.append(u_cmd)
        u_app = uq[0]                      # 经过 delay_steps 个采样周期的滞后

        ts_hist[k] = t
        ys_hist[k] = y
        us_hist[k] = u_cmd

        # ---------------- 采样间隔内的物理积分 ----------------
        for j in range(n_sub):
            # 冲量扰动：落在 [t, t+dt) 内则先做速度跳变（广义动量跳变）
            for d in impulses:
                td = float(d["t"])
                if t - 1e-12 <= td < t + dt - 1e-12:
                    Jx = float(d.get("force", 0.0))
                    Jth = float(d.get("torque", 0.0))
                    dv = np.linalg.solve(mass_matrix(s[2], p_sim),
                                         np.array([Jx, Jth]))
                    s[1] += dv[0]
                    s[3] += dv[1]
            # 持续风力（直接叠加到小车上的水平力，不经过控制饱和）
            w = 0.0
            for d in winds:
                if float(d.get("t0", -np.inf)) <= t < float(d.get("t1", np.inf)):
                    w += float(d.get("F", 0.0))

            # 记录区间**起点**：u[idx] 是 [t_idx, t_idx+dt) 内施加的控制量
            r_now = np.asarray(ref_fn(t), float).reshape(4)
            t_hist[idx] = t
            s_hist[idx] = s
            u_hist[idx] = u_app
            w_hist[idx] = w
            r_hist[idx] = r_now
            J_hist[idx] = J

            # 代价累积（用真实状态，矩形积分）
            if Qm is not None and Rm is not None:
                e = s - r_now
                e[2] = wrap_pi(e[2])
                J += float(e @ Qm @ e + Rm[0, 0] * u_app ** 2) * dt

            s = rk4_step(s, u_app + w, p_sim, dt)
            t += dt
            idx += 1

            if not np.all(np.isfinite(s)):     # 发散保护：截断并返回
                t_hist[idx] = t
                s_hist[idx] = s
                u_hist[idx] = u_app
                w_hist[idx] = w
                r_hist[idx] = r_now
                J_hist[idx] = J
                sl = slice(0, idx + 1)
                return _pack(t_hist[sl], s_hist[sl], u_hist[sl], w_hist[sl],
                             r_hist[sl], J_hist[sl], ts_hist[:k + 1],
                             ys_hist[:k + 1], us_hist[:k + 1], J, dt, Ts,
                             p, p_sim, ctrl, diverged=True)

    # 末点（u/w 沿用最后一个区间的值，便于 plt.step(..., where='post') 直接画）
    t_hist[N] = t
    s_hist[N] = s
    u_hist[N] = u_hist[N - 1]
    w_hist[N] = w_hist[N - 1]
    r_hist[N] = np.asarray(ref_fn(t), float).reshape(4)
    J_hist[N] = J

    return _pack(t_hist, s_hist, u_hist, w_hist, r_hist, J_hist,
                 ts_hist, ys_hist, us_hist, J, dt, Ts, p, p_sim, ctrl,
                 diverged=False)


def _pack(t, s, u, w, r, Jh, ts, ys, us, J, dt, Ts, p, p_sim, ctrl, diverged):
    """把仿真结果打包成字典（内部函数）。"""
    out = {
        "t": t, "s": s,
        "x": s[:, 0], "x_dot": s[:, 1], "theta": s[:, 2], "theta_dot": s[:, 3],
        "u": u, "w": w, "ref": r,
        "J": J, "J_hist": Jh,
        "ts": ts, "ys": ys, "us": us,
        "dt": dt, "Ts": Ts, "p": p, "p_true": p_sim,
        "diverged": bool(diverged),
        "switch_times": list(getattr(ctrl, "switch_times", [])),
        "controller": getattr(ctrl, "name", "callable"),
    }
    return out


# ===========================================================================
# 11. 性能指标
# ===========================================================================
def metrics(res: dict, theta_tol: float = 0.02, x_tol: float = 0.05,
            t_from: float = 0.0, t_to: float = None) -> dict:
    """从仿真结果计算定量指标（可用 t_from / t_to 只统计某个时间窗）。

    * max_abs_theta : 最大角偏 (rad)
    * max_abs_x     : 最大位置偏差 (m)
    * settle_theta  : 角度稳定时间 —— 此后 |theta| 始终 <= theta_tol
    * settle_both   : 角度与位置**同时**稳定的时间（|x - x_ref| <= x_tol）
    * u_energy      : 控制能量 ∫u^2 dt (N^2*s)
    * max_abs_u     : 峰值控制力 (N)
    * J             : 累积 LQR 代价（simulate 传入 Q、R 时有效；全时段）
    * diverged      : 是否发散
    """
    t = res["t"]
    dt = res["dt"]
    m0 = t >= t_from - 1e-12
    if t_to is not None:
        m0 = m0 & (t <= t_to + 1e-12)
    th = res["theta"][m0]
    x = res["x"][m0]
    xr = res["ref"][m0, 0]
    u = res["u"][m0]
    tt = t[m0]

    def _settle(mask_bad):
        """mask_bad: 各时刻是否"未达标"。返回最后一次未达标之后的时间。"""
        idx = np.nonzero(mask_bad)[0]
        if idx.size == 0:
            return 0.0
        if idx[-1] >= mask_bad.size - 1:
            return float("nan")            # 到仿真结束仍未稳定
        return float(tt[idx[-1] + 1] - tt[0])

    bad_th = np.abs(th) > theta_tol
    bad_x = np.abs(x - xr) > x_tol
    return {
        "max_abs_theta": float(np.max(np.abs(th))),
        "max_abs_x": float(np.max(np.abs(x - xr))),
        "settle_theta": _settle(bad_th),
        "settle_both": _settle(bad_th | bad_x),
        "u_energy": float(np.sum(u ** 2) * dt),
        "max_abs_u": float(np.max(np.abs(u))),
        "J": float(res.get("J", float("nan"))),
        "diverged": bool(res.get("diverged", False)),
    }


# ===========================================================================
# 12. 直接运行本文件时打印一份"参考数值"（供网页版交叉验证）
# ===========================================================================
def print_reference_numbers(p: PendulumParams = None, Q=None, R=None):
    """打印默认参数下的 A、B、K、闭环极点、P、可控性等参考数值。"""
    p = p or PendulumParams()
    Q = DEFAULT_Q if Q is None else Q
    R = DEFAULT_R if R is None else R
    A, B = linearize(p)
    C, rank, cond = ctrb(A, B)
    K, P, eigs, info = lqr(A, B, Q, R, return_info=True)

    np.set_printoptions(precision=6, suppress=False, linewidth=120)
    print("=" * 72)
    print("小车-倒立摆参考数值（pendulum.py）")
    print("=" * 72)
    print("参数:", p.describe())
    print("\nA =\n", A)
    print("\nB^T =", B.ravel())
    print("\n开环极点 =", np.sort_complex(np.linalg.eigvals(A)))
    print("可控性矩阵秩 =", rank, " 条件数 = %.4g" % cond)
    print("u -> x     通道零点 =", np.sort_complex(tf_zeros(A, B, [1, 0, 0, 0])),
          " (含右半平面零点 -> 非最小相位)")
    print("u -> theta 通道零点 =", np.sort_complex(tf_zeros(A, B, [0, 0, 1, 0])),
          " (原点双重零点)")
    print("\nQ = diag(%s)   R = %s" % (np.diag(Q), R.ravel() if hasattr(R, "ravel") else R))
    print("LQR 增益 K =", K.ravel())
    print("闭环极点 =", np.sort_complex(eigs))
    print("Riccati 解 P =\n", P)
    print("\nCARE 残差 ||.||_F = %.3e   归一化残差 = %.3e" %
          (info["residual"], info["residual_scaled"]))
    print("Newton 迭代次数 = %d   值迭代反向时间 = %.3f s" %
          (info["newton_iters"], info["vi_tau"]))
    if HAS_SCIPY:
        print("与 scipy.solve_continuous_are 的相对误差 = %.3e" % info["err_scipy"])
    else:
        print("未安装 scipy，跳过交叉校验")
    print("=" * 72)


if __name__ == "__main__":
    print_reference_numbers()
