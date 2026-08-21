var th=Object.defineProperty;var eh=(r,t,e)=>t in r?th(r,t,{enumerable:!0,configurable:!0,writable:!0,value:e}):r[t]=e;var v=(r,t,e)=>eh(r,typeof t!="symbol"?t+"":t,e);(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))n(i);new MutationObserver(i=>{for(const s of i)if(s.type==="childList")for(const a of s.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function e(i){const s={};return i.integrity&&(s.integrity=i.integrity),i.referrerPolicy&&(s.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?s.credentials="include":i.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(i){if(i.ep)return;i.ep=!0;const s=e(i);fetch(i.href,s)}})();/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const ao="180",nh=0,Fo=1,ih=2,lc=1,cc=2,wn=3,Vn=0,Ue=1,Le=2,An=0,ai=1,en=2,No=3,Oo=4,sh=5,ni=100,rh=101,ah=102,oh=103,lh=104,ch=200,hh=201,uh=202,fh=203,fa=204,da=205,dh=206,ph=207,mh=208,gh=209,_h=210,vh=211,xh=212,Mh=213,yh=214,pa=0,ma=1,ga=2,Ni=3,_a=4,va=5,xa=6,Ma=7,oo=0,Sh=1,bh=2,kn=0,hc=1,uc=2,fc=3,dc=4,pc=5,mc=6,lo=7,gc=300,Oi=301,zi=302,ya=303,Sa=304,_r=306,ba=1e3,si=1001,Ea=1002,Ke=1003,Eh=1004,ys=1005,mn=1006,Er=1007,ri=1008,xn=1009,_c=1010,vc=1011,cs=1012,co=1013,oi=1014,gn=1015,vn=1016,ho=1017,uo=1018,hs=1020,xc=35902,Mc=35899,yc=1021,Sc=1022,cn=1023,us=1026,fs=1027,fo=1028,po=1029,bc=1030,mo=1031,go=1033,$s=33776,Js=33777,Qs=33778,tr=33779,Ta=35840,wa=35841,Aa=35842,Ra=35843,Ca=36196,Pa=37492,Da=37496,La=37808,Ua=37809,Ia=37810,Fa=37811,Na=37812,Oa=37813,za=37814,Ba=37815,ka=37816,Va=37817,Ha=37818,Ga=37819,Wa=37820,qa=37821,Xa=36492,Ya=36494,Ka=36495,ja=36283,Za=36284,$a=36285,Ja=36286,Th=3200,wh=3201,Ec=0,Ah=1,Bn="",Xe="srgb",Bi="srgb-linear",ar="linear",$t="srgb",pi=7680,zo=519,Rh=512,Ch=513,Ph=514,Tc=515,Dh=516,Lh=517,Uh=518,Ih=519,Bo=35044,Ve=35048,ko="300 es",_n=2e3,or=2001;class Xi{addEventListener(t,e){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[t]===void 0&&(n[t]=[]),n[t].indexOf(e)===-1&&n[t].push(e)}hasEventListener(t,e){const n=this._listeners;return n===void 0?!1:n[t]!==void 0&&n[t].indexOf(e)!==-1}removeEventListener(t,e){const n=this._listeners;if(n===void 0)return;const i=n[t];if(i!==void 0){const s=i.indexOf(e);s!==-1&&i.splice(s,1)}}dispatchEvent(t){const e=this._listeners;if(e===void 0)return;const n=e[t.type];if(n!==void 0){t.target=this;const i=n.slice(0);for(let s=0,a=i.length;s<a;s++)i[s].call(this,t);t.target=null}}}const Ce=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Tr=Math.PI/180,Qa=180/Math.PI;function gs(){const r=Math.random()*4294967295|0,t=Math.random()*4294967295|0,e=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ce[r&255]+Ce[r>>8&255]+Ce[r>>16&255]+Ce[r>>24&255]+"-"+Ce[t&255]+Ce[t>>8&255]+"-"+Ce[t>>16&15|64]+Ce[t>>24&255]+"-"+Ce[e&63|128]+Ce[e>>8&255]+"-"+Ce[e>>16&255]+Ce[e>>24&255]+Ce[n&255]+Ce[n>>8&255]+Ce[n>>16&255]+Ce[n>>24&255]).toLowerCase()}function Wt(r,t,e){return Math.max(t,Math.min(e,r))}function Fh(r,t){return(r%t+t)%t}function wr(r,t,e){return(1-e)*r+e*t}function Zi(r,t){switch(t.constructor){case Float32Array:return r;case Uint32Array:return r/4294967295;case Uint16Array:return r/65535;case Uint8Array:return r/255;case Int32Array:return Math.max(r/2147483647,-1);case Int16Array:return Math.max(r/32767,-1);case Int8Array:return Math.max(r/127,-1);default:throw new Error("Invalid component type.")}}function ze(r,t){switch(t.constructor){case Float32Array:return r;case Uint32Array:return Math.round(r*4294967295);case Uint16Array:return Math.round(r*65535);case Uint8Array:return Math.round(r*255);case Int32Array:return Math.round(r*2147483647);case Int16Array:return Math.round(r*32767);case Int8Array:return Math.round(r*127);default:throw new Error("Invalid component type.")}}class Tt{constructor(t=0,e=0){Tt.prototype.isVector2=!0,this.x=t,this.y=e}get width(){return this.x}set width(t){this.x=t}get height(){return this.y}set height(t){this.y=t}set(t,e){return this.x=t,this.y=e,this}setScalar(t){return this.x=t,this.y=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y)}copy(t){return this.x=t.x,this.y=t.y,this}add(t){return this.x+=t.x,this.y+=t.y,this}addScalar(t){return this.x+=t,this.y+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this}subScalar(t){return this.x-=t,this.y-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this}multiply(t){return this.x*=t.x,this.y*=t.y,this}multiplyScalar(t){return this.x*=t,this.y*=t,this}divide(t){return this.x/=t.x,this.y/=t.y,this}divideScalar(t){return this.multiplyScalar(1/t)}applyMatrix3(t){const e=this.x,n=this.y,i=t.elements;return this.x=i[0]*e+i[3]*n+i[6],this.y=i[1]*e+i[4]*n+i[7],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this}clamp(t,e){return this.x=Wt(this.x,t.x,e.x),this.y=Wt(this.y,t.y,e.y),this}clampScalar(t,e){return this.x=Wt(this.x,t,e),this.y=Wt(this.y,t,e),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Wt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(t){return this.x*t.x+this.y*t.y}cross(t){return this.x*t.y-this.y*t.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Wt(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y;return e*e+n*n}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this}equals(t){return t.x===this.x&&t.y===this.y}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this}rotateAround(t,e){const n=Math.cos(e),i=Math.sin(e),s=this.x-t.x,a=this.y-t.y;return this.x=s*n-a*i+t.x,this.y=s*i+a*n+t.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class Gn{constructor(t=0,e=0,n=0,i=1){this.isQuaternion=!0,this._x=t,this._y=e,this._z=n,this._w=i}static slerpFlat(t,e,n,i,s,a,o){let l=n[i+0],c=n[i+1],h=n[i+2],u=n[i+3];const f=s[a+0],d=s[a+1],g=s[a+2],_=s[a+3];if(o===0){t[e+0]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u;return}if(o===1){t[e+0]=f,t[e+1]=d,t[e+2]=g,t[e+3]=_;return}if(u!==_||l!==f||c!==d||h!==g){let m=1-o;const p=l*f+c*d+h*g+u*_,b=p>=0?1:-1,E=1-p*p;if(E>Number.EPSILON){const w=Math.sqrt(E),A=Math.atan2(w,p*b);m=Math.sin(m*A)/w,o=Math.sin(o*A)/w}const y=o*b;if(l=l*m+f*y,c=c*m+d*y,h=h*m+g*y,u=u*m+_*y,m===1-o){const w=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=w,c*=w,h*=w,u*=w}}t[e]=l,t[e+1]=c,t[e+2]=h,t[e+3]=u}static multiplyQuaternionsFlat(t,e,n,i,s,a){const o=n[i],l=n[i+1],c=n[i+2],h=n[i+3],u=s[a],f=s[a+1],d=s[a+2],g=s[a+3];return t[e]=o*g+h*u+l*d-c*f,t[e+1]=l*g+h*f+c*u-o*d,t[e+2]=c*g+h*d+o*f-l*u,t[e+3]=h*g-o*u-l*f-c*d,t}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get w(){return this._w}set w(t){this._w=t,this._onChangeCallback()}set(t,e,n,i){return this._x=t,this._y=e,this._z=n,this._w=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(t){return this._x=t.x,this._y=t.y,this._z=t.z,this._w=t.w,this._onChangeCallback(),this}setFromEuler(t,e=!0){const n=t._x,i=t._y,s=t._z,a=t._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(i/2),u=o(s/2),f=l(n/2),d=l(i/2),g=l(s/2);switch(a){case"XYZ":this._x=f*h*u+c*d*g,this._y=c*d*u-f*h*g,this._z=c*h*g+f*d*u,this._w=c*h*u-f*d*g;break;case"YXZ":this._x=f*h*u+c*d*g,this._y=c*d*u-f*h*g,this._z=c*h*g-f*d*u,this._w=c*h*u+f*d*g;break;case"ZXY":this._x=f*h*u-c*d*g,this._y=c*d*u+f*h*g,this._z=c*h*g+f*d*u,this._w=c*h*u-f*d*g;break;case"ZYX":this._x=f*h*u-c*d*g,this._y=c*d*u+f*h*g,this._z=c*h*g-f*d*u,this._w=c*h*u+f*d*g;break;case"YZX":this._x=f*h*u+c*d*g,this._y=c*d*u+f*h*g,this._z=c*h*g-f*d*u,this._w=c*h*u-f*d*g;break;case"XZY":this._x=f*h*u-c*d*g,this._y=c*d*u-f*h*g,this._z=c*h*g+f*d*u,this._w=c*h*u+f*d*g;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+a)}return e===!0&&this._onChangeCallback(),this}setFromAxisAngle(t,e){const n=e/2,i=Math.sin(n);return this._x=t.x*i,this._y=t.y*i,this._z=t.z*i,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(t){const e=t.elements,n=e[0],i=e[4],s=e[8],a=e[1],o=e[5],l=e[9],c=e[2],h=e[6],u=e[10],f=n+o+u;if(f>0){const d=.5/Math.sqrt(f+1);this._w=.25/d,this._x=(h-l)*d,this._y=(s-c)*d,this._z=(a-i)*d}else if(n>o&&n>u){const d=2*Math.sqrt(1+n-o-u);this._w=(h-l)/d,this._x=.25*d,this._y=(i+a)/d,this._z=(s+c)/d}else if(o>u){const d=2*Math.sqrt(1+o-n-u);this._w=(s-c)/d,this._x=(i+a)/d,this._y=.25*d,this._z=(l+h)/d}else{const d=2*Math.sqrt(1+u-n-o);this._w=(a-i)/d,this._x=(s+c)/d,this._y=(l+h)/d,this._z=.25*d}return this._onChangeCallback(),this}setFromUnitVectors(t,e){let n=t.dot(e)+1;return n<1e-8?(n=0,Math.abs(t.x)>Math.abs(t.z)?(this._x=-t.y,this._y=t.x,this._z=0,this._w=n):(this._x=0,this._y=-t.z,this._z=t.y,this._w=n)):(this._x=t.y*e.z-t.z*e.y,this._y=t.z*e.x-t.x*e.z,this._z=t.x*e.y-t.y*e.x,this._w=n),this.normalize()}angleTo(t){return 2*Math.acos(Math.abs(Wt(this.dot(t),-1,1)))}rotateTowards(t,e){const n=this.angleTo(t);if(n===0)return this;const i=Math.min(1,e/n);return this.slerp(t,i),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(t){return this._x*t._x+this._y*t._y+this._z*t._z+this._w*t._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let t=this.length();return t===0?(this._x=0,this._y=0,this._z=0,this._w=1):(t=1/t,this._x=this._x*t,this._y=this._y*t,this._z=this._z*t,this._w=this._w*t),this._onChangeCallback(),this}multiply(t){return this.multiplyQuaternions(this,t)}premultiply(t){return this.multiplyQuaternions(t,this)}multiplyQuaternions(t,e){const n=t._x,i=t._y,s=t._z,a=t._w,o=e._x,l=e._y,c=e._z,h=e._w;return this._x=n*h+a*o+i*c-s*l,this._y=i*h+a*l+s*o-n*c,this._z=s*h+a*c+n*l-i*o,this._w=a*h-n*o-i*l-s*c,this._onChangeCallback(),this}slerp(t,e){if(e===0)return this;if(e===1)return this.copy(t);const n=this._x,i=this._y,s=this._z,a=this._w;let o=a*t._w+n*t._x+i*t._y+s*t._z;if(o<0?(this._w=-t._w,this._x=-t._x,this._y=-t._y,this._z=-t._z,o=-o):this.copy(t),o>=1)return this._w=a,this._x=n,this._y=i,this._z=s,this;const l=1-o*o;if(l<=Number.EPSILON){const d=1-e;return this._w=d*a+e*this._w,this._x=d*n+e*this._x,this._y=d*i+e*this._y,this._z=d*s+e*this._z,this.normalize(),this}const c=Math.sqrt(l),h=Math.atan2(c,o),u=Math.sin((1-e)*h)/c,f=Math.sin(e*h)/c;return this._w=a*u+this._w*f,this._x=n*u+this._x*f,this._y=i*u+this._y*f,this._z=s*u+this._z*f,this._onChangeCallback(),this}slerpQuaternions(t,e,n){return this.copy(t).slerp(e,n)}random(){const t=2*Math.PI*Math.random(),e=2*Math.PI*Math.random(),n=Math.random(),i=Math.sqrt(1-n),s=Math.sqrt(n);return this.set(i*Math.sin(t),i*Math.cos(t),s*Math.sin(e),s*Math.cos(e))}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._w===this._w}fromArray(t,e=0){return this._x=t[e],this._y=t[e+1],this._z=t[e+2],this._w=t[e+3],this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._w,t}fromBufferAttribute(t,e){return this._x=t.getX(e),this._y=t.getY(e),this._z=t.getZ(e),this._w=t.getW(e),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class U{constructor(t=0,e=0,n=0){U.prototype.isVector3=!0,this.x=t,this.y=e,this.z=n}set(t,e,n){return n===void 0&&(n=this.z),this.x=t,this.y=e,this.z=n,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this}multiplyVectors(t,e){return this.x=t.x*e.x,this.y=t.y*e.y,this.z=t.z*e.z,this}applyEuler(t){return this.applyQuaternion(Vo.setFromEuler(t))}applyAxisAngle(t,e){return this.applyQuaternion(Vo.setFromAxisAngle(t,e))}applyMatrix3(t){const e=this.x,n=this.y,i=this.z,s=t.elements;return this.x=s[0]*e+s[3]*n+s[6]*i,this.y=s[1]*e+s[4]*n+s[7]*i,this.z=s[2]*e+s[5]*n+s[8]*i,this}applyNormalMatrix(t){return this.applyMatrix3(t).normalize()}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,s=t.elements,a=1/(s[3]*e+s[7]*n+s[11]*i+s[15]);return this.x=(s[0]*e+s[4]*n+s[8]*i+s[12])*a,this.y=(s[1]*e+s[5]*n+s[9]*i+s[13])*a,this.z=(s[2]*e+s[6]*n+s[10]*i+s[14])*a,this}applyQuaternion(t){const e=this.x,n=this.y,i=this.z,s=t.x,a=t.y,o=t.z,l=t.w,c=2*(a*i-o*n),h=2*(o*e-s*i),u=2*(s*n-a*e);return this.x=e+l*c+a*u-o*h,this.y=n+l*h+o*c-s*u,this.z=i+l*u+s*h-a*c,this}project(t){return this.applyMatrix4(t.matrixWorldInverse).applyMatrix4(t.projectionMatrix)}unproject(t){return this.applyMatrix4(t.projectionMatrixInverse).applyMatrix4(t.matrixWorld)}transformDirection(t){const e=this.x,n=this.y,i=this.z,s=t.elements;return this.x=s[0]*e+s[4]*n+s[8]*i,this.y=s[1]*e+s[5]*n+s[9]*i,this.z=s[2]*e+s[6]*n+s[10]*i,this.normalize()}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this}divideScalar(t){return this.multiplyScalar(1/t)}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this}clamp(t,e){return this.x=Wt(this.x,t.x,e.x),this.y=Wt(this.y,t.y,e.y),this.z=Wt(this.z,t.z,e.z),this}clampScalar(t,e){return this.x=Wt(this.x,t,e),this.y=Wt(this.y,t,e),this.z=Wt(this.z,t,e),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Wt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this}cross(t){return this.crossVectors(this,t)}crossVectors(t,e){const n=t.x,i=t.y,s=t.z,a=e.x,o=e.y,l=e.z;return this.x=i*l-s*o,this.y=s*a-n*l,this.z=n*o-i*a,this}projectOnVector(t){const e=t.lengthSq();if(e===0)return this.set(0,0,0);const n=t.dot(this)/e;return this.copy(t).multiplyScalar(n)}projectOnPlane(t){return Ar.copy(this).projectOnVector(t),this.sub(Ar)}reflect(t){return this.sub(Ar.copy(t).multiplyScalar(2*this.dot(t)))}angleTo(t){const e=Math.sqrt(this.lengthSq()*t.lengthSq());if(e===0)return Math.PI/2;const n=this.dot(t)/e;return Math.acos(Wt(n,-1,1))}distanceTo(t){return Math.sqrt(this.distanceToSquared(t))}distanceToSquared(t){const e=this.x-t.x,n=this.y-t.y,i=this.z-t.z;return e*e+n*n+i*i}manhattanDistanceTo(t){return Math.abs(this.x-t.x)+Math.abs(this.y-t.y)+Math.abs(this.z-t.z)}setFromSpherical(t){return this.setFromSphericalCoords(t.radius,t.phi,t.theta)}setFromSphericalCoords(t,e,n){const i=Math.sin(e)*t;return this.x=i*Math.sin(n),this.y=Math.cos(e)*t,this.z=i*Math.cos(n),this}setFromCylindrical(t){return this.setFromCylindricalCoords(t.radius,t.theta,t.y)}setFromCylindricalCoords(t,e,n){return this.x=t*Math.sin(e),this.y=n,this.z=t*Math.cos(e),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this}setFromMatrixScale(t){const e=this.setFromMatrixColumn(t,0).length(),n=this.setFromMatrixColumn(t,1).length(),i=this.setFromMatrixColumn(t,2).length();return this.x=e,this.y=n,this.z=i,this}setFromMatrixColumn(t,e){return this.fromArray(t.elements,e*4)}setFromMatrix3Column(t,e){return this.fromArray(t.elements,e*3)}setFromEuler(t){return this.x=t._x,this.y=t._y,this.z=t._z,this}setFromColor(t){return this.x=t.r,this.y=t.g,this.z=t.b,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const t=Math.random()*Math.PI*2,e=Math.random()*2-1,n=Math.sqrt(1-e*e);return this.x=n*Math.cos(t),this.y=e,this.z=n*Math.sin(t),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const Ar=new U,Vo=new Gn;class Nt{constructor(t,e,n,i,s,a,o,l,c){Nt.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],t!==void 0&&this.set(t,e,n,i,s,a,o,l,c)}set(t,e,n,i,s,a,o,l,c){const h=this.elements;return h[0]=t,h[1]=i,h[2]=o,h[3]=e,h[4]=s,h[5]=l,h[6]=n,h[7]=a,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],this}extractBasis(t,e,n){return t.setFromMatrix3Column(this,0),e.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(t){const e=t.elements;return this.set(e[0],e[4],e[8],e[1],e[5],e[9],e[2],e[6],e[10]),this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,s=this.elements,a=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],f=n[2],d=n[5],g=n[8],_=i[0],m=i[3],p=i[6],b=i[1],E=i[4],y=i[7],w=i[2],A=i[5],C=i[8];return s[0]=a*_+o*b+l*w,s[3]=a*m+o*E+l*A,s[6]=a*p+o*y+l*C,s[1]=c*_+h*b+u*w,s[4]=c*m+h*E+u*A,s[7]=c*p+h*y+u*C,s[2]=f*_+d*b+g*w,s[5]=f*m+d*E+g*A,s[8]=f*p+d*y+g*C,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[3]*=t,e[6]*=t,e[1]*=t,e[4]*=t,e[7]*=t,e[2]*=t,e[5]*=t,e[8]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8];return e*a*h-e*o*c-n*s*h+n*o*l+i*s*c-i*a*l}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=h*a-o*c,f=o*l-h*s,d=c*s-a*l,g=e*u+n*f+i*d;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const _=1/g;return t[0]=u*_,t[1]=(i*c-h*n)*_,t[2]=(o*n-i*a)*_,t[3]=f*_,t[4]=(h*e-i*l)*_,t[5]=(i*s-o*e)*_,t[6]=d*_,t[7]=(n*l-c*e)*_,t[8]=(a*e-n*s)*_,this}transpose(){let t;const e=this.elements;return t=e[1],e[1]=e[3],e[3]=t,t=e[2],e[2]=e[6],e[6]=t,t=e[5],e[5]=e[7],e[7]=t,this}getNormalMatrix(t){return this.setFromMatrix4(t).invert().transpose()}transposeIntoArray(t){const e=this.elements;return t[0]=e[0],t[1]=e[3],t[2]=e[6],t[3]=e[1],t[4]=e[4],t[5]=e[7],t[6]=e[2],t[7]=e[5],t[8]=e[8],this}setUvTransform(t,e,n,i,s,a,o){const l=Math.cos(s),c=Math.sin(s);return this.set(n*l,n*c,-n*(l*a+c*o)+a+t,-i*c,i*l,-i*(-c*a+l*o)+o+e,0,0,1),this}scale(t,e){return this.premultiply(Rr.makeScale(t,e)),this}rotate(t){return this.premultiply(Rr.makeRotation(-t)),this}translate(t,e){return this.premultiply(Rr.makeTranslation(t,e)),this}makeTranslation(t,e){return t.isVector2?this.set(1,0,t.x,0,1,t.y,0,0,1):this.set(1,0,t,0,1,e,0,0,1),this}makeRotation(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,n,e,0,0,0,1),this}makeScale(t,e){return this.set(t,0,0,0,e,0,0,0,1),this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<9;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<9;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t}clone(){return new this.constructor().fromArray(this.elements)}}const Rr=new Nt;function wc(r){for(let t=r.length-1;t>=0;--t)if(r[t]>=65535)return!0;return!1}function lr(r){return document.createElementNS("http://www.w3.org/1999/xhtml",r)}function Nh(){const r=lr("canvas");return r.style.display="block",r}const Ho={};function ds(r){r in Ho||(Ho[r]=!0,console.warn(r))}function Oh(r,t,e){return new Promise(function(n,i){function s(){switch(r.clientWaitSync(t,r.SYNC_FLUSH_COMMANDS_BIT,0)){case r.WAIT_FAILED:i();break;case r.TIMEOUT_EXPIRED:setTimeout(s,e);break;default:n()}}setTimeout(s,e)})}const Go=new Nt().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Wo=new Nt().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function zh(){const r={enabled:!0,workingColorSpace:Bi,spaces:{},convert:function(i,s,a){return this.enabled===!1||s===a||!s||!a||(this.spaces[s].transfer===$t&&(i.r=Rn(i.r),i.g=Rn(i.g),i.b=Rn(i.b)),this.spaces[s].primaries!==this.spaces[a].primaries&&(i.applyMatrix3(this.spaces[s].toXYZ),i.applyMatrix3(this.spaces[a].fromXYZ)),this.spaces[a].transfer===$t&&(i.r=Ii(i.r),i.g=Ii(i.g),i.b=Ii(i.b))),i},workingToColorSpace:function(i,s){return this.convert(i,this.workingColorSpace,s)},colorSpaceToWorking:function(i,s){return this.convert(i,s,this.workingColorSpace)},getPrimaries:function(i){return this.spaces[i].primaries},getTransfer:function(i){return i===Bn?ar:this.spaces[i].transfer},getToneMappingMode:function(i){return this.spaces[i].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(i,s=this.workingColorSpace){return i.fromArray(this.spaces[s].luminanceCoefficients)},define:function(i){Object.assign(this.spaces,i)},_getMatrix:function(i,s,a){return i.copy(this.spaces[s].toXYZ).multiply(this.spaces[a].fromXYZ)},_getDrawingBufferColorSpace:function(i){return this.spaces[i].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(i=this.workingColorSpace){return this.spaces[i].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(i,s){return ds("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),r.workingToColorSpace(i,s)},toWorkingColorSpace:function(i,s){return ds("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),r.colorSpaceToWorking(i,s)}},t=[.64,.33,.3,.6,.15,.06],e=[.2126,.7152,.0722],n=[.3127,.329];return r.define({[Bi]:{primaries:t,whitePoint:n,transfer:ar,toXYZ:Go,fromXYZ:Wo,luminanceCoefficients:e,workingColorSpaceConfig:{unpackColorSpace:Xe},outputColorSpaceConfig:{drawingBufferColorSpace:Xe}},[Xe]:{primaries:t,whitePoint:n,transfer:$t,toXYZ:Go,fromXYZ:Wo,luminanceCoefficients:e,outputColorSpaceConfig:{drawingBufferColorSpace:Xe}}}),r}const Xt=zh();function Rn(r){return r<.04045?r*.0773993808:Math.pow(r*.9478672986+.0521327014,2.4)}function Ii(r){return r<.0031308?r*12.92:1.055*Math.pow(r,.41666)-.055}let mi;class Bh{static getDataURL(t,e="image/png"){if(/^data:/i.test(t.src)||typeof HTMLCanvasElement>"u")return t.src;let n;if(t instanceof HTMLCanvasElement)n=t;else{mi===void 0&&(mi=lr("canvas")),mi.width=t.width,mi.height=t.height;const i=mi.getContext("2d");t instanceof ImageData?i.putImageData(t,0,0):i.drawImage(t,0,0,t.width,t.height),n=mi}return n.toDataURL(e)}static sRGBToLinear(t){if(typeof HTMLImageElement<"u"&&t instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&t instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&t instanceof ImageBitmap){const e=lr("canvas");e.width=t.width,e.height=t.height;const n=e.getContext("2d");n.drawImage(t,0,0,t.width,t.height);const i=n.getImageData(0,0,t.width,t.height),s=i.data;for(let a=0;a<s.length;a++)s[a]=Rn(s[a]/255)*255;return n.putImageData(i,0,0),e}else if(t.data){const e=t.data.slice(0);for(let n=0;n<e.length;n++)e instanceof Uint8Array||e instanceof Uint8ClampedArray?e[n]=Math.floor(Rn(e[n]/255)*255):e[n]=Rn(e[n]);return{data:e,width:t.width,height:t.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),t}}let kh=0;class _o{constructor(t=null){this.isSource=!0,Object.defineProperty(this,"id",{value:kh++}),this.uuid=gs(),this.data=t,this.dataReady=!0,this.version=0}getSize(t){const e=this.data;return typeof HTMLVideoElement<"u"&&e instanceof HTMLVideoElement?t.set(e.videoWidth,e.videoHeight,0):e instanceof VideoFrame?t.set(e.displayHeight,e.displayWidth,0):e!==null?t.set(e.width,e.height,e.depth||0):t.set(0,0,0),t}set needsUpdate(t){t===!0&&this.version++}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.images[this.uuid]!==void 0)return t.images[this.uuid];const n={uuid:this.uuid,url:""},i=this.data;if(i!==null){let s;if(Array.isArray(i)){s=[];for(let a=0,o=i.length;a<o;a++)i[a].isDataTexture?s.push(Cr(i[a].image)):s.push(Cr(i[a]))}else s=Cr(i);n.url=s}return e||(t.images[this.uuid]=n),n}}function Cr(r){return typeof HTMLImageElement<"u"&&r instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&r instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&r instanceof ImageBitmap?Bh.getDataURL(r):r.data?{data:Array.from(r.data),width:r.width,height:r.height,type:r.data.constructor.name}:(console.warn("THREE.Texture: Unable to serialize Texture."),{})}let Vh=0;const Pr=new U;class Ie extends Xi{constructor(t=Ie.DEFAULT_IMAGE,e=Ie.DEFAULT_MAPPING,n=si,i=si,s=mn,a=ri,o=cn,l=xn,c=Ie.DEFAULT_ANISOTROPY,h=Bn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Vh++}),this.uuid=gs(),this.name="",this.source=new _o(t),this.mipmaps=[],this.mapping=e,this.channel=0,this.wrapS=n,this.wrapT=i,this.magFilter=s,this.minFilter=a,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new Tt(0,0),this.repeat=new Tt(1,1),this.center=new Tt(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Nt,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(t&&t.depth&&t.depth>1),this.pmremVersion=0}get width(){return this.source.getSize(Pr).x}get height(){return this.source.getSize(Pr).y}get depth(){return this.source.getSize(Pr).z}get image(){return this.source.data}set image(t=null){this.source.data=t}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(t){return this.name=t.name,this.source=t.source,this.mipmaps=t.mipmaps.slice(0),this.mapping=t.mapping,this.channel=t.channel,this.wrapS=t.wrapS,this.wrapT=t.wrapT,this.magFilter=t.magFilter,this.minFilter=t.minFilter,this.anisotropy=t.anisotropy,this.format=t.format,this.internalFormat=t.internalFormat,this.type=t.type,this.offset.copy(t.offset),this.repeat.copy(t.repeat),this.center.copy(t.center),this.rotation=t.rotation,this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrix.copy(t.matrix),this.generateMipmaps=t.generateMipmaps,this.premultiplyAlpha=t.premultiplyAlpha,this.flipY=t.flipY,this.unpackAlignment=t.unpackAlignment,this.colorSpace=t.colorSpace,this.renderTarget=t.renderTarget,this.isRenderTargetTexture=t.isRenderTargetTexture,this.isArrayTexture=t.isArrayTexture,this.userData=JSON.parse(JSON.stringify(t.userData)),this.needsUpdate=!0,this}setValues(t){for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Texture.setValues(): parameter '${e}' has value of undefined.`);continue}const i=this[e];if(i===void 0){console.warn(`THREE.Texture.setValues(): property '${e}' does not exist.`);continue}i&&n&&i.isVector2&&n.isVector2||i&&n&&i.isVector3&&n.isVector3||i&&n&&i.isMatrix3&&n.isMatrix3?i.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";if(!e&&t.textures[this.uuid]!==void 0)return t.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(t).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),e||(t.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(t){if(this.mapping!==gc)return t;if(t.applyMatrix3(this.matrix),t.x<0||t.x>1)switch(this.wrapS){case ba:t.x=t.x-Math.floor(t.x);break;case si:t.x=t.x<0?0:1;break;case Ea:Math.abs(Math.floor(t.x)%2)===1?t.x=Math.ceil(t.x)-t.x:t.x=t.x-Math.floor(t.x);break}if(t.y<0||t.y>1)switch(this.wrapT){case ba:t.y=t.y-Math.floor(t.y);break;case si:t.y=t.y<0?0:1;break;case Ea:Math.abs(Math.floor(t.y)%2)===1?t.y=Math.ceil(t.y)-t.y:t.y=t.y-Math.floor(t.y);break}return this.flipY&&(t.y=1-t.y),t}set needsUpdate(t){t===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(t){t===!0&&this.pmremVersion++}}Ie.DEFAULT_IMAGE=null;Ie.DEFAULT_MAPPING=gc;Ie.DEFAULT_ANISOTROPY=1;class te{constructor(t=0,e=0,n=0,i=1){te.prototype.isVector4=!0,this.x=t,this.y=e,this.z=n,this.w=i}get width(){return this.z}set width(t){this.z=t}get height(){return this.w}set height(t){this.w=t}set(t,e,n,i){return this.x=t,this.y=e,this.z=n,this.w=i,this}setScalar(t){return this.x=t,this.y=t,this.z=t,this.w=t,this}setX(t){return this.x=t,this}setY(t){return this.y=t,this}setZ(t){return this.z=t,this}setW(t){return this.w=t,this}setComponent(t,e){switch(t){case 0:this.x=e;break;case 1:this.y=e;break;case 2:this.z=e;break;case 3:this.w=e;break;default:throw new Error("index is out of range: "+t)}return this}getComponent(t){switch(t){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("index is out of range: "+t)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(t){return this.x=t.x,this.y=t.y,this.z=t.z,this.w=t.w!==void 0?t.w:1,this}add(t){return this.x+=t.x,this.y+=t.y,this.z+=t.z,this.w+=t.w,this}addScalar(t){return this.x+=t,this.y+=t,this.z+=t,this.w+=t,this}addVectors(t,e){return this.x=t.x+e.x,this.y=t.y+e.y,this.z=t.z+e.z,this.w=t.w+e.w,this}addScaledVector(t,e){return this.x+=t.x*e,this.y+=t.y*e,this.z+=t.z*e,this.w+=t.w*e,this}sub(t){return this.x-=t.x,this.y-=t.y,this.z-=t.z,this.w-=t.w,this}subScalar(t){return this.x-=t,this.y-=t,this.z-=t,this.w-=t,this}subVectors(t,e){return this.x=t.x-e.x,this.y=t.y-e.y,this.z=t.z-e.z,this.w=t.w-e.w,this}multiply(t){return this.x*=t.x,this.y*=t.y,this.z*=t.z,this.w*=t.w,this}multiplyScalar(t){return this.x*=t,this.y*=t,this.z*=t,this.w*=t,this}applyMatrix4(t){const e=this.x,n=this.y,i=this.z,s=this.w,a=t.elements;return this.x=a[0]*e+a[4]*n+a[8]*i+a[12]*s,this.y=a[1]*e+a[5]*n+a[9]*i+a[13]*s,this.z=a[2]*e+a[6]*n+a[10]*i+a[14]*s,this.w=a[3]*e+a[7]*n+a[11]*i+a[15]*s,this}divide(t){return this.x/=t.x,this.y/=t.y,this.z/=t.z,this.w/=t.w,this}divideScalar(t){return this.multiplyScalar(1/t)}setAxisAngleFromQuaternion(t){this.w=2*Math.acos(t.w);const e=Math.sqrt(1-t.w*t.w);return e<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=t.x/e,this.y=t.y/e,this.z=t.z/e),this}setAxisAngleFromRotationMatrix(t){let e,n,i,s;const l=t.elements,c=l[0],h=l[4],u=l[8],f=l[1],d=l[5],g=l[9],_=l[2],m=l[6],p=l[10];if(Math.abs(h-f)<.01&&Math.abs(u-_)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+f)<.1&&Math.abs(u+_)<.1&&Math.abs(g+m)<.1&&Math.abs(c+d+p-3)<.1)return this.set(1,0,0,0),this;e=Math.PI;const E=(c+1)/2,y=(d+1)/2,w=(p+1)/2,A=(h+f)/4,C=(u+_)/4,L=(g+m)/4;return E>y&&E>w?E<.01?(n=0,i=.707106781,s=.707106781):(n=Math.sqrt(E),i=A/n,s=C/n):y>w?y<.01?(n=.707106781,i=0,s=.707106781):(i=Math.sqrt(y),n=A/i,s=L/i):w<.01?(n=.707106781,i=.707106781,s=0):(s=Math.sqrt(w),n=C/s,i=L/s),this.set(n,i,s,e),this}let b=Math.sqrt((m-g)*(m-g)+(u-_)*(u-_)+(f-h)*(f-h));return Math.abs(b)<.001&&(b=1),this.x=(m-g)/b,this.y=(u-_)/b,this.z=(f-h)/b,this.w=Math.acos((c+d+p-1)/2),this}setFromMatrixPosition(t){const e=t.elements;return this.x=e[12],this.y=e[13],this.z=e[14],this.w=e[15],this}min(t){return this.x=Math.min(this.x,t.x),this.y=Math.min(this.y,t.y),this.z=Math.min(this.z,t.z),this.w=Math.min(this.w,t.w),this}max(t){return this.x=Math.max(this.x,t.x),this.y=Math.max(this.y,t.y),this.z=Math.max(this.z,t.z),this.w=Math.max(this.w,t.w),this}clamp(t,e){return this.x=Wt(this.x,t.x,e.x),this.y=Wt(this.y,t.y,e.y),this.z=Wt(this.z,t.z,e.z),this.w=Wt(this.w,t.w,e.w),this}clampScalar(t,e){return this.x=Wt(this.x,t,e),this.y=Wt(this.y,t,e),this.z=Wt(this.z,t,e),this.w=Wt(this.w,t,e),this}clampLength(t,e){const n=this.length();return this.divideScalar(n||1).multiplyScalar(Wt(n,t,e))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(t){return this.x*t.x+this.y*t.y+this.z*t.z+this.w*t.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(t){return this.normalize().multiplyScalar(t)}lerp(t,e){return this.x+=(t.x-this.x)*e,this.y+=(t.y-this.y)*e,this.z+=(t.z-this.z)*e,this.w+=(t.w-this.w)*e,this}lerpVectors(t,e,n){return this.x=t.x+(e.x-t.x)*n,this.y=t.y+(e.y-t.y)*n,this.z=t.z+(e.z-t.z)*n,this.w=t.w+(e.w-t.w)*n,this}equals(t){return t.x===this.x&&t.y===this.y&&t.z===this.z&&t.w===this.w}fromArray(t,e=0){return this.x=t[e],this.y=t[e+1],this.z=t[e+2],this.w=t[e+3],this}toArray(t=[],e=0){return t[e]=this.x,t[e+1]=this.y,t[e+2]=this.z,t[e+3]=this.w,t}fromBufferAttribute(t,e){return this.x=t.getX(e),this.y=t.getY(e),this.z=t.getZ(e),this.w=t.getW(e),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Hh extends Xi{constructor(t=1,e=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:mn,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},n),this.isRenderTarget=!0,this.width=t,this.height=e,this.depth=n.depth,this.scissor=new te(0,0,t,e),this.scissorTest=!1,this.viewport=new te(0,0,t,e);const i={width:t,height:e,depth:n.depth},s=new Ie(i);this.textures=[];const a=n.count;for(let o=0;o<a;o++)this.textures[o]=s.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview}_setTextureOptions(t={}){const e={minFilter:mn,generateMipmaps:!1,flipY:!1,internalFormat:null};t.mapping!==void 0&&(e.mapping=t.mapping),t.wrapS!==void 0&&(e.wrapS=t.wrapS),t.wrapT!==void 0&&(e.wrapT=t.wrapT),t.wrapR!==void 0&&(e.wrapR=t.wrapR),t.magFilter!==void 0&&(e.magFilter=t.magFilter),t.minFilter!==void 0&&(e.minFilter=t.minFilter),t.format!==void 0&&(e.format=t.format),t.type!==void 0&&(e.type=t.type),t.anisotropy!==void 0&&(e.anisotropy=t.anisotropy),t.colorSpace!==void 0&&(e.colorSpace=t.colorSpace),t.flipY!==void 0&&(e.flipY=t.flipY),t.generateMipmaps!==void 0&&(e.generateMipmaps=t.generateMipmaps),t.internalFormat!==void 0&&(e.internalFormat=t.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(e)}get texture(){return this.textures[0]}set texture(t){this.textures[0]=t}set depthTexture(t){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),t!==null&&(t.renderTarget=this),this._depthTexture=t}get depthTexture(){return this._depthTexture}setSize(t,e,n=1){if(this.width!==t||this.height!==e||this.depth!==n){this.width=t,this.height=e,this.depth=n;for(let i=0,s=this.textures.length;i<s;i++)this.textures[i].image.width=t,this.textures[i].image.height=e,this.textures[i].image.depth=n,this.textures[i].isArrayTexture=this.textures[i].image.depth>1;this.dispose()}this.viewport.set(0,0,t,e),this.scissor.set(0,0,t,e)}clone(){return new this.constructor().copy(this)}copy(t){this.width=t.width,this.height=t.height,this.depth=t.depth,this.scissor.copy(t.scissor),this.scissorTest=t.scissorTest,this.viewport.copy(t.viewport),this.textures.length=0;for(let e=0,n=t.textures.length;e<n;e++){this.textures[e]=t.textures[e].clone(),this.textures[e].isRenderTargetTexture=!0,this.textures[e].renderTarget=this;const i=Object.assign({},t.textures[e].image);this.textures[e].source=new _o(i)}return this.depthBuffer=t.depthBuffer,this.stencilBuffer=t.stencilBuffer,this.resolveDepthBuffer=t.resolveDepthBuffer,this.resolveStencilBuffer=t.resolveStencilBuffer,t.depthTexture!==null&&(this.depthTexture=t.depthTexture.clone()),this.samples=t.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Qe extends Hh{constructor(t=1,e=1,n={}){super(t,e,n),this.isWebGLRenderTarget=!0}}class Ac extends Ie{constructor(t=null,e=1,n=1,i=1){super(null),this.isDataArrayTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Ke,this.minFilter=Ke,this.wrapR=si,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(t){this.layerUpdates.add(t)}clearLayerUpdates(){this.layerUpdates.clear()}}class Gh extends Ie{constructor(t=null,e=1,n=1,i=1){super(null),this.isData3DTexture=!0,this.image={data:t,width:e,height:n,depth:i},this.magFilter=Ke,this.minFilter=Ke,this.wrapR=si,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class ci{constructor(t=new U(1/0,1/0,1/0),e=new U(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=t,this.max=e}set(t,e){return this.min.copy(t),this.max.copy(e),this}setFromArray(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e+=3)this.expandByPoint(sn.fromArray(t,e));return this}setFromBufferAttribute(t){this.makeEmpty();for(let e=0,n=t.count;e<n;e++)this.expandByPoint(sn.fromBufferAttribute(t,e));return this}setFromPoints(t){this.makeEmpty();for(let e=0,n=t.length;e<n;e++)this.expandByPoint(t[e]);return this}setFromCenterAndSize(t,e){const n=sn.copy(e).multiplyScalar(.5);return this.min.copy(t).sub(n),this.max.copy(t).add(n),this}setFromObject(t,e=!1){return this.makeEmpty(),this.expandByObject(t,e)}clone(){return new this.constructor().copy(this)}copy(t){return this.min.copy(t.min),this.max.copy(t.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(t){return this.isEmpty()?t.set(0,0,0):t.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(t){return this.isEmpty()?t.set(0,0,0):t.subVectors(this.max,this.min)}expandByPoint(t){return this.min.min(t),this.max.max(t),this}expandByVector(t){return this.min.sub(t),this.max.add(t),this}expandByScalar(t){return this.min.addScalar(-t),this.max.addScalar(t),this}expandByObject(t,e=!1){t.updateWorldMatrix(!1,!1);const n=t.geometry;if(n!==void 0){const s=n.getAttribute("position");if(e===!0&&s!==void 0&&t.isInstancedMesh!==!0)for(let a=0,o=s.count;a<o;a++)t.isMesh===!0?t.getVertexPosition(a,sn):sn.fromBufferAttribute(s,a),sn.applyMatrix4(t.matrixWorld),this.expandByPoint(sn);else t.boundingBox!==void 0?(t.boundingBox===null&&t.computeBoundingBox(),Ss.copy(t.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Ss.copy(n.boundingBox)),Ss.applyMatrix4(t.matrixWorld),this.union(Ss)}const i=t.children;for(let s=0,a=i.length;s<a;s++)this.expandByObject(i[s],e);return this}containsPoint(t){return t.x>=this.min.x&&t.x<=this.max.x&&t.y>=this.min.y&&t.y<=this.max.y&&t.z>=this.min.z&&t.z<=this.max.z}containsBox(t){return this.min.x<=t.min.x&&t.max.x<=this.max.x&&this.min.y<=t.min.y&&t.max.y<=this.max.y&&this.min.z<=t.min.z&&t.max.z<=this.max.z}getParameter(t,e){return e.set((t.x-this.min.x)/(this.max.x-this.min.x),(t.y-this.min.y)/(this.max.y-this.min.y),(t.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(t){return t.max.x>=this.min.x&&t.min.x<=this.max.x&&t.max.y>=this.min.y&&t.min.y<=this.max.y&&t.max.z>=this.min.z&&t.min.z<=this.max.z}intersectsSphere(t){return this.clampPoint(t.center,sn),sn.distanceToSquared(t.center)<=t.radius*t.radius}intersectsPlane(t){let e,n;return t.normal.x>0?(e=t.normal.x*this.min.x,n=t.normal.x*this.max.x):(e=t.normal.x*this.max.x,n=t.normal.x*this.min.x),t.normal.y>0?(e+=t.normal.y*this.min.y,n+=t.normal.y*this.max.y):(e+=t.normal.y*this.max.y,n+=t.normal.y*this.min.y),t.normal.z>0?(e+=t.normal.z*this.min.z,n+=t.normal.z*this.max.z):(e+=t.normal.z*this.max.z,n+=t.normal.z*this.min.z),e<=-t.constant&&n>=-t.constant}intersectsTriangle(t){if(this.isEmpty())return!1;this.getCenter($i),bs.subVectors(this.max,$i),gi.subVectors(t.a,$i),_i.subVectors(t.b,$i),vi.subVectors(t.c,$i),Pn.subVectors(_i,gi),Dn.subVectors(vi,_i),Yn.subVectors(gi,vi);let e=[0,-Pn.z,Pn.y,0,-Dn.z,Dn.y,0,-Yn.z,Yn.y,Pn.z,0,-Pn.x,Dn.z,0,-Dn.x,Yn.z,0,-Yn.x,-Pn.y,Pn.x,0,-Dn.y,Dn.x,0,-Yn.y,Yn.x,0];return!Dr(e,gi,_i,vi,bs)||(e=[1,0,0,0,1,0,0,0,1],!Dr(e,gi,_i,vi,bs))?!1:(Es.crossVectors(Pn,Dn),e=[Es.x,Es.y,Es.z],Dr(e,gi,_i,vi,bs))}clampPoint(t,e){return e.copy(t).clamp(this.min,this.max)}distanceToPoint(t){return this.clampPoint(t,sn).distanceTo(t)}getBoundingSphere(t){return this.isEmpty()?t.makeEmpty():(this.getCenter(t.center),t.radius=this.getSize(sn).length()*.5),t}intersect(t){return this.min.max(t.min),this.max.min(t.max),this.isEmpty()&&this.makeEmpty(),this}union(t){return this.min.min(t.min),this.max.max(t.max),this}applyMatrix4(t){return this.isEmpty()?this:(yn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(t),yn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(t),yn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(t),yn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(t),yn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(t),yn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(t),yn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(t),yn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(t),this.setFromPoints(yn),this)}translate(t){return this.min.add(t),this.max.add(t),this}equals(t){return t.min.equals(this.min)&&t.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(t){return this.min.fromArray(t.min),this.max.fromArray(t.max),this}}const yn=[new U,new U,new U,new U,new U,new U,new U,new U],sn=new U,Ss=new ci,gi=new U,_i=new U,vi=new U,Pn=new U,Dn=new U,Yn=new U,$i=new U,bs=new U,Es=new U,Kn=new U;function Dr(r,t,e,n,i){for(let s=0,a=r.length-3;s<=a;s+=3){Kn.fromArray(r,s);const o=i.x*Math.abs(Kn.x)+i.y*Math.abs(Kn.y)+i.z*Math.abs(Kn.z),l=t.dot(Kn),c=e.dot(Kn),h=n.dot(Kn);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const Wh=new ci,Ji=new U,Lr=new U;class Cn{constructor(t=new U,e=-1){this.isSphere=!0,this.center=t,this.radius=e}set(t,e){return this.center.copy(t),this.radius=e,this}setFromPoints(t,e){const n=this.center;e!==void 0?n.copy(e):Wh.setFromPoints(t).getCenter(n);let i=0;for(let s=0,a=t.length;s<a;s++)i=Math.max(i,n.distanceToSquared(t[s]));return this.radius=Math.sqrt(i),this}copy(t){return this.center.copy(t.center),this.radius=t.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(t){return t.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(t){return t.distanceTo(this.center)-this.radius}intersectsSphere(t){const e=this.radius+t.radius;return t.center.distanceToSquared(this.center)<=e*e}intersectsBox(t){return t.intersectsSphere(this)}intersectsPlane(t){return Math.abs(t.distanceToPoint(this.center))<=this.radius}clampPoint(t,e){const n=this.center.distanceToSquared(t);return e.copy(t),n>this.radius*this.radius&&(e.sub(this.center).normalize(),e.multiplyScalar(this.radius).add(this.center)),e}getBoundingBox(t){return this.isEmpty()?(t.makeEmpty(),t):(t.set(this.center,this.center),t.expandByScalar(this.radius),t)}applyMatrix4(t){return this.center.applyMatrix4(t),this.radius=this.radius*t.getMaxScaleOnAxis(),this}translate(t){return this.center.add(t),this}expandByPoint(t){if(this.isEmpty())return this.center.copy(t),this.radius=0,this;Ji.subVectors(t,this.center);const e=Ji.lengthSq();if(e>this.radius*this.radius){const n=Math.sqrt(e),i=(n-this.radius)*.5;this.center.addScaledVector(Ji,i/n),this.radius+=i}return this}union(t){return t.isEmpty()?this:this.isEmpty()?(this.copy(t),this):(this.center.equals(t.center)===!0?this.radius=Math.max(this.radius,t.radius):(Lr.subVectors(t.center,this.center).setLength(t.radius),this.expandByPoint(Ji.copy(t.center).add(Lr)),this.expandByPoint(Ji.copy(t.center).sub(Lr))),this)}equals(t){return t.center.equals(this.center)&&t.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(t){return this.radius=t.radius,this.center.fromArray(t.center),this}}const Sn=new U,Ur=new U,Ts=new U,Ln=new U,Ir=new U,ws=new U,Fr=new U;class vr{constructor(t=new U,e=new U(0,0,-1)){this.origin=t,this.direction=e}set(t,e){return this.origin.copy(t),this.direction.copy(e),this}copy(t){return this.origin.copy(t.origin),this.direction.copy(t.direction),this}at(t,e){return e.copy(this.origin).addScaledVector(this.direction,t)}lookAt(t){return this.direction.copy(t).sub(this.origin).normalize(),this}recast(t){return this.origin.copy(this.at(t,Sn)),this}closestPointToPoint(t,e){e.subVectors(t,this.origin);const n=e.dot(this.direction);return n<0?e.copy(this.origin):e.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(t){return Math.sqrt(this.distanceSqToPoint(t))}distanceSqToPoint(t){const e=Sn.subVectors(t,this.origin).dot(this.direction);return e<0?this.origin.distanceToSquared(t):(Sn.copy(this.origin).addScaledVector(this.direction,e),Sn.distanceToSquared(t))}distanceSqToSegment(t,e,n,i){Ur.copy(t).add(e).multiplyScalar(.5),Ts.copy(e).sub(t).normalize(),Ln.copy(this.origin).sub(Ur);const s=t.distanceTo(e)*.5,a=-this.direction.dot(Ts),o=Ln.dot(this.direction),l=-Ln.dot(Ts),c=Ln.lengthSq(),h=Math.abs(1-a*a);let u,f,d,g;if(h>0)if(u=a*l-o,f=a*o-l,g=s*h,u>=0)if(f>=-g)if(f<=g){const _=1/h;u*=_,f*=_,d=u*(u+a*f+2*o)+f*(a*u+f+2*l)+c}else f=s,u=Math.max(0,-(a*f+o)),d=-u*u+f*(f+2*l)+c;else f=-s,u=Math.max(0,-(a*f+o)),d=-u*u+f*(f+2*l)+c;else f<=-g?(u=Math.max(0,-(-a*s+o)),f=u>0?-s:Math.min(Math.max(-s,-l),s),d=-u*u+f*(f+2*l)+c):f<=g?(u=0,f=Math.min(Math.max(-s,-l),s),d=f*(f+2*l)+c):(u=Math.max(0,-(a*s+o)),f=u>0?s:Math.min(Math.max(-s,-l),s),d=-u*u+f*(f+2*l)+c);else f=a>0?-s:s,u=Math.max(0,-(a*f+o)),d=-u*u+f*(f+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),i&&i.copy(Ur).addScaledVector(Ts,f),d}intersectSphere(t,e){Sn.subVectors(t.center,this.origin);const n=Sn.dot(this.direction),i=Sn.dot(Sn)-n*n,s=t.radius*t.radius;if(i>s)return null;const a=Math.sqrt(s-i),o=n-a,l=n+a;return l<0?null:o<0?this.at(l,e):this.at(o,e)}intersectsSphere(t){return t.radius<0?!1:this.distanceSqToPoint(t.center)<=t.radius*t.radius}distanceToPlane(t){const e=t.normal.dot(this.direction);if(e===0)return t.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(t.normal)+t.constant)/e;return n>=0?n:null}intersectPlane(t,e){const n=this.distanceToPlane(t);return n===null?null:this.at(n,e)}intersectsPlane(t){const e=t.distanceToPoint(this.origin);return e===0||t.normal.dot(this.direction)*e<0}intersectBox(t,e){let n,i,s,a,o,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,f=this.origin;return c>=0?(n=(t.min.x-f.x)*c,i=(t.max.x-f.x)*c):(n=(t.max.x-f.x)*c,i=(t.min.x-f.x)*c),h>=0?(s=(t.min.y-f.y)*h,a=(t.max.y-f.y)*h):(s=(t.max.y-f.y)*h,a=(t.min.y-f.y)*h),n>a||s>i||((s>n||isNaN(n))&&(n=s),(a<i||isNaN(i))&&(i=a),u>=0?(o=(t.min.z-f.z)*u,l=(t.max.z-f.z)*u):(o=(t.max.z-f.z)*u,l=(t.min.z-f.z)*u),n>l||o>i)||((o>n||n!==n)&&(n=o),(l<i||i!==i)&&(i=l),i<0)?null:this.at(n>=0?n:i,e)}intersectsBox(t){return this.intersectBox(t,Sn)!==null}intersectTriangle(t,e,n,i,s){Ir.subVectors(e,t),ws.subVectors(n,t),Fr.crossVectors(Ir,ws);let a=this.direction.dot(Fr),o;if(a>0){if(i)return null;o=1}else if(a<0)o=-1,a=-a;else return null;Ln.subVectors(this.origin,t);const l=o*this.direction.dot(ws.crossVectors(Ln,ws));if(l<0)return null;const c=o*this.direction.dot(Ir.cross(Ln));if(c<0||l+c>a)return null;const h=-o*Ln.dot(Fr);return h<0?null:this.at(h/a,s)}applyMatrix4(t){return this.origin.applyMatrix4(t),this.direction.transformDirection(t),this}equals(t){return t.origin.equals(this.origin)&&t.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class Yt{constructor(t,e,n,i,s,a,o,l,c,h,u,f,d,g,_,m){Yt.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],t!==void 0&&this.set(t,e,n,i,s,a,o,l,c,h,u,f,d,g,_,m)}set(t,e,n,i,s,a,o,l,c,h,u,f,d,g,_,m){const p=this.elements;return p[0]=t,p[4]=e,p[8]=n,p[12]=i,p[1]=s,p[5]=a,p[9]=o,p[13]=l,p[2]=c,p[6]=h,p[10]=u,p[14]=f,p[3]=d,p[7]=g,p[11]=_,p[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new Yt().fromArray(this.elements)}copy(t){const e=this.elements,n=t.elements;return e[0]=n[0],e[1]=n[1],e[2]=n[2],e[3]=n[3],e[4]=n[4],e[5]=n[5],e[6]=n[6],e[7]=n[7],e[8]=n[8],e[9]=n[9],e[10]=n[10],e[11]=n[11],e[12]=n[12],e[13]=n[13],e[14]=n[14],e[15]=n[15],this}copyPosition(t){const e=this.elements,n=t.elements;return e[12]=n[12],e[13]=n[13],e[14]=n[14],this}setFromMatrix3(t){const e=t.elements;return this.set(e[0],e[3],e[6],0,e[1],e[4],e[7],0,e[2],e[5],e[8],0,0,0,0,1),this}extractBasis(t,e,n){return t.setFromMatrixColumn(this,0),e.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this}makeBasis(t,e,n){return this.set(t.x,e.x,n.x,0,t.y,e.y,n.y,0,t.z,e.z,n.z,0,0,0,0,1),this}extractRotation(t){const e=this.elements,n=t.elements,i=1/xi.setFromMatrixColumn(t,0).length(),s=1/xi.setFromMatrixColumn(t,1).length(),a=1/xi.setFromMatrixColumn(t,2).length();return e[0]=n[0]*i,e[1]=n[1]*i,e[2]=n[2]*i,e[3]=0,e[4]=n[4]*s,e[5]=n[5]*s,e[6]=n[6]*s,e[7]=0,e[8]=n[8]*a,e[9]=n[9]*a,e[10]=n[10]*a,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromEuler(t){const e=this.elements,n=t.x,i=t.y,s=t.z,a=Math.cos(n),o=Math.sin(n),l=Math.cos(i),c=Math.sin(i),h=Math.cos(s),u=Math.sin(s);if(t.order==="XYZ"){const f=a*h,d=a*u,g=o*h,_=o*u;e[0]=l*h,e[4]=-l*u,e[8]=c,e[1]=d+g*c,e[5]=f-_*c,e[9]=-o*l,e[2]=_-f*c,e[6]=g+d*c,e[10]=a*l}else if(t.order==="YXZ"){const f=l*h,d=l*u,g=c*h,_=c*u;e[0]=f+_*o,e[4]=g*o-d,e[8]=a*c,e[1]=a*u,e[5]=a*h,e[9]=-o,e[2]=d*o-g,e[6]=_+f*o,e[10]=a*l}else if(t.order==="ZXY"){const f=l*h,d=l*u,g=c*h,_=c*u;e[0]=f-_*o,e[4]=-a*u,e[8]=g+d*o,e[1]=d+g*o,e[5]=a*h,e[9]=_-f*o,e[2]=-a*c,e[6]=o,e[10]=a*l}else if(t.order==="ZYX"){const f=a*h,d=a*u,g=o*h,_=o*u;e[0]=l*h,e[4]=g*c-d,e[8]=f*c+_,e[1]=l*u,e[5]=_*c+f,e[9]=d*c-g,e[2]=-c,e[6]=o*l,e[10]=a*l}else if(t.order==="YZX"){const f=a*l,d=a*c,g=o*l,_=o*c;e[0]=l*h,e[4]=_-f*u,e[8]=g*u+d,e[1]=u,e[5]=a*h,e[9]=-o*h,e[2]=-c*h,e[6]=d*u+g,e[10]=f-_*u}else if(t.order==="XZY"){const f=a*l,d=a*c,g=o*l,_=o*c;e[0]=l*h,e[4]=-u,e[8]=c*h,e[1]=f*u+_,e[5]=a*h,e[9]=d*u-g,e[2]=g*u-d,e[6]=o*h,e[10]=_*u+f}return e[3]=0,e[7]=0,e[11]=0,e[12]=0,e[13]=0,e[14]=0,e[15]=1,this}makeRotationFromQuaternion(t){return this.compose(qh,t,Xh)}lookAt(t,e,n){const i=this.elements;return We.subVectors(t,e),We.lengthSq()===0&&(We.z=1),We.normalize(),Un.crossVectors(n,We),Un.lengthSq()===0&&(Math.abs(n.z)===1?We.x+=1e-4:We.z+=1e-4,We.normalize(),Un.crossVectors(n,We)),Un.normalize(),As.crossVectors(We,Un),i[0]=Un.x,i[4]=As.x,i[8]=We.x,i[1]=Un.y,i[5]=As.y,i[9]=We.y,i[2]=Un.z,i[6]=As.z,i[10]=We.z,this}multiply(t){return this.multiplyMatrices(this,t)}premultiply(t){return this.multiplyMatrices(t,this)}multiplyMatrices(t,e){const n=t.elements,i=e.elements,s=this.elements,a=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],f=n[9],d=n[13],g=n[2],_=n[6],m=n[10],p=n[14],b=n[3],E=n[7],y=n[11],w=n[15],A=i[0],C=i[4],L=i[8],M=i[12],x=i[1],P=i[5],F=i[9],B=i[13],k=i[2],V=i[6],X=i[10],Z=i[14],W=i[3],rt=i[7],ct=i[11],St=i[15];return s[0]=a*A+o*x+l*k+c*W,s[4]=a*C+o*P+l*V+c*rt,s[8]=a*L+o*F+l*X+c*ct,s[12]=a*M+o*B+l*Z+c*St,s[1]=h*A+u*x+f*k+d*W,s[5]=h*C+u*P+f*V+d*rt,s[9]=h*L+u*F+f*X+d*ct,s[13]=h*M+u*B+f*Z+d*St,s[2]=g*A+_*x+m*k+p*W,s[6]=g*C+_*P+m*V+p*rt,s[10]=g*L+_*F+m*X+p*ct,s[14]=g*M+_*B+m*Z+p*St,s[3]=b*A+E*x+y*k+w*W,s[7]=b*C+E*P+y*V+w*rt,s[11]=b*L+E*F+y*X+w*ct,s[15]=b*M+E*B+y*Z+w*St,this}multiplyScalar(t){const e=this.elements;return e[0]*=t,e[4]*=t,e[8]*=t,e[12]*=t,e[1]*=t,e[5]*=t,e[9]*=t,e[13]*=t,e[2]*=t,e[6]*=t,e[10]*=t,e[14]*=t,e[3]*=t,e[7]*=t,e[11]*=t,e[15]*=t,this}determinant(){const t=this.elements,e=t[0],n=t[4],i=t[8],s=t[12],a=t[1],o=t[5],l=t[9],c=t[13],h=t[2],u=t[6],f=t[10],d=t[14],g=t[3],_=t[7],m=t[11],p=t[15];return g*(+s*l*u-i*c*u-s*o*f+n*c*f+i*o*d-n*l*d)+_*(+e*l*d-e*c*f+s*a*f-i*a*d+i*c*h-s*l*h)+m*(+e*c*u-e*o*d-s*a*u+n*a*d+s*o*h-n*c*h)+p*(-i*o*h-e*l*u+e*o*f+i*a*u-n*a*f+n*l*h)}transpose(){const t=this.elements;let e;return e=t[1],t[1]=t[4],t[4]=e,e=t[2],t[2]=t[8],t[8]=e,e=t[6],t[6]=t[9],t[9]=e,e=t[3],t[3]=t[12],t[12]=e,e=t[7],t[7]=t[13],t[13]=e,e=t[11],t[11]=t[14],t[14]=e,this}setPosition(t,e,n){const i=this.elements;return t.isVector3?(i[12]=t.x,i[13]=t.y,i[14]=t.z):(i[12]=t,i[13]=e,i[14]=n),this}invert(){const t=this.elements,e=t[0],n=t[1],i=t[2],s=t[3],a=t[4],o=t[5],l=t[6],c=t[7],h=t[8],u=t[9],f=t[10],d=t[11],g=t[12],_=t[13],m=t[14],p=t[15],b=u*m*c-_*f*c+_*l*d-o*m*d-u*l*p+o*f*p,E=g*f*c-h*m*c-g*l*d+a*m*d+h*l*p-a*f*p,y=h*_*c-g*u*c+g*o*d-a*_*d-h*o*p+a*u*p,w=g*u*l-h*_*l-g*o*f+a*_*f+h*o*m-a*u*m,A=e*b+n*E+i*y+s*w;if(A===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const C=1/A;return t[0]=b*C,t[1]=(_*f*s-u*m*s-_*i*d+n*m*d+u*i*p-n*f*p)*C,t[2]=(o*m*s-_*l*s+_*i*c-n*m*c-o*i*p+n*l*p)*C,t[3]=(u*l*s-o*f*s-u*i*c+n*f*c+o*i*d-n*l*d)*C,t[4]=E*C,t[5]=(h*m*s-g*f*s+g*i*d-e*m*d-h*i*p+e*f*p)*C,t[6]=(g*l*s-a*m*s-g*i*c+e*m*c+a*i*p-e*l*p)*C,t[7]=(a*f*s-h*l*s+h*i*c-e*f*c-a*i*d+e*l*d)*C,t[8]=y*C,t[9]=(g*u*s-h*_*s-g*n*d+e*_*d+h*n*p-e*u*p)*C,t[10]=(a*_*s-g*o*s+g*n*c-e*_*c-a*n*p+e*o*p)*C,t[11]=(h*o*s-a*u*s-h*n*c+e*u*c+a*n*d-e*o*d)*C,t[12]=w*C,t[13]=(h*_*i-g*u*i+g*n*f-e*_*f-h*n*m+e*u*m)*C,t[14]=(g*o*i-a*_*i-g*n*l+e*_*l+a*n*m-e*o*m)*C,t[15]=(a*u*i-h*o*i+h*n*l-e*u*l-a*n*f+e*o*f)*C,this}scale(t){const e=this.elements,n=t.x,i=t.y,s=t.z;return e[0]*=n,e[4]*=i,e[8]*=s,e[1]*=n,e[5]*=i,e[9]*=s,e[2]*=n,e[6]*=i,e[10]*=s,e[3]*=n,e[7]*=i,e[11]*=s,this}getMaxScaleOnAxis(){const t=this.elements,e=t[0]*t[0]+t[1]*t[1]+t[2]*t[2],n=t[4]*t[4]+t[5]*t[5]+t[6]*t[6],i=t[8]*t[8]+t[9]*t[9]+t[10]*t[10];return Math.sqrt(Math.max(e,n,i))}makeTranslation(t,e,n){return t.isVector3?this.set(1,0,0,t.x,0,1,0,t.y,0,0,1,t.z,0,0,0,1):this.set(1,0,0,t,0,1,0,e,0,0,1,n,0,0,0,1),this}makeRotationX(t){const e=Math.cos(t),n=Math.sin(t);return this.set(1,0,0,0,0,e,-n,0,0,n,e,0,0,0,0,1),this}makeRotationY(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,0,n,0,0,1,0,0,-n,0,e,0,0,0,0,1),this}makeRotationZ(t){const e=Math.cos(t),n=Math.sin(t);return this.set(e,-n,0,0,n,e,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(t,e){const n=Math.cos(e),i=Math.sin(e),s=1-n,a=t.x,o=t.y,l=t.z,c=s*a,h=s*o;return this.set(c*a+n,c*o-i*l,c*l+i*o,0,c*o+i*l,h*o+n,h*l-i*a,0,c*l-i*o,h*l+i*a,s*l*l+n,0,0,0,0,1),this}makeScale(t,e,n){return this.set(t,0,0,0,0,e,0,0,0,0,n,0,0,0,0,1),this}makeShear(t,e,n,i,s,a){return this.set(1,n,s,0,t,1,a,0,e,i,1,0,0,0,0,1),this}compose(t,e,n){const i=this.elements,s=e._x,a=e._y,o=e._z,l=e._w,c=s+s,h=a+a,u=o+o,f=s*c,d=s*h,g=s*u,_=a*h,m=a*u,p=o*u,b=l*c,E=l*h,y=l*u,w=n.x,A=n.y,C=n.z;return i[0]=(1-(_+p))*w,i[1]=(d+y)*w,i[2]=(g-E)*w,i[3]=0,i[4]=(d-y)*A,i[5]=(1-(f+p))*A,i[6]=(m+b)*A,i[7]=0,i[8]=(g+E)*C,i[9]=(m-b)*C,i[10]=(1-(f+_))*C,i[11]=0,i[12]=t.x,i[13]=t.y,i[14]=t.z,i[15]=1,this}decompose(t,e,n){const i=this.elements;let s=xi.set(i[0],i[1],i[2]).length();const a=xi.set(i[4],i[5],i[6]).length(),o=xi.set(i[8],i[9],i[10]).length();this.determinant()<0&&(s=-s),t.x=i[12],t.y=i[13],t.z=i[14],rn.copy(this);const c=1/s,h=1/a,u=1/o;return rn.elements[0]*=c,rn.elements[1]*=c,rn.elements[2]*=c,rn.elements[4]*=h,rn.elements[5]*=h,rn.elements[6]*=h,rn.elements[8]*=u,rn.elements[9]*=u,rn.elements[10]*=u,e.setFromRotationMatrix(rn),n.x=s,n.y=a,n.z=o,this}makePerspective(t,e,n,i,s,a,o=_n,l=!1){const c=this.elements,h=2*s/(e-t),u=2*s/(n-i),f=(e+t)/(e-t),d=(n+i)/(n-i);let g,_;if(l)g=s/(a-s),_=a*s/(a-s);else if(o===_n)g=-(a+s)/(a-s),_=-2*a*s/(a-s);else if(o===or)g=-a/(a-s),_=-a*s/(a-s);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=f,c[12]=0,c[1]=0,c[5]=u,c[9]=d,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=_,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(t,e,n,i,s,a,o=_n,l=!1){const c=this.elements,h=2/(e-t),u=2/(n-i),f=-(e+t)/(e-t),d=-(n+i)/(n-i);let g,_;if(l)g=1/(a-s),_=a/(a-s);else if(o===_n)g=-2/(a-s),_=-(a+s)/(a-s);else if(o===or)g=-1/(a-s),_=-s/(a-s);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=f,c[1]=0,c[5]=u,c[9]=0,c[13]=d,c[2]=0,c[6]=0,c[10]=g,c[14]=_,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(t){const e=this.elements,n=t.elements;for(let i=0;i<16;i++)if(e[i]!==n[i])return!1;return!0}fromArray(t,e=0){for(let n=0;n<16;n++)this.elements[n]=t[n+e];return this}toArray(t=[],e=0){const n=this.elements;return t[e]=n[0],t[e+1]=n[1],t[e+2]=n[2],t[e+3]=n[3],t[e+4]=n[4],t[e+5]=n[5],t[e+6]=n[6],t[e+7]=n[7],t[e+8]=n[8],t[e+9]=n[9],t[e+10]=n[10],t[e+11]=n[11],t[e+12]=n[12],t[e+13]=n[13],t[e+14]=n[14],t[e+15]=n[15],t}}const xi=new U,rn=new Yt,qh=new U(0,0,0),Xh=new U(1,1,1),Un=new U,As=new U,We=new U,qo=new Yt,Xo=new Gn;class hn{constructor(t=0,e=0,n=0,i=hn.DEFAULT_ORDER){this.isEuler=!0,this._x=t,this._y=e,this._z=n,this._order=i}get x(){return this._x}set x(t){this._x=t,this._onChangeCallback()}get y(){return this._y}set y(t){this._y=t,this._onChangeCallback()}get z(){return this._z}set z(t){this._z=t,this._onChangeCallback()}get order(){return this._order}set order(t){this._order=t,this._onChangeCallback()}set(t,e,n,i=this._order){return this._x=t,this._y=e,this._z=n,this._order=i,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(t){return this._x=t._x,this._y=t._y,this._z=t._z,this._order=t._order,this._onChangeCallback(),this}setFromRotationMatrix(t,e=this._order,n=!0){const i=t.elements,s=i[0],a=i[4],o=i[8],l=i[1],c=i[5],h=i[9],u=i[2],f=i[6],d=i[10];switch(e){case"XYZ":this._y=Math.asin(Wt(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,d),this._z=Math.atan2(-a,s)):(this._x=Math.atan2(f,c),this._z=0);break;case"YXZ":this._x=Math.asin(-Wt(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,d),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,s),this._z=0);break;case"ZXY":this._x=Math.asin(Wt(f,-1,1)),Math.abs(f)<.9999999?(this._y=Math.atan2(-u,d),this._z=Math.atan2(-a,c)):(this._y=0,this._z=Math.atan2(l,s));break;case"ZYX":this._y=Math.asin(-Wt(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(f,d),this._z=Math.atan2(l,s)):(this._x=0,this._z=Math.atan2(-a,c));break;case"YZX":this._z=Math.asin(Wt(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,s)):(this._x=0,this._y=Math.atan2(o,d));break;case"XZY":this._z=Math.asin(-Wt(a,-1,1)),Math.abs(a)<.9999999?(this._x=Math.atan2(f,c),this._y=Math.atan2(o,s)):(this._x=Math.atan2(-h,d),this._y=0);break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+e)}return this._order=e,n===!0&&this._onChangeCallback(),this}setFromQuaternion(t,e,n){return qo.makeRotationFromQuaternion(t),this.setFromRotationMatrix(qo,e,n)}setFromVector3(t,e=this._order){return this.set(t.x,t.y,t.z,e)}reorder(t){return Xo.setFromEuler(this),this.setFromQuaternion(Xo,t)}equals(t){return t._x===this._x&&t._y===this._y&&t._z===this._z&&t._order===this._order}fromArray(t){return this._x=t[0],this._y=t[1],this._z=t[2],t[3]!==void 0&&(this._order=t[3]),this._onChangeCallback(),this}toArray(t=[],e=0){return t[e]=this._x,t[e+1]=this._y,t[e+2]=this._z,t[e+3]=this._order,t}_onChange(t){return this._onChangeCallback=t,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}hn.DEFAULT_ORDER="XYZ";class vo{constructor(){this.mask=1}set(t){this.mask=(1<<t|0)>>>0}enable(t){this.mask|=1<<t|0}enableAll(){this.mask=-1}toggle(t){this.mask^=1<<t|0}disable(t){this.mask&=~(1<<t|0)}disableAll(){this.mask=0}test(t){return(this.mask&t.mask)!==0}isEnabled(t){return(this.mask&(1<<t|0))!==0}}let Yh=0;const Yo=new U,Mi=new Gn,bn=new Yt,Rs=new U,Qi=new U,Kh=new U,jh=new Gn,Ko=new U(1,0,0),jo=new U(0,1,0),Zo=new U(0,0,1),$o={type:"added"},Zh={type:"removed"},yi={type:"childadded",child:null},Nr={type:"childremoved",child:null};class Me extends Xi{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Yh++}),this.uuid=gs(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=Me.DEFAULT_UP.clone();const t=new U,e=new hn,n=new Gn,i=new U(1,1,1);function s(){n.setFromEuler(e,!1)}function a(){e.setFromQuaternion(n,void 0,!1)}e._onChange(s),n._onChange(a),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:t},rotation:{configurable:!0,enumerable:!0,value:e},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:i},modelViewMatrix:{value:new Yt},normalMatrix:{value:new Nt}}),this.matrix=new Yt,this.matrixWorld=new Yt,this.matrixAutoUpdate=Me.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=Me.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new vo,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(t){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(t),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(t){return this.quaternion.premultiply(t),this}setRotationFromAxisAngle(t,e){this.quaternion.setFromAxisAngle(t,e)}setRotationFromEuler(t){this.quaternion.setFromEuler(t,!0)}setRotationFromMatrix(t){this.quaternion.setFromRotationMatrix(t)}setRotationFromQuaternion(t){this.quaternion.copy(t)}rotateOnAxis(t,e){return Mi.setFromAxisAngle(t,e),this.quaternion.multiply(Mi),this}rotateOnWorldAxis(t,e){return Mi.setFromAxisAngle(t,e),this.quaternion.premultiply(Mi),this}rotateX(t){return this.rotateOnAxis(Ko,t)}rotateY(t){return this.rotateOnAxis(jo,t)}rotateZ(t){return this.rotateOnAxis(Zo,t)}translateOnAxis(t,e){return Yo.copy(t).applyQuaternion(this.quaternion),this.position.add(Yo.multiplyScalar(e)),this}translateX(t){return this.translateOnAxis(Ko,t)}translateY(t){return this.translateOnAxis(jo,t)}translateZ(t){return this.translateOnAxis(Zo,t)}localToWorld(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(this.matrixWorld)}worldToLocal(t){return this.updateWorldMatrix(!0,!1),t.applyMatrix4(bn.copy(this.matrixWorld).invert())}lookAt(t,e,n){t.isVector3?Rs.copy(t):Rs.set(t,e,n);const i=this.parent;this.updateWorldMatrix(!0,!1),Qi.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?bn.lookAt(Qi,Rs,this.up):bn.lookAt(Rs,Qi,this.up),this.quaternion.setFromRotationMatrix(bn),i&&(bn.extractRotation(i.matrixWorld),Mi.setFromRotationMatrix(bn),this.quaternion.premultiply(Mi.invert()))}add(t){if(arguments.length>1){for(let e=0;e<arguments.length;e++)this.add(arguments[e]);return this}return t===this?(console.error("THREE.Object3D.add: object can't be added as a child of itself.",t),this):(t&&t.isObject3D?(t.removeFromParent(),t.parent=this,this.children.push(t),t.dispatchEvent($o),yi.child=t,this.dispatchEvent(yi),yi.child=null):console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",t),this)}remove(t){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const e=this.children.indexOf(t);return e!==-1&&(t.parent=null,this.children.splice(e,1),t.dispatchEvent(Zh),Nr.child=t,this.dispatchEvent(Nr),Nr.child=null),this}removeFromParent(){const t=this.parent;return t!==null&&t.remove(this),this}clear(){return this.remove(...this.children)}attach(t){return this.updateWorldMatrix(!0,!1),bn.copy(this.matrixWorld).invert(),t.parent!==null&&(t.parent.updateWorldMatrix(!0,!1),bn.multiply(t.parent.matrixWorld)),t.applyMatrix4(bn),t.removeFromParent(),t.parent=this,this.children.push(t),t.updateWorldMatrix(!1,!0),t.dispatchEvent($o),yi.child=t,this.dispatchEvent(yi),yi.child=null,this}getObjectById(t){return this.getObjectByProperty("id",t)}getObjectByName(t){return this.getObjectByProperty("name",t)}getObjectByProperty(t,e){if(this[t]===e)return this;for(let n=0,i=this.children.length;n<i;n++){const a=this.children[n].getObjectByProperty(t,e);if(a!==void 0)return a}}getObjectsByProperty(t,e,n=[]){this[t]===e&&n.push(this);const i=this.children;for(let s=0,a=i.length;s<a;s++)i[s].getObjectsByProperty(t,e,n);return n}getWorldPosition(t){return this.updateWorldMatrix(!0,!1),t.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Qi,t,Kh),t}getWorldScale(t){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(Qi,jh,t),t}getWorldDirection(t){this.updateWorldMatrix(!0,!1);const e=this.matrixWorld.elements;return t.set(e[8],e[9],e[10]).normalize()}raycast(){}traverse(t){t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverse(t)}traverseVisible(t){if(this.visible===!1)return;t(this);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].traverseVisible(t)}traverseAncestors(t){const e=this.parent;e!==null&&(t(e),e.traverseAncestors(t))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(t){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||t)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,t=!0);const e=this.children;for(let n=0,i=e.length;n<i;n++)e[n].updateMatrixWorld(t)}updateWorldMatrix(t,e){const n=this.parent;if(t===!0&&n!==null&&n.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),e===!0){const i=this.children;for(let s=0,a=i.length;s<a;s++)i[s].updateWorldMatrix(!1,!0)}}toJSON(t){const e=t===void 0||typeof t=="string",n={};e&&(t={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const i={};i.uuid=this.uuid,i.type=this.type,this.name!==""&&(i.name=this.name),this.castShadow===!0&&(i.castShadow=!0),this.receiveShadow===!0&&(i.receiveShadow=!0),this.visible===!1&&(i.visible=!1),this.frustumCulled===!1&&(i.frustumCulled=!1),this.renderOrder!==0&&(i.renderOrder=this.renderOrder),Object.keys(this.userData).length>0&&(i.userData=this.userData),i.layers=this.layers.mask,i.matrix=this.matrix.toArray(),i.up=this.up.toArray(),this.matrixAutoUpdate===!1&&(i.matrixAutoUpdate=!1),this.isInstancedMesh&&(i.type="InstancedMesh",i.count=this.count,i.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(i.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(i.type="BatchedMesh",i.perObjectFrustumCulled=this.perObjectFrustumCulled,i.sortObjects=this.sortObjects,i.drawRanges=this._drawRanges,i.reservedRanges=this._reservedRanges,i.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),i.instanceInfo=this._instanceInfo.map(o=>({...o})),i.availableInstanceIds=this._availableInstanceIds.slice(),i.availableGeometryIds=this._availableGeometryIds.slice(),i.nextIndexStart=this._nextIndexStart,i.nextVertexStart=this._nextVertexStart,i.geometryCount=this._geometryCount,i.maxInstanceCount=this._maxInstanceCount,i.maxVertexCount=this._maxVertexCount,i.maxIndexCount=this._maxIndexCount,i.geometryInitialized=this._geometryInitialized,i.matricesTexture=this._matricesTexture.toJSON(t),i.indirectTexture=this._indirectTexture.toJSON(t),this._colorsTexture!==null&&(i.colorsTexture=this._colorsTexture.toJSON(t)),this.boundingSphere!==null&&(i.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(i.boundingBox=this.boundingBox.toJSON()));function s(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(t)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?i.background=this.background.toJSON():this.background.isTexture&&(i.background=this.background.toJSON(t).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(i.environment=this.environment.toJSON(t).uuid);else if(this.isMesh||this.isLine||this.isPoints){i.geometry=s(t.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];s(t.shapes,u)}else s(t.shapes,l)}}if(this.isSkinnedMesh&&(i.bindMode=this.bindMode,i.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(s(t.skeletons,this.skeleton),i.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(s(t.materials,this.material[l]));i.material=o}else i.material=s(t.materials,this.material);if(this.children.length>0){i.children=[];for(let o=0;o<this.children.length;o++)i.children.push(this.children[o].toJSON(t).object)}if(this.animations.length>0){i.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];i.animations.push(s(t.animations,l))}}if(e){const o=a(t.geometries),l=a(t.materials),c=a(t.textures),h=a(t.images),u=a(t.shapes),f=a(t.skeletons),d=a(t.animations),g=a(t.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),f.length>0&&(n.skeletons=f),d.length>0&&(n.animations=d),g.length>0&&(n.nodes=g)}return n.object=i,n;function a(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(t){return new this.constructor().copy(this,t)}copy(t,e=!0){if(this.name=t.name,this.up.copy(t.up),this.position.copy(t.position),this.rotation.order=t.rotation.order,this.quaternion.copy(t.quaternion),this.scale.copy(t.scale),this.matrix.copy(t.matrix),this.matrixWorld.copy(t.matrixWorld),this.matrixAutoUpdate=t.matrixAutoUpdate,this.matrixWorldAutoUpdate=t.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=t.matrixWorldNeedsUpdate,this.layers.mask=t.layers.mask,this.visible=t.visible,this.castShadow=t.castShadow,this.receiveShadow=t.receiveShadow,this.frustumCulled=t.frustumCulled,this.renderOrder=t.renderOrder,this.animations=t.animations.slice(),this.userData=JSON.parse(JSON.stringify(t.userData)),e===!0)for(let n=0;n<t.children.length;n++){const i=t.children[n];this.add(i.clone())}return this}}Me.DEFAULT_UP=new U(0,1,0);Me.DEFAULT_MATRIX_AUTO_UPDATE=!0;Me.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;const an=new U,En=new U,Or=new U,Tn=new U,Si=new U,bi=new U,Jo=new U,zr=new U,Br=new U,kr=new U,Vr=new te,Hr=new te,Gr=new te;class ln{constructor(t=new U,e=new U,n=new U){this.a=t,this.b=e,this.c=n}static getNormal(t,e,n,i){i.subVectors(n,e),an.subVectors(t,e),i.cross(an);const s=i.lengthSq();return s>0?i.multiplyScalar(1/Math.sqrt(s)):i.set(0,0,0)}static getBarycoord(t,e,n,i,s){an.subVectors(i,e),En.subVectors(n,e),Or.subVectors(t,e);const a=an.dot(an),o=an.dot(En),l=an.dot(Or),c=En.dot(En),h=En.dot(Or),u=a*c-o*o;if(u===0)return s.set(0,0,0),null;const f=1/u,d=(c*l-o*h)*f,g=(a*h-o*l)*f;return s.set(1-d-g,g,d)}static containsPoint(t,e,n,i){return this.getBarycoord(t,e,n,i,Tn)===null?!1:Tn.x>=0&&Tn.y>=0&&Tn.x+Tn.y<=1}static getInterpolation(t,e,n,i,s,a,o,l){return this.getBarycoord(t,e,n,i,Tn)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(s,Tn.x),l.addScaledVector(a,Tn.y),l.addScaledVector(o,Tn.z),l)}static getInterpolatedAttribute(t,e,n,i,s,a){return Vr.setScalar(0),Hr.setScalar(0),Gr.setScalar(0),Vr.fromBufferAttribute(t,e),Hr.fromBufferAttribute(t,n),Gr.fromBufferAttribute(t,i),a.setScalar(0),a.addScaledVector(Vr,s.x),a.addScaledVector(Hr,s.y),a.addScaledVector(Gr,s.z),a}static isFrontFacing(t,e,n,i){return an.subVectors(n,e),En.subVectors(t,e),an.cross(En).dot(i)<0}set(t,e,n){return this.a.copy(t),this.b.copy(e),this.c.copy(n),this}setFromPointsAndIndices(t,e,n,i){return this.a.copy(t[e]),this.b.copy(t[n]),this.c.copy(t[i]),this}setFromAttributeAndIndices(t,e,n,i){return this.a.fromBufferAttribute(t,e),this.b.fromBufferAttribute(t,n),this.c.fromBufferAttribute(t,i),this}clone(){return new this.constructor().copy(this)}copy(t){return this.a.copy(t.a),this.b.copy(t.b),this.c.copy(t.c),this}getArea(){return an.subVectors(this.c,this.b),En.subVectors(this.a,this.b),an.cross(En).length()*.5}getMidpoint(t){return t.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(t){return ln.getNormal(this.a,this.b,this.c,t)}getPlane(t){return t.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(t,e){return ln.getBarycoord(t,this.a,this.b,this.c,e)}getInterpolation(t,e,n,i,s){return ln.getInterpolation(t,this.a,this.b,this.c,e,n,i,s)}containsPoint(t){return ln.containsPoint(t,this.a,this.b,this.c)}isFrontFacing(t){return ln.isFrontFacing(this.a,this.b,this.c,t)}intersectsBox(t){return t.intersectsTriangle(this)}closestPointToPoint(t,e){const n=this.a,i=this.b,s=this.c;let a,o;Si.subVectors(i,n),bi.subVectors(s,n),zr.subVectors(t,n);const l=Si.dot(zr),c=bi.dot(zr);if(l<=0&&c<=0)return e.copy(n);Br.subVectors(t,i);const h=Si.dot(Br),u=bi.dot(Br);if(h>=0&&u<=h)return e.copy(i);const f=l*u-h*c;if(f<=0&&l>=0&&h<=0)return a=l/(l-h),e.copy(n).addScaledVector(Si,a);kr.subVectors(t,s);const d=Si.dot(kr),g=bi.dot(kr);if(g>=0&&d<=g)return e.copy(s);const _=d*c-l*g;if(_<=0&&c>=0&&g<=0)return o=c/(c-g),e.copy(n).addScaledVector(bi,o);const m=h*g-d*u;if(m<=0&&u-h>=0&&d-g>=0)return Jo.subVectors(s,i),o=(u-h)/(u-h+(d-g)),e.copy(i).addScaledVector(Jo,o);const p=1/(m+_+f);return a=_*p,o=f*p,e.copy(n).addScaledVector(Si,a).addScaledVector(bi,o)}equals(t){return t.a.equals(this.a)&&t.b.equals(this.b)&&t.c.equals(this.c)}}const Rc={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},In={h:0,s:0,l:0},Cs={h:0,s:0,l:0};function Wr(r,t,e){return e<0&&(e+=1),e>1&&(e-=1),e<1/6?r+(t-r)*6*e:e<1/2?t:e<2/3?r+(t-r)*6*(2/3-e):r}class vt{constructor(t,e,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(t,e,n)}set(t,e,n){if(e===void 0&&n===void 0){const i=t;i&&i.isColor?this.copy(i):typeof i=="number"?this.setHex(i):typeof i=="string"&&this.setStyle(i)}else this.setRGB(t,e,n);return this}setScalar(t){return this.r=t,this.g=t,this.b=t,this}setHex(t,e=Xe){return t=Math.floor(t),this.r=(t>>16&255)/255,this.g=(t>>8&255)/255,this.b=(t&255)/255,Xt.colorSpaceToWorking(this,e),this}setRGB(t,e,n,i=Xt.workingColorSpace){return this.r=t,this.g=e,this.b=n,Xt.colorSpaceToWorking(this,i),this}setHSL(t,e,n,i=Xt.workingColorSpace){if(t=Fh(t,1),e=Wt(e,0,1),n=Wt(n,0,1),e===0)this.r=this.g=this.b=n;else{const s=n<=.5?n*(1+e):n+e-n*e,a=2*n-s;this.r=Wr(a,s,t+1/3),this.g=Wr(a,s,t),this.b=Wr(a,s,t-1/3)}return Xt.colorSpaceToWorking(this,i),this}setStyle(t,e=Xe){function n(s){s!==void 0&&parseFloat(s)<1&&console.warn("THREE.Color: Alpha component of "+t+" will be ignored.")}let i;if(i=/^(\w+)\(([^\)]*)\)/.exec(t)){let s;const a=i[1],o=i[2];switch(a){case"rgb":case"rgba":if(s=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(255,parseInt(s[1],10))/255,Math.min(255,parseInt(s[2],10))/255,Math.min(255,parseInt(s[3],10))/255,e);if(s=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setRGB(Math.min(100,parseInt(s[1],10))/100,Math.min(100,parseInt(s[2],10))/100,Math.min(100,parseInt(s[3],10))/100,e);break;case"hsl":case"hsla":if(s=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(s[4]),this.setHSL(parseFloat(s[1])/360,parseFloat(s[2])/100,parseFloat(s[3])/100,e);break;default:console.warn("THREE.Color: Unknown color model "+t)}}else if(i=/^\#([A-Fa-f\d]+)$/.exec(t)){const s=i[1],a=s.length;if(a===3)return this.setRGB(parseInt(s.charAt(0),16)/15,parseInt(s.charAt(1),16)/15,parseInt(s.charAt(2),16)/15,e);if(a===6)return this.setHex(parseInt(s,16),e);console.warn("THREE.Color: Invalid hex color "+t)}else if(t&&t.length>0)return this.setColorName(t,e);return this}setColorName(t,e=Xe){const n=Rc[t.toLowerCase()];return n!==void 0?this.setHex(n,e):console.warn("THREE.Color: Unknown color "+t),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(t){return this.r=t.r,this.g=t.g,this.b=t.b,this}copySRGBToLinear(t){return this.r=Rn(t.r),this.g=Rn(t.g),this.b=Rn(t.b),this}copyLinearToSRGB(t){return this.r=Ii(t.r),this.g=Ii(t.g),this.b=Ii(t.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(t=Xe){return Xt.workingToColorSpace(Pe.copy(this),t),Math.round(Wt(Pe.r*255,0,255))*65536+Math.round(Wt(Pe.g*255,0,255))*256+Math.round(Wt(Pe.b*255,0,255))}getHexString(t=Xe){return("000000"+this.getHex(t).toString(16)).slice(-6)}getHSL(t,e=Xt.workingColorSpace){Xt.workingToColorSpace(Pe.copy(this),e);const n=Pe.r,i=Pe.g,s=Pe.b,a=Math.max(n,i,s),o=Math.min(n,i,s);let l,c;const h=(o+a)/2;if(o===a)l=0,c=0;else{const u=a-o;switch(c=h<=.5?u/(a+o):u/(2-a-o),a){case n:l=(i-s)/u+(i<s?6:0);break;case i:l=(s-n)/u+2;break;case s:l=(n-i)/u+4;break}l/=6}return t.h=l,t.s=c,t.l=h,t}getRGB(t,e=Xt.workingColorSpace){return Xt.workingToColorSpace(Pe.copy(this),e),t.r=Pe.r,t.g=Pe.g,t.b=Pe.b,t}getStyle(t=Xe){Xt.workingToColorSpace(Pe.copy(this),t);const e=Pe.r,n=Pe.g,i=Pe.b;return t!==Xe?`color(${t} ${e.toFixed(3)} ${n.toFixed(3)} ${i.toFixed(3)})`:`rgb(${Math.round(e*255)},${Math.round(n*255)},${Math.round(i*255)})`}offsetHSL(t,e,n){return this.getHSL(In),this.setHSL(In.h+t,In.s+e,In.l+n)}add(t){return this.r+=t.r,this.g+=t.g,this.b+=t.b,this}addColors(t,e){return this.r=t.r+e.r,this.g=t.g+e.g,this.b=t.b+e.b,this}addScalar(t){return this.r+=t,this.g+=t,this.b+=t,this}sub(t){return this.r=Math.max(0,this.r-t.r),this.g=Math.max(0,this.g-t.g),this.b=Math.max(0,this.b-t.b),this}multiply(t){return this.r*=t.r,this.g*=t.g,this.b*=t.b,this}multiplyScalar(t){return this.r*=t,this.g*=t,this.b*=t,this}lerp(t,e){return this.r+=(t.r-this.r)*e,this.g+=(t.g-this.g)*e,this.b+=(t.b-this.b)*e,this}lerpColors(t,e,n){return this.r=t.r+(e.r-t.r)*n,this.g=t.g+(e.g-t.g)*n,this.b=t.b+(e.b-t.b)*n,this}lerpHSL(t,e){this.getHSL(In),t.getHSL(Cs);const n=wr(In.h,Cs.h,e),i=wr(In.s,Cs.s,e),s=wr(In.l,Cs.l,e);return this.setHSL(n,i,s),this}setFromVector3(t){return this.r=t.x,this.g=t.y,this.b=t.z,this}applyMatrix3(t){const e=this.r,n=this.g,i=this.b,s=t.elements;return this.r=s[0]*e+s[3]*n+s[6]*i,this.g=s[1]*e+s[4]*n+s[7]*i,this.b=s[2]*e+s[5]*n+s[8]*i,this}equals(t){return t.r===this.r&&t.g===this.g&&t.b===this.b}fromArray(t,e=0){return this.r=t[e],this.g=t[e+1],this.b=t[e+2],this}toArray(t=[],e=0){return t[e]=this.r,t[e+1]=this.g,t[e+2]=this.b,t}fromBufferAttribute(t,e){return this.r=t.getX(e),this.g=t.getY(e),this.b=t.getZ(e),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Pe=new vt;vt.NAMES=Rc;let $h=0;class hi extends Xi{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:$h++}),this.uuid=gs(),this.name="",this.type="Material",this.blending=ai,this.side=Vn,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=fa,this.blendDst=da,this.blendEquation=ni,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new vt(0,0,0),this.blendAlpha=0,this.depthFunc=Ni,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=zo,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=pi,this.stencilZFail=pi,this.stencilZPass=pi,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(t){this._alphaTest>0!=t>0&&this.version++,this._alphaTest=t}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(t){if(t!==void 0)for(const e in t){const n=t[e];if(n===void 0){console.warn(`THREE.Material: parameter '${e}' has value of undefined.`);continue}const i=this[e];if(i===void 0){console.warn(`THREE.Material: '${e}' is not a property of THREE.${this.type}.`);continue}i&&i.isColor?i.set(n):i&&i.isVector3&&n&&n.isVector3?i.copy(n):this[e]=n}}toJSON(t){const e=t===void 0||typeof t=="string";e&&(t={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(t).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(t).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(t).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(t).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(t).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(t).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(t).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(t).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(t).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(t).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(t).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(t).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(t).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(t).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(t).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(t).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(t).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(t).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(t).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(t).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(t).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(t).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(t).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(t).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(t).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(t).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==ai&&(n.blending=this.blending),this.side!==Vn&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==fa&&(n.blendSrc=this.blendSrc),this.blendDst!==da&&(n.blendDst=this.blendDst),this.blendEquation!==ni&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Ni&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==zo&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==pi&&(n.stencilFail=this.stencilFail),this.stencilZFail!==pi&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==pi&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function i(s){const a=[];for(const o in s){const l=s[o];delete l.metadata,a.push(l)}return a}if(e){const s=i(t.textures),a=i(t.images);s.length>0&&(n.textures=s),a.length>0&&(n.images=a)}return n}clone(){return new this.constructor().copy(this)}copy(t){this.name=t.name,this.blending=t.blending,this.side=t.side,this.vertexColors=t.vertexColors,this.opacity=t.opacity,this.transparent=t.transparent,this.blendSrc=t.blendSrc,this.blendDst=t.blendDst,this.blendEquation=t.blendEquation,this.blendSrcAlpha=t.blendSrcAlpha,this.blendDstAlpha=t.blendDstAlpha,this.blendEquationAlpha=t.blendEquationAlpha,this.blendColor.copy(t.blendColor),this.blendAlpha=t.blendAlpha,this.depthFunc=t.depthFunc,this.depthTest=t.depthTest,this.depthWrite=t.depthWrite,this.stencilWriteMask=t.stencilWriteMask,this.stencilFunc=t.stencilFunc,this.stencilRef=t.stencilRef,this.stencilFuncMask=t.stencilFuncMask,this.stencilFail=t.stencilFail,this.stencilZFail=t.stencilZFail,this.stencilZPass=t.stencilZPass,this.stencilWrite=t.stencilWrite;const e=t.clippingPlanes;let n=null;if(e!==null){const i=e.length;n=new Array(i);for(let s=0;s!==i;++s)n[s]=e[s].clone()}return this.clippingPlanes=n,this.clipIntersection=t.clipIntersection,this.clipShadows=t.clipShadows,this.shadowSide=t.shadowSide,this.colorWrite=t.colorWrite,this.precision=t.precision,this.polygonOffset=t.polygonOffset,this.polygonOffsetFactor=t.polygonOffsetFactor,this.polygonOffsetUnits=t.polygonOffsetUnits,this.dithering=t.dithering,this.alphaTest=t.alphaTest,this.alphaHash=t.alphaHash,this.alphaToCoverage=t.alphaToCoverage,this.premultipliedAlpha=t.premultipliedAlpha,this.forceSinglePass=t.forceSinglePass,this.visible=t.visible,this.toneMapped=t.toneMapped,this.userData=JSON.parse(JSON.stringify(t.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(t){t===!0&&this.version++}}class Wn extends hi{constructor(t){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new vt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new hn,this.combine=oo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.fog=t.fog,this}}const ge=new U,Ps=new Tt;let Jh=0;class we{constructor(t,e,n=!1){if(Array.isArray(t))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Jh++}),this.name="",this.array=t,this.itemSize=e,this.count=t!==void 0?t.length/e:0,this.normalized=n,this.usage=Bo,this.updateRanges=[],this.gpuType=gn,this.version=0}onUploadCallback(){}set needsUpdate(t){t===!0&&this.version++}setUsage(t){return this.usage=t,this}addUpdateRange(t,e){this.updateRanges.push({start:t,count:e})}clearUpdateRanges(){this.updateRanges.length=0}copy(t){return this.name=t.name,this.array=new t.array.constructor(t.array),this.itemSize=t.itemSize,this.count=t.count,this.normalized=t.normalized,this.usage=t.usage,this.gpuType=t.gpuType,this}copyAt(t,e,n){t*=this.itemSize,n*=e.itemSize;for(let i=0,s=this.itemSize;i<s;i++)this.array[t+i]=e.array[n+i];return this}copyArray(t){return this.array.set(t),this}applyMatrix3(t){if(this.itemSize===2)for(let e=0,n=this.count;e<n;e++)Ps.fromBufferAttribute(this,e),Ps.applyMatrix3(t),this.setXY(e,Ps.x,Ps.y);else if(this.itemSize===3)for(let e=0,n=this.count;e<n;e++)ge.fromBufferAttribute(this,e),ge.applyMatrix3(t),this.setXYZ(e,ge.x,ge.y,ge.z);return this}applyMatrix4(t){for(let e=0,n=this.count;e<n;e++)ge.fromBufferAttribute(this,e),ge.applyMatrix4(t),this.setXYZ(e,ge.x,ge.y,ge.z);return this}applyNormalMatrix(t){for(let e=0,n=this.count;e<n;e++)ge.fromBufferAttribute(this,e),ge.applyNormalMatrix(t),this.setXYZ(e,ge.x,ge.y,ge.z);return this}transformDirection(t){for(let e=0,n=this.count;e<n;e++)ge.fromBufferAttribute(this,e),ge.transformDirection(t),this.setXYZ(e,ge.x,ge.y,ge.z);return this}set(t,e=0){return this.array.set(t,e),this}getComponent(t,e){let n=this.array[t*this.itemSize+e];return this.normalized&&(n=Zi(n,this.array)),n}setComponent(t,e,n){return this.normalized&&(n=ze(n,this.array)),this.array[t*this.itemSize+e]=n,this}getX(t){let e=this.array[t*this.itemSize];return this.normalized&&(e=Zi(e,this.array)),e}setX(t,e){return this.normalized&&(e=ze(e,this.array)),this.array[t*this.itemSize]=e,this}getY(t){let e=this.array[t*this.itemSize+1];return this.normalized&&(e=Zi(e,this.array)),e}setY(t,e){return this.normalized&&(e=ze(e,this.array)),this.array[t*this.itemSize+1]=e,this}getZ(t){let e=this.array[t*this.itemSize+2];return this.normalized&&(e=Zi(e,this.array)),e}setZ(t,e){return this.normalized&&(e=ze(e,this.array)),this.array[t*this.itemSize+2]=e,this}getW(t){let e=this.array[t*this.itemSize+3];return this.normalized&&(e=Zi(e,this.array)),e}setW(t,e){return this.normalized&&(e=ze(e,this.array)),this.array[t*this.itemSize+3]=e,this}setXY(t,e,n){return t*=this.itemSize,this.normalized&&(e=ze(e,this.array),n=ze(n,this.array)),this.array[t+0]=e,this.array[t+1]=n,this}setXYZ(t,e,n,i){return t*=this.itemSize,this.normalized&&(e=ze(e,this.array),n=ze(n,this.array),i=ze(i,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this}setXYZW(t,e,n,i,s){return t*=this.itemSize,this.normalized&&(e=ze(e,this.array),n=ze(n,this.array),i=ze(i,this.array),s=ze(s,this.array)),this.array[t+0]=e,this.array[t+1]=n,this.array[t+2]=i,this.array[t+3]=s,this}onUpload(t){return this.onUploadCallback=t,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const t={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(t.name=this.name),this.usage!==Bo&&(t.usage=this.usage),t}}class Cc extends we{constructor(t,e,n){super(new Uint16Array(t),e,n)}}class Pc extends we{constructor(t,e,n){super(new Uint32Array(t),e,n)}}class Jt extends we{constructor(t,e,n){super(new Float32Array(t),e,n)}}let Qh=0;const $e=new Yt,qr=new Me,Ei=new U,qe=new ci,ts=new ci,Ee=new U;class xe extends Xi{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Qh++}),this.uuid=gs(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex(t){return Array.isArray(t)?this.index=new(wc(t)?Pc:Cc)(t,1):this.index=t,this}setIndirect(t){return this.indirect=t,this}getIndirect(){return this.indirect}getAttribute(t){return this.attributes[t]}setAttribute(t,e){return this.attributes[t]=e,this}deleteAttribute(t){return delete this.attributes[t],this}hasAttribute(t){return this.attributes[t]!==void 0}addGroup(t,e,n=0){this.groups.push({start:t,count:e,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(t,e){this.drawRange.start=t,this.drawRange.count=e}applyMatrix4(t){const e=this.attributes.position;e!==void 0&&(e.applyMatrix4(t),e.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const s=new Nt().getNormalMatrix(t);n.applyNormalMatrix(s),n.needsUpdate=!0}const i=this.attributes.tangent;return i!==void 0&&(i.transformDirection(t),i.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this}applyQuaternion(t){return $e.makeRotationFromQuaternion(t),this.applyMatrix4($e),this}rotateX(t){return $e.makeRotationX(t),this.applyMatrix4($e),this}rotateY(t){return $e.makeRotationY(t),this.applyMatrix4($e),this}rotateZ(t){return $e.makeRotationZ(t),this.applyMatrix4($e),this}translate(t,e,n){return $e.makeTranslation(t,e,n),this.applyMatrix4($e),this}scale(t,e,n){return $e.makeScale(t,e,n),this.applyMatrix4($e),this}lookAt(t){return qr.lookAt(t),qr.updateMatrix(),this.applyMatrix4(qr.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Ei).negate(),this.translate(Ei.x,Ei.y,Ei.z),this}setFromPoints(t){const e=this.getAttribute("position");if(e===void 0){const n=[];for(let i=0,s=t.length;i<s;i++){const a=t[i];n.push(a.x,a.y,a.z||0)}this.setAttribute("position",new Jt(n,3))}else{const n=Math.min(t.length,e.count);for(let i=0;i<n;i++){const s=t[i];e.setXYZ(i,s.x,s.y,s.z||0)}t.length>e.count&&console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),e.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new ci);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new U(-1/0,-1/0,-1/0),new U(1/0,1/0,1/0));return}if(t!==void 0){if(this.boundingBox.setFromBufferAttribute(t),e)for(let n=0,i=e.length;n<i;n++){const s=e[n];qe.setFromBufferAttribute(s),this.morphTargetsRelative?(Ee.addVectors(this.boundingBox.min,qe.min),this.boundingBox.expandByPoint(Ee),Ee.addVectors(this.boundingBox.max,qe.max),this.boundingBox.expandByPoint(Ee)):(this.boundingBox.expandByPoint(qe.min),this.boundingBox.expandByPoint(qe.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Cn);const t=this.attributes.position,e=this.morphAttributes.position;if(t&&t.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new U,1/0);return}if(t){const n=this.boundingSphere.center;if(qe.setFromBufferAttribute(t),e)for(let s=0,a=e.length;s<a;s++){const o=e[s];ts.setFromBufferAttribute(o),this.morphTargetsRelative?(Ee.addVectors(qe.min,ts.min),qe.expandByPoint(Ee),Ee.addVectors(qe.max,ts.max),qe.expandByPoint(Ee)):(qe.expandByPoint(ts.min),qe.expandByPoint(ts.max))}qe.getCenter(n);let i=0;for(let s=0,a=t.count;s<a;s++)Ee.fromBufferAttribute(t,s),i=Math.max(i,n.distanceToSquared(Ee));if(e)for(let s=0,a=e.length;s<a;s++){const o=e[s],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)Ee.fromBufferAttribute(o,c),l&&(Ei.fromBufferAttribute(t,c),Ee.add(Ei)),i=Math.max(i,n.distanceToSquared(Ee))}this.boundingSphere.radius=Math.sqrt(i),isNaN(this.boundingSphere.radius)&&console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const t=this.index,e=this.attributes;if(t===null||e.position===void 0||e.normal===void 0||e.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=e.position,i=e.normal,s=e.uv;this.hasAttribute("tangent")===!1&&this.setAttribute("tangent",new we(new Float32Array(4*n.count),4));const a=this.getAttribute("tangent"),o=[],l=[];for(let L=0;L<n.count;L++)o[L]=new U,l[L]=new U;const c=new U,h=new U,u=new U,f=new Tt,d=new Tt,g=new Tt,_=new U,m=new U;function p(L,M,x){c.fromBufferAttribute(n,L),h.fromBufferAttribute(n,M),u.fromBufferAttribute(n,x),f.fromBufferAttribute(s,L),d.fromBufferAttribute(s,M),g.fromBufferAttribute(s,x),h.sub(c),u.sub(c),d.sub(f),g.sub(f);const P=1/(d.x*g.y-g.x*d.y);isFinite(P)&&(_.copy(h).multiplyScalar(g.y).addScaledVector(u,-d.y).multiplyScalar(P),m.copy(u).multiplyScalar(d.x).addScaledVector(h,-g.x).multiplyScalar(P),o[L].add(_),o[M].add(_),o[x].add(_),l[L].add(m),l[M].add(m),l[x].add(m))}let b=this.groups;b.length===0&&(b=[{start:0,count:t.count}]);for(let L=0,M=b.length;L<M;++L){const x=b[L],P=x.start,F=x.count;for(let B=P,k=P+F;B<k;B+=3)p(t.getX(B+0),t.getX(B+1),t.getX(B+2))}const E=new U,y=new U,w=new U,A=new U;function C(L){w.fromBufferAttribute(i,L),A.copy(w);const M=o[L];E.copy(M),E.sub(w.multiplyScalar(w.dot(M))).normalize(),y.crossVectors(A,M);const P=y.dot(l[L])<0?-1:1;a.setXYZW(L,E.x,E.y,E.z,P)}for(let L=0,M=b.length;L<M;++L){const x=b[L],P=x.start,F=x.count;for(let B=P,k=P+F;B<k;B+=3)C(t.getX(B+0)),C(t.getX(B+1)),C(t.getX(B+2))}}computeVertexNormals(){const t=this.index,e=this.getAttribute("position");if(e!==void 0){let n=this.getAttribute("normal");if(n===void 0)n=new we(new Float32Array(e.count*3),3),this.setAttribute("normal",n);else for(let f=0,d=n.count;f<d;f++)n.setXYZ(f,0,0,0);const i=new U,s=new U,a=new U,o=new U,l=new U,c=new U,h=new U,u=new U;if(t)for(let f=0,d=t.count;f<d;f+=3){const g=t.getX(f+0),_=t.getX(f+1),m=t.getX(f+2);i.fromBufferAttribute(e,g),s.fromBufferAttribute(e,_),a.fromBufferAttribute(e,m),h.subVectors(a,s),u.subVectors(i,s),h.cross(u),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,_),c.fromBufferAttribute(n,m),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(_,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let f=0,d=e.count;f<d;f+=3)i.fromBufferAttribute(e,f+0),s.fromBufferAttribute(e,f+1),a.fromBufferAttribute(e,f+2),h.subVectors(a,s),u.subVectors(i,s),h.cross(u),n.setXYZ(f+0,h.x,h.y,h.z),n.setXYZ(f+1,h.x,h.y,h.z),n.setXYZ(f+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const t=this.attributes.normal;for(let e=0,n=t.count;e<n;e++)Ee.fromBufferAttribute(t,e),Ee.normalize(),t.setXYZ(e,Ee.x,Ee.y,Ee.z)}toNonIndexed(){function t(o,l){const c=o.array,h=o.itemSize,u=o.normalized,f=new c.constructor(l.length*h);let d=0,g=0;for(let _=0,m=l.length;_<m;_++){o.isInterleavedBufferAttribute?d=l[_]*o.data.stride+o.offset:d=l[_]*h;for(let p=0;p<h;p++)f[g++]=c[d++]}return new we(f,h,u)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const e=new xe,n=this.index.array,i=this.attributes;for(const o in i){const l=i[o],c=t(l,n);e.setAttribute(o,c)}const s=this.morphAttributes;for(const o in s){const l=[],c=s[o];for(let h=0,u=c.length;h<u;h++){const f=c[h],d=t(f,n);l.push(d)}e.morphAttributes[o]=l}e.morphTargetsRelative=this.morphTargetsRelative;const a=this.groups;for(let o=0,l=a.length;o<l;o++){const c=a[o];e.addGroup(c.start,c.count,c.materialIndex)}return e}toJSON(){const t={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(t.uuid=this.uuid,t.type=this.type,this.name!==""&&(t.name=this.name),Object.keys(this.userData).length>0&&(t.userData=this.userData),this.parameters!==void 0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(t[c]=l[c]);return t}t.data={attributes:{}};const e=this.index;e!==null&&(t.data.index={type:e.array.constructor.name,array:Array.prototype.slice.call(e.array)});const n=this.attributes;for(const l in n){const c=n[l];t.data.attributes[l]=c.toJSON(t.data)}const i={};let s=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,f=c.length;u<f;u++){const d=c[u];h.push(d.toJSON(t.data))}h.length>0&&(i[l]=h,s=!0)}s&&(t.data.morphAttributes=i,t.data.morphTargetsRelative=this.morphTargetsRelative);const a=this.groups;a.length>0&&(t.data.groups=JSON.parse(JSON.stringify(a)));const o=this.boundingSphere;return o!==null&&(t.data.boundingSphere=o.toJSON()),t}clone(){return new this.constructor().copy(this)}copy(t){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const e={};this.name=t.name;const n=t.index;n!==null&&this.setIndex(n.clone());const i=t.attributes;for(const c in i){const h=i[c];this.setAttribute(c,h.clone(e))}const s=t.morphAttributes;for(const c in s){const h=[],u=s[c];for(let f=0,d=u.length;f<d;f++)h.push(u[f].clone(e));this.morphAttributes[c]=h}this.morphTargetsRelative=t.morphTargetsRelative;const a=t.groups;for(let c=0,h=a.length;c<h;c++){const u=a[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=t.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=t.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=t.drawRange.start,this.drawRange.count=t.drawRange.count,this.userData=t.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}const Qo=new Yt,jn=new vr,Ds=new Cn,tl=new U,Ls=new U,Us=new U,Is=new U,Xr=new U,Fs=new U,el=new U,Ns=new U;class ee extends Me{constructor(t=new xe,e=new Wn){super(),this.isMesh=!0,this.type="Mesh",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),t.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=t.morphTargetInfluences.slice()),t.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},t.morphTargetDictionary)),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=i.length;s<a;s++){const o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}getVertexPosition(t,e){const n=this.geometry,i=n.attributes.position,s=n.morphAttributes.position,a=n.morphTargetsRelative;e.fromBufferAttribute(i,t);const o=this.morphTargetInfluences;if(s&&o){Fs.set(0,0,0);for(let l=0,c=s.length;l<c;l++){const h=o[l],u=s[l];h!==0&&(Xr.fromBufferAttribute(u,t),a?Fs.addScaledVector(Xr,h):Fs.addScaledVector(Xr.sub(e),h))}e.add(Fs)}return e}raycast(t,e){const n=this.geometry,i=this.material,s=this.matrixWorld;i!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Ds.copy(n.boundingSphere),Ds.applyMatrix4(s),jn.copy(t.ray).recast(t.near),!(Ds.containsPoint(jn.origin)===!1&&(jn.intersectSphere(Ds,tl)===null||jn.origin.distanceToSquared(tl)>(t.far-t.near)**2))&&(Qo.copy(s).invert(),jn.copy(t.ray).applyMatrix4(Qo),!(n.boundingBox!==null&&jn.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(t,e,jn)))}_computeIntersections(t,e,n){let i;const s=this.geometry,a=this.material,o=s.index,l=s.attributes.position,c=s.attributes.uv,h=s.attributes.uv1,u=s.attributes.normal,f=s.groups,d=s.drawRange;if(o!==null)if(Array.isArray(a))for(let g=0,_=f.length;g<_;g++){const m=f[g],p=a[m.materialIndex],b=Math.max(m.start,d.start),E=Math.min(o.count,Math.min(m.start+m.count,d.start+d.count));for(let y=b,w=E;y<w;y+=3){const A=o.getX(y),C=o.getX(y+1),L=o.getX(y+2);i=Os(this,p,t,n,c,h,u,A,C,L),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=m.materialIndex,e.push(i))}}else{const g=Math.max(0,d.start),_=Math.min(o.count,d.start+d.count);for(let m=g,p=_;m<p;m+=3){const b=o.getX(m),E=o.getX(m+1),y=o.getX(m+2);i=Os(this,a,t,n,c,h,u,b,E,y),i&&(i.faceIndex=Math.floor(m/3),e.push(i))}}else if(l!==void 0)if(Array.isArray(a))for(let g=0,_=f.length;g<_;g++){const m=f[g],p=a[m.materialIndex],b=Math.max(m.start,d.start),E=Math.min(l.count,Math.min(m.start+m.count,d.start+d.count));for(let y=b,w=E;y<w;y+=3){const A=y,C=y+1,L=y+2;i=Os(this,p,t,n,c,h,u,A,C,L),i&&(i.faceIndex=Math.floor(y/3),i.face.materialIndex=m.materialIndex,e.push(i))}}else{const g=Math.max(0,d.start),_=Math.min(l.count,d.start+d.count);for(let m=g,p=_;m<p;m+=3){const b=m,E=m+1,y=m+2;i=Os(this,a,t,n,c,h,u,b,E,y),i&&(i.faceIndex=Math.floor(m/3),e.push(i))}}}}function tu(r,t,e,n,i,s,a,o){let l;if(t.side===Ue?l=n.intersectTriangle(a,s,i,!0,o):l=n.intersectTriangle(i,s,a,t.side===Vn,o),l===null)return null;Ns.copy(o),Ns.applyMatrix4(r.matrixWorld);const c=e.ray.origin.distanceTo(Ns);return c<e.near||c>e.far?null:{distance:c,point:Ns.clone(),object:r}}function Os(r,t,e,n,i,s,a,o,l,c){r.getVertexPosition(o,Ls),r.getVertexPosition(l,Us),r.getVertexPosition(c,Is);const h=tu(r,t,e,n,Ls,Us,Is,el);if(h){const u=new U;ln.getBarycoord(el,Ls,Us,Is,u),i&&(h.uv=ln.getInterpolatedAttribute(i,o,l,c,u,new Tt)),s&&(h.uv1=ln.getInterpolatedAttribute(s,o,l,c,u,new Tt)),a&&(h.normal=ln.getInterpolatedAttribute(a,o,l,c,u,new U),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const f={a:o,b:l,c,normal:new U,materialIndex:0};ln.getNormal(Ls,Us,Is,f.normal),h.face=f,h.barycoord=u}return h}class nn extends xe{constructor(t=1,e=1,n=1,i=1,s=1,a=1){super(),this.type="BoxGeometry",this.parameters={width:t,height:e,depth:n,widthSegments:i,heightSegments:s,depthSegments:a};const o=this;i=Math.floor(i),s=Math.floor(s),a=Math.floor(a);const l=[],c=[],h=[],u=[];let f=0,d=0;g("z","y","x",-1,-1,n,e,t,a,s,0),g("z","y","x",1,-1,n,e,-t,a,s,1),g("x","z","y",1,1,t,n,e,i,a,2),g("x","z","y",1,-1,t,n,-e,i,a,3),g("x","y","z",1,-1,t,e,n,i,s,4),g("x","y","z",-1,-1,t,e,-n,i,s,5),this.setIndex(l),this.setAttribute("position",new Jt(c,3)),this.setAttribute("normal",new Jt(h,3)),this.setAttribute("uv",new Jt(u,2));function g(_,m,p,b,E,y,w,A,C,L,M){const x=y/C,P=w/L,F=y/2,B=w/2,k=A/2,V=C+1,X=L+1;let Z=0,W=0;const rt=new U;for(let ct=0;ct<X;ct++){const St=ct*P-B;for(let Vt=0;Vt<V;Vt++){const ie=Vt*x-F;rt[_]=ie*b,rt[m]=St*E,rt[p]=k,c.push(rt.x,rt.y,rt.z),rt[_]=0,rt[m]=0,rt[p]=A>0?1:-1,h.push(rt.x,rt.y,rt.z),u.push(Vt/C),u.push(1-ct/L),Z+=1}}for(let ct=0;ct<L;ct++)for(let St=0;St<C;St++){const Vt=f+St+V*ct,ie=f+St+V*(ct+1),ae=f+(St+1)+V*(ct+1),jt=f+(St+1)+V*ct;l.push(Vt,ie,jt),l.push(ie,ae,jt),W+=6}o.addGroup(d,W,M),d+=W,f+=Z}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new nn(t.width,t.height,t.depth,t.widthSegments,t.heightSegments,t.depthSegments)}}function ki(r){const t={};for(const e in r){t[e]={};for(const n in r[e]){const i=r[e][n];i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)?i.isRenderTargetTexture?(console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),t[e][n]=null):t[e][n]=i.clone():Array.isArray(i)?t[e][n]=i.slice():t[e][n]=i}}return t}function Ne(r){const t={};for(let e=0;e<r.length;e++){const n=ki(r[e]);for(const i in n)t[i]=n[i]}return t}function eu(r){const t=[];for(let e=0;e<r.length;e++)t.push(r[e].clone());return t}function Dc(r){const t=r.getRenderTarget();return t===null?r.outputColorSpace:t.isXRRenderTarget===!0?t.texture.colorSpace:Xt.workingColorSpace}const ps={clone:ki,merge:Ne};var nu=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,iu=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class de extends hi{constructor(t){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=nu,this.fragmentShader=iu,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,t!==void 0&&this.setValues(t)}copy(t){return super.copy(t),this.fragmentShader=t.fragmentShader,this.vertexShader=t.vertexShader,this.uniforms=ki(t.uniforms),this.uniformsGroups=eu(t.uniformsGroups),this.defines=Object.assign({},t.defines),this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.fog=t.fog,this.lights=t.lights,this.clipping=t.clipping,this.extensions=Object.assign({},t.extensions),this.glslVersion=t.glslVersion,this}toJSON(t){const e=super.toJSON(t);e.glslVersion=this.glslVersion,e.uniforms={};for(const i in this.uniforms){const a=this.uniforms[i].value;a&&a.isTexture?e.uniforms[i]={type:"t",value:a.toJSON(t).uuid}:a&&a.isColor?e.uniforms[i]={type:"c",value:a.getHex()}:a&&a.isVector2?e.uniforms[i]={type:"v2",value:a.toArray()}:a&&a.isVector3?e.uniforms[i]={type:"v3",value:a.toArray()}:a&&a.isVector4?e.uniforms[i]={type:"v4",value:a.toArray()}:a&&a.isMatrix3?e.uniforms[i]={type:"m3",value:a.toArray()}:a&&a.isMatrix4?e.uniforms[i]={type:"m4",value:a.toArray()}:e.uniforms[i]={value:a}}Object.keys(this.defines).length>0&&(e.defines=this.defines),e.vertexShader=this.vertexShader,e.fragmentShader=this.fragmentShader,e.lights=this.lights,e.clipping=this.clipping;const n={};for(const i in this.extensions)this.extensions[i]===!0&&(n[i]=!0);return Object.keys(n).length>0&&(e.extensions=n),e}}class Lc extends Me{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new Yt,this.projectionMatrix=new Yt,this.projectionMatrixInverse=new Yt,this.coordinateSystem=_n,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(t,e){return super.copy(t,e),this.matrixWorldInverse.copy(t.matrixWorldInverse),this.projectionMatrix.copy(t.projectionMatrix),this.projectionMatrixInverse.copy(t.projectionMatrixInverse),this.coordinateSystem=t.coordinateSystem,this}getWorldDirection(t){return super.getWorldDirection(t).negate()}updateMatrixWorld(t){super.updateMatrixWorld(t),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix(t,e){super.updateWorldMatrix(t,e),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}const Fn=new U,nl=new Tt,il=new Tt;class Ye extends Lc{constructor(t=50,e=1,n=.1,i=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=t,this.zoom=1,this.near=n,this.far=i,this.focus=10,this.aspect=e,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.fov=t.fov,this.zoom=t.zoom,this.near=t.near,this.far=t.far,this.focus=t.focus,this.aspect=t.aspect,this.view=t.view===null?null:Object.assign({},t.view),this.filmGauge=t.filmGauge,this.filmOffset=t.filmOffset,this}setFocalLength(t){const e=.5*this.getFilmHeight()/t;this.fov=Qa*2*Math.atan(e),this.updateProjectionMatrix()}getFocalLength(){const t=Math.tan(Tr*.5*this.fov);return .5*this.getFilmHeight()/t}getEffectiveFOV(){return Qa*2*Math.atan(Math.tan(Tr*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(t,e,n){Fn.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),e.set(Fn.x,Fn.y).multiplyScalar(-t/Fn.z),Fn.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(Fn.x,Fn.y).multiplyScalar(-t/Fn.z)}getViewSize(t,e){return this.getViewBounds(t,nl,il),e.subVectors(il,nl)}setViewOffset(t,e,n,i,s,a){this.aspect=t/e,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=this.near;let e=t*Math.tan(Tr*.5*this.fov)/this.zoom,n=2*e,i=this.aspect*n,s=-.5*i;const a=this.view;if(this.view!==null&&this.view.enabled){const l=a.fullWidth,c=a.fullHeight;s+=a.offsetX*i/l,e-=a.offsetY*n/c,i*=a.width/l,n*=a.height/c}const o=this.filmOffset;o!==0&&(s+=t*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(s,s+i,e,e-n,t,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.fov=this.fov,e.object.zoom=this.zoom,e.object.near=this.near,e.object.far=this.far,e.object.focus=this.focus,e.object.aspect=this.aspect,this.view!==null&&(e.object.view=Object.assign({},this.view)),e.object.filmGauge=this.filmGauge,e.object.filmOffset=this.filmOffset,e}}const Ti=-90,wi=1;class su extends Me{constructor(t,e,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const i=new Ye(Ti,wi,t,e);i.layers=this.layers,this.add(i);const s=new Ye(Ti,wi,t,e);s.layers=this.layers,this.add(s);const a=new Ye(Ti,wi,t,e);a.layers=this.layers,this.add(a);const o=new Ye(Ti,wi,t,e);o.layers=this.layers,this.add(o);const l=new Ye(Ti,wi,t,e);l.layers=this.layers,this.add(l);const c=new Ye(Ti,wi,t,e);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const t=this.coordinateSystem,e=this.children.concat(),[n,i,s,a,o,l]=e;for(const c of e)this.remove(c);if(t===_n)n.up.set(0,1,0),n.lookAt(1,0,0),i.up.set(0,1,0),i.lookAt(-1,0,0),s.up.set(0,0,-1),s.lookAt(0,1,0),a.up.set(0,0,1),a.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(t===or)n.up.set(0,-1,0),n.lookAt(-1,0,0),i.up.set(0,-1,0),i.lookAt(1,0,0),s.up.set(0,0,1),s.lookAt(0,1,0),a.up.set(0,0,-1),a.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+t);for(const c of e)this.add(c),c.updateMatrixWorld()}update(t,e){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:i}=this;this.coordinateSystem!==t.coordinateSystem&&(this.coordinateSystem=t.coordinateSystem,this.updateCoordinateSystem());const[s,a,o,l,c,h]=this.children,u=t.getRenderTarget(),f=t.getActiveCubeFace(),d=t.getActiveMipmapLevel(),g=t.xr.enabled;t.xr.enabled=!1;const _=n.texture.generateMipmaps;n.texture.generateMipmaps=!1,t.setRenderTarget(n,0,i),t.render(e,s),t.setRenderTarget(n,1,i),t.render(e,a),t.setRenderTarget(n,2,i),t.render(e,o),t.setRenderTarget(n,3,i),t.render(e,l),t.setRenderTarget(n,4,i),t.render(e,c),n.texture.generateMipmaps=_,t.setRenderTarget(n,5,i),t.render(e,h),t.setRenderTarget(u,f,d),t.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class Uc extends Ie{constructor(t=[],e=Oi,n,i,s,a,o,l,c,h){super(t,e,n,i,s,a,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(t){this.image=t}}class ru extends Qe{constructor(t=1,e={}){super(t,t,e),this.isWebGLCubeRenderTarget=!0;const n={width:t,height:t,depth:1},i=[n,n,n,n,n,n];this.texture=new Uc(i),this._setTextureOptions(e),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(t,e){this.texture.type=e.type,this.texture.colorSpace=e.colorSpace,this.texture.generateMipmaps=e.generateMipmaps,this.texture.minFilter=e.minFilter,this.texture.magFilter=e.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},i=new nn(5,5,5),s=new de({name:"CubemapFromEquirect",uniforms:ki(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Ue,blending:An});s.uniforms.tEquirect.value=e;const a=new ee(i,s),o=e.minFilter;return e.minFilter===ri&&(e.minFilter=mn),new su(1,10,this).update(t,a),e.minFilter=o,a.geometry.dispose(),a.material.dispose(),this}clear(t,e=!0,n=!0,i=!0){const s=t.getRenderTarget();for(let a=0;a<6;a++)t.setRenderTarget(this,a),t.clear(e,n,i);t.setRenderTarget(s)}}class Je extends Me{constructor(){super(),this.isGroup=!0,this.type="Group"}}const au={type:"move"};class Yr{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Je,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Je,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new U,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new U),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Je,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new U,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new U),this._grip}dispatchEvent(t){return this._targetRay!==null&&this._targetRay.dispatchEvent(t),this._grip!==null&&this._grip.dispatchEvent(t),this._hand!==null&&this._hand.dispatchEvent(t),this}connect(t){if(t&&t.hand){const e=this._hand;if(e)for(const n of t.hand.values())this._getHandJoint(e,n)}return this.dispatchEvent({type:"connected",data:t}),this}disconnect(t){return this.dispatchEvent({type:"disconnected",data:t}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(t,e,n){let i=null,s=null,a=null;const o=this._targetRay,l=this._grip,c=this._hand;if(t&&e.session.visibilityState!=="visible-blurred"){if(c&&t.hand){a=!0;for(const _ of t.hand.values()){const m=e.getJointPose(_,n),p=this._getHandJoint(c,_);m!==null&&(p.matrix.fromArray(m.transform.matrix),p.matrix.decompose(p.position,p.rotation,p.scale),p.matrixWorldNeedsUpdate=!0,p.jointRadius=m.radius),p.visible=m!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],f=h.position.distanceTo(u.position),d=.02,g=.005;c.inputState.pinching&&f>d+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:t.handedness,target:this})):!c.inputState.pinching&&f<=d-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:t.handedness,target:this}))}else l!==null&&t.gripSpace&&(s=e.getPose(t.gripSpace,n),s!==null&&(l.matrix.fromArray(s.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,s.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(s.linearVelocity)):l.hasLinearVelocity=!1,s.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(s.angularVelocity)):l.hasAngularVelocity=!1));o!==null&&(i=e.getPose(t.targetRaySpace,n),i===null&&s!==null&&(i=s),i!==null&&(o.matrix.fromArray(i.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,i.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(i.linearVelocity)):o.hasLinearVelocity=!1,i.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(i.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(au)))}return o!==null&&(o.visible=i!==null),l!==null&&(l.visible=s!==null),c!==null&&(c.visible=a!==null),this}_getHandJoint(t,e){if(t.joints[e.jointName]===void 0){const n=new Je;n.matrixAutoUpdate=!1,n.visible=!1,t.joints[e.jointName]=n,t.add(n)}return t.joints[e.jointName]}}class cr{constructor(t,e=1,n=1e3){this.isFog=!0,this.name="",this.color=new vt(t),this.near=e,this.far=n}clone(){return new cr(this.color,this.near,this.far)}toJSON(){return{type:"Fog",name:this.name,color:this.color.getHex(),near:this.near,far:this.far}}}class ou extends Me{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new hn,this.environmentIntensity=1,this.environmentRotation=new hn,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(t,e){return super.copy(t,e),t.background!==null&&(this.background=t.background.clone()),t.environment!==null&&(this.environment=t.environment.clone()),t.fog!==null&&(this.fog=t.fog.clone()),this.backgroundBlurriness=t.backgroundBlurriness,this.backgroundIntensity=t.backgroundIntensity,this.backgroundRotation.copy(t.backgroundRotation),this.environmentIntensity=t.environmentIntensity,this.environmentRotation.copy(t.environmentRotation),t.overrideMaterial!==null&&(this.overrideMaterial=t.overrideMaterial.clone()),this.matrixAutoUpdate=t.matrixAutoUpdate,this}toJSON(t){const e=super.toJSON(t);return this.fog!==null&&(e.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(e.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(e.object.backgroundIntensity=this.backgroundIntensity),e.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(e.object.environmentIntensity=this.environmentIntensity),e.object.environmentRotation=this.environmentRotation.toArray(),e}}class lu extends Ie{constructor(t=null,e=1,n=1,i,s,a,o,l,c=Ke,h=Ke,u,f){super(null,a,o,l,c,h,i,s,u,f),this.isDataTexture=!0,this.image={data:t,width:e,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class li extends we{constructor(t,e,n,i=1){super(t,e,n),this.isInstancedBufferAttribute=!0,this.meshPerAttribute=i}copy(t){return super.copy(t),this.meshPerAttribute=t.meshPerAttribute,this}toJSON(){const t=super.toJSON();return t.meshPerAttribute=this.meshPerAttribute,t.isInstancedBufferAttribute=!0,t}}const Ai=new Yt,sl=new Yt,zs=[],rl=new ci,cu=new Yt,es=new ee,ns=new Cn;class ui extends ee{constructor(t,e,n){super(t,e),this.isInstancedMesh=!0,this.instanceMatrix=new li(new Float32Array(n*16),16),this.instanceColor=null,this.morphTexture=null,this.count=n,this.boundingBox=null,this.boundingSphere=null;for(let i=0;i<n;i++)this.setMatrixAt(i,cu)}computeBoundingBox(){const t=this.geometry,e=this.count;this.boundingBox===null&&(this.boundingBox=new ci),t.boundingBox===null&&t.computeBoundingBox(),this.boundingBox.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Ai),rl.copy(t.boundingBox).applyMatrix4(Ai),this.boundingBox.union(rl)}computeBoundingSphere(){const t=this.geometry,e=this.count;this.boundingSphere===null&&(this.boundingSphere=new Cn),t.boundingSphere===null&&t.computeBoundingSphere(),this.boundingSphere.makeEmpty();for(let n=0;n<e;n++)this.getMatrixAt(n,Ai),ns.copy(t.boundingSphere).applyMatrix4(Ai),this.boundingSphere.union(ns)}copy(t,e){return super.copy(t,e),this.instanceMatrix.copy(t.instanceMatrix),t.morphTexture!==null&&(this.morphTexture=t.morphTexture.clone()),t.instanceColor!==null&&(this.instanceColor=t.instanceColor.clone()),this.count=t.count,t.boundingBox!==null&&(this.boundingBox=t.boundingBox.clone()),t.boundingSphere!==null&&(this.boundingSphere=t.boundingSphere.clone()),this}getColorAt(t,e){e.fromArray(this.instanceColor.array,t*3)}getMatrixAt(t,e){e.fromArray(this.instanceMatrix.array,t*16)}getMorphAt(t,e){const n=e.morphTargetInfluences,i=this.morphTexture.source.data.data,s=n.length+1,a=t*s+1;for(let o=0;o<n.length;o++)n[o]=i[a+o]}raycast(t,e){const n=this.matrixWorld,i=this.count;if(es.geometry=this.geometry,es.material=this.material,es.material!==void 0&&(this.boundingSphere===null&&this.computeBoundingSphere(),ns.copy(this.boundingSphere),ns.applyMatrix4(n),t.ray.intersectsSphere(ns)!==!1))for(let s=0;s<i;s++){this.getMatrixAt(s,Ai),sl.multiplyMatrices(n,Ai),es.matrixWorld=sl,es.raycast(t,zs);for(let a=0,o=zs.length;a<o;a++){const l=zs[a];l.instanceId=s,l.object=this,e.push(l)}zs.length=0}}setColorAt(t,e){this.instanceColor===null&&(this.instanceColor=new li(new Float32Array(this.instanceMatrix.count*3).fill(1),3)),e.toArray(this.instanceColor.array,t*3)}setMatrixAt(t,e){e.toArray(this.instanceMatrix.array,t*16)}setMorphAt(t,e){const n=e.morphTargetInfluences,i=n.length+1;this.morphTexture===null&&(this.morphTexture=new lu(new Float32Array(i*this.count),i,this.count,fo,gn));const s=this.morphTexture.source.data.data;let a=0;for(let c=0;c<n.length;c++)a+=n[c];const o=this.geometry.morphTargetsRelative?1:1-a,l=i*t;s[l]=o,s.set(n,l+1)}updateMorphTargets(){}dispose(){this.dispatchEvent({type:"dispose"}),this.morphTexture!==null&&(this.morphTexture.dispose(),this.morphTexture=null)}}const Kr=new U,hu=new U,uu=new Nt;class On{constructor(t=new U(1,0,0),e=0){this.isPlane=!0,this.normal=t,this.constant=e}set(t,e){return this.normal.copy(t),this.constant=e,this}setComponents(t,e,n,i){return this.normal.set(t,e,n),this.constant=i,this}setFromNormalAndCoplanarPoint(t,e){return this.normal.copy(t),this.constant=-e.dot(this.normal),this}setFromCoplanarPoints(t,e,n){const i=Kr.subVectors(n,e).cross(hu.subVectors(t,e)).normalize();return this.setFromNormalAndCoplanarPoint(i,t),this}copy(t){return this.normal.copy(t.normal),this.constant=t.constant,this}normalize(){const t=1/this.normal.length();return this.normal.multiplyScalar(t),this.constant*=t,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(t){return this.normal.dot(t)+this.constant}distanceToSphere(t){return this.distanceToPoint(t.center)-t.radius}projectPoint(t,e){return e.copy(t).addScaledVector(this.normal,-this.distanceToPoint(t))}intersectLine(t,e){const n=t.delta(Kr),i=this.normal.dot(n);if(i===0)return this.distanceToPoint(t.start)===0?e.copy(t.start):null;const s=-(t.start.dot(this.normal)+this.constant)/i;return s<0||s>1?null:e.copy(t.start).addScaledVector(n,s)}intersectsLine(t){const e=this.distanceToPoint(t.start),n=this.distanceToPoint(t.end);return e<0&&n>0||n<0&&e>0}intersectsBox(t){return t.intersectsPlane(this)}intersectsSphere(t){return t.intersectsPlane(this)}coplanarPoint(t){return t.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(t,e){const n=e||uu.getNormalMatrix(t),i=this.coplanarPoint(Kr).applyMatrix4(t),s=this.normal.applyMatrix3(n).normalize();return this.constant=-i.dot(s),this}translate(t){return this.constant-=t.dot(this.normal),this}equals(t){return t.normal.equals(this.normal)&&t.constant===this.constant}clone(){return new this.constructor().copy(this)}}const Zn=new Cn,fu=new Tt(.5,.5),Bs=new U;class xo{constructor(t=new On,e=new On,n=new On,i=new On,s=new On,a=new On){this.planes=[t,e,n,i,s,a]}set(t,e,n,i,s,a){const o=this.planes;return o[0].copy(t),o[1].copy(e),o[2].copy(n),o[3].copy(i),o[4].copy(s),o[5].copy(a),this}copy(t){const e=this.planes;for(let n=0;n<6;n++)e[n].copy(t.planes[n]);return this}setFromProjectionMatrix(t,e=_n,n=!1){const i=this.planes,s=t.elements,a=s[0],o=s[1],l=s[2],c=s[3],h=s[4],u=s[5],f=s[6],d=s[7],g=s[8],_=s[9],m=s[10],p=s[11],b=s[12],E=s[13],y=s[14],w=s[15];if(i[0].setComponents(c-a,d-h,p-g,w-b).normalize(),i[1].setComponents(c+a,d+h,p+g,w+b).normalize(),i[2].setComponents(c+o,d+u,p+_,w+E).normalize(),i[3].setComponents(c-o,d-u,p-_,w-E).normalize(),n)i[4].setComponents(l,f,m,y).normalize(),i[5].setComponents(c-l,d-f,p-m,w-y).normalize();else if(i[4].setComponents(c-l,d-f,p-m,w-y).normalize(),e===_n)i[5].setComponents(c+l,d+f,p+m,w+y).normalize();else if(e===or)i[5].setComponents(l,f,m,y).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+e);return this}intersectsObject(t){if(t.boundingSphere!==void 0)t.boundingSphere===null&&t.computeBoundingSphere(),Zn.copy(t.boundingSphere).applyMatrix4(t.matrixWorld);else{const e=t.geometry;e.boundingSphere===null&&e.computeBoundingSphere(),Zn.copy(e.boundingSphere).applyMatrix4(t.matrixWorld)}return this.intersectsSphere(Zn)}intersectsSprite(t){Zn.center.set(0,0,0);const e=fu.distanceTo(t.center);return Zn.radius=.7071067811865476+e,Zn.applyMatrix4(t.matrixWorld),this.intersectsSphere(Zn)}intersectsSphere(t){const e=this.planes,n=t.center,i=-t.radius;for(let s=0;s<6;s++)if(e[s].distanceToPoint(n)<i)return!1;return!0}intersectsBox(t){const e=this.planes;for(let n=0;n<6;n++){const i=e[n];if(Bs.x=i.normal.x>0?t.max.x:t.min.x,Bs.y=i.normal.y>0?t.max.y:t.min.y,Bs.z=i.normal.z>0?t.max.z:t.min.z,i.distanceToPoint(Bs)<0)return!1}return!0}containsPoint(t){const e=this.planes;for(let n=0;n<6;n++)if(e[n].distanceToPoint(t)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class to extends hi{constructor(t){super(),this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new vt(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.linewidth=t.linewidth,this.linecap=t.linecap,this.linejoin=t.linejoin,this.fog=t.fog,this}}const hr=new U,ur=new U,al=new Yt,is=new vr,ks=new Cn,jr=new U,ol=new U;class du extends Me{constructor(t=new xe,e=new to){super(),this.isLine=!0,this.type="Line",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[0];for(let i=1,s=e.count;i<s;i++)hr.fromBufferAttribute(e,i-1),ur.fromBufferAttribute(e,i),n[i]=n[i-1],n[i]+=hr.distanceTo(ur);t.setAttribute("lineDistance",new Jt(n,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast(t,e){const n=this.geometry,i=this.matrixWorld,s=t.params.Line.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),ks.copy(n.boundingSphere),ks.applyMatrix4(i),ks.radius+=s,t.ray.intersectsSphere(ks)===!1)return;al.copy(i).invert(),is.copy(t.ray).applyMatrix4(al);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=this.isLineSegments?2:1,h=n.index,f=n.attributes.position;if(h!==null){const d=Math.max(0,a.start),g=Math.min(h.count,a.start+a.count);for(let _=d,m=g-1;_<m;_+=c){const p=h.getX(_),b=h.getX(_+1),E=Vs(this,t,is,l,p,b,_);E&&e.push(E)}if(this.isLineLoop){const _=h.getX(g-1),m=h.getX(d),p=Vs(this,t,is,l,_,m,g-1);p&&e.push(p)}}else{const d=Math.max(0,a.start),g=Math.min(f.count,a.start+a.count);for(let _=d,m=g-1;_<m;_+=c){const p=Vs(this,t,is,l,_,_+1,_);p&&e.push(p)}if(this.isLineLoop){const _=Vs(this,t,is,l,g-1,d,g-1);_&&e.push(_)}}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=i.length;s<a;s++){const o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function Vs(r,t,e,n,i,s,a){const o=r.geometry.attributes.position;if(hr.fromBufferAttribute(o,i),ur.fromBufferAttribute(o,s),e.distanceSqToSegment(hr,ur,jr,ol)>n)return;jr.applyMatrix4(r.matrixWorld);const c=t.ray.origin.distanceTo(jr);if(!(c<t.near||c>t.far))return{distance:c,point:ol.clone().applyMatrix4(r.matrixWorld),index:a,face:null,faceIndex:null,barycoord:null,object:r}}const ll=new U,cl=new U;class hl extends du{constructor(t,e){super(t,e),this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){const t=this.geometry;if(t.index===null){const e=t.attributes.position,n=[];for(let i=0,s=e.count;i<s;i+=2)ll.fromBufferAttribute(e,i),cl.fromBufferAttribute(e,i+1),n[i]=i===0?0:n[i-1],n[i+1]=n[i]+ll.distanceTo(cl);t.setAttribute("lineDistance",new Jt(n,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class pu extends hi{constructor(t){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new vt(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.alphaMap=t.alphaMap,this.size=t.size,this.sizeAttenuation=t.sizeAttenuation,this.fog=t.fog,this}}const ul=new Yt,eo=new vr,Hs=new Cn,Gs=new U;class mu extends Me{constructor(t=new xe,e=new pu){super(),this.isPoints=!0,this.type="Points",this.geometry=t,this.material=e,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(t,e){return super.copy(t,e),this.material=Array.isArray(t.material)?t.material.slice():t.material,this.geometry=t.geometry,this}raycast(t,e){const n=this.geometry,i=this.matrixWorld,s=t.params.Points.threshold,a=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Hs.copy(n.boundingSphere),Hs.applyMatrix4(i),Hs.radius+=s,t.ray.intersectsSphere(Hs)===!1)return;ul.copy(i).invert(),eo.copy(t.ray).applyMatrix4(ul);const o=s/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,u=n.attributes.position;if(c!==null){const f=Math.max(0,a.start),d=Math.min(c.count,a.start+a.count);for(let g=f,_=d;g<_;g++){const m=c.getX(g);Gs.fromBufferAttribute(u,m),fl(Gs,m,l,i,t,e,this)}}else{const f=Math.max(0,a.start),d=Math.min(u.count,a.start+a.count);for(let g=f,_=d;g<_;g++)Gs.fromBufferAttribute(u,g),fl(Gs,g,l,i,t,e,this)}}updateMorphTargets(){const e=this.geometry.morphAttributes,n=Object.keys(e);if(n.length>0){const i=e[n[0]];if(i!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let s=0,a=i.length;s<a;s++){const o=i[s].name||String(s);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=s}}}}}function fl(r,t,e,n,i,s,a){const o=eo.distanceSqToPoint(r);if(o<e){const l=new U;eo.closestPointToPoint(r,l),l.applyMatrix4(n);const c=i.ray.origin.distanceTo(l);if(c<i.near||c>i.far)return;s.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:t,face:null,faceIndex:null,barycoord:null,object:a})}}class gu extends Ie{constructor(t,e,n,i,s,a,o,l,c){super(t,e,n,i,s,a,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Ic extends Ie{constructor(t,e,n=oi,i,s,a,o=Ke,l=Ke,c,h=us,u=1){if(h!==us&&h!==fs)throw new Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const f={width:t,height:e,depth:u};super(f,i,s,a,o,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(t){return super.copy(t),this.source=new _o(Object.assign({},t.image)),this.compareFunction=t.compareFunction,this}toJSON(t){const e=super.toJSON(t);return this.compareFunction!==null&&(e.compareFunction=this.compareFunction),e}}class Fc extends Ie{constructor(t=null){super(),this.sourceTexture=t,this.isExternalTexture=!0}copy(t){return super.copy(t),this.sourceTexture=t.sourceTexture,this}}class Mo extends xe{constructor(t=1,e=1,n=4,i=8,s=1){super(),this.type="CapsuleGeometry",this.parameters={radius:t,height:e,capSegments:n,radialSegments:i,heightSegments:s},e=Math.max(0,e),n=Math.max(1,Math.floor(n)),i=Math.max(3,Math.floor(i)),s=Math.max(1,Math.floor(s));const a=[],o=[],l=[],c=[],h=e/2,u=Math.PI/2*t,f=e,d=2*u+f,g=n*2+s,_=i+1,m=new U,p=new U;for(let b=0;b<=g;b++){let E=0,y=0,w=0,A=0;if(b<=n){const M=b/n,x=M*Math.PI/2;y=-h-t*Math.cos(x),w=t*Math.sin(x),A=-t*Math.cos(x),E=M*u}else if(b<=n+s){const M=(b-n)/s;y=-h+M*e,w=t,A=0,E=u+M*f}else{const M=(b-n-s)/n,x=M*Math.PI/2;y=h+t*Math.sin(x),w=t*Math.cos(x),A=t*Math.sin(x),E=u+f+M*u}const C=Math.max(0,Math.min(1,E/d));let L=0;b===0?L=.5/i:b===g&&(L=-.5/i);for(let M=0;M<=i;M++){const x=M/i,P=x*Math.PI*2,F=Math.sin(P),B=Math.cos(P);p.x=-w*B,p.y=y,p.z=w*F,o.push(p.x,p.y,p.z),m.set(-w*B,A,w*F),m.normalize(),l.push(m.x,m.y,m.z),c.push(x+L,C)}if(b>0){const M=(b-1)*_;for(let x=0;x<i;x++){const P=M+x,F=M+x+1,B=b*_+x,k=b*_+x+1;a.push(P,F,B),a.push(F,k,B)}}}this.setIndex(a),this.setAttribute("position",new Jt(o,3)),this.setAttribute("normal",new Jt(l,3)),this.setAttribute("uv",new Jt(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Mo(t.radius,t.height,t.capSegments,t.radialSegments,t.heightSegments)}}class xr extends xe{constructor(t=1,e=1,n=1,i=32,s=1,a=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:t,radiusBottom:e,height:n,radialSegments:i,heightSegments:s,openEnded:a,thetaStart:o,thetaLength:l};const c=this;i=Math.floor(i),s=Math.floor(s);const h=[],u=[],f=[],d=[];let g=0;const _=[],m=n/2;let p=0;b(),a===!1&&(t>0&&E(!0),e>0&&E(!1)),this.setIndex(h),this.setAttribute("position",new Jt(u,3)),this.setAttribute("normal",new Jt(f,3)),this.setAttribute("uv",new Jt(d,2));function b(){const y=new U,w=new U;let A=0;const C=(e-t)/n;for(let L=0;L<=s;L++){const M=[],x=L/s,P=x*(e-t)+t;for(let F=0;F<=i;F++){const B=F/i,k=B*l+o,V=Math.sin(k),X=Math.cos(k);w.x=P*V,w.y=-x*n+m,w.z=P*X,u.push(w.x,w.y,w.z),y.set(V,C,X).normalize(),f.push(y.x,y.y,y.z),d.push(B,1-x),M.push(g++)}_.push(M)}for(let L=0;L<i;L++)for(let M=0;M<s;M++){const x=_[M][L],P=_[M+1][L],F=_[M+1][L+1],B=_[M][L+1];(t>0||M!==0)&&(h.push(x,P,B),A+=3),(e>0||M!==s-1)&&(h.push(P,F,B),A+=3)}c.addGroup(p,A,0),p+=A}function E(y){const w=g,A=new Tt,C=new U;let L=0;const M=y===!0?t:e,x=y===!0?1:-1;for(let F=1;F<=i;F++)u.push(0,m*x,0),f.push(0,x,0),d.push(.5,.5),g++;const P=g;for(let F=0;F<=i;F++){const k=F/i*l+o,V=Math.cos(k),X=Math.sin(k);C.x=M*X,C.y=m*x,C.z=M*V,u.push(C.x,C.y,C.z),f.push(0,x,0),A.x=V*.5+.5,A.y=X*.5*x+.5,d.push(A.x,A.y),g++}for(let F=0;F<i;F++){const B=w+F,k=P+F;y===!0?h.push(k,k+1,B):h.push(k+1,k,B),L+=3}c.addGroup(p,L,y===!0?1:2),p+=L}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new xr(t.radiusTop,t.radiusBottom,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class yo extends xr{constructor(t=1,e=1,n=32,i=1,s=!1,a=0,o=Math.PI*2){super(0,t,e,n,i,s,a,o),this.type="ConeGeometry",this.parameters={radius:t,height:e,radialSegments:n,heightSegments:i,openEnded:s,thetaStart:a,thetaLength:o}}static fromJSON(t){return new yo(t.radius,t.height,t.radialSegments,t.heightSegments,t.openEnded,t.thetaStart,t.thetaLength)}}class So extends xe{constructor(t=[],e=[],n=1,i=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:t,indices:e,radius:n,detail:i};const s=[],a=[];o(i),c(n),h(),this.setAttribute("position",new Jt(s,3)),this.setAttribute("normal",new Jt(s.slice(),3)),this.setAttribute("uv",new Jt(a,2)),i===0?this.computeVertexNormals():this.normalizeNormals();function o(b){const E=new U,y=new U,w=new U;for(let A=0;A<e.length;A+=3)d(e[A+0],E),d(e[A+1],y),d(e[A+2],w),l(E,y,w,b)}function l(b,E,y,w){const A=w+1,C=[];for(let L=0;L<=A;L++){C[L]=[];const M=b.clone().lerp(y,L/A),x=E.clone().lerp(y,L/A),P=A-L;for(let F=0;F<=P;F++)F===0&&L===A?C[L][F]=M:C[L][F]=M.clone().lerp(x,F/P)}for(let L=0;L<A;L++)for(let M=0;M<2*(A-L)-1;M++){const x=Math.floor(M/2);M%2===0?(f(C[L][x+1]),f(C[L+1][x]),f(C[L][x])):(f(C[L][x+1]),f(C[L+1][x+1]),f(C[L+1][x]))}}function c(b){const E=new U;for(let y=0;y<s.length;y+=3)E.x=s[y+0],E.y=s[y+1],E.z=s[y+2],E.normalize().multiplyScalar(b),s[y+0]=E.x,s[y+1]=E.y,s[y+2]=E.z}function h(){const b=new U;for(let E=0;E<s.length;E+=3){b.x=s[E+0],b.y=s[E+1],b.z=s[E+2];const y=m(b)/2/Math.PI+.5,w=p(b)/Math.PI+.5;a.push(y,1-w)}g(),u()}function u(){for(let b=0;b<a.length;b+=6){const E=a[b+0],y=a[b+2],w=a[b+4],A=Math.max(E,y,w),C=Math.min(E,y,w);A>.9&&C<.1&&(E<.2&&(a[b+0]+=1),y<.2&&(a[b+2]+=1),w<.2&&(a[b+4]+=1))}}function f(b){s.push(b.x,b.y,b.z)}function d(b,E){const y=b*3;E.x=t[y+0],E.y=t[y+1],E.z=t[y+2]}function g(){const b=new U,E=new U,y=new U,w=new U,A=new Tt,C=new Tt,L=new Tt;for(let M=0,x=0;M<s.length;M+=9,x+=6){b.set(s[M+0],s[M+1],s[M+2]),E.set(s[M+3],s[M+4],s[M+5]),y.set(s[M+6],s[M+7],s[M+8]),A.set(a[x+0],a[x+1]),C.set(a[x+2],a[x+3]),L.set(a[x+4],a[x+5]),w.copy(b).add(E).add(y).divideScalar(3);const P=m(w);_(A,x+0,b,P),_(C,x+2,E,P),_(L,x+4,y,P)}}function _(b,E,y,w){w<0&&b.x===1&&(a[E]=b.x-1),y.x===0&&y.z===0&&(a[E]=w/2/Math.PI+.5)}function m(b){return Math.atan2(b.z,-b.x)}function p(b){return Math.atan2(-b.y,Math.sqrt(b.x*b.x+b.z*b.z))}}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new So(t.vertices,t.indices,t.radius,t.details)}}class fr extends So{constructor(t=1,e=0){const n=(1+Math.sqrt(5))/2,i=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],s=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(i,s,t,e),this.type="IcosahedronGeometry",this.parameters={radius:t,detail:e}}static fromJSON(t){return new fr(t.radius,t.detail)}}class fi extends xe{constructor(t=1,e=1,n=1,i=1){super(),this.type="PlaneGeometry",this.parameters={width:t,height:e,widthSegments:n,heightSegments:i};const s=t/2,a=e/2,o=Math.floor(n),l=Math.floor(i),c=o+1,h=l+1,u=t/o,f=e/l,d=[],g=[],_=[],m=[];for(let p=0;p<h;p++){const b=p*f-a;for(let E=0;E<c;E++){const y=E*u-s;g.push(y,-b,0),_.push(0,0,1),m.push(E/o),m.push(1-p/l)}}for(let p=0;p<l;p++)for(let b=0;b<o;b++){const E=b+c*p,y=b+c*(p+1),w=b+1+c*(p+1),A=b+1+c*p;d.push(E,y,A),d.push(y,w,A)}this.setIndex(d),this.setAttribute("position",new Jt(g,3)),this.setAttribute("normal",new Jt(_,3)),this.setAttribute("uv",new Jt(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new fi(t.width,t.height,t.widthSegments,t.heightSegments)}}class Fi extends xe{constructor(t=.5,e=1,n=32,i=1,s=0,a=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:t,outerRadius:e,thetaSegments:n,phiSegments:i,thetaStart:s,thetaLength:a},n=Math.max(3,n),i=Math.max(1,i);const o=[],l=[],c=[],h=[];let u=t;const f=(e-t)/i,d=new U,g=new Tt;for(let _=0;_<=i;_++){for(let m=0;m<=n;m++){const p=s+m/n*a;d.x=u*Math.cos(p),d.y=u*Math.sin(p),l.push(d.x,d.y,d.z),c.push(0,0,1),g.x=(d.x/e+1)/2,g.y=(d.y/e+1)/2,h.push(g.x,g.y)}u+=f}for(let _=0;_<i;_++){const m=_*(n+1);for(let p=0;p<n;p++){const b=p+m,E=b,y=b+n+1,w=b+n+2,A=b+1;o.push(E,y,A),o.push(y,w,A)}}this.setIndex(o),this.setAttribute("position",new Jt(l,3)),this.setAttribute("normal",new Jt(c,3)),this.setAttribute("uv",new Jt(h,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Fi(t.innerRadius,t.outerRadius,t.thetaSegments,t.phiSegments,t.thetaStart,t.thetaLength)}}class Vi extends xe{constructor(t=1,e=32,n=16,i=0,s=Math.PI*2,a=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:t,widthSegments:e,heightSegments:n,phiStart:i,phiLength:s,thetaStart:a,thetaLength:o},e=Math.max(3,Math.floor(e)),n=Math.max(2,Math.floor(n));const l=Math.min(a+o,Math.PI);let c=0;const h=[],u=new U,f=new U,d=[],g=[],_=[],m=[];for(let p=0;p<=n;p++){const b=[],E=p/n;let y=0;p===0&&a===0?y=.5/e:p===n&&l===Math.PI&&(y=-.5/e);for(let w=0;w<=e;w++){const A=w/e;u.x=-t*Math.cos(i+A*s)*Math.sin(a+E*o),u.y=t*Math.cos(a+E*o),u.z=t*Math.sin(i+A*s)*Math.sin(a+E*o),g.push(u.x,u.y,u.z),f.copy(u).normalize(),_.push(f.x,f.y,f.z),m.push(A+y,1-E),b.push(c++)}h.push(b)}for(let p=0;p<n;p++)for(let b=0;b<e;b++){const E=h[p][b+1],y=h[p][b],w=h[p+1][b],A=h[p+1][b+1];(p!==0||a>0)&&d.push(E,y,A),(p!==n-1||l<Math.PI)&&d.push(y,w,A)}this.setIndex(d),this.setAttribute("position",new Jt(g,3)),this.setAttribute("normal",new Jt(_,3)),this.setAttribute("uv",new Jt(m,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new Vi(t.radius,t.widthSegments,t.heightSegments,t.phiStart,t.phiLength,t.thetaStart,t.thetaLength)}}class bo extends xe{constructor(t=1,e=.4,n=12,i=48,s=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:t,tube:e,radialSegments:n,tubularSegments:i,arc:s},n=Math.floor(n),i=Math.floor(i);const a=[],o=[],l=[],c=[],h=new U,u=new U,f=new U;for(let d=0;d<=n;d++)for(let g=0;g<=i;g++){const _=g/i*s,m=d/n*Math.PI*2;u.x=(t+e*Math.cos(m))*Math.cos(_),u.y=(t+e*Math.cos(m))*Math.sin(_),u.z=e*Math.sin(m),o.push(u.x,u.y,u.z),h.x=t*Math.cos(_),h.y=t*Math.sin(_),f.subVectors(u,h).normalize(),l.push(f.x,f.y,f.z),c.push(g/i),c.push(d/n)}for(let d=1;d<=n;d++)for(let g=1;g<=i;g++){const _=(i+1)*d+g-1,m=(i+1)*(d-1)+g-1,p=(i+1)*(d-1)+g,b=(i+1)*d+g;a.push(_,m,b),a.push(m,p,b)}this.setIndex(a),this.setAttribute("position",new Jt(o,3)),this.setAttribute("normal",new Jt(l,3)),this.setAttribute("uv",new Jt(c,2))}copy(t){return super.copy(t),this.parameters=Object.assign({},t.parameters),this}static fromJSON(t){return new bo(t.radius,t.tube,t.radialSegments,t.tubularSegments,t.arc)}}class _u extends de{constructor(t){super(t),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class tn extends hi{constructor(t){super(),this.isMeshLambertMaterial=!0,this.type="MeshLambertMaterial",this.color=new vt(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new vt(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=Ec,this.normalScale=new Tt(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new hn,this.combine=oo,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(t)}copy(t){return super.copy(t),this.color.copy(t.color),this.map=t.map,this.lightMap=t.lightMap,this.lightMapIntensity=t.lightMapIntensity,this.aoMap=t.aoMap,this.aoMapIntensity=t.aoMapIntensity,this.emissive.copy(t.emissive),this.emissiveMap=t.emissiveMap,this.emissiveIntensity=t.emissiveIntensity,this.bumpMap=t.bumpMap,this.bumpScale=t.bumpScale,this.normalMap=t.normalMap,this.normalMapType=t.normalMapType,this.normalScale.copy(t.normalScale),this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.specularMap=t.specularMap,this.alphaMap=t.alphaMap,this.envMap=t.envMap,this.envMapRotation.copy(t.envMapRotation),this.combine=t.combine,this.reflectivity=t.reflectivity,this.refractionRatio=t.refractionRatio,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this.wireframeLinecap=t.wireframeLinecap,this.wireframeLinejoin=t.wireframeLinejoin,this.flatShading=t.flatShading,this.fog=t.fog,this}}class vu extends hi{constructor(t){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=Th,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(t)}copy(t){return super.copy(t),this.depthPacking=t.depthPacking,this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this.wireframe=t.wireframe,this.wireframeLinewidth=t.wireframeLinewidth,this}}class xu extends hi{constructor(t){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(t)}copy(t){return super.copy(t),this.map=t.map,this.alphaMap=t.alphaMap,this.displacementMap=t.displacementMap,this.displacementScale=t.displacementScale,this.displacementBias=t.displacementBias,this}}class Eo extends Me{constructor(t,e=1){super(),this.isLight=!0,this.type="Light",this.color=new vt(t),this.intensity=e}dispose(){}copy(t,e){return super.copy(t,e),this.color.copy(t.color),this.intensity=t.intensity,this}toJSON(t){const e=super.toJSON(t);return e.object.color=this.color.getHex(),e.object.intensity=this.intensity,this.groundColor!==void 0&&(e.object.groundColor=this.groundColor.getHex()),this.distance!==void 0&&(e.object.distance=this.distance),this.angle!==void 0&&(e.object.angle=this.angle),this.decay!==void 0&&(e.object.decay=this.decay),this.penumbra!==void 0&&(e.object.penumbra=this.penumbra),this.shadow!==void 0&&(e.object.shadow=this.shadow.toJSON()),this.target!==void 0&&(e.object.target=this.target.uuid),e}}class Mu extends Eo{constructor(t,e,n){super(t,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(Me.DEFAULT_UP),this.updateMatrix(),this.groundColor=new vt(e)}copy(t,e){return super.copy(t,e),this.groundColor.copy(t.groundColor),this}}const Zr=new Yt,dl=new U,pl=new U;class Nc{constructor(t){this.camera=t,this.intensity=1,this.bias=0,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new Tt(512,512),this.mapType=xn,this.map=null,this.mapPass=null,this.matrix=new Yt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new xo,this._frameExtents=new Tt(1,1),this._viewportCount=1,this._viewports=[new te(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(t){const e=this.camera,n=this.matrix;dl.setFromMatrixPosition(t.matrixWorld),e.position.copy(dl),pl.setFromMatrixPosition(t.target.matrixWorld),e.lookAt(pl),e.updateMatrixWorld(),Zr.multiplyMatrices(e.projectionMatrix,e.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Zr,e.coordinateSystem,e.reversedDepth),e.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Zr)}getViewport(t){return this._viewports[t]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(t){return this.camera=t.camera.clone(),this.intensity=t.intensity,this.bias=t.bias,this.radius=t.radius,this.autoUpdate=t.autoUpdate,this.needsUpdate=t.needsUpdate,this.normalBias=t.normalBias,this.blurSamples=t.blurSamples,this.mapSize.copy(t.mapSize),this}clone(){return new this.constructor().copy(this)}toJSON(){const t={};return this.intensity!==1&&(t.intensity=this.intensity),this.bias!==0&&(t.bias=this.bias),this.normalBias!==0&&(t.normalBias=this.normalBias),this.radius!==1&&(t.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(t.mapSize=this.mapSize.toArray()),t.camera=this.camera.toJSON(!1).object,delete t.camera.matrix,t}}const ml=new Yt,ss=new U,$r=new U;class yu extends Nc{constructor(){super(new Ye(90,1,.5,500)),this.isPointLightShadow=!0,this._frameExtents=new Tt(4,2),this._viewportCount=6,this._viewports=[new te(2,1,1,1),new te(0,1,1,1),new te(3,1,1,1),new te(1,1,1,1),new te(3,0,1,1),new te(1,0,1,1)],this._cubeDirections=[new U(1,0,0),new U(-1,0,0),new U(0,0,1),new U(0,0,-1),new U(0,1,0),new U(0,-1,0)],this._cubeUps=[new U(0,1,0),new U(0,1,0),new U(0,1,0),new U(0,1,0),new U(0,0,1),new U(0,0,-1)]}updateMatrices(t,e=0){const n=this.camera,i=this.matrix,s=t.distance||n.far;s!==n.far&&(n.far=s,n.updateProjectionMatrix()),ss.setFromMatrixPosition(t.matrixWorld),n.position.copy(ss),$r.copy(n.position),$r.add(this._cubeDirections[e]),n.up.copy(this._cubeUps[e]),n.lookAt($r),n.updateMatrixWorld(),i.makeTranslation(-ss.x,-ss.y,-ss.z),ml.multiplyMatrices(n.projectionMatrix,n.matrixWorldInverse),this._frustum.setFromProjectionMatrix(ml,n.coordinateSystem,n.reversedDepth)}}class Su extends Eo{constructor(t,e,n=0,i=2){super(t,e),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=i,this.shadow=new yu}get power(){return this.intensity*4*Math.PI}set power(t){this.intensity=t/(4*Math.PI)}dispose(){this.shadow.dispose()}copy(t,e){return super.copy(t,e),this.distance=t.distance,this.decay=t.decay,this.shadow=t.shadow.clone(),this}}class To extends Lc{constructor(t=-1,e=1,n=1,i=-1,s=.1,a=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=t,this.right=e,this.top=n,this.bottom=i,this.near=s,this.far=a,this.updateProjectionMatrix()}copy(t,e){return super.copy(t,e),this.left=t.left,this.right=t.right,this.top=t.top,this.bottom=t.bottom,this.near=t.near,this.far=t.far,this.zoom=t.zoom,this.view=t.view===null?null:Object.assign({},t.view),this}setViewOffset(t,e,n,i,s,a){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=t,this.view.fullHeight=e,this.view.offsetX=n,this.view.offsetY=i,this.view.width=s,this.view.height=a,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const t=(this.right-this.left)/(2*this.zoom),e=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,i=(this.top+this.bottom)/2;let s=n-t,a=n+t,o=i+e,l=i-e;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;s+=c*this.view.offsetX,a=s+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(s,a,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(t){const e=super.toJSON(t);return e.object.zoom=this.zoom,e.object.left=this.left,e.object.right=this.right,e.object.top=this.top,e.object.bottom=this.bottom,e.object.near=this.near,e.object.far=this.far,this.view!==null&&(e.object.view=Object.assign({},this.view)),e}}class bu extends Nc{constructor(){super(new To(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class gl extends Eo{constructor(t,e){super(t,e),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(Me.DEFAULT_UP),this.updateMatrix(),this.target=new Me,this.shadow=new bu}dispose(){this.shadow.dispose()}copy(t){return super.copy(t),this.target=t.target.clone(),this.shadow=t.shadow.clone(),this}}class Eu extends Ye{constructor(t=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=t}}class Oc{constructor(t=!0){this.autoStart=t,this.startTime=0,this.oldTime=0,this.elapsedTime=0,this.running=!1}start(){this.startTime=performance.now(),this.oldTime=this.startTime,this.elapsedTime=0,this.running=!0}stop(){this.getElapsedTime(),this.running=!1,this.autoStart=!1}getElapsedTime(){return this.getDelta(),this.elapsedTime}getDelta(){let t=0;if(this.autoStart&&!this.running)return this.start(),0;if(this.running){const e=performance.now();t=(e-this.oldTime)/1e3,this.oldTime=e,this.elapsedTime+=t}return t}}const _l=new Yt;class Tu{constructor(t,e,n=0,i=1/0){this.ray=new vr(t,e),this.near=n,this.far=i,this.camera=null,this.layers=new vo,this.params={Mesh:{},Line:{threshold:1},LOD:{},Points:{threshold:1},Sprite:{}}}set(t,e){this.ray.set(t,e)}setFromCamera(t,e){e.isPerspectiveCamera?(this.ray.origin.setFromMatrixPosition(e.matrixWorld),this.ray.direction.set(t.x,t.y,.5).unproject(e).sub(this.ray.origin).normalize(),this.camera=e):e.isOrthographicCamera?(this.ray.origin.set(t.x,t.y,(e.near+e.far)/(e.near-e.far)).unproject(e),this.ray.direction.set(0,0,-1).transformDirection(e.matrixWorld),this.camera=e):console.error("THREE.Raycaster: Unsupported camera type: "+e.type)}setFromXRController(t){return _l.identity().extractRotation(t.matrixWorld),this.ray.origin.setFromMatrixPosition(t.matrixWorld),this.ray.direction.set(0,0,-1).applyMatrix4(_l),this}intersectObject(t,e=!0,n=[]){return no(t,this,n,e),n.sort(vl),n}intersectObjects(t,e=!0,n=[]){for(let i=0,s=t.length;i<s;i++)no(t[i],this,n,e);return n.sort(vl),n}}function vl(r,t){return r.distance-t.distance}function no(r,t,e,n){let i=!0;if(r.layers.test(t.layers)&&r.raycast(t,e)===!1&&(i=!1),i===!0&&n===!0){const s=r.children;for(let a=0,o=s.length;a<o;a++)no(s[a],t,e,!0)}}function xl(r,t,e,n){const i=wu(n);switch(e){case yc:return r*t;case fo:return r*t/i.components*i.byteLength;case po:return r*t/i.components*i.byteLength;case bc:return r*t*2/i.components*i.byteLength;case mo:return r*t*2/i.components*i.byteLength;case Sc:return r*t*3/i.components*i.byteLength;case cn:return r*t*4/i.components*i.byteLength;case go:return r*t*4/i.components*i.byteLength;case $s:case Js:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*8;case Qs:case tr:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case wa:case Ra:return Math.max(r,16)*Math.max(t,8)/4;case Ta:case Aa:return Math.max(r,8)*Math.max(t,8)/2;case Ca:case Pa:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*8;case Da:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case La:return Math.floor((r+3)/4)*Math.floor((t+3)/4)*16;case Ua:return Math.floor((r+4)/5)*Math.floor((t+3)/4)*16;case Ia:return Math.floor((r+4)/5)*Math.floor((t+4)/5)*16;case Fa:return Math.floor((r+5)/6)*Math.floor((t+4)/5)*16;case Na:return Math.floor((r+5)/6)*Math.floor((t+5)/6)*16;case Oa:return Math.floor((r+7)/8)*Math.floor((t+4)/5)*16;case za:return Math.floor((r+7)/8)*Math.floor((t+5)/6)*16;case Ba:return Math.floor((r+7)/8)*Math.floor((t+7)/8)*16;case ka:return Math.floor((r+9)/10)*Math.floor((t+4)/5)*16;case Va:return Math.floor((r+9)/10)*Math.floor((t+5)/6)*16;case Ha:return Math.floor((r+9)/10)*Math.floor((t+7)/8)*16;case Ga:return Math.floor((r+9)/10)*Math.floor((t+9)/10)*16;case Wa:return Math.floor((r+11)/12)*Math.floor((t+9)/10)*16;case qa:return Math.floor((r+11)/12)*Math.floor((t+11)/12)*16;case Xa:case Ya:case Ka:return Math.ceil(r/4)*Math.ceil(t/4)*16;case ja:case Za:return Math.ceil(r/4)*Math.ceil(t/4)*8;case $a:case Ja:return Math.ceil(r/4)*Math.ceil(t/4)*16}throw new Error(`Unable to determine texture byte length for ${e} format.`)}function wu(r){switch(r){case xn:case _c:return{byteLength:1,components:1};case cs:case vc:case vn:return{byteLength:2,components:1};case ho:case uo:return{byteLength:2,components:4};case oi:case co:case gn:return{byteLength:4,components:1};case xc:case Mc:return{byteLength:4,components:3}}throw new Error(`Unknown texture type ${r}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:ao}}));typeof window<"u"&&(window.__THREE__?console.warn("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=ao);/**
 * @license
 * Copyright 2010-2025 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function zc(){let r=null,t=!1,e=null,n=null;function i(s,a){e(s,a),n=r.requestAnimationFrame(i)}return{start:function(){t!==!0&&e!==null&&(n=r.requestAnimationFrame(i),t=!0)},stop:function(){r.cancelAnimationFrame(n),t=!1},setAnimationLoop:function(s){e=s},setContext:function(s){r=s}}}function Au(r){const t=new WeakMap;function e(o,l){const c=o.array,h=o.usage,u=c.byteLength,f=r.createBuffer();r.bindBuffer(l,f),r.bufferData(l,c,h),o.onUploadCallback();let d;if(c instanceof Float32Array)d=r.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)d=r.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?d=r.HALF_FLOAT:d=r.UNSIGNED_SHORT;else if(c instanceof Int16Array)d=r.SHORT;else if(c instanceof Uint32Array)d=r.UNSIGNED_INT;else if(c instanceof Int32Array)d=r.INT;else if(c instanceof Int8Array)d=r.BYTE;else if(c instanceof Uint8Array)d=r.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)d=r.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:f,type:d,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function n(o,l,c){const h=l.array,u=l.updateRanges;if(r.bindBuffer(c,o),u.length===0)r.bufferSubData(c,0,h);else{u.sort((d,g)=>d.start-g.start);let f=0;for(let d=1;d<u.length;d++){const g=u[f],_=u[d];_.start<=g.start+g.count+1?g.count=Math.max(g.count,_.start+_.count-g.start):(++f,u[f]=_)}u.length=f+1;for(let d=0,g=u.length;d<g;d++){const _=u[d];r.bufferSubData(c,_.start*h.BYTES_PER_ELEMENT,h,_.start,_.count)}l.clearUpdateRanges()}l.onUploadCallback()}function i(o){return o.isInterleavedBufferAttribute&&(o=o.data),t.get(o)}function s(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=t.get(o);l&&(r.deleteBuffer(l.buffer),t.delete(o))}function a(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=t.get(o);(!h||h.version<o.version)&&t.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=t.get(o);if(c===void 0)t.set(o,e(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:i,remove:s,update:a}}var Ru=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Cu=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Pu=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Du=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Lu=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,Uu=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Iu=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Fu=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Nu=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Ou=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,zu=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Bu=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,ku=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Vu=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Hu=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Gu=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Wu=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,qu=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Xu=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Yu=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Ku=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,ju=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Zu=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,$u=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Ju=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Qu=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,tf=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,ef=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,nf=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,sf=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,rf="gl_FragColor = linearToOutputTexel( gl_FragColor );",af=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,of=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,lf=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,cf=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,hf=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,uf=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,ff=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,df=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,pf=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,mf=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,gf=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,_f=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,vf=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,xf=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,Mf=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,yf=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Sf=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,bf=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,Ef=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Tf=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,wf=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Af=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Rf=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Cf=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Pf=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Df=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Lf=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Uf=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,If=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Ff=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Nf=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Of=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,zf=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Bf=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,kf=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Vf=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Hf=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Gf=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Wf=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,qf=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Xf=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Yf=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Kf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,jf=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Zf=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,$f=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,Jf=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Qf=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,td=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,ed=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,nd=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,id=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,sd=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,rd=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,ad=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,od=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,ld=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,cd=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,hd=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow( sampler2D shadow, vec2 uv, float compare ) {
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare, distribution.x );
		#endif
		if ( hard_shadow != 1.0 ) {
			float distance = compare - distribution.x;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,ud=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,fd=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,dd=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,pd=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,md=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,gd=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,_d=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,vd=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,xd=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,Md=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,yd=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Sd=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,bd=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,Ed=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Td=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,wd=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Ad=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Rd=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Cd=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Pd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Dd=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Ld=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Ud=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Id=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Fd=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Nd=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Od=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,zd=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Bd=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,kd=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Vd=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Hd=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Gd=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Wd=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,qd=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Xd=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Yd=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Kd=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,jd=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,Zd=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,$d=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Jd=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Qd=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,tp=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ep=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,np=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,ip=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,sp=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,rp=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,ap=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,op=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Bt={alphahash_fragment:Ru,alphahash_pars_fragment:Cu,alphamap_fragment:Pu,alphamap_pars_fragment:Du,alphatest_fragment:Lu,alphatest_pars_fragment:Uu,aomap_fragment:Iu,aomap_pars_fragment:Fu,batching_pars_vertex:Nu,batching_vertex:Ou,begin_vertex:zu,beginnormal_vertex:Bu,bsdfs:ku,iridescence_fragment:Vu,bumpmap_pars_fragment:Hu,clipping_planes_fragment:Gu,clipping_planes_pars_fragment:Wu,clipping_planes_pars_vertex:qu,clipping_planes_vertex:Xu,color_fragment:Yu,color_pars_fragment:Ku,color_pars_vertex:ju,color_vertex:Zu,common:$u,cube_uv_reflection_fragment:Ju,defaultnormal_vertex:Qu,displacementmap_pars_vertex:tf,displacementmap_vertex:ef,emissivemap_fragment:nf,emissivemap_pars_fragment:sf,colorspace_fragment:rf,colorspace_pars_fragment:af,envmap_fragment:of,envmap_common_pars_fragment:lf,envmap_pars_fragment:cf,envmap_pars_vertex:hf,envmap_physical_pars_fragment:yf,envmap_vertex:uf,fog_vertex:ff,fog_pars_vertex:df,fog_fragment:pf,fog_pars_fragment:mf,gradientmap_pars_fragment:gf,lightmap_pars_fragment:_f,lights_lambert_fragment:vf,lights_lambert_pars_fragment:xf,lights_pars_begin:Mf,lights_toon_fragment:Sf,lights_toon_pars_fragment:bf,lights_phong_fragment:Ef,lights_phong_pars_fragment:Tf,lights_physical_fragment:wf,lights_physical_pars_fragment:Af,lights_fragment_begin:Rf,lights_fragment_maps:Cf,lights_fragment_end:Pf,logdepthbuf_fragment:Df,logdepthbuf_pars_fragment:Lf,logdepthbuf_pars_vertex:Uf,logdepthbuf_vertex:If,map_fragment:Ff,map_pars_fragment:Nf,map_particle_fragment:Of,map_particle_pars_fragment:zf,metalnessmap_fragment:Bf,metalnessmap_pars_fragment:kf,morphinstance_vertex:Vf,morphcolor_vertex:Hf,morphnormal_vertex:Gf,morphtarget_pars_vertex:Wf,morphtarget_vertex:qf,normal_fragment_begin:Xf,normal_fragment_maps:Yf,normal_pars_fragment:Kf,normal_pars_vertex:jf,normal_vertex:Zf,normalmap_pars_fragment:$f,clearcoat_normal_fragment_begin:Jf,clearcoat_normal_fragment_maps:Qf,clearcoat_pars_fragment:td,iridescence_pars_fragment:ed,opaque_fragment:nd,packing:id,premultiplied_alpha_fragment:sd,project_vertex:rd,dithering_fragment:ad,dithering_pars_fragment:od,roughnessmap_fragment:ld,roughnessmap_pars_fragment:cd,shadowmap_pars_fragment:hd,shadowmap_pars_vertex:ud,shadowmap_vertex:fd,shadowmask_pars_fragment:dd,skinbase_vertex:pd,skinning_pars_vertex:md,skinning_vertex:gd,skinnormal_vertex:_d,specularmap_fragment:vd,specularmap_pars_fragment:xd,tonemapping_fragment:Md,tonemapping_pars_fragment:yd,transmission_fragment:Sd,transmission_pars_fragment:bd,uv_pars_fragment:Ed,uv_pars_vertex:Td,uv_vertex:wd,worldpos_vertex:Ad,background_vert:Rd,background_frag:Cd,backgroundCube_vert:Pd,backgroundCube_frag:Dd,cube_vert:Ld,cube_frag:Ud,depth_vert:Id,depth_frag:Fd,distanceRGBA_vert:Nd,distanceRGBA_frag:Od,equirect_vert:zd,equirect_frag:Bd,linedashed_vert:kd,linedashed_frag:Vd,meshbasic_vert:Hd,meshbasic_frag:Gd,meshlambert_vert:Wd,meshlambert_frag:qd,meshmatcap_vert:Xd,meshmatcap_frag:Yd,meshnormal_vert:Kd,meshnormal_frag:jd,meshphong_vert:Zd,meshphong_frag:$d,meshphysical_vert:Jd,meshphysical_frag:Qd,meshtoon_vert:tp,meshtoon_frag:ep,points_vert:np,points_frag:ip,shadow_vert:sp,shadow_frag:rp,sprite_vert:ap,sprite_frag:op},at={common:{diffuse:{value:new vt(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Nt},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Nt}},envmap:{envMap:{value:null},envMapRotation:{value:new Nt},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Nt}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Nt}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Nt},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Nt},normalScale:{value:new Tt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Nt},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Nt}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Nt}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Nt}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new vt(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new vt(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0},uvTransform:{value:new Nt}},sprite:{diffuse:{value:new vt(16777215)},opacity:{value:1},center:{value:new Tt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Nt},alphaMap:{value:null},alphaMapTransform:{value:new Nt},alphaTest:{value:0}}},dn={basic:{uniforms:Ne([at.common,at.specularmap,at.envmap,at.aomap,at.lightmap,at.fog]),vertexShader:Bt.meshbasic_vert,fragmentShader:Bt.meshbasic_frag},lambert:{uniforms:Ne([at.common,at.specularmap,at.envmap,at.aomap,at.lightmap,at.emissivemap,at.bumpmap,at.normalmap,at.displacementmap,at.fog,at.lights,{emissive:{value:new vt(0)}}]),vertexShader:Bt.meshlambert_vert,fragmentShader:Bt.meshlambert_frag},phong:{uniforms:Ne([at.common,at.specularmap,at.envmap,at.aomap,at.lightmap,at.emissivemap,at.bumpmap,at.normalmap,at.displacementmap,at.fog,at.lights,{emissive:{value:new vt(0)},specular:{value:new vt(1118481)},shininess:{value:30}}]),vertexShader:Bt.meshphong_vert,fragmentShader:Bt.meshphong_frag},standard:{uniforms:Ne([at.common,at.envmap,at.aomap,at.lightmap,at.emissivemap,at.bumpmap,at.normalmap,at.displacementmap,at.roughnessmap,at.metalnessmap,at.fog,at.lights,{emissive:{value:new vt(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Bt.meshphysical_vert,fragmentShader:Bt.meshphysical_frag},toon:{uniforms:Ne([at.common,at.aomap,at.lightmap,at.emissivemap,at.bumpmap,at.normalmap,at.displacementmap,at.gradientmap,at.fog,at.lights,{emissive:{value:new vt(0)}}]),vertexShader:Bt.meshtoon_vert,fragmentShader:Bt.meshtoon_frag},matcap:{uniforms:Ne([at.common,at.bumpmap,at.normalmap,at.displacementmap,at.fog,{matcap:{value:null}}]),vertexShader:Bt.meshmatcap_vert,fragmentShader:Bt.meshmatcap_frag},points:{uniforms:Ne([at.points,at.fog]),vertexShader:Bt.points_vert,fragmentShader:Bt.points_frag},dashed:{uniforms:Ne([at.common,at.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Bt.linedashed_vert,fragmentShader:Bt.linedashed_frag},depth:{uniforms:Ne([at.common,at.displacementmap]),vertexShader:Bt.depth_vert,fragmentShader:Bt.depth_frag},normal:{uniforms:Ne([at.common,at.bumpmap,at.normalmap,at.displacementmap,{opacity:{value:1}}]),vertexShader:Bt.meshnormal_vert,fragmentShader:Bt.meshnormal_frag},sprite:{uniforms:Ne([at.sprite,at.fog]),vertexShader:Bt.sprite_vert,fragmentShader:Bt.sprite_frag},background:{uniforms:{uvTransform:{value:new Nt},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Bt.background_vert,fragmentShader:Bt.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Nt}},vertexShader:Bt.backgroundCube_vert,fragmentShader:Bt.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Bt.cube_vert,fragmentShader:Bt.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Bt.equirect_vert,fragmentShader:Bt.equirect_frag},distanceRGBA:{uniforms:Ne([at.common,at.displacementmap,{referencePosition:{value:new U},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Bt.distanceRGBA_vert,fragmentShader:Bt.distanceRGBA_frag},shadow:{uniforms:Ne([at.lights,at.fog,{color:{value:new vt(0)},opacity:{value:1}}]),vertexShader:Bt.shadow_vert,fragmentShader:Bt.shadow_frag}};dn.physical={uniforms:Ne([dn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Nt},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Nt},clearcoatNormalScale:{value:new Tt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Nt},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Nt},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Nt},sheen:{value:0},sheenColor:{value:new vt(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Nt},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Nt},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Nt},transmissionSamplerSize:{value:new Tt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Nt},attenuationDistance:{value:0},attenuationColor:{value:new vt(0)},specularColor:{value:new vt(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Nt},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Nt},anisotropyVector:{value:new Tt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Nt}}]),vertexShader:Bt.meshphysical_vert,fragmentShader:Bt.meshphysical_frag};const Ws={r:0,b:0,g:0},$n=new hn,lp=new Yt;function cp(r,t,e,n,i,s,a){const o=new vt(0);let l=s===!0?0:1,c,h,u=null,f=0,d=null;function g(E){let y=E.isScene===!0?E.background:null;return y&&y.isTexture&&(y=(E.backgroundBlurriness>0?e:t).get(y)),y}function _(E){let y=!1;const w=g(E);w===null?p(o,l):w&&w.isColor&&(p(w,1),y=!0);const A=r.xr.getEnvironmentBlendMode();A==="additive"?n.buffers.color.setClear(0,0,0,1,a):A==="alpha-blend"&&n.buffers.color.setClear(0,0,0,0,a),(r.autoClear||y)&&(n.buffers.depth.setTest(!0),n.buffers.depth.setMask(!0),n.buffers.color.setMask(!0),r.clear(r.autoClearColor,r.autoClearDepth,r.autoClearStencil))}function m(E,y){const w=g(y);w&&(w.isCubeTexture||w.mapping===_r)?(h===void 0&&(h=new ee(new nn(1,1,1),new de({name:"BackgroundCubeMaterial",uniforms:ki(dn.backgroundCube.uniforms),vertexShader:dn.backgroundCube.vertexShader,fragmentShader:dn.backgroundCube.fragmentShader,side:Ue,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),h.geometry.deleteAttribute("normal"),h.geometry.deleteAttribute("uv"),h.onBeforeRender=function(A,C,L){this.matrixWorld.copyPosition(L.matrixWorld)},Object.defineProperty(h.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),i.update(h)),$n.copy(y.backgroundRotation),$n.x*=-1,$n.y*=-1,$n.z*=-1,w.isCubeTexture&&w.isRenderTargetTexture===!1&&($n.y*=-1,$n.z*=-1),h.material.uniforms.envMap.value=w,h.material.uniforms.flipEnvMap.value=w.isCubeTexture&&w.isRenderTargetTexture===!1?-1:1,h.material.uniforms.backgroundBlurriness.value=y.backgroundBlurriness,h.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,h.material.uniforms.backgroundRotation.value.setFromMatrix4(lp.makeRotationFromEuler($n)),h.material.toneMapped=Xt.getTransfer(w.colorSpace)!==$t,(u!==w||f!==w.version||d!==r.toneMapping)&&(h.material.needsUpdate=!0,u=w,f=w.version,d=r.toneMapping),h.layers.enableAll(),E.unshift(h,h.geometry,h.material,0,0,null)):w&&w.isTexture&&(c===void 0&&(c=new ee(new fi(2,2),new de({name:"BackgroundMaterial",uniforms:ki(dn.background.uniforms),vertexShader:dn.background.vertexShader,fragmentShader:dn.background.fragmentShader,side:Vn,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),Object.defineProperty(c.material,"map",{get:function(){return this.uniforms.t2D.value}}),i.update(c)),c.material.uniforms.t2D.value=w,c.material.uniforms.backgroundIntensity.value=y.backgroundIntensity,c.material.toneMapped=Xt.getTransfer(w.colorSpace)!==$t,w.matrixAutoUpdate===!0&&w.updateMatrix(),c.material.uniforms.uvTransform.value.copy(w.matrix),(u!==w||f!==w.version||d!==r.toneMapping)&&(c.material.needsUpdate=!0,u=w,f=w.version,d=r.toneMapping),c.layers.enableAll(),E.unshift(c,c.geometry,c.material,0,0,null))}function p(E,y){E.getRGB(Ws,Dc(r)),n.buffers.color.setClear(Ws.r,Ws.g,Ws.b,y,a)}function b(){h!==void 0&&(h.geometry.dispose(),h.material.dispose(),h=void 0),c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0)}return{getClearColor:function(){return o},setClearColor:function(E,y=1){o.set(E),l=y,p(o,l)},getClearAlpha:function(){return l},setClearAlpha:function(E){l=E,p(o,l)},render:_,addToRenderList:m,dispose:b}}function hp(r,t){const e=r.getParameter(r.MAX_VERTEX_ATTRIBS),n={},i=f(null);let s=i,a=!1;function o(x,P,F,B,k){let V=!1;const X=u(B,F,P);s!==X&&(s=X,c(s.object)),V=d(x,B,F,k),V&&g(x,B,F,k),k!==null&&t.update(k,r.ELEMENT_ARRAY_BUFFER),(V||a)&&(a=!1,y(x,P,F,B),k!==null&&r.bindBuffer(r.ELEMENT_ARRAY_BUFFER,t.get(k).buffer))}function l(){return r.createVertexArray()}function c(x){return r.bindVertexArray(x)}function h(x){return r.deleteVertexArray(x)}function u(x,P,F){const B=F.wireframe===!0;let k=n[x.id];k===void 0&&(k={},n[x.id]=k);let V=k[P.id];V===void 0&&(V={},k[P.id]=V);let X=V[B];return X===void 0&&(X=f(l()),V[B]=X),X}function f(x){const P=[],F=[],B=[];for(let k=0;k<e;k++)P[k]=0,F[k]=0,B[k]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:P,enabledAttributes:F,attributeDivisors:B,object:x,attributes:{},index:null}}function d(x,P,F,B){const k=s.attributes,V=P.attributes;let X=0;const Z=F.getAttributes();for(const W in Z)if(Z[W].location>=0){const ct=k[W];let St=V[W];if(St===void 0&&(W==="instanceMatrix"&&x.instanceMatrix&&(St=x.instanceMatrix),W==="instanceColor"&&x.instanceColor&&(St=x.instanceColor)),ct===void 0||ct.attribute!==St||St&&ct.data!==St.data)return!0;X++}return s.attributesNum!==X||s.index!==B}function g(x,P,F,B){const k={},V=P.attributes;let X=0;const Z=F.getAttributes();for(const W in Z)if(Z[W].location>=0){let ct=V[W];ct===void 0&&(W==="instanceMatrix"&&x.instanceMatrix&&(ct=x.instanceMatrix),W==="instanceColor"&&x.instanceColor&&(ct=x.instanceColor));const St={};St.attribute=ct,ct&&ct.data&&(St.data=ct.data),k[W]=St,X++}s.attributes=k,s.attributesNum=X,s.index=B}function _(){const x=s.newAttributes;for(let P=0,F=x.length;P<F;P++)x[P]=0}function m(x){p(x,0)}function p(x,P){const F=s.newAttributes,B=s.enabledAttributes,k=s.attributeDivisors;F[x]=1,B[x]===0&&(r.enableVertexAttribArray(x),B[x]=1),k[x]!==P&&(r.vertexAttribDivisor(x,P),k[x]=P)}function b(){const x=s.newAttributes,P=s.enabledAttributes;for(let F=0,B=P.length;F<B;F++)P[F]!==x[F]&&(r.disableVertexAttribArray(F),P[F]=0)}function E(x,P,F,B,k,V,X){X===!0?r.vertexAttribIPointer(x,P,F,k,V):r.vertexAttribPointer(x,P,F,B,k,V)}function y(x,P,F,B){_();const k=B.attributes,V=F.getAttributes(),X=P.defaultAttributeValues;for(const Z in V){const W=V[Z];if(W.location>=0){let rt=k[Z];if(rt===void 0&&(Z==="instanceMatrix"&&x.instanceMatrix&&(rt=x.instanceMatrix),Z==="instanceColor"&&x.instanceColor&&(rt=x.instanceColor)),rt!==void 0){const ct=rt.normalized,St=rt.itemSize,Vt=t.get(rt);if(Vt===void 0)continue;const ie=Vt.buffer,ae=Vt.type,jt=Vt.bytesPerElement,K=ae===r.INT||ae===r.UNSIGNED_INT||rt.gpuType===co;if(rt.isInterleavedBufferAttribute){const J=rt.data,dt=J.stride,Lt=rt.offset;if(J.isInstancedInterleavedBuffer){for(let Et=0;Et<W.locationSize;Et++)p(W.location+Et,J.meshPerAttribute);x.isInstancedMesh!==!0&&B._maxInstanceCount===void 0&&(B._maxInstanceCount=J.meshPerAttribute*J.count)}else for(let Et=0;Et<W.locationSize;Et++)m(W.location+Et);r.bindBuffer(r.ARRAY_BUFFER,ie);for(let Et=0;Et<W.locationSize;Et++)E(W.location+Et,St/W.locationSize,ae,ct,dt*jt,(Lt+St/W.locationSize*Et)*jt,K)}else{if(rt.isInstancedBufferAttribute){for(let J=0;J<W.locationSize;J++)p(W.location+J,rt.meshPerAttribute);x.isInstancedMesh!==!0&&B._maxInstanceCount===void 0&&(B._maxInstanceCount=rt.meshPerAttribute*rt.count)}else for(let J=0;J<W.locationSize;J++)m(W.location+J);r.bindBuffer(r.ARRAY_BUFFER,ie);for(let J=0;J<W.locationSize;J++)E(W.location+J,St/W.locationSize,ae,ct,St*jt,St/W.locationSize*J*jt,K)}}else if(X!==void 0){const ct=X[Z];if(ct!==void 0)switch(ct.length){case 2:r.vertexAttrib2fv(W.location,ct);break;case 3:r.vertexAttrib3fv(W.location,ct);break;case 4:r.vertexAttrib4fv(W.location,ct);break;default:r.vertexAttrib1fv(W.location,ct)}}}}b()}function w(){L();for(const x in n){const P=n[x];for(const F in P){const B=P[F];for(const k in B)h(B[k].object),delete B[k];delete P[F]}delete n[x]}}function A(x){if(n[x.id]===void 0)return;const P=n[x.id];for(const F in P){const B=P[F];for(const k in B)h(B[k].object),delete B[k];delete P[F]}delete n[x.id]}function C(x){for(const P in n){const F=n[P];if(F[x.id]===void 0)continue;const B=F[x.id];for(const k in B)h(B[k].object),delete B[k];delete F[x.id]}}function L(){M(),a=!0,s!==i&&(s=i,c(s.object))}function M(){i.geometry=null,i.program=null,i.wireframe=!1}return{setup:o,reset:L,resetDefaultState:M,dispose:w,releaseStatesOfGeometry:A,releaseStatesOfProgram:C,initAttributes:_,enableAttribute:m,disableUnusedAttributes:b}}function up(r,t,e){let n;function i(c){n=c}function s(c,h){r.drawArrays(n,c,h),e.update(h,n,1)}function a(c,h,u){u!==0&&(r.drawArraysInstanced(n,c,h,u),e.update(h,n,u))}function o(c,h,u){if(u===0)return;t.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,c,0,h,0,u);let d=0;for(let g=0;g<u;g++)d+=h[g];e.update(d,n,1)}function l(c,h,u,f){if(u===0)return;const d=t.get("WEBGL_multi_draw");if(d===null)for(let g=0;g<c.length;g++)a(c[g],h[g],f[g]);else{d.multiDrawArraysInstancedWEBGL(n,c,0,h,0,f,0,u);let g=0;for(let _=0;_<u;_++)g+=h[_]*f[_];e.update(g,n,1)}}this.setMode=i,this.render=s,this.renderInstances=a,this.renderMultiDraw=o,this.renderMultiDrawInstances=l}function fp(r,t,e,n){let i;function s(){if(i!==void 0)return i;if(t.has("EXT_texture_filter_anisotropic")===!0){const C=t.get("EXT_texture_filter_anisotropic");i=r.getParameter(C.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else i=0;return i}function a(C){return!(C!==cn&&n.convert(C)!==r.getParameter(r.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(C){const L=C===vn&&(t.has("EXT_color_buffer_half_float")||t.has("EXT_color_buffer_float"));return!(C!==xn&&n.convert(C)!==r.getParameter(r.IMPLEMENTATION_COLOR_READ_TYPE)&&C!==gn&&!L)}function l(C){if(C==="highp"){if(r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.HIGH_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.HIGH_FLOAT).precision>0)return"highp";C="mediump"}return C==="mediump"&&r.getShaderPrecisionFormat(r.VERTEX_SHADER,r.MEDIUM_FLOAT).precision>0&&r.getShaderPrecisionFormat(r.FRAGMENT_SHADER,r.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=e.precision!==void 0?e.precision:"highp";const h=l(c);h!==c&&(console.warn("THREE.WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=e.logarithmicDepthBuffer===!0,f=e.reversedDepthBuffer===!0&&t.has("EXT_clip_control"),d=r.getParameter(r.MAX_TEXTURE_IMAGE_UNITS),g=r.getParameter(r.MAX_VERTEX_TEXTURE_IMAGE_UNITS),_=r.getParameter(r.MAX_TEXTURE_SIZE),m=r.getParameter(r.MAX_CUBE_MAP_TEXTURE_SIZE),p=r.getParameter(r.MAX_VERTEX_ATTRIBS),b=r.getParameter(r.MAX_VERTEX_UNIFORM_VECTORS),E=r.getParameter(r.MAX_VARYING_VECTORS),y=r.getParameter(r.MAX_FRAGMENT_UNIFORM_VECTORS),w=g>0,A=r.getParameter(r.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:s,getMaxPrecision:l,textureFormatReadable:a,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reversedDepthBuffer:f,maxTextures:d,maxVertexTextures:g,maxTextureSize:_,maxCubemapSize:m,maxAttributes:p,maxVertexUniforms:b,maxVaryings:E,maxFragmentUniforms:y,vertexTextures:w,maxSamples:A}}function dp(r){const t=this;let e=null,n=0,i=!1,s=!1;const a=new On,o=new Nt,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,f){const d=u.length!==0||f||n!==0||i;return i=f,n=u.length,d},this.beginShadows=function(){s=!0,h(null)},this.endShadows=function(){s=!1},this.setGlobalState=function(u,f){e=h(u,f,0)},this.setState=function(u,f,d){const g=u.clippingPlanes,_=u.clipIntersection,m=u.clipShadows,p=r.get(u);if(!i||g===null||g.length===0||s&&!m)s?h(null):c();else{const b=s?0:n,E=b*4;let y=p.clippingState||null;l.value=y,y=h(g,f,E,d);for(let w=0;w!==E;++w)y[w]=e[w];p.clippingState=y,this.numIntersection=_?this.numPlanes:0,this.numPlanes+=b}};function c(){l.value!==e&&(l.value=e,l.needsUpdate=n>0),t.numPlanes=n,t.numIntersection=0}function h(u,f,d,g){const _=u!==null?u.length:0;let m=null;if(_!==0){if(m=l.value,g!==!0||m===null){const p=d+_*4,b=f.matrixWorldInverse;o.getNormalMatrix(b),(m===null||m.length<p)&&(m=new Float32Array(p));for(let E=0,y=d;E!==_;++E,y+=4)a.copy(u[E]).applyMatrix4(b,o),a.normal.toArray(m,y),m[y+3]=a.constant}l.value=m,l.needsUpdate=!0}return t.numPlanes=_,t.numIntersection=0,m}}function pp(r){let t=new WeakMap;function e(a,o){return o===ya?a.mapping=Oi:o===Sa&&(a.mapping=zi),a}function n(a){if(a&&a.isTexture){const o=a.mapping;if(o===ya||o===Sa)if(t.has(a)){const l=t.get(a).texture;return e(l,a.mapping)}else{const l=a.image;if(l&&l.height>0){const c=new ru(l.height);return c.fromEquirectangularTexture(r,a),t.set(a,c),a.addEventListener("dispose",i),e(c.texture,a.mapping)}else return null}}return a}function i(a){const o=a.target;o.removeEventListener("dispose",i);const l=t.get(o);l!==void 0&&(t.delete(o),l.dispose())}function s(){t=new WeakMap}return{get:n,dispose:s}}const Ui=4,Ml=[.125,.215,.35,.446,.526,.582],ii=20,Jr=new To,yl=new vt;let Qr=null,ta=0,ea=0,na=!1;const ei=(1+Math.sqrt(5))/2,Ri=1/ei,Sl=[new U(-ei,Ri,0),new U(ei,Ri,0),new U(-Ri,0,ei),new U(Ri,0,ei),new U(0,ei,-Ri),new U(0,ei,Ri),new U(-1,1,-1),new U(1,1,-1),new U(-1,1,1),new U(1,1,1)],mp=new U;class bl{constructor(t){this._renderer=t,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(t,e=0,n=.1,i=100,s={}){const{size:a=256,position:o=mp}=s;Qr=this._renderer.getRenderTarget(),ta=this._renderer.getActiveCubeFace(),ea=this._renderer.getActiveMipmapLevel(),na=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(a);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(t,n,i,l,o),e>0&&this._blur(l,0,0,e),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(t,e=null){return this._fromTexture(t,e)}fromCubemap(t,e=null){return this._fromTexture(t,e)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=wl(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=Tl(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(t){this._lodMax=Math.floor(Math.log2(t)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let t=0;t<this._lodPlanes.length;t++)this._lodPlanes[t].dispose()}_cleanup(t){this._renderer.setRenderTarget(Qr,ta,ea),this._renderer.xr.enabled=na,t.scissorTest=!1,qs(t,0,0,t.width,t.height)}_fromTexture(t,e){t.mapping===Oi||t.mapping===zi?this._setSize(t.image.length===0?16:t.image[0].width||t.image[0].image.width):this._setSize(t.image.width/4),Qr=this._renderer.getRenderTarget(),ta=this._renderer.getActiveCubeFace(),ea=this._renderer.getActiveMipmapLevel(),na=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=e||this._allocateTargets();return this._textureToCubeUV(t,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const t=3*Math.max(this._cubeSize,112),e=4*this._cubeSize,n={magFilter:mn,minFilter:mn,generateMipmaps:!1,type:vn,format:cn,colorSpace:Bi,depthBuffer:!1},i=El(t,e,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==t||this._pingPongRenderTarget.height!==e){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=El(t,e,n);const{_lodMax:s}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=gp(s)),this._blurMaterial=_p(s,t,e)}return i}_compileMaterial(t){const e=new ee(this._lodPlanes[0],t);this._renderer.compile(e,Jr)}_sceneToCubeUV(t,e,n,i,s){const l=new Ye(90,1,e,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],u=this._renderer,f=u.autoClear,d=u.toneMapping;u.getClearColor(yl),u.toneMapping=kn,u.autoClear=!1,u.state.buffers.depth.getReversed()&&(u.setRenderTarget(i),u.clearDepth(),u.setRenderTarget(null));const _=new Wn({name:"PMREM.Background",side:Ue,depthWrite:!1,depthTest:!1}),m=new ee(new nn,_);let p=!1;const b=t.background;b?b.isColor&&(_.color.copy(b),t.background=null,p=!0):(_.color.copy(yl),p=!0);for(let E=0;E<6;E++){const y=E%3;y===0?(l.up.set(0,c[E],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x+h[E],s.y,s.z)):y===1?(l.up.set(0,0,c[E]),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y+h[E],s.z)):(l.up.set(0,c[E],0),l.position.set(s.x,s.y,s.z),l.lookAt(s.x,s.y,s.z+h[E]));const w=this._cubeSize;qs(i,y*w,E>2?w:0,w,w),u.setRenderTarget(i),p&&u.render(m,l),u.render(t,l)}m.geometry.dispose(),m.material.dispose(),u.toneMapping=d,u.autoClear=f,t.background=b}_textureToCubeUV(t,e){const n=this._renderer,i=t.mapping===Oi||t.mapping===zi;i?(this._cubemapMaterial===null&&(this._cubemapMaterial=wl()),this._cubemapMaterial.uniforms.flipEnvMap.value=t.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=Tl());const s=i?this._cubemapMaterial:this._equirectMaterial,a=new ee(this._lodPlanes[0],s),o=s.uniforms;o.envMap.value=t;const l=this._cubeSize;qs(e,0,0,3*l,2*l),n.setRenderTarget(e),n.render(a,Jr)}_applyPMREM(t){const e=this._renderer,n=e.autoClear;e.autoClear=!1;const i=this._lodPlanes.length;for(let s=1;s<i;s++){const a=Math.sqrt(this._sigmas[s]*this._sigmas[s]-this._sigmas[s-1]*this._sigmas[s-1]),o=Sl[(i-s-1)%Sl.length];this._blur(t,s-1,s,a,o)}e.autoClear=n}_blur(t,e,n,i,s){const a=this._pingPongRenderTarget;this._halfBlur(t,a,e,n,i,"latitudinal",s),this._halfBlur(a,t,n,n,i,"longitudinal",s)}_halfBlur(t,e,n,i,s,a,o){const l=this._renderer,c=this._blurMaterial;a!=="latitudinal"&&a!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const h=3,u=new ee(this._lodPlanes[i],c),f=c.uniforms,d=this._sizeLods[n]-1,g=isFinite(s)?Math.PI/(2*d):2*Math.PI/(2*ii-1),_=s/g,m=isFinite(s)?1+Math.floor(h*_):ii;m>ii&&console.warn(`sigmaRadians, ${s}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${ii}`);const p=[];let b=0;for(let C=0;C<ii;++C){const L=C/_,M=Math.exp(-L*L/2);p.push(M),C===0?b+=M:C<m&&(b+=2*M)}for(let C=0;C<p.length;C++)p[C]=p[C]/b;f.envMap.value=t.texture,f.samples.value=m,f.weights.value=p,f.latitudinal.value=a==="latitudinal",o&&(f.poleAxis.value=o);const{_lodMax:E}=this;f.dTheta.value=g,f.mipInt.value=E-n;const y=this._sizeLods[i],w=3*y*(i>E-Ui?i-E+Ui:0),A=4*(this._cubeSize-y);qs(e,w,A,3*y,2*y),l.setRenderTarget(e),l.render(u,Jr)}}function gp(r){const t=[],e=[],n=[];let i=r;const s=r-Ui+1+Ml.length;for(let a=0;a<s;a++){const o=Math.pow(2,i);e.push(o);let l=1/o;a>r-Ui?l=Ml[a-r+Ui-1]:a===0&&(l=0),n.push(l);const c=1/(o-2),h=-c,u=1+c,f=[h,h,u,h,u,u,h,h,u,u,h,u],d=6,g=6,_=3,m=2,p=1,b=new Float32Array(_*g*d),E=new Float32Array(m*g*d),y=new Float32Array(p*g*d);for(let A=0;A<d;A++){const C=A%3*2/3-1,L=A>2?0:-1,M=[C,L,0,C+2/3,L,0,C+2/3,L+1,0,C,L,0,C+2/3,L+1,0,C,L+1,0];b.set(M,_*g*A),E.set(f,m*g*A);const x=[A,A,A,A,A,A];y.set(x,p*g*A)}const w=new xe;w.setAttribute("position",new we(b,_)),w.setAttribute("uv",new we(E,m)),w.setAttribute("faceIndex",new we(y,p)),t.push(w),i>Ui&&i--}return{lodPlanes:t,sizeLods:e,sigmas:n}}function El(r,t,e){const n=new Qe(r,t,e);return n.texture.mapping=_r,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function qs(r,t,e,n,i){r.viewport.set(t,e,n,i),r.scissor.set(t,e,n,i)}function _p(r,t,e){const n=new Float32Array(ii),i=new U(0,1,0);return new de({name:"SphericalGaussianBlur",defines:{n:ii,CUBEUV_TEXEL_WIDTH:1/t,CUBEUV_TEXEL_HEIGHT:1/e,CUBEUV_MAX_MIP:`${r}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:i}},vertexShader:wo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:An,depthTest:!1,depthWrite:!1})}function Tl(){return new de({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:wo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:An,depthTest:!1,depthWrite:!1})}function wl(){return new de({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:wo(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:An,depthTest:!1,depthWrite:!1})}function wo(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function vp(r){let t=new WeakMap,e=null;function n(o){if(o&&o.isTexture){const l=o.mapping,c=l===ya||l===Sa,h=l===Oi||l===zi;if(c||h){let u=t.get(o);const f=u!==void 0?u.texture.pmremVersion:0;if(o.isRenderTargetTexture&&o.pmremVersion!==f)return e===null&&(e=new bl(r)),u=c?e.fromEquirectangular(o,u):e.fromCubemap(o,u),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),u.texture;if(u!==void 0)return u.texture;{const d=o.image;return c&&d&&d.height>0||h&&d&&i(d)?(e===null&&(e=new bl(r)),u=c?e.fromEquirectangular(o):e.fromCubemap(o),u.texture.pmremVersion=o.pmremVersion,t.set(o,u),o.addEventListener("dispose",s),u.texture):null}}}return o}function i(o){let l=0;const c=6;for(let h=0;h<c;h++)o[h]!==void 0&&l++;return l===c}function s(o){const l=o.target;l.removeEventListener("dispose",s);const c=t.get(l);c!==void 0&&(t.delete(l),c.dispose())}function a(){t=new WeakMap,e!==null&&(e.dispose(),e=null)}return{get:n,dispose:a}}function xp(r){const t={};function e(n){if(t[n]!==void 0)return t[n];let i;switch(n){case"WEBGL_depth_texture":i=r.getExtension("WEBGL_depth_texture")||r.getExtension("MOZ_WEBGL_depth_texture")||r.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":i=r.getExtension("EXT_texture_filter_anisotropic")||r.getExtension("MOZ_EXT_texture_filter_anisotropic")||r.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":i=r.getExtension("WEBGL_compressed_texture_s3tc")||r.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":i=r.getExtension("WEBGL_compressed_texture_pvrtc")||r.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:i=r.getExtension(n)}return t[n]=i,i}return{has:function(n){return e(n)!==null},init:function(){e("EXT_color_buffer_float"),e("WEBGL_clip_cull_distance"),e("OES_texture_float_linear"),e("EXT_color_buffer_half_float"),e("WEBGL_multisampled_render_to_texture"),e("WEBGL_render_shared_exponent")},get:function(n){const i=e(n);return i===null&&ds("THREE.WebGLRenderer: "+n+" extension not supported."),i}}}function Mp(r,t,e,n){const i={},s=new WeakMap;function a(u){const f=u.target;f.index!==null&&t.remove(f.index);for(const g in f.attributes)t.remove(f.attributes[g]);f.removeEventListener("dispose",a),delete i[f.id];const d=s.get(f);d&&(t.remove(d),s.delete(f)),n.releaseStatesOfGeometry(f),f.isInstancedBufferGeometry===!0&&delete f._maxInstanceCount,e.memory.geometries--}function o(u,f){return i[f.id]===!0||(f.addEventListener("dispose",a),i[f.id]=!0,e.memory.geometries++),f}function l(u){const f=u.attributes;for(const d in f)t.update(f[d],r.ARRAY_BUFFER)}function c(u){const f=[],d=u.index,g=u.attributes.position;let _=0;if(d!==null){const b=d.array;_=d.version;for(let E=0,y=b.length;E<y;E+=3){const w=b[E+0],A=b[E+1],C=b[E+2];f.push(w,A,A,C,C,w)}}else if(g!==void 0){const b=g.array;_=g.version;for(let E=0,y=b.length/3-1;E<y;E+=3){const w=E+0,A=E+1,C=E+2;f.push(w,A,A,C,C,w)}}else return;const m=new(wc(f)?Pc:Cc)(f,1);m.version=_;const p=s.get(u);p&&t.remove(p),s.set(u,m)}function h(u){const f=s.get(u);if(f){const d=u.index;d!==null&&f.version<d.version&&c(u)}else c(u);return s.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function yp(r,t,e){let n;function i(f){n=f}let s,a;function o(f){s=f.type,a=f.bytesPerElement}function l(f,d){r.drawElements(n,d,s,f*a),e.update(d,n,1)}function c(f,d,g){g!==0&&(r.drawElementsInstanced(n,d,s,f*a,g),e.update(d,n,g))}function h(f,d,g){if(g===0)return;t.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,d,0,s,f,0,g);let m=0;for(let p=0;p<g;p++)m+=d[p];e.update(m,n,1)}function u(f,d,g,_){if(g===0)return;const m=t.get("WEBGL_multi_draw");if(m===null)for(let p=0;p<f.length;p++)c(f[p]/a,d[p],_[p]);else{m.multiDrawElementsInstancedWEBGL(n,d,0,s,f,0,_,0,g);let p=0;for(let b=0;b<g;b++)p+=d[b]*_[b];e.update(p,n,1)}}this.setMode=i,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h,this.renderMultiDrawInstances=u}function Sp(r){const t={geometries:0,textures:0},e={frame:0,calls:0,triangles:0,points:0,lines:0};function n(s,a,o){switch(e.calls++,a){case r.TRIANGLES:e.triangles+=o*(s/3);break;case r.LINES:e.lines+=o*(s/2);break;case r.LINE_STRIP:e.lines+=o*(s-1);break;case r.LINE_LOOP:e.lines+=o*s;break;case r.POINTS:e.points+=o*s;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",a);break}}function i(){e.calls=0,e.triangles=0,e.points=0,e.lines=0}return{memory:t,render:e,programs:null,autoReset:!0,reset:i,update:n}}function bp(r,t,e){const n=new WeakMap,i=new te;function s(a,o,l){const c=a.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0;let f=n.get(o);if(f===void 0||f.count!==u){let x=function(){L.dispose(),n.delete(o),o.removeEventListener("dispose",x)};var d=x;f!==void 0&&f.texture.dispose();const g=o.morphAttributes.position!==void 0,_=o.morphAttributes.normal!==void 0,m=o.morphAttributes.color!==void 0,p=o.morphAttributes.position||[],b=o.morphAttributes.normal||[],E=o.morphAttributes.color||[];let y=0;g===!0&&(y=1),_===!0&&(y=2),m===!0&&(y=3);let w=o.attributes.position.count*y,A=1;w>t.maxTextureSize&&(A=Math.ceil(w/t.maxTextureSize),w=t.maxTextureSize);const C=new Float32Array(w*A*4*u),L=new Ac(C,w,A,u);L.type=gn,L.needsUpdate=!0;const M=y*4;for(let P=0;P<u;P++){const F=p[P],B=b[P],k=E[P],V=w*A*4*P;for(let X=0;X<F.count;X++){const Z=X*M;g===!0&&(i.fromBufferAttribute(F,X),C[V+Z+0]=i.x,C[V+Z+1]=i.y,C[V+Z+2]=i.z,C[V+Z+3]=0),_===!0&&(i.fromBufferAttribute(B,X),C[V+Z+4]=i.x,C[V+Z+5]=i.y,C[V+Z+6]=i.z,C[V+Z+7]=0),m===!0&&(i.fromBufferAttribute(k,X),C[V+Z+8]=i.x,C[V+Z+9]=i.y,C[V+Z+10]=i.z,C[V+Z+11]=k.itemSize===4?i.w:1)}}f={count:u,texture:L,size:new Tt(w,A)},n.set(o,f),o.addEventListener("dispose",x)}if(a.isInstancedMesh===!0&&a.morphTexture!==null)l.getUniforms().setValue(r,"morphTexture",a.morphTexture,e);else{let g=0;for(let m=0;m<c.length;m++)g+=c[m];const _=o.morphTargetsRelative?1:1-g;l.getUniforms().setValue(r,"morphTargetBaseInfluence",_),l.getUniforms().setValue(r,"morphTargetInfluences",c)}l.getUniforms().setValue(r,"morphTargetsTexture",f.texture,e),l.getUniforms().setValue(r,"morphTargetsTextureSize",f.size)}return{update:s}}function Ep(r,t,e,n){let i=new WeakMap;function s(l){const c=n.render.frame,h=l.geometry,u=t.get(l,h);if(i.get(u)!==c&&(t.update(u),i.set(u,c)),l.isInstancedMesh&&(l.hasEventListener("dispose",o)===!1&&l.addEventListener("dispose",o),i.get(l)!==c&&(e.update(l.instanceMatrix,r.ARRAY_BUFFER),l.instanceColor!==null&&e.update(l.instanceColor,r.ARRAY_BUFFER),i.set(l,c))),l.isSkinnedMesh){const f=l.skeleton;i.get(f)!==c&&(f.update(),i.set(f,c))}return u}function a(){i=new WeakMap}function o(l){const c=l.target;c.removeEventListener("dispose",o),e.remove(c.instanceMatrix),c.instanceColor!==null&&e.remove(c.instanceColor)}return{update:s,dispose:a}}const Bc=new Ie,Al=new Ic(1,1),kc=new Ac,Vc=new Gh,Hc=new Uc,Rl=[],Cl=[],Pl=new Float32Array(16),Dl=new Float32Array(9),Ll=new Float32Array(4);function Yi(r,t,e){const n=r[0];if(n<=0||n>0)return r;const i=t*e;let s=Rl[i];if(s===void 0&&(s=new Float32Array(i),Rl[i]=s),t!==0){n.toArray(s,0);for(let a=1,o=0;a!==t;++a)o+=e,r[a].toArray(s,o)}return s}function ye(r,t){if(r.length!==t.length)return!1;for(let e=0,n=r.length;e<n;e++)if(r[e]!==t[e])return!1;return!0}function Se(r,t){for(let e=0,n=t.length;e<n;e++)r[e]=t[e]}function Mr(r,t){let e=Cl[t];e===void 0&&(e=new Int32Array(t),Cl[t]=e);for(let n=0;n!==t;++n)e[n]=r.allocateTextureUnit();return e}function Tp(r,t){const e=this.cache;e[0]!==t&&(r.uniform1f(this.addr,t),e[0]=t)}function wp(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(r.uniform2f(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ye(e,t))return;r.uniform2fv(this.addr,t),Se(e,t)}}function Ap(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(r.uniform3f(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else if(t.r!==void 0)(e[0]!==t.r||e[1]!==t.g||e[2]!==t.b)&&(r.uniform3f(this.addr,t.r,t.g,t.b),e[0]=t.r,e[1]=t.g,e[2]=t.b);else{if(ye(e,t))return;r.uniform3fv(this.addr,t),Se(e,t)}}function Rp(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(r.uniform4f(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ye(e,t))return;r.uniform4fv(this.addr,t),Se(e,t)}}function Cp(r,t){const e=this.cache,n=t.elements;if(n===void 0){if(ye(e,t))return;r.uniformMatrix2fv(this.addr,!1,t),Se(e,t)}else{if(ye(e,n))return;Ll.set(n),r.uniformMatrix2fv(this.addr,!1,Ll),Se(e,n)}}function Pp(r,t){const e=this.cache,n=t.elements;if(n===void 0){if(ye(e,t))return;r.uniformMatrix3fv(this.addr,!1,t),Se(e,t)}else{if(ye(e,n))return;Dl.set(n),r.uniformMatrix3fv(this.addr,!1,Dl),Se(e,n)}}function Dp(r,t){const e=this.cache,n=t.elements;if(n===void 0){if(ye(e,t))return;r.uniformMatrix4fv(this.addr,!1,t),Se(e,t)}else{if(ye(e,n))return;Pl.set(n),r.uniformMatrix4fv(this.addr,!1,Pl),Se(e,n)}}function Lp(r,t){const e=this.cache;e[0]!==t&&(r.uniform1i(this.addr,t),e[0]=t)}function Up(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(r.uniform2i(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ye(e,t))return;r.uniform2iv(this.addr,t),Se(e,t)}}function Ip(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(r.uniform3i(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(ye(e,t))return;r.uniform3iv(this.addr,t),Se(e,t)}}function Fp(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(r.uniform4i(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ye(e,t))return;r.uniform4iv(this.addr,t),Se(e,t)}}function Np(r,t){const e=this.cache;e[0]!==t&&(r.uniform1ui(this.addr,t),e[0]=t)}function Op(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y)&&(r.uniform2ui(this.addr,t.x,t.y),e[0]=t.x,e[1]=t.y);else{if(ye(e,t))return;r.uniform2uiv(this.addr,t),Se(e,t)}}function zp(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z)&&(r.uniform3ui(this.addr,t.x,t.y,t.z),e[0]=t.x,e[1]=t.y,e[2]=t.z);else{if(ye(e,t))return;r.uniform3uiv(this.addr,t),Se(e,t)}}function Bp(r,t){const e=this.cache;if(t.x!==void 0)(e[0]!==t.x||e[1]!==t.y||e[2]!==t.z||e[3]!==t.w)&&(r.uniform4ui(this.addr,t.x,t.y,t.z,t.w),e[0]=t.x,e[1]=t.y,e[2]=t.z,e[3]=t.w);else{if(ye(e,t))return;r.uniform4uiv(this.addr,t),Se(e,t)}}function kp(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i);let s;this.type===r.SAMPLER_2D_SHADOW?(Al.compareFunction=Tc,s=Al):s=Bc,e.setTexture2D(t||s,i)}function Vp(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),e.setTexture3D(t||Vc,i)}function Hp(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),e.setTextureCube(t||Hc,i)}function Gp(r,t,e){const n=this.cache,i=e.allocateTextureUnit();n[0]!==i&&(r.uniform1i(this.addr,i),n[0]=i),e.setTexture2DArray(t||kc,i)}function Wp(r){switch(r){case 5126:return Tp;case 35664:return wp;case 35665:return Ap;case 35666:return Rp;case 35674:return Cp;case 35675:return Pp;case 35676:return Dp;case 5124:case 35670:return Lp;case 35667:case 35671:return Up;case 35668:case 35672:return Ip;case 35669:case 35673:return Fp;case 5125:return Np;case 36294:return Op;case 36295:return zp;case 36296:return Bp;case 35678:case 36198:case 36298:case 36306:case 35682:return kp;case 35679:case 36299:case 36307:return Vp;case 35680:case 36300:case 36308:case 36293:return Hp;case 36289:case 36303:case 36311:case 36292:return Gp}}function qp(r,t){r.uniform1fv(this.addr,t)}function Xp(r,t){const e=Yi(t,this.size,2);r.uniform2fv(this.addr,e)}function Yp(r,t){const e=Yi(t,this.size,3);r.uniform3fv(this.addr,e)}function Kp(r,t){const e=Yi(t,this.size,4);r.uniform4fv(this.addr,e)}function jp(r,t){const e=Yi(t,this.size,4);r.uniformMatrix2fv(this.addr,!1,e)}function Zp(r,t){const e=Yi(t,this.size,9);r.uniformMatrix3fv(this.addr,!1,e)}function $p(r,t){const e=Yi(t,this.size,16);r.uniformMatrix4fv(this.addr,!1,e)}function Jp(r,t){r.uniform1iv(this.addr,t)}function Qp(r,t){r.uniform2iv(this.addr,t)}function tm(r,t){r.uniform3iv(this.addr,t)}function em(r,t){r.uniform4iv(this.addr,t)}function nm(r,t){r.uniform1uiv(this.addr,t)}function im(r,t){r.uniform2uiv(this.addr,t)}function sm(r,t){r.uniform3uiv(this.addr,t)}function rm(r,t){r.uniform4uiv(this.addr,t)}function am(r,t,e){const n=this.cache,i=t.length,s=Mr(e,i);ye(n,s)||(r.uniform1iv(this.addr,s),Se(n,s));for(let a=0;a!==i;++a)e.setTexture2D(t[a]||Bc,s[a])}function om(r,t,e){const n=this.cache,i=t.length,s=Mr(e,i);ye(n,s)||(r.uniform1iv(this.addr,s),Se(n,s));for(let a=0;a!==i;++a)e.setTexture3D(t[a]||Vc,s[a])}function lm(r,t,e){const n=this.cache,i=t.length,s=Mr(e,i);ye(n,s)||(r.uniform1iv(this.addr,s),Se(n,s));for(let a=0;a!==i;++a)e.setTextureCube(t[a]||Hc,s[a])}function cm(r,t,e){const n=this.cache,i=t.length,s=Mr(e,i);ye(n,s)||(r.uniform1iv(this.addr,s),Se(n,s));for(let a=0;a!==i;++a)e.setTexture2DArray(t[a]||kc,s[a])}function hm(r){switch(r){case 5126:return qp;case 35664:return Xp;case 35665:return Yp;case 35666:return Kp;case 35674:return jp;case 35675:return Zp;case 35676:return $p;case 5124:case 35670:return Jp;case 35667:case 35671:return Qp;case 35668:case 35672:return tm;case 35669:case 35673:return em;case 5125:return nm;case 36294:return im;case 36295:return sm;case 36296:return rm;case 35678:case 36198:case 36298:case 36306:case 35682:return am;case 35679:case 36299:case 36307:return om;case 35680:case 36300:case 36308:case 36293:return lm;case 36289:case 36303:case 36311:case 36292:return cm}}class um{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.setValue=Wp(e.type)}}class fm{constructor(t,e,n){this.id=t,this.addr=n,this.cache=[],this.type=e.type,this.size=e.size,this.setValue=hm(e.type)}}class dm{constructor(t){this.id=t,this.seq=[],this.map={}}setValue(t,e,n){const i=this.seq;for(let s=0,a=i.length;s!==a;++s){const o=i[s];o.setValue(t,e[o.id],n)}}}const ia=/(\w+)(\])?(\[|\.)?/g;function Ul(r,t){r.seq.push(t),r.map[t.id]=t}function pm(r,t,e){const n=r.name,i=n.length;for(ia.lastIndex=0;;){const s=ia.exec(n),a=ia.lastIndex;let o=s[1];const l=s[2]==="]",c=s[3];if(l&&(o=o|0),c===void 0||c==="["&&a+2===i){Ul(e,c===void 0?new um(o,r,t):new fm(o,r,t));break}else{let u=e.map[o];u===void 0&&(u=new dm(o),Ul(e,u)),e=u}}}class er{constructor(t,e){this.seq=[],this.map={};const n=t.getProgramParameter(e,t.ACTIVE_UNIFORMS);for(let i=0;i<n;++i){const s=t.getActiveUniform(e,i),a=t.getUniformLocation(e,s.name);pm(s,a,this)}}setValue(t,e,n,i){const s=this.map[e];s!==void 0&&s.setValue(t,n,i)}setOptional(t,e,n){const i=e[n];i!==void 0&&this.setValue(t,n,i)}static upload(t,e,n,i){for(let s=0,a=e.length;s!==a;++s){const o=e[s],l=n[o.id];l.needsUpdate!==!1&&o.setValue(t,l.value,i)}}static seqWithValue(t,e){const n=[];for(let i=0,s=t.length;i!==s;++i){const a=t[i];a.id in e&&n.push(a)}return n}}function Il(r,t,e){const n=r.createShader(t);return r.shaderSource(n,e),r.compileShader(n),n}const mm=37297;let gm=0;function _m(r,t){const e=r.split(`
`),n=[],i=Math.max(t-6,0),s=Math.min(t+6,e.length);for(let a=i;a<s;a++){const o=a+1;n.push(`${o===t?">":" "} ${o}: ${e[a]}`)}return n.join(`
`)}const Fl=new Nt;function vm(r){Xt._getMatrix(Fl,Xt.workingColorSpace,r);const t=`mat3( ${Fl.elements.map(e=>e.toFixed(4))} )`;switch(Xt.getTransfer(r)){case ar:return[t,"LinearTransferOETF"];case $t:return[t,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",r),[t,"LinearTransferOETF"]}}function Nl(r,t,e){const n=r.getShaderParameter(t,r.COMPILE_STATUS),s=(r.getShaderInfoLog(t)||"").trim();if(n&&s==="")return"";const a=/ERROR: 0:(\d+)/.exec(s);if(a){const o=parseInt(a[1]);return e.toUpperCase()+`

`+s+`

`+_m(r.getShaderSource(t),o)}else return s}function xm(r,t){const e=vm(t);return[`vec4 ${r}( vec4 value ) {`,`	return ${e[1]}( vec4( value.rgb * ${e[0]}, value.a ) );`,"}"].join(`
`)}function Mm(r,t){let e;switch(t){case hc:e="Linear";break;case uc:e="Reinhard";break;case fc:e="Cineon";break;case dc:e="ACESFilmic";break;case mc:e="AgX";break;case lo:e="Neutral";break;case pc:e="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",t),e="Linear"}return"vec3 "+r+"( vec3 color ) { return "+e+"ToneMapping( color ); }"}const Xs=new U;function ym(){Xt.getLuminanceCoefficients(Xs);const r=Xs.x.toFixed(4),t=Xs.y.toFixed(4),e=Xs.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${r}, ${t}, ${e} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Sm(r){return[r.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",r.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(ls).join(`
`)}function bm(r){const t=[];for(const e in r){const n=r[e];n!==!1&&t.push("#define "+e+" "+n)}return t.join(`
`)}function Em(r,t){const e={},n=r.getProgramParameter(t,r.ACTIVE_ATTRIBUTES);for(let i=0;i<n;i++){const s=r.getActiveAttrib(t,i),a=s.name;let o=1;s.type===r.FLOAT_MAT2&&(o=2),s.type===r.FLOAT_MAT3&&(o=3),s.type===r.FLOAT_MAT4&&(o=4),e[a]={type:s.type,location:r.getAttribLocation(t,a),locationSize:o}}return e}function ls(r){return r!==""}function Ol(r,t){const e=t.numSpotLightShadows+t.numSpotLightMaps-t.numSpotLightShadowsWithMaps;return r.replace(/NUM_DIR_LIGHTS/g,t.numDirLights).replace(/NUM_SPOT_LIGHTS/g,t.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,t.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,e).replace(/NUM_RECT_AREA_LIGHTS/g,t.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,t.numPointLights).replace(/NUM_HEMI_LIGHTS/g,t.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,t.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,t.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,t.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,t.numPointLightShadows)}function zl(r,t){return r.replace(/NUM_CLIPPING_PLANES/g,t.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,t.numClippingPlanes-t.numClipIntersection)}const Tm=/^[ \t]*#include +<([\w\d./]+)>/gm;function io(r){return r.replace(Tm,Am)}const wm=new Map;function Am(r,t){let e=Bt[t];if(e===void 0){const n=wm.get(t);if(n!==void 0)e=Bt[n],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',t,n);else throw new Error("Can not resolve #include <"+t+">")}return io(e)}const Rm=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Bl(r){return r.replace(Rm,Cm)}function Cm(r,t,e,n){let i="";for(let s=parseInt(t);s<parseInt(e);s++)i+=n.replace(/\[\s*i\s*\]/g,"[ "+s+" ]").replace(/UNROLLED_LOOP_INDEX/g,s);return i}function kl(r){let t=`precision ${r.precision} float;
	precision ${r.precision} int;
	precision ${r.precision} sampler2D;
	precision ${r.precision} samplerCube;
	precision ${r.precision} sampler3D;
	precision ${r.precision} sampler2DArray;
	precision ${r.precision} sampler2DShadow;
	precision ${r.precision} samplerCubeShadow;
	precision ${r.precision} sampler2DArrayShadow;
	precision ${r.precision} isampler2D;
	precision ${r.precision} isampler3D;
	precision ${r.precision} isamplerCube;
	precision ${r.precision} isampler2DArray;
	precision ${r.precision} usampler2D;
	precision ${r.precision} usampler3D;
	precision ${r.precision} usamplerCube;
	precision ${r.precision} usampler2DArray;
	`;return r.precision==="highp"?t+=`
#define HIGH_PRECISION`:r.precision==="mediump"?t+=`
#define MEDIUM_PRECISION`:r.precision==="lowp"&&(t+=`
#define LOW_PRECISION`),t}function Pm(r){let t="SHADOWMAP_TYPE_BASIC";return r.shadowMapType===lc?t="SHADOWMAP_TYPE_PCF":r.shadowMapType===cc?t="SHADOWMAP_TYPE_PCF_SOFT":r.shadowMapType===wn&&(t="SHADOWMAP_TYPE_VSM"),t}function Dm(r){let t="ENVMAP_TYPE_CUBE";if(r.envMap)switch(r.envMapMode){case Oi:case zi:t="ENVMAP_TYPE_CUBE";break;case _r:t="ENVMAP_TYPE_CUBE_UV";break}return t}function Lm(r){let t="ENVMAP_MODE_REFLECTION";if(r.envMap)switch(r.envMapMode){case zi:t="ENVMAP_MODE_REFRACTION";break}return t}function Um(r){let t="ENVMAP_BLENDING_NONE";if(r.envMap)switch(r.combine){case oo:t="ENVMAP_BLENDING_MULTIPLY";break;case Sh:t="ENVMAP_BLENDING_MIX";break;case bh:t="ENVMAP_BLENDING_ADD";break}return t}function Im(r){const t=r.envMapCubeUVHeight;if(t===null)return null;const e=Math.log2(t)-2,n=1/t;return{texelWidth:1/(3*Math.max(Math.pow(2,e),112)),texelHeight:n,maxMip:e}}function Fm(r,t,e,n){const i=r.getContext(),s=e.defines;let a=e.vertexShader,o=e.fragmentShader;const l=Pm(e),c=Dm(e),h=Lm(e),u=Um(e),f=Im(e),d=Sm(e),g=bm(s),_=i.createProgram();let m,p,b=e.glslVersion?"#version "+e.glslVersion+`
`:"";e.isRawShaderMaterial?(m=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(ls).join(`
`),m.length>0&&(m+=`
`),p=["#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g].filter(ls).join(`
`),p.length>0&&(p+=`
`)):(m=[kl(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",e.batching?"#define USE_BATCHING":"",e.batchingColor?"#define USE_BATCHING_COLOR":"",e.instancing?"#define USE_INSTANCING":"",e.instancingColor?"#define USE_INSTANCING_COLOR":"",e.instancingMorph?"#define USE_INSTANCING_MORPH":"",e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.map?"#define USE_MAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+h:"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.displacementMap?"#define USE_DISPLACEMENTMAP":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.mapUv?"#define MAP_UV "+e.mapUv:"",e.alphaMapUv?"#define ALPHAMAP_UV "+e.alphaMapUv:"",e.lightMapUv?"#define LIGHTMAP_UV "+e.lightMapUv:"",e.aoMapUv?"#define AOMAP_UV "+e.aoMapUv:"",e.emissiveMapUv?"#define EMISSIVEMAP_UV "+e.emissiveMapUv:"",e.bumpMapUv?"#define BUMPMAP_UV "+e.bumpMapUv:"",e.normalMapUv?"#define NORMALMAP_UV "+e.normalMapUv:"",e.displacementMapUv?"#define DISPLACEMENTMAP_UV "+e.displacementMapUv:"",e.metalnessMapUv?"#define METALNESSMAP_UV "+e.metalnessMapUv:"",e.roughnessMapUv?"#define ROUGHNESSMAP_UV "+e.roughnessMapUv:"",e.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+e.anisotropyMapUv:"",e.clearcoatMapUv?"#define CLEARCOATMAP_UV "+e.clearcoatMapUv:"",e.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+e.clearcoatNormalMapUv:"",e.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+e.clearcoatRoughnessMapUv:"",e.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+e.iridescenceMapUv:"",e.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+e.iridescenceThicknessMapUv:"",e.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+e.sheenColorMapUv:"",e.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+e.sheenRoughnessMapUv:"",e.specularMapUv?"#define SPECULARMAP_UV "+e.specularMapUv:"",e.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+e.specularColorMapUv:"",e.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+e.specularIntensityMapUv:"",e.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+e.transmissionMapUv:"",e.thicknessMapUv?"#define THICKNESSMAP_UV "+e.thicknessMapUv:"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.flatShading?"#define FLAT_SHADED":"",e.skinning?"#define USE_SKINNING":"",e.morphTargets?"#define USE_MORPHTARGETS":"",e.morphNormals&&e.flatShading===!1?"#define USE_MORPHNORMALS":"",e.morphColors?"#define USE_MORPHCOLORS":"",e.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+e.morphTextureStride:"",e.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+e.morphTargetsCount:"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.sizeAttenuation?"#define USE_SIZEATTENUATION":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(ls).join(`
`),p=[kl(e),"#define SHADER_TYPE "+e.shaderType,"#define SHADER_NAME "+e.shaderName,g,e.useFog&&e.fog?"#define USE_FOG":"",e.useFog&&e.fogExp2?"#define FOG_EXP2":"",e.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",e.map?"#define USE_MAP":"",e.matcap?"#define USE_MATCAP":"",e.envMap?"#define USE_ENVMAP":"",e.envMap?"#define "+c:"",e.envMap?"#define "+h:"",e.envMap?"#define "+u:"",f?"#define CUBEUV_TEXEL_WIDTH "+f.texelWidth:"",f?"#define CUBEUV_TEXEL_HEIGHT "+f.texelHeight:"",f?"#define CUBEUV_MAX_MIP "+f.maxMip+".0":"",e.lightMap?"#define USE_LIGHTMAP":"",e.aoMap?"#define USE_AOMAP":"",e.bumpMap?"#define USE_BUMPMAP":"",e.normalMap?"#define USE_NORMALMAP":"",e.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",e.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",e.emissiveMap?"#define USE_EMISSIVEMAP":"",e.anisotropy?"#define USE_ANISOTROPY":"",e.anisotropyMap?"#define USE_ANISOTROPYMAP":"",e.clearcoat?"#define USE_CLEARCOAT":"",e.clearcoatMap?"#define USE_CLEARCOATMAP":"",e.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",e.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",e.dispersion?"#define USE_DISPERSION":"",e.iridescence?"#define USE_IRIDESCENCE":"",e.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",e.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",e.specularMap?"#define USE_SPECULARMAP":"",e.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",e.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",e.roughnessMap?"#define USE_ROUGHNESSMAP":"",e.metalnessMap?"#define USE_METALNESSMAP":"",e.alphaMap?"#define USE_ALPHAMAP":"",e.alphaTest?"#define USE_ALPHATEST":"",e.alphaHash?"#define USE_ALPHAHASH":"",e.sheen?"#define USE_SHEEN":"",e.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",e.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",e.transmission?"#define USE_TRANSMISSION":"",e.transmissionMap?"#define USE_TRANSMISSIONMAP":"",e.thicknessMap?"#define USE_THICKNESSMAP":"",e.vertexTangents&&e.flatShading===!1?"#define USE_TANGENT":"",e.vertexColors||e.instancingColor||e.batchingColor?"#define USE_COLOR":"",e.vertexAlphas?"#define USE_COLOR_ALPHA":"",e.vertexUv1s?"#define USE_UV1":"",e.vertexUv2s?"#define USE_UV2":"",e.vertexUv3s?"#define USE_UV3":"",e.pointsUvs?"#define USE_POINTS_UV":"",e.gradientMap?"#define USE_GRADIENTMAP":"",e.flatShading?"#define FLAT_SHADED":"",e.doubleSided?"#define DOUBLE_SIDED":"",e.flipSided?"#define FLIP_SIDED":"",e.shadowMapEnabled?"#define USE_SHADOWMAP":"",e.shadowMapEnabled?"#define "+l:"",e.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",e.numLightProbes>0?"#define USE_LIGHT_PROBES":"",e.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",e.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",e.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",e.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",e.toneMapping!==kn?"#define TONE_MAPPING":"",e.toneMapping!==kn?Bt.tonemapping_pars_fragment:"",e.toneMapping!==kn?Mm("toneMapping",e.toneMapping):"",e.dithering?"#define DITHERING":"",e.opaque?"#define OPAQUE":"",Bt.colorspace_pars_fragment,xm("linearToOutputTexel",e.outputColorSpace),ym(),e.useDepthPacking?"#define DEPTH_PACKING "+e.depthPacking:"",`
`].filter(ls).join(`
`)),a=io(a),a=Ol(a,e),a=zl(a,e),o=io(o),o=Ol(o,e),o=zl(o,e),a=Bl(a),o=Bl(o),e.isRawShaderMaterial!==!0&&(b=`#version 300 es
`,m=[d,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,p=["#define varying in",e.glslVersion===ko?"":"layout(location = 0) out highp vec4 pc_fragColor;",e.glslVersion===ko?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+p);const E=b+m+a,y=b+p+o,w=Il(i,i.VERTEX_SHADER,E),A=Il(i,i.FRAGMENT_SHADER,y);i.attachShader(_,w),i.attachShader(_,A),e.index0AttributeName!==void 0?i.bindAttribLocation(_,0,e.index0AttributeName):e.morphTargets===!0&&i.bindAttribLocation(_,0,"position"),i.linkProgram(_);function C(P){if(r.debug.checkShaderErrors){const F=i.getProgramInfoLog(_)||"",B=i.getShaderInfoLog(w)||"",k=i.getShaderInfoLog(A)||"",V=F.trim(),X=B.trim(),Z=k.trim();let W=!0,rt=!0;if(i.getProgramParameter(_,i.LINK_STATUS)===!1)if(W=!1,typeof r.debug.onShaderError=="function")r.debug.onShaderError(i,_,w,A);else{const ct=Nl(i,w,"vertex"),St=Nl(i,A,"fragment");console.error("THREE.WebGLProgram: Shader Error "+i.getError()+" - VALIDATE_STATUS "+i.getProgramParameter(_,i.VALIDATE_STATUS)+`

Material Name: `+P.name+`
Material Type: `+P.type+`

Program Info Log: `+V+`
`+ct+`
`+St)}else V!==""?console.warn("THREE.WebGLProgram: Program Info Log:",V):(X===""||Z==="")&&(rt=!1);rt&&(P.diagnostics={runnable:W,programLog:V,vertexShader:{log:X,prefix:m},fragmentShader:{log:Z,prefix:p}})}i.deleteShader(w),i.deleteShader(A),L=new er(i,_),M=Em(i,_)}let L;this.getUniforms=function(){return L===void 0&&C(this),L};let M;this.getAttributes=function(){return M===void 0&&C(this),M};let x=e.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return x===!1&&(x=i.getProgramParameter(_,mm)),x},this.destroy=function(){n.releaseStatesOfProgram(this),i.deleteProgram(_),this.program=void 0},this.type=e.shaderType,this.name=e.shaderName,this.id=gm++,this.cacheKey=t,this.usedTimes=1,this.program=_,this.vertexShader=w,this.fragmentShader=A,this}let Nm=0;class Om{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(t){const e=t.vertexShader,n=t.fragmentShader,i=this._getShaderStage(e),s=this._getShaderStage(n),a=this._getShaderCacheForMaterial(t);return a.has(i)===!1&&(a.add(i),i.usedTimes++),a.has(s)===!1&&(a.add(s),s.usedTimes++),this}remove(t){const e=this.materialCache.get(t);for(const n of e)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(t),this}getVertexShaderID(t){return this._getShaderStage(t.vertexShader).id}getFragmentShaderID(t){return this._getShaderStage(t.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(t){const e=this.materialCache;let n=e.get(t);return n===void 0&&(n=new Set,e.set(t,n)),n}_getShaderStage(t){const e=this.shaderCache;let n=e.get(t);return n===void 0&&(n=new zm(t),e.set(t,n)),n}}class zm{constructor(t){this.id=Nm++,this.code=t,this.usedTimes=0}}function Bm(r,t,e,n,i,s,a){const o=new vo,l=new Om,c=new Set,h=[],u=i.logarithmicDepthBuffer,f=i.vertexTextures;let d=i.precision;const g={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function _(M){return c.add(M),M===0?"uv":`uv${M}`}function m(M,x,P,F,B){const k=F.fog,V=B.geometry,X=M.isMeshStandardMaterial?F.environment:null,Z=(M.isMeshStandardMaterial?e:t).get(M.envMap||X),W=Z&&Z.mapping===_r?Z.image.height:null,rt=g[M.type];M.precision!==null&&(d=i.getMaxPrecision(M.precision),d!==M.precision&&console.warn("THREE.WebGLProgram.getParameters:",M.precision,"not supported, using",d,"instead."));const ct=V.morphAttributes.position||V.morphAttributes.normal||V.morphAttributes.color,St=ct!==void 0?ct.length:0;let Vt=0;V.morphAttributes.position!==void 0&&(Vt=1),V.morphAttributes.normal!==void 0&&(Vt=2),V.morphAttributes.color!==void 0&&(Vt=3);let ie,ae,jt,K;if(rt){const Zt=dn[rt];ie=Zt.vertexShader,ae=Zt.fragmentShader}else ie=M.vertexShader,ae=M.fragmentShader,l.update(M),jt=l.getVertexShaderID(M),K=l.getFragmentShaderID(M);const J=r.getRenderTarget(),dt=r.state.buffers.depth.getReversed(),Lt=B.isInstancedMesh===!0,Et=B.isBatchedMesh===!0,qt=!!M.map,Re=!!M.matcap,D=!!Z,oe=!!M.aoMap,It=!!M.lightMap,Pt=!!M.bumpMap,gt=!!M.normalMap,le=!!M.displacementMap,_t=!!M.emissiveMap,zt=!!M.metalnessMap,be=!!M.roughnessMap,pe=M.anisotropy>0,R=M.clearcoat>0,S=M.dispersion>0,z=M.iridescence>0,Y=M.sheen>0,$=M.transmission>0,q=pe&&!!M.anisotropyMap,bt=R&&!!M.clearcoatMap,it=R&&!!M.clearcoatNormalMap,xt=R&&!!M.clearcoatRoughnessMap,Mt=z&&!!M.iridescenceMap,et=z&&!!M.iridescenceThicknessMap,ht=Y&&!!M.sheenColorMap,Ct=Y&&!!M.sheenRoughnessMap,yt=!!M.specularMap,ot=!!M.specularColorMap,Ft=!!M.specularIntensityMap,I=$&&!!M.transmissionMap,nt=$&&!!M.thicknessMap,st=!!M.gradientMap,ft=!!M.alphaMap,Q=M.alphaTest>0,j=!!M.alphaHash,mt=!!M.extensions;let Ut=kn;M.toneMapped&&(J===null||J.isXRRenderTarget===!0)&&(Ut=r.toneMapping);const se={shaderID:rt,shaderType:M.type,shaderName:M.name,vertexShader:ie,fragmentShader:ae,defines:M.defines,customVertexShaderID:jt,customFragmentShaderID:K,isRawShaderMaterial:M.isRawShaderMaterial===!0,glslVersion:M.glslVersion,precision:d,batching:Et,batchingColor:Et&&B._colorsTexture!==null,instancing:Lt,instancingColor:Lt&&B.instanceColor!==null,instancingMorph:Lt&&B.morphTexture!==null,supportsVertexTextures:f,outputColorSpace:J===null?r.outputColorSpace:J.isXRRenderTarget===!0?J.texture.colorSpace:Bi,alphaToCoverage:!!M.alphaToCoverage,map:qt,matcap:Re,envMap:D,envMapMode:D&&Z.mapping,envMapCubeUVHeight:W,aoMap:oe,lightMap:It,bumpMap:Pt,normalMap:gt,displacementMap:f&&le,emissiveMap:_t,normalMapObjectSpace:gt&&M.normalMapType===Ah,normalMapTangentSpace:gt&&M.normalMapType===Ec,metalnessMap:zt,roughnessMap:be,anisotropy:pe,anisotropyMap:q,clearcoat:R,clearcoatMap:bt,clearcoatNormalMap:it,clearcoatRoughnessMap:xt,dispersion:S,iridescence:z,iridescenceMap:Mt,iridescenceThicknessMap:et,sheen:Y,sheenColorMap:ht,sheenRoughnessMap:Ct,specularMap:yt,specularColorMap:ot,specularIntensityMap:Ft,transmission:$,transmissionMap:I,thicknessMap:nt,gradientMap:st,opaque:M.transparent===!1&&M.blending===ai&&M.alphaToCoverage===!1,alphaMap:ft,alphaTest:Q,alphaHash:j,combine:M.combine,mapUv:qt&&_(M.map.channel),aoMapUv:oe&&_(M.aoMap.channel),lightMapUv:It&&_(M.lightMap.channel),bumpMapUv:Pt&&_(M.bumpMap.channel),normalMapUv:gt&&_(M.normalMap.channel),displacementMapUv:le&&_(M.displacementMap.channel),emissiveMapUv:_t&&_(M.emissiveMap.channel),metalnessMapUv:zt&&_(M.metalnessMap.channel),roughnessMapUv:be&&_(M.roughnessMap.channel),anisotropyMapUv:q&&_(M.anisotropyMap.channel),clearcoatMapUv:bt&&_(M.clearcoatMap.channel),clearcoatNormalMapUv:it&&_(M.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:xt&&_(M.clearcoatRoughnessMap.channel),iridescenceMapUv:Mt&&_(M.iridescenceMap.channel),iridescenceThicknessMapUv:et&&_(M.iridescenceThicknessMap.channel),sheenColorMapUv:ht&&_(M.sheenColorMap.channel),sheenRoughnessMapUv:Ct&&_(M.sheenRoughnessMap.channel),specularMapUv:yt&&_(M.specularMap.channel),specularColorMapUv:ot&&_(M.specularColorMap.channel),specularIntensityMapUv:Ft&&_(M.specularIntensityMap.channel),transmissionMapUv:I&&_(M.transmissionMap.channel),thicknessMapUv:nt&&_(M.thicknessMap.channel),alphaMapUv:ft&&_(M.alphaMap.channel),vertexTangents:!!V.attributes.tangent&&(gt||pe),vertexColors:M.vertexColors,vertexAlphas:M.vertexColors===!0&&!!V.attributes.color&&V.attributes.color.itemSize===4,pointsUvs:B.isPoints===!0&&!!V.attributes.uv&&(qt||ft),fog:!!k,useFog:M.fog===!0,fogExp2:!!k&&k.isFogExp2,flatShading:M.flatShading===!0&&M.wireframe===!1,sizeAttenuation:M.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:dt,skinning:B.isSkinnedMesh===!0,morphTargets:V.morphAttributes.position!==void 0,morphNormals:V.morphAttributes.normal!==void 0,morphColors:V.morphAttributes.color!==void 0,morphTargetsCount:St,morphTextureStride:Vt,numDirLights:x.directional.length,numPointLights:x.point.length,numSpotLights:x.spot.length,numSpotLightMaps:x.spotLightMap.length,numRectAreaLights:x.rectArea.length,numHemiLights:x.hemi.length,numDirLightShadows:x.directionalShadowMap.length,numPointLightShadows:x.pointShadowMap.length,numSpotLightShadows:x.spotShadowMap.length,numSpotLightShadowsWithMaps:x.numSpotLightShadowsWithMaps,numLightProbes:x.numLightProbes,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:M.dithering,shadowMapEnabled:r.shadowMap.enabled&&P.length>0,shadowMapType:r.shadowMap.type,toneMapping:Ut,decodeVideoTexture:qt&&M.map.isVideoTexture===!0&&Xt.getTransfer(M.map.colorSpace)===$t,decodeVideoTextureEmissive:_t&&M.emissiveMap.isVideoTexture===!0&&Xt.getTransfer(M.emissiveMap.colorSpace)===$t,premultipliedAlpha:M.premultipliedAlpha,doubleSided:M.side===Le,flipSided:M.side===Ue,useDepthPacking:M.depthPacking>=0,depthPacking:M.depthPacking||0,index0AttributeName:M.index0AttributeName,extensionClipCullDistance:mt&&M.extensions.clipCullDistance===!0&&n.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(mt&&M.extensions.multiDraw===!0||Et)&&n.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:n.has("KHR_parallel_shader_compile"),customProgramCacheKey:M.customProgramCacheKey()};return se.vertexUv1s=c.has(1),se.vertexUv2s=c.has(2),se.vertexUv3s=c.has(3),c.clear(),se}function p(M){const x=[];if(M.shaderID?x.push(M.shaderID):(x.push(M.customVertexShaderID),x.push(M.customFragmentShaderID)),M.defines!==void 0)for(const P in M.defines)x.push(P),x.push(M.defines[P]);return M.isRawShaderMaterial===!1&&(b(x,M),E(x,M),x.push(r.outputColorSpace)),x.push(M.customProgramCacheKey),x.join()}function b(M,x){M.push(x.precision),M.push(x.outputColorSpace),M.push(x.envMapMode),M.push(x.envMapCubeUVHeight),M.push(x.mapUv),M.push(x.alphaMapUv),M.push(x.lightMapUv),M.push(x.aoMapUv),M.push(x.bumpMapUv),M.push(x.normalMapUv),M.push(x.displacementMapUv),M.push(x.emissiveMapUv),M.push(x.metalnessMapUv),M.push(x.roughnessMapUv),M.push(x.anisotropyMapUv),M.push(x.clearcoatMapUv),M.push(x.clearcoatNormalMapUv),M.push(x.clearcoatRoughnessMapUv),M.push(x.iridescenceMapUv),M.push(x.iridescenceThicknessMapUv),M.push(x.sheenColorMapUv),M.push(x.sheenRoughnessMapUv),M.push(x.specularMapUv),M.push(x.specularColorMapUv),M.push(x.specularIntensityMapUv),M.push(x.transmissionMapUv),M.push(x.thicknessMapUv),M.push(x.combine),M.push(x.fogExp2),M.push(x.sizeAttenuation),M.push(x.morphTargetsCount),M.push(x.morphAttributeCount),M.push(x.numDirLights),M.push(x.numPointLights),M.push(x.numSpotLights),M.push(x.numSpotLightMaps),M.push(x.numHemiLights),M.push(x.numRectAreaLights),M.push(x.numDirLightShadows),M.push(x.numPointLightShadows),M.push(x.numSpotLightShadows),M.push(x.numSpotLightShadowsWithMaps),M.push(x.numLightProbes),M.push(x.shadowMapType),M.push(x.toneMapping),M.push(x.numClippingPlanes),M.push(x.numClipIntersection),M.push(x.depthPacking)}function E(M,x){o.disableAll(),x.supportsVertexTextures&&o.enable(0),x.instancing&&o.enable(1),x.instancingColor&&o.enable(2),x.instancingMorph&&o.enable(3),x.matcap&&o.enable(4),x.envMap&&o.enable(5),x.normalMapObjectSpace&&o.enable(6),x.normalMapTangentSpace&&o.enable(7),x.clearcoat&&o.enable(8),x.iridescence&&o.enable(9),x.alphaTest&&o.enable(10),x.vertexColors&&o.enable(11),x.vertexAlphas&&o.enable(12),x.vertexUv1s&&o.enable(13),x.vertexUv2s&&o.enable(14),x.vertexUv3s&&o.enable(15),x.vertexTangents&&o.enable(16),x.anisotropy&&o.enable(17),x.alphaHash&&o.enable(18),x.batching&&o.enable(19),x.dispersion&&o.enable(20),x.batchingColor&&o.enable(21),x.gradientMap&&o.enable(22),M.push(o.mask),o.disableAll(),x.fog&&o.enable(0),x.useFog&&o.enable(1),x.flatShading&&o.enable(2),x.logarithmicDepthBuffer&&o.enable(3),x.reversedDepthBuffer&&o.enable(4),x.skinning&&o.enable(5),x.morphTargets&&o.enable(6),x.morphNormals&&o.enable(7),x.morphColors&&o.enable(8),x.premultipliedAlpha&&o.enable(9),x.shadowMapEnabled&&o.enable(10),x.doubleSided&&o.enable(11),x.flipSided&&o.enable(12),x.useDepthPacking&&o.enable(13),x.dithering&&o.enable(14),x.transmission&&o.enable(15),x.sheen&&o.enable(16),x.opaque&&o.enable(17),x.pointsUvs&&o.enable(18),x.decodeVideoTexture&&o.enable(19),x.decodeVideoTextureEmissive&&o.enable(20),x.alphaToCoverage&&o.enable(21),M.push(o.mask)}function y(M){const x=g[M.type];let P;if(x){const F=dn[x];P=ps.clone(F.uniforms)}else P=M.uniforms;return P}function w(M,x){let P;for(let F=0,B=h.length;F<B;F++){const k=h[F];if(k.cacheKey===x){P=k,++P.usedTimes;break}}return P===void 0&&(P=new Fm(r,x,M,s),h.push(P)),P}function A(M){if(--M.usedTimes===0){const x=h.indexOf(M);h[x]=h[h.length-1],h.pop(),M.destroy()}}function C(M){l.remove(M)}function L(){l.dispose()}return{getParameters:m,getProgramCacheKey:p,getUniforms:y,acquireProgram:w,releaseProgram:A,releaseShaderCache:C,programs:h,dispose:L}}function km(){let r=new WeakMap;function t(a){return r.has(a)}function e(a){let o=r.get(a);return o===void 0&&(o={},r.set(a,o)),o}function n(a){r.delete(a)}function i(a,o,l){r.get(a)[o]=l}function s(){r=new WeakMap}return{has:t,get:e,remove:n,update:i,dispose:s}}function Vm(r,t){return r.groupOrder!==t.groupOrder?r.groupOrder-t.groupOrder:r.renderOrder!==t.renderOrder?r.renderOrder-t.renderOrder:r.material.id!==t.material.id?r.material.id-t.material.id:r.z!==t.z?r.z-t.z:r.id-t.id}function Vl(r,t){return r.groupOrder!==t.groupOrder?r.groupOrder-t.groupOrder:r.renderOrder!==t.renderOrder?r.renderOrder-t.renderOrder:r.z!==t.z?t.z-r.z:r.id-t.id}function Hl(){const r=[];let t=0;const e=[],n=[],i=[];function s(){t=0,e.length=0,n.length=0,i.length=0}function a(u,f,d,g,_,m){let p=r[t];return p===void 0?(p={id:u.id,object:u,geometry:f,material:d,groupOrder:g,renderOrder:u.renderOrder,z:_,group:m},r[t]=p):(p.id=u.id,p.object=u,p.geometry=f,p.material=d,p.groupOrder=g,p.renderOrder=u.renderOrder,p.z=_,p.group=m),t++,p}function o(u,f,d,g,_,m){const p=a(u,f,d,g,_,m);d.transmission>0?n.push(p):d.transparent===!0?i.push(p):e.push(p)}function l(u,f,d,g,_,m){const p=a(u,f,d,g,_,m);d.transmission>0?n.unshift(p):d.transparent===!0?i.unshift(p):e.unshift(p)}function c(u,f){e.length>1&&e.sort(u||Vm),n.length>1&&n.sort(f||Vl),i.length>1&&i.sort(f||Vl)}function h(){for(let u=t,f=r.length;u<f;u++){const d=r[u];if(d.id===null)break;d.id=null,d.object=null,d.geometry=null,d.material=null,d.group=null}}return{opaque:e,transmissive:n,transparent:i,init:s,push:o,unshift:l,finish:h,sort:c}}function Hm(){let r=new WeakMap;function t(n,i){const s=r.get(n);let a;return s===void 0?(a=new Hl,r.set(n,[a])):i>=s.length?(a=new Hl,s.push(a)):a=s[i],a}function e(){r=new WeakMap}return{get:t,dispose:e}}function Gm(){const r={};return{get:function(t){if(r[t.id]!==void 0)return r[t.id];let e;switch(t.type){case"DirectionalLight":e={direction:new U,color:new vt};break;case"SpotLight":e={position:new U,direction:new U,color:new vt,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":e={position:new U,color:new vt,distance:0,decay:0};break;case"HemisphereLight":e={direction:new U,skyColor:new vt,groundColor:new vt};break;case"RectAreaLight":e={color:new vt,position:new U,halfWidth:new U,halfHeight:new U};break}return r[t.id]=e,e}}}function Wm(){const r={};return{get:function(t){if(r[t.id]!==void 0)return r[t.id];let e;switch(t.type){case"DirectionalLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Tt};break;case"SpotLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Tt};break;case"PointLight":e={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new Tt,shadowCameraNear:1,shadowCameraFar:1e3};break}return r[t.id]=e,e}}}let qm=0;function Xm(r,t){return(t.castShadow?2:0)-(r.castShadow?2:0)+(t.map?1:0)-(r.map?1:0)}function Ym(r){const t=new Gm,e=Wm(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new U);const i=new U,s=new Yt,a=new Yt;function o(c){let h=0,u=0,f=0;for(let M=0;M<9;M++)n.probe[M].set(0,0,0);let d=0,g=0,_=0,m=0,p=0,b=0,E=0,y=0,w=0,A=0,C=0;c.sort(Xm);for(let M=0,x=c.length;M<x;M++){const P=c[M],F=P.color,B=P.intensity,k=P.distance,V=P.shadow&&P.shadow.map?P.shadow.map.texture:null;if(P.isAmbientLight)h+=F.r*B,u+=F.g*B,f+=F.b*B;else if(P.isLightProbe){for(let X=0;X<9;X++)n.probe[X].addScaledVector(P.sh.coefficients[X],B);C++}else if(P.isDirectionalLight){const X=t.get(P);if(X.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){const Z=P.shadow,W=e.get(P);W.shadowIntensity=Z.intensity,W.shadowBias=Z.bias,W.shadowNormalBias=Z.normalBias,W.shadowRadius=Z.radius,W.shadowMapSize=Z.mapSize,n.directionalShadow[d]=W,n.directionalShadowMap[d]=V,n.directionalShadowMatrix[d]=P.shadow.matrix,b++}n.directional[d]=X,d++}else if(P.isSpotLight){const X=t.get(P);X.position.setFromMatrixPosition(P.matrixWorld),X.color.copy(F).multiplyScalar(B),X.distance=k,X.coneCos=Math.cos(P.angle),X.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),X.decay=P.decay,n.spot[_]=X;const Z=P.shadow;if(P.map&&(n.spotLightMap[w]=P.map,w++,Z.updateMatrices(P),P.castShadow&&A++),n.spotLightMatrix[_]=Z.matrix,P.castShadow){const W=e.get(P);W.shadowIntensity=Z.intensity,W.shadowBias=Z.bias,W.shadowNormalBias=Z.normalBias,W.shadowRadius=Z.radius,W.shadowMapSize=Z.mapSize,n.spotShadow[_]=W,n.spotShadowMap[_]=V,y++}_++}else if(P.isRectAreaLight){const X=t.get(P);X.color.copy(F).multiplyScalar(B),X.halfWidth.set(P.width*.5,0,0),X.halfHeight.set(0,P.height*.5,0),n.rectArea[m]=X,m++}else if(P.isPointLight){const X=t.get(P);if(X.color.copy(P.color).multiplyScalar(P.intensity),X.distance=P.distance,X.decay=P.decay,P.castShadow){const Z=P.shadow,W=e.get(P);W.shadowIntensity=Z.intensity,W.shadowBias=Z.bias,W.shadowNormalBias=Z.normalBias,W.shadowRadius=Z.radius,W.shadowMapSize=Z.mapSize,W.shadowCameraNear=Z.camera.near,W.shadowCameraFar=Z.camera.far,n.pointShadow[g]=W,n.pointShadowMap[g]=V,n.pointShadowMatrix[g]=P.shadow.matrix,E++}n.point[g]=X,g++}else if(P.isHemisphereLight){const X=t.get(P);X.skyColor.copy(P.color).multiplyScalar(B),X.groundColor.copy(P.groundColor).multiplyScalar(B),n.hemi[p]=X,p++}}m>0&&(r.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=at.LTC_FLOAT_1,n.rectAreaLTC2=at.LTC_FLOAT_2):(n.rectAreaLTC1=at.LTC_HALF_1,n.rectAreaLTC2=at.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=f;const L=n.hash;(L.directionalLength!==d||L.pointLength!==g||L.spotLength!==_||L.rectAreaLength!==m||L.hemiLength!==p||L.numDirectionalShadows!==b||L.numPointShadows!==E||L.numSpotShadows!==y||L.numSpotMaps!==w||L.numLightProbes!==C)&&(n.directional.length=d,n.spot.length=_,n.rectArea.length=m,n.point.length=g,n.hemi.length=p,n.directionalShadow.length=b,n.directionalShadowMap.length=b,n.pointShadow.length=E,n.pointShadowMap.length=E,n.spotShadow.length=y,n.spotShadowMap.length=y,n.directionalShadowMatrix.length=b,n.pointShadowMatrix.length=E,n.spotLightMatrix.length=y+w-A,n.spotLightMap.length=w,n.numSpotLightShadowsWithMaps=A,n.numLightProbes=C,L.directionalLength=d,L.pointLength=g,L.spotLength=_,L.rectAreaLength=m,L.hemiLength=p,L.numDirectionalShadows=b,L.numPointShadows=E,L.numSpotShadows=y,L.numSpotMaps=w,L.numLightProbes=C,n.version=qm++)}function l(c,h){let u=0,f=0,d=0,g=0,_=0;const m=h.matrixWorldInverse;for(let p=0,b=c.length;p<b;p++){const E=c[p];if(E.isDirectionalLight){const y=n.directional[u];y.direction.setFromMatrixPosition(E.matrixWorld),i.setFromMatrixPosition(E.target.matrixWorld),y.direction.sub(i),y.direction.transformDirection(m),u++}else if(E.isSpotLight){const y=n.spot[d];y.position.setFromMatrixPosition(E.matrixWorld),y.position.applyMatrix4(m),y.direction.setFromMatrixPosition(E.matrixWorld),i.setFromMatrixPosition(E.target.matrixWorld),y.direction.sub(i),y.direction.transformDirection(m),d++}else if(E.isRectAreaLight){const y=n.rectArea[g];y.position.setFromMatrixPosition(E.matrixWorld),y.position.applyMatrix4(m),a.identity(),s.copy(E.matrixWorld),s.premultiply(m),a.extractRotation(s),y.halfWidth.set(E.width*.5,0,0),y.halfHeight.set(0,E.height*.5,0),y.halfWidth.applyMatrix4(a),y.halfHeight.applyMatrix4(a),g++}else if(E.isPointLight){const y=n.point[f];y.position.setFromMatrixPosition(E.matrixWorld),y.position.applyMatrix4(m),f++}else if(E.isHemisphereLight){const y=n.hemi[_];y.direction.setFromMatrixPosition(E.matrixWorld),y.direction.transformDirection(m),_++}}}return{setup:o,setupView:l,state:n}}function Gl(r){const t=new Ym(r),e=[],n=[];function i(h){c.camera=h,e.length=0,n.length=0}function s(h){e.push(h)}function a(h){n.push(h)}function o(){t.setup(e)}function l(h){t.setupView(e,h)}const c={lightsArray:e,shadowsArray:n,camera:null,lights:t,transmissionRenderTarget:{}};return{init:i,state:c,setupLights:o,setupLightsView:l,pushLight:s,pushShadow:a}}function Km(r){let t=new WeakMap;function e(i,s=0){const a=t.get(i);let o;return a===void 0?(o=new Gl(r),t.set(i,[o])):s>=a.length?(o=new Gl(r),a.push(o)):o=a[s],o}function n(){t=new WeakMap}return{get:e,dispose:n}}const jm=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,Zm=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function $m(r,t,e){let n=new xo;const i=new Tt,s=new Tt,a=new te,o=new vu({depthPacking:wh}),l=new xu,c={},h=e.maxTextureSize,u={[Vn]:Ue,[Ue]:Vn,[Le]:Le},f=new de({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new Tt},radius:{value:4}},vertexShader:jm,fragmentShader:Zm}),d=f.clone();d.defines.HORIZONTAL_PASS=1;const g=new xe;g.setAttribute("position",new we(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const _=new ee(g,f),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=lc;let p=this.type;this.render=function(A,C,L){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||A.length===0)return;const M=r.getRenderTarget(),x=r.getActiveCubeFace(),P=r.getActiveMipmapLevel(),F=r.state;F.setBlending(An),F.buffers.depth.getReversed()===!0?F.buffers.color.setClear(0,0,0,0):F.buffers.color.setClear(1,1,1,1),F.buffers.depth.setTest(!0),F.setScissorTest(!1);const B=p!==wn&&this.type===wn,k=p===wn&&this.type!==wn;for(let V=0,X=A.length;V<X;V++){const Z=A[V],W=Z.shadow;if(W===void 0){console.warn("THREE.WebGLShadowMap:",Z,"has no shadow.");continue}if(W.autoUpdate===!1&&W.needsUpdate===!1)continue;i.copy(W.mapSize);const rt=W.getFrameExtents();if(i.multiply(rt),s.copy(W.mapSize),(i.x>h||i.y>h)&&(i.x>h&&(s.x=Math.floor(h/rt.x),i.x=s.x*rt.x,W.mapSize.x=s.x),i.y>h&&(s.y=Math.floor(h/rt.y),i.y=s.y*rt.y,W.mapSize.y=s.y)),W.map===null||B===!0||k===!0){const St=this.type!==wn?{minFilter:Ke,magFilter:Ke}:{};W.map!==null&&W.map.dispose(),W.map=new Qe(i.x,i.y,St),W.map.texture.name=Z.name+".shadowMap",W.camera.updateProjectionMatrix()}r.setRenderTarget(W.map),r.clear();const ct=W.getViewportCount();for(let St=0;St<ct;St++){const Vt=W.getViewport(St);a.set(s.x*Vt.x,s.y*Vt.y,s.x*Vt.z,s.y*Vt.w),F.viewport(a),W.updateMatrices(Z,St),n=W.getFrustum(),y(C,L,W.camera,Z,this.type)}W.isPointLightShadow!==!0&&this.type===wn&&b(W,L),W.needsUpdate=!1}p=this.type,m.needsUpdate=!1,r.setRenderTarget(M,x,P)};function b(A,C){const L=t.update(_);f.defines.VSM_SAMPLES!==A.blurSamples&&(f.defines.VSM_SAMPLES=A.blurSamples,d.defines.VSM_SAMPLES=A.blurSamples,f.needsUpdate=!0,d.needsUpdate=!0),A.mapPass===null&&(A.mapPass=new Qe(i.x,i.y)),f.uniforms.shadow_pass.value=A.map.texture,f.uniforms.resolution.value=A.mapSize,f.uniforms.radius.value=A.radius,r.setRenderTarget(A.mapPass),r.clear(),r.renderBufferDirect(C,null,L,f,_,null),d.uniforms.shadow_pass.value=A.mapPass.texture,d.uniforms.resolution.value=A.mapSize,d.uniforms.radius.value=A.radius,r.setRenderTarget(A.map),r.clear(),r.renderBufferDirect(C,null,L,d,_,null)}function E(A,C,L,M){let x=null;const P=L.isPointLight===!0?A.customDistanceMaterial:A.customDepthMaterial;if(P!==void 0)x=P;else if(x=L.isPointLight===!0?l:o,r.localClippingEnabled&&C.clipShadows===!0&&Array.isArray(C.clippingPlanes)&&C.clippingPlanes.length!==0||C.displacementMap&&C.displacementScale!==0||C.alphaMap&&C.alphaTest>0||C.map&&C.alphaTest>0||C.alphaToCoverage===!0){const F=x.uuid,B=C.uuid;let k=c[F];k===void 0&&(k={},c[F]=k);let V=k[B];V===void 0&&(V=x.clone(),k[B]=V,C.addEventListener("dispose",w)),x=V}if(x.visible=C.visible,x.wireframe=C.wireframe,M===wn?x.side=C.shadowSide!==null?C.shadowSide:C.side:x.side=C.shadowSide!==null?C.shadowSide:u[C.side],x.alphaMap=C.alphaMap,x.alphaTest=C.alphaToCoverage===!0?.5:C.alphaTest,x.map=C.map,x.clipShadows=C.clipShadows,x.clippingPlanes=C.clippingPlanes,x.clipIntersection=C.clipIntersection,x.displacementMap=C.displacementMap,x.displacementScale=C.displacementScale,x.displacementBias=C.displacementBias,x.wireframeLinewidth=C.wireframeLinewidth,x.linewidth=C.linewidth,L.isPointLight===!0&&x.isMeshDistanceMaterial===!0){const F=r.properties.get(x);F.light=L}return x}function y(A,C,L,M,x){if(A.visible===!1)return;if(A.layers.test(C.layers)&&(A.isMesh||A.isLine||A.isPoints)&&(A.castShadow||A.receiveShadow&&x===wn)&&(!A.frustumCulled||n.intersectsObject(A))){A.modelViewMatrix.multiplyMatrices(L.matrixWorldInverse,A.matrixWorld);const B=t.update(A),k=A.material;if(Array.isArray(k)){const V=B.groups;for(let X=0,Z=V.length;X<Z;X++){const W=V[X],rt=k[W.materialIndex];if(rt&&rt.visible){const ct=E(A,rt,M,x);A.onBeforeShadow(r,A,C,L,B,ct,W),r.renderBufferDirect(L,null,B,ct,A,W),A.onAfterShadow(r,A,C,L,B,ct,W)}}}else if(k.visible){const V=E(A,k,M,x);A.onBeforeShadow(r,A,C,L,B,V,null),r.renderBufferDirect(L,null,B,V,A,null),A.onAfterShadow(r,A,C,L,B,V,null)}}const F=A.children;for(let B=0,k=F.length;B<k;B++)y(F[B],C,L,M,x)}function w(A){A.target.removeEventListener("dispose",w);for(const L in c){const M=c[L],x=A.target.uuid;x in M&&(M[x].dispose(),delete M[x])}}}const Jm={[pa]:ma,[ga]:xa,[_a]:Ma,[Ni]:va,[ma]:pa,[xa]:ga,[Ma]:_a,[va]:Ni};function Qm(r,t){function e(){let I=!1;const nt=new te;let st=null;const ft=new te(0,0,0,0);return{setMask:function(Q){st!==Q&&!I&&(r.colorMask(Q,Q,Q,Q),st=Q)},setLocked:function(Q){I=Q},setClear:function(Q,j,mt,Ut,se){se===!0&&(Q*=Ut,j*=Ut,mt*=Ut),nt.set(Q,j,mt,Ut),ft.equals(nt)===!1&&(r.clearColor(Q,j,mt,Ut),ft.copy(nt))},reset:function(){I=!1,st=null,ft.set(-1,0,0,0)}}}function n(){let I=!1,nt=!1,st=null,ft=null,Q=null;return{setReversed:function(j){if(nt!==j){const mt=t.get("EXT_clip_control");j?mt.clipControlEXT(mt.LOWER_LEFT_EXT,mt.ZERO_TO_ONE_EXT):mt.clipControlEXT(mt.LOWER_LEFT_EXT,mt.NEGATIVE_ONE_TO_ONE_EXT),nt=j;const Ut=Q;Q=null,this.setClear(Ut)}},getReversed:function(){return nt},setTest:function(j){j?J(r.DEPTH_TEST):dt(r.DEPTH_TEST)},setMask:function(j){st!==j&&!I&&(r.depthMask(j),st=j)},setFunc:function(j){if(nt&&(j=Jm[j]),ft!==j){switch(j){case pa:r.depthFunc(r.NEVER);break;case ma:r.depthFunc(r.ALWAYS);break;case ga:r.depthFunc(r.LESS);break;case Ni:r.depthFunc(r.LEQUAL);break;case _a:r.depthFunc(r.EQUAL);break;case va:r.depthFunc(r.GEQUAL);break;case xa:r.depthFunc(r.GREATER);break;case Ma:r.depthFunc(r.NOTEQUAL);break;default:r.depthFunc(r.LEQUAL)}ft=j}},setLocked:function(j){I=j},setClear:function(j){Q!==j&&(nt&&(j=1-j),r.clearDepth(j),Q=j)},reset:function(){I=!1,st=null,ft=null,Q=null,nt=!1}}}function i(){let I=!1,nt=null,st=null,ft=null,Q=null,j=null,mt=null,Ut=null,se=null;return{setTest:function(Zt){I||(Zt?J(r.STENCIL_TEST):dt(r.STENCIL_TEST))},setMask:function(Zt){nt!==Zt&&!I&&(r.stencilMask(Zt),nt=Zt)},setFunc:function(Zt,Mn,un){(st!==Zt||ft!==Mn||Q!==un)&&(r.stencilFunc(Zt,Mn,un),st=Zt,ft=Mn,Q=un)},setOp:function(Zt,Mn,un){(j!==Zt||mt!==Mn||Ut!==un)&&(r.stencilOp(Zt,Mn,un),j=Zt,mt=Mn,Ut=un)},setLocked:function(Zt){I=Zt},setClear:function(Zt){se!==Zt&&(r.clearStencil(Zt),se=Zt)},reset:function(){I=!1,nt=null,st=null,ft=null,Q=null,j=null,mt=null,Ut=null,se=null}}}const s=new e,a=new n,o=new i,l=new WeakMap,c=new WeakMap;let h={},u={},f=new WeakMap,d=[],g=null,_=!1,m=null,p=null,b=null,E=null,y=null,w=null,A=null,C=new vt(0,0,0),L=0,M=!1,x=null,P=null,F=null,B=null,k=null;const V=r.getParameter(r.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let X=!1,Z=0;const W=r.getParameter(r.VERSION);W.indexOf("WebGL")!==-1?(Z=parseFloat(/^WebGL (\d)/.exec(W)[1]),X=Z>=1):W.indexOf("OpenGL ES")!==-1&&(Z=parseFloat(/^OpenGL ES (\d)/.exec(W)[1]),X=Z>=2);let rt=null,ct={};const St=r.getParameter(r.SCISSOR_BOX),Vt=r.getParameter(r.VIEWPORT),ie=new te().fromArray(St),ae=new te().fromArray(Vt);function jt(I,nt,st,ft){const Q=new Uint8Array(4),j=r.createTexture();r.bindTexture(I,j),r.texParameteri(I,r.TEXTURE_MIN_FILTER,r.NEAREST),r.texParameteri(I,r.TEXTURE_MAG_FILTER,r.NEAREST);for(let mt=0;mt<st;mt++)I===r.TEXTURE_3D||I===r.TEXTURE_2D_ARRAY?r.texImage3D(nt,0,r.RGBA,1,1,ft,0,r.RGBA,r.UNSIGNED_BYTE,Q):r.texImage2D(nt+mt,0,r.RGBA,1,1,0,r.RGBA,r.UNSIGNED_BYTE,Q);return j}const K={};K[r.TEXTURE_2D]=jt(r.TEXTURE_2D,r.TEXTURE_2D,1),K[r.TEXTURE_CUBE_MAP]=jt(r.TEXTURE_CUBE_MAP,r.TEXTURE_CUBE_MAP_POSITIVE_X,6),K[r.TEXTURE_2D_ARRAY]=jt(r.TEXTURE_2D_ARRAY,r.TEXTURE_2D_ARRAY,1,1),K[r.TEXTURE_3D]=jt(r.TEXTURE_3D,r.TEXTURE_3D,1,1),s.setClear(0,0,0,1),a.setClear(1),o.setClear(0),J(r.DEPTH_TEST),a.setFunc(Ni),Pt(!1),gt(Fo),J(r.CULL_FACE),oe(An);function J(I){h[I]!==!0&&(r.enable(I),h[I]=!0)}function dt(I){h[I]!==!1&&(r.disable(I),h[I]=!1)}function Lt(I,nt){return u[I]!==nt?(r.bindFramebuffer(I,nt),u[I]=nt,I===r.DRAW_FRAMEBUFFER&&(u[r.FRAMEBUFFER]=nt),I===r.FRAMEBUFFER&&(u[r.DRAW_FRAMEBUFFER]=nt),!0):!1}function Et(I,nt){let st=d,ft=!1;if(I){st=f.get(nt),st===void 0&&(st=[],f.set(nt,st));const Q=I.textures;if(st.length!==Q.length||st[0]!==r.COLOR_ATTACHMENT0){for(let j=0,mt=Q.length;j<mt;j++)st[j]=r.COLOR_ATTACHMENT0+j;st.length=Q.length,ft=!0}}else st[0]!==r.BACK&&(st[0]=r.BACK,ft=!0);ft&&r.drawBuffers(st)}function qt(I){return g!==I?(r.useProgram(I),g=I,!0):!1}const Re={[ni]:r.FUNC_ADD,[rh]:r.FUNC_SUBTRACT,[ah]:r.FUNC_REVERSE_SUBTRACT};Re[oh]=r.MIN,Re[lh]=r.MAX;const D={[ch]:r.ZERO,[hh]:r.ONE,[uh]:r.SRC_COLOR,[fa]:r.SRC_ALPHA,[_h]:r.SRC_ALPHA_SATURATE,[mh]:r.DST_COLOR,[dh]:r.DST_ALPHA,[fh]:r.ONE_MINUS_SRC_COLOR,[da]:r.ONE_MINUS_SRC_ALPHA,[gh]:r.ONE_MINUS_DST_COLOR,[ph]:r.ONE_MINUS_DST_ALPHA,[vh]:r.CONSTANT_COLOR,[xh]:r.ONE_MINUS_CONSTANT_COLOR,[Mh]:r.CONSTANT_ALPHA,[yh]:r.ONE_MINUS_CONSTANT_ALPHA};function oe(I,nt,st,ft,Q,j,mt,Ut,se,Zt){if(I===An){_===!0&&(dt(r.BLEND),_=!1);return}if(_===!1&&(J(r.BLEND),_=!0),I!==sh){if(I!==m||Zt!==M){if((p!==ni||y!==ni)&&(r.blendEquation(r.FUNC_ADD),p=ni,y=ni),Zt)switch(I){case ai:r.blendFuncSeparate(r.ONE,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case en:r.blendFunc(r.ONE,r.ONE);break;case No:r.blendFuncSeparate(r.ZERO,r.ONE_MINUS_SRC_COLOR,r.ZERO,r.ONE);break;case Oo:r.blendFuncSeparate(r.DST_COLOR,r.ONE_MINUS_SRC_ALPHA,r.ZERO,r.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}else switch(I){case ai:r.blendFuncSeparate(r.SRC_ALPHA,r.ONE_MINUS_SRC_ALPHA,r.ONE,r.ONE_MINUS_SRC_ALPHA);break;case en:r.blendFuncSeparate(r.SRC_ALPHA,r.ONE,r.ONE,r.ONE);break;case No:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Oo:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",I);break}b=null,E=null,w=null,A=null,C.set(0,0,0),L=0,m=I,M=Zt}return}Q=Q||nt,j=j||st,mt=mt||ft,(nt!==p||Q!==y)&&(r.blendEquationSeparate(Re[nt],Re[Q]),p=nt,y=Q),(st!==b||ft!==E||j!==w||mt!==A)&&(r.blendFuncSeparate(D[st],D[ft],D[j],D[mt]),b=st,E=ft,w=j,A=mt),(Ut.equals(C)===!1||se!==L)&&(r.blendColor(Ut.r,Ut.g,Ut.b,se),C.copy(Ut),L=se),m=I,M=!1}function It(I,nt){I.side===Le?dt(r.CULL_FACE):J(r.CULL_FACE);let st=I.side===Ue;nt&&(st=!st),Pt(st),I.blending===ai&&I.transparent===!1?oe(An):oe(I.blending,I.blendEquation,I.blendSrc,I.blendDst,I.blendEquationAlpha,I.blendSrcAlpha,I.blendDstAlpha,I.blendColor,I.blendAlpha,I.premultipliedAlpha),a.setFunc(I.depthFunc),a.setTest(I.depthTest),a.setMask(I.depthWrite),s.setMask(I.colorWrite);const ft=I.stencilWrite;o.setTest(ft),ft&&(o.setMask(I.stencilWriteMask),o.setFunc(I.stencilFunc,I.stencilRef,I.stencilFuncMask),o.setOp(I.stencilFail,I.stencilZFail,I.stencilZPass)),_t(I.polygonOffset,I.polygonOffsetFactor,I.polygonOffsetUnits),I.alphaToCoverage===!0?J(r.SAMPLE_ALPHA_TO_COVERAGE):dt(r.SAMPLE_ALPHA_TO_COVERAGE)}function Pt(I){x!==I&&(I?r.frontFace(r.CW):r.frontFace(r.CCW),x=I)}function gt(I){I!==nh?(J(r.CULL_FACE),I!==P&&(I===Fo?r.cullFace(r.BACK):I===ih?r.cullFace(r.FRONT):r.cullFace(r.FRONT_AND_BACK))):dt(r.CULL_FACE),P=I}function le(I){I!==F&&(X&&r.lineWidth(I),F=I)}function _t(I,nt,st){I?(J(r.POLYGON_OFFSET_FILL),(B!==nt||k!==st)&&(r.polygonOffset(nt,st),B=nt,k=st)):dt(r.POLYGON_OFFSET_FILL)}function zt(I){I?J(r.SCISSOR_TEST):dt(r.SCISSOR_TEST)}function be(I){I===void 0&&(I=r.TEXTURE0+V-1),rt!==I&&(r.activeTexture(I),rt=I)}function pe(I,nt,st){st===void 0&&(rt===null?st=r.TEXTURE0+V-1:st=rt);let ft=ct[st];ft===void 0&&(ft={type:void 0,texture:void 0},ct[st]=ft),(ft.type!==I||ft.texture!==nt)&&(rt!==st&&(r.activeTexture(st),rt=st),r.bindTexture(I,nt||K[I]),ft.type=I,ft.texture=nt)}function R(){const I=ct[rt];I!==void 0&&I.type!==void 0&&(r.bindTexture(I.type,null),I.type=void 0,I.texture=void 0)}function S(){try{r.compressedTexImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function z(){try{r.compressedTexImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Y(){try{r.texSubImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function $(){try{r.texSubImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function q(){try{r.compressedTexSubImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function bt(){try{r.compressedTexSubImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function it(){try{r.texStorage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function xt(){try{r.texStorage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function Mt(){try{r.texImage2D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function et(){try{r.texImage3D(...arguments)}catch(I){console.error("THREE.WebGLState:",I)}}function ht(I){ie.equals(I)===!1&&(r.scissor(I.x,I.y,I.z,I.w),ie.copy(I))}function Ct(I){ae.equals(I)===!1&&(r.viewport(I.x,I.y,I.z,I.w),ae.copy(I))}function yt(I,nt){let st=c.get(nt);st===void 0&&(st=new WeakMap,c.set(nt,st));let ft=st.get(I);ft===void 0&&(ft=r.getUniformBlockIndex(nt,I.name),st.set(I,ft))}function ot(I,nt){const ft=c.get(nt).get(I);l.get(nt)!==ft&&(r.uniformBlockBinding(nt,ft,I.__bindingPointIndex),l.set(nt,ft))}function Ft(){r.disable(r.BLEND),r.disable(r.CULL_FACE),r.disable(r.DEPTH_TEST),r.disable(r.POLYGON_OFFSET_FILL),r.disable(r.SCISSOR_TEST),r.disable(r.STENCIL_TEST),r.disable(r.SAMPLE_ALPHA_TO_COVERAGE),r.blendEquation(r.FUNC_ADD),r.blendFunc(r.ONE,r.ZERO),r.blendFuncSeparate(r.ONE,r.ZERO,r.ONE,r.ZERO),r.blendColor(0,0,0,0),r.colorMask(!0,!0,!0,!0),r.clearColor(0,0,0,0),r.depthMask(!0),r.depthFunc(r.LESS),a.setReversed(!1),r.clearDepth(1),r.stencilMask(4294967295),r.stencilFunc(r.ALWAYS,0,4294967295),r.stencilOp(r.KEEP,r.KEEP,r.KEEP),r.clearStencil(0),r.cullFace(r.BACK),r.frontFace(r.CCW),r.polygonOffset(0,0),r.activeTexture(r.TEXTURE0),r.bindFramebuffer(r.FRAMEBUFFER,null),r.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),r.bindFramebuffer(r.READ_FRAMEBUFFER,null),r.useProgram(null),r.lineWidth(1),r.scissor(0,0,r.canvas.width,r.canvas.height),r.viewport(0,0,r.canvas.width,r.canvas.height),h={},rt=null,ct={},u={},f=new WeakMap,d=[],g=null,_=!1,m=null,p=null,b=null,E=null,y=null,w=null,A=null,C=new vt(0,0,0),L=0,M=!1,x=null,P=null,F=null,B=null,k=null,ie.set(0,0,r.canvas.width,r.canvas.height),ae.set(0,0,r.canvas.width,r.canvas.height),s.reset(),a.reset(),o.reset()}return{buffers:{color:s,depth:a,stencil:o},enable:J,disable:dt,bindFramebuffer:Lt,drawBuffers:Et,useProgram:qt,setBlending:oe,setMaterial:It,setFlipSided:Pt,setCullFace:gt,setLineWidth:le,setPolygonOffset:_t,setScissorTest:zt,activeTexture:be,bindTexture:pe,unbindTexture:R,compressedTexImage2D:S,compressedTexImage3D:z,texImage2D:Mt,texImage3D:et,updateUBOMapping:yt,uniformBlockBinding:ot,texStorage2D:it,texStorage3D:xt,texSubImage2D:Y,texSubImage3D:$,compressedTexSubImage2D:q,compressedTexSubImage3D:bt,scissor:ht,viewport:Ct,reset:Ft}}function t0(r,t,e,n,i,s,a){const o=t.has("WEBGL_multisampled_render_to_texture")?t.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new Tt,h=new WeakMap;let u;const f=new WeakMap;let d=!1;try{d=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function g(R,S){return d?new OffscreenCanvas(R,S):lr("canvas")}function _(R,S,z){let Y=1;const $=pe(R);if(($.width>z||$.height>z)&&(Y=z/Math.max($.width,$.height)),Y<1)if(typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&R instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&R instanceof ImageBitmap||typeof VideoFrame<"u"&&R instanceof VideoFrame){const q=Math.floor(Y*$.width),bt=Math.floor(Y*$.height);u===void 0&&(u=g(q,bt));const it=S?g(q,bt):u;return it.width=q,it.height=bt,it.getContext("2d").drawImage(R,0,0,q,bt),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+$.width+"x"+$.height+") to ("+q+"x"+bt+")."),it}else return"data"in R&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+$.width+"x"+$.height+")."),R;return R}function m(R){return R.generateMipmaps}function p(R){r.generateMipmap(R)}function b(R){return R.isWebGLCubeRenderTarget?r.TEXTURE_CUBE_MAP:R.isWebGL3DRenderTarget?r.TEXTURE_3D:R.isWebGLArrayRenderTarget||R.isCompressedArrayTexture?r.TEXTURE_2D_ARRAY:r.TEXTURE_2D}function E(R,S,z,Y,$=!1){if(R!==null){if(r[R]!==void 0)return r[R];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+R+"'")}let q=S;if(S===r.RED&&(z===r.FLOAT&&(q=r.R32F),z===r.HALF_FLOAT&&(q=r.R16F),z===r.UNSIGNED_BYTE&&(q=r.R8)),S===r.RED_INTEGER&&(z===r.UNSIGNED_BYTE&&(q=r.R8UI),z===r.UNSIGNED_SHORT&&(q=r.R16UI),z===r.UNSIGNED_INT&&(q=r.R32UI),z===r.BYTE&&(q=r.R8I),z===r.SHORT&&(q=r.R16I),z===r.INT&&(q=r.R32I)),S===r.RG&&(z===r.FLOAT&&(q=r.RG32F),z===r.HALF_FLOAT&&(q=r.RG16F),z===r.UNSIGNED_BYTE&&(q=r.RG8)),S===r.RG_INTEGER&&(z===r.UNSIGNED_BYTE&&(q=r.RG8UI),z===r.UNSIGNED_SHORT&&(q=r.RG16UI),z===r.UNSIGNED_INT&&(q=r.RG32UI),z===r.BYTE&&(q=r.RG8I),z===r.SHORT&&(q=r.RG16I),z===r.INT&&(q=r.RG32I)),S===r.RGB_INTEGER&&(z===r.UNSIGNED_BYTE&&(q=r.RGB8UI),z===r.UNSIGNED_SHORT&&(q=r.RGB16UI),z===r.UNSIGNED_INT&&(q=r.RGB32UI),z===r.BYTE&&(q=r.RGB8I),z===r.SHORT&&(q=r.RGB16I),z===r.INT&&(q=r.RGB32I)),S===r.RGBA_INTEGER&&(z===r.UNSIGNED_BYTE&&(q=r.RGBA8UI),z===r.UNSIGNED_SHORT&&(q=r.RGBA16UI),z===r.UNSIGNED_INT&&(q=r.RGBA32UI),z===r.BYTE&&(q=r.RGBA8I),z===r.SHORT&&(q=r.RGBA16I),z===r.INT&&(q=r.RGBA32I)),S===r.RGB&&(z===r.UNSIGNED_INT_5_9_9_9_REV&&(q=r.RGB9_E5),z===r.UNSIGNED_INT_10F_11F_11F_REV&&(q=r.R11F_G11F_B10F)),S===r.RGBA){const bt=$?ar:Xt.getTransfer(Y);z===r.FLOAT&&(q=r.RGBA32F),z===r.HALF_FLOAT&&(q=r.RGBA16F),z===r.UNSIGNED_BYTE&&(q=bt===$t?r.SRGB8_ALPHA8:r.RGBA8),z===r.UNSIGNED_SHORT_4_4_4_4&&(q=r.RGBA4),z===r.UNSIGNED_SHORT_5_5_5_1&&(q=r.RGB5_A1)}return(q===r.R16F||q===r.R32F||q===r.RG16F||q===r.RG32F||q===r.RGBA16F||q===r.RGBA32F)&&t.get("EXT_color_buffer_float"),q}function y(R,S){let z;return R?S===null||S===oi||S===hs?z=r.DEPTH24_STENCIL8:S===gn?z=r.DEPTH32F_STENCIL8:S===cs&&(z=r.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):S===null||S===oi||S===hs?z=r.DEPTH_COMPONENT24:S===gn?z=r.DEPTH_COMPONENT32F:S===cs&&(z=r.DEPTH_COMPONENT16),z}function w(R,S){return m(R)===!0||R.isFramebufferTexture&&R.minFilter!==Ke&&R.minFilter!==mn?Math.log2(Math.max(S.width,S.height))+1:R.mipmaps!==void 0&&R.mipmaps.length>0?R.mipmaps.length:R.isCompressedTexture&&Array.isArray(R.image)?S.mipmaps.length:1}function A(R){const S=R.target;S.removeEventListener("dispose",A),L(S),S.isVideoTexture&&h.delete(S)}function C(R){const S=R.target;S.removeEventListener("dispose",C),x(S)}function L(R){const S=n.get(R);if(S.__webglInit===void 0)return;const z=R.source,Y=f.get(z);if(Y){const $=Y[S.__cacheKey];$.usedTimes--,$.usedTimes===0&&M(R),Object.keys(Y).length===0&&f.delete(z)}n.remove(R)}function M(R){const S=n.get(R);r.deleteTexture(S.__webglTexture);const z=R.source,Y=f.get(z);delete Y[S.__cacheKey],a.memory.textures--}function x(R){const S=n.get(R);if(R.depthTexture&&(R.depthTexture.dispose(),n.remove(R.depthTexture)),R.isWebGLCubeRenderTarget)for(let Y=0;Y<6;Y++){if(Array.isArray(S.__webglFramebuffer[Y]))for(let $=0;$<S.__webglFramebuffer[Y].length;$++)r.deleteFramebuffer(S.__webglFramebuffer[Y][$]);else r.deleteFramebuffer(S.__webglFramebuffer[Y]);S.__webglDepthbuffer&&r.deleteRenderbuffer(S.__webglDepthbuffer[Y])}else{if(Array.isArray(S.__webglFramebuffer))for(let Y=0;Y<S.__webglFramebuffer.length;Y++)r.deleteFramebuffer(S.__webglFramebuffer[Y]);else r.deleteFramebuffer(S.__webglFramebuffer);if(S.__webglDepthbuffer&&r.deleteRenderbuffer(S.__webglDepthbuffer),S.__webglMultisampledFramebuffer&&r.deleteFramebuffer(S.__webglMultisampledFramebuffer),S.__webglColorRenderbuffer)for(let Y=0;Y<S.__webglColorRenderbuffer.length;Y++)S.__webglColorRenderbuffer[Y]&&r.deleteRenderbuffer(S.__webglColorRenderbuffer[Y]);S.__webglDepthRenderbuffer&&r.deleteRenderbuffer(S.__webglDepthRenderbuffer)}const z=R.textures;for(let Y=0,$=z.length;Y<$;Y++){const q=n.get(z[Y]);q.__webglTexture&&(r.deleteTexture(q.__webglTexture),a.memory.textures--),n.remove(z[Y])}n.remove(R)}let P=0;function F(){P=0}function B(){const R=P;return R>=i.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+R+" texture units while this GPU supports only "+i.maxTextures),P+=1,R}function k(R){const S=[];return S.push(R.wrapS),S.push(R.wrapT),S.push(R.wrapR||0),S.push(R.magFilter),S.push(R.minFilter),S.push(R.anisotropy),S.push(R.internalFormat),S.push(R.format),S.push(R.type),S.push(R.generateMipmaps),S.push(R.premultiplyAlpha),S.push(R.flipY),S.push(R.unpackAlignment),S.push(R.colorSpace),S.join()}function V(R,S){const z=n.get(R);if(R.isVideoTexture&&zt(R),R.isRenderTargetTexture===!1&&R.isExternalTexture!==!0&&R.version>0&&z.__version!==R.version){const Y=R.image;if(Y===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(Y.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{K(z,R,S);return}}else R.isExternalTexture&&(z.__webglTexture=R.sourceTexture?R.sourceTexture:null);e.bindTexture(r.TEXTURE_2D,z.__webglTexture,r.TEXTURE0+S)}function X(R,S){const z=n.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&z.__version!==R.version){K(z,R,S);return}e.bindTexture(r.TEXTURE_2D_ARRAY,z.__webglTexture,r.TEXTURE0+S)}function Z(R,S){const z=n.get(R);if(R.isRenderTargetTexture===!1&&R.version>0&&z.__version!==R.version){K(z,R,S);return}e.bindTexture(r.TEXTURE_3D,z.__webglTexture,r.TEXTURE0+S)}function W(R,S){const z=n.get(R);if(R.version>0&&z.__version!==R.version){J(z,R,S);return}e.bindTexture(r.TEXTURE_CUBE_MAP,z.__webglTexture,r.TEXTURE0+S)}const rt={[ba]:r.REPEAT,[si]:r.CLAMP_TO_EDGE,[Ea]:r.MIRRORED_REPEAT},ct={[Ke]:r.NEAREST,[Eh]:r.NEAREST_MIPMAP_NEAREST,[ys]:r.NEAREST_MIPMAP_LINEAR,[mn]:r.LINEAR,[Er]:r.LINEAR_MIPMAP_NEAREST,[ri]:r.LINEAR_MIPMAP_LINEAR},St={[Rh]:r.NEVER,[Ih]:r.ALWAYS,[Ch]:r.LESS,[Tc]:r.LEQUAL,[Ph]:r.EQUAL,[Uh]:r.GEQUAL,[Dh]:r.GREATER,[Lh]:r.NOTEQUAL};function Vt(R,S){if(S.type===gn&&t.has("OES_texture_float_linear")===!1&&(S.magFilter===mn||S.magFilter===Er||S.magFilter===ys||S.magFilter===ri||S.minFilter===mn||S.minFilter===Er||S.minFilter===ys||S.minFilter===ri)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),r.texParameteri(R,r.TEXTURE_WRAP_S,rt[S.wrapS]),r.texParameteri(R,r.TEXTURE_WRAP_T,rt[S.wrapT]),(R===r.TEXTURE_3D||R===r.TEXTURE_2D_ARRAY)&&r.texParameteri(R,r.TEXTURE_WRAP_R,rt[S.wrapR]),r.texParameteri(R,r.TEXTURE_MAG_FILTER,ct[S.magFilter]),r.texParameteri(R,r.TEXTURE_MIN_FILTER,ct[S.minFilter]),S.compareFunction&&(r.texParameteri(R,r.TEXTURE_COMPARE_MODE,r.COMPARE_REF_TO_TEXTURE),r.texParameteri(R,r.TEXTURE_COMPARE_FUNC,St[S.compareFunction])),t.has("EXT_texture_filter_anisotropic")===!0){if(S.magFilter===Ke||S.minFilter!==ys&&S.minFilter!==ri||S.type===gn&&t.has("OES_texture_float_linear")===!1)return;if(S.anisotropy>1||n.get(S).__currentAnisotropy){const z=t.get("EXT_texture_filter_anisotropic");r.texParameterf(R,z.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(S.anisotropy,i.getMaxAnisotropy())),n.get(S).__currentAnisotropy=S.anisotropy}}}function ie(R,S){let z=!1;R.__webglInit===void 0&&(R.__webglInit=!0,S.addEventListener("dispose",A));const Y=S.source;let $=f.get(Y);$===void 0&&($={},f.set(Y,$));const q=k(S);if(q!==R.__cacheKey){$[q]===void 0&&($[q]={texture:r.createTexture(),usedTimes:0},a.memory.textures++,z=!0),$[q].usedTimes++;const bt=$[R.__cacheKey];bt!==void 0&&($[R.__cacheKey].usedTimes--,bt.usedTimes===0&&M(S)),R.__cacheKey=q,R.__webglTexture=$[q].texture}return z}function ae(R,S,z){return Math.floor(Math.floor(R/z)/S)}function jt(R,S,z,Y){const q=R.updateRanges;if(q.length===0)e.texSubImage2D(r.TEXTURE_2D,0,0,0,S.width,S.height,z,Y,S.data);else{q.sort((et,ht)=>et.start-ht.start);let bt=0;for(let et=1;et<q.length;et++){const ht=q[bt],Ct=q[et],yt=ht.start+ht.count,ot=ae(Ct.start,S.width,4),Ft=ae(ht.start,S.width,4);Ct.start<=yt+1&&ot===Ft&&ae(Ct.start+Ct.count-1,S.width,4)===ot?ht.count=Math.max(ht.count,Ct.start+Ct.count-ht.start):(++bt,q[bt]=Ct)}q.length=bt+1;const it=r.getParameter(r.UNPACK_ROW_LENGTH),xt=r.getParameter(r.UNPACK_SKIP_PIXELS),Mt=r.getParameter(r.UNPACK_SKIP_ROWS);r.pixelStorei(r.UNPACK_ROW_LENGTH,S.width);for(let et=0,ht=q.length;et<ht;et++){const Ct=q[et],yt=Math.floor(Ct.start/4),ot=Math.ceil(Ct.count/4),Ft=yt%S.width,I=Math.floor(yt/S.width),nt=ot,st=1;r.pixelStorei(r.UNPACK_SKIP_PIXELS,Ft),r.pixelStorei(r.UNPACK_SKIP_ROWS,I),e.texSubImage2D(r.TEXTURE_2D,0,Ft,I,nt,st,z,Y,S.data)}R.clearUpdateRanges(),r.pixelStorei(r.UNPACK_ROW_LENGTH,it),r.pixelStorei(r.UNPACK_SKIP_PIXELS,xt),r.pixelStorei(r.UNPACK_SKIP_ROWS,Mt)}}function K(R,S,z){let Y=r.TEXTURE_2D;(S.isDataArrayTexture||S.isCompressedArrayTexture)&&(Y=r.TEXTURE_2D_ARRAY),S.isData3DTexture&&(Y=r.TEXTURE_3D);const $=ie(R,S),q=S.source;e.bindTexture(Y,R.__webglTexture,r.TEXTURE0+z);const bt=n.get(q);if(q.version!==bt.__version||$===!0){e.activeTexture(r.TEXTURE0+z);const it=Xt.getPrimaries(Xt.workingColorSpace),xt=S.colorSpace===Bn?null:Xt.getPrimaries(S.colorSpace),Mt=S.colorSpace===Bn||it===xt?r.NONE:r.BROWSER_DEFAULT_WEBGL;r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,S.flipY),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),r.pixelStorei(r.UNPACK_ALIGNMENT,S.unpackAlignment),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,Mt);let et=_(S.image,!1,i.maxTextureSize);et=be(S,et);const ht=s.convert(S.format,S.colorSpace),Ct=s.convert(S.type);let yt=E(S.internalFormat,ht,Ct,S.colorSpace,S.isVideoTexture);Vt(Y,S);let ot;const Ft=S.mipmaps,I=S.isVideoTexture!==!0,nt=bt.__version===void 0||$===!0,st=q.dataReady,ft=w(S,et);if(S.isDepthTexture)yt=y(S.format===fs,S.type),nt&&(I?e.texStorage2D(r.TEXTURE_2D,1,yt,et.width,et.height):e.texImage2D(r.TEXTURE_2D,0,yt,et.width,et.height,0,ht,Ct,null));else if(S.isDataTexture)if(Ft.length>0){I&&nt&&e.texStorage2D(r.TEXTURE_2D,ft,yt,Ft[0].width,Ft[0].height);for(let Q=0,j=Ft.length;Q<j;Q++)ot=Ft[Q],I?st&&e.texSubImage2D(r.TEXTURE_2D,Q,0,0,ot.width,ot.height,ht,Ct,ot.data):e.texImage2D(r.TEXTURE_2D,Q,yt,ot.width,ot.height,0,ht,Ct,ot.data);S.generateMipmaps=!1}else I?(nt&&e.texStorage2D(r.TEXTURE_2D,ft,yt,et.width,et.height),st&&jt(S,et,ht,Ct)):e.texImage2D(r.TEXTURE_2D,0,yt,et.width,et.height,0,ht,Ct,et.data);else if(S.isCompressedTexture)if(S.isCompressedArrayTexture){I&&nt&&e.texStorage3D(r.TEXTURE_2D_ARRAY,ft,yt,Ft[0].width,Ft[0].height,et.depth);for(let Q=0,j=Ft.length;Q<j;Q++)if(ot=Ft[Q],S.format!==cn)if(ht!==null)if(I){if(st)if(S.layerUpdates.size>0){const mt=xl(ot.width,ot.height,S.format,S.type);for(const Ut of S.layerUpdates){const se=ot.data.subarray(Ut*mt/ot.data.BYTES_PER_ELEMENT,(Ut+1)*mt/ot.data.BYTES_PER_ELEMENT);e.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,Q,0,0,Ut,ot.width,ot.height,1,ht,se)}S.clearLayerUpdates()}else e.compressedTexSubImage3D(r.TEXTURE_2D_ARRAY,Q,0,0,0,ot.width,ot.height,et.depth,ht,ot.data)}else e.compressedTexImage3D(r.TEXTURE_2D_ARRAY,Q,yt,ot.width,ot.height,et.depth,0,ot.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else I?st&&e.texSubImage3D(r.TEXTURE_2D_ARRAY,Q,0,0,0,ot.width,ot.height,et.depth,ht,Ct,ot.data):e.texImage3D(r.TEXTURE_2D_ARRAY,Q,yt,ot.width,ot.height,et.depth,0,ht,Ct,ot.data)}else{I&&nt&&e.texStorage2D(r.TEXTURE_2D,ft,yt,Ft[0].width,Ft[0].height);for(let Q=0,j=Ft.length;Q<j;Q++)ot=Ft[Q],S.format!==cn?ht!==null?I?st&&e.compressedTexSubImage2D(r.TEXTURE_2D,Q,0,0,ot.width,ot.height,ht,ot.data):e.compressedTexImage2D(r.TEXTURE_2D,Q,yt,ot.width,ot.height,0,ot.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):I?st&&e.texSubImage2D(r.TEXTURE_2D,Q,0,0,ot.width,ot.height,ht,Ct,ot.data):e.texImage2D(r.TEXTURE_2D,Q,yt,ot.width,ot.height,0,ht,Ct,ot.data)}else if(S.isDataArrayTexture)if(I){if(nt&&e.texStorage3D(r.TEXTURE_2D_ARRAY,ft,yt,et.width,et.height,et.depth),st)if(S.layerUpdates.size>0){const Q=xl(et.width,et.height,S.format,S.type);for(const j of S.layerUpdates){const mt=et.data.subarray(j*Q/et.data.BYTES_PER_ELEMENT,(j+1)*Q/et.data.BYTES_PER_ELEMENT);e.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,j,et.width,et.height,1,ht,Ct,mt)}S.clearLayerUpdates()}else e.texSubImage3D(r.TEXTURE_2D_ARRAY,0,0,0,0,et.width,et.height,et.depth,ht,Ct,et.data)}else e.texImage3D(r.TEXTURE_2D_ARRAY,0,yt,et.width,et.height,et.depth,0,ht,Ct,et.data);else if(S.isData3DTexture)I?(nt&&e.texStorage3D(r.TEXTURE_3D,ft,yt,et.width,et.height,et.depth),st&&e.texSubImage3D(r.TEXTURE_3D,0,0,0,0,et.width,et.height,et.depth,ht,Ct,et.data)):e.texImage3D(r.TEXTURE_3D,0,yt,et.width,et.height,et.depth,0,ht,Ct,et.data);else if(S.isFramebufferTexture){if(nt)if(I)e.texStorage2D(r.TEXTURE_2D,ft,yt,et.width,et.height);else{let Q=et.width,j=et.height;for(let mt=0;mt<ft;mt++)e.texImage2D(r.TEXTURE_2D,mt,yt,Q,j,0,ht,Ct,null),Q>>=1,j>>=1}}else if(Ft.length>0){if(I&&nt){const Q=pe(Ft[0]);e.texStorage2D(r.TEXTURE_2D,ft,yt,Q.width,Q.height)}for(let Q=0,j=Ft.length;Q<j;Q++)ot=Ft[Q],I?st&&e.texSubImage2D(r.TEXTURE_2D,Q,0,0,ht,Ct,ot):e.texImage2D(r.TEXTURE_2D,Q,yt,ht,Ct,ot);S.generateMipmaps=!1}else if(I){if(nt){const Q=pe(et);e.texStorage2D(r.TEXTURE_2D,ft,yt,Q.width,Q.height)}st&&e.texSubImage2D(r.TEXTURE_2D,0,0,0,ht,Ct,et)}else e.texImage2D(r.TEXTURE_2D,0,yt,ht,Ct,et);m(S)&&p(Y),bt.__version=q.version,S.onUpdate&&S.onUpdate(S)}R.__version=S.version}function J(R,S,z){if(S.image.length!==6)return;const Y=ie(R,S),$=S.source;e.bindTexture(r.TEXTURE_CUBE_MAP,R.__webglTexture,r.TEXTURE0+z);const q=n.get($);if($.version!==q.__version||Y===!0){e.activeTexture(r.TEXTURE0+z);const bt=Xt.getPrimaries(Xt.workingColorSpace),it=S.colorSpace===Bn?null:Xt.getPrimaries(S.colorSpace),xt=S.colorSpace===Bn||bt===it?r.NONE:r.BROWSER_DEFAULT_WEBGL;r.pixelStorei(r.UNPACK_FLIP_Y_WEBGL,S.flipY),r.pixelStorei(r.UNPACK_PREMULTIPLY_ALPHA_WEBGL,S.premultiplyAlpha),r.pixelStorei(r.UNPACK_ALIGNMENT,S.unpackAlignment),r.pixelStorei(r.UNPACK_COLORSPACE_CONVERSION_WEBGL,xt);const Mt=S.isCompressedTexture||S.image[0].isCompressedTexture,et=S.image[0]&&S.image[0].isDataTexture,ht=[];for(let j=0;j<6;j++)!Mt&&!et?ht[j]=_(S.image[j],!0,i.maxCubemapSize):ht[j]=et?S.image[j].image:S.image[j],ht[j]=be(S,ht[j]);const Ct=ht[0],yt=s.convert(S.format,S.colorSpace),ot=s.convert(S.type),Ft=E(S.internalFormat,yt,ot,S.colorSpace),I=S.isVideoTexture!==!0,nt=q.__version===void 0||Y===!0,st=$.dataReady;let ft=w(S,Ct);Vt(r.TEXTURE_CUBE_MAP,S);let Q;if(Mt){I&&nt&&e.texStorage2D(r.TEXTURE_CUBE_MAP,ft,Ft,Ct.width,Ct.height);for(let j=0;j<6;j++){Q=ht[j].mipmaps;for(let mt=0;mt<Q.length;mt++){const Ut=Q[mt];S.format!==cn?yt!==null?I?st&&e.compressedTexSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,mt,0,0,Ut.width,Ut.height,yt,Ut.data):e.compressedTexImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,mt,Ft,Ut.width,Ut.height,0,Ut.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):I?st&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,mt,0,0,Ut.width,Ut.height,yt,ot,Ut.data):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,mt,Ft,Ut.width,Ut.height,0,yt,ot,Ut.data)}}}else{if(Q=S.mipmaps,I&&nt){Q.length>0&&ft++;const j=pe(ht[0]);e.texStorage2D(r.TEXTURE_CUBE_MAP,ft,Ft,j.width,j.height)}for(let j=0;j<6;j++)if(et){I?st&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,ht[j].width,ht[j].height,yt,ot,ht[j].data):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Ft,ht[j].width,ht[j].height,0,yt,ot,ht[j].data);for(let mt=0;mt<Q.length;mt++){const se=Q[mt].image[j].image;I?st&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,mt+1,0,0,se.width,se.height,yt,ot,se.data):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,mt+1,Ft,se.width,se.height,0,yt,ot,se.data)}}else{I?st&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,0,0,yt,ot,ht[j]):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,0,Ft,yt,ot,ht[j]);for(let mt=0;mt<Q.length;mt++){const Ut=Q[mt];I?st&&e.texSubImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,mt+1,0,0,yt,ot,Ut.image[j]):e.texImage2D(r.TEXTURE_CUBE_MAP_POSITIVE_X+j,mt+1,Ft,yt,ot,Ut.image[j])}}}m(S)&&p(r.TEXTURE_CUBE_MAP),q.__version=$.version,S.onUpdate&&S.onUpdate(S)}R.__version=S.version}function dt(R,S,z,Y,$,q){const bt=s.convert(z.format,z.colorSpace),it=s.convert(z.type),xt=E(z.internalFormat,bt,it,z.colorSpace),Mt=n.get(S),et=n.get(z);if(et.__renderTarget=S,!Mt.__hasExternalTextures){const ht=Math.max(1,S.width>>q),Ct=Math.max(1,S.height>>q);$===r.TEXTURE_3D||$===r.TEXTURE_2D_ARRAY?e.texImage3D($,q,xt,ht,Ct,S.depth,0,bt,it,null):e.texImage2D($,q,xt,ht,Ct,0,bt,it,null)}e.bindFramebuffer(r.FRAMEBUFFER,R),_t(S)?o.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,Y,$,et.__webglTexture,0,le(S)):($===r.TEXTURE_2D||$>=r.TEXTURE_CUBE_MAP_POSITIVE_X&&$<=r.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&r.framebufferTexture2D(r.FRAMEBUFFER,Y,$,et.__webglTexture,q),e.bindFramebuffer(r.FRAMEBUFFER,null)}function Lt(R,S,z){if(r.bindRenderbuffer(r.RENDERBUFFER,R),S.depthBuffer){const Y=S.depthTexture,$=Y&&Y.isDepthTexture?Y.type:null,q=y(S.stencilBuffer,$),bt=S.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,it=le(S);_t(S)?o.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,it,q,S.width,S.height):z?r.renderbufferStorageMultisample(r.RENDERBUFFER,it,q,S.width,S.height):r.renderbufferStorage(r.RENDERBUFFER,q,S.width,S.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,bt,r.RENDERBUFFER,R)}else{const Y=S.textures;for(let $=0;$<Y.length;$++){const q=Y[$],bt=s.convert(q.format,q.colorSpace),it=s.convert(q.type),xt=E(q.internalFormat,bt,it,q.colorSpace),Mt=le(S);z&&_t(S)===!1?r.renderbufferStorageMultisample(r.RENDERBUFFER,Mt,xt,S.width,S.height):_t(S)?o.renderbufferStorageMultisampleEXT(r.RENDERBUFFER,Mt,xt,S.width,S.height):r.renderbufferStorage(r.RENDERBUFFER,xt,S.width,S.height)}}r.bindRenderbuffer(r.RENDERBUFFER,null)}function Et(R,S){if(S&&S.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(e.bindFramebuffer(r.FRAMEBUFFER,R),!(S.depthTexture&&S.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const Y=n.get(S.depthTexture);Y.__renderTarget=S,(!Y.__webglTexture||S.depthTexture.image.width!==S.width||S.depthTexture.image.height!==S.height)&&(S.depthTexture.image.width=S.width,S.depthTexture.image.height=S.height,S.depthTexture.needsUpdate=!0),V(S.depthTexture,0);const $=Y.__webglTexture,q=le(S);if(S.depthTexture.format===us)_t(S)?o.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,r.DEPTH_ATTACHMENT,r.TEXTURE_2D,$,0,q):r.framebufferTexture2D(r.FRAMEBUFFER,r.DEPTH_ATTACHMENT,r.TEXTURE_2D,$,0);else if(S.depthTexture.format===fs)_t(S)?o.framebufferTexture2DMultisampleEXT(r.FRAMEBUFFER,r.DEPTH_STENCIL_ATTACHMENT,r.TEXTURE_2D,$,0,q):r.framebufferTexture2D(r.FRAMEBUFFER,r.DEPTH_STENCIL_ATTACHMENT,r.TEXTURE_2D,$,0);else throw new Error("Unknown depthTexture format")}function qt(R){const S=n.get(R),z=R.isWebGLCubeRenderTarget===!0;if(S.__boundDepthTexture!==R.depthTexture){const Y=R.depthTexture;if(S.__depthDisposeCallback&&S.__depthDisposeCallback(),Y){const $=()=>{delete S.__boundDepthTexture,delete S.__depthDisposeCallback,Y.removeEventListener("dispose",$)};Y.addEventListener("dispose",$),S.__depthDisposeCallback=$}S.__boundDepthTexture=Y}if(R.depthTexture&&!S.__autoAllocateDepthBuffer){if(z)throw new Error("target.depthTexture not supported in Cube render targets");const Y=R.texture.mipmaps;Y&&Y.length>0?Et(S.__webglFramebuffer[0],R):Et(S.__webglFramebuffer,R)}else if(z){S.__webglDepthbuffer=[];for(let Y=0;Y<6;Y++)if(e.bindFramebuffer(r.FRAMEBUFFER,S.__webglFramebuffer[Y]),S.__webglDepthbuffer[Y]===void 0)S.__webglDepthbuffer[Y]=r.createRenderbuffer(),Lt(S.__webglDepthbuffer[Y],R,!1);else{const $=R.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,q=S.__webglDepthbuffer[Y];r.bindRenderbuffer(r.RENDERBUFFER,q),r.framebufferRenderbuffer(r.FRAMEBUFFER,$,r.RENDERBUFFER,q)}}else{const Y=R.texture.mipmaps;if(Y&&Y.length>0?e.bindFramebuffer(r.FRAMEBUFFER,S.__webglFramebuffer[0]):e.bindFramebuffer(r.FRAMEBUFFER,S.__webglFramebuffer),S.__webglDepthbuffer===void 0)S.__webglDepthbuffer=r.createRenderbuffer(),Lt(S.__webglDepthbuffer,R,!1);else{const $=R.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,q=S.__webglDepthbuffer;r.bindRenderbuffer(r.RENDERBUFFER,q),r.framebufferRenderbuffer(r.FRAMEBUFFER,$,r.RENDERBUFFER,q)}}e.bindFramebuffer(r.FRAMEBUFFER,null)}function Re(R,S,z){const Y=n.get(R);S!==void 0&&dt(Y.__webglFramebuffer,R,R.texture,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,0),z!==void 0&&qt(R)}function D(R){const S=R.texture,z=n.get(R),Y=n.get(S);R.addEventListener("dispose",C);const $=R.textures,q=R.isWebGLCubeRenderTarget===!0,bt=$.length>1;if(bt||(Y.__webglTexture===void 0&&(Y.__webglTexture=r.createTexture()),Y.__version=S.version,a.memory.textures++),q){z.__webglFramebuffer=[];for(let it=0;it<6;it++)if(S.mipmaps&&S.mipmaps.length>0){z.__webglFramebuffer[it]=[];for(let xt=0;xt<S.mipmaps.length;xt++)z.__webglFramebuffer[it][xt]=r.createFramebuffer()}else z.__webglFramebuffer[it]=r.createFramebuffer()}else{if(S.mipmaps&&S.mipmaps.length>0){z.__webglFramebuffer=[];for(let it=0;it<S.mipmaps.length;it++)z.__webglFramebuffer[it]=r.createFramebuffer()}else z.__webglFramebuffer=r.createFramebuffer();if(bt)for(let it=0,xt=$.length;it<xt;it++){const Mt=n.get($[it]);Mt.__webglTexture===void 0&&(Mt.__webglTexture=r.createTexture(),a.memory.textures++)}if(R.samples>0&&_t(R)===!1){z.__webglMultisampledFramebuffer=r.createFramebuffer(),z.__webglColorRenderbuffer=[],e.bindFramebuffer(r.FRAMEBUFFER,z.__webglMultisampledFramebuffer);for(let it=0;it<$.length;it++){const xt=$[it];z.__webglColorRenderbuffer[it]=r.createRenderbuffer(),r.bindRenderbuffer(r.RENDERBUFFER,z.__webglColorRenderbuffer[it]);const Mt=s.convert(xt.format,xt.colorSpace),et=s.convert(xt.type),ht=E(xt.internalFormat,Mt,et,xt.colorSpace,R.isXRRenderTarget===!0),Ct=le(R);r.renderbufferStorageMultisample(r.RENDERBUFFER,Ct,ht,R.width,R.height),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+it,r.RENDERBUFFER,z.__webglColorRenderbuffer[it])}r.bindRenderbuffer(r.RENDERBUFFER,null),R.depthBuffer&&(z.__webglDepthRenderbuffer=r.createRenderbuffer(),Lt(z.__webglDepthRenderbuffer,R,!0)),e.bindFramebuffer(r.FRAMEBUFFER,null)}}if(q){e.bindTexture(r.TEXTURE_CUBE_MAP,Y.__webglTexture),Vt(r.TEXTURE_CUBE_MAP,S);for(let it=0;it<6;it++)if(S.mipmaps&&S.mipmaps.length>0)for(let xt=0;xt<S.mipmaps.length;xt++)dt(z.__webglFramebuffer[it][xt],R,S,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+it,xt);else dt(z.__webglFramebuffer[it],R,S,r.COLOR_ATTACHMENT0,r.TEXTURE_CUBE_MAP_POSITIVE_X+it,0);m(S)&&p(r.TEXTURE_CUBE_MAP),e.unbindTexture()}else if(bt){for(let it=0,xt=$.length;it<xt;it++){const Mt=$[it],et=n.get(Mt);let ht=r.TEXTURE_2D;(R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(ht=R.isWebGL3DRenderTarget?r.TEXTURE_3D:r.TEXTURE_2D_ARRAY),e.bindTexture(ht,et.__webglTexture),Vt(ht,Mt),dt(z.__webglFramebuffer,R,Mt,r.COLOR_ATTACHMENT0+it,ht,0),m(Mt)&&p(ht)}e.unbindTexture()}else{let it=r.TEXTURE_2D;if((R.isWebGL3DRenderTarget||R.isWebGLArrayRenderTarget)&&(it=R.isWebGL3DRenderTarget?r.TEXTURE_3D:r.TEXTURE_2D_ARRAY),e.bindTexture(it,Y.__webglTexture),Vt(it,S),S.mipmaps&&S.mipmaps.length>0)for(let xt=0;xt<S.mipmaps.length;xt++)dt(z.__webglFramebuffer[xt],R,S,r.COLOR_ATTACHMENT0,it,xt);else dt(z.__webglFramebuffer,R,S,r.COLOR_ATTACHMENT0,it,0);m(S)&&p(it),e.unbindTexture()}R.depthBuffer&&qt(R)}function oe(R){const S=R.textures;for(let z=0,Y=S.length;z<Y;z++){const $=S[z];if(m($)){const q=b(R),bt=n.get($).__webglTexture;e.bindTexture(q,bt),p(q),e.unbindTexture()}}}const It=[],Pt=[];function gt(R){if(R.samples>0){if(_t(R)===!1){const S=R.textures,z=R.width,Y=R.height;let $=r.COLOR_BUFFER_BIT;const q=R.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT,bt=n.get(R),it=S.length>1;if(it)for(let Mt=0;Mt<S.length;Mt++)e.bindFramebuffer(r.FRAMEBUFFER,bt.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+Mt,r.RENDERBUFFER,null),e.bindFramebuffer(r.FRAMEBUFFER,bt.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+Mt,r.TEXTURE_2D,null,0);e.bindFramebuffer(r.READ_FRAMEBUFFER,bt.__webglMultisampledFramebuffer);const xt=R.texture.mipmaps;xt&&xt.length>0?e.bindFramebuffer(r.DRAW_FRAMEBUFFER,bt.__webglFramebuffer[0]):e.bindFramebuffer(r.DRAW_FRAMEBUFFER,bt.__webglFramebuffer);for(let Mt=0;Mt<S.length;Mt++){if(R.resolveDepthBuffer&&(R.depthBuffer&&($|=r.DEPTH_BUFFER_BIT),R.stencilBuffer&&R.resolveStencilBuffer&&($|=r.STENCIL_BUFFER_BIT)),it){r.framebufferRenderbuffer(r.READ_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.RENDERBUFFER,bt.__webglColorRenderbuffer[Mt]);const et=n.get(S[Mt]).__webglTexture;r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0,r.TEXTURE_2D,et,0)}r.blitFramebuffer(0,0,z,Y,0,0,z,Y,$,r.NEAREST),l===!0&&(It.length=0,Pt.length=0,It.push(r.COLOR_ATTACHMENT0+Mt),R.depthBuffer&&R.resolveDepthBuffer===!1&&(It.push(q),Pt.push(q),r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,Pt)),r.invalidateFramebuffer(r.READ_FRAMEBUFFER,It))}if(e.bindFramebuffer(r.READ_FRAMEBUFFER,null),e.bindFramebuffer(r.DRAW_FRAMEBUFFER,null),it)for(let Mt=0;Mt<S.length;Mt++){e.bindFramebuffer(r.FRAMEBUFFER,bt.__webglMultisampledFramebuffer),r.framebufferRenderbuffer(r.FRAMEBUFFER,r.COLOR_ATTACHMENT0+Mt,r.RENDERBUFFER,bt.__webglColorRenderbuffer[Mt]);const et=n.get(S[Mt]).__webglTexture;e.bindFramebuffer(r.FRAMEBUFFER,bt.__webglFramebuffer),r.framebufferTexture2D(r.DRAW_FRAMEBUFFER,r.COLOR_ATTACHMENT0+Mt,r.TEXTURE_2D,et,0)}e.bindFramebuffer(r.DRAW_FRAMEBUFFER,bt.__webglMultisampledFramebuffer)}else if(R.depthBuffer&&R.resolveDepthBuffer===!1&&l){const S=R.stencilBuffer?r.DEPTH_STENCIL_ATTACHMENT:r.DEPTH_ATTACHMENT;r.invalidateFramebuffer(r.DRAW_FRAMEBUFFER,[S])}}}function le(R){return Math.min(i.maxSamples,R.samples)}function _t(R){const S=n.get(R);return R.samples>0&&t.has("WEBGL_multisampled_render_to_texture")===!0&&S.__useRenderToTexture!==!1}function zt(R){const S=a.render.frame;h.get(R)!==S&&(h.set(R,S),R.update())}function be(R,S){const z=R.colorSpace,Y=R.format,$=R.type;return R.isCompressedTexture===!0||R.isVideoTexture===!0||z!==Bi&&z!==Bn&&(Xt.getTransfer(z)===$t?(Y!==cn||$!==xn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",z)),S}function pe(R){return typeof HTMLImageElement<"u"&&R instanceof HTMLImageElement?(c.width=R.naturalWidth||R.width,c.height=R.naturalHeight||R.height):typeof VideoFrame<"u"&&R instanceof VideoFrame?(c.width=R.displayWidth,c.height=R.displayHeight):(c.width=R.width,c.height=R.height),c}this.allocateTextureUnit=B,this.resetTextureUnits=F,this.setTexture2D=V,this.setTexture2DArray=X,this.setTexture3D=Z,this.setTextureCube=W,this.rebindTextures=Re,this.setupRenderTarget=D,this.updateRenderTargetMipmap=oe,this.updateMultisampleRenderTarget=gt,this.setupDepthRenderbuffer=qt,this.setupFrameBufferTexture=dt,this.useMultisampledRTT=_t}function e0(r,t){function e(n,i=Bn){let s;const a=Xt.getTransfer(i);if(n===xn)return r.UNSIGNED_BYTE;if(n===ho)return r.UNSIGNED_SHORT_4_4_4_4;if(n===uo)return r.UNSIGNED_SHORT_5_5_5_1;if(n===xc)return r.UNSIGNED_INT_5_9_9_9_REV;if(n===Mc)return r.UNSIGNED_INT_10F_11F_11F_REV;if(n===_c)return r.BYTE;if(n===vc)return r.SHORT;if(n===cs)return r.UNSIGNED_SHORT;if(n===co)return r.INT;if(n===oi)return r.UNSIGNED_INT;if(n===gn)return r.FLOAT;if(n===vn)return r.HALF_FLOAT;if(n===yc)return r.ALPHA;if(n===Sc)return r.RGB;if(n===cn)return r.RGBA;if(n===us)return r.DEPTH_COMPONENT;if(n===fs)return r.DEPTH_STENCIL;if(n===fo)return r.RED;if(n===po)return r.RED_INTEGER;if(n===bc)return r.RG;if(n===mo)return r.RG_INTEGER;if(n===go)return r.RGBA_INTEGER;if(n===$s||n===Js||n===Qs||n===tr)if(a===$t)if(s=t.get("WEBGL_compressed_texture_s3tc_srgb"),s!==null){if(n===$s)return s.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===Js)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===Qs)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===tr)return s.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(s=t.get("WEBGL_compressed_texture_s3tc"),s!==null){if(n===$s)return s.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===Js)return s.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===Qs)return s.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===tr)return s.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===Ta||n===wa||n===Aa||n===Ra)if(s=t.get("WEBGL_compressed_texture_pvrtc"),s!==null){if(n===Ta)return s.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===wa)return s.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===Aa)return s.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===Ra)return s.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===Ca||n===Pa||n===Da)if(s=t.get("WEBGL_compressed_texture_etc"),s!==null){if(n===Ca||n===Pa)return a===$t?s.COMPRESSED_SRGB8_ETC2:s.COMPRESSED_RGB8_ETC2;if(n===Da)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:s.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(n===La||n===Ua||n===Ia||n===Fa||n===Na||n===Oa||n===za||n===Ba||n===ka||n===Va||n===Ha||n===Ga||n===Wa||n===qa)if(s=t.get("WEBGL_compressed_texture_astc"),s!==null){if(n===La)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:s.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===Ua)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:s.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Ia)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:s.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Fa)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:s.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Na)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:s.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Oa)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:s.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===za)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:s.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Ba)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:s.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===ka)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:s.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Va)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:s.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===Ha)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:s.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Ga)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:s.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Wa)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:s.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===qa)return a===$t?s.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:s.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Xa||n===Ya||n===Ka)if(s=t.get("EXT_texture_compression_bptc"),s!==null){if(n===Xa)return a===$t?s.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:s.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Ya)return s.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Ka)return s.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===ja||n===Za||n===$a||n===Ja)if(s=t.get("EXT_texture_compression_rgtc"),s!==null){if(n===ja)return s.COMPRESSED_RED_RGTC1_EXT;if(n===Za)return s.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===$a)return s.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Ja)return s.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===hs?r.UNSIGNED_INT_24_8:r[n]!==void 0?r[n]:null}return{convert:e}}const n0=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,i0=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class s0{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(t,e){if(this.texture===null){const n=new Fc(t.texture);(t.depthNear!==e.depthNear||t.depthFar!==e.depthFar)&&(this.depthNear=t.depthNear,this.depthFar=t.depthFar),this.texture=n}}getMesh(t){if(this.texture!==null&&this.mesh===null){const e=t.cameras[0].viewport,n=new de({vertexShader:n0,fragmentShader:i0,uniforms:{depthColor:{value:this.texture},depthWidth:{value:e.z},depthHeight:{value:e.w}}});this.mesh=new ee(new fi(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class r0 extends Xi{constructor(t,e){super();const n=this;let i=null,s=1,a=null,o="local-floor",l=1,c=null,h=null,u=null,f=null,d=null,g=null;const _=typeof XRWebGLBinding<"u",m=new s0,p={},b=e.getContextAttributes();let E=null,y=null;const w=[],A=[],C=new Tt;let L=null;const M=new Ye;M.viewport=new te;const x=new Ye;x.viewport=new te;const P=[M,x],F=new Eu;let B=null,k=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(K){let J=w[K];return J===void 0&&(J=new Yr,w[K]=J),J.getTargetRaySpace()},this.getControllerGrip=function(K){let J=w[K];return J===void 0&&(J=new Yr,w[K]=J),J.getGripSpace()},this.getHand=function(K){let J=w[K];return J===void 0&&(J=new Yr,w[K]=J),J.getHandSpace()};function V(K){const J=A.indexOf(K.inputSource);if(J===-1)return;const dt=w[J];dt!==void 0&&(dt.update(K.inputSource,K.frame,c||a),dt.dispatchEvent({type:K.type,data:K.inputSource}))}function X(){i.removeEventListener("select",V),i.removeEventListener("selectstart",V),i.removeEventListener("selectend",V),i.removeEventListener("squeeze",V),i.removeEventListener("squeezestart",V),i.removeEventListener("squeezeend",V),i.removeEventListener("end",X),i.removeEventListener("inputsourceschange",Z);for(let K=0;K<w.length;K++){const J=A[K];J!==null&&(A[K]=null,w[K].disconnect(J))}B=null,k=null,m.reset();for(const K in p)delete p[K];t.setRenderTarget(E),d=null,f=null,u=null,i=null,y=null,jt.stop(),n.isPresenting=!1,t.setPixelRatio(L),t.setSize(C.width,C.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(K){s=K,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(K){o=K,n.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||a},this.setReferenceSpace=function(K){c=K},this.getBaseLayer=function(){return f!==null?f:d},this.getBinding=function(){return u===null&&_&&(u=new XRWebGLBinding(i,e)),u},this.getFrame=function(){return g},this.getSession=function(){return i},this.setSession=async function(K){if(i=K,i!==null){if(E=t.getRenderTarget(),i.addEventListener("select",V),i.addEventListener("selectstart",V),i.addEventListener("selectend",V),i.addEventListener("squeeze",V),i.addEventListener("squeezestart",V),i.addEventListener("squeezeend",V),i.addEventListener("end",X),i.addEventListener("inputsourceschange",Z),b.xrCompatible!==!0&&await e.makeXRCompatible(),L=t.getPixelRatio(),t.getSize(C),_&&"createProjectionLayer"in XRWebGLBinding.prototype){let dt=null,Lt=null,Et=null;b.depth&&(Et=b.stencil?e.DEPTH24_STENCIL8:e.DEPTH_COMPONENT24,dt=b.stencil?fs:us,Lt=b.stencil?hs:oi);const qt={colorFormat:e.RGBA8,depthFormat:Et,scaleFactor:s};u=this.getBinding(),f=u.createProjectionLayer(qt),i.updateRenderState({layers:[f]}),t.setPixelRatio(1),t.setSize(f.textureWidth,f.textureHeight,!1),y=new Qe(f.textureWidth,f.textureHeight,{format:cn,type:xn,depthTexture:new Ic(f.textureWidth,f.textureHeight,Lt,void 0,void 0,void 0,void 0,void 0,void 0,dt),stencilBuffer:b.stencil,colorSpace:t.outputColorSpace,samples:b.antialias?4:0,resolveDepthBuffer:f.ignoreDepthValues===!1,resolveStencilBuffer:f.ignoreDepthValues===!1})}else{const dt={antialias:b.antialias,alpha:!0,depth:b.depth,stencil:b.stencil,framebufferScaleFactor:s};d=new XRWebGLLayer(i,e,dt),i.updateRenderState({baseLayer:d}),t.setPixelRatio(1),t.setSize(d.framebufferWidth,d.framebufferHeight,!1),y=new Qe(d.framebufferWidth,d.framebufferHeight,{format:cn,type:xn,colorSpace:t.outputColorSpace,stencilBuffer:b.stencil,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}y.isXRRenderTarget=!0,this.setFoveation(l),c=null,a=await i.requestReferenceSpace(o),jt.setContext(i),jt.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(i!==null)return i.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function Z(K){for(let J=0;J<K.removed.length;J++){const dt=K.removed[J],Lt=A.indexOf(dt);Lt>=0&&(A[Lt]=null,w[Lt].disconnect(dt))}for(let J=0;J<K.added.length;J++){const dt=K.added[J];let Lt=A.indexOf(dt);if(Lt===-1){for(let qt=0;qt<w.length;qt++)if(qt>=A.length){A.push(dt),Lt=qt;break}else if(A[qt]===null){A[qt]=dt,Lt=qt;break}if(Lt===-1)break}const Et=w[Lt];Et&&Et.connect(dt)}}const W=new U,rt=new U;function ct(K,J,dt){W.setFromMatrixPosition(J.matrixWorld),rt.setFromMatrixPosition(dt.matrixWorld);const Lt=W.distanceTo(rt),Et=J.projectionMatrix.elements,qt=dt.projectionMatrix.elements,Re=Et[14]/(Et[10]-1),D=Et[14]/(Et[10]+1),oe=(Et[9]+1)/Et[5],It=(Et[9]-1)/Et[5],Pt=(Et[8]-1)/Et[0],gt=(qt[8]+1)/qt[0],le=Re*Pt,_t=Re*gt,zt=Lt/(-Pt+gt),be=zt*-Pt;if(J.matrixWorld.decompose(K.position,K.quaternion,K.scale),K.translateX(be),K.translateZ(zt),K.matrixWorld.compose(K.position,K.quaternion,K.scale),K.matrixWorldInverse.copy(K.matrixWorld).invert(),Et[10]===-1)K.projectionMatrix.copy(J.projectionMatrix),K.projectionMatrixInverse.copy(J.projectionMatrixInverse);else{const pe=Re+zt,R=D+zt,S=le-be,z=_t+(Lt-be),Y=oe*D/R*pe,$=It*D/R*pe;K.projectionMatrix.makePerspective(S,z,Y,$,pe,R),K.projectionMatrixInverse.copy(K.projectionMatrix).invert()}}function St(K,J){J===null?K.matrixWorld.copy(K.matrix):K.matrixWorld.multiplyMatrices(J.matrixWorld,K.matrix),K.matrixWorldInverse.copy(K.matrixWorld).invert()}this.updateCamera=function(K){if(i===null)return;let J=K.near,dt=K.far;m.texture!==null&&(m.depthNear>0&&(J=m.depthNear),m.depthFar>0&&(dt=m.depthFar)),F.near=x.near=M.near=J,F.far=x.far=M.far=dt,(B!==F.near||k!==F.far)&&(i.updateRenderState({depthNear:F.near,depthFar:F.far}),B=F.near,k=F.far),F.layers.mask=K.layers.mask|6,M.layers.mask=F.layers.mask&3,x.layers.mask=F.layers.mask&5;const Lt=K.parent,Et=F.cameras;St(F,Lt);for(let qt=0;qt<Et.length;qt++)St(Et[qt],Lt);Et.length===2?ct(F,M,x):F.projectionMatrix.copy(M.projectionMatrix),Vt(K,F,Lt)};function Vt(K,J,dt){dt===null?K.matrix.copy(J.matrixWorld):(K.matrix.copy(dt.matrixWorld),K.matrix.invert(),K.matrix.multiply(J.matrixWorld)),K.matrix.decompose(K.position,K.quaternion,K.scale),K.updateMatrixWorld(!0),K.projectionMatrix.copy(J.projectionMatrix),K.projectionMatrixInverse.copy(J.projectionMatrixInverse),K.isPerspectiveCamera&&(K.fov=Qa*2*Math.atan(1/K.projectionMatrix.elements[5]),K.zoom=1)}this.getCamera=function(){return F},this.getFoveation=function(){if(!(f===null&&d===null))return l},this.setFoveation=function(K){l=K,f!==null&&(f.fixedFoveation=K),d!==null&&d.fixedFoveation!==void 0&&(d.fixedFoveation=K)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(F)},this.getCameraTexture=function(K){return p[K]};let ie=null;function ae(K,J){if(h=J.getViewerPose(c||a),g=J,h!==null){const dt=h.views;d!==null&&(t.setRenderTargetFramebuffer(y,d.framebuffer),t.setRenderTarget(y));let Lt=!1;dt.length!==F.cameras.length&&(F.cameras.length=0,Lt=!0);for(let D=0;D<dt.length;D++){const oe=dt[D];let It=null;if(d!==null)It=d.getViewport(oe);else{const gt=u.getViewSubImage(f,oe);It=gt.viewport,D===0&&(t.setRenderTargetTextures(y,gt.colorTexture,gt.depthStencilTexture),t.setRenderTarget(y))}let Pt=P[D];Pt===void 0&&(Pt=new Ye,Pt.layers.enable(D),Pt.viewport=new te,P[D]=Pt),Pt.matrix.fromArray(oe.transform.matrix),Pt.matrix.decompose(Pt.position,Pt.quaternion,Pt.scale),Pt.projectionMatrix.fromArray(oe.projectionMatrix),Pt.projectionMatrixInverse.copy(Pt.projectionMatrix).invert(),Pt.viewport.set(It.x,It.y,It.width,It.height),D===0&&(F.matrix.copy(Pt.matrix),F.matrix.decompose(F.position,F.quaternion,F.scale)),Lt===!0&&F.cameras.push(Pt)}const Et=i.enabledFeatures;if(Et&&Et.includes("depth-sensing")&&i.depthUsage=="gpu-optimized"&&_){u=n.getBinding();const D=u.getDepthInformation(dt[0]);D&&D.isValid&&D.texture&&m.init(D,i.renderState)}if(Et&&Et.includes("camera-access")&&_){t.state.unbindTexture(),u=n.getBinding();for(let D=0;D<dt.length;D++){const oe=dt[D].camera;if(oe){let It=p[oe];It||(It=new Fc,p[oe]=It);const Pt=u.getCameraImage(oe);It.sourceTexture=Pt}}}}for(let dt=0;dt<w.length;dt++){const Lt=A[dt],Et=w[dt];Lt!==null&&Et!==void 0&&Et.update(Lt,J,c||a)}ie&&ie(K,J),J.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:J}),g=null}const jt=new zc;jt.setAnimationLoop(ae),this.setAnimationLoop=function(K){ie=K},this.dispose=function(){}}}const Jn=new hn,a0=new Yt;function o0(r,t){function e(m,p){m.matrixAutoUpdate===!0&&m.updateMatrix(),p.value.copy(m.matrix)}function n(m,p){p.color.getRGB(m.fogColor.value,Dc(r)),p.isFog?(m.fogNear.value=p.near,m.fogFar.value=p.far):p.isFogExp2&&(m.fogDensity.value=p.density)}function i(m,p,b,E,y){p.isMeshBasicMaterial||p.isMeshLambertMaterial?s(m,p):p.isMeshToonMaterial?(s(m,p),u(m,p)):p.isMeshPhongMaterial?(s(m,p),h(m,p)):p.isMeshStandardMaterial?(s(m,p),f(m,p),p.isMeshPhysicalMaterial&&d(m,p,y)):p.isMeshMatcapMaterial?(s(m,p),g(m,p)):p.isMeshDepthMaterial?s(m,p):p.isMeshDistanceMaterial?(s(m,p),_(m,p)):p.isMeshNormalMaterial?s(m,p):p.isLineBasicMaterial?(a(m,p),p.isLineDashedMaterial&&o(m,p)):p.isPointsMaterial?l(m,p,b,E):p.isSpriteMaterial?c(m,p):p.isShadowMaterial?(m.color.value.copy(p.color),m.opacity.value=p.opacity):p.isShaderMaterial&&(p.uniformsNeedUpdate=!1)}function s(m,p){m.opacity.value=p.opacity,p.color&&m.diffuse.value.copy(p.color),p.emissive&&m.emissive.value.copy(p.emissive).multiplyScalar(p.emissiveIntensity),p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.bumpMap&&(m.bumpMap.value=p.bumpMap,e(p.bumpMap,m.bumpMapTransform),m.bumpScale.value=p.bumpScale,p.side===Ue&&(m.bumpScale.value*=-1)),p.normalMap&&(m.normalMap.value=p.normalMap,e(p.normalMap,m.normalMapTransform),m.normalScale.value.copy(p.normalScale),p.side===Ue&&m.normalScale.value.negate()),p.displacementMap&&(m.displacementMap.value=p.displacementMap,e(p.displacementMap,m.displacementMapTransform),m.displacementScale.value=p.displacementScale,m.displacementBias.value=p.displacementBias),p.emissiveMap&&(m.emissiveMap.value=p.emissiveMap,e(p.emissiveMap,m.emissiveMapTransform)),p.specularMap&&(m.specularMap.value=p.specularMap,e(p.specularMap,m.specularMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest);const b=t.get(p),E=b.envMap,y=b.envMapRotation;E&&(m.envMap.value=E,Jn.copy(y),Jn.x*=-1,Jn.y*=-1,Jn.z*=-1,E.isCubeTexture&&E.isRenderTargetTexture===!1&&(Jn.y*=-1,Jn.z*=-1),m.envMapRotation.value.setFromMatrix4(a0.makeRotationFromEuler(Jn)),m.flipEnvMap.value=E.isCubeTexture&&E.isRenderTargetTexture===!1?-1:1,m.reflectivity.value=p.reflectivity,m.ior.value=p.ior,m.refractionRatio.value=p.refractionRatio),p.lightMap&&(m.lightMap.value=p.lightMap,m.lightMapIntensity.value=p.lightMapIntensity,e(p.lightMap,m.lightMapTransform)),p.aoMap&&(m.aoMap.value=p.aoMap,m.aoMapIntensity.value=p.aoMapIntensity,e(p.aoMap,m.aoMapTransform))}function a(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform))}function o(m,p){m.dashSize.value=p.dashSize,m.totalSize.value=p.dashSize+p.gapSize,m.scale.value=p.scale}function l(m,p,b,E){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.size.value=p.size*b,m.scale.value=E*.5,p.map&&(m.map.value=p.map,e(p.map,m.uvTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function c(m,p){m.diffuse.value.copy(p.color),m.opacity.value=p.opacity,m.rotation.value=p.rotation,p.map&&(m.map.value=p.map,e(p.map,m.mapTransform)),p.alphaMap&&(m.alphaMap.value=p.alphaMap,e(p.alphaMap,m.alphaMapTransform)),p.alphaTest>0&&(m.alphaTest.value=p.alphaTest)}function h(m,p){m.specular.value.copy(p.specular),m.shininess.value=Math.max(p.shininess,1e-4)}function u(m,p){p.gradientMap&&(m.gradientMap.value=p.gradientMap)}function f(m,p){m.metalness.value=p.metalness,p.metalnessMap&&(m.metalnessMap.value=p.metalnessMap,e(p.metalnessMap,m.metalnessMapTransform)),m.roughness.value=p.roughness,p.roughnessMap&&(m.roughnessMap.value=p.roughnessMap,e(p.roughnessMap,m.roughnessMapTransform)),p.envMap&&(m.envMapIntensity.value=p.envMapIntensity)}function d(m,p,b){m.ior.value=p.ior,p.sheen>0&&(m.sheenColor.value.copy(p.sheenColor).multiplyScalar(p.sheen),m.sheenRoughness.value=p.sheenRoughness,p.sheenColorMap&&(m.sheenColorMap.value=p.sheenColorMap,e(p.sheenColorMap,m.sheenColorMapTransform)),p.sheenRoughnessMap&&(m.sheenRoughnessMap.value=p.sheenRoughnessMap,e(p.sheenRoughnessMap,m.sheenRoughnessMapTransform))),p.clearcoat>0&&(m.clearcoat.value=p.clearcoat,m.clearcoatRoughness.value=p.clearcoatRoughness,p.clearcoatMap&&(m.clearcoatMap.value=p.clearcoatMap,e(p.clearcoatMap,m.clearcoatMapTransform)),p.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=p.clearcoatRoughnessMap,e(p.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),p.clearcoatNormalMap&&(m.clearcoatNormalMap.value=p.clearcoatNormalMap,e(p.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(p.clearcoatNormalScale),p.side===Ue&&m.clearcoatNormalScale.value.negate())),p.dispersion>0&&(m.dispersion.value=p.dispersion),p.iridescence>0&&(m.iridescence.value=p.iridescence,m.iridescenceIOR.value=p.iridescenceIOR,m.iridescenceThicknessMinimum.value=p.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=p.iridescenceThicknessRange[1],p.iridescenceMap&&(m.iridescenceMap.value=p.iridescenceMap,e(p.iridescenceMap,m.iridescenceMapTransform)),p.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=p.iridescenceThicknessMap,e(p.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),p.transmission>0&&(m.transmission.value=p.transmission,m.transmissionSamplerMap.value=b.texture,m.transmissionSamplerSize.value.set(b.width,b.height),p.transmissionMap&&(m.transmissionMap.value=p.transmissionMap,e(p.transmissionMap,m.transmissionMapTransform)),m.thickness.value=p.thickness,p.thicknessMap&&(m.thicknessMap.value=p.thicknessMap,e(p.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=p.attenuationDistance,m.attenuationColor.value.copy(p.attenuationColor)),p.anisotropy>0&&(m.anisotropyVector.value.set(p.anisotropy*Math.cos(p.anisotropyRotation),p.anisotropy*Math.sin(p.anisotropyRotation)),p.anisotropyMap&&(m.anisotropyMap.value=p.anisotropyMap,e(p.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=p.specularIntensity,m.specularColor.value.copy(p.specularColor),p.specularColorMap&&(m.specularColorMap.value=p.specularColorMap,e(p.specularColorMap,m.specularColorMapTransform)),p.specularIntensityMap&&(m.specularIntensityMap.value=p.specularIntensityMap,e(p.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,p){p.matcap&&(m.matcap.value=p.matcap)}function _(m,p){const b=t.get(p).light;m.referencePosition.value.setFromMatrixPosition(b.matrixWorld),m.nearDistance.value=b.shadow.camera.near,m.farDistance.value=b.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:i}}function l0(r,t,e,n){let i={},s={},a=[];const o=r.getParameter(r.MAX_UNIFORM_BUFFER_BINDINGS);function l(b,E){const y=E.program;n.uniformBlockBinding(b,y)}function c(b,E){let y=i[b.id];y===void 0&&(g(b),y=h(b),i[b.id]=y,b.addEventListener("dispose",m));const w=E.program;n.updateUBOMapping(b,w);const A=t.render.frame;s[b.id]!==A&&(f(b),s[b.id]=A)}function h(b){const E=u();b.__bindingPointIndex=E;const y=r.createBuffer(),w=b.__size,A=b.usage;return r.bindBuffer(r.UNIFORM_BUFFER,y),r.bufferData(r.UNIFORM_BUFFER,w,A),r.bindBuffer(r.UNIFORM_BUFFER,null),r.bindBufferBase(r.UNIFORM_BUFFER,E,y),y}function u(){for(let b=0;b<o;b++)if(a.indexOf(b)===-1)return a.push(b),b;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function f(b){const E=i[b.id],y=b.uniforms,w=b.__cache;r.bindBuffer(r.UNIFORM_BUFFER,E);for(let A=0,C=y.length;A<C;A++){const L=Array.isArray(y[A])?y[A]:[y[A]];for(let M=0,x=L.length;M<x;M++){const P=L[M];if(d(P,A,M,w)===!0){const F=P.__offset,B=Array.isArray(P.value)?P.value:[P.value];let k=0;for(let V=0;V<B.length;V++){const X=B[V],Z=_(X);typeof X=="number"||typeof X=="boolean"?(P.__data[0]=X,r.bufferSubData(r.UNIFORM_BUFFER,F+k,P.__data)):X.isMatrix3?(P.__data[0]=X.elements[0],P.__data[1]=X.elements[1],P.__data[2]=X.elements[2],P.__data[3]=0,P.__data[4]=X.elements[3],P.__data[5]=X.elements[4],P.__data[6]=X.elements[5],P.__data[7]=0,P.__data[8]=X.elements[6],P.__data[9]=X.elements[7],P.__data[10]=X.elements[8],P.__data[11]=0):(X.toArray(P.__data,k),k+=Z.storage/Float32Array.BYTES_PER_ELEMENT)}r.bufferSubData(r.UNIFORM_BUFFER,F,P.__data)}}}r.bindBuffer(r.UNIFORM_BUFFER,null)}function d(b,E,y,w){const A=b.value,C=E+"_"+y;if(w[C]===void 0)return typeof A=="number"||typeof A=="boolean"?w[C]=A:w[C]=A.clone(),!0;{const L=w[C];if(typeof A=="number"||typeof A=="boolean"){if(L!==A)return w[C]=A,!0}else if(L.equals(A)===!1)return L.copy(A),!0}return!1}function g(b){const E=b.uniforms;let y=0;const w=16;for(let C=0,L=E.length;C<L;C++){const M=Array.isArray(E[C])?E[C]:[E[C]];for(let x=0,P=M.length;x<P;x++){const F=M[x],B=Array.isArray(F.value)?F.value:[F.value];for(let k=0,V=B.length;k<V;k++){const X=B[k],Z=_(X),W=y%w,rt=W%Z.boundary,ct=W+rt;y+=rt,ct!==0&&w-ct<Z.storage&&(y+=w-ct),F.__data=new Float32Array(Z.storage/Float32Array.BYTES_PER_ELEMENT),F.__offset=y,y+=Z.storage}}}const A=y%w;return A>0&&(y+=w-A),b.__size=y,b.__cache={},this}function _(b){const E={boundary:0,storage:0};return typeof b=="number"||typeof b=="boolean"?(E.boundary=4,E.storage=4):b.isVector2?(E.boundary=8,E.storage=8):b.isVector3||b.isColor?(E.boundary=16,E.storage=12):b.isVector4?(E.boundary=16,E.storage=16):b.isMatrix3?(E.boundary=48,E.storage=48):b.isMatrix4?(E.boundary=64,E.storage=64):b.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",b),E}function m(b){const E=b.target;E.removeEventListener("dispose",m);const y=a.indexOf(E.__bindingPointIndex);a.splice(y,1),r.deleteBuffer(i[E.id]),delete i[E.id],delete s[E.id]}function p(){for(const b in i)r.deleteBuffer(i[b]);a=[],i={},s={}}return{bind:l,update:c,dispose:p}}class c0{constructor(t={}){const{canvas:e=Nh(),context:n=null,depth:i=!0,stencil:s=!1,alpha:a=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:f=!1}=t;this.isWebGLRenderer=!0;let d;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");d=n.getContextAttributes().alpha}else d=a;const g=new Uint32Array(4),_=new Int32Array(4);let m=null,p=null;const b=[],E=[];this.domElement=e,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=kn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const y=this;let w=!1;this._outputColorSpace=Xe;let A=0,C=0,L=null,M=-1,x=null;const P=new te,F=new te;let B=null;const k=new vt(0);let V=0,X=e.width,Z=e.height,W=1,rt=null,ct=null;const St=new te(0,0,X,Z),Vt=new te(0,0,X,Z);let ie=!1;const ae=new xo;let jt=!1,K=!1;const J=new Yt,dt=new U,Lt=new te,Et={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let qt=!1;function Re(){return L===null?W:1}let D=n;function oe(T,N){return e.getContext(T,N)}try{const T={alpha:!0,depth:i,stencil:s,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in e&&e.setAttribute("data-engine",`three.js r${ao}`),e.addEventListener("webglcontextlost",st,!1),e.addEventListener("webglcontextrestored",ft,!1),e.addEventListener("webglcontextcreationerror",Q,!1),D===null){const N="webgl2";if(D=oe(N,T),D===null)throw oe(N)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(T){throw console.error("THREE.WebGLRenderer: "+T.message),T}let It,Pt,gt,le,_t,zt,be,pe,R,S,z,Y,$,q,bt,it,xt,Mt,et,ht,Ct,yt,ot,Ft;function I(){It=new xp(D),It.init(),yt=new e0(D,It),Pt=new fp(D,It,t,yt),gt=new Qm(D,It),Pt.reversedDepthBuffer&&f&&gt.buffers.depth.setReversed(!0),le=new Sp(D),_t=new km,zt=new t0(D,It,gt,_t,Pt,yt,le),be=new pp(y),pe=new vp(y),R=new Au(D),ot=new hp(D,R),S=new Mp(D,R,le,ot),z=new Ep(D,S,R,le),et=new bp(D,Pt,zt),it=new dp(_t),Y=new Bm(y,be,pe,It,Pt,ot,it),$=new o0(y,_t),q=new Hm,bt=new Km(It),Mt=new cp(y,be,pe,gt,z,d,l),xt=new $m(y,z,Pt),Ft=new l0(D,le,Pt,gt),ht=new up(D,It,le),Ct=new yp(D,It,le),le.programs=Y.programs,y.capabilities=Pt,y.extensions=It,y.properties=_t,y.renderLists=q,y.shadowMap=xt,y.state=gt,y.info=le}I();const nt=new r0(y,D);this.xr=nt,this.getContext=function(){return D},this.getContextAttributes=function(){return D.getContextAttributes()},this.forceContextLoss=function(){const T=It.get("WEBGL_lose_context");T&&T.loseContext()},this.forceContextRestore=function(){const T=It.get("WEBGL_lose_context");T&&T.restoreContext()},this.getPixelRatio=function(){return W},this.setPixelRatio=function(T){T!==void 0&&(W=T,this.setSize(X,Z,!1))},this.getSize=function(T){return T.set(X,Z)},this.setSize=function(T,N,H=!0){if(nt.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}X=T,Z=N,e.width=Math.floor(T*W),e.height=Math.floor(N*W),H===!0&&(e.style.width=T+"px",e.style.height=N+"px"),this.setViewport(0,0,T,N)},this.getDrawingBufferSize=function(T){return T.set(X*W,Z*W).floor()},this.setDrawingBufferSize=function(T,N,H){X=T,Z=N,W=H,e.width=Math.floor(T*H),e.height=Math.floor(N*H),this.setViewport(0,0,T,N)},this.getCurrentViewport=function(T){return T.copy(P)},this.getViewport=function(T){return T.copy(St)},this.setViewport=function(T,N,H,G){T.isVector4?St.set(T.x,T.y,T.z,T.w):St.set(T,N,H,G),gt.viewport(P.copy(St).multiplyScalar(W).round())},this.getScissor=function(T){return T.copy(Vt)},this.setScissor=function(T,N,H,G){T.isVector4?Vt.set(T.x,T.y,T.z,T.w):Vt.set(T,N,H,G),gt.scissor(F.copy(Vt).multiplyScalar(W).round())},this.getScissorTest=function(){return ie},this.setScissorTest=function(T){gt.setScissorTest(ie=T)},this.setOpaqueSort=function(T){rt=T},this.setTransparentSort=function(T){ct=T},this.getClearColor=function(T){return T.copy(Mt.getClearColor())},this.setClearColor=function(){Mt.setClearColor(...arguments)},this.getClearAlpha=function(){return Mt.getClearAlpha()},this.setClearAlpha=function(){Mt.setClearAlpha(...arguments)},this.clear=function(T=!0,N=!0,H=!0){let G=0;if(T){let O=!1;if(L!==null){const tt=L.texture.format;O=tt===go||tt===mo||tt===po}if(O){const tt=L.texture.type,lt=tt===xn||tt===oi||tt===cs||tt===hs||tt===ho||tt===uo,pt=Mt.getClearColor(),ut=Mt.getClearAlpha(),Rt=pt.r,Dt=pt.g,wt=pt.b;lt?(g[0]=Rt,g[1]=Dt,g[2]=wt,g[3]=ut,D.clearBufferuiv(D.COLOR,0,g)):(_[0]=Rt,_[1]=Dt,_[2]=wt,_[3]=ut,D.clearBufferiv(D.COLOR,0,_))}else G|=D.COLOR_BUFFER_BIT}N&&(G|=D.DEPTH_BUFFER_BIT),H&&(G|=D.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),D.clear(G)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){e.removeEventListener("webglcontextlost",st,!1),e.removeEventListener("webglcontextrestored",ft,!1),e.removeEventListener("webglcontextcreationerror",Q,!1),Mt.dispose(),q.dispose(),bt.dispose(),_t.dispose(),be.dispose(),pe.dispose(),z.dispose(),ot.dispose(),Ft.dispose(),Y.dispose(),nt.dispose(),nt.removeEventListener("sessionstart",un),nt.removeEventListener("sessionend",Co),qn.stop()};function st(T){T.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),w=!0}function ft(){console.log("THREE.WebGLRenderer: Context Restored."),w=!1;const T=le.autoReset,N=xt.enabled,H=xt.autoUpdate,G=xt.needsUpdate,O=xt.type;I(),le.autoReset=T,xt.enabled=N,xt.autoUpdate=H,xt.needsUpdate=G,xt.type=O}function Q(T){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",T.statusMessage)}function j(T){const N=T.target;N.removeEventListener("dispose",j),mt(N)}function mt(T){Ut(T),_t.remove(T)}function Ut(T){const N=_t.get(T).programs;N!==void 0&&(N.forEach(function(H){Y.releaseProgram(H)}),T.isShaderMaterial&&Y.releaseShaderCache(T))}this.renderBufferDirect=function(T,N,H,G,O,tt){N===null&&(N=Et);const lt=O.isMesh&&O.matrixWorld.determinant()<0,pt=Kc(T,N,H,G,O);gt.setMaterial(G,lt);let ut=H.index,Rt=1;if(G.wireframe===!0){if(ut=S.getWireframeAttribute(H),ut===void 0)return;Rt=2}const Dt=H.drawRange,wt=H.attributes.position;let Gt=Dt.start*Rt,Qt=(Dt.start+Dt.count)*Rt;tt!==null&&(Gt=Math.max(Gt,tt.start*Rt),Qt=Math.min(Qt,(tt.start+tt.count)*Rt)),ut!==null?(Gt=Math.max(Gt,0),Qt=Math.min(Qt,ut.count)):wt!=null&&(Gt=Math.max(Gt,0),Qt=Math.min(Qt,wt.count));const ue=Qt-Gt;if(ue<0||ue===1/0)return;ot.setup(O,G,pt,H,ut);let re,ne=ht;if(ut!==null&&(re=R.get(ut),ne=Ct,ne.setIndex(re)),O.isMesh)G.wireframe===!0?(gt.setLineWidth(G.wireframeLinewidth*Re()),ne.setMode(D.LINES)):ne.setMode(D.TRIANGLES);else if(O.isLine){let At=G.linewidth;At===void 0&&(At=1),gt.setLineWidth(At*Re()),O.isLineSegments?ne.setMode(D.LINES):O.isLineLoop?ne.setMode(D.LINE_LOOP):ne.setMode(D.LINE_STRIP)}else O.isPoints?ne.setMode(D.POINTS):O.isSprite&&ne.setMode(D.TRIANGLES);if(O.isBatchedMesh)if(O._multiDrawInstances!==null)ds("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),ne.renderMultiDrawInstances(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount,O._multiDrawInstances);else if(It.get("WEBGL_multi_draw"))ne.renderMultiDraw(O._multiDrawStarts,O._multiDrawCounts,O._multiDrawCount);else{const At=O._multiDrawStarts,ce=O._multiDrawCounts,Kt=O._multiDrawCount,He=ut?R.get(ut).bytesPerElement:1,di=_t.get(G).currentProgram.getUniforms();for(let Ge=0;Ge<Kt;Ge++)di.setValue(D,"_gl_DrawID",Ge),ne.render(At[Ge]/He,ce[Ge])}else if(O.isInstancedMesh)ne.renderInstances(Gt,ue,O.count);else if(H.isInstancedBufferGeometry){const At=H._maxInstanceCount!==void 0?H._maxInstanceCount:1/0,ce=Math.min(H.instanceCount,At);ne.renderInstances(Gt,ue,ce)}else ne.render(Gt,ue)};function se(T,N,H){T.transparent===!0&&T.side===Le&&T.forceSinglePass===!1?(T.side=Ue,T.needsUpdate=!0,Ms(T,N,H),T.side=Vn,T.needsUpdate=!0,Ms(T,N,H),T.side=Le):Ms(T,N,H)}this.compile=function(T,N,H=null){H===null&&(H=T),p=bt.get(H),p.init(N),E.push(p),H.traverseVisible(function(O){O.isLight&&O.layers.test(N.layers)&&(p.pushLight(O),O.castShadow&&p.pushShadow(O))}),T!==H&&T.traverseVisible(function(O){O.isLight&&O.layers.test(N.layers)&&(p.pushLight(O),O.castShadow&&p.pushShadow(O))}),p.setupLights();const G=new Set;return T.traverse(function(O){if(!(O.isMesh||O.isPoints||O.isLine||O.isSprite))return;const tt=O.material;if(tt)if(Array.isArray(tt))for(let lt=0;lt<tt.length;lt++){const pt=tt[lt];se(pt,H,O),G.add(pt)}else se(tt,H,O),G.add(tt)}),p=E.pop(),G},this.compileAsync=function(T,N,H=null){const G=this.compile(T,N,H);return new Promise(O=>{function tt(){if(G.forEach(function(lt){_t.get(lt).currentProgram.isReady()&&G.delete(lt)}),G.size===0){O(T);return}setTimeout(tt,10)}It.get("KHR_parallel_shader_compile")!==null?tt():setTimeout(tt,10)})};let Zt=null;function Mn(T){Zt&&Zt(T)}function un(){qn.stop()}function Co(){qn.start()}const qn=new zc;qn.setAnimationLoop(Mn),typeof self<"u"&&qn.setContext(self),this.setAnimationLoop=function(T){Zt=T,nt.setAnimationLoop(T),T===null?qn.stop():qn.start()},nt.addEventListener("sessionstart",un),nt.addEventListener("sessionend",Co),this.render=function(T,N){if(N!==void 0&&N.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(w===!0)return;if(T.matrixWorldAutoUpdate===!0&&T.updateMatrixWorld(),N.parent===null&&N.matrixWorldAutoUpdate===!0&&N.updateMatrixWorld(),nt.enabled===!0&&nt.isPresenting===!0&&(nt.cameraAutoUpdate===!0&&nt.updateCamera(N),N=nt.getCamera()),T.isScene===!0&&T.onBeforeRender(y,T,N,L),p=bt.get(T,E.length),p.init(N),E.push(p),J.multiplyMatrices(N.projectionMatrix,N.matrixWorldInverse),ae.setFromProjectionMatrix(J,_n,N.reversedDepth),K=this.localClippingEnabled,jt=it.init(this.clippingPlanes,K),m=q.get(T,b.length),m.init(),b.push(m),nt.enabled===!0&&nt.isPresenting===!0){const tt=y.xr.getDepthSensingMesh();tt!==null&&Sr(tt,N,-1/0,y.sortObjects)}Sr(T,N,0,y.sortObjects),m.finish(),y.sortObjects===!0&&m.sort(rt,ct),qt=nt.enabled===!1||nt.isPresenting===!1||nt.hasDepthSensing()===!1,qt&&Mt.addToRenderList(m,T),this.info.render.frame++,jt===!0&&it.beginShadows();const H=p.state.shadowsArray;xt.render(H,T,N),jt===!0&&it.endShadows(),this.info.autoReset===!0&&this.info.reset();const G=m.opaque,O=m.transmissive;if(p.setupLights(),N.isArrayCamera){const tt=N.cameras;if(O.length>0)for(let lt=0,pt=tt.length;lt<pt;lt++){const ut=tt[lt];Do(G,O,T,ut)}qt&&Mt.render(T);for(let lt=0,pt=tt.length;lt<pt;lt++){const ut=tt[lt];Po(m,T,ut,ut.viewport)}}else O.length>0&&Do(G,O,T,N),qt&&Mt.render(T),Po(m,T,N);L!==null&&C===0&&(zt.updateMultisampleRenderTarget(L),zt.updateRenderTargetMipmap(L)),T.isScene===!0&&T.onAfterRender(y,T,N),ot.resetDefaultState(),M=-1,x=null,E.pop(),E.length>0?(p=E[E.length-1],jt===!0&&it.setGlobalState(y.clippingPlanes,p.state.camera)):p=null,b.pop(),b.length>0?m=b[b.length-1]:m=null};function Sr(T,N,H,G){if(T.visible===!1)return;if(T.layers.test(N.layers)){if(T.isGroup)H=T.renderOrder;else if(T.isLOD)T.autoUpdate===!0&&T.update(N);else if(T.isLight)p.pushLight(T),T.castShadow&&p.pushShadow(T);else if(T.isSprite){if(!T.frustumCulled||ae.intersectsSprite(T)){G&&Lt.setFromMatrixPosition(T.matrixWorld).applyMatrix4(J);const lt=z.update(T),pt=T.material;pt.visible&&m.push(T,lt,pt,H,Lt.z,null)}}else if((T.isMesh||T.isLine||T.isPoints)&&(!T.frustumCulled||ae.intersectsObject(T))){const lt=z.update(T),pt=T.material;if(G&&(T.boundingSphere!==void 0?(T.boundingSphere===null&&T.computeBoundingSphere(),Lt.copy(T.boundingSphere.center)):(lt.boundingSphere===null&&lt.computeBoundingSphere(),Lt.copy(lt.boundingSphere.center)),Lt.applyMatrix4(T.matrixWorld).applyMatrix4(J)),Array.isArray(pt)){const ut=lt.groups;for(let Rt=0,Dt=ut.length;Rt<Dt;Rt++){const wt=ut[Rt],Gt=pt[wt.materialIndex];Gt&&Gt.visible&&m.push(T,lt,Gt,H,Lt.z,wt)}}else pt.visible&&m.push(T,lt,pt,H,Lt.z,null)}}const tt=T.children;for(let lt=0,pt=tt.length;lt<pt;lt++)Sr(tt[lt],N,H,G)}function Po(T,N,H,G){const O=T.opaque,tt=T.transmissive,lt=T.transparent;p.setupLightsView(H),jt===!0&&it.setGlobalState(y.clippingPlanes,H),G&&gt.viewport(P.copy(G)),O.length>0&&xs(O,N,H),tt.length>0&&xs(tt,N,H),lt.length>0&&xs(lt,N,H),gt.buffers.depth.setTest(!0),gt.buffers.depth.setMask(!0),gt.buffers.color.setMask(!0),gt.setPolygonOffset(!1)}function Do(T,N,H,G){if((H.isScene===!0?H.overrideMaterial:null)!==null)return;p.state.transmissionRenderTarget[G.id]===void 0&&(p.state.transmissionRenderTarget[G.id]=new Qe(1,1,{generateMipmaps:!0,type:It.has("EXT_color_buffer_half_float")||It.has("EXT_color_buffer_float")?vn:xn,minFilter:ri,samples:4,stencilBuffer:s,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Xt.workingColorSpace}));const tt=p.state.transmissionRenderTarget[G.id],lt=G.viewport||P;tt.setSize(lt.z*y.transmissionResolutionScale,lt.w*y.transmissionResolutionScale);const pt=y.getRenderTarget(),ut=y.getActiveCubeFace(),Rt=y.getActiveMipmapLevel();y.setRenderTarget(tt),y.getClearColor(k),V=y.getClearAlpha(),V<1&&y.setClearColor(16777215,.5),y.clear(),qt&&Mt.render(H);const Dt=y.toneMapping;y.toneMapping=kn;const wt=G.viewport;if(G.viewport!==void 0&&(G.viewport=void 0),p.setupLightsView(G),jt===!0&&it.setGlobalState(y.clippingPlanes,G),xs(T,H,G),zt.updateMultisampleRenderTarget(tt),zt.updateRenderTargetMipmap(tt),It.has("WEBGL_multisampled_render_to_texture")===!1){let Gt=!1;for(let Qt=0,ue=N.length;Qt<ue;Qt++){const re=N[Qt],ne=re.object,At=re.geometry,ce=re.material,Kt=re.group;if(ce.side===Le&&ne.layers.test(G.layers)){const He=ce.side;ce.side=Ue,ce.needsUpdate=!0,Lo(ne,H,G,At,ce,Kt),ce.side=He,ce.needsUpdate=!0,Gt=!0}}Gt===!0&&(zt.updateMultisampleRenderTarget(tt),zt.updateRenderTargetMipmap(tt))}y.setRenderTarget(pt,ut,Rt),y.setClearColor(k,V),wt!==void 0&&(G.viewport=wt),y.toneMapping=Dt}function xs(T,N,H){const G=N.isScene===!0?N.overrideMaterial:null;for(let O=0,tt=T.length;O<tt;O++){const lt=T[O],pt=lt.object,ut=lt.geometry,Rt=lt.group;let Dt=lt.material;Dt.allowOverride===!0&&G!==null&&(Dt=G),pt.layers.test(H.layers)&&Lo(pt,N,H,ut,Dt,Rt)}}function Lo(T,N,H,G,O,tt){T.onBeforeRender(y,N,H,G,O,tt),T.modelViewMatrix.multiplyMatrices(H.matrixWorldInverse,T.matrixWorld),T.normalMatrix.getNormalMatrix(T.modelViewMatrix),O.onBeforeRender(y,N,H,G,T,tt),O.transparent===!0&&O.side===Le&&O.forceSinglePass===!1?(O.side=Ue,O.needsUpdate=!0,y.renderBufferDirect(H,N,G,O,T,tt),O.side=Vn,O.needsUpdate=!0,y.renderBufferDirect(H,N,G,O,T,tt),O.side=Le):y.renderBufferDirect(H,N,G,O,T,tt),T.onAfterRender(y,N,H,G,O,tt)}function Ms(T,N,H){N.isScene!==!0&&(N=Et);const G=_t.get(T),O=p.state.lights,tt=p.state.shadowsArray,lt=O.state.version,pt=Y.getParameters(T,O.state,tt,N,H),ut=Y.getProgramCacheKey(pt);let Rt=G.programs;G.environment=T.isMeshStandardMaterial?N.environment:null,G.fog=N.fog,G.envMap=(T.isMeshStandardMaterial?pe:be).get(T.envMap||G.environment),G.envMapRotation=G.environment!==null&&T.envMap===null?N.environmentRotation:T.envMapRotation,Rt===void 0&&(T.addEventListener("dispose",j),Rt=new Map,G.programs=Rt);let Dt=Rt.get(ut);if(Dt!==void 0){if(G.currentProgram===Dt&&G.lightsStateVersion===lt)return Io(T,pt),Dt}else pt.uniforms=Y.getUniforms(T),T.onBeforeCompile(pt,y),Dt=Y.acquireProgram(pt,ut),Rt.set(ut,Dt),G.uniforms=pt.uniforms;const wt=G.uniforms;return(!T.isShaderMaterial&&!T.isRawShaderMaterial||T.clipping===!0)&&(wt.clippingPlanes=it.uniform),Io(T,pt),G.needsLights=Zc(T),G.lightsStateVersion=lt,G.needsLights&&(wt.ambientLightColor.value=O.state.ambient,wt.lightProbe.value=O.state.probe,wt.directionalLights.value=O.state.directional,wt.directionalLightShadows.value=O.state.directionalShadow,wt.spotLights.value=O.state.spot,wt.spotLightShadows.value=O.state.spotShadow,wt.rectAreaLights.value=O.state.rectArea,wt.ltc_1.value=O.state.rectAreaLTC1,wt.ltc_2.value=O.state.rectAreaLTC2,wt.pointLights.value=O.state.point,wt.pointLightShadows.value=O.state.pointShadow,wt.hemisphereLights.value=O.state.hemi,wt.directionalShadowMap.value=O.state.directionalShadowMap,wt.directionalShadowMatrix.value=O.state.directionalShadowMatrix,wt.spotShadowMap.value=O.state.spotShadowMap,wt.spotLightMatrix.value=O.state.spotLightMatrix,wt.spotLightMap.value=O.state.spotLightMap,wt.pointShadowMap.value=O.state.pointShadowMap,wt.pointShadowMatrix.value=O.state.pointShadowMatrix),G.currentProgram=Dt,G.uniformsList=null,Dt}function Uo(T){if(T.uniformsList===null){const N=T.currentProgram.getUniforms();T.uniformsList=er.seqWithValue(N.seq,T.uniforms)}return T.uniformsList}function Io(T,N){const H=_t.get(T);H.outputColorSpace=N.outputColorSpace,H.batching=N.batching,H.batchingColor=N.batchingColor,H.instancing=N.instancing,H.instancingColor=N.instancingColor,H.instancingMorph=N.instancingMorph,H.skinning=N.skinning,H.morphTargets=N.morphTargets,H.morphNormals=N.morphNormals,H.morphColors=N.morphColors,H.morphTargetsCount=N.morphTargetsCount,H.numClippingPlanes=N.numClippingPlanes,H.numIntersection=N.numClipIntersection,H.vertexAlphas=N.vertexAlphas,H.vertexTangents=N.vertexTangents,H.toneMapping=N.toneMapping}function Kc(T,N,H,G,O){N.isScene!==!0&&(N=Et),zt.resetTextureUnits();const tt=N.fog,lt=G.isMeshStandardMaterial?N.environment:null,pt=L===null?y.outputColorSpace:L.isXRRenderTarget===!0?L.texture.colorSpace:Bi,ut=(G.isMeshStandardMaterial?pe:be).get(G.envMap||lt),Rt=G.vertexColors===!0&&!!H.attributes.color&&H.attributes.color.itemSize===4,Dt=!!H.attributes.tangent&&(!!G.normalMap||G.anisotropy>0),wt=!!H.morphAttributes.position,Gt=!!H.morphAttributes.normal,Qt=!!H.morphAttributes.color;let ue=kn;G.toneMapped&&(L===null||L.isXRRenderTarget===!0)&&(ue=y.toneMapping);const re=H.morphAttributes.position||H.morphAttributes.normal||H.morphAttributes.color,ne=re!==void 0?re.length:0,At=_t.get(G),ce=p.state.lights;if(jt===!0&&(K===!0||T!==x)){const Fe=T===x&&G.id===M;it.setState(G,T,Fe)}let Kt=!1;G.version===At.__version?(At.needsLights&&At.lightsStateVersion!==ce.state.version||At.outputColorSpace!==pt||O.isBatchedMesh&&At.batching===!1||!O.isBatchedMesh&&At.batching===!0||O.isBatchedMesh&&At.batchingColor===!0&&O.colorTexture===null||O.isBatchedMesh&&At.batchingColor===!1&&O.colorTexture!==null||O.isInstancedMesh&&At.instancing===!1||!O.isInstancedMesh&&At.instancing===!0||O.isSkinnedMesh&&At.skinning===!1||!O.isSkinnedMesh&&At.skinning===!0||O.isInstancedMesh&&At.instancingColor===!0&&O.instanceColor===null||O.isInstancedMesh&&At.instancingColor===!1&&O.instanceColor!==null||O.isInstancedMesh&&At.instancingMorph===!0&&O.morphTexture===null||O.isInstancedMesh&&At.instancingMorph===!1&&O.morphTexture!==null||At.envMap!==ut||G.fog===!0&&At.fog!==tt||At.numClippingPlanes!==void 0&&(At.numClippingPlanes!==it.numPlanes||At.numIntersection!==it.numIntersection)||At.vertexAlphas!==Rt||At.vertexTangents!==Dt||At.morphTargets!==wt||At.morphNormals!==Gt||At.morphColors!==Qt||At.toneMapping!==ue||At.morphTargetsCount!==ne)&&(Kt=!0):(Kt=!0,At.__version=G.version);let He=At.currentProgram;Kt===!0&&(He=Ms(G,N,O));let di=!1,Ge=!1,ji=!1;const he=He.getUniforms(),je=At.uniforms;if(gt.useProgram(He.program)&&(di=!0,Ge=!0,ji=!0),G.id!==M&&(M=G.id,Ge=!0),di||x!==T){gt.buffers.depth.getReversed()&&T.reversedDepth!==!0&&(T._reversedDepth=!0,T.updateProjectionMatrix()),he.setValue(D,"projectionMatrix",T.projectionMatrix),he.setValue(D,"viewMatrix",T.matrixWorldInverse);const Oe=he.map.cameraPosition;Oe!==void 0&&Oe.setValue(D,dt.setFromMatrixPosition(T.matrixWorld)),Pt.logarithmicDepthBuffer&&he.setValue(D,"logDepthBufFC",2/(Math.log(T.far+1)/Math.LN2)),(G.isMeshPhongMaterial||G.isMeshToonMaterial||G.isMeshLambertMaterial||G.isMeshBasicMaterial||G.isMeshStandardMaterial||G.isShaderMaterial)&&he.setValue(D,"isOrthographic",T.isOrthographicCamera===!0),x!==T&&(x=T,Ge=!0,ji=!0)}if(O.isSkinnedMesh){he.setOptional(D,O,"bindMatrix"),he.setOptional(D,O,"bindMatrixInverse");const Fe=O.skeleton;Fe&&(Fe.boneTexture===null&&Fe.computeBoneTexture(),he.setValue(D,"boneTexture",Fe.boneTexture,zt))}O.isBatchedMesh&&(he.setOptional(D,O,"batchingTexture"),he.setValue(D,"batchingTexture",O._matricesTexture,zt),he.setOptional(D,O,"batchingIdTexture"),he.setValue(D,"batchingIdTexture",O._indirectTexture,zt),he.setOptional(D,O,"batchingColorTexture"),O._colorsTexture!==null&&he.setValue(D,"batchingColorTexture",O._colorsTexture,zt));const Ze=H.morphAttributes;if((Ze.position!==void 0||Ze.normal!==void 0||Ze.color!==void 0)&&et.update(O,H,He),(Ge||At.receiveShadow!==O.receiveShadow)&&(At.receiveShadow=O.receiveShadow,he.setValue(D,"receiveShadow",O.receiveShadow)),G.isMeshGouraudMaterial&&G.envMap!==null&&(je.envMap.value=ut,je.flipEnvMap.value=ut.isCubeTexture&&ut.isRenderTargetTexture===!1?-1:1),G.isMeshStandardMaterial&&G.envMap===null&&N.environment!==null&&(je.envMapIntensity.value=N.environmentIntensity),Ge&&(he.setValue(D,"toneMappingExposure",y.toneMappingExposure),At.needsLights&&jc(je,ji),tt&&G.fog===!0&&$.refreshFogUniforms(je,tt),$.refreshMaterialUniforms(je,G,W,Z,p.state.transmissionRenderTarget[T.id]),er.upload(D,Uo(At),je,zt)),G.isShaderMaterial&&G.uniformsNeedUpdate===!0&&(er.upload(D,Uo(At),je,zt),G.uniformsNeedUpdate=!1),G.isSpriteMaterial&&he.setValue(D,"center",O.center),he.setValue(D,"modelViewMatrix",O.modelViewMatrix),he.setValue(D,"normalMatrix",O.normalMatrix),he.setValue(D,"modelMatrix",O.matrixWorld),G.isShaderMaterial||G.isRawShaderMaterial){const Fe=G.uniformsGroups;for(let Oe=0,br=Fe.length;Oe<br;Oe++){const Xn=Fe[Oe];Ft.update(Xn,He),Ft.bind(Xn,He)}}return He}function jc(T,N){T.ambientLightColor.needsUpdate=N,T.lightProbe.needsUpdate=N,T.directionalLights.needsUpdate=N,T.directionalLightShadows.needsUpdate=N,T.pointLights.needsUpdate=N,T.pointLightShadows.needsUpdate=N,T.spotLights.needsUpdate=N,T.spotLightShadows.needsUpdate=N,T.rectAreaLights.needsUpdate=N,T.hemisphereLights.needsUpdate=N}function Zc(T){return T.isMeshLambertMaterial||T.isMeshToonMaterial||T.isMeshPhongMaterial||T.isMeshStandardMaterial||T.isShadowMaterial||T.isShaderMaterial&&T.lights===!0}this.getActiveCubeFace=function(){return A},this.getActiveMipmapLevel=function(){return C},this.getRenderTarget=function(){return L},this.setRenderTargetTextures=function(T,N,H){const G=_t.get(T);G.__autoAllocateDepthBuffer=T.resolveDepthBuffer===!1,G.__autoAllocateDepthBuffer===!1&&(G.__useRenderToTexture=!1),_t.get(T.texture).__webglTexture=N,_t.get(T.depthTexture).__webglTexture=G.__autoAllocateDepthBuffer?void 0:H,G.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(T,N){const H=_t.get(T);H.__webglFramebuffer=N,H.__useDefaultFramebuffer=N===void 0};const $c=D.createFramebuffer();this.setRenderTarget=function(T,N=0,H=0){L=T,A=N,C=H;let G=!0,O=null,tt=!1,lt=!1;if(T){const ut=_t.get(T);if(ut.__useDefaultFramebuffer!==void 0)gt.bindFramebuffer(D.FRAMEBUFFER,null),G=!1;else if(ut.__webglFramebuffer===void 0)zt.setupRenderTarget(T);else if(ut.__hasExternalTextures)zt.rebindTextures(T,_t.get(T.texture).__webglTexture,_t.get(T.depthTexture).__webglTexture);else if(T.depthBuffer){const wt=T.depthTexture;if(ut.__boundDepthTexture!==wt){if(wt!==null&&_t.has(wt)&&(T.width!==wt.image.width||T.height!==wt.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");zt.setupDepthRenderbuffer(T)}}const Rt=T.texture;(Rt.isData3DTexture||Rt.isDataArrayTexture||Rt.isCompressedArrayTexture)&&(lt=!0);const Dt=_t.get(T).__webglFramebuffer;T.isWebGLCubeRenderTarget?(Array.isArray(Dt[N])?O=Dt[N][H]:O=Dt[N],tt=!0):T.samples>0&&zt.useMultisampledRTT(T)===!1?O=_t.get(T).__webglMultisampledFramebuffer:Array.isArray(Dt)?O=Dt[H]:O=Dt,P.copy(T.viewport),F.copy(T.scissor),B=T.scissorTest}else P.copy(St).multiplyScalar(W).floor(),F.copy(Vt).multiplyScalar(W).floor(),B=ie;if(H!==0&&(O=$c),gt.bindFramebuffer(D.FRAMEBUFFER,O)&&G&&gt.drawBuffers(T,O),gt.viewport(P),gt.scissor(F),gt.setScissorTest(B),tt){const ut=_t.get(T.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_CUBE_MAP_POSITIVE_X+N,ut.__webglTexture,H)}else if(lt){const ut=N;for(let Rt=0;Rt<T.textures.length;Rt++){const Dt=_t.get(T.textures[Rt]);D.framebufferTextureLayer(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0+Rt,Dt.__webglTexture,H,ut)}}else if(T!==null&&H!==0){const ut=_t.get(T.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,ut.__webglTexture,H)}M=-1},this.readRenderTargetPixels=function(T,N,H,G,O,tt,lt,pt=0){if(!(T&&T.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let ut=_t.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&lt!==void 0&&(ut=ut[lt]),ut){gt.bindFramebuffer(D.FRAMEBUFFER,ut);try{const Rt=T.textures[pt],Dt=Rt.format,wt=Rt.type;if(!Pt.textureFormatReadable(Dt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!Pt.textureTypeReadable(wt)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}N>=0&&N<=T.width-G&&H>=0&&H<=T.height-O&&(T.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+pt),D.readPixels(N,H,G,O,yt.convert(Dt),yt.convert(wt),tt))}finally{const Rt=L!==null?_t.get(L).__webglFramebuffer:null;gt.bindFramebuffer(D.FRAMEBUFFER,Rt)}}},this.readRenderTargetPixelsAsync=async function(T,N,H,G,O,tt,lt,pt=0){if(!(T&&T.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let ut=_t.get(T).__webglFramebuffer;if(T.isWebGLCubeRenderTarget&&lt!==void 0&&(ut=ut[lt]),ut)if(N>=0&&N<=T.width-G&&H>=0&&H<=T.height-O){gt.bindFramebuffer(D.FRAMEBUFFER,ut);const Rt=T.textures[pt],Dt=Rt.format,wt=Rt.type;if(!Pt.textureFormatReadable(Dt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!Pt.textureTypeReadable(wt))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Gt=D.createBuffer();D.bindBuffer(D.PIXEL_PACK_BUFFER,Gt),D.bufferData(D.PIXEL_PACK_BUFFER,tt.byteLength,D.STREAM_READ),T.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+pt),D.readPixels(N,H,G,O,yt.convert(Dt),yt.convert(wt),0);const Qt=L!==null?_t.get(L).__webglFramebuffer:null;gt.bindFramebuffer(D.FRAMEBUFFER,Qt);const ue=D.fenceSync(D.SYNC_GPU_COMMANDS_COMPLETE,0);return D.flush(),await Oh(D,ue,4),D.bindBuffer(D.PIXEL_PACK_BUFFER,Gt),D.getBufferSubData(D.PIXEL_PACK_BUFFER,0,tt),D.deleteBuffer(Gt),D.deleteSync(ue),tt}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(T,N=null,H=0){const G=Math.pow(2,-H),O=Math.floor(T.image.width*G),tt=Math.floor(T.image.height*G),lt=N!==null?N.x:0,pt=N!==null?N.y:0;zt.setTexture2D(T,0),D.copyTexSubImage2D(D.TEXTURE_2D,H,0,0,lt,pt,O,tt),gt.unbindTexture()};const Jc=D.createFramebuffer(),Qc=D.createFramebuffer();this.copyTextureToTexture=function(T,N,H=null,G=null,O=0,tt=null){tt===null&&(O!==0?(ds("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),tt=O,O=0):tt=0);let lt,pt,ut,Rt,Dt,wt,Gt,Qt,ue;const re=T.isCompressedTexture?T.mipmaps[tt]:T.image;if(H!==null)lt=H.max.x-H.min.x,pt=H.max.y-H.min.y,ut=H.isBox3?H.max.z-H.min.z:1,Rt=H.min.x,Dt=H.min.y,wt=H.isBox3?H.min.z:0;else{const Ze=Math.pow(2,-O);lt=Math.floor(re.width*Ze),pt=Math.floor(re.height*Ze),T.isDataArrayTexture?ut=re.depth:T.isData3DTexture?ut=Math.floor(re.depth*Ze):ut=1,Rt=0,Dt=0,wt=0}G!==null?(Gt=G.x,Qt=G.y,ue=G.z):(Gt=0,Qt=0,ue=0);const ne=yt.convert(N.format),At=yt.convert(N.type);let ce;N.isData3DTexture?(zt.setTexture3D(N,0),ce=D.TEXTURE_3D):N.isDataArrayTexture||N.isCompressedArrayTexture?(zt.setTexture2DArray(N,0),ce=D.TEXTURE_2D_ARRAY):(zt.setTexture2D(N,0),ce=D.TEXTURE_2D),D.pixelStorei(D.UNPACK_FLIP_Y_WEBGL,N.flipY),D.pixelStorei(D.UNPACK_PREMULTIPLY_ALPHA_WEBGL,N.premultiplyAlpha),D.pixelStorei(D.UNPACK_ALIGNMENT,N.unpackAlignment);const Kt=D.getParameter(D.UNPACK_ROW_LENGTH),He=D.getParameter(D.UNPACK_IMAGE_HEIGHT),di=D.getParameter(D.UNPACK_SKIP_PIXELS),Ge=D.getParameter(D.UNPACK_SKIP_ROWS),ji=D.getParameter(D.UNPACK_SKIP_IMAGES);D.pixelStorei(D.UNPACK_ROW_LENGTH,re.width),D.pixelStorei(D.UNPACK_IMAGE_HEIGHT,re.height),D.pixelStorei(D.UNPACK_SKIP_PIXELS,Rt),D.pixelStorei(D.UNPACK_SKIP_ROWS,Dt),D.pixelStorei(D.UNPACK_SKIP_IMAGES,wt);const he=T.isDataArrayTexture||T.isData3DTexture,je=N.isDataArrayTexture||N.isData3DTexture;if(T.isDepthTexture){const Ze=_t.get(T),Fe=_t.get(N),Oe=_t.get(Ze.__renderTarget),br=_t.get(Fe.__renderTarget);gt.bindFramebuffer(D.READ_FRAMEBUFFER,Oe.__webglFramebuffer),gt.bindFramebuffer(D.DRAW_FRAMEBUFFER,br.__webglFramebuffer);for(let Xn=0;Xn<ut;Xn++)he&&(D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,_t.get(T).__webglTexture,O,wt+Xn),D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,_t.get(N).__webglTexture,tt,ue+Xn)),D.blitFramebuffer(Rt,Dt,lt,pt,Gt,Qt,lt,pt,D.DEPTH_BUFFER_BIT,D.NEAREST);gt.bindFramebuffer(D.READ_FRAMEBUFFER,null),gt.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else if(O!==0||T.isRenderTargetTexture||_t.has(T)){const Ze=_t.get(T),Fe=_t.get(N);gt.bindFramebuffer(D.READ_FRAMEBUFFER,Jc),gt.bindFramebuffer(D.DRAW_FRAMEBUFFER,Qc);for(let Oe=0;Oe<ut;Oe++)he?D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,Ze.__webglTexture,O,wt+Oe):D.framebufferTexture2D(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,Ze.__webglTexture,O),je?D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,Fe.__webglTexture,tt,ue+Oe):D.framebufferTexture2D(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,Fe.__webglTexture,tt),O!==0?D.blitFramebuffer(Rt,Dt,lt,pt,Gt,Qt,lt,pt,D.COLOR_BUFFER_BIT,D.NEAREST):je?D.copyTexSubImage3D(ce,tt,Gt,Qt,ue+Oe,Rt,Dt,lt,pt):D.copyTexSubImage2D(ce,tt,Gt,Qt,Rt,Dt,lt,pt);gt.bindFramebuffer(D.READ_FRAMEBUFFER,null),gt.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else je?T.isDataTexture||T.isData3DTexture?D.texSubImage3D(ce,tt,Gt,Qt,ue,lt,pt,ut,ne,At,re.data):N.isCompressedArrayTexture?D.compressedTexSubImage3D(ce,tt,Gt,Qt,ue,lt,pt,ut,ne,re.data):D.texSubImage3D(ce,tt,Gt,Qt,ue,lt,pt,ut,ne,At,re):T.isDataTexture?D.texSubImage2D(D.TEXTURE_2D,tt,Gt,Qt,lt,pt,ne,At,re.data):T.isCompressedTexture?D.compressedTexSubImage2D(D.TEXTURE_2D,tt,Gt,Qt,re.width,re.height,ne,re.data):D.texSubImage2D(D.TEXTURE_2D,tt,Gt,Qt,lt,pt,ne,At,re);D.pixelStorei(D.UNPACK_ROW_LENGTH,Kt),D.pixelStorei(D.UNPACK_IMAGE_HEIGHT,He),D.pixelStorei(D.UNPACK_SKIP_PIXELS,di),D.pixelStorei(D.UNPACK_SKIP_ROWS,Ge),D.pixelStorei(D.UNPACK_SKIP_IMAGES,ji),tt===0&&N.generateMipmaps&&D.generateMipmap(ce),gt.unbindTexture()},this.initRenderTarget=function(T){_t.get(T).__webglFramebuffer===void 0&&zt.setupRenderTarget(T)},this.initTexture=function(T){T.isCubeTexture?zt.setTextureCube(T,0):T.isData3DTexture?zt.setTexture3D(T,0):T.isDataArrayTexture||T.isCompressedArrayTexture?zt.setTexture2DArray(T,0):zt.setTexture2D(T,0),gt.unbindTexture()},this.resetState=function(){A=0,C=0,L=null,gt.reset(),ot.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return _n}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(t){this._outputColorSpace=t;const e=this.getContext();e.drawingBufferColorSpace=Xt._getDrawingBufferColorSpace(t),e.unpackColorSpace=Xt._getUnpackColorSpace()}}class _s{constructor(t=2654435769){v(this,"s");this.s=t>>>0}next(){this.s=this.s+1831565813>>>0;let t=this.s;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}range(t,e){return t+(e-t)*this.next()}int(t,e){return Math.floor(t+(e-t+1)*this.next())|0}bool(t=.5){return this.next()<t}pick(t){return t[Math.min(t.length-1,Math.floor(this.next()*t.length))]}reset(t){this.s=t>>>0}}const Be=(r,t,e)=>r<t?t:r>e?e:r,zn=(r,t,e,n)=>t+(r-t)*Math.exp(-e*n),h0=7,u0=420;class f0{constructor(t,e,n){v(this,"target",new U(0,3,0));v(this,"azimuth",.72);v(this,"elevation",.46);v(this,"distance",220);v(this,"gAz",.72);v(this,"gEl",.46);v(this,"gDist",220);v(this,"gTarget",new U(0,3,0));v(this,"minDistance",42);v(this,"maxDistance",460);v(this,"minElevation",.06);v(this,"maxElevation",1.32);v(this,"panLimit",96);v(this,"enabled",!0);v(this,"pointers",new Map);v(this,"pinchDist",0);v(this,"pinchMid",new Tt);v(this,"keys",new Set);v(this,"ray",new Tu);v(this,"plane",new On(new U(0,1,0),-.02));v(this,"ndc",new Tt);v(this,"hit",new U);v(this,"disposers",[]);this.camera=t,this.dom=e,this.cb=n,this.bind(),this.apply(1e-4)}bind(){const t=(e,n,i,s)=>{e.addEventListener(n,i,s),this.disposers.push(()=>e.removeEventListener(n,i,s))};t(this.dom,"pointerdown",e=>this.onDown(e)),t(this.dom,"pointermove",e=>this.onMove(e)),t(this.dom,"pointerup",e=>this.onUp(e)),t(this.dom,"pointercancel",e=>this.onUp(e)),t(this.dom,"pointerleave",()=>{this.pointers.size===0&&this.cb.onHover(null)}),t(this.dom,"wheel",e=>this.onWheel(e),{passive:!1}),t(this.dom,"contextmenu",e=>e.preventDefault()),t(window,"keydown",e=>this.onKey(e,!0)),t(window,"keyup",e=>this.onKey(e,!1)),t(window,"blur",()=>this.keys.clear())}dispose(){for(const t of this.disposers)t();this.disposers.length=0,this.pointers.clear(),this.keys.clear()}onKey(t,e){const n=t.code;if(n==="Escape"){e&&this.cb.onCancel();return}(n==="KeyW"||n==="KeyA"||n==="KeyS"||n==="KeyD"||n==="ArrowUp"||n==="ArrowDown"||n==="ArrowLeft"||n==="ArrowRight")&&(e?this.keys.add(n):this.keys.delete(n),n.startsWith("Arrow")&&t.preventDefault())}onDown(t){this.enabled&&(this.cb.onGesture(),this.dom.setPointerCapture?.(t.pointerId),this.pointers.set(t.pointerId,{id:t.pointerId,x:t.clientX,y:t.clientY,sx:t.clientX,sy:t.clientY,button:t.button,t:performance.now(),moved:!1}),this.pointers.size===2&&this.beginPinch())}beginPinch(){const[t,e]=[...this.pointers.values()];this.pinchDist=Math.hypot(t.x-e.x,t.y-e.y),this.pinchMid.set((t.x+e.x)/2,(t.y+e.y)/2);for(const n of this.pointers.values())n.moved=!0}onMove(t){if(!this.enabled)return;const e=this.pointers.get(t.pointerId);if(!e){t.pointerType!=="touch"&&this.emitHover(t);return}const n=t.clientX-e.x,i=t.clientY-e.y;if(e.x=t.clientX,e.y=t.clientY,Math.hypot(t.clientX-e.sx,t.clientY-e.sy)>h0&&(e.moved=!0),this.pointers.size>=2){const[s,a]=[...this.pointers.values()],o=Math.hypot(s.x-a.x,s.y-a.y),l=(s.x+a.x)/2,c=(s.y+a.y)/2;this.pinchDist>0&&this.zoom((this.pinchDist-o)*9),this.pan(l-this.pinchMid.x,c-this.pinchMid.y),this.pinchDist=o,this.pinchMid.set(l,c);return}e.button===2||e.button===1?this.pan(n,i):this.orbit(n,i),t.pointerType!=="touch"&&this.emitHover(t)}onUp(t){const e=this.pointers.get(t.pointerId);if(this.pointers.delete(t.pointerId),this.pointers.size<2&&(this.pinchDist=0),!e||!this.enabled)return;const n=performance.now()-e.t<u0;!e.moved&&n&&(e.button===2?this.cb.onCancel():e.button===0&&this.groundAt(t.clientX,t.clientY)&&this.cb.onTap(this.hit.clone())),t.pointerType==="touch"&&this.cb.onHover(null)}onWheel(t){this.enabled&&(t.preventDefault(),this.cb.onGesture(),this.zoom(t.deltaMode===1?t.deltaY*18:t.deltaY))}emitHover(t){this.cb.onHover(this.groundAt(t.clientX,t.clientY)?this.hit.clone():null)}orbit(t,e){this.gAz-=t*.0045,this.gEl=Be(this.gEl+e*.0045,this.minElevation,this.maxElevation)}pan(t,e){const n=this.gDist*.0016/Math.max(.3,Math.cos(this.gEl)),i=Math.sin(this.gAz),s=Math.cos(this.gAz),a=s,o=-i,l=i,c=s;this.gTarget.x+=(-t*a+e*l)*n,this.gTarget.z+=(-t*o+e*c)*n,this.gTarget.x=Be(this.gTarget.x,-this.panLimit,this.panLimit),this.gTarget.z=Be(this.gTarget.z,-this.panLimit,this.panLimit)}zoom(t){this.gDist=Be(this.gDist*Math.exp(t*.0011),this.minDistance,this.maxDistance)}steerVector(t){let e=0,n=0;if((this.keys.has("KeyW")||this.keys.has("ArrowUp"))&&(e+=1),(this.keys.has("KeyS")||this.keys.has("ArrowDown"))&&(e-=1),(this.keys.has("KeyD")||this.keys.has("ArrowRight"))&&(n+=1),(this.keys.has("KeyA")||this.keys.has("ArrowLeft"))&&(n-=1),e===0&&n===0)return t.set(0,0);const i=Math.sin(this.azimuth),s=Math.cos(this.azimuth),a=-e*i+n*s,o=-e*s-n*i;return t.set(a,o).normalize()}get steering(){return this.keys.size>0}groundAt(t,e){const n=this.dom.getBoundingClientRect();if(this.ndc.set((t-n.left)/n.width*2-1,-((e-n.top)/n.height*2-1)),this.ray.setFromCamera(this.ndc,this.camera),!this.ray.ray.intersectPlane(this.plane,this.hit))return!1;const s=260;return Math.abs(this.hit.x)<s&&Math.abs(this.hit.z)<s}update(t){this.apply(t)}apply(t){this.azimuth=zn(this.azimuth,this.gAz,14,t),this.elevation=zn(this.elevation,this.gEl,14,t),this.distance=zn(this.distance,this.gDist,14,t),this.target.x=zn(this.target.x,this.gTarget.x,14,t),this.target.y=zn(this.target.y,this.gTarget.y,14,t),this.target.z=zn(this.target.z,this.gTarget.z,14,t);const n=Math.cos(this.elevation),i=Math.sin(this.elevation);this.camera.position.set(this.target.x+this.distance*n*Math.sin(this.azimuth),this.target.y+this.distance*i,this.target.z+this.distance*n*Math.cos(this.azimuth)),this.camera.lookAt(this.target)}reset(){this.gAz=.72,this.gEl=.46,this.gDist=220,this.gTarget.set(0,3,0)}}const nr={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class Ki{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const d0=new To(-1,1,1,-1,0,1);class p0 extends xe{constructor(){super(),this.setAttribute("position",new Jt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new Jt([0,2,0,0,2,0],2))}}const m0=new p0;class Ao{constructor(t){this._mesh=new ee(m0,t)}dispose(){this._mesh.geometry.dispose()}render(t){t.render(this._mesh,d0)}get material(){return this._mesh.material}set material(t){this._mesh.material=t}}class ir extends Ki{constructor(t,e="tDiffuse"){super(),this.textureID=e,this.uniforms=null,this.material=null,t instanceof de?(this.uniforms=t.uniforms,this.material=t):t&&(this.uniforms=ps.clone(t.uniforms),this.material=new de({name:t.name!==void 0?t.name:"unspecified",defines:Object.assign({},t.defines),uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader})),this._fsQuad=new Ao(this.material)}render(t,e,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this._fsQuad.render(t))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class Wl extends Ki{constructor(t,e){super(),this.scene=t,this.camera=e,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(t,e,n){const i=t.getContext(),s=t.state;s.buffers.color.setMask(!1),s.buffers.depth.setMask(!1),s.buffers.color.setLocked(!0),s.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),s.buffers.stencil.setTest(!0),s.buffers.stencil.setOp(i.REPLACE,i.REPLACE,i.REPLACE),s.buffers.stencil.setFunc(i.ALWAYS,a,4294967295),s.buffers.stencil.setClear(o),s.buffers.stencil.setLocked(!0),t.setRenderTarget(n),this.clear&&t.clear(),t.render(this.scene,this.camera),t.setRenderTarget(e),this.clear&&t.clear(),t.render(this.scene,this.camera),s.buffers.color.setLocked(!1),s.buffers.depth.setLocked(!1),s.buffers.color.setMask(!0),s.buffers.depth.setMask(!0),s.buffers.stencil.setLocked(!1),s.buffers.stencil.setFunc(i.EQUAL,1,4294967295),s.buffers.stencil.setOp(i.KEEP,i.KEEP,i.KEEP),s.buffers.stencil.setLocked(!0)}}class g0 extends Ki{constructor(){super(),this.needsSwap=!1}render(t){t.state.buffers.stencil.setLocked(!1),t.state.buffers.stencil.setTest(!1)}}class _0{constructor(t,e){if(this.renderer=t,this._pixelRatio=t.getPixelRatio(),e===void 0){const n=t.getSize(new Tt);this._width=n.width,this._height=n.height,e=new Qe(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:vn}),e.texture.name="EffectComposer.rt1"}else this._width=e.width,this._height=e.height;this.renderTarget1=e,this.renderTarget2=e.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new ir(nr),this.copyPass.material.blending=An,this.clock=new Oc}swapBuffers(){const t=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=t}addPass(t){this.passes.push(t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(t,e){this.passes.splice(e,0,t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(t){const e=this.passes.indexOf(t);e!==-1&&this.passes.splice(e,1)}isLastEnabledPass(t){for(let e=t+1;e<this.passes.length;e++)if(this.passes[e].enabled)return!1;return!0}render(t){t===void 0&&(t=this.clock.getDelta());const e=this.renderer.getRenderTarget();let n=!1;for(let i=0,s=this.passes.length;i<s;i++){const a=this.passes[i];if(a.enabled!==!1){if(a.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i),a.render(this.renderer,this.writeBuffer,this.readBuffer,t,n),a.needsSwap){if(n){const o=this.renderer.getContext(),l=this.renderer.state.buffers.stencil;l.setFunc(o.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,t),l.setFunc(o.EQUAL,1,4294967295)}this.swapBuffers()}Wl!==void 0&&(a instanceof Wl?n=!0:a instanceof g0&&(n=!1))}}this.renderer.setRenderTarget(e)}reset(t){if(t===void 0){const e=this.renderer.getSize(new Tt);this._pixelRatio=this.renderer.getPixelRatio(),this._width=e.width,this._height=e.height,t=this.renderTarget1.clone(),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=t,this.renderTarget2=t.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(t,e){this._width=t,this._height=e;const n=this._width*this._pixelRatio,i=this._height*this._pixelRatio;this.renderTarget1.setSize(n,i),this.renderTarget2.setSize(n,i);for(let s=0;s<this.passes.length;s++)this.passes[s].setSize(n,i)}setPixelRatio(t){this._pixelRatio=t,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class v0 extends Ki{constructor(t,e,n=null,i=null,s=null){super(),this.scene=t,this.camera=e,this.overrideMaterial=n,this.clearColor=i,this.clearAlpha=s,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new vt}render(t,e,n){const i=t.autoClear;t.autoClear=!1;let s,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(t.getClearColor(this._oldClearColor),t.setClearColor(this.clearColor,t.getClearAlpha())),this.clearAlpha!==null&&(s=t.getClearAlpha(),t.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&t.clearDepth(),t.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),t.render(this.scene,this.camera),this.clearColor!==null&&t.setClearColor(this._oldClearColor),this.clearAlpha!==null&&t.setClearAlpha(s),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),t.autoClear=i}}const x0={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new vt(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class Hi extends Ki{constructor(t,e=1,n,i){super(),this.strength=e,this.radius=n,this.threshold=i,this.resolution=t!==void 0?new Tt(t.x,t.y):new Tt(256,256),this.clearColor=new vt(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let s=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);this.renderTargetBright=new Qe(s,a,{type:vn}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let h=0;h<this.nMips;h++){const u=new Qe(s,a,{type:vn});u.texture.name="UnrealBloomPass.h"+h,u.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(u);const f=new Qe(s,a,{type:vn});f.texture.name="UnrealBloomPass.v"+h,f.texture.generateMipmaps=!1,this.renderTargetsVertical.push(f),s=Math.round(s/2),a=Math.round(a/2)}const o=x0;this.highPassUniforms=ps.clone(o.uniforms),this.highPassUniforms.luminosityThreshold.value=i,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new de({uniforms:this.highPassUniforms,vertexShader:o.vertexShader,fragmentShader:o.fragmentShader}),this.separableBlurMaterials=[];const l=[3,5,7,9,11];s=Math.round(this.resolution.x/2),a=Math.round(this.resolution.y/2);for(let h=0;h<this.nMips;h++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(l[h])),this.separableBlurMaterials[h].uniforms.invSize.value=new Tt(1/s,1/a),s=Math.round(s/2),a=Math.round(a/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=e,this.compositeMaterial.uniforms.bloomRadius.value=.1;const c=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=c,this.bloomTintColors=[new U(1,1,1),new U(1,1,1),new U(1,1,1),new U(1,1,1),new U(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=ps.clone(nr.uniforms),this.blendMaterial=new de({uniforms:this.copyUniforms,vertexShader:nr.vertexShader,fragmentShader:nr.fragmentShader,blending:en,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new vt,this._oldClearAlpha=1,this._basic=new Wn,this._fsQuad=new Ao(null)}dispose(){for(let t=0;t<this.renderTargetsHorizontal.length;t++)this.renderTargetsHorizontal[t].dispose();for(let t=0;t<this.renderTargetsVertical.length;t++)this.renderTargetsVertical[t].dispose();this.renderTargetBright.dispose();for(let t=0;t<this.separableBlurMaterials.length;t++)this.separableBlurMaterials[t].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(t,e){let n=Math.round(t/2),i=Math.round(e/2);this.renderTargetBright.setSize(n,i);for(let s=0;s<this.nMips;s++)this.renderTargetsHorizontal[s].setSize(n,i),this.renderTargetsVertical[s].setSize(n,i),this.separableBlurMaterials[s].uniforms.invSize.value=new Tt(1/n,1/i),n=Math.round(n/2),i=Math.round(i/2)}render(t,e,n,i,s){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();const a=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),s&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=n.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=n.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let o=this.renderTargetBright;for(let l=0;l<this.nMips;l++)this._fsQuad.material=this.separableBlurMaterials[l],this.separableBlurMaterials[l].uniforms.colorTexture.value=o.texture,this.separableBlurMaterials[l].uniforms.direction.value=Hi.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[l]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[l].uniforms.colorTexture.value=this.renderTargetsHorizontal[l].texture,this.separableBlurMaterials[l].uniforms.direction.value=Hi.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[l]),t.clear(),this._fsQuad.render(t),o=this.renderTargetsVertical[l];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,s&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(n),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=a}_getSeparableBlurMaterial(t){const e=[];for(let n=0;n<t;n++)e.push(.39894*Math.exp(-.5*n*n/(t*t))/t);return new de({defines:{KERNEL_RADIUS:t},uniforms:{colorTexture:{value:null},invSize:{value:new Tt(.5,.5)},direction:{value:new Tt(.5,.5)},gaussianCoefficients:{value:e}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}_getCompositeMaterial(t){return new de({defines:{NUM_MIPS:t},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}Hi.BlurDirectionX=new Tt(1,0);Hi.BlurDirectionY=new Tt(0,1);const Ys={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class M0 extends Ki{constructor(){super(),this.uniforms=ps.clone(Ys.uniforms),this.material=new _u({name:Ys.name,uniforms:this.uniforms,vertexShader:Ys.vertexShader,fragmentShader:Ys.fragmentShader}),this._fsQuad=new Ao(this.material),this._outputColorSpace=null,this._toneMapping=null}render(t,e,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=t.toneMappingExposure,(this._outputColorSpace!==t.outputColorSpace||this._toneMapping!==t.toneMapping)&&(this._outputColorSpace=t.outputColorSpace,this._toneMapping=t.toneMapping,this.material.defines={},Xt.getTransfer(this._outputColorSpace)===$t&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===hc?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===uc?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===fc?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===dc?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===mc?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===lo?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===pc&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this._fsQuad.render(t))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}const Gc=`
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`,ql={name:"TiltShiftShader",uniforms:{tDiffuse:{value:null},uResolution:{value:new Tt(1,1)},uDirection:{value:new Tt(1,0)},uStrength:{value:0},uFocusCenter:{value:.5},uFocusRange:{value:.3},uFocusFeather:{value:.34}},vertexShader:Gc,fragmentShader:`
uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform vec2 uDirection;
uniform float uStrength;
uniform float uFocusCenter;
uniform float uFocusRange;
uniform float uFocusFeather;

varying vec2 vUv;

// 13-tap gaussian (sigma = 3.0), normalised: W0 + 2 * (W1 + ... + W6) == 1.0
const float W0 = 0.136966;
const float W1 = 0.129646;
const float W2 = 0.109720;
const float W3 = 0.083108;
const float W4 = 0.056332;
const float W5 = 0.034167;
const float W6 = 0.018544;

void main() {
  vec4 centerSample = texture2D( tDiffuse, vUv );

  // Distance from the sharp band, remapped through the feather ramp.
  float d = abs( vUv.y - uFocusCenter );
  float m = smoothstep( uFocusRange, uFocusRange + max( uFocusFeather, 1e-4 ), d );
  float radius = uStrength * m;

  // Cheap early-out: sub-pixel radius is visually identical to the centre tap.
  if ( radius < 0.05 ) {
    gl_FragColor = vec4( centerSample.rgb, 1.0 );
    return;
  }

  // One texel step scaled to the requested pixel radius, along the pass direction.
  vec2 step1 = ( uDirection / uResolution ) * radius;

  vec3 sum = centerSample.rgb * W0;

  sum += texture2D( tDiffuse, vUv + step1 * 1.0 ).rgb * W1;
  sum += texture2D( tDiffuse, vUv - step1 * 1.0 ).rgb * W1;
  sum += texture2D( tDiffuse, vUv + step1 * 2.0 ).rgb * W2;
  sum += texture2D( tDiffuse, vUv - step1 * 2.0 ).rgb * W2;
  sum += texture2D( tDiffuse, vUv + step1 * 3.0 ).rgb * W3;
  sum += texture2D( tDiffuse, vUv - step1 * 3.0 ).rgb * W3;
  sum += texture2D( tDiffuse, vUv + step1 * 4.0 ).rgb * W4;
  sum += texture2D( tDiffuse, vUv - step1 * 4.0 ).rgb * W4;
  sum += texture2D( tDiffuse, vUv + step1 * 5.0 ).rgb * W5;
  sum += texture2D( tDiffuse, vUv - step1 * 5.0 ).rgb * W5;
  sum += texture2D( tDiffuse, vUv + step1 * 6.0 ).rgb * W6;
  sum += texture2D( tDiffuse, vUv - step1 * 6.0 ).rgb * W6;

  gl_FragColor = vec4( sum, 1.0 );
}
`},y0={name:"GradeShader",uniforms:{tDiffuse:{value:null},uExposure:{value:1},uSaturation:{value:1.15},uContrast:{value:1.05},uVignette:{value:.35},uFlashColor:{value:new vt(1,1,1)},uFlashAmount:{value:0},uTint:{value:new vt(1,1,1)}},vertexShader:Gc,fragmentShader:`
uniform sampler2D tDiffuse;
uniform float uExposure;
uniform float uSaturation;
uniform float uContrast;
uniform float uVignette;
uniform vec3 uFlashColor;
uniform float uFlashAmount;
uniform vec3 uTint;

varying vec2 vUv;

void main() {
  // Exposure + tint.
  vec3 c = texture2D( tDiffuse, vUv ).rgb * uExposure * uTint;

  // Saturation around perceptual luminance.
  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );
  c = mix( vec3( l ), c, uSaturation );

  // Contrast / lift around mid grey.
  c = ( c - 0.5 ) * uContrast + 0.5;

  // Radial vignette, blended by strength.
  float v = smoothstep( 0.98, 0.28, length( vUv - 0.5 ) );
  c *= mix( 1.0, v, uVignette );

  // Additive screen flash (explosions, lightning, hits).
  c += uFlashColor * uFlashAmount;

  gl_FragColor = vec4( clamp( c, 0.0, 8.0 ), 1.0 );
}
`};class S0{constructor(t,e){v(this,"horizontal");v(this,"vertical");v(this,"_amount",0);this.horizontal=t,this.vertical=e,this.horizontal.uDirection.value.set(1,0),this.vertical.uDirection.value.set(0,1),this.setAmount(this._amount)}setAmount(t){const e=Math.min(1,Math.max(0,t));this._amount=e;const n=e*e*9,i=.3-.13*e,s=.34-.12*e;this.horizontal.uStrength.value=n,this.horizontal.uFocusRange.value=i,this.horizontal.uFocusFeather.value=s,this.horizontal.uDirection.value.set(1,0),this.vertical.uStrength.value=n,this.vertical.uFocusRange.value=i,this.vertical.uFocusFeather.value=s,this.vertical.uDirection.value.set(0,1)}setResolution(t,e){const n=Math.max(1,t),i=Math.max(1,e);this.horizontal.uResolution.value.set(n,i),this.vertical.uResolution.value.set(n,i)}get amount(){return this._amount}}const b0={2:{msaa:4,shadows:!0,shadowSize:2048,bloom:!0,debrisCap:2400,chunkCap:2600,sparkCap:4200,smokeCap:3e3,pedCount:230,carCount:64,cloudCount:26,eventDebris:190},1:{msaa:0,shadows:!0,shadowSize:1024,bloom:!0,debrisCap:1400,chunkCap:1600,sparkCap:2600,smokeCap:1800,pedCount:150,carCount:44,cloudCount:18,eventDebris:130},0:{msaa:0,shadows:!1,shadowSize:512,bloom:!1,debrisCap:750,chunkCap:900,sparkCap:1400,smokeCap:950,pedCount:90,carCount:28,cloudCount:12,eventDebris:80}};function E0(){const r=navigator.userAgent,t=(navigator.maxTouchPoints??0)>1;return/Android|iPhone|iPad|iPod|Mobile|Silk/i.test(r)||t&&window.innerWidth<900}function T0(){const r=navigator.hardwareConcurrency??4,t=navigator.deviceMemory??0;return E0()?r>=8?1:0:r<=4||t&&t<=4?1:2}function w0(){const r=T0(),t=r===2?1.75:r===1?1.4:1.1;return{tier:r,pixelRatio:Math.min(window.devicePixelRatio||1,t),...b0[r]}}class A0{constructor(t){v(this,"acc",0);v(this,"frames",0);v(this,"slowStreak",0);v(this,"downgrades",0);v(this,"fps",60);this.onDowngrade=t}update(t){if(this.acc+=t,this.frames++,this.acc<.5)return;this.fps=this.frames/this.acc;const e=this.fps;this.acc=0,this.frames=0,!(this.downgrades>=2)&&(e<34?(this.slowStreak++,this.slowStreak>=6&&(this.slowStreak=0,this.downgrades++,this.onDowngrade(this.downgrades))):e>48&&(this.slowStreak=Math.max(0,this.slowStreak-1)))}}class R0{constructor(t){v(this,"renderer");v(this,"scene",new ou);v(this,"camera");v(this,"composer");v(this,"quality");v(this,"tilt");v(this,"grade");v(this,"governor");v(this,"timeScale",1);v(this,"bloom",null);v(this,"raf",0);v(this,"clock",new Oc);v(this,"observer",null);v(this,"lastW",0);v(this,"lastH",0);v(this,"lastDpr",0);v(this,"updaters",[]);v(this,"lastRealDt",1/60);v(this,"resize",()=>{const t=Math.max(1,this.container.clientWidth),e=Math.max(1,this.container.clientHeight),n=this.quality.pixelRatio;t===this.lastW&&e===this.lastH&&n===this.lastDpr||(this.lastW=t,this.lastH=e,this.lastDpr=n,this.renderer.setPixelRatio(n),this.renderer.setSize(t,e,!1),this.camera.aspect=t/e,this.camera.fov=t/e<.85?44:32,this.camera.updateProjectionMatrix(),this.composer.setPixelRatio(n),this.composer.setSize(t,e),this.tilt.setResolution(t*n,e*n),this.bloom&&this.bloom.setSize(t*n,e*n))});this.container=t,this.quality=w0(),this.renderer=new c0({antialias:!1,alpha:!1,powerPreference:"high-performance",stencil:!1}),this.renderer.setClearColor(12575999,1),this.renderer.toneMapping=lo,this.renderer.toneMappingExposure=1,this.renderer.shadowMap.enabled=this.quality.shadows,this.renderer.shadowMap.type=cc,this.renderer.shadowMap.autoUpdate=this.quality.shadows,t.appendChild(this.renderer.domElement),this.camera=new Ye(32,1,.6,1900),this.camera.position.set(102,126,131);const e=this.quality.pixelRatio,n=Math.max(1,t.clientWidth),i=Math.max(1,t.clientHeight),s=new Qe(Math.round(n*e),Math.round(i*e),{type:vn,samples:this.quality.msaa,depthBuffer:!0,stencilBuffer:!1});this.composer=new _0(this.renderer,s),this.composer.addPass(new v0(this.scene,this.camera)),this.quality.bloom&&(this.bloom=new Hi(new Tt(n,i),.48,.62,1),this.composer.addPass(this.bloom));const a=new ir(ql),o=new ir(ql);this.composer.addPass(a),this.composer.addPass(o),this.tilt=new S0(a.uniforms,o.uniforms),this.tilt.setAmount(.45);const l=new ir(y0);this.composer.addPass(l),this.grade=l.uniforms,this.composer.addPass(new M0),this.governor=new A0(c=>this.downgrade(c)),window.addEventListener("resize",this.resize),window.addEventListener("orientationchange",this.resize),typeof ResizeObserver<"u"&&(this.observer=new ResizeObserver(()=>this.resize()),this.observer.observe(t)),window.visualViewport?.addEventListener("resize",this.resize),this.renderer.domElement.addEventListener("webglcontextlost",c=>{c.preventDefault(),console.warn("[sandbox] WebGL context lost")}),this.resize()}get fps(){return this.governor.fps}get realDelta(){return this.lastRealDt}onUpdate(t){this.updaters.push(t)}frame(t,e=!0){const n=Math.min(Math.max(t,0),.05);this.lastRealDt=n;const i=n*this.timeScale;this.governor.update(n);for(const s of this.updaters)s(n,i);e&&this.composer.render(n)}start(){if(this.raf)return;this.clock.start();const t=()=>{this.raf=requestAnimationFrame(t),this.frame(this.clock.getDelta())};this.raf=requestAnimationFrame(t)}stop(){this.raf&&cancelAnimationFrame(this.raf),this.raf=0}downgrade(t){const e=this.quality;t===1?(e.pixelRatio=Math.max(.72,e.pixelRatio*.78),this.bloom&&(this.bloom.enabled=!1,e.bloom=!1),e.sparkCap=Math.round(e.sparkCap*.6),e.smokeCap=Math.round(e.smokeCap*.6),e.eventDebris=Math.round(e.eventDebris*.65)):(e.pixelRatio=Math.max(.6,e.pixelRatio*.82),e.shadows=!1,this.renderer.shadowMap.enabled=!1,this.renderer.shadowMap.autoUpdate=!1,e.eventDebris=Math.round(e.eventDebris*.7)),this.resize(),console.info(`[sandbox] quality downgraded (step ${t})`)}setTiltAmount(t){this.tilt.setAmount(t)}captureDataURL(){const t=this.renderer.getContext(),e=this.renderer.domElement.width,n=this.renderer.domElement.height,i=new Uint8Array(e*n*4);t.readPixels(0,0,e,n,t.RGBA,t.UNSIGNED_BYTE,i);const s=document.createElement("canvas");s.width=e,s.height=n;const a=s.getContext("2d");if(!a)return"";const o=a.createImageData(e,n),l=e*4;for(let c=0;c<n;c++){const h=(n-1-c)*l;o.data.set(i.subarray(h,h+l),c*l)}return a.putImageData(o,0,0),s.toDataURL("image/png")}setPixelRatio(t){this.quality.pixelRatio=t,this.resize()}}class yr{constructor(t,e){v(this,"sustained",!1);this.id=t,this.ctx=e}get running(){return!1}stop(){}steer(t,e){}update(t,e){}reset(){}runningHint(){return""}}class C0 extends yr{constructor(t){super("blast",t)}trigger(t,e,n){const i=this.ctx.sandbox,s=9*n,a=s*.2;i.audio.explosion(n),i.screen.shake(.3+n*.22),i.screen.flash(16764810,.34*n,6.5),i.damageSphere(t,a,e,s,{radius:s,force:25*n,debris:999,scorch:.75,up:.55,jagged:.55}),i.explosionFx(t,a,e,s,16757847),i.shock.sphere(t,a,e,s*.2,s*.8,.26,16774096,2.2,1,1),i.decals.scorch(t,e,s*1.15,1),i.blastEntities(t,e,s,n),i.addFire(t,1.2,e,s*.45,2.6,1),i.smokeColumn(t,2,e,12,s*.3,2.2)}}class P0 extends yr{constructor(e){super("meteor",e);v(this,"rocks",[]);const n=new fr(1,0),i=new fr(1.5,1);for(let s=0;s<3;s++){const a=new ee(n,new tn({color:3811872,emissive:5250048,emissiveIntensity:1})),o=new ee(i,new Wn({color:16742954,transparent:!0,opacity:.6,blending:en,depthWrite:!1}));a.add(o),a.visible=!1,a.frustumCulled=!1,e.sandbox.engine.scene.add(a),this.rocks.push({mesh:a,glow:o,active:!1,t:0,dur:1,from:new U,to:new U,power:1})}}trigger(e,n,i){const s=this.ctx.sandbox;let a=this.rocks.find(c=>!c.active);a||(a=this.rocks[0]),a.active=!0,a.t=0,a.dur=1.25,a.power=i;const o=Math.random()*Math.PI*2;a.from.set(e+Math.cos(o)*90,210,n+Math.sin(o)*90),a.to.set(e,1.5,n);const l=1.4+i*1.5;a.mesh.scale.setScalar(l),a.mesh.position.copy(a.from),a.mesh.visible=!0,s.audio.meteorWhoosh(a.dur),s.crowd.panic(e,n,22*i),this.ctx.message("陨石接近中…")}update(e,n){const i=this.ctx.sandbox;for(const s of this.rocks){if(!s.active)continue;s.t+=n;const a=Math.min(1,s.t/s.dur),o=a*a;s.mesh.position.lerpVectors(s.from,s.to,o),s.mesh.rotation.x+=n*6,s.mesh.rotation.y+=n*4.5,s.glow.material.opacity=.45+Math.random()*.35;const l=s.mesh.position.x,c=s.mesh.position.y,h=s.mesh.position.z;i.fire(l,c,h,5,1.6+s.power,.85),i.smokeColumn(l,c,h,2,1.4,1.6),i.sparkBurst(l,c,h,3,6,16756838),a>=1&&(s.active=!1,s.mesh.visible=!1,this.impact(s.to.x,s.to.z,s.power))}}impact(e,n,i){const s=this.ctx.sandbox,a=15*i;s.audio.explosion(i*1.8),s.screen.shake(.55+i*.4),s.screen.flash(16756848,.55*i,4.4),s.screen.kickExposure(1.25),s.damageSphere(e,a*.16,n,a,{radius:a,force:33*i,debris:999,scorch:.9,up:.75,jagged:.6}),s.explosionFx(e,a*.2,n,a*1.1,16747066),s.shock.sphere(e,a*.15,n,a*.25,a*1.5,.5,16767392,2,1,.85),s.shock.ring(e,.32,n,a*.4,a*3,.9,16769712,1.2),s.shock.ring(e,.34,n,a*.2,a*2.1,.55,16751178,1),s.decals.crater(e,n,a*.55),s.blastEntities(e,n,a,i*1.4),s.addFire(e,1.4,n,a*.5,6,1.4),s.smokeColumn(e,3,n,34,a*.35,3.4),s.crowd.panic(e,n,a*4);for(let o=0;o<22;o++){const l=Math.random()*Math.PI*2,c=a*(.4+Math.random()*.5);s.debris.spawn(e+Math.cos(l)*c,1,n+Math.sin(l)*c,Math.cos(l)*12,12+Math.random()*16,Math.sin(l)*12,.9,.9,.9,.19,.14,.1)}}reset(){for(const e of this.rocks)e.active=!1,e.mesh.visible=!1}}class D0 extends yr{constructor(t){super("lightning",t)}trigger(t,e,n){Wc(this.ctx.sandbox,t,e,n,!0)}}function Wc(r,t,e,n,i){const s=4.2*n;r.bolts.strike(t,e,165,i?16777215:15398655),r.screen.flash(15398143,i?.5:.32,9),r.screen.shake(i?.22:.12),r.sky.pulseSun(i?.3:.18),r.audio.zap(),r.audio.thunder(i?.1:.45),r.damageSphere(t,s*.35,e,s,{radius:s,force:20*n,debris:60,scorch:1,up:.9,jagged:.7}),r.sparkBurst(t,1.2,e,34,20,14676223),r.sparkBurst(t,1.2,e,16,9,16774080),r.shock.ring(t,.3,e,1,s*3.4,.42,14676223,1.1),r.decals.scorch(t,e,s*1.2,1),r.addFire(t,1,e,s*.5,2.2,.8),r.blastEntities(t,e,s*.9,n*.7),r.crowd.panic(t,e,s*6)}class L0 extends yr{constructor(e){super("nuke",e);v(this,"phase","idle");v(this,"timer",0);v(this,"x",0);v(this,"z",0);v(this,"power",1);v(this,"radius",36);v(this,"stages",[]);v(this,"stageIdx",0);v(this,"mush",0);v(this,"beep",0);v(this,"bomb");this.bomb=new Je;const n=new ee(new Mo(.9,3,4,8),new tn({color:15262936}));n.rotation.x=Math.PI/2;const i=new ee(new yo(.9,1.6,10),new tn({color:14174778}));i.position.y=-2.6,i.rotation.x=Math.PI;const s=new ee(new nn(2.6,1.2,.16),new tn({color:14174778}));s.position.y=2;const a=s.clone();a.rotation.y=Math.PI/2,this.bomb.add(n,i,s,a),this.bomb.visible=!1,e.sandbox.engine.scene.add(this.bomb)}get running(){return this.phase!=="idle"}trigger(e,n,i){this.phase==="idle"&&(this.x=e,this.z=n,this.power=i,this.radius=36*i,this.phase="drop",this.timer=0,this.beep=0,this.bomb.position.set(e,185,n),this.bomb.visible=!0,this.ctx.sandbox.audio.meteorWhoosh(1.9),this.ctx.message("核弹投放中… 3"),this.ctx.sandbox.crowd.panic(e,n,999))}update(e,n){const i=this.ctx.sandbox;if(this.phase==="drop"){this.timer+=n;const s=Math.min(1,this.timer/1.9);if(this.bomb.position.y=185-183*s*s,this.bomb.rotation.z=Math.sin(this.timer*3)*.12,i.smokeColumn(this.bomb.position.x,this.bomb.position.y,this.bomb.position.z,1,.8,1.4),this.beep-=n,this.beep<=0){this.beep=.45,i.audio.uiClick();const a=Math.max(1,Math.ceil((1.9-this.timer)/.63));this.ctx.message(`核弹投放中… ${a}`)}s>=1&&(this.bomb.visible=!1,this.detonate());return}if(this.phase==="blast"){for(this.timer+=n;this.stageIdx<this.stages.length&&this.timer>=this.stages[this.stageIdx].t;){const s=this.stages[this.stageIdx++];i.damageSphere(this.x,this.radius*.1,this.z,s.r,{radius:s.r,force:s.force,debris:999,scorch:1,up:.6,jagged:.42}),i.blastEntities(this.x,this.z,s.r,this.power*1.6),i.shock.ring(this.x,.34,this.z,s.r*.5,s.r*2.4,1.1,16773320,1.1)}if(this.mush+=n,this.mush<9){const s=Math.min(58,8+this.mush*16);for(let a=0;a<3;a++){const o=Math.random()*Math.PI*2,l=Math.random()*this.radius*.16;i.smoke.spawn(this.x+Math.cos(o)*l,2+Math.random()*s,this.z+Math.sin(o)*l,Math.cos(o)*2,16+Math.random()*14,Math.sin(o)*2,3.4+Math.random()*2,6,16,.34,.3,.28,.62,1.4,.5,.3)}if(this.mush>.9)for(let a=0;a<4;a++){const o=Math.random()*Math.PI*2,l=this.radius*(.18+Math.random()*.5),c=46+Math.min(26,this.mush*5);i.smoke.spawn(this.x+Math.cos(o)*l*.4,c+Math.random()*12,this.z+Math.sin(o)*l*.4,Math.cos(o)*(7+Math.random()*9),3+Math.random()*5,Math.sin(o)*(7+Math.random()*9),4.5+Math.random()*3,9,26,.46,.42,.4,.5,.7,.55,.2)}if(this.mush<3.4&&Math.random()<n*26){const a=Math.random()*Math.PI*2,o=Math.random()*this.radius*.55;i.fire(this.x+Math.cos(a)*o,2+Math.random()*26,this.z+Math.sin(a)*o,4,4,1.6)}}this.timer>10&&(this.phase="idle")}}detonate(){const e=this.ctx.sandbox,n=this.radius;this.phase="blast",this.timer=0,this.mush=0,this.stageIdx=0,this.stages=[{t:0,r:n*.34,force:62*this.power},{t:.13,r:n*.6,force:46*this.power},{t:.3,r:n*.82,force:34*this.power},{t:.52,r:n,force:24*this.power}],this.ctx.message("核爆！"),e.audio.nuke(),e.screen.flash(16777215,2.6,1.05),e.screen.kickExposure(2.1),e.screen.shake(1.25),e.sky.pulseSun(1.5),e.shock.sphere(this.x,n*.2,this.z,n*.1,n*.72,1.5,16774872,2.6,1,.95),e.shock.sphere(this.x,n*.22,this.z,n*.2,n*1.15,1.05,16760929,1.8,.4,.8),e.shock.sphere(this.x,n*.25,this.z,n*.3,n*1.7,1.8,16771504,1.1,0,.55),e.shock.ring(this.x,.35,this.z,n*.2,n*4.2,1.9,16774352,1.3),e.sparkBurst(this.x,4,this.z,140,n*2.2,16770728),e.decals.crater(this.x,this.z,n*.45),e.decals.scorch(this.x,this.z,n*.95,.85);for(let i=0;i<10;i++){const s=i/10*Math.PI*2+Math.random(),a=n*(.25+Math.random()*.6);e.addFire(this.x+Math.cos(s)*a,1.2,this.z+Math.sin(s)*a,n*.14,14+Math.random()*8,1.2)}e.crowd.panic(this.x,this.z,999)}reset(){this.phase="idle",this.bomb.visible=!1,this.stages.length=0,this.stageIdx=0}runningHint(){return this.phase==="drop"?"核弹投放中…":""}}const fe=6,Ht=14,_e=6,so=fe*Ht+(fe+1)*_e,kt=so/2,dr=1400;function Hn(r){return-kt+_e+r*(Ht+_e)}function Xl(){const r=[];for(let t=0;t<=fe;t++)r.push(-kt+t*(Ht+_e)+_e/2);return r}const pr=[16748395,16766046,8178175,16752324,9429944,12164351,16773330,5886928,16761754,14139903,16360355,10147583,16769162,11069089],U0=0,I0=1,F0=2,Yl=3,Te=4,Kl=5,Gi={uTime:{value:0},uQuake:{value:0}};function N0(){const r=new tn({color:16777215});return r.onBeforeCompile=t=>{t.uniforms.uTime=Gi.uTime,t.uniforms.uQuake=Gi.uQuake,t.vertexShader=t.vertexShader.replace("#include <common>",`#include <common>
        uniform float uTime;
        uniform float uQuake;
        float vxHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`).replace("#include <project_vertex>",`vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          if ( uQuake > 0.0002 ) {
            vec3 iPos = instanceMatrix[ 3 ].xyz;
            float ph = vxHash( floor( iPos.xz * 0.135 ) ) * 6.2831853;
            float hf = clamp( mvPosition.y * 0.055, 0.0, 1.7 );
            mvPosition.x += uQuake * hf * sin( uTime * 8.7 + ph );
            mvPosition.z += uQuake * hf * cos( uTime * 7.1 + ph * 1.7 );
          }
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`)},r.customProgramCacheKey=()=>"voxel-sway-v1",r}class O0{constructor(){v(this,"px",[]);v(this,"py",[]);v(this,"pz",[]);v(this,"sx",[]);v(this,"sy",[]);v(this,"sz",[]);v(this,"cr",[]);v(this,"cg",[]);v(this,"cb",[]);v(this,"bid",[]);v(this,"lvl",[]);v(this,"knd",[]);v(this,"tmp",new vt)}add(t,e,n,i,s,a,o,l,c,h,u=1){return this.tmp.setHex(o),this.px.push(t),this.py.push(e),this.pz.push(n),this.sx.push(i),this.sy.push(s),this.sz.push(a),this.cr.push(this.tmp.r*u),this.cg.push(this.tmp.g*u),this.cb.push(this.tmp.b*u),this.bid.push(l),this.lvl.push(c),this.knd.push(h),this.px.length-1}get length(){return this.px.length}}const Qn=4,ti=1;class z0{constructor(t){v(this,"mesh");v(this,"total");v(this,"count",0);v(this,"posX");v(this,"posY");v(this,"posZ");v(this,"sclX");v(this,"sclY");v(this,"sclZ");v(this,"colR");v(this,"colG");v(this,"colB");v(this,"building");v(this,"level");v(this,"kind");v(this,"alive");v(this,"burn");v(this,"slot");v(this,"slotToId");v(this,"mArr");v(this,"cArr");v(this,"mDirtyMin",1e9);v(this,"mDirtyMax",-1);v(this,"cDirtyMin",1e9);v(this,"cDirtyMax",-1);v(this,"gridN");v(this,"gridMin");v(this,"cellStart");v(this,"cellItems");v(this,"hN");v(this,"hMin");v(this,"height");v(this,"heightBase");const e=t.length;this.total=e,this.posX=new Float32Array(t.px),this.posY=new Float32Array(t.py),this.posZ=new Float32Array(t.pz),this.sclX=new Float32Array(t.sx),this.sclY=new Float32Array(t.sy),this.sclZ=new Float32Array(t.sz),this.colR=new Float32Array(t.cr),this.colG=new Float32Array(t.cg),this.colB=new Float32Array(t.cb),this.building=new Int32Array(t.bid),this.level=new Uint8Array(t.lvl),this.kind=new Uint8Array(t.knd),this.alive=new Uint8Array(e),this.burn=new Float32Array(e),this.slot=new Int32Array(e),this.slotToId=new Int32Array(e);const n=new nn(1,1,1);this.mesh=new ui(n,N0(),e),this.mesh.instanceMatrix.setUsage(Ve);const i=new li(new Float32Array(e*3),3);i.setUsage(Ve),this.mesh.instanceColor=i,this.mesh.castShadow=!0,this.mesh.receiveShadow=!0,this.mesh.frustumCulled=!1,this.mesh.matrixAutoUpdate=!1,this.mesh.updateMatrix(),this.mArr=this.mesh.instanceMatrix.array,this.cArr=i.array;const s=kt+40;this.gridMin=-s,this.gridN=Math.ceil(s*2/Qn);const a=this.gridN*this.gridN,o=new Int32Array(a+1),l=(u,f)=>{const d=Math.min(this.gridN-1,Math.max(0,(u-this.gridMin)/Qn|0));return Math.min(this.gridN-1,Math.max(0,(f-this.gridMin)/Qn|0))*this.gridN+d};for(let u=0;u<e;u++)o[l(this.posX[u],this.posZ[u])]++;this.cellStart=new Int32Array(a+1);let c=0;for(let u=0;u<a;u++)this.cellStart[u]=c,c+=o[u];this.cellStart[a]=c,this.cellItems=new Int32Array(c);const h=this.cellStart.slice(0,a);for(let u=0;u<e;u++)this.cellItems[h[l(this.posX[u],this.posZ[u])]++]=u;this.hMin=-s,this.hN=Math.ceil(s*2/ti),this.heightBase=new Float32Array(this.hN*this.hN);for(let u=0;u<e;u++){const f=this.posY[u]+this.sclY[u]*.5,d=(this.posX[u]-this.hMin)/ti|0,g=(this.posZ[u]-this.hMin)/ti|0;if(d<0||g<0||d>=this.hN||g>=this.hN)continue;const _=g*this.hN+d;f>this.heightBase[_]&&(this.heightBase[_]=f)}this.height=this.heightBase.slice(),this.resetAll()}writeSlot(t,e){const n=this.mArr,i=t*16;n[i]=this.sclX[e],n[i+1]=0,n[i+2]=0,n[i+3]=0,n[i+4]=0,n[i+5]=this.sclY[e],n[i+6]=0,n[i+7]=0,n[i+8]=0,n[i+9]=0,n[i+10]=this.sclZ[e],n[i+11]=0,n[i+12]=this.posX[e],n[i+13]=this.posY[e],n[i+14]=this.posZ[e],n[i+15]=1;const s=t*3,a=1-.78*this.burn[e];this.cArr[s]=this.colR[e]*a+this.burn[e]*.035,this.cArr[s+1]=this.colG[e]*a+this.burn[e]*.026,this.cArr[s+2]=this.colB[e]*a+this.burn[e]*.024}markMatrix(t){t<this.mDirtyMin&&(this.mDirtyMin=t),t>this.mDirtyMax&&(this.mDirtyMax=t)}markColor(t){t<this.cDirtyMin&&(this.cDirtyMin=t),t>this.cDirtyMax&&(this.cDirtyMax=t)}resetAll(){const t=this.total;this.alive.fill(1),this.burn.fill(0);for(let e=0;e<t;e++)this.slot[e]=e,this.slotToId[e]=e,this.writeSlot(e,e);this.count=t,this.mesh.count=t,this.height.set(this.heightBase),this.mDirtyMin=0,this.mDirtyMax=t-1,this.cDirtyMin=0,this.cDirtyMax=t-1,this.flush()}kill(t){if(this.alive[t]===0)return!1;this.alive[t]=0;const e=this.slot[t],n=this.count-1;if(e!==n){const a=this.slotToId[n];this.writeSlot(e,a),this.slotToId[e]=a,this.slot[a]=e,this.markMatrix(e),this.markColor(e)}this.slot[t]=-1,this.count=n,this.mesh.count=n;const i=(this.posX[t]-this.hMin)/ti|0,s=(this.posZ[t]-this.hMin)/ti|0;if(i>=0&&s>=0&&i<this.hN&&s<this.hN){const a=s*this.hN+i,o=this.posY[t]-this.sclY[t]*.5;this.height[a]>o&&(this.height[a]=o)}return!0}scorch(t,e){if(this.alive[t]===0)return;const n=Math.min(1,Math.max(this.burn[t],e));if(n<=this.burn[t]+.01)return;this.burn[t]=n;const i=this.slot[t],s=i*3,a=1-.78*n;this.cArr[s]=this.colR[t]*a+n*.035,this.cArr[s+1]=this.colG[t]*a+n*.026,this.cArr[s+2]=this.colB[t]*a+n*.024,this.markColor(i)}flush(){if(this.mDirtyMax>=this.mDirtyMin){const t=this.mesh.instanceMatrix,e=this.mDirtyMax-this.mDirtyMin+1;t.clearUpdateRanges(),e<this.total*.5&&t.addUpdateRange(this.mDirtyMin*16,e*16),t.needsUpdate=!0,this.mDirtyMin=1e9,this.mDirtyMax=-1}if(this.cDirtyMax>=this.cDirtyMin&&this.mesh.instanceColor){const t=this.mesh.instanceColor,e=this.cDirtyMax-this.cDirtyMin+1;t.clearUpdateRanges(),e<this.total*.5&&t.addUpdateRange(this.cDirtyMin*3,e*3),t.needsUpdate=!0,this.cDirtyMin=1e9,this.cDirtyMax=-1}}queryDisc(t,e,n,i){const s=Math.max(0,(t-n-this.gridMin)/Qn|0),a=Math.min(this.gridN-1,(t+n-this.gridMin)/Qn|0),o=Math.max(0,(e-n-this.gridMin)/Qn|0),l=Math.min(this.gridN-1,(e+n-this.gridMin)/Qn|0);for(let c=o;c<=l;c++){const h=c*this.gridN;for(let u=s;u<=a;u++){const f=h+u,d=this.cellStart[f+1];for(let g=this.cellStart[f];g<d;g++)i(this.cellItems[g])}}}querySphere(t,e,n,i,s){const a=i*i;this.queryDisc(t,n,i,o=>{if(this.alive[o]===0)return;const l=this.posX[o]-t,c=this.posY[o]-e,h=this.posZ[o]-n,u=l*l+c*c+h*h;u>a||s(o,Math.sqrt(u)/i)})}queryCylinder(t,e,n,i,s,a){const o=n*n;this.queryDisc(t,e,n,l=>{if(this.alive[l]===0)return;const c=this.posY[l];if(c<i||c>s)return;const h=this.posX[l]-t,u=this.posZ[l]-e,f=h*h+u*u;f>o||a(l,Math.sqrt(f)/n)})}surfaceAt(t,e){const n=(t-this.hMin)/ti|0,i=(e-this.hMin)/ti|0;if(n<0||i<0||n>=this.hN||i>=this.hN)return 0;const s=this.height[i*this.hN+n];return s>0?s:0}}class vs{constructor(t,e){v(this,"sustained",!0);v(this,"on",!1);this.id=t,this.ctx=e}get running(){return this.on}steer(t,e){}reset(){this.on&&this.stop()}runningHint(){return""}}class B0 extends vs{constructor(e){super("tornado",e);v(this,"funnel");v(this,"uniforms",{uTime:{value:0}});v(this,"x",0);v(this,"z",0);v(this,"power",1);v(this,"radius",16);v(this,"height",78);v(this,"heading",0);v(this,"wander",0);v(this,"carve",0);v(this,"emit",0);v(this,"fade",0);v(this,"threat",null);const n=new xr(1,.26,1,34,18,!0),i=new de({uniforms:this.uniforms,transparent:!0,depthWrite:!1,side:Le,vertexShader:`
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        }`,fragmentShader:`
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float sw = vUv.x * 6.2831 * 2.0 + vUv.y * 9.0 - uTime * 7.0;
          float bands = sin( sw ) * 0.5 + 0.5;
          float bands2 = sin( sw * 2.3 + 1.7 ) * 0.5 + 0.5;
          float a = 0.16 + 0.42 * bands * ( 0.4 + 0.6 * bands2 );
          a *= smoothstep( 0.0, 0.10, vUv.y );
          a *= 1.0 - smoothstep( 0.78, 1.0, vUv.y ) * 0.65;
          vec3 c = mix( vec3( 0.42, 0.42, 0.46 ), vec3( 0.86, 0.88, 0.92 ), bands );
          gl_FragColor = vec4( c, a );
        }`});this.funnel=new ee(n,i),this.funnel.visible=!1,this.funnel.frustumCulled=!1,this.funnel.renderOrder=3,e.sandbox.engine.scene.add(this.funnel)}trigger(e,n,i){const s=this.ctx.sandbox;this.on=!0,this.fade=1,this.x=e,this.z=n,this.power=i,this.radius=16*i,this.height=62+26*i,this.heading=Math.random()*Math.PI*2,this.funnel.visible=!0;const a=s.fields.vortices[0];a.active=!0,a.x=e,a.z=n,a.radius=this.radius*1.5,a.strength=12*i,a.top=this.height*.8,this.threat||(this.threat=s.addThreat(e,n,this.radius,i)),s.audio.windLevel(1),this.ctx.message("龙卷风登陆！WASD / 方向键控制移动")}stop(){const e=this.ctx.sandbox;this.on=!1,e.fields.vortices[0].active=!1,this.threat&&(e.removeThreat(this.threat),this.threat=null),e.audio.windLevel(0)}steer(e,n){if(!this.on||e.x===0&&e.y===0)return;const i=22*n;this.x+=e.x*i,this.z+=e.y*i,this.heading=Math.atan2(e.y,e.x)}update(e,n){const i=this.ctx.sandbox;if(!this.on){this.fade>0&&(this.fade=Math.max(0,this.fade-n*1.2),this.applyTransform(),this.fade===0&&(this.funnel.visible=!1));return}this.uniforms.uTime.value+=n,this.wander+=n,this.heading+=Math.sin(this.wander*.6)*n*.9;const s=8*n;this.x+=Math.cos(this.heading)*s,this.z+=Math.sin(this.heading)*s;const a=kt+26;Math.abs(this.x)>a&&(this.x=Be(this.x,-a,a),this.heading=Math.PI-this.heading),Math.abs(this.z)>a&&(this.z=Be(this.z,-a,a),this.heading=-this.heading),this.applyTransform();const o=i.fields.vortices[0];if(o.x=this.x,o.z=this.z,this.threat&&(this.threat.x=this.x,this.threat.z=this.z),this.carve-=n,this.carve<=0){this.carve=.06;const l=this.radius*.5,c=Math.round(18+this.power*14);let h=0;const u=[];i.field.queryCylinder(this.x,this.z,l,0,this.height*.7,f=>{h>=c||Math.random()<.35&&(u.push(f),h++)});for(const f of u){const d=i.field.posX[f]-this.x,g=i.field.posZ[f]-this.z,_=Math.max(.8,Math.hypot(d,g));i.city.pushDirection(f,d/_,g/_),i.debris.spawnFromVoxel(i.field,f,-g/_*20-d/_*5,10+Math.random()*12,d/_*20-g/_*5),i.killVoxel(f)}}if(this.emit-=n,this.emit<=0){this.emit=.02;for(let l=0;l<3;l++){const c=Math.random()*Math.PI*2,h=Math.random()*this.height*.85,u=this.radius*(.25+.75*(h/this.height))*(.7+Math.random()*.5),f=.5+Math.random()*.35;i.smoke.spawn(this.x+Math.cos(c)*u,h+.4,this.z+Math.sin(c)*u,-Math.sin(c)*22,6+Math.random()*8,Math.cos(c)*22,1.1+Math.random()*.9,2.4,5.5,f,f*.97,f*.93,.5,.4,.5,1)}i.dust(this.x,.6,this.z,3,this.radius*.8,1.1)}i.crowd.panic(this.x,this.z,this.radius*2.2)}applyTransform(){const e=this.height*this.fade,n=this.radius*this.fade;this.funnel.scale.set(n,e,n),this.funnel.position.set(this.x,e/2,this.z),this.funnel.rotation.y+=.06}runningHint(){return"WASD / 方向键移动龙卷风 · 再次点击按钮结束"}}class k0 extends vs{constructor(e){super("blackhole",e);v(this,"group",new Je);v(this,"core");v(this,"halo");v(this,"disc");v(this,"discUniforms",{uTime:{value:0}});v(this,"x",0);v(this,"z",0);v(this,"y",15);v(this,"power",1);v(this,"radius",26);v(this,"life",0);v(this,"eat",0);v(this,"threat",null);this.core=new ee(new Vi(1,26,18),new Wn({color:525326})),this.halo=new ee(new Vi(1.42,26,18),new de({transparent:!0,depthWrite:!1,blending:en,side:Ue,uniforms:{},vertexShader:`
          varying vec3 vN; varying vec3 vP;
          void main() {
            vN = normalize( normalMatrix * normal );
            vec4 mv = modelViewMatrix * vec4( position, 1.0 );
            vP = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,fragmentShader:`
          varying vec3 vN; varying vec3 vP;
          void main() {
            float rim = pow( 1.0 - abs( dot( normalize( vN ), normalize( -vP ) ) ), 3.0 );
            vec3 c = mix( vec3( 0.42, 0.12, 0.72 ), vec3( 0.95, 0.72, 1.0 ), rim );
            gl_FragColor = vec4( c * rim * 2.2, 1.0 );
          }`})),this.disc=new ee(new bo(1,.36,12,96),new de({uniforms:this.discUniforms,transparent:!0,depthWrite:!1,blending:en,side:Le,vertexShader:`
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }`,fragmentShader:`
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            float streak = sin( vUv.x * 62.0 - uTime * 22.0 ) * 0.5 + 0.5;
            float glow = 0.35 + 0.65 * streak;
            vec3 c = mix( vec3( 0.72, 0.24, 1.0 ), vec3( 1.0, 0.86, 0.72 ), streak * 0.75 );
            gl_FragColor = vec4( c * glow * 1.7, glow * 0.9 );
          }`})),this.disc.rotation.x=Math.PI/2.35,this.group.add(this.core,this.halo,this.disc),this.group.visible=!1,e.sandbox.engine.scene.add(this.group)}trigger(e,n,i){const s=this.ctx.sandbox;this.on=!0,this.x=e,this.z=n,this.y=14+4*i,this.power=i,this.radius=26*i,this.life=10,this.eat=2.4,this.group.visible=!0;const a=s.fields.wells[0];a.active=!0,a.x=e,a.y=this.y,a.z=n,a.radius=this.radius*1.35,a.strength=4.3*i,a.eat=this.eat,this.threat||(this.threat=s.addThreat(e,n,this.radius*.6,i)),s.audio.singularity(1),s.screen.flash(10116351,.32,5),this.ctx.message("微型黑洞成形！WASD / 方向键控制移动")}stop(){this.on&&this.collapse()}steer(e,n){if(!this.on||e.x===0&&e.y===0)return;const i=19*n;this.x+=e.x*i,this.z+=e.y*i}update(e,n){const i=this.ctx.sandbox;if(!this.on)return;this.discUniforms.uTime.value+=n,this.life-=n;const s=kt+24;this.x=Be(this.x,-s,s),this.z=Be(this.z,-s,s);const a=1+Math.sin(this.life*9)*.045,o=(2.6+this.power*1.5)*a;this.core.scale.setScalar(o),this.halo.scale.setScalar(o),this.disc.scale.set(o*3.1,o*3.1,o*3.1),this.disc.rotation.z+=n*2.4,this.group.position.set(this.x,this.y,this.z);const l=i.fields.wells[0];l.x=this.x,l.y=this.y,l.z=this.z,this.eat=2.4+(10-this.life)*.24,l.eat=this.eat,this.threat&&(this.threat.x=this.x,this.threat.z=this.z);let c=0;const h=[];i.field.querySphere(this.x,this.y,this.z,this.radius*.62,(u,f)=>{c>=34||Math.random()<.5-f*.35&&(h.push(u),c++)});for(const u of h){const f=i.field.posX[u]-this.x,d=i.field.posZ[u]-this.z,g=Math.max(.8,Math.hypot(f,d));i.city.pushDirection(u,-f/g,-d/g),i.debris.spawnFromVoxel(i.field,u,-d/g*9,4+Math.random()*6,f/g*9),i.killVoxel(u)}for(let u=0;u<2;u++){const f=Math.random()*Math.PI*2,d=o*(3+Math.random()*1.4);i.sparks.spawn(this.x+Math.cos(f)*d,this.y+(Math.random()-.5)*2,this.z+Math.sin(f)*d,-Math.sin(f)*12,0,Math.cos(f)*12,.5,.5,.1,.85,.55,1,1,0,.5,1)}i.crowd.panic(this.x,this.z,this.radius*.8),this.life<=0&&this.collapse()}collapse(){const e=this.ctx.sandbox;this.on=!1,this.group.visible=!1,e.fields.wells[0].active=!1,this.threat&&(e.removeThreat(this.threat),this.threat=null),e.audio.singularity(0),e.audio.implosion(),e.screen.flash(14201087,1.5,2.4),e.screen.shake(.85),e.screen.kickExposure(1.5);const n=this.radius*.55;e.shock.sphere(this.x,this.y,this.z,n*.1,n*1.7,.85,13081855,2.4,1,1),e.shock.sphere(this.x,this.y,this.z,n*.4,n*2.6,1.3,16777215,1.2,0,1),e.shock.ring(this.x,.34,this.z,n*.2,n*3.4,1.1,13674751,1.2),e.sparkBurst(this.x,this.y,this.z,90,46,14729471),e.damageSphere(this.x,Math.min(this.y,8),this.z,n,{radius:n,force:38*this.power,debris:999,scorch:.5,up:.8,jagged:.5}),e.blastEntities(this.x,this.z,n*1.2,this.power*1.2),e.decals.scorch(this.x,this.z,n*.9,.7),this.ctx.message("黑洞坍缩！")}runningHint(){return`WASD / 方向键移动黑洞 · ${Math.max(0,this.life).toFixed(0)}s 后坍缩`}}class V0 extends vs{constructor(e){super("quake",e);v(this,"ramp",0);v(this,"power",1);v(this,"tick",0);v(this,"crackTimer",0)}trigger(e,n,i){this.on=!0,this.power=i,this.ctx.sandbox.audio.quakeLevel(1),this.ctx.message("大地震开始！再次点击按钮停止")}stop(){this.on=!1,this.ctx.sandbox.audio.quakeLevel(0)}update(e,n){const i=this.ctx.sandbox,s=this.on?1:0;if(this.ramp+=(s-this.ramp)*Math.min(1,n*(this.on?.55:1.4)),this.ramp<.002&&!this.on){this.ramp=0,Gi.uQuake.value=0,i.screen.setRumble(0),i.stress=0;return}if(Gi.uQuake.value=.85*this.power*this.ramp,i.screen.setRumble(.34*this.power*this.ramp),i.stress=this.ramp*this.power,!!this.on){if(this.tick-=n,this.tick<=0){this.tick=.3-.16*this.ramp;const a=1+Math.floor(this.ramp*3.4);for(let o=0;o<a;o++){const l=i.city.states,c=Math.random()*l.length|0,h=l[c];if(h.gone)continue;const u=Math.random()<.62?3:2+(Math.random()*h.levels|0),f=2+(Math.random()*(2+this.ramp*5)|0);for(let d=0;d<f;d++){const g=i.city.randomAliveVoxel(c,u);if(g<0)break;Math.random()<.55&&i.debris.spawnFromVoxel(i.field,g,(Math.random()-.5)*7,1+Math.random()*4,(Math.random()-.5)*7),i.city.pushDirection(g,Math.random()-.5,Math.random()-.5),i.killVoxel(g)}Math.random()<.4&&i.dust(h.cx,1,h.cz,4,4,1.2),i.crowd.panic(h.cx,h.cz,22+this.ramp*14)}Math.random()<.25*this.ramp&&i.audio.crumble()}if(this.crackTimer-=n,this.crackTimer<=0&&this.ramp>.4){this.crackTimer=1.4;const a=i.randomCityPoint(sr);i.decals.add(a.x,a.y,3+Math.random()*5,2826520,.36),i.dust(a.x,.6,a.y,5,3,1.4)}}}runningHint(){return"大地震进行中 · 再次点击按钮停止"}}const sr=new Tt;class H0 extends vs{constructor(e){super("flood",e);v(this,"power",1);v(this,"splash",0);v(this,"erode",0)}trigger(e,n,i){const s=this.ctx.sandbox;this.on=!0,this.power=i,s.water.target=Be(3.5+5.4*i,3,14),s.fields.waterCurrent=2.4*i,s.audio.waterLevel(1),s.crowd.panic(0,0,999),this.ctx.message("洪水上涨！再次点击按钮退水")}stop(){const e=this.ctx.sandbox;this.on=!1,e.water.target=0,e.fields.waterCurrent=0,e.audio.waterLevel(0),this.ctx.message("洪水开始退去…")}update(e,n){const i=this.ctx.sandbox,s=i.water.level;if(!(s<.05&&!this.on)){if(this.splash-=n,this.splash<=0){this.splash=.09;for(let a=0;a<2;a++){const o=i.randomCityPoint(sr),l=i.field.surfaceAt(o.x,o.y);Math.abs(l-s)>2.4||i.smoke.spawn(o.x,s+.4,o.y,(Math.random()-.5)*3,2+Math.random()*3,(Math.random()-.5)*3,.9,1.4,4,.85,.95,1,.55,-1,1.1,.2)}}if(this.on){if(s>.2&&Math.random()<n*3){const a=i.randomCityPoint(sr);i.crowd.panic(a.x,a.y,26)}if(this.erode-=n,this.erode<=0&&s>1){this.erode=.34;const a=i.randomCityPoint(sr),o=Math.round(2+this.power*2.5);let l=0;const c=[];i.field.queryCylinder(a.x,a.y,7,Math.max(0,s-1),s+.2,h=>{l>=o||Math.random()<.3&&(c.push(h),l++)});for(const h of c)i.debris.spawnFromVoxel(i.field,h,(Math.random()-.5)*4,1,(Math.random()-.5)*4),i.killVoxel(h)}}}}runningHint(){return`洪水水位 ${this.ctx.sandbox.water.level.toFixed(1)} · 再次点击按钮退水`}}class G0 extends vs{constructor(e){super("storm",e);v(this,"x",0);v(this,"z",0);v(this,"power",1);v(this,"radius",30);v(this,"next",0);v(this,"threat",null)}trigger(e,n,i){const s=this.ctx.sandbox;this.on=!0,this.x=e,this.z=n,this.power=i,this.radius=30*i,this.next=.35,s.sky.setStorm(1),s.audio.windLevel(.7),s.audio.thunder(.8),this.threat||(this.threat=s.addThreat(e,n,this.radius*.35,i)),this.ctx.message("雷暴来临！WASD / 方向键移动雷暴中心")}stop(){const e=this.ctx.sandbox;this.on=!1,e.sky.setStorm(0),e.audio.windLevel(0),this.threat&&(e.removeThreat(this.threat),this.threat=null),this.ctx.message("雷暴散去，天空恢复晴朗")}steer(e,n){if(!this.on||e.x===0&&e.y===0)return;const i=30*n;this.x=Be(this.x+e.x*i,-kt-30,kt+30),this.z=Be(this.z+e.y*i,-kt-30,kt+30)}update(e,n){const i=this.ctx.sandbox;if(this.on){if(this.threat&&(this.threat.x=this.x,this.threat.z=this.z),this.next-=n,this.next<=0){this.next=.42+Math.random()*(1.15-.45*this.power);const s=Math.random()*Math.PI*2,a=Math.sqrt(Math.random())*this.radius;Wc(i,this.x+Math.cos(s)*a,this.z+Math.sin(s)*a,this.power*.55,!1)}Math.random()<n*.7&&i.sky.pulseSun(.12)}}runningHint(){return"WASD / 方向键移动雷暴中心 · 再次点击按钮结束"}}const W0=[{id:"blast",name:"定点爆破",icon:"💥",css:"#ff8a4c",hex:16751180,sustained:!1,radius:r=>9*r,hint:"点击地图释放【定点爆破】"},{id:"meteor",name:"陨石坠落",icon:"☄️",css:"#ff6a3d",hex:16742973,sustained:!1,radius:r=>15*r,hint:"点击地图释放【陨石坠落】"},{id:"lightning",name:"天罚落雷",icon:"⚡",css:"#7cc4ff",hex:11461375,sustained:!1,radius:r=>4.2*r,hint:"点击地图释放【天罚落雷】"},{id:"tornado",name:"龙卷风",icon:"🌪️",css:"#9fb6c9",hex:14148846,sustained:!0,radius:r=>16*r,hint:"点击地图投放【龙卷风】"},{id:"blackhole",name:"微型黑洞",icon:"🕳️",css:"#b57bff",hex:12619007,sustained:!0,radius:r=>26*r,hint:"点击地图投放【微型黑洞】"},{id:"nuke",name:"核弹",icon:"☢️",css:"#ffd23f",hex:16773280,sustained:!1,radius:r=>36*r,hint:"点击地图投放【核弹】"},{id:"quake",name:"大地震",icon:"📳",css:"#c08a5a",hex:14196842,sustained:!0,radius:()=>46,hint:"点击地图启动【大地震】"},{id:"flood",name:"大洪水",icon:"🌊",css:"#3fb8ff",hex:6277375,sustained:!0,radius:r=>30*r,hint:"点击地图启动【大洪水】"},{id:"storm",name:"雷暴",icon:"⛈️",css:"#6f8fb5",hex:10470655,sustained:!0,radius:r=>30*r,hint:"点击地图启动【雷暴】"}],q0="左键拖动旋转 · 右键拖动平移 · 滚轮缩放 · 选择下方灾难后点击城市";class X0{constructor(t){v(this,"specs",W0);v(this,"armed",null);v(this,"onMessage",()=>{});v(this,"impl",new Map);v(this,"steerVec",new Tt);this.sandbox=t;const e={sandbox:t,message:i=>this.onMessage(i)},n=[new C0(e),new P0(e),new D0(e),new B0(e),new k0(e),new L0(e),new V0(e),new H0(e),new G0(e)];for(const i of n)this.impl.set(i.id,i)}spec(t){const e=this.specs.find(n=>n.id===t);if(!e)throw new Error(`unknown disaster ${t}`);return e}isRunning(t){return this.impl.get(t)?.running??!1}get anySustainedRunning(){for(const t of this.impl.values())if(t.sustained&&t.running)return!0;return!1}select(t){const e=this.impl.get(t);if(e){if(e.sustained&&e.running){e.stop(),this.armed=null;return}this.armed=this.armed===t?null:t}}cancel(){this.armed=null}release(t){if(!this.armed)return!1;const e=this.impl.get(this.armed);return e?(e.trigger(t.x,t.z,this.sandbox.power),e.sustained&&(this.armed=null),!0):!1}reticleRadius(){return this.armed?this.spec(this.armed).radius(this.sandbox.power):0}reticleColor(){return this.armed?this.spec(this.armed).hex:16777215}hint(){for(const e of this.impl.values())if(e.sustained&&e.running){const n=e.runningHint();if(n)return n}const t=this.impl.get("nuke");return t&&t.running?t.runningHint():this.armed?this.spec(this.armed).hint:q0}update(t,e,n){this.steerVec.copy(n);for(const i of this.impl.values())i.sustained&&i.running&&i.steer(this.steerVec,t),i.update(t,e)}reset(){for(const t of this.impl.values())t.reset();this.armed=null}}const De=1e-4;function fn(r,t,e){return r<t?t:r>e?e:r}function Nn(r){try{r.disconnect()}catch{}}function on(r,t,e,n,i){const s=Math.max(De*2,e),a=Math.max(.001,n),o=Math.max(.002,i);r.gain.setValueAtTime(De,t),r.gain.exponentialRampToValueAtTime(s,t+a),r.gain.exponentialRampToValueAtTime(De,t+a+o)}function rs(r,t,e,n,i){const s=Math.max(De*2,e);r.gain.setValueAtTime(De,t),r.gain.linearRampToValueAtTime(s,t+Math.max(.01,n)),r.gain.linearRampToValueAtTime(De,t+Math.max(.02,n+i))}const gr=class gr{constructor(){v(this,"ctx",null);v(this,"master",null);v(this,"comp",null);v(this,"whiteBuf",null);v(this,"brownBuf",null);v(this,"beds",[]);v(this,"wind",null);v(this,"quake",null);v(this,"water",null);v(this,"hum",null);v(this,"permanent",[]);v(this,"permanentSources",[]);v(this,"voices",0);v(this,"timers",new Set);v(this,"impactStamps",[]);v(this,"_enabled",!0);v(this,"slow",!1);v(this,"masterLevel",.5);v(this,"failed",!1)}get enabled(){return this._enabled}get contextState(){return this.ctx?this.ctx.state:this.failed?"failed":"none"}get voiceCount(){return this.voices}setEnabled(t){this._enabled=t;const e=this.ctx,n=this.master;if(!e||!n)return;const i=e.currentTime;n.gain.cancelScheduledValues(i),n.gain.setValueAtTime(t?this.masterLevel:0,i)}toggle(){return this.setEnabled(!this._enabled),this._enabled}resume(){if(this.failed)return;if(!this.ctx)try{const e=globalThis,n=e.AudioContext??e.webkitAudioContext;if(!n){this.failed=!0;return}const i=new n({latencyHint:"interactive"});this.buildGraph(i),this.ctx=i}catch{this.failed=!0,this.ctx=null;return}const t=this.ctx;if(t&&t.state!=="running")try{const e=t.resume();e instanceof Promise&&e.catch(()=>{})}catch{}}setSlowMotion(t){if(this.slow===t)return;this.slow=t;const e=this.ctx;if(!e)return;const n=t?.62:1,i=e.currentTime,s=.3;for(const a of this.beds){for(const o of a.sources)o.node.playbackRate.setTargetAtTime(o.base*n,i,s);for(const o of a.oscs)o.node.frequency.setTargetAtTime(o.base*n,i,s);for(const o of a.filters)o.node.frequency.setTargetAtTime(o.base*n,i,s)}}explosion(t=1){const e=this.beginVoice();if(!e)return;const{ctx:n,t:i,bus:s}=e,a=fn(t,.3,3),o=.5+.6*a,l=n.createOscillator();l.type="sine",l.frequency.setValueAtTime(140*(1/Math.sqrt(a))+20,i),l.frequency.exponentialRampToValueAtTime(26,i+o*.85);const c=n.createGain();on(c,i,.9,.008,o),l.connect(c).connect(s),this.playSource(l,i,i+o+.05);const h=this.noise(n,this.whiteBuf,.85+Math.random()*.3);if(h){const f=n.createBiquadFilter();f.type="lowpass",f.Q.value=.7,f.frequency.setValueAtTime(2200,i),f.frequency.exponentialRampToValueAtTime(140,i+o*.7);const d=n.createGain();on(d,i,.55*Math.min(1.4,a),.012,o*.9),h.connect(f).connect(d).connect(s),this.playSource(h,i,i+o+.05)}const u=this.noise(n,this.whiteBuf,1.6);if(u){const f=n.createBiquadFilter();f.type="highpass",f.frequency.value=1800;const d=n.createGain();on(d,i,.3,.002,.09),u.connect(f).connect(d).connect(s),this.playSource(u,i,i+.16)}this.endVoice(s,o+.2)}nuke(){const t=this.beginVoice();if(!t)return;const{ctx:e,t:n,bus:i}=t,s=6.5,a=e.createOscillator();a.type="sine",a.frequency.setValueAtTime(150,n),a.frequency.exponentialRampToValueAtTime(16,n+2.4);const o=e.createGain();o.gain.setValueAtTime(De,n),o.gain.exponentialRampToValueAtTime(1,n+.02),o.gain.exponentialRampToValueAtTime(.25,n+1.6),o.gain.exponentialRampToValueAtTime(De,n+4.5),a.connect(o).connect(i),this.playSource(a,n,n+4.6);const l=this.noise(e,this.whiteBuf,.75);if(l){const h=e.createBiquadFilter();h.type="lowpass",h.Q.value=1.1,h.frequency.setValueAtTime(5200,n),h.frequency.exponentialRampToValueAtTime(220,n+2.2);const u=e.createGain();u.gain.setValueAtTime(De,n),u.gain.exponentialRampToValueAtTime(.8,n+.05),u.gain.exponentialRampToValueAtTime(De,n+3),l.connect(h).connect(u).connect(i),this.playSource(l,n,n+3.1)}const c=this.noise(e,this.brownBuf,.4);if(c){const h=e.createBiquadFilter();h.type="lowpass",h.frequency.setValueAtTime(320,n),h.frequency.exponentialRampToValueAtTime(70,n+s);const u=e.createGain();u.gain.setValueAtTime(De,n),u.gain.linearRampToValueAtTime(.5,n+.6),u.gain.exponentialRampToValueAtTime(De,n+s),c.connect(h).connect(u).connect(i),this.playSource(c,n,n+s+.05)}this.endVoice(i,s+.2)}impact(t=.6){const e=this.ctx;if(!e||!this._enabled)return;const n=e.currentTime;if(this.impactStamps=this.impactStamps.filter(f=>n-f<1),this.impactStamps.length>=14)return;this.impactStamps.push(n);const i=this.beginVoice();if(!i)return;const{t:s,bus:a}=i,o=fn(t,0,1),l=.06+.1*o,c=this.noise(e,this.brownBuf,1.1+Math.random()*.8);if(c){const f=e.createBiquadFilter();f.type="bandpass",f.frequency.value=420+700*(1-o)+Math.random()*250,f.Q.value=1.4;const d=e.createGain();on(d,s,.25+.45*o,.002,l),c.connect(f).connect(d).connect(a),this.playSource(c,s,s+l+.05)}const h=e.createOscillator();h.type="triangle",h.frequency.setValueAtTime(190-60*o,s),h.frequency.exponentialRampToValueAtTime(90,s+l);const u=e.createGain();on(u,s,.16+.24*o,.001,l*.8),h.connect(u).connect(a),this.playSource(h,s,s+l+.05),this.endVoice(a,l+.15)}crumble(){const t=this.beginVoice();if(!t)return;const{ctx:e,t:n,bus:i}=t,s=1.2,a=this.noise(e,this.brownBuf,.85);if(a){const l=e.createBiquadFilter();l.type="lowpass",l.Q.value=.9,l.frequency.setValueAtTime(260,n),l.frequency.linearRampToValueAtTime(900,n+.45),l.frequency.exponentialRampToValueAtTime(180,n+s);const c=e.createGain();rs(c,n,.6,.09,s-.09),a.connect(l).connect(c).connect(i),this.playSource(a,n,n+s+.05)}const o=this.noise(e,this.whiteBuf,1.25);if(o){const l=e.createBiquadFilter();l.type="bandpass",l.Q.value=1.8,l.frequency.setValueAtTime(1500,n),l.frequency.exponentialRampToValueAtTime(520,n+s);const c=e.createGain();rs(c,n,.22,.05,s-.05),o.connect(l).connect(c).connect(i),this.playSource(o,n,n+s+.05)}this.endVoice(i,s+.2)}thunder(t=.5){const e=this.beginVoice();if(!e)return;const{ctx:n,t:i,bus:s}=e,a=fn(t,0,1),o=1.1+2.6*a,l=4200*(1-a)+260*a,c=this.noise(n,this.brownBuf,.55+.4*(1-a));if(c){const h=n.createBiquadFilter();h.type="lowpass",h.Q.value=1,h.frequency.setValueAtTime(l,i),h.frequency.exponentialRampToValueAtTime(Math.max(60,l*.18),i+o);const u=n.createGain(),f=.01+.35*a;rs(u,i,.75-.25*a,f,o-f),c.connect(h).connect(u).connect(s),this.playSource(c,i,i+o+.1)}if(a<.55){const h=this.noise(n,this.whiteBuf,1.5);if(h){const u=n.createBiquadFilter();u.type="highpass",u.frequency.value=1200+2600*(1-a);const f=n.createGain();on(f,i,.42*(1-a/.55),.002,.18),h.connect(u).connect(f).connect(s),this.playSource(h,i,i+.26)}}this.endVoice(s,o+.25)}zap(){const t=this.beginVoice();if(!t)return;const{ctx:e,t:n,bus:i}=t,s=.15,a=e.createBiquadFilter();a.type="highpass",a.frequency.value=900,a.Q.value=.8,a.connect(i);for(let l=0;l<2;l++){const c=e.createOscillator();c.type="sawtooth";const h=l===0?2600:3350;c.frequency.setValueAtTime(h,n),c.frequency.exponentialRampToValueAtTime(h*.22,n+s);const u=e.createGain();on(u,n,l===0?.3:.18,.001,s),c.connect(u).connect(a),this.playSource(c,n,n+s+.05)}const o=this.noise(e,this.whiteBuf,1.9);if(o){const l=e.createBiquadFilter();l.type="bandpass",l.frequency.value=3800,l.Q.value=.9;const c=e.createGain();on(c,n,.3,.001,.07),o.connect(l).connect(c).connect(i),this.playSource(o,n,n+.14)}this.endVoice(i,s+.15)}meteorWhoosh(t){const e=this.beginVoice();if(!e)return;const{ctx:n,t:i,bus:s}=e,a=fn(t,.15,12),o=this.noise(n,this.whiteBuf,1);if(o){const h=n.createBiquadFilter();h.type="bandpass",h.Q.value=2.2,h.frequency.setValueAtTime(220,i),h.frequency.exponentialRampToValueAtTime(2400,i+a);const u=n.createGain();rs(u,i,.5,a*.72,a*.28),o.connect(h).connect(u).connect(s),this.playSource(o,i,i+a+.05)}const l=n.createOscillator();l.type="sine",l.frequency.setValueAtTime(90,i),l.frequency.exponentialRampToValueAtTime(420,i+a);const c=n.createGain();rs(c,i,.16,a*.8,a*.2),l.connect(c).connect(s),this.playSource(l,i,i+a+.05),this.endVoice(s,a+.2)}implosion(){const t=this.beginVoice();if(!t)return;const{ctx:e,t:n,bus:i}=t,s=.9,a=n+s,o=s+.7,l=e.createOscillator();l.type="sawtooth",l.frequency.setValueAtTime(760,n),l.frequency.exponentialRampToValueAtTime(38,a);const c=e.createBiquadFilter();c.type="lowpass",c.frequency.setValueAtTime(3e3,n),c.frequency.exponentialRampToValueAtTime(200,a);const h=e.createGain();h.gain.setValueAtTime(De,n),h.gain.linearRampToValueAtTime(.32,a-.05),h.gain.exponentialRampToValueAtTime(De,a),l.connect(c).connect(h).connect(i),this.playSource(l,n,a+.02);const u=this.noise(e,this.whiteBuf,.9);if(u){const _=e.createBiquadFilter();_.type="bandpass",_.Q.value=3,_.frequency.setValueAtTime(300,n),_.frequency.exponentialRampToValueAtTime(3200,a);const m=e.createGain();m.gain.setValueAtTime(De,n),m.gain.linearRampToValueAtTime(.3,a-.03),m.gain.exponentialRampToValueAtTime(De,a),u.connect(_).connect(m).connect(i),this.playSource(u,n,a+.02)}const f=e.createOscillator();f.type="sine",f.frequency.setValueAtTime(110,a),f.frequency.exponentialRampToValueAtTime(30,a+.55);const d=e.createGain();on(d,a,.85,.004,.6),f.connect(d).connect(i),this.playSource(f,a,a+.68);const g=this.noise(e,this.whiteBuf,1.3);if(g){const _=e.createBiquadFilter();_.type="highpass",_.frequency.value=700;const m=e.createGain();on(m,a,.35,.002,.3),g.connect(_).connect(m).connect(i),this.playSource(g,a,a+.4)}this.endVoice(i,o+.2)}uiClick(){const t=this.beginVoice();if(!t)return;const{ctx:e,t:n,bus:i}=t,s=e.createOscillator();s.type="sine",s.frequency.setValueAtTime(1180,n),s.frequency.exponentialRampToValueAtTime(720,n+.05);const a=e.createGain();on(a,n,.09,.002,.05),s.connect(a).connect(i),this.playSource(s,n,n+.09),this.endVoice(i,.12)}windLevel(t){this.wind&&(this.wind.target=fn(t,0,1))}quakeLevel(t){this.quake&&(this.quake.target=fn(t,0,1))}waterLevel(t){this.water&&(this.water.target=fn(t,0,1))}singularity(t){this.hum&&(this.hum.target=fn(t,0,1))}update(t){if(this.beds.length===0)return;const e=fn(t,0,.25),n=1-Math.exp(-4*e);for(const i of this.beds){const s=i.target-i.current;if(Math.abs(s)<5e-4){i.current!==i.target&&(i.current=i.target,i.gain.gain.value=i.current*i.scale);continue}i.current+=s*n,i.gain.gain.value=i.current*i.scale}}dispose(){for(const e of this.timers)clearTimeout(e);this.timers.clear();for(const e of this.permanentSources){try{e.stop()}catch{}Nn(e)}this.permanentSources=[];for(const e of this.permanent)Nn(e);this.permanent=[];for(const e of this.beds)Nn(e.gain);this.beds=[],this.wind=null,this.quake=null,this.water=null,this.hum=null,this.master&&Nn(this.master),this.comp&&Nn(this.comp),this.master=null,this.comp=null,this.whiteBuf=null,this.brownBuf=null,this.voices=0,this.impactStamps=[];const t=this.ctx;if(this.ctx=null,t)try{const e=t.close();e instanceof Promise&&e.catch(()=>{})}catch{}}buildGraph(t){const e=t.createDynamicsCompressor();e.threshold.value=-14,e.knee.value=24,e.ratio.value=3,e.attack.value=.004,e.release.value=.22,e.connect(t.destination);const n=t.createGain();n.gain.value=this._enabled?this.masterLevel:0,n.connect(e),this.comp=e,this.master=n,this.whiteBuf=Y0(t),this.brownBuf=K0(t);const i=this.buildWind(t,n),s=this.buildQuake(t,n),a=this.buildWater(t,n),o=this.buildSingularity(t,n);this.wind=i,this.quake=s,this.water=a,this.hum=o,this.beds=[i,s,a,o]}newBed(t,e,n){const i=t.createGain();return i.gain.value=0,i.connect(e),{gain:i,scale:n,target:0,current:0,sources:[],oscs:[],filters:[]}}buildWind(t,e){const n=this.newBed(t,e,.3),i=t.createGain();i.gain.value=.62,i.connect(n.gain);const s=t.createBiquadFilter();s.type="bandpass",s.frequency.value=520,s.Q.value=.75,s.connect(i);const a=this.loopNoise(t,this.whiteBuf,.9);a&&(a.connect(s),n.sources.push({node:a,base:.9}));const o=t.createOscillator();o.type="sine",o.frequency.value=.07;const l=t.createGain();l.gain.value=260,o.connect(l).connect(s.frequency),this.startPermanentOsc(o);const c=t.createOscillator();c.type="sine",c.frequency.value=.13;const h=t.createGain();return h.gain.value=.3,c.connect(h).connect(i.gain),this.startPermanentOsc(c),n.filters.push({node:s,base:s.frequency.value}),n.oscs.push({node:o,base:.07},{node:c,base:.13}),this.permanent.push(i,s,l,h),n}buildQuake(t,e){const n=this.newBed(t,e,.75),i=t.createBiquadFilter();i.type="lowpass",i.frequency.value=46,i.Q.value=1.2,i.connect(n.gain);const s=this.loopNoise(t,this.brownBuf,.22);s&&(s.connect(i),n.sources.push({node:s,base:.22}));const a=t.createOscillator();a.type="sine",a.frequency.value=21;const o=t.createGain();return o.gain.value=.45,a.connect(o).connect(n.gain),this.startPermanentOsc(a),n.filters.push({node:i,base:i.frequency.value}),n.oscs.push({node:a,base:21}),this.permanent.push(i,o),n}buildWater(t,e){const n=this.newBed(t,e,.26),i=t.createBiquadFilter();i.type="highpass",i.frequency.value=380,i.connect(n.gain);const s=t.createBiquadFilter();s.type="bandpass",s.frequency.value=1500,s.Q.value=.6,s.connect(i);const a=this.loopNoise(t,this.whiteBuf,1.35);a&&(a.connect(s),n.sources.push({node:a,base:1.35}));const o=t.createOscillator();o.type="sine",o.frequency.value=.31;const l=t.createGain();return l.gain.value=620,o.connect(l).connect(s.frequency),this.startPermanentOsc(o),n.filters.push({node:s,base:s.frequency.value},{node:i,base:i.frequency.value}),n.oscs.push({node:o,base:.31}),this.permanent.push(i,s,l),n}buildSingularity(t,e){const n=this.newBed(t,e,.34),i=t.createBiquadFilter();i.type="lowpass",i.frequency.value=520,i.Q.value=.9,i.connect(n.gain);const s=t.createBiquadFilter();s.type="bandpass",s.frequency.value=330,s.Q.value=7,s.connect(n.gain);const a=t.createOscillator();a.type="triangle",a.frequency.value=43.7;const o=t.createGain();o.gain.value=.55,a.connect(o).connect(i),this.startPermanentOsc(a);const l=t.createOscillator();l.type="sawtooth",l.frequency.value=65.9;const c=t.createGain();c.gain.value=.22,l.connect(c).connect(i),this.startPermanentOsc(l);const h=t.createOscillator();h.type="square",h.frequency.value=174.3;const u=t.createGain();u.gain.value=.16,h.connect(u).connect(s),this.startPermanentOsc(h);const f=t.createOscillator();f.type="sine",f.frequency.value=.09;const d=t.createGain();return d.gain.value=70,f.connect(d).connect(s.frequency),this.startPermanentOsc(f),n.filters.push({node:i,base:i.frequency.value},{node:s,base:s.frequency.value}),n.oscs.push({node:a,base:43.7},{node:l,base:65.9},{node:h,base:174.3},{node:f,base:.09}),this.permanent.push(i,s,o,c,u,d),n}startPermanentOsc(t){try{t.start()}catch{}this.permanentSources.push(t)}loopNoise(t,e,n){if(!e)return null;const i=t.createBufferSource();i.buffer=e,i.loop=!0,i.playbackRate.value=n;try{i.start()}catch{return null}return this.permanentSources.push(i),i}noise(t,e,n){if(!e)return null;const i=t.createBufferSource();return i.buffer=e,i.loop=!0,i.loopEnd=e.duration,i.playbackRate.value=n,i}playSource(t,e,n){t.onended=()=>{t.onended=null,Nn(t)};try{if(t instanceof AudioBufferSourceNode){const i=t.buffer;t.start(e,i?Math.random()*i.duration:0)}else t.start(e);t.stop(Math.max(n,e+.01))}catch{Nn(t)}}beginVoice(){const t=this.ctx,e=this.master;if(!t||!e||!this._enabled||this.voices>=gr.MAX_VOICES)return null;const n=t.createGain();return n.gain.value=1,n.connect(e),this.voices++,{ctx:t,t:t.currentTime+.005,bus:n}}endVoice(t,e){const n=Math.max(30,e*1e3+150),i=setTimeout(()=>{this.timers.delete(i),Nn(t),this.voices=this.voices>0?this.voices-1:0},n);this.timers.add(i)}};v(gr,"MAX_VOICES",28);let ro=gr;function Y0(r){const t=Math.floor(r.sampleRate*2),e=r.createBuffer(1,t,r.sampleRate),n=e.getChannelData(0);for(let i=0;i<t;i++)n[i]=Math.random()*2-1;return e}function K0(r){const t=Math.floor(r.sampleRate*2),e=r.createBuffer(1,t,r.sampleRate),n=e.getChannelData(0);let i=0;for(let s=0;s<t;s++){const a=Math.random()*2-1;i=(i+.02*a)/1.02,n[s]=fn(i*3.5,-1,1)}return e}const j0=5,as=150;class Z0{constructor(){v(this,"group",new Je);v(this,"light");v(this,"bolts",[]);for(let t=0;t<j0;t++){const e=new Float32Array(as*6),n=new Float32Array(as*6),i=new xe,s=new xe,a=new we(e,3),o=new we(n,3);a.setUsage(Ve),o.setUsage(Ve),i.setAttribute("position",a),s.setAttribute("position",o),i.setDrawRange(0,0),s.setDrawRange(0,0),i.boundingSphere=new Cn(new U(0,100,0),500),s.boundingSphere=i.boundingSphere;const l=new hl(i,new to({color:16777215,transparent:!0,opacity:1,blending:en,depthWrite:!1})),c=new hl(s,new to({color:10475775,transparent:!0,opacity:.85,blending:en,depthWrite:!1}));l.frustumCulled=!1,c.frustumCulled=!1,l.visible=!1,c.visible=!1,l.renderOrder=7,c.renderOrder=7,this.group.add(c,l),this.bolts.push({core:l,halo:c,coreGeo:i,haloGeo:s,corePos:e,haloPos:n,life:0,dur:.28,flick:0,active:!1})}this.light=new Su(14676223,0,130,1.6),this.light.visible=!1,this.group.add(this.light)}strike(t,e,n=150,i=16777215){let s=null;for(const _ of this.bolts)if(!_.active){s=_;break}s||(s=this.bolts[0]),s.active=!0,s.life=0,s.dur=.3,s.flick=0,s.core.material.color.setHex(i);let a=0;const o=(_,m,p,b,E,y,w,A)=>{const C=A*6;_[C]=m,_[C+1]=p,_[C+2]=b,_[C+3]=E,_[C+4]=y,_[C+5]=w},l=22;let c=t+(Math.random()-.5)*24,h=n,u=e+(Math.random()-.5)*24;const f=[];for(let _=0;_<l&&a<as-20;_++){const m=(_+1)/l,p=t+(c-t)*(1-m)*.55+(Math.random()-.5)*7*(1-m*.6),b=n*(1-m),E=e+(u-e)*(1-m)*.55+(Math.random()-.5)*7*(1-m*.6);o(s.corePos,c,h,u,p,b,E,a),o(s.haloPos,c+.7,h,u+.7,p+.7,b,E+.7,a),a++,Math.random()<.35&&f.push([p,b,E]),c=p,h=b,u=E}for(const[_,m,p]of f){if(a>=as-4)break;let b=_,E=m,y=p;const w=2+(Math.random()*4|0);let A=(Math.random()-.5)*12,C=(Math.random()-.5)*12;for(let L=0;L<w&&a<as-1;L++){const M=b+A*.6,x=E-Math.random()*9-3,P=y+C*.6;if(o(s.corePos,b,E,y,M,x,P,a),o(s.haloPos,b+.6,E,y+.6,M+.6,x,P+.6,a),a++,b=M,E=x,y=P,A*=.7,C*=.7,x<2)break}}s.coreGeo.setDrawRange(0,a*2),s.haloGeo.setDrawRange(0,a*2);const d=s.coreGeo.getAttribute("position"),g=s.haloGeo.getAttribute("position");d.clearUpdateRanges(),g.clearUpdateRanges(),d.addUpdateRange(0,a*6),g.addUpdateRange(0,a*6),d.needsUpdate=!0,g.needsUpdate=!0,s.core.visible=!0,s.halo.visible=!0,this.light.position.set(t,14,e),this.light.intensity=900,this.light.visible=!0}clear(){for(const t of this.bolts)t.active=!1,t.core.visible=!1,t.halo.visible=!1;this.light.visible=!1,this.light.intensity=0}update(t){for(const e of this.bolts){if(!e.active)continue;e.life+=t,e.flick+=t;const n=e.life/e.dur;if(n>=1){e.active=!1,e.core.visible=!1,e.halo.visible=!1;continue}const i=e.flick%.07<.045,s=(1-n)*(i?1:.25);e.core.material.opacity=s,e.halo.material.opacity=s*.7}this.light.visible&&(this.light.intensity*=Math.max(0,1-t*9),this.light.intensity<3&&(this.light.intensity=0,this.light.visible=!1))}}const Ci=10;class $0{constructor(t,e,n,i,s,a){v(this,"mesh");v(this,"count",0);v(this,"cap");v(this,"groups",[]);v(this,"lx");v(this,"ly");v(this,"lz");v(this,"sx");v(this,"sy");v(this,"sz");v(this,"cr");v(this,"cg");v(this,"cb");v(this,"gi");v(this,"mArr");v(this,"cArr");v(this,"rot",new Float32Array(Ci*9));v(this,"pos",new Float32Array(Ci*3));v(this,"q",new Gn);v(this,"m3",new Yt);v(this,"axis",new U);this.field=e,this.debris=n,this.killVoxel=i,this.hooks=s,this.debrisBudget=a,this.cap=t;const o=h=>new Float32Array(h);this.lx=o(t),this.ly=o(t),this.lz=o(t),this.sx=o(t),this.sy=o(t),this.sz=o(t),this.cr=o(t),this.cg=o(t),this.cb=o(t),this.gi=new Int32Array(t);for(let h=0;h<Ci;h++)this.groups.push({active:!1,mode:0,px:0,py:0,pz:0,axX:0,axY:1,axZ:0,angle:0,angVel:0,offY:0,velY:0,minY:0,reach:1,dirX:1,dirZ:0,dust:0,chunks:0});const l=new tn({color:16777215});this.mesh=new ui(new nn(1,1,1),l,t),this.mesh.instanceMatrix.setUsage(Ve);const c=new li(new Float32Array(t*3),3);c.setUsage(Ve),this.mesh.instanceColor=c,this.mesh.castShadow=!0,this.mesh.frustumCulled=!1,this.mesh.count=0,this.mArr=this.mesh.instanceMatrix.array,this.cArr=c.array}get activeGroups(){let t=0;for(const e of this.groups)e.active&&t++;return t}clear(){this.count=0,this.mesh.count=0;for(const t of this.groups)t.active=!1}spawnGroup(t,e,n,i,s){let a=-1;for(let u=0;u<Ci;u++)if(!this.groups[u].active){a=u;break}const o=this.cap-this.count;if(a<0||o<8){const u=Math.min(t.length,this.debrisBudget());for(let f=0;f<t.length;f++){const d=t[f];f<u&&this.debris.spawnFromVoxel(this.field,d,(Math.random()-.5)*6,Math.random()*4,(Math.random()-.5)*6),this.killVoxel(d)}this.hooks.onDust(n.x,n.y+2,n.z,14,6);return}const l=this.groups[a];l.active=!0,l.mode=e==="topple"?0:1,l.px=n.x,l.py=n.y,l.pz=n.z,this.axis.copy(i).normalize(),l.axX=this.axis.x,l.axY=this.axis.y,l.axZ=this.axis.z,l.angle=0,l.angVel=.12*s,l.offY=0,l.velY=0,l.dust=0,l.minY=1e9,l.reach=1,l.dirX=-this.axis.z,l.dirZ=this.axis.x;const c=Math.min(t.length,o);let h=0;for(let u=0;u<t.length;u++){const f=t[u];if(h<c){const d=this.count++;h++,this.lx[d]=this.field.posX[f]-n.x,this.ly[d]=this.field.posY[f]-n.y,this.lz[d]=this.field.posZ[f]-n.z,this.sx[d]=this.field.sclX[f],this.sy[d]=this.field.sclY[f],this.sz[d]=this.field.sclZ[f];const g=1-.6*this.field.burn[f];this.cr[d]=this.field.colR[f]*g,this.cg[d]=this.field.colG[f]*g,this.cb[d]=this.field.colB[f]*g,this.gi[d]=a,this.ly[d]<l.minY&&(l.minY=this.ly[d]);const _=Math.hypot(this.lx[d],this.ly[d],this.lz[d]);_>l.reach&&(l.reach=_)}else h>0&&u%3===0&&this.debris.spawnFromVoxel(this.field,f,(Math.random()-.5)*5,Math.random()*3,(Math.random()-.5)*5);this.killVoxel(f)}l.chunks=h,l.minY>1e8&&(l.minY=0),this.hooks.onDust(n.x,n.y+1.5,n.z,12,Math.min(10,l.reach*.4))}update(t){let e=!1;for(let n=0;n<Ci;n++){const i=this.groups[n];if(i.active)if(e=!0,i.mode===0){const s=11.5/Math.sqrt(Math.max(6,i.reach))*(.34+Math.sin(Math.min(1.57,i.angle)));if(i.angVel+=s*t,i.angle+=i.angVel*t,i.dust-=t,i.dust<=0){i.dust=.09;const a=Math.random();this.hooks.onDust(i.px+i.dirX*i.reach*a*.8+(Math.random()-.5)*4,.6+Math.random()*3,i.pz+i.dirZ*i.reach*a*.8+(Math.random()-.5)*4,2,3)}i.angle>=1.46&&this.land(n,i)}else i.velY-=27*t,i.offY+=i.velY*t,i.angle+=t*.22,i.dust-=t,i.dust<=0&&(i.dust=.07,this.hooks.onDust(i.px+(Math.random()-.5)*i.reach,i.py+i.offY+Math.random()*3,i.pz+(Math.random()-.5)*i.reach,2,3)),i.py+i.offY+i.minY<=.35&&this.land(n,i)}(e||this.count>0)&&this.write()}land(t,e){const n=this.debrisBudget();let i=0;const s=e.px+e.dirX*e.reach*.7,a=e.pz+e.dirZ*e.reach*.7;this.buildTransform(t,e);const o=this.rot,l=this.pos,c=t*9,h=t*3;for(let u=0;u<this.count;u++){if(this.gi[u]!==t)continue;const f=this.lx[u],d=this.ly[u],g=this.lz[u],_=l[h]+o[c]*f+o[c+3]*d+o[c+6]*g,m=l[h+1]+o[c+1]*f+o[c+4]*d+o[c+7]*g,p=l[h+2]+o[c+2]*f+o[c+5]*d+o[c+8]*g;if(i<n&&(u&1)===0){i++;const b=_-e.px,E=p-e.pz,y=Math.max(1,Math.hypot(b,E)),w=3+Math.random()*7;this.debris.spawn(_,Math.max(.4,m),p,b/y*w+e.dirX*3,2+Math.random()*7,E/y*w+e.dirZ*3,this.sx[u],this.sy[u],this.sz[u],this.cr[u],this.cg[u],this.cb[u])}else Math.random()<.1&&this.hooks.onDust(_,Math.max(.6,m),p,1,2)}e.active=!1,this.hooks.onLand(s,1,a,Math.min(1,e.reach/26),e.reach),this.compact()}compact(){let t=0;for(let e=0;e<this.count;e++)this.groups[this.gi[e]].active&&(t!==e&&(this.lx[t]=this.lx[e],this.ly[t]=this.ly[e],this.lz[t]=this.lz[e],this.sx[t]=this.sx[e],this.sy[t]=this.sy[e],this.sz[t]=this.sz[e],this.cr[t]=this.cr[e],this.cg[t]=this.cg[e],this.cb[t]=this.cb[e],this.gi[t]=this.gi[e]),t++);this.count=t,this.mesh.count=t}buildTransform(t,e){this.axis.set(e.axX,e.axY,e.axZ),this.q.setFromAxisAngle(this.axis,e.angle),this.m3.makeRotationFromQuaternion(this.q);const n=this.m3.elements,i=t*9;this.rot[i]=n[0],this.rot[i+1]=n[1],this.rot[i+2]=n[2],this.rot[i+3]=n[4],this.rot[i+4]=n[5],this.rot[i+5]=n[6],this.rot[i+6]=n[8],this.rot[i+7]=n[9],this.rot[i+8]=n[10];const s=t*3;this.pos[s]=e.px,this.pos[s+1]=e.py+e.offY,this.pos[s+2]=e.pz}write(){for(let o=0;o<Ci;o++){const l=this.groups[o];l.active&&this.buildTransform(o,l)}const t=this.mArr,e=this.cArr,n=this.rot,i=this.pos;for(let o=0;o<this.count;o++){const l=this.gi[o]*9,c=this.gi[o]*3,h=this.lx[o],u=this.ly[o],f=this.lz[o],d=o*16,g=this.sx[o],_=this.sy[o],m=this.sz[o];t[d]=n[l]*g,t[d+1]=n[l+1]*g,t[d+2]=n[l+2]*g,t[d+3]=0,t[d+4]=n[l+3]*_,t[d+5]=n[l+4]*_,t[d+6]=n[l+5]*_,t[d+7]=0,t[d+8]=n[l+6]*m,t[d+9]=n[l+7]*m,t[d+10]=n[l+8]*m,t[d+11]=0,t[d+12]=i[c]+n[l]*h+n[l+3]*u+n[l+6]*f,t[d+13]=i[c+1]+n[l+1]*h+n[l+4]*u+n[l+7]*f,t[d+14]=i[c+2]+n[l+2]*h+n[l+5]*u+n[l+8]*f,t[d+15]=1;const p=o*3;e[p]=this.cr[o],e[p+1]=this.cg[o],e[p+2]=this.cb[o]}this.mesh.count=this.count;const s=this.mesh.instanceMatrix;s.clearUpdateRanges(),this.count>0&&s.addUpdateRange(0,this.count*16),s.needsUpdate=!0;const a=this.mesh.instanceColor;a&&(a.clearUpdateRanges(),this.count>0&&a.addUpdateRange(0,this.count*3),a.needsUpdate=!0)}}class J0{constructor(){v(this,"vortices",[]);v(this,"wells",[]);v(this,"waterLevel",0);v(this,"waterCurrent",0);for(let t=0;t<2;t++)this.vortices.push({active:!1,x:0,z:0,radius:20,strength:0,top:60});for(let t=0;t<2;t++)this.wells.push({active:!1,x:0,y:10,z:0,radius:40,strength:0,eat:3})}reset(){for(const t of this.vortices)t.active=!1;for(const t of this.wells)t.active=!1;this.waterLevel=0,this.waterCurrent=0}get anyActive(){for(const t of this.vortices)if(t.active)return!0;for(const t of this.wells)if(t.active)return!0;return!1}}const Ot={x:0,y:0,z:0,eaten:!1};function Wi(r,t,e,n){Ot.x=0,Ot.y=0,Ot.z=0,Ot.eaten=!1;for(let i=0;i<r.vortices.length;i++){const s=r.vortices[i];if(!s.active)continue;const a=t-s.x,o=n-s.z,l=Math.hypot(a,o);if(l>s.radius||e>s.top)continue;const c=1-l/s.radius,h=1/Math.max(.7,l),u=a*h,f=o*h,d=s.strength*(.25+c*c*1.75);Ot.x+=-f*d*3.1-u*d*1.15,Ot.z+=u*d*3.1-f*d*1.15,Ot.y+=d*2.7*(1-Math.min(1,e/s.top)*.55)}for(let i=0;i<r.wells.length;i++){const s=r.wells[i];if(!s.active)continue;const a=s.x-t,o=s.y-e,l=s.z-n,c=Math.sqrt(a*a+o*o+l*l);if(c>s.radius)continue;if(c<s.eat){Ot.eaten=!0;continue}const h=1/c,u=s.strength*(1-c/s.radius)**1.4;Ot.x+=a*h*u*9,Ot.y+=o*h*u*9,Ot.z+=l*h*u*9,Ot.x+=-l*h*u*7.5,Ot.z+=a*h*u*7.5}}const Q0=36;class tg{constructor(t){v(this,"mesh");v(this,"count",0);v(this,"cap");v(this,"px");v(this,"py");v(this,"pz");v(this,"vx");v(this,"vy");v(this,"vz");v(this,"qx");v(this,"qy");v(this,"qz");v(this,"qw");v(this,"ax");v(this,"ay");v(this,"az");v(this,"sx");v(this,"sy");v(this,"sz");v(this,"cr");v(this,"cg");v(this,"cb");v(this,"rest");v(this,"age");v(this,"fade");v(this,"mArr");v(this,"cArr");v(this,"onImpact",null);this.cap=t;const e=a=>new Float32Array(a);this.px=e(t),this.py=e(t),this.pz=e(t),this.vx=e(t),this.vy=e(t),this.vz=e(t),this.qx=e(t),this.qy=e(t),this.qz=e(t),this.qw=e(t),this.ax=e(t),this.ay=e(t),this.az=e(t),this.sx=e(t),this.sy=e(t),this.sz=e(t),this.cr=e(t),this.cg=e(t),this.cb=e(t),this.rest=e(t),this.age=e(t),this.fade=e(t);const n=new nn(1,1,1),i=new tn({color:16777215});this.mesh=new ui(n,i,t),this.mesh.instanceMatrix.setUsage(Ve);const s=new li(new Float32Array(t*3),3);s.setUsage(Ve),this.mesh.instanceColor=s,this.mesh.castShadow=!0,this.mesh.receiveShadow=!1,this.mesh.frustumCulled=!1,this.mesh.count=0,this.mArr=this.mesh.instanceMatrix.array,this.cArr=s.array}clear(){this.count=0,this.mesh.count=0}slot(){if(this.count<this.cap)return this.count++;let t=0,e=-1;for(let n=0;n<10;n++){const i=Math.random()*this.count|0,s=this.rest[i]*2+this.age[i];s>e&&(e=s,t=i)}return t}spawn(t,e,n,i,s,a,o,l,c,h,u,f){const d=this.slot();this.px[d]=t,this.py[d]=e,this.pz[d]=n,this.vx[d]=i,this.vy[d]=s,this.vz[d]=a,this.qx[d]=0,this.qy[d]=0,this.qz[d]=0,this.qw[d]=1;const g=3+Math.random()*9;this.ax[d]=(Math.random()-.5)*g,this.ay[d]=(Math.random()-.5)*g,this.az[d]=(Math.random()-.5)*g,this.sx[d]=o,this.sy[d]=l,this.sz[d]=c,this.cr[d]=h,this.cg[d]=u,this.cb[d]=f,this.rest[d]=0,this.age[d]=0,this.fade[d]=1}spawnFromVoxel(t,e,n,i,s,a=1){this.spawn(t.posX[e],t.posY[e],t.posZ[e],n,i,s,t.sclX[e]*.92,Math.max(.22,t.sclY[e]*.92),t.sclZ[e]*.92,t.colR[e]*a,t.colG[e]*a,t.colB[e]*a)}free(t){const e=this.count-1;if(t!==e){const n=i=>{i[t]=i[e]};n(this.px),n(this.py),n(this.pz),n(this.vx),n(this.vy),n(this.vz),n(this.qx),n(this.qy),n(this.qz),n(this.qw),n(this.ax),n(this.ay),n(this.az),n(this.sx),n(this.sy),n(this.sz),n(this.cr),n(this.cg),n(this.cb),n(this.rest),n(this.age),n(this.fade)}this.count=e}update(t,e,n){if(t<=0){this.write();return}const i=n.anyActive,s=n.waterLevel;for(let a=this.count-1;a>=0;a--){this.age[a]+=t;let o=this.vx[a],l=this.vy[a],c=this.vz[a];const h=this.sy[a]*.5;if(l-=Q0*t,i){if(Wi(n,this.px[a],this.py[a],this.pz[a]),Ot.eaten){this.free(a);continue}o+=Ot.x*t,l+=Ot.y*t,c+=Ot.z*t}let u=!1;if(s>.05&&this.py[a]<s){u=!0;const b=Math.min(3,s-this.py[a]);if(l+=(18+b*6)*t,o*=1-2.4*t,c*=1-2.4*t,l*=1-3.2*t,n.waterCurrent>0){const E=this.px[a],y=this.pz[a],w=Math.max(1,Math.hypot(E,y));o+=E/w*n.waterCurrent*t,c+=y/w*n.waterCurrent*t}}const f=1-(u?1.6:.42)*t;o*=f,l*=f,c*=f,this.px[a]+=o*t,this.py[a]+=l*t,this.pz[a]+=c*t;let d=0;const g=e.surfaceAt(this.px[a],this.pz[a]);if(g>0&&this.py[a]-h>g-3&&(d=g),u&&s>d+.4&&(this.py[a]<s-.4&&(this.py[a]+=Math.min(6*t,s-.4-this.py[a])),this.rest[a]+=t*.35),this.py[a]-h<d){this.py[a]=d+h;const b=-l;b>2.6?(l=b*.3,o*=.64,c*=.64,this.ax[a]*=.55,this.ay[a]*=.55,this.az[a]*=.55,b>7&&this.onImpact&&Math.random()<.22&&this.onImpact(this.px[a],this.py[a],this.pz[a],Math.min(1,b/26))):(l=0,o*=1-7*t,c*=1-7*t,this.ax[a]*=1-8*t,this.ay[a]*=1-8*t,this.az[a]*=1-8*t,Math.abs(o)+Math.abs(c)<.6&&(this.rest[a]+=t))}else this.py[a]>d+h+.2&&(this.rest[a]=Math.max(0,this.rest[a]-t*2));this.vx[a]=o,this.vy[a]=l,this.vz[a]=c;const _=this.ax[a],m=this.ay[a],p=this.az[a];if(_*_+m*m+p*p>1e-5){const b=this.qx[a],E=this.qy[a],y=this.qz[a],w=this.qw[a],A=t*.5;let C=b+A*(_*w+m*y-p*E),L=E+A*(m*w+p*b-_*y),M=y+A*(p*w+_*E-m*b),x=w-A*(_*b+m*E+p*y);const P=Math.hypot(C,L,M,x)||1;C/=P,L/=P,M/=P,x/=P,this.qx[a]=C,this.qy[a]=L,this.qz[a]=M,this.qw[a]=x}if((this.rest[a]>5.2||this.age[a]>40)&&(this.fade[a]-=t*1.35,this.fade[a]<=0)){this.free(a);continue}(this.py[a]<-60||Math.abs(this.px[a])>620||Math.abs(this.pz[a])>620)&&this.free(a)}this.write()}write(){const t=this.mArr,e=this.cArr;for(let s=0;s<this.count;s++){const a=this.qx[s],o=this.qy[s],l=this.qz[s],c=this.qw[s],h=a+a,u=o+o,f=l+l,d=a*h,g=a*u,_=a*f,m=o*u,p=o*f,b=l*f,E=c*h,y=c*u,w=c*f,A=this.fade[s],C=this.sx[s]*A,L=this.sy[s]*A,M=this.sz[s]*A,x=s*16;t[x]=(1-(m+b))*C,t[x+1]=(g+w)*C,t[x+2]=(_-y)*C,t[x+3]=0,t[x+4]=(g-w)*L,t[x+5]=(1-(d+b))*L,t[x+6]=(p+E)*L,t[x+7]=0,t[x+8]=(_+y)*M,t[x+9]=(p-E)*M,t[x+10]=(1-(d+m))*M,t[x+11]=0,t[x+12]=this.px[s],t[x+13]=this.py[s],t[x+14]=this.pz[s],t[x+15]=1;const P=s*3;e[P]=this.cr[s],e[P+1]=this.cg[s],e[P+2]=this.cb[s]}this.mesh.count=this.count;const n=this.mesh.instanceMatrix;n.clearUpdateRanges(),this.count>0&&n.addUpdateRange(0,this.count*16),n.needsUpdate=!0;const i=this.mesh.instanceColor;i&&(i.clearUpdateRanges(),this.count>0&&i.addUpdateRange(0,this.count*3),i.needsUpdate=!0)}}function eg(){const t=document.createElement("canvas");t.width=128,t.height=128;const e=t.getContext("2d");if(e){const i=e.createRadialGradient(64,64,0,64,64,64);i.addColorStop(0,"rgba(255,255,255,1)"),i.addColorStop(.55,"rgba(255,255,255,0.86)"),i.addColorStop(.82,"rgba(255,255,255,0.34)"),i.addColorStop(1,"rgba(255,255,255,0)"),e.fillStyle=i,e.fillRect(0,0,128,128),e.globalCompositeOperation="destination-out";for(let s=0;s<90;s++){const a=s/90*Math.PI*2,o=128*.36+Math.random()*128*.16,l=3+Math.random()*9;e.beginPath(),e.arc(128/2+Math.cos(a)*o,128/2+Math.sin(a)*o,l,0,Math.PI*2),e.fillStyle=`rgba(0,0,0,${.1+Math.random()*.28})`,e.fill()}}const n=new gu(t);return n.colorSpace=Xe,n}const jl=54;class ng{constructor(){v(this,"group",new Je);v(this,"pool",[]);v(this,"cursor",0);v(this,"tex");this.tex=eg();const t=new fi(1,1);t.rotateX(-Math.PI/2);for(let e=0;e<jl;e++){const n=new Wn({map:this.tex,transparent:!0,opacity:0,depthWrite:!1,polygonOffset:!0,polygonOffsetFactor:-3,polygonOffsetUnits:-3,side:Le}),i=new ee(t,n);i.visible=!1,i.frustumCulled=!1,i.renderOrder=2,this.group.add(i),this.pool.push({mesh:i,mat:n,used:!1})}}add(t,e,n,i,s,a=.18){const o=this.pool[this.cursor];this.cursor=(this.cursor+1)%jl,o.used=!0,o.mesh.visible=!0,o.mesh.position.set(t,a,e),o.mesh.scale.set(n*2,1,n*2),o.mesh.rotation.y=Math.random()*Math.PI*2,o.mat.color.setHex(i),o.mat.opacity=s}crater(t,e,n){this.add(t,e,n*1.45,2892056,.42,.17),this.add(t,e,n*1,1709072,.72,.19),this.add(t,e,n*.62,854536,.9,.21),this.add(t,e,n*.34,5913124,.5,.23)}scorch(t,e,n,i=1){this.add(t,e,n*1.25,3812384,.3*i,.17),this.add(t,e,n*.8,1511952,.62*i,.19)}clear(){for(const t of this.pool)t.used=!1,t.mesh.visible=!1,t.mat.opacity=0;this.cursor=0}}class Zl{constructor(t,e){v(this,"points");v(this,"count",0);v(this,"cap");v(this,"px");v(this,"py");v(this,"pz");v(this,"vx");v(this,"vy");v(this,"vz");v(this,"life");v(this,"maxLife");v(this,"s0");v(this,"s1");v(this,"cr");v(this,"cg");v(this,"cb");v(this,"al");v(this,"grav");v(this,"drag");v(this,"fs");v(this,"posAttr");v(this,"colAttr");v(this,"sizeAttr");v(this,"posArr");v(this,"colArr");v(this,"sizeArr");v(this,"uScale",{value:700});this.cap=t;const n=a=>new Float32Array(a);this.px=n(t),this.py=n(t),this.pz=n(t),this.vx=n(t),this.vy=n(t),this.vz=n(t),this.life=n(t),this.maxLife=n(t),this.s0=n(t),this.s1=n(t),this.cr=n(t),this.cg=n(t),this.cb=n(t),this.al=n(t),this.grav=n(t),this.drag=n(t),this.fs=n(t),this.posArr=new Float32Array(t*3),this.colArr=new Float32Array(t*4),this.sizeArr=new Float32Array(t);const i=new xe;this.posAttr=new we(this.posArr,3),this.colAttr=new we(this.colArr,4),this.sizeAttr=new we(this.sizeArr,1),this.posAttr.setUsage(Ve),this.colAttr.setUsage(Ve),this.sizeAttr.setUsage(Ve),i.setAttribute("position",this.posAttr),i.setAttribute("aColor",this.colAttr),i.setAttribute("aSize",this.sizeAttr),i.setDrawRange(0,0),i.boundingSphere=new Cn(new U(0,40,0),900);const s=new de({uniforms:{uScale:this.uScale},transparent:!0,depthWrite:!1,depthTest:!0,blending:e?en:ai,vertexShader:`
        attribute vec4 aColor;
        attribute float aSize;
        uniform float uScale;
        varying vec4 vColor;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max( 1.0, aSize * uScale / max( 0.5, -mv.z ) );
        }`,fragmentShader:`
        varying vec4 vColor;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r2 = dot( d, d );
          if ( r2 > 0.25 ) discard;
          float a = ${e?"smoothstep( 0.25, 0.0, r2 )":"smoothstep( 0.25, 0.03, r2 ) * 0.92"};
          gl_FragColor = vec4( vColor.rgb, vColor.a * a );
        }`});this.points=new mu(i,s),this.points.frustumCulled=!1,this.points.renderOrder=e?6:5}setProjection(t,e){this.uScale.value=t*.5*e}clear(){this.count=0,this.points.geometry.setDrawRange(0,0)}spawn(t,e,n,i,s,a,o,l,c,h,u,f,d,g,_,m=.5){let p;this.count<this.cap?p=this.count++:p=Math.random()*this.cap|0,this.px[p]=t,this.py[p]=e,this.pz[p]=n,this.vx[p]=i,this.vy[p]=s,this.vz[p]=a,this.life[p]=o,this.maxLife[p]=o,this.s0[p]=l,this.s1[p]=c,this.cr[p]=h,this.cg[p]=u,this.cb[p]=f,this.al[p]=d,this.grav[p]=g,this.drag[p]=_,this.fs[p]=m}free(t){const e=this.count-1;if(t!==e){const n=i=>{i[t]=i[e]};n(this.px),n(this.py),n(this.pz),n(this.vx),n(this.vy),n(this.vz),n(this.life),n(this.maxLife),n(this.s0),n(this.s1),n(this.cr),n(this.cg),n(this.cb),n(this.al),n(this.grav),n(this.drag),n(this.fs)}this.count=e}update(t,e){const n=e!==null&&e.anyActive;for(let i=this.count-1;i>=0;i--){if(this.life[i]-=t,this.life[i]<=0){this.free(i);continue}let s=this.vx[i],a=this.vy[i],o=this.vz[i];if(a+=this.grav[i]*t,n&&e&&this.fs[i]>0){Wi(e,this.px[i],this.py[i],this.pz[i]);const c=this.fs[i]*t;s+=Ot.x*c,a+=Ot.y*c,o+=Ot.z*c}const l=1-this.drag[i]*t;s*=l,a*=l,o*=l,this.px[i]+=s*t,this.py[i]+=a*t,this.pz[i]+=o*t,this.py[i]<.15&&(this.py[i]=.15,a=Math.abs(a)*.12,s*=.9,o*=.9),this.vx[i]=s,this.vy[i]=a,this.vz[i]=o}this.write()}write(){const t=this.posArr,e=this.colArr,n=this.sizeArr;for(let s=0;s<this.count;s++){const a=1-this.life[s]/this.maxLife[s],o=s*3;t[o]=this.px[s],t[o+1]=this.py[s],t[o+2]=this.pz[s];const l=s*4,c=a<.12?a/.12:1-(a-.12)/.88;e[l]=this.cr[s],e[l+1]=this.cg[s],e[l+2]=this.cb[s],e[l+3]=this.al[s]*Math.max(0,c),n[s]=this.s0[s]+(this.s1[s]-this.s0[s])*a}const i=this.count;this.points.geometry.setDrawRange(0,i),this.posAttr.clearUpdateRanges(),this.colAttr.clearUpdateRanges(),this.sizeAttr.clearUpdateRanges(),i>0&&(this.posAttr.addUpdateRange(0,i*3),this.colAttr.addUpdateRange(0,i*4),this.sizeAttr.addUpdateRange(0,i)),this.posAttr.needsUpdate=!0,this.colAttr.needsUpdate=!0,this.sizeAttr.needsUpdate=!0}}class ig{constructor(t,e){v(this,"trauma",0);v(this,"flashAmount",0);v(this,"flashDecay",4);v(this,"exposure",1);v(this,"exposureTarget",1);v(this,"t",0);v(this,"rumble",0);v(this,"baseVignette");this.camera=t,this.grade=e,this.baseVignette=e.uVignette.value}shake(t){this.trauma=Math.min(1.3,this.trauma+t)}setRumble(t){this.rumble=t}flash(t,e,n=4){this.grade.uFlashColor.value.setHex(t),this.flashAmount=Math.max(this.flashAmount,e),this.flashDecay=n}kickExposure(t){this.exposureTarget=t}reset(){this.trauma=0,this.rumble=0,this.flashAmount=0,this.exposure=1,this.exposureTarget=1,this.grade.uFlashAmount.value=0,this.grade.uExposure.value=1,this.grade.uVignette.value=this.baseVignette}update(t){this.t+=t;const e=this.trauma*this.trauma+this.rumble*this.rumble*.55;if(e>2e-5){const n=e*2.6,i=this.t,s=Math.sin(i*47.3)*.6+Math.sin(i*23.1)*.4,a=Math.sin(i*39.7+1.7)*.6+Math.sin(i*61.3)*.4,o=Math.sin(i*53.9+.6)*.6+Math.sin(i*31.7)*.4;this.camera.position.x+=s*n,this.camera.position.y+=a*n*.8,this.camera.position.z+=o*n,this.camera.rotation.z+=Math.sin(i*33.1)*e*.02,this.camera.updateMatrixWorld()}this.trauma=Math.max(0,this.trauma-t*(.9+this.trauma*1.6)),this.flashAmount>5e-4?(this.flashAmount*=Math.max(0,1-t*this.flashDecay),this.grade.uFlashAmount.value=this.flashAmount):this.grade.uFlashAmount.value!==0&&(this.flashAmount=0,this.grade.uFlashAmount.value=0),this.exposure+=(this.exposureTarget-this.exposure)*Math.min(1,t*3.4),this.grade.uExposure.value=this.exposure,this.exposureTarget+=(1-this.exposureTarget)*Math.min(1,t*1.6)}}const sg=18,rg=12;class ag{constructor(){v(this,"group",new Je);v(this,"rings",[]);v(this,"spheres",[]);v(this,"sphereUniforms",[]);const t=new Fi(.7,1,80,1);t.rotateX(-Math.PI/2);for(let n=0;n<sg;n++){const i=new Wn({color:16777215,transparent:!0,opacity:0,blending:en,depthWrite:!1,side:Le,toneMapped:!0}),s=new ee(t,i);s.visible=!1,s.frustumCulled=!1,s.renderOrder=4,this.group.add(s),this.rings.push({mesh:s,mat:i,t:0,dur:1,r0:1,r1:10,flat:1,alpha:1,active:!1})}const e=new Vi(1,28,18);for(let n=0;n<rg;n++){const i={uColor:{value:new vt(16777215)},uOpacity:{value:0},uCore:{value:0}};this.sphereUniforms.push(i);const s=new de({uniforms:i,transparent:!0,depthWrite:!1,blending:en,side:Le,vertexShader:`
          varying vec3 vN; varying vec3 vP;
          void main() {
            vN = normalize( normalMatrix * normal );
            vec4 mv = modelViewMatrix * vec4( position, 1.0 );
            vP = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,fragmentShader:`
          uniform vec3 uColor; uniform float uOpacity; uniform float uCore;
          varying vec3 vN; varying vec3 vP;
          void main() {
            vec3 V = normalize( -vP );
            float rim = pow( 1.0 - abs( dot( normalize( vN ), V ) ), 2.4 );
            float a = mix( rim, 0.55 + rim * 0.85, uCore );
            gl_FragColor = vec4( uColor * a * uOpacity, 1.0 );
          }`}),a=new ee(e,s);a.visible=!1,a.frustumCulled=!1,a.renderOrder=4,this.group.add(a),this.spheres.push({mesh:a,mat:s,t:0,dur:1,r0:1,r1:10,flat:1,alpha:1,active:!1})}}take(t){for(const i of t)if(!i.active)return i;let e=t[0],n=-1;for(const i of t){const s=i.t/i.dur;s>n&&(n=s,e=i)}return e}ring(t,e,n,i,s,a,o,l=1){const c=this.take(this.rings);c.active=!0,c.t=0,c.dur=a,c.r0=i,c.r1=s,c.alpha=l,c.flat=1,c.mesh.visible=!0,c.mesh.position.set(t,e,n),c.mat.color.setHex(o)}sphere(t,e,n,i,s,a,o,l=1,c=0,h=1){const u=this.spheres.indexOf(this.take(this.spheres)),f=this.spheres[u];f.active=!0,f.t=0,f.dur=a,f.r0=i,f.r1=s,f.alpha=l,f.flat=h,f.mesh.visible=!0,f.mesh.position.set(t,e,n),this.sphereUniforms[u].uColor.value.setHex(o),this.sphereUniforms[u].uCore.value=c}clear(){for(const t of this.rings)t.active=!1,t.mesh.visible=!1;for(const t of this.spheres)t.active=!1,t.mesh.visible=!1}update(t){for(const e of this.rings){if(!e.active)continue;e.t+=t;const n=Math.min(1,e.t/e.dur),i=e.r0+(e.r1-e.r0)*(1-(1-n)*(1-n));e.mesh.scale.set(i,1,i),e.mat.opacity=e.alpha*(1-n)*(1-n),n>=1&&(e.active=!1,e.mesh.visible=!1)}for(let e=0;e<this.spheres.length;e++){const n=this.spheres[e];if(!n.active)continue;n.t+=t;const i=Math.min(1,n.t/n.dur),s=n.r0+(n.r1-n.r0)*(1-(1-i)*(1-i)*(1-i));n.mesh.scale.set(s,s*n.flat,s),this.sphereUniforms[e].uOpacity.value=n.alpha*(1-i)**1.6,i>=1&&(n.active=!1,n.mesh.visible=!1)}}}const og=[14677759,13233663,11066623],lg=[15002866,14076342,13621469,15785924],cg=16050905,hg=10120003,ug=[8377482,6734971,10149531,5618030],fg=[16744348,16765286,16752491,13081599,16773544];function $l(r,t,e,n,i){const{cx:s,cz:a,w:o,d:l,levels:c,id:h}=t,u=e.pick(og),f=e.pick(pr),d=e.pick(lg),g=i===3,_=new Array(c+3).fill(0),m=t.landmark&&o>7?Math.max(6,Math.floor(c*.45)):-1,p=(M,x,P,F,B,k,V,X,Z,W=1)=>{t.ids.push(r.add(M,x,P,F,B,k,V,h,X,Z,W)),_[X]++};let b=o,E=l;for(let M=0;M<c;M++){m>0&&M===m&&(b=Math.max(3,b-2),E=Math.max(3,E-2)),m>0&&M===m*2&&(b=Math.max(3,b-2),E=Math.max(3,E-2));const x=s-b/2+.5,P=a-E/2+.5,F=M+.5,B=i===1&&M>0&&M%4===0;for(let k=0;k<b;k++)for(let V=0;V<E;V++){if(!(k===0||V===0||k===b-1||V===E-1))continue;const Z=(k===0||k===b-1)&&(V===0||V===E-1);let W=n,rt=U0,ct=Z?.9:1;B?W=f:i===2&&!Z&&(k+V)%3===0&&(W=f,ct=.96);const St=!Z&&M>0,Vt=g?M%1===0:M%2===1;St&&Vt&&(g||(k+V)%2===0)&&(W=u,rt=I0,ct=1),M===0&&!Z&&(k===b>>1&&V===0||V===E>>1&&k===0)&&(W=7035470,ct=1),p(x+k,F,P+V,1,1,1,W,M,rt,ct)}if(M%3===2&&b>3&&E>3)for(let k=1;k<b-1;k++)for(let V=1;V<E-1;V++)p(x+k,F-.42,P+V,1,.16,1,cg,M,F0,1);if(!g&&M>0&&M%4===0&&b>4&&E>4)for(let k=0;k<b;k++)for(let V=0;V<E;V++)(k===0||V===0||k===b-1||V===E-1)&&p(x+k,F-.46,P+V,1.28,.2,1.28,f,M,Te,1.04)}const y=c+.5,w=s-b/2+.5,A=a-E/2+.5,C=Math.min(c,254);for(let M=0;M<b;M++)for(let x=0;x<E;x++){const P=M===0||x===0||M===b-1||x===E-1;p(w+M,y,A+x,1,1,1,d,C,Yl,P?.95:1)}for(let M=0;M<b;M++)for(let x=0;x<E;x++)(M===0||x===0||M===b-1||x===E-1)&&p(w+M,y+.85,A+x,1,.7,1,f,C,Yl,.92);const L=e.int(1,3);for(let M=0;M<L;M++){const x=w+e.int(1,Math.max(1,b-2)),P=A+e.int(1,Math.max(1,E-2)),F=e.next();if(F<.4&&b>4){for(let B=0;B<2;B++)for(let k=0;k<2;k++)p(x+B-.5,y+1.6,P+k-.5,1,2,1,12569041,C,Te,1);p(x,y+3.1,P,2.2,.4,2.2,9411235,C,Te,1)}else if(F<.75)p(x,y+1.1,P,1.6,.9,1.6,14212835,C,Te,1);else{const B=e.range(3,7);p(x,y+B/2+.5,P,.22,B,.22,15231578,C,Te,1),p(x,y+B+.6,P,.5,.5,.5,16769126,C,Te,1)}}t.levelTotal=_}function Ks(r,t,e,n,i=1){const s=Math.round(t.range(2,4)*i),a=t.pick(ug);for(let l=0;l<s;l++)r.add(e,l+.5,n,.6,1,.6,hg,-1,0,Te,1);const o=(i>.9,1);for(let l=-o;l<=o;l++)for(let c=-o;c<=o;c++)for(let h=0;h<3;h++)Math.abs(l)===o&&Math.abs(c)===o&&(h===0||h===2)||r.add(e+l,s+h+.5,n+c,1,1,1,a,-1,0,Kl,h===2?1.08:.94);r.add(e,s+3.2,n,1,1,1,a,-1,0,Kl,1.1)}function sa(r,t,e){r.add(t,2,e,.22,4,.22,9279910,-1,0,Te,1),r.add(t,4.2,e,.7,.45,.7,16773808,-1,0,Te,1.2)}function Jl(r,t,e,n){r.add(t,.55,e,2.4,.22,.7,13209426,-1,0,Te,1),r.add(t,.25,e,2.4*.8,.3,.7*.8,10132122,-1,0,Te,1)}function dg(r,t,e,n){const i=t.pick(pr);r.add(e,1,n,2.2,2,2.2,i,-1,0,Te,1),r.add(e,2.2,n,2.8,.35,2.8,16117990,-1,0,Te,1)}function pg(r=20240617){const t=new _s(r),e=new O0,n=[],i=[];let s=null;const a=(fe-1)/2,o=new Set(["1,4","4,1","0,2"]),l=new Set(["2,2"]);for(let c=0;c<fe;c++)for(let h=0;h<fe;h++){const u=`${c},${h}`,f=Hn(c),d=Hn(h),g=f+Ht/2,_=d+Ht/2,m=Math.max(Math.abs(c-a),Math.abs(h-a))/a;if(o.has(u)){i.push({x:g,z:_,r:Ht/2});const y=t.int(7,10);for(let w=0;w<y;w++){const A=Math.round(f+t.range(2,Ht-2)),C=Math.round(d+t.range(2,Ht-2));Ks(e,t,A,C,t.range(.85,1.15))}for(let w=0;w<16;w++){const A=Math.round(f+t.range(1,Ht-1)),C=Math.round(d+t.range(1,Ht-1));e.add(A,.35,C,1,.7,1,t.pick(fg),-1,0,Te,1.1)}Jl(e,g-3,_),Jl(e,g+3,_);continue}if(l.has(u)){s={x:g,z:_};const y=4;for(let w=0;w<40;w++){const A=w/40*Math.PI*2,C=Math.round(g+Math.cos(A)*y),L=Math.round(_+Math.sin(A)*y);e.add(C,.5,L,1,1,1,15327955,-1,0,Te,1)}for(let w=-y+1;w<=y-1;w++)for(let A=-y+1;A<=y-1;A++)w*w+A*A>(y-1)*(y-1)||e.add(g+w,.32,_+A,1,.28,1,8311807,-1,0,Te,1.15);e.add(g,1.6,_,1.4,3,1.4,15920352,-1,0,Te,1),e.add(g,3.4,_,2.6,.5,2.6,15920352,-1,0,Te,1);for(let w=0;w<4;w++){const A=w/4*Math.PI*2+.4;Ks(e,t,Math.round(g+Math.cos(A)*6),Math.round(_+Math.sin(A)*6),1)}sa(e,g-6,_-6),sa(e,g+6,_+6);continue}const p=m<.5&&t.bool(.75),b=t.next();let E;p?E=[{x:g,z:_,w:9,d:9}]:b<.34?E=[{x:f+4,z:d+4,w:6,d:6},{x:f+10,z:d+4,w:6,d:6},{x:f+4,z:d+10,w:6,d:6},{x:f+10,z:d+10,w:6,d:6}]:b<.56?E=[{x:f+4,z:_,w:6,d:12},{x:f+10,z:_,w:6,d:12}]:b<.74?E=[{x:g,z:d+4,w:12,d:6},{x:g,z:d+10,w:12,d:6}]:b<.9?E=[{x:g,z:d+4,w:12,d:6},{x:f+4,z:d+10,w:6,d:6},{x:f+10,z:d+10,w:6,d:6}]:E=[{x:g,z:_,w:11,d:11}],E.length>2&&t.bool(.08)&&E.splice(t.int(0,E.length-1),1);for(const y of E){const w=p||m<.55&&t.bool(.18);let A;w?A=t.int(26,44):A=Math.max(3,Math.round(6+(1-m)*13+t.range(-1,7)));const C={id:n.length,cx:y.x,cz:y.z,w:y.w,d:y.d,levels:A,landmark:w,ids:[],levelTotal:[]},L=w?t.bool(.5)?3:1:t.int(0,2);$l(e,C,t,t.pick(pr),L),n.push(C)}t.bool(.5)&&dg(e,t,f+t.int(2,Ht-2),d-1.6),t.bool(.45)&&Ks(e,t,f+t.int(2,Ht-2),d+Ht+1.6,.85)}for(let c=0;c<=fe;c++)for(let h=0;h<=fe;h++){const u=-kt+c*(Ht+6)+1.2,f=-kt+h*(Ht+6)+1.2;Math.abs(u)>kt-1||Math.abs(f)>kt-1||sa(e,u,f)}for(let c=0;c<26;c++){const h=c%4,u=t.range(-kt+6,kt-6),f=kt+t.range(6,22),d=h===0?u:h===1?f:h===2?u:-f,g=h===0?-f:h===1?u:h===2?f:u,_={id:n.length,cx:Math.round(d),cz:Math.round(g),w:t.int(4,6),d:t.int(4,6),levels:t.int(2,4),landmark:!1,ids:[],levelTotal:[]};$l(e,_,t,t.pick(pr),0),n.push(_),t.bool(.7)&&Ks(e,t,_.cx+t.int(-5,5),_.cz+t.int(-5,5),.9)}return{builder:e,buildings:n,parks:i,fountain:s}}class mg{constructor(t,e){v(this,"states",[]);v(this,"dirty",[]);v(this,"dirtySet",new Set);v(this,"collapses",0);this.field=t;for(const n of e){const i=new Int32Array(n.levels+3);for(let s=0;s<n.levelTotal.length&&s<i.length;s++)i[s]=n.levelTotal[s];this.states.push({...n,idArr:new Int32Array(n.ids),total:n.ids.length,alive:n.ids.length,levelAlive:i.slice(),levelTotalArr:i,destroyed:!1,gone:!1,hitX:0,hitZ:0,cool:0})}}reset(){for(const t of this.states)t.alive=t.total,t.levelAlive.set(t.levelTotalArr),t.destroyed=!1,t.gone=!1,t.hitX=0,t.hitZ=0,t.cool=0;this.dirty.length=0,this.dirtySet.clear(),this.collapses=0}notifyKilled(t){const e=this.field.building[t];if(e<0)return;const n=this.states[e];if(!n)return;n.alive--;const i=this.field.level[t];i<n.levelAlive.length&&n.levelAlive[i]--,this.dirtySet.has(e)||(this.dirtySet.add(e),this.dirty.push(e))}pushDirection(t,e,n){const i=this.field.building[t];if(i<0)return;const s=this.states[i];s&&(s.hitX+=e,s.hitZ+=n)}damageOf(t){const e=this.states[t];return e?1-e.alive/Math.max(1,e.total):0}weakenAll(){return this.states}aliveVoxelsOf(t,e,n,i){i.length=0;const s=t.idArr;for(let a=0;a<s.length;a++){const o=s[a];if(this.field.alive[o]!==0&&!(this.field.level[o]<e)&&(i.push(o),i.length>=n))return}}randomAliveVoxel(t,e=255){const n=this.states[t];if(!n||n.gone||n.alive===0)return-1;const i=n.idArr;for(let s=0;s<26;s++){const a=i[Math.random()*i.length|0];if(this.field.alive[a]!==0&&!(this.field.level[a]>e))return a}return-1}evaluate(t,e,n){for(const s of this.states)s.cool>0&&(s.cool-=e);if(this.dirty.length===0)return;const i=Math.min(this.dirty.length,12);for(let s=0;s<i;s++){const a=this.dirty.shift();if(a===void 0)break;this.dirtySet.delete(a);const o=this.states[a];if(!o||o.gone||o.cool>0)continue;if(o.alive===0){o.gone=!0;continue}const l=1-o.alive/o.total;let c=-1;for(let u=0;u<o.levels;u++){const f=o.levelTotalArr[u];if(!(f<4)&&o.levelAlive[u]/f<.42){c=u;break}}if(c>=0&&c<=2||l>.34-.1*n||o.landmark&&l>.26){this.topple(o,t);continue}if(c>=3){const u=[];if(this.aliveVoxelsOf(o,c+1,1400,u),u.length>8){const f=new U(o.cx,c+1,o.cz);t.spawnGroup(u,"fall",f,new U(0,1,0),.5),o.cool=.6,this.collapses++}}}}topple(t,e){const n=[];if(this.aliveVoxelsOf(t,0,2400,n),n.length<4){t.gone=!0;return}let i=t.hitX,s=t.hitZ;const a=Math.hypot(i,s);if(a<.001){const h=t.id*2.399963%(Math.PI*2);i=Math.cos(h),s=Math.sin(h)}else i/=a,s/=a;const o=Math.max(t.w,t.d)*.5,l=new U(t.cx-i*o*.85,.1,t.cz-s*o*.85),c=new U(-s,0,i).normalize();e.spawnGroup(n,"topple",l,c,1),t.gone=!0,this.collapses++}}function gg(r,t=!1){const e=r[0].index!==null,n=new Set(Object.keys(r[0].attributes)),i=new Set(Object.keys(r[0].morphAttributes)),s={},a={},o=r[0].morphTargetsRelative,l=new xe;let c=0;for(let h=0;h<r.length;++h){const u=r[h];let f=0;if(e!==(u.index!==null))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."),null;for(const d in u.attributes){if(!n.has(d))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+'. All geometries must have compatible attributes; make sure "'+d+'" attribute exists among all geometries, or in none of them.'),null;s[d]===void 0&&(s[d]=[]),s[d].push(u.attributes[d]),f++}if(f!==n.size)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". Make sure all geometries have the same number of attributes."),null;if(o!==u.morphTargetsRelative)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". .morphTargetsRelative must be consistent throughout all geometries."),null;for(const d in u.morphAttributes){if(!i.has(d))return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+".  .morphAttributes must be consistent throughout all geometries."),null;a[d]===void 0&&(a[d]=[]),a[d].push(u.morphAttributes[d])}if(t){let d;if(e)d=u.index.count;else if(u.attributes.position!==void 0)d=u.attributes.position.count;else return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index "+h+". The geometry must have either an index or a position attribute"),null;l.addGroup(c,d,h),c+=d}}if(e){let h=0;const u=[];for(let f=0;f<r.length;++f){const d=r[f].index;for(let g=0;g<d.count;++g)u.push(d.getX(g)+h);h+=r[f].attributes.position.count}l.setIndex(u)}for(const h in s){const u=Ql(s[h]);if(!u)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" attribute."),null;l.setAttribute(h,u)}for(const h in a){const u=a[h][0].length;if(u===0)break;l.morphAttributes=l.morphAttributes||{},l.morphAttributes[h]=[];for(let f=0;f<u;++f){const d=[];for(let _=0;_<a[h].length;++_)d.push(a[h][_][f]);const g=Ql(d);if(!g)return console.error("THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the "+h+" morphAttribute."),null;l.morphAttributes[h].push(g)}}return l}function Ql(r){let t,e,n,i=-1,s=0;for(let c=0;c<r.length;++c){const h=r[c];if(t===void 0&&(t=h.array.constructor),t!==h.array.constructor)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."),null;if(e===void 0&&(e=h.itemSize),e!==h.itemSize)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."),null;if(n===void 0&&(n=h.normalized),n!==h.normalized)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."),null;if(i===-1&&(i=h.gpuType),i!==h.gpuType)return console.error("THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes."),null;s+=h.count*e}const a=new t(s),o=new we(a,e,n);let l=0;for(let c=0;c<r.length;++c){const h=r[c];if(h.isInterleavedBufferAttribute){const u=l/e;for(let f=0,d=h.count;f<d;f++)for(let g=0;g<e;g++){const _=h.getComponent(f,g);o.setComponent(f+u,g,_)}}else a.set(h.array,l);l+=h.count*e}return i!==void 0&&(o.gpuType=i),o}function pn(r,t,e,n,i,s,a){const o=new nn(r,t,e);o.translate(n,i,s);const l=new vt(a),c=o.attributes.position.count,h=new Float32Array(c*3);for(let u=0;u<c;u++)h[u*3]=l.r,h[u*3+1]=l.g,h[u*3+2]=l.b;return o.setAttribute("color",new we(h,3)),o}function qc(r){const t=gg(r,!1);for(const e of r)e.dispose();if(!t)throw new Error("geometry merge failed");return t}const _g=[16744360,16765286,7328511,10980346,9429944,16752491,16118504,6932901],js=0,Pi=1,os=2,Di=3;class vg{constructor(t){v(this,"mesh");v(this,"capacity");v(this,"px");v(this,"py");v(this,"pz");v(this,"vx");v(this,"vy");v(this,"vz");v(this,"qx");v(this,"qy");v(this,"qz");v(this,"qw");v(this,"ring");v(this,"cx");v(this,"cz");v(this,"half");v(this,"dirSign");v(this,"speed");v(this,"mode");v(this,"timer");v(this,"phase");v(this,"heading");v(this,"mtx",new Yt);v(this,"quat",new Gn);v(this,"euler",new hn);v(this,"vecP",new U);v(this,"vecS",new U(1,1,1));v(this,"rng",new _s(4412009));v(this,"t",0);this.capacity=t;const e=s=>new Float32Array(s);this.px=e(t),this.py=e(t),this.pz=e(t),this.vx=e(t),this.vy=e(t),this.vz=e(t),this.qx=e(t),this.qy=e(t),this.qz=e(t),this.qw=e(t),this.ring=e(t),this.cx=e(t),this.cz=e(t),this.half=e(t),this.dirSign=e(t),this.speed=e(t),this.mode=new Uint8Array(t),this.timer=e(t),this.phase=e(t),this.heading=e(t);const n=qc([pn(.52,.62,.34,0,.62,0,16777215),pn(.34,.34,.3,0,1.08,0,16767416),pn(.2,.34,.24,-.14,.18,0,4608875),pn(.2,.34,.24,.14,.18,0,4608875)]),i=new tn({color:16777215,vertexColors:!0});this.mesh=new ui(n,i,t),this.mesh.instanceMatrix.setUsage(Ve),this.mesh.instanceColor=new li(new Float32Array(t*3),3),this.mesh.castShadow=!0,this.mesh.frustumCulled=!1}get aliveCount(){let t=0;for(let e=0;e<this.capacity;e++)this.mode[e]!==Di&&t++;return t}get panicCount(){let t=0;for(let e=0;e<this.capacity;e++)this.mode[e]===Pi&&t++;return t}populate(){const t=new vt;for(let e=0;e<this.capacity;e++)this.assignRing(e,this.rng.int(0,fe-1),this.rng.int(0,fe-1)),this.ring[e]=this.rng.next()*this.perim(e),this.dirSign[e]=this.rng.bool(.5)?1:-1,this.speed[e]=this.rng.range(1.5,2.7),this.mode[e]=js,this.timer[e]=0,this.phase[e]=this.rng.range(0,6.28),this.qx[e]=0,this.qy[e]=0,this.qz[e]=0,this.qw[e]=1,t.setHex(this.rng.pick(_g)),this.mesh.setColorAt(e,t),this.place(e);this.mesh.count=this.capacity,this.mesh.instanceColor&&(this.mesh.instanceColor.needsUpdate=!0)}reset(){this.populate()}assignRing(t,e,n){this.cx[t]=Hn(e)+Ht/2,this.cz[t]=Hn(n)+Ht/2,this.half[t]=Ht/2+.9}perim(t){return this.half[t]*8}place(t){const e=this.half[t],n=this.half[t]*2;let i=this.ring[t]%(n*4);i<0&&(i+=n*4);let s=0,a=0,o=0;i<n?(s=-e+i,a=-e,o=0):i<n*2?(s=e,a=-e+(i-n),o=-Math.PI/2):i<n*3?(s=e-(i-n*2),a=e,o=Math.PI):(s=-e,a=e-(i-n*3),o=Math.PI/2),this.px[t]=this.cx[t]+s,this.pz[t]=this.cz[t]+a,this.py[t]=.12,this.heading[t]=this.dirSign[t]>0?o:o+Math.PI}panic(t,e,n){for(let i=0;i<this.capacity;i++){if(this.mode[i]===Di||this.mode[i]===os)continue;const s=Math.hypot(this.px[i]-t,this.pz[i]-e);if(s>n)continue;this.mode[i]=Pi,this.timer[i]=3.5+Math.random()*3.5;const a=1/Math.max(.4,s);this.heading[i]=Math.atan2(-(this.pz[i]-e)*a,(this.px[i]-t)*a),this.speed[i]=5+Math.random()*2.6}}toss(t,e,n,i){for(let s=0;s<this.capacity;s++){if(this.mode[s]===Di)continue;const a=this.px[s]-t,o=this.pz[s]-e,l=Math.hypot(a,o);if(l>n)continue;const c=1-l/n,h=1/Math.max(.5,l);this.mode[s]=os,this.timer[s]=0,this.vx[s]=a*h*i*c*15,this.vy[s]=5+c*i*14,this.vz[s]=o*h*i*c*15}}respawn(t){this.assignRing(t,this.rng.int(0,fe-1),this.rng.int(0,fe-1)),this.ring[t]=this.rng.next()*this.perim(t),this.dirSign[t]=this.rng.bool(.5)?1:-1,this.speed[t]=this.rng.range(1.5,2.7),this.mode[t]=js,this.timer[t]=0,this.qx[t]=0,this.qy[t]=0,this.qz[t]=0,this.qw[t]=1,this.vx[t]=0,this.vy[t]=0,this.vz[t]=0,this.place(t)}update(t,e,n,i){this.t+=t;const s=n.anyActive,a=n.waterLevel;for(let o=0;o<this.capacity;o++){const l=this.mode[o];if(l===Di){this.timer[o]-=t,this.timer[o]<=0&&this.respawn(o);continue}if(l!==os){if(s){if(Wi(n,this.px[o],this.py[o]+.6,this.pz[o]),Ot.eaten){this.kill(o);continue}if(Math.abs(Ot.x)+Math.abs(Ot.z)+Math.abs(Ot.y)>9){this.mode[o]=os,this.vx[o]=Ot.x*.3,this.vy[o]=3+Math.abs(Ot.y)*.25,this.vz[o]=Ot.z*.3,this.timer[o]=0;continue}}if(a>.75){this.mode[o]=os,this.vy[o]=1.5,this.timer[o]=0;continue}for(const c of i){const h=Math.hypot(this.px[o]-c.x,this.pz[o]-c.z);if(h<c.radius*2.1){this.mode[o]!==Pi&&(this.mode[o]=Pi,this.timer[o]=3+Math.random()*3,this.speed[o]=5+Math.random()*2.4);const u=1/Math.max(.4,h);this.heading[o]=Math.atan2(-(this.pz[o]-c.z)*u,(this.px[o]-c.x)*u);break}}}if(l===js)this.ring[o]+=this.dirSign[o]*this.speed[o]*t,this.place(o),this.bob(o,1);else if(l===Pi){this.timer[o]-=t;const c=Math.cos(this.heading[o]),h=Math.sin(this.heading[o]);if(this.px[o]+=c*this.speed[o]*t,this.pz[o]-=h*this.speed[o]*t,this.py[o]=.12,Math.abs(this.px[o])>kt+46||Math.abs(this.pz[o])>kt+46){this.respawn(o);continue}if(this.timer[o]<=0){const u=Math.min(fe-1,Math.max(0,Math.round((this.px[o]+kt-Ht/2-6)/(Ht+6)))),f=Math.min(fe-1,Math.max(0,Math.round((this.pz[o]+kt-Ht/2-6)/(Ht+6))));this.assignRing(o,u,f),this.ring[o]=Math.random()*this.perim(o),this.speed[o]=1.5+Math.random()*1.2,this.mode[o]=js}this.bob(o,2.1)}else this.updateRagdoll(o,t,e,n,s,a)}this.write()}kill(t){this.mode[t]=Di,this.timer[t]=5+Math.random()*6}bob(t,e){const n=this.t*this.speed[t]*3.4*e+this.phase[t];this.py[t]=.12+Math.abs(Math.sin(n))*.1,this.euler.set(Math.sin(n)*.12,this.heading[t],Math.sin(n*.5)*.06),this.quat.setFromEuler(this.euler),this.qx[t]=this.quat.x,this.qy[t]=this.quat.y,this.qz[t]=this.quat.z,this.qw[t]=this.quat.w}updateRagdoll(t,e,n,i,s,a){this.timer[t]+=e;let o=this.vx[t],l=this.vy[t],c=this.vz[t];if(l-=32*e,s){if(Wi(i,this.px[t],this.py[t]+.5,this.pz[t]),Ot.eaten){this.kill(t);return}o+=Ot.x*e,l+=Ot.y*e,c+=Ot.z*e}if(a>.1&&this.py[t]<a&&(l+=24*e,o*=1-1.8*e,c*=1-1.8*e,i.waterCurrent>0)){const g=Math.max(1,Math.hypot(this.px[t],this.pz[t]));o+=this.px[t]/g*i.waterCurrent*.6*e,c+=this.pz[t]/g*i.waterCurrent*.6*e}const h=1-.6*e;o*=h,l*=h,c*=h,this.px[t]+=o*e,this.py[t]+=l*e,this.pz[t]+=c*e;let u=0;const f=n.surfaceAt(this.px[t],this.pz[t]);f>0&&this.py[t]>f-2.5&&(u=f),a>u+.3&&this.py[t]<a-.35&&(this.py[t]+=Math.min(3*e,a-.35-this.py[t]));let d=!1;this.py[t]<u+.12&&(this.py[t]=u+.12,l=-l*.2,o*=1-6*e,c*=1-6*e,d=Math.abs(o)+Math.abs(c)<1.2),this.vx[t]=o,this.vy[t]=l,this.vz[t]=c,this.euler.set(this.timer[t]*5.5,this.timer[t]*3.1,this.timer[t]*4.2),this.quat.setFromEuler(this.euler),this.qx[t]=this.quat.x,this.qy[t]=this.quat.y,this.qz[t]=this.quat.z,this.qw[t]=this.quat.w,d&&this.timer[t]>1.4&&!s&&a<.5&&(this.mode[t]=Pi,this.timer[t]=2.5,this.speed[t]=4.6+Math.random()*2,this.heading[t]=Math.random()*Math.PI*2),(Math.abs(this.px[t])>320||Math.abs(this.pz[t])>320||this.py[t]<-40)&&this.kill(t)}write(){for(let t=0;t<this.capacity;t++){if(this.mode[t]===Di){this.mtx.makeScale(0,0,0),this.mesh.setMatrixAt(t,this.mtx);continue}this.quat.set(this.qx[t],this.qy[t],this.qz[t],this.qw[t]),this.vecP.set(this.px[t],this.py[t],this.pz[t]),this.mtx.compose(this.vecP,this.quat,this.vecS),this.mesh.setMatrixAt(t,this.mtx)}this.mesh.instanceMatrix.needsUpdate=!0}}const tc=new vt(4168672),ec=new vt(12247029),xg=new vt(2437183),Mg=new vt(5923697),nc=new vt(12903157),yg=new vt(6252660),Sg=new vt(16772808),bg=new vt(11056066),ra=2.72,aa=.5,oa=1.02;class Eg{constructor(t,e){v(this,"group",new Je);v(this,"sun");v(this,"fill");v(this,"hemi");v(this,"clouds");v(this,"storm",0);v(this,"stormTarget",0);v(this,"sunBoost",0);v(this,"cloudSpeed",1);v(this,"time",0);v(this,"uniforms",{uTop:{value:tc.clone()},uHorizon:{value:ec.clone()},uSunDir:{value:new U(.42,.62,.28).normalize()},uSunColor:{value:new vt(16771512)}});v(this,"cloudData",[]);v(this,"mtx",new Yt);this.scene=t;const n=new ee(new Vi(620,32,20),new de({uniforms:this.uniforms,side:Ue,depthWrite:!1,fog:!1,vertexShader:`
          varying vec3 vDir;
          void main() {
            vDir = normalize( ( modelMatrix * vec4( position, 1.0 ) ).xyz );
            gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
          }`,fragmentShader:`
          uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSunDir; uniform vec3 uSunColor;
          varying vec3 vDir;
          void main() {
            float h = clamp( vDir.y * 1.1, 0.0, 1.0 );
            vec3 c = mix( uHorizon, uTop, pow( h, 0.62 ) );
            float sd = max( dot( normalize( vDir ), normalize( uSunDir ) ), 0.0 );
            c += uSunColor * pow( sd, 220.0 ) * 2.4;
            c += uSunColor * pow( sd, 5.0 ) * 0.10;
            gl_FragColor = vec4( c, 1.0 );
          }`}));n.renderOrder=-1e3,n.frustumCulled=!1,this.group.add(n),this.hemi=new Mu(13363455,8826482,oa),this.sun=new gl(16774108,ra),this.sun.position.set(78,116,52),this.sun.target.position.set(0,0,0),this.fill=new gl(14215423,aa),this.fill.position.set(-70,54,-86),this.group.add(this.hemi,this.sun,this.sun.target,this.fill);const i=new _s(551234),s=[];for(let a=0;a<e;a++){const o=a%5!==0,l=i.range(0,Math.PI*2),c=o?i.range(170,400):i.range(150,430),h=Math.cos(l)*c,u=o?i.range(34,64):i.range(92,156),f=Math.sin(l)*c,d=i.range(.55,1.5),g=i.int(5,9);for(let _=0;_<g;_++){const m=i.range(15,36);s.push({x:h+i.range(-24,24),y:u+i.range(-5,7),z:f+i.range(-20,20),sx:m,sy:m*i.range(.3,.5),sz:m*i.range(.7,1.1),drift:d})}}this.cloudData=s,this.clouds=new ui(new nn(1,1,1),new tn({color:16777215,transparent:!0,opacity:.94}),s.length),this.clouds.frustumCulled=!1,this.clouds.instanceMatrix.setUsage(Ve),this.group.add(this.clouds),this.writeClouds(),t.fog=new cr(nc.getHex(),210,640),t.add(this.group)}writeClouds(){for(let t=0;t<this.cloudData.length;t++){const e=this.cloudData[t];this.mtx.makeScale(e.sx,e.sy,e.sz),this.mtx.setPosition(e.x,e.y,e.z),this.clouds.setMatrixAt(t,this.mtx)}this.clouds.instanceMatrix.needsUpdate=!0}setStorm(t){this.stormTarget=Be(t,0,1)}pulseSun(t){this.sunBoost=Math.max(this.sunBoost,t)}reset(){this.stormTarget=0,this.storm=0,this.sunBoost=0,this.applyWeather()}applyWeather(){const t=this.storm;this.uniforms.uTop.value.copy(tc).lerp(xg,t),this.uniforms.uHorizon.value.copy(ec).lerp(Mg,t),this.uniforms.uSunColor.value.copy(Sg).lerp(bg,t);const e=this.scene.fog;e instanceof cr&&(e.color.copy(nc).lerp(yg,t),e.near=210-90*t,e.far=640-260*t),this.sun.intensity=(ra-ra*.72*t)*(1+this.sunBoost*3.4),this.fill.intensity=(aa-aa*.4*t)*(1+this.sunBoost*2),this.hemi.intensity=(oa-oa*.4*t)*(1+this.sunBoost*1.9),this.cloudSpeed=1+t*5.5,this.clouds.material.color.setRGB(1-.55*t,1-.52*t,1-.44*t)}update(t,e){this.time+=e,this.storm=zn(this.storm,this.stormTarget,1.4,t),this.sunBoost>1e-4?this.sunBoost=zn(this.sunBoost,0,9,t):this.sunBoost=0,this.applyWeather();const n=900;let i=!1;for(let s=0;s<this.cloudData.length;s++){const a=this.cloudData[s];a.x+=e*3.1*a.drift*this.cloudSpeed,a.x>n/2&&(a.x-=n),i=!0}i&&this.writeClouds()}}const ic=6318709,Tg=14672864,wg=15788508,Ag=9686910,Zs=16184294;class Rg{constructor(t){v(this,"group",new Je);v(this,"mesh");v(this,"plane");const e=new _s(9182734),n=[];for(let c=0;c<=fe;c++){const h=-kt+c*(Ht+_e)+_e/2;n.push({x:h,y:.03,z:0,sx:_e,sy:.06,sz:so,hex:ic}),n.push({x:0,y:.035,z:h,sx:so,sy:.06,sz:_e,hex:ic})}for(let c=0;c<fe;c++)for(let h=0;h<fe;h++){const u=Hn(c)+Ht/2,f=Hn(h)+Ht/2;n.push({x:u,y:.07,z:f,sx:Ht,sy:.14,sz:Ht,hex:Tg});const d=t.has(`${c},${h}`);n.push({x:u,y:.105,z:f,sx:Ht-2.6,sy:.14,sz:Ht-2.6,hex:d?Ag:wg}),d&&(n.push({x:u,y:.12,z:f,sx:Ht-2.6,sy:.15,sz:2,hex:15260868}),n.push({x:u,y:.12,z:f,sx:2,sy:.15,sz:Ht-2.6,hex:15260868}))}for(let c=0;c<=fe;c++){const h=-kt+c*(Ht+_e)+_e/2;for(let u=-kt+2;u<kt-1;u+=4.5)Math.abs((u+kt)%(Ht+_e)-_e/2)<_e*.75||(n.push({x:h,y:.075,z:u,sx:.3,sy:.07,sz:1.8,hex:Zs}),n.push({x:u,y:.075,z:h,sx:1.8,sy:.07,sz:.3,hex:Zs}))}for(let c=0;c<=fe;c++)for(let h=0;h<=fe;h++){const u=-kt+c*(Ht+_e)+_e/2,f=-kt+h*(Ht+_e)+_e/2;for(let d=-2;d<=2;d++)n.push({x:u+d*1.1,y:.08,z:f+_e/2+.9,sx:.6,sy:.07,sz:2.2,hex:Zs}),n.push({x:u+_e/2+.9,y:.08,z:f+d*1.1,sx:2.2,sy:.07,sz:.6,hex:Zs})}const i=[9030006,10869133,14274452,12892280,10473640,14735784,8108395];for(let c=0;c<130;c++){const h=e.range(0,Math.PI*2),u=e.range(kt+10,kt+190),f=e.range(10,40),d=e.range(10,40);if(n.push({x:Math.cos(h)*u,y:.05,z:Math.sin(h)*u,sx:f,sy:.1,sz:d,hex:e.pick(i)}),e.bool(.35))for(let _=0;_<4;_++)n.push({x:Math.cos(h)*u+(_-4/2)*(f/4),y:.07,z:Math.sin(h)*u,sx:f/(4*2.6),sy:.1,sz:d*.92,hex:12167284})}const s=new nn(1,1,1),a=new tn({color:16777215});this.mesh=new ui(s,a,n.length),this.mesh.receiveShadow=!0,this.mesh.castShadow=!1,this.mesh.frustumCulled=!1;const o=new Yt,l=new vt;for(let c=0;c<n.length;c++){const h=n[c];o.makeScale(h.sx,h.sy,h.sz),o.setPosition(h.x,h.y,h.z),this.mesh.setMatrixAt(c,o),l.setHex(h.hex),this.mesh.setColorAt(c,l)}this.mesh.instanceMatrix.needsUpdate=!0,this.mesh.instanceColor&&(this.mesh.instanceColor.needsUpdate=!0),this.plane=new ee(new fi(dr,dr),new tn({color:9357691})),this.plane.rotation.x=-Math.PI/2,this.plane.receiveShadow=!0,this.plane.position.y=0,this.group.add(this.plane,this.mesh)}}const sc=[16739179,16765286,5164484,10980346,16315619,6600182,16752762,8505220],la=0,rc=1,ac=2;class Cg{constructor(t){v(this,"mesh");v(this,"capacity");v(this,"count",0);v(this,"px");v(this,"py");v(this,"pz");v(this,"vx");v(this,"vy");v(this,"vz");v(this,"qx");v(this,"qy");v(this,"qz");v(this,"qw");v(this,"ax");v(this,"ay");v(this,"az");v(this,"dir");v(this,"speed");v(this,"axis");v(this,"mode");v(this,"timer");v(this,"colorIdx");v(this,"mtx",new Yt);v(this,"quat",new Gn);v(this,"vecP",new U);v(this,"vecS",new U(1,1,1));v(this,"rng",new _s(778211));v(this,"onWreck",null);this.capacity=t;const e=a=>new Float32Array(a);this.px=e(t),this.py=e(t),this.pz=e(t),this.vx=e(t),this.vy=e(t),this.vz=e(t),this.qx=e(t),this.qy=e(t),this.qz=e(t),this.qw=e(t),this.ax=e(t),this.ay=e(t),this.az=e(t),this.dir=e(t),this.speed=e(t),this.axis=new Uint8Array(t),this.mode=new Uint8Array(t),this.timer=e(t),this.colorIdx=new Uint8Array(t);const n=qc([pn(3.4,.95,1.8,0,.72,0,16777215),pn(1.9,.8,1.6,-.15,1.5,0,14676479),pn(.5,.5,2,1.15,.3,0,2763312),pn(.5,.5,2,-1.15,.3,0,2763312),pn(.35,.3,.3,1.75,.8,.6,16774084),pn(.35,.3,.3,1.75,.8,-.6,16774084)]),i=new tn({color:16777215,vertexColors:!0});this.mesh=new ui(n,i,t),this.mesh.instanceMatrix.setUsage(Ve);const s=new li(new Float32Array(t*3),3);this.mesh.instanceColor=s,this.mesh.castShadow=!0,this.mesh.frustumCulled=!1,this.mesh.count=0}populate(){const t=Xl(),e=new vt;this.count=0;for(let n=0;n<this.capacity;n++){const i=this.rng.bool(.5),s=this.rng.pick(t),a=this.rng.bool(.5)?1.35:-1.35,o=this.rng.range(-kt,kt),l=this.count++;this.axis[l]=i?0:1,i?(this.px[l]=o,this.pz[l]=s+a,this.dir[l]=a>0?Math.PI:0):(this.px[l]=s-a,this.pz[l]=o,this.dir[l]=a>0?-Math.PI/2:Math.PI/2),this.py[l]=.16,this.speed[l]=this.rng.range(7,15),this.mode[l]=la,this.timer[l]=0,this.qx[l]=0,this.qy[l]=0,this.qz[l]=0,this.qw[l]=1,this.vx[l]=0,this.vy[l]=0,this.vz[l]=0,this.colorIdx[l]=this.rng.int(0,sc.length-1),e.setHex(sc[this.colorIdx[l]]),this.mesh.setColorAt(l,e)}this.mesh.count=this.count,this.mesh.instanceColor&&(this.mesh.instanceColor.needsUpdate=!0)}reset(){this.populate()}launch(t,e,n,i){this.mode[t]=ac,this.vx[t]=e,this.vy[t]=n,this.vz[t]=i,this.ax[t]=(Math.random()-.5)*8,this.ay[t]=(Math.random()-.5)*8,this.az[t]=(Math.random()-.5)*8,this.timer[t]=0}blast(t,e,n,i,s){for(let a=0;a<this.count;a++){const o=this.px[a]-t,l=this.pz[a]-e,c=Math.hypot(o,l);if(c>n)continue;const h=1-c/n;if(c<n*.42){for(let d=0;d<5;d++)s.spawn(this.px[a],this.py[a]+.6,this.pz[a],(Math.random()-.5)*16,4+Math.random()*12,(Math.random()-.5)*16,.9,.5,.7,.15,.15,.16);this.onWreck&&this.onWreck(this.px[a],this.py[a]+.5,this.pz[a]),this.respawn(a);continue}const u=1/Math.max(.5,c),f=i*h*22;this.launch(a,o*u*f,6+h*i*18,l*u*f)}}respawn(t){const e=Xl(),n=this.rng.bool(.5),i=this.rng.pick(e),s=this.rng.bool(.5)?1.35:-1.35;this.axis[t]=n?0:1,n?(this.px[t]=this.rng.bool(.5)?-kt-8:kt+8,this.pz[t]=i+s,this.dir[t]=this.px[t]>0?Math.PI:0):(this.px[t]=i-s,this.pz[t]=this.rng.bool(.5)?-kt-8:kt+8,this.dir[t]=this.pz[t]>0?-Math.PI/2:Math.PI/2),this.py[t]=.16,this.mode[t]=la,this.speed[t]=this.rng.range(7,15),this.qx[t]=0,this.qy[t]=0,this.qz[t]=0,this.qw[t]=1,this.vx[t]=0,this.vy[t]=0,this.vz[t]=0,this.timer[t]=0}update(t,e,n,i){const s=n.anyActive,a=n.waterLevel;for(let o=0;o<this.count;o++){if(this.mode[o]===ac){this.updateLoose(o,t,e,n,s,a);continue}let l=1;for(const f of i)if(Math.hypot(this.px[o]-f.x,this.pz[o]-f.z)<f.radius*2.4){l=2.3,this.mode[o]=rc,this.timer[o]=3;break}this.mode[o]===rc&&(this.timer[o]-=t,this.timer[o]<=0&&(this.mode[o]=la),l=Math.max(l,1.9)),a>.55&&(l*=.35);const c=this.speed[o]*l*t,h=Math.cos(this.dir[o]),u=Math.sin(this.dir[o]);if(this.px[o]+=h*c,this.pz[o]-=u*c,this.px[o]>kt+14||this.px[o]<-kt-14||this.pz[o]>kt+14||this.pz[o]<-kt-14){this.respawn(o);continue}a>1.5&&this.launch(o,0,1,0),s&&(Wi(n,this.px[o],this.py[o],this.pz[o]),(Math.abs(Ot.x)+Math.abs(Ot.z)>14||Ot.eaten)&&this.launch(o,Ot.x*.35,6+Math.abs(Ot.y)*.3,Ot.z*.35)),this.quat.setFromAxisAngle(new U(0,1,0),this.dir[o]),this.qx[o]=this.quat.x,this.qy[o]=this.quat.y,this.qz[o]=this.quat.z,this.qw[o]=this.quat.w}this.write()}updateLoose(t,e,n,i,s,a){this.timer[t]+=e;let o=this.vx[t],l=this.vy[t],c=this.vz[t];if(l-=34*e,s){if(Wi(i,this.px[t],this.py[t],this.pz[t]),Ot.eaten){this.respawn(t);return}o+=Ot.x*e*.8,l+=Ot.y*e*.8,c+=Ot.z*e*.8}a>.1&&this.py[t]<a&&(l+=26*e,o*=1-2.2*e,c*=1-2.2*e);const h=1-.5*e;o*=h,l*=h,c*=h,this.px[t]+=o*e,this.py[t]+=l*e,this.pz[t]+=c*e;let u=0;const f=n.surfaceAt(this.px[t],this.pz[t]);f>0&&this.py[t]>f-3&&(u=f),a>u+.3&&this.py[t]<a-.5&&(this.py[t]+=Math.min(4*e,a-.5-this.py[t])),this.py[t]<u+.35&&(this.py[t]=u+.35,-l>3?(l=-l*.28,o*=.6,c*=.6):(l=0,o*=1-5*e,c*=1-5*e),this.ax[t]*=1-3*e,this.ay[t]*=1-3*e,this.az[t]*=1-3*e),this.vx[t]=o,this.vy[t]=l,this.vz[t]=c;const d=e*.5,g=this.ax[t],_=this.ay[t],m=this.az[t];let p=this.qx[t]+d*(g*this.qw[t]+_*this.qz[t]-m*this.qy[t]),b=this.qy[t]+d*(_*this.qw[t]+m*this.qx[t]-g*this.qz[t]),E=this.qz[t]+d*(m*this.qw[t]+g*this.qy[t]-_*this.qx[t]),y=this.qw[t]-d*(g*this.qx[t]+_*this.qy[t]+m*this.qz[t]);const w=Math.hypot(p,b,E,y)||1;p/=w,b/=w,E/=w,y/=w,this.qx[t]=p,this.qy[t]=b,this.qz[t]=E,this.qw[t]=y,(this.timer[t]>26||Math.abs(this.px[t])>300||Math.abs(this.pz[t])>300)&&this.respawn(t)}write(){for(let t=0;t<this.count;t++)this.quat.set(this.qx[t],this.qy[t],this.qz[t],this.qw[t]),this.vecP.set(this.px[t],this.py[t],this.pz[t]),this.mtx.compose(this.vecP,this.quat,this.vecS),this.mesh.setMatrixAt(t,this.mtx);this.mesh.count=this.count,this.mesh.instanceMatrix.needsUpdate=!0}}class Pg{constructor(){v(this,"mesh");v(this,"level",0);v(this,"target",0);v(this,"uniforms",{uTime:{value:0},uOpacity:{value:.72},uShallow:{value:new vt(7328511)},uDeep:{value:new vt(1928900)}});const t=new fi(dr,dr,96,96);t.rotateX(-Math.PI/2);const e=new de({uniforms:this.uniforms,transparent:!0,depthWrite:!1,side:Le,vertexShader:`
        uniform float uTime;
        varying float vWave;
        varying vec3 vP;
        void main() {
          vec3 p = position;
          float w = sin( p.x * 0.09 + uTime * 1.5 ) * 0.34
                  + sin( p.z * 0.13 - uTime * 1.1 ) * 0.26
                  + sin( ( p.x + p.z ) * 0.05 + uTime * 0.7 ) * 0.3;
          p.y += w;
          vWave = w;
          vP = p;
          gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
        }`,fragmentShader:`
        uniform float uOpacity; uniform vec3 uShallow; uniform vec3 uDeep;
        varying float vWave;
        varying vec3 vP;
        void main() {
          float d = clamp( length( vP.xz ) / 160.0, 0.0, 1.0 );
          vec3 c = mix( uShallow, uDeep, d * 0.75 );
          c += vWave * 0.18;
          float foam = smoothstep( 0.42, 0.62, vWave );
          c = mix( c, vec3( 0.92, 0.98, 1.0 ), foam * 0.5 );
          gl_FragColor = vec4( c, uOpacity );
        }`});this.mesh=new ee(t,e),this.mesh.visible=!1,this.mesh.frustumCulled=!1,this.mesh.renderOrder=3,this.mesh.position.y=-1}reset(){this.level=0,this.target=0,this.mesh.visible=!1,this.mesh.position.y=-1}update(t,e){this.uniforms.uTime.value+=e;const n=this.target>this.level?1.35:2.1;Math.abs(this.target-this.level)>.002&&(this.level+=Math.sign(this.target-this.level)*Math.min(Math.abs(this.target-this.level),n*t));const i=this.level>.04;this.mesh.visible=i,i&&(this.mesh.position.y=this.level,this.uniforms.uOpacity.value=Math.min(.78,.32+this.level*.12))}}const ca=new Int32Array(6e4);class Dg{constructor(t){v(this,"field");v(this,"city");v(this,"terrain");v(this,"sky");v(this,"water",new Pg);v(this,"traffic");v(this,"crowd");v(this,"debris");v(this,"chunks");v(this,"sparks");v(this,"smoke");v(this,"shock",new ag);v(this,"decals",new ng);v(this,"bolts",new Z0);v(this,"screen");v(this,"fields",new J0);v(this,"audio",new ro);v(this,"threats",[]);v(this,"power",1);v(this,"stress",0);v(this,"burning",[]);v(this,"col",new vt);v(this,"parkKeys",new Set(["1,4","4,1","0,2"]));this.engine=t;const e=t.quality,n=pg();this.field=new z0(n.builder),this.city=new mg(this.field,n.buildings),this.terrain=new Rg(this.parkKeys),this.sky=new Eg(t.scene,e.cloudCount),this.debris=new tg(e.debrisCap),this.sparks=new Zl(e.sparkCap,!0),this.smoke=new Zl(e.smokeCap,!1),this.traffic=new Cg(e.carCount),this.crowd=new vg(e.pedCount),this.screen=new ig(t.camera,t.grade),this.chunks=new $0(e.chunkCap,this.field,this.debris,s=>this.killVoxel(s),{onLand:(s,a,o,l,c)=>{this.screen.shake(.16+l*.4),this.audio.crumble(),this.audio.impact(.9),this.dust(s,a,o,26,c*.45,1.5),this.crowd.panic(s,o,c+12),this.crowd.toss(s,o,c*.6,.5),this.decals.scorch(s,o,Math.max(4,c*.4),.5),this.damageSphere(s,1.2,o,Math.max(3,c*.22),{radius:0,force:8,debris:14,scorch:.25,up:.4,jagged:.3})},onDust:(s,a,o,l,c)=>this.dust(s,a,o,l,c,1)},()=>t.quality.eventDebris),this.debris.onImpact=(s,a,o,l)=>{this.audio.impact(l),Math.random()<.5&&this.dust(s,a,o,2,1.2,.7)},this.traffic.onWreck=(s,a,o)=>{this.fire(s,a,o,16,7,.9),this.sparkBurst(s,a,o,18,12,16761963),this.smokeColumn(s,a,o,10,3,2.4),this.audio.explosion(.5),this.screen.shake(.08)};const i=t.scene;i.add(this.terrain.group),i.add(this.field.mesh),i.add(this.chunks.mesh),i.add(this.debris.mesh),i.add(this.traffic.mesh),i.add(this.crowd.mesh),i.add(this.decals.group),i.add(this.shock.group),i.add(this.bolts.group),i.add(this.smoke.points),i.add(this.sparks.points),i.add(this.water.mesh),this.configureShadows(),this.traffic.populate(),this.crowd.populate()}configureShadows(){const t=this.engine.quality,e=this.sky.sun;if(e.castShadow=t.shadows,!t.shadows)return;e.shadow.mapSize.set(t.shadowSize,t.shadowSize);const n=e.shadow.camera,i=kt+34;n.left=-i,n.right=i,n.top=i,n.bottom=-i,n.near=1,n.far=420,n.updateProjectionMatrix(),e.shadow.bias=-9e-4,e.shadow.normalBias=.35}get voxelCount(){return this.field.count+this.chunks.count}get debrisCount(){return this.debris.count+this.chunks.count}get particleCount(){return this.sparks.count+this.smoke.count}killVoxel(t){this.field.kill(t)&&this.city.notifyKilled(t)}addThreat(t,e,n,i){const s={x:t,z:e,radius:n,power:i};return this.threats.push(s),s}removeThreat(t){const e=this.threats.indexOf(t);e>=0&&this.threats.splice(e,1)}damageSphere(t,e,n,i,s){const a=i>0?i:s.radius;if(a<=0)return 0;let o=0;const l=s.jagged;if(this.field.querySphere(t,e,n,a*1.42,(u,f)=>{if(o>=ca.length)return;const d=Math.sin(this.field.posX[u]*12.9898+this.field.posZ[u]*78.233+this.field.posY[u]*37.719)*43758.5453%1,g=1-l*.5+l*Math.abs(d);f*1.42<=g?ca[o++]=u:f*1.42<g+.34&&this.field.scorch(u,s.scorch*(1.2-f))}),o===0)return 0;const c=Math.min(s.debris,this.engine.quality.eventDebris),h=Math.max(1,Math.ceil(o/Math.max(1,c)));for(let u=0;u<o;u++){const f=ca[u],d=this.field.posX[f]-t,g=this.field.posY[f]-e,_=this.field.posZ[f]-n,m=Math.max(.6,Math.hypot(d,g,_));if(this.city.pushDirection(f,d/m,_/m),u%h===0){const p=.4+.85*(1-Math.min(1,m/(a*1.42))),b=s.force*p*(.7+Math.random()*.7);this.debris.spawnFromVoxel(this.field,f,d/m*b,g/m*b+s.up*b*.6+Math.random()*3,_/m*b,1-.35*Math.random()*s.scorch)}this.killVoxel(f)}return o}blastEntities(t,e,n,i){this.traffic.blast(t,e,n*1.15,i,this.debris),this.crowd.toss(t,e,n*1.3,i),this.crowd.panic(t,e,n*3.4)}addFire(t,e,n,i,s,a=1){this.burning.length>26&&this.burning.shift(),this.burning.push({x:t,y:e,z:n,t:s,r:i,rate:a})}rgb(t){return this.col.setHex(t)}sparkBurst(t,e,n,i,s,a=16765567){const o=this.rgb(a),l=this.scaleCount(i);for(let c=0;c<l;c++){const h=Math.random()*Math.PI*2,u=Math.random()*Math.PI-Math.PI/2,f=s*(.35+Math.random()*.9);this.sparks.spawn(t,e,n,Math.cos(h)*Math.cos(u)*f,Math.abs(Math.sin(u))*f*1.15,Math.sin(h)*Math.cos(u)*f,.35+Math.random()*.7,.5+Math.random()*.5,.06,o.r,o.g,o.b,1,-16,.7,.35)}}fire(t,e,n,i,s,a=1){const o=this.scaleCount(i);for(let l=0;l<o;l++){const c=Math.random()*Math.PI*2,h=Math.random()*s,u=Math.random();this.sparks.spawn(t+Math.cos(c)*h*.5,e+Math.random()*s*.4,n+Math.sin(c)*h*.5,Math.cos(c)*h*.5,2+Math.random()*5,Math.sin(c)*h*.5,a*(.6+Math.random()*.7),1.4+Math.random()*1.8,.2,1,.42+u*.42,.08+u*.14,.95,3.5,1.4,.4)}}dust(t,e,n,i,s,a=1){const o=this.scaleCount(i);for(let l=0;l<o;l++){const c=Math.random()*Math.PI*2,h=Math.random()*s,u=.62+Math.random()*.24;this.smoke.spawn(t+Math.cos(c)*h,e+Math.random()*s*.5,n+Math.sin(c)*h,Math.cos(c)*(1+Math.random()*3),.8+Math.random()*2.4,Math.sin(c)*(1+Math.random()*3),a*(1.4+Math.random()*1.8),1.6+Math.random()*2,5+Math.random()*5,u,u*.96,u*.9,.5,.6,.9,.6)}}smokeColumn(t,e,n,i,s,a=2){const o=this.scaleCount(i);for(let l=0;l<o;l++){const c=Math.random()*Math.PI*2,h=Math.random()*s,u=.22+Math.random()*.3;this.smoke.spawn(t+Math.cos(c)*h,e+Math.random()*2,n+Math.sin(c)*h,Math.cos(c)*1.2,4+Math.random()*6,Math.sin(c)*1.2,a*(1+Math.random()),2+Math.random()*2,7+Math.random()*7,u,u*.95,u*.95,.62,1.2,.7,.7)}}scaleCount(t){const e=this.engine.quality.tier;return Math.max(1,Math.round(t*(e===2?1:e===1?.7:.45)))}explosionFx(t,e,n,i,s){this.shock.sphere(t,e+i*.18,n,i*.24,i*1.05,.62,s,1.8,1,.92),this.shock.sphere(t,e+i*.3,n,i*.5,i*1.7,1.05,16756835,.7,.35,.7),this.shock.ring(t,.3,n,i*.3,i*2.2,.7,16773312,1.3),this.sparkBurst(t,e+1,n,Math.round(30+i*3.8),i*2.6,16765567),this.fire(t,e+1,n,Math.round(20+i*2.4),i*.55,1.5),this.dust(t,e+.6,n,Math.round(20+i*2.4),i*.8,1.7)}update(t,e){Gi.uTime.value+=e,this.sky.update(t,e),this.water.update(t,e),this.fields.waterLevel=this.water.level;for(let s=this.burning.length-1;s>=0;s--){const a=this.burning[s];if(a.t-=e,a.t<=0){this.burning.splice(s,1);continue}if(Math.random()<e*9*a.rate){const o=Math.random()*Math.PI*2,l=Math.random()*a.r;this.fire(a.x+Math.cos(o)*l,a.y,a.z+Math.sin(o)*l,2,1.4,1.2),Math.random()<.4&&this.smokeColumn(a.x+Math.cos(o)*l,a.y+1,a.z+Math.sin(o)*l,1,1.2,2.4)}}this.chunks.update(e),this.debris.update(e,this.field,this.fields),this.traffic.update(e,this.field,this.fields,this.threats),this.crowd.update(e,this.field,this.fields,this.threats),this.sparks.update(e,this.fields),this.smoke.update(e,this.fields),this.shock.update(e),this.bolts.update(e),this.city.evaluate(this.chunks,e,Be(this.stress,0,1)),this.field.flush();const n=this.engine.renderer.domElement.height,i=this.engine.camera.projectionMatrix.elements[5];this.sparks.setProjection(n,i),this.smoke.setProjection(n,i),this.audio.update(t)}rebuild(){this.field.resetAll(),this.city.reset(),this.debris.clear(),this.chunks.clear(),this.sparks.clear(),this.smoke.clear(),this.shock.clear(),this.bolts.clear(),this.decals.clear(),this.water.reset(),this.sky.reset(),this.fields.reset(),this.threats.length=0,this.burning.length=0,this.traffic.reset(),this.crowd.reset(),this.screen.reset(),this.stress=0,Gi.uQuake.value=0,this.audio.windLevel(0),this.audio.quakeLevel(0),this.audio.waterLevel(0),this.audio.singularity(0)}randomCityPoint(t){const e=Math.random()*fe|0,n=Math.random()*fe|0;return t.set(Hn(e)+Math.random()*Ht,Hn(n)+Math.random()*Ht)}}const ha=r=>r>=1e4?`${(r/1e3).toFixed(1)}k`:Math.round(r).toLocaleString("en-US");class Lg{constructor(t,e,n){v(this,"root");v(this,"hintEl");v(this,"statVoxel");v(this,"statDebris");v(this,"statPed");v(this,"statFps");v(this,"fpsWrap");v(this,"toastEl");v(this,"buttons",new Map);v(this,"slowChip");v(this,"soundChip");v(this,"powerOut");v(this,"tiltOut");v(this,"toastTimer",0);this.cb=n,this.root=document.createElement("div"),this.root.id="hud",this.root.innerHTML=`
      <div id="brand" class="panel">
        <h1><span class="dot"></span>微缩灾难沙盘</h1>
      </div>
      <div id="stats" class="panel">
        <span>体素 <span class="v" id="s-vox">0</span></span><span class="sep">·</span>
        <span>碎片 <span class="v" id="s-deb">0</span></span><span class="sep">·</span>
        <span>行人 <span class="v" id="s-ped">0</span></span><span class="sep">·</span>
        <span class="fps" id="s-fpswrap">FPS <span class="v" id="s-fps">60</span></span>
      </div>
      <div id="hintline" class="panel"><p id="hint"></p></div>
      <div id="toast"></div>
      <div id="toolbar" class="panel">
        <div id="tools"></div>
        <div id="controls">
          <button class="chip" id="c-slow" type="button">🐢 慢镜头</button>
          <button class="chip on" id="c-sound" type="button">🔊 音效</button>
          <button class="chip danger" id="c-rebuild" type="button">🏗 重建城市</button>
          <label class="slider">威力
            <input type="range" id="c-power" min="35" max="220" value="100" />
            <output id="o-power">1.0×</output>
          </label>
          <label class="slider">移轴
            <input type="range" id="c-tilt" min="0" max="100" value="45" />
            <output id="o-tilt">45%</output>
          </label>
        </div>
      </div>`,t.appendChild(this.root);const i=l=>{const c=this.root.querySelector(`#${l}`);if(!c)throw new Error(`missing hud node ${l}`);return c};this.hintEl=i("hint"),this.statVoxel=i("s-vox"),this.statDebris=i("s-deb"),this.statPed=i("s-ped"),this.statFps=i("s-fps"),this.fpsWrap=i("s-fpswrap"),this.toastEl=i("toast");const s=i("tools");for(const l of e){const c=document.createElement("button");c.type="button",c.className="tool",c.style.setProperty("--tint",l.css),c.innerHTML=`<span class="ico">${l.icon}</span><span class="lbl">${l.name}</span>`,c.addEventListener("click",()=>this.cb.onSelect(l.id)),s.appendChild(c),this.buttons.set(l.id,c)}this.slowChip=i("c-slow"),this.soundChip=i("c-sound"),this.powerOut=i("o-power"),this.tiltOut=i("o-tilt"),this.slowChip.addEventListener("click",()=>{const l=!this.slowChip.classList.contains("on");this.slowChip.classList.toggle("on",l),this.cb.onSlow(l)}),this.soundChip.addEventListener("click",()=>{const l=!this.soundChip.classList.contains("on");this.soundChip.classList.toggle("on",l),this.soundChip.innerHTML=l?"🔊 音效":"🔇 静音",this.cb.onSound(l)}),i("c-rebuild").addEventListener("click",()=>this.cb.onRebuild());const a=i("c-power");a.addEventListener("input",()=>{const l=Number(a.value)/100;this.powerOut.textContent=`${l.toFixed(1)}×`,this.cb.onPower(l)});const o=i("c-tilt");o.addEventListener("input",()=>{const l=Number(o.value);this.tiltOut.textContent=`${l.toFixed(0)}%`,this.cb.onTilt(l/100)})}setHint(t){this.hintEl.textContent!==t&&(this.hintEl.innerHTML=t)}setStats(t){this.statVoxel.textContent=ha(t.voxels),this.statDebris.textContent=ha(t.debris),this.statPed.textContent=ha(t.peds),this.statFps.textContent=t.fps.toFixed(0),this.fpsWrap.classList.toggle("warn",t.fps<40)}syncTools(t,e){for(const[n,i]of this.buttons)i.classList.toggle("active",t===n||e(n)),i.classList.toggle("running",e(n))}toast(t){this.toastEl.textContent=t,this.toastEl.classList.add("show"),this.toastTimer=2.2}update(t){this.toastTimer>0&&(this.toastTimer-=t,this.toastTimer<=0&&this.toastEl.classList.remove("show"))}}class Ug{constructor(t){v(this,"group",new Je);v(this,"outer");v(this,"inner");v(this,"ticks");v(this,"t",0);v(this,"radius",1);v(this,"visible",!1);const e=(a,o)=>{const l=new ee(a,new Wn({color:16777215,transparent:!0,opacity:o,blending:en,depthWrite:!1,side:Le}));return l.frustumCulled=!1,l.renderOrder=8,l},n=new Fi(.94,1,72,1);n.rotateX(-Math.PI/2);const i=new Fi(.24,.3,40,1);i.rotateX(-Math.PI/2);const s=new Fi(.72,.9,4,1,0,Math.PI*2);s.rotateX(-Math.PI/2),this.outer=e(n,.95),this.inner=e(i,.8),this.ticks=e(s,.35),this.group.add(this.outer,this.inner,this.ticks),this.group.visible=!1,t.add(this.group)}show(t,e,n,i){this.visible=!0,this.radius=Math.max(1.2,n),this.group.visible=!0,this.group.position.set(t,.3,e);for(const s of[this.outer,this.inner,this.ticks])s.material.color.setHex(i)}hide(){this.visible=!1,this.group.visible=!1}update(t){if(!this.visible)return;this.t+=t;const e=1+Math.sin(this.t*4.2)*.03;this.outer.scale.set(this.radius*e,1,this.radius*e),this.inner.scale.set(this.radius,1,this.radius),this.ticks.scale.set(this.radius,1,this.radius),this.ticks.rotation.y+=t*.7,this.outer.material.opacity=.7+Math.sin(this.t*6)*.22}}const Ro=document.getElementById("app");if(!Ro)throw new Error("#app container missing");const Ae=new R0(Ro),me=new Dg(Ae),ve=new X0(me),qi=new Ug(Ae.scene);let Li=!1,rr=null;const oc=new Tt,ke=new Lg(Ro,ve.specs,{onSelect:r=>{me.audio.resume(),me.audio.uiClick(),ve.select(r),ms(),!ve.armed&&!ve.isRunning(r)&&qi.hide()},onRebuild:()=>{me.audio.resume(),me.audio.uiClick(),ve.reset(),me.rebuild(),mr.reset(),qi.hide(),ke.toast("城市已重建"),ms()},onSlow:r=>{Li=r,Ae.timeScale=r?.26:1,me.audio.setSlowMotion(r),ke.toast(r?"慢镜头开启":"慢镜头关闭")},onSound:r=>{me.audio.setEnabled(r),r&&me.audio.resume(),ke.toast(r?"音效开启":"音效关闭")},onPower:r=>{me.power=Be(r,.35,2.2)},onTilt:r=>{Ae.setTiltAmount(r)}}),mr=new f0(Ae.camera,Ae.renderer.domElement,{onTap:r=>{me.audio.resume(),ve.release(r)&&ms()},onHover:r=>{rr=r,Xc()},onCancel:()=>{ve.armed&&(ve.cancel(),qi.hide(),ms(),ke.toast("已取消当前灾难"))},onGesture:()=>me.audio.resume()});ve.onMessage=r=>ke.toast(r);me.power=1;Ae.setTiltAmount(.45);function Xc(){ve.armed&&rr?(qi.show(rr.x,rr.z,ve.reticleRadius(),ve.reticleColor()),Ae.renderer.domElement.classList.add("armed")):(qi.hide(),Ae.renderer.domElement.classList.remove("armed"))}function ms(){ke.syncTools(ve.armed,r=>ve.isRunning(r)),ke.setHint(ve.hint()),Xc()}let ua=0;Ae.onUpdate((r,t)=>{mr.update(r),mr.steerVector(oc),ve.update(r,t,oc),me.update(r,t),qi.update(r),me.screen.update(r),ke.update(r),ua-=r,ua<=0&&(ua=.25,ke.setStats({voxels:me.voxelCount,debris:me.debrisCount,peds:me.crowd.aliveCount,fps:Ae.fps}),ke.setHint(ve.hint()),ke.syncTools(ve.armed,e=>ve.isRunning(e)))});Ae.start();ms();const Yc=()=>{const r=document.getElementById("boot");r&&(r.classList.add("hidden"),window.setTimeout(()=>r.remove(),600))};requestAnimationFrame(()=>{requestAnimationFrame(()=>{Yc(),ke.toast(`微缩城市已就绪 · ${me.voxelCount.toLocaleString("en-US")} 体素`)})});window.setTimeout(Yc,2500);window.addEventListener("keydown",r=>{r.code==="Space"&&(r.preventDefault(),Li=!Li,Ae.timeScale=Li?.26:1,me.audio.setSlowMotion(Li),ke.toast(Li?"慢镜头开启":"慢镜头关闭"))});window.__sandbox={engine:Ae,sandbox:me,manager:ve,controls:mr,hud:ke,step:(r=1,t=1/60,e=!0)=>{for(let n=0;n<r;n++)Ae.frame(t,e)},capture:()=>(Ae.frame(1/60,!0),Ae.captureDataURL())};
