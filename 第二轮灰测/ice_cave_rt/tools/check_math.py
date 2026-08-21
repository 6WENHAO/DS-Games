#!/usr/bin/env python3
"""Numerical verification of the phase-function math used in ice_cave.wgsl.

Checks, with no scipy dependency:
  1. the Abramowitz & Stegun J1 approximation against the integral definition
     J1(x) = (1/pi) * int_0^pi cos(theta - x sin theta) dtheta
  2. that the Airy (corona/glory) lobe integrates to ~1 over the sphere
  3. that the 22 degree halo ring lobe integrates to ~1 over the sphere
  4. that the Henyey-Greenstein lobe integrates to 1 and has mean cosine g
  5. that the 4-lobe mixture pdf used for sampling integrates to 1

usage: python tools/check_math.py
"""
import numpy as np

PI = np.pi


# ---------------------------------------------------------------- reference J1
def j1_ref(x):
    t = np.linspace(0.0, PI, 200001)
    return np.trapezoid(np.cos(t - x * np.sin(t)), t) / PI


# ------------------------------------------- the exact code from the WGSL file
def j1_wgsl(xin):
    ax = abs(xin)
    if ax < 3.0:
        y = (xin / 3.0) ** 2
        return xin * (0.5 + y * (-0.56249985 + y * (0.21093573 + y * (-0.03954289
                      + y * (0.00443319 + y * (-0.00031761 + y * 0.00001109))))))
    z = 3.0 / ax
    f1 = 0.79788456 + z * (0.00000156 + z * (0.01659667 + z * (0.00017105
         + z * (-0.00249511 + z * (0.00113653 - z * 0.00020033)))))
    th = ax - 2.35619449 + z * (0.12499612 + z * (0.00005650 + z * (-0.00637879
         + z * (0.00074348 + z * (0.00079824 - z * 0.00029166)))))
    r = f1 * np.cos(th) / np.sqrt(ax)
    return r if xin > 0.0 else -r


def airy_lobe(sin_t, x):
    u = max(x * sin_t, 1.0e-4)
    a = 2.0 * j1_wgsl(u) / u
    return a * a * x * x / (4.0 * PI)


def halo_ring(theta, th0, sig):
    d = (theta - th0) / sig
    return np.exp(-d * d) / (2.0 * PI * max(np.sin(theta), 1.0e-3) * sig * 1.7724539)


def hg(ct, g):
    d = max(1.0 + g * g - 2.0 * g * ct, 1e-6)
    return (1.0 - g * g) / (4.0 * PI * d * np.sqrt(d))


def sphere_integral(f, n=400001):
    """integrate f(theta) over the sphere assuming azimuthal symmetry"""
    th = np.linspace(0.0, PI, n)
    vals = np.array([f(t) for t in th])
    return np.trapezoid(vals * 2.0 * PI * np.sin(th), th)


def main():
    ok = True

    print("1) J1 approximation vs integral definition")
    worst = 0.0
    for x in [0.001, 0.05, 0.5, 1.0, 2.0, 2.999, 3.0, 3.8317, 5.0, 7.0156, 10.0, 20.0, 55.0]:
        a, b = j1_wgsl(x), j1_ref(x)
        err = abs(a - b)
        worst = max(worst, err)
        print(f"   x={x:>8.4f}   wgsl={a:+.8f}   ref={b:+.8f}   |err|={err:.2e}")
    print(f"   worst |err| = {worst:.2e}  ({'OK' if worst < 2e-7 else 'FAIL'})")
    ok &= worst < 2e-7

    print("\n2) Airy lobe normalisation (should be ~1; small-angle approximation)")
    for x in [20.0, 40.0, 55.0, 80.0, 160.0]:
        tot = sphere_integral(lambda t: airy_lobe(np.sin(t), x) if np.cos(t) > 0 else 0.0, 200001)
        print(f"   x={x:>6.1f}   forward-hemisphere integral = {tot:.4f}")
        ok &= 0.80 < tot < 1.20

    print("\n3) 22 degree halo ring normalisation (per channel)")
    for th0, sig, name in [(0.3752, 0.028, "red"), (0.3840, 0.030, "green"), (0.3944, 0.032, "blue")]:
        tot = sphere_integral(lambda t: halo_ring(t, th0, sig))
        print(f"   {name:<6} theta0={np.degrees(th0):.2f}deg  integral = {tot:.5f}")
        ok &= 0.98 < tot < 1.02

    print("\n4) Henyey-Greenstein normalisation and mean cosine")
    for g in [0.0, 0.5, 0.62, 0.82, 0.95, -0.90]:
        tot = sphere_integral(lambda t: hg(np.cos(t), g))
        mean = sphere_integral(lambda t: hg(np.cos(t), g) * np.cos(t))
        print(f"   g={g:+.2f}   integral = {tot:.5f}   <cos> = {mean:+.4f}")
        ok &= abs(tot - 1.0) < 0.02 and abs(mean - g) < 0.02

    print("\n5) 4-lobe sampling mixture pdf (wb*HG(g) + wc*HG(0.95) + wg*HG(-0.9) + wh*Ring)")
    wc, wgl, wh, g = 0.06, 0.05, 0.05, 0.50
    wb = 1.0 - wc - wgl - wh

    def mix(t):
        ct = np.cos(t)
        return (wb * hg(ct, g) + wc * hg(ct, 0.95) + wgl * hg(ct, -0.90)
                + wh * halo_ring(t, 0.3840, 0.030))

    tot = sphere_integral(mix)
    print(f"   integral = {tot:.5f}   ({'OK' if abs(tot - 1) < 0.02 else 'FAIL'})")
    ok &= abs(tot - 1.0) < 0.02

    print("\n6) full phase function energy (evaluation side, green channel)")

    def phase_green(t):
        ct = np.cos(t)
        v = wb * hg(ct, g)
        if ct > 0.0:
            v += wc * airy_lobe(np.sin(t), 55.0 * 0.876)
        else:
            v += wgl * airy_lobe(np.sin(t), 55.0 * 0.30 * 0.876)
        v += wh * halo_ring(t, 0.3840, 0.030)
        return v

    tot = sphere_integral(phase_green, 200001)
    print(f"   integral = {tot:.4f}  (energy conserving to within the Airy small-angle error)")
    ok &= 0.9 < tot < 1.1

    print("\nRESULT:", "ALL CHECKS PASSED" if ok else "SOME CHECKS FAILED")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
