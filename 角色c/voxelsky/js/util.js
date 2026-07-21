export function mulberry32(seed){
  let a=seed>>>0;
  return function(){
    a|=0;a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return((t^t>>>14)>>>0)/4294967296;
  };
}
export function hashStr(s){
  let h=2166136261;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return h>>>0;
}
export const clamp=(v,a,b)=>v<a?a:v>b?b:v;
export const lerp=(a,b,t)=>a+(b-a)*t;
export const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export const pick=(rng,arr)=>arr[Math.floor(rng()*arr.length)];
export const randRange=(rng,a,b)=>a+rng()*(b-a);
export const fmt=n=>Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,",");
export const dist2d=(x1,z1,x2,z2)=>Math.hypot(x1-x2,z1-z2);

const SYL_A=["Xo","Ta","Ri","Ven","Ka","Us","Ne","Phi","Dra","Om","El","Ar","Ozo","Ily","Ura","Ket","Vor","San","Qua","Yll","Nov","Tes","Hel","Ain"];
const SYL_B=["ri","ma","tan","dor","vek","lia","nus","phi","gor","sha","len","dium","kar","toth","une","bia","ros","mir","xel","ova"];
const SYL_C=["Prime","Major","Minor","IX","VII","XI","V","III","Alpha","Beta","Sigma","Omega"];
export function genPlanetName(rng){
  let n=pick(rng,SYL_A)+pick(rng,SYL_B);
  if(rng()<0.5)n+=pick(rng,SYL_B);
  if(rng()<0.35)n+="-"+pick(rng,SYL_C);
  return n.toUpperCase();
}
export function genCreatureName(rng){
  let n=pick(rng,SYL_A)+pick(rng,SYL_B);
  if(rng()<0.4)n+=pick(rng,SYL_B);
  return n.charAt(0)+n.slice(1).toLowerCase();
}
export function genSystemName(rng){
  return (pick(rng,SYL_A)+pick(rng,SYL_B)).toUpperCase()+"-"+(100+Math.floor(rng()*900));
}
export function bearingOf(dx,dz){
  let a=Math.atan2(dx,-dz)*180/Math.PI;
  if(a<0)a+=360;
  return a;
}
export function fmtDist(m){
  if(m>=1000)return (m/1000).toFixed(1)+"km";
  return Math.floor(m)+"m";
}
export function easeInOut(t){return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
export function easeOut(t){return 1-Math.pow(1-t,3);}
export function easeIn(t){return t*t*t;}
