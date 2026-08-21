import numpy as np
from scipy.special import wofz

# ---------- 1. 设计点自洽校核 ----------
P=1500e6           # W thermal
Tin,Tout=395.,545.
cp=1270.           # J/kg/K @ ~470C
w=P/(cp*(Tout-Tin))
print(f"[1] 一回路总流量 = {w:8.1f} kg/s   ({w/3:.1f} kg/s/泵)")
rho=850.
print(f"    体积流量 = {w/rho:6.2f} m3/s ({w/rho/3*1000:.0f} L/s per pump)")
NA,NP=252,217
pins=NA*NP; H=0.95
print(f"[2] 燃料棒数 = {pins}, 平均线功率 = {P/(pins*H)/1000:6.2f} kW/m, 峰值(1.38) = {P/(pins*H)/1000*1.38:5.1f} kW/m")
dp=0.735; Apel=np.pi/4*dp**2   # cm2
Vf=Apel*H*100*pins             # cm3
mMOX=Vf*11.05*0.95/1e6         # tonnes
mHM=mMOX*0.8815
print(f"[3] MOX 装量 = {mMOX:6.2f} t, 重金属 = {mHM:6.2f} tHM, 比功率 = {P/1e6/mHM:6.2f} MW/tHM")
print(f"    3循环x300EFPD 平均卸料燃耗 = {P/1e6/mHM*0.9:6.1f} GWd/tHM ; 峰值(1.5) = {P/1e6/mHM*0.9*1.5:5.0f}")
a=0.145; Ahex=np.sqrt(3)/2*a**2
Apin=NP*np.pi/4*0.0085**2; Awire=NP*np.pi/4*0.0012**2*1.05
Af=Ahex-Apin-Awire
print(f"[4] 组件流通面积 = {Af*1e4:6.2f} cm2, 堆芯 = {Af*NA:6.4f} m2")
G=w/(Af*NA); print(f"    质量流密度 = {G:6.0f} kg/m2s, 流速 = {G/rho:5.2f} m/s")
wa=w/NA; print(f"    单盒流量 {wa:5.2f} kg/s -> dT = {P/NA/(wa*cp):6.1f} K")
Vcore=Af*0+NA*Ahex*H
print(f"[5] 堆芯体积(组件外廓) = {Vcore:5.2f} m3 -> 功率密度 = {P/1e6/Vcore:6.1f} MW/m3")
# 二回路
T2i,T2o=320.,505.; cp2=1283.
w2=P/(cp2*(T2o-T2i)); print(f"[6] 二回路总流量 = {w2:8.1f} kg/s ({w2/3:.0f}/环路)")
print(f"[7] 蒸汽流量 = {P/2.28e6:6.1f} kg/s (dh=2280 kJ/kg)")
# 换料几何
p=0.155
for n in [9,10,11,12,13,14]:
    print(f"    ring {n:2d}: 角向半径 = {n*p:5.3f} m, 总位置数 = {1+3*n*(n+1)}")
e=1.12; print(f"[8] 双旋塞偏心 e1=e2={e} m -> 可达半径 0 ~ {2*e:4.2f} m")

# ---------- 2. Doppler / SLBW 参考解 ----------
# U-238 s波共振 (E0 eV, Gn meV, Gg meV)
RES=[(6.674,1.476,22.9),(20.871,10.09,22.9),(36.682,34.13,22.6),(66.03,24.6,25.6),
     (80.749,1.865,22.6),(102.56,71.7,22.3),(116.902,25.5,22.6),(145.66,0.85,22.6),
     (165.29,3.30,22.6),(189.67,175.0,22.9),(208.46,51.0,22.6),(237.38,25.9,22.6),
     (273.66,23.0,22.6),(291.0,17.0,22.6),(311.3,1.60,22.6),(347.8,63.0,22.6),
     (376.9,6.0,22.6),(397.7,6.4,22.6),(410.2,17.0,22.6),(434.4,1.4,22.6)]
A=238.05; k=8.617333e-5   # eV/K
sig_pot=10.6              # b 势散射
def psi_chi(xi,x):
    z=0.5*xi*(x+1j)
    W=wofz(z)
    psi=0.5*xi*np.sqrt(np.pi)*W.real
    chi=xi*np.sqrt(np.pi)*W.imag
    return psi,chi
def xs(E,T):
    sg=np.zeros_like(E); ss=np.full_like(E,sig_pot)
    for E0,Gn_,Gg_ in RES:
        Gn=Gn_*1e-3*np.sqrt(E/E0); Gg=Gg_*1e-3; G=Gn+Gg
        s0=2.608e6*((A+1)/A)**2*(Gn/(G*E0))       # b  (g=1)
        D=np.sqrt(4*E0*k*T/A); xi=G/D
        x=2*(E-E0)/G
        ps,ch=psi_chi(xi,x)
        sg+=s0*(Gg/G)*np.sqrt(E0/E)*ps
        ss+=s0*(Gn/G)*ps   # 势散射-共振干涉项忽略(对俘获自屏影响<1%)
    return sg,ss
# 能量网格: 每共振局部细网 + 全局对数网
grid=[np.geomspace(1.,1000.,4000)]
for E0,Gn_,Gg_ in RES:
    G=(Gn_+Gg_)*1e-3
    D=np.sqrt(4*E0*k*2100/A)
    wid=max(G,D)*60
    grid.append(np.linspace(max(0.5,E0-wid),E0+wid,1600))
E=np.unique(np.concatenate(grid)); E=E[(E>1.)&(E<1000.)]
print(f"\n[9] 网格点数 = {E.size}")
print(f"{'T[K]':>6} {'peak6.67[b]':>12} {'RI_inf[b]':>10} {'Ieff sb=20':>11} {'Ieff sb=50':>11} {'Ieff sb=200':>12}")
base={}
for T in [300,600,900,1200,1500,1800,2100]:
    sg,ss=xs(E,T); st=sg+ss
    RIinf=np.trapezoid(sg/E,E)
    row=[]
    for sb in [20.,50.,200.]:
        row.append(np.trapezoid(sg*sb/(sb+st)/E,E))
    i=np.argmin(abs(E-6.674)); pk=sg[max(0,i-300):i+300].max()
    base[T]=row
    print(f"{T:6d} {pk:12.0f} {RIinf:10.2f} {row[0]:11.4f} {row[1]:11.4f} {row[2]:12.4f}")
print("\n[10] 自屏共振积分相对 300K 的增幅 (%) 与 ln(T/300) 拟合:")
for sbi,sb in enumerate([20,50,200]):
    r=[(base[T][sbi]/base[300][sbi]-1)*100 for T in [600,900,1200,1500,1800,2100]]
    lt=np.log(np.array([600,900,1200,1500,1800,2100])/300.)
    slope=np.polyfit(lt,r,1)[0]
    print(f"   sb={sb:4d} b : "+" ".join(f"{v:6.2f}" for v in r)+f"   | d(Ieff)/dlnT = {slope:5.2f} %/ln")
