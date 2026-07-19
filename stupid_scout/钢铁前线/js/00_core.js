'use strict';
const V3 = (x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a,b)=>a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const TAU=Math.PI*2, HPI=Math.PI/2;
const dampF=(cur,tgt,k,dt)=>lerp(tgt,cur,Math.exp(-k*dt));
const SETTINGS = { team:0, diff:1, quality:1, sens:1.0, vol:0.8,
adsToggle:(function(){ try{ return localStorage.getItem('sf_adsmode')==='toggle'; }catch(e){ return false; } })() };
const DIFF_TABLE = [
{ react:0.85, spreadMul:1.7, dmgMul:0.7, visMul:0.8, name:'新兵' },
{ react:0.5,  spreadMul:1.0, dmgMul:1.0, visMul:1.0, name:'老兵' },
{ react:0.28, spreadMul:0.6, dmgMul:1.25, visMul:1.25, name:'精英' },
];
