(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))n(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const r of a.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&n(r)}).observe(document,{childList:!0,subtree:!0});function t(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function n(s){if(s.ep)return;s.ep=!0;const a=t(s);fetch(s.href,a)}})();/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */const io="185",zc=0,Ro=1,Wc=2,$s=1,Ol=2,ls=3,ri=0,Jt=1,qt=2,Vn=0,Mi=1,qi=2,Co=3,Po=4,qc=5,gi=100,Xc=101,Yc=102,Kc=103,Zc=104,Jc=200,$c=201,Qc=202,jc=203,ar=204,rr=205,eh=206,th=207,nh=208,ih=209,sh=210,ah=211,rh=212,oh=213,lh=214,or=0,lr=1,cr=2,Xi=3,hr=4,dr=5,ur=6,fr=7,Bl=0,ch=1,hh=2,Cn=0,Hl=1,Gl=2,Vl=3,so=4,zl=5,Wl=6,ql=7,Xl=300,yi=301,Yi=302,Sa=303,ba=304,ma=306,us=1e3,Hn=1001,pr=1002,kt=1003,dh=1004,Es=1005,Gt=1006,ya=1007,vi=1008,on=1009,Yl=1010,Kl=1011,fs=1012,ao=1013,Ln=1014,An=1015,Wn=1016,ro=1017,oo=1018,ps=1020,Zl=35902,Jl=35899,$l=1021,Ql=1022,_n=1023,qn=1026,xi=1027,jl=1028,lo=1029,Ei=1030,co=1031,ho=1033,Qs=33776,js=33777,ea=33778,ta=33779,mr=35840,gr=35841,_r=35842,vr=35843,xr=36196,Mr=37492,Sr=37496,br=37488,yr=37489,ra=37490,Er=37491,Tr=37808,wr=37809,Ar=37810,Rr=37811,Cr=37812,Pr=37813,Lr=37814,Ir=37815,Dr=37816,Ur=37817,kr=37818,Nr=37819,Fr=37820,Or=37821,Br=36492,Hr=36494,Gr=36495,Vr=36283,zr=36284,oa=36285,Wr=36286,uh=3200,qr=0,fh=1,Bn="",an="srgb",la="srgb-linear",ca="linear",lt="srgb",Ci=7680,Lo=519,ph=512,mh=513,gh=514,uo=515,_h=516,vh=517,fo=518,xh=519,Io=35044,Do="300 es",Rn=2e3,ms=2001;function Mh(i){for(let e=i.length-1;e>=0;--e)if(i[e]>=65535)return!0;return!1}function ha(i){return document.createElementNS("http://www.w3.org/1999/xhtml",i)}function Sh(){const i=ha("canvas");return i.style.display="block",i}const Uo={};function ko(...i){const e="THREE."+i.shift();console.log(e,...i)}function ec(i){const e=i[0];if(typeof e=="string"&&e.startsWith("TSL:")){const t=i[1];t&&t.isStackTrace?i[0]+=" "+t.getLocation():i[1]='Stack trace not available. Enable "THREE.Node.captureStackTrace" to capture stack traces.'}return i}function Fe(...i){i=ec(i);const e="THREE."+i.shift();{const t=i[0];t&&t.isStackTrace?console.warn(t.getError(e)):console.warn(e,...i)}}function et(...i){i=ec(i);const e="THREE."+i.shift();{const t=i[0];t&&t.isStackTrace?console.error(t.getError(e)):console.error(e,...i)}}function zi(...i){const e=i.join(" ");e in Uo||(Uo[e]=!0,Fe(...i))}function bh(i,e,t){return new Promise(function(n,s){function a(){switch(i.clientWaitSync(e,i.SYNC_FLUSH_COMMANDS_BIT,0)){case i.WAIT_FAILED:s();break;case i.TIMEOUT_EXPIRED:setTimeout(a,t);break;default:n()}}setTimeout(a,t)})}const yh={[or]:lr,[cr]:ur,[hr]:fr,[Xi]:dr,[lr]:or,[ur]:cr,[fr]:hr,[dr]:Xi};class Ti{addEventListener(e,t){this._listeners===void 0&&(this._listeners={});const n=this._listeners;n[e]===void 0&&(n[e]=[]),n[e].indexOf(t)===-1&&n[e].push(t)}hasEventListener(e,t){const n=this._listeners;return n===void 0?!1:n[e]!==void 0&&n[e].indexOf(t)!==-1}removeEventListener(e,t){const n=this._listeners;if(n===void 0)return;const s=n[e];if(s!==void 0){const a=s.indexOf(t);a!==-1&&s.splice(a,1)}}dispatchEvent(e){const t=this._listeners;if(t===void 0)return;const n=t[e.type];if(n!==void 0){e.target=this;const s=n.slice(0);for(let a=0,r=s.length;a<r;a++)s[a].call(this,e);e.target=null}}}const Ft=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"],Ea=Math.PI/180,Xr=180/Math.PI;function _s(){const i=Math.random()*4294967295|0,e=Math.random()*4294967295|0,t=Math.random()*4294967295|0,n=Math.random()*4294967295|0;return(Ft[i&255]+Ft[i>>8&255]+Ft[i>>16&255]+Ft[i>>24&255]+"-"+Ft[e&255]+Ft[e>>8&255]+"-"+Ft[e>>16&15|64]+Ft[e>>24&255]+"-"+Ft[t&63|128]+Ft[t>>8&255]+"-"+Ft[t>>16&255]+Ft[t>>24&255]+Ft[n&255]+Ft[n>>8&255]+Ft[n>>16&255]+Ft[n>>24&255]).toLowerCase()}function $e(i,e,t){return Math.max(e,Math.min(t,i))}function Eh(i,e){return(i%e+e)%e}function Ta(i,e,t){return(1-t)*i+t*e}function es(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return i/4294967295;case Uint16Array:return i/65535;case Uint8Array:return i/255;case Int32Array:return Math.max(i/2147483647,-1);case Int16Array:return Math.max(i/32767,-1);case Int8Array:return Math.max(i/127,-1);default:throw new Error("THREE.MathUtils: Invalid component type.")}}function Xt(i,e){switch(e.constructor){case Float32Array:return i;case Uint32Array:return Math.round(i*4294967295);case Uint16Array:return Math.round(i*65535);case Uint8Array:return Math.round(i*255);case Int32Array:return Math.round(i*2147483647);case Int16Array:return Math.round(i*32767);case Int8Array:return Math.round(i*127);default:throw new Error("THREE.MathUtils: Invalid component type.")}}class ze{static{ze.prototype.isVector2=!0}constructor(e=0,t=0){this.x=e,this.y=t}get width(){return this.x}set width(e){this.x=e}get height(){return this.y}set height(e){this.y=e}set(e,t){return this.x=e,this.y=t,this}setScalar(e){return this.x=e,this.y=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;default:throw new Error("THREE.Vector2: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;default:throw new Error("THREE.Vector2: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y)}copy(e){return this.x=e.x,this.y=e.y,this}add(e){return this.x+=e.x,this.y+=e.y,this}addScalar(e){return this.x+=e,this.y+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this}subScalar(e){return this.x-=e,this.y-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this}multiply(e){return this.x*=e.x,this.y*=e.y,this}multiplyScalar(e){return this.x*=e,this.y*=e,this}divide(e){return this.x/=e.x,this.y/=e.y,this}divideScalar(e){return this.multiplyScalar(1/e)}applyMatrix3(e){const t=this.x,n=this.y,s=e.elements;return this.x=s[0]*t+s[3]*n+s[6],this.y=s[1]*t+s[4]*n+s[7],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this}clamp(e,t){return this.x=$e(this.x,e.x,t.x),this.y=$e(this.y,e.y,t.y),this}clampScalar(e,t){return this.x=$e(this.x,e,t),this.y=$e(this.y,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar($e(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot(e){return this.x*e.x+this.y*e.y}cross(e){return this.x*e.y-this.y*e.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos($e(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y;return t*t+n*n}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this}equals(e){return e.x===this.x&&e.y===this.y}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this}rotateAround(e,t){const n=Math.cos(t),s=Math.sin(t),a=this.x-e.x,r=this.y-e.y;return this.x=a*n-r*s+e.x,this.y=a*s+r*n+e.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class wi{constructor(e=0,t=0,n=0,s=1){this.isQuaternion=!0,this._x=e,this._y=t,this._z=n,this._w=s}static slerpFlat(e,t,n,s,a,r,o){let l=n[s+0],c=n[s+1],h=n[s+2],u=n[s+3],d=a[r+0],p=a[r+1],g=a[r+2],x=a[r+3];if(u!==x||l!==d||c!==p||h!==g){let m=l*d+c*p+h*g+u*x;m<0&&(d=-d,p=-p,g=-g,x=-x,m=-m);let f=1-o;if(m<.9995){const M=Math.acos(m),w=Math.sin(M);f=Math.sin(f*M)/w,o=Math.sin(o*M)/w,l=l*f+d*o,c=c*f+p*o,h=h*f+g*o,u=u*f+x*o}else{l=l*f+d*o,c=c*f+p*o,h=h*f+g*o,u=u*f+x*o;const M=1/Math.sqrt(l*l+c*c+h*h+u*u);l*=M,c*=M,h*=M,u*=M}}e[t]=l,e[t+1]=c,e[t+2]=h,e[t+3]=u}static multiplyQuaternionsFlat(e,t,n,s,a,r){const o=n[s],l=n[s+1],c=n[s+2],h=n[s+3],u=a[r],d=a[r+1],p=a[r+2],g=a[r+3];return e[t]=o*g+h*u+l*p-c*d,e[t+1]=l*g+h*d+c*u-o*p,e[t+2]=c*g+h*p+o*d-l*u,e[t+3]=h*g-o*u-l*d-c*p,e}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get w(){return this._w}set w(e){this._w=e,this._onChangeCallback()}set(e,t,n,s){return this._x=e,this._y=t,this._z=n,this._w=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy(e){return this._x=e.x,this._y=e.y,this._z=e.z,this._w=e.w,this._onChangeCallback(),this}setFromEuler(e,t=!0){const n=e._x,s=e._y,a=e._z,r=e._order,o=Math.cos,l=Math.sin,c=o(n/2),h=o(s/2),u=o(a/2),d=l(n/2),p=l(s/2),g=l(a/2);switch(r){case"XYZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"YXZ":this._x=d*h*u+c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"ZXY":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u-d*p*g;break;case"ZYX":this._x=d*h*u-c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u+d*p*g;break;case"YZX":this._x=d*h*u+c*p*g,this._y=c*p*u+d*h*g,this._z=c*h*g-d*p*u,this._w=c*h*u-d*p*g;break;case"XZY":this._x=d*h*u-c*p*g,this._y=c*p*u-d*h*g,this._z=c*h*g+d*p*u,this._w=c*h*u+d*p*g;break;default:Fe("Quaternion: .setFromEuler() encountered an unknown order: "+r)}return t===!0&&this._onChangeCallback(),this}setFromAxisAngle(e,t){const n=t/2,s=Math.sin(n);return this._x=e.x*s,this._y=e.y*s,this._z=e.z*s,this._w=Math.cos(n),this._onChangeCallback(),this}setFromRotationMatrix(e){const t=e.elements,n=t[0],s=t[4],a=t[8],r=t[1],o=t[5],l=t[9],c=t[2],h=t[6],u=t[10],d=n+o+u;if(d>0){const p=.5/Math.sqrt(d+1);this._w=.25/p,this._x=(h-l)*p,this._y=(a-c)*p,this._z=(r-s)*p}else if(n>o&&n>u){const p=2*Math.sqrt(1+n-o-u);this._w=(h-l)/p,this._x=.25*p,this._y=(s+r)/p,this._z=(a+c)/p}else if(o>u){const p=2*Math.sqrt(1+o-n-u);this._w=(a-c)/p,this._x=(s+r)/p,this._y=.25*p,this._z=(l+h)/p}else{const p=2*Math.sqrt(1+u-n-o);this._w=(r-s)/p,this._x=(a+c)/p,this._y=(l+h)/p,this._z=.25*p}return this._onChangeCallback(),this}setFromUnitVectors(e,t){let n=e.dot(t)+1;return n<1e-8?(n=0,Math.abs(e.x)>Math.abs(e.z)?(this._x=-e.y,this._y=e.x,this._z=0,this._w=n):(this._x=0,this._y=-e.z,this._z=e.y,this._w=n)):(this._x=e.y*t.z-e.z*t.y,this._y=e.z*t.x-e.x*t.z,this._z=e.x*t.y-e.y*t.x,this._w=n),this.normalize()}angleTo(e){return 2*Math.acos(Math.abs($e(this.dot(e),-1,1)))}rotateTowards(e,t){const n=this.angleTo(e);if(n===0)return this;const s=Math.min(1,t/n);return this.slerp(e,s),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot(e){return this._x*e._x+this._y*e._y+this._z*e._z+this._w*e._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let e=this.length();return e===0?(this._x=0,this._y=0,this._z=0,this._w=1):(e=1/e,this._x=this._x*e,this._y=this._y*e,this._z=this._z*e,this._w=this._w*e),this._onChangeCallback(),this}multiply(e){return this.multiplyQuaternions(this,e)}premultiply(e){return this.multiplyQuaternions(e,this)}multiplyQuaternions(e,t){const n=e._x,s=e._y,a=e._z,r=e._w,o=t._x,l=t._y,c=t._z,h=t._w;return this._x=n*h+r*o+s*c-a*l,this._y=s*h+r*l+a*o-n*c,this._z=a*h+r*c+n*l-s*o,this._w=r*h-n*o-s*l-a*c,this._onChangeCallback(),this}slerp(e,t){let n=e._x,s=e._y,a=e._z,r=e._w,o=this.dot(e);o<0&&(n=-n,s=-s,a=-a,r=-r,o=-o);let l=1-t;if(o<.9995){const c=Math.acos(o),h=Math.sin(c);l=Math.sin(l*c)/h,t=Math.sin(t*c)/h,this._x=this._x*l+n*t,this._y=this._y*l+s*t,this._z=this._z*l+a*t,this._w=this._w*l+r*t,this._onChangeCallback()}else this._x=this._x*l+n*t,this._y=this._y*l+s*t,this._z=this._z*l+a*t,this._w=this._w*l+r*t,this.normalize();return this}slerpQuaternions(e,t,n){return this.copy(e).slerp(t,n)}random(){const e=2*Math.PI*Math.random(),t=2*Math.PI*Math.random(),n=Math.random(),s=Math.sqrt(1-n),a=Math.sqrt(n);return this.set(s*Math.sin(e),s*Math.cos(e),a*Math.sin(t),a*Math.cos(t))}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._w===this._w}fromArray(e,t=0){return this._x=e[t],this._y=e[t+1],this._z=e[t+2],this._w=e[t+3],this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._w,e}fromBufferAttribute(e,t){return this._x=e.getX(t),this._y=e.getY(t),this._z=e.getZ(t),this._w=e.getW(t),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class I{static{I.prototype.isVector3=!0}constructor(e=0,t=0,n=0){this.x=e,this.y=t,this.z=n}set(e,t,n){return n===void 0&&(n=this.z),this.x=e,this.y=t,this.z=n,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;default:throw new Error("THREE.Vector3: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw new Error("THREE.Vector3: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this}multiplyVectors(e,t){return this.x=e.x*t.x,this.y=e.y*t.y,this.z=e.z*t.z,this}applyEuler(e){return this.applyQuaternion(No.setFromEuler(e))}applyAxisAngle(e,t){return this.applyQuaternion(No.setFromAxisAngle(e,t))}applyMatrix3(e){const t=this.x,n=this.y,s=this.z,a=e.elements;return this.x=a[0]*t+a[3]*n+a[6]*s,this.y=a[1]*t+a[4]*n+a[7]*s,this.z=a[2]*t+a[5]*n+a[8]*s,this}applyNormalMatrix(e){return this.applyMatrix3(e).normalize()}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,a=e.elements,r=1/(a[3]*t+a[7]*n+a[11]*s+a[15]);return this.x=(a[0]*t+a[4]*n+a[8]*s+a[12])*r,this.y=(a[1]*t+a[5]*n+a[9]*s+a[13])*r,this.z=(a[2]*t+a[6]*n+a[10]*s+a[14])*r,this}applyQuaternion(e){const t=this.x,n=this.y,s=this.z,a=e.x,r=e.y,o=e.z,l=e.w,c=2*(r*s-o*n),h=2*(o*t-a*s),u=2*(a*n-r*t);return this.x=t+l*c+r*u-o*h,this.y=n+l*h+o*c-a*u,this.z=s+l*u+a*h-r*c,this}project(e){return this.applyMatrix4(e.matrixWorldInverse).applyMatrix4(e.projectionMatrix)}unproject(e){return this.applyMatrix4(e.projectionMatrixInverse).applyMatrix4(e.matrixWorld)}transformDirection(e){const t=this.x,n=this.y,s=this.z,a=e.elements;return this.x=a[0]*t+a[4]*n+a[8]*s,this.y=a[1]*t+a[5]*n+a[9]*s,this.z=a[2]*t+a[6]*n+a[10]*s,this.normalize()}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this}divideScalar(e){return this.multiplyScalar(1/e)}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this}clamp(e,t){return this.x=$e(this.x,e.x,t.x),this.y=$e(this.y,e.y,t.y),this.z=$e(this.z,e.z,t.z),this}clampScalar(e,t){return this.x=$e(this.x,e,t),this.y=$e(this.y,e,t),this.z=$e(this.z,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar($e(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this}cross(e){return this.crossVectors(this,e)}crossVectors(e,t){const n=e.x,s=e.y,a=e.z,r=t.x,o=t.y,l=t.z;return this.x=s*l-a*o,this.y=a*r-n*l,this.z=n*o-s*r,this}projectOnVector(e){const t=e.lengthSq();if(t===0)return this.set(0,0,0);const n=e.dot(this)/t;return this.copy(e).multiplyScalar(n)}projectOnPlane(e){return wa.copy(this).projectOnVector(e),this.sub(wa)}reflect(e){return this.sub(wa.copy(e).multiplyScalar(2*this.dot(e)))}angleTo(e){const t=Math.sqrt(this.lengthSq()*e.lengthSq());if(t===0)return Math.PI/2;const n=this.dot(e)/t;return Math.acos($e(n,-1,1))}distanceTo(e){return Math.sqrt(this.distanceToSquared(e))}distanceToSquared(e){const t=this.x-e.x,n=this.y-e.y,s=this.z-e.z;return t*t+n*n+s*s}manhattanDistanceTo(e){return Math.abs(this.x-e.x)+Math.abs(this.y-e.y)+Math.abs(this.z-e.z)}setFromSpherical(e){return this.setFromSphericalCoords(e.radius,e.phi,e.theta)}setFromSphericalCoords(e,t,n){const s=Math.sin(t)*e;return this.x=s*Math.sin(n),this.y=Math.cos(t)*e,this.z=s*Math.cos(n),this}setFromCylindrical(e){return this.setFromCylindricalCoords(e.radius,e.theta,e.y)}setFromCylindricalCoords(e,t,n){return this.x=e*Math.sin(t),this.y=n,this.z=e*Math.cos(t),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this}setFromMatrixScale(e){const t=this.setFromMatrixColumn(e,0).length(),n=this.setFromMatrixColumn(e,1).length(),s=this.setFromMatrixColumn(e,2).length();return this.x=t,this.y=n,this.z=s,this}setFromMatrixColumn(e,t){return this.fromArray(e.elements,t*4)}setFromMatrix3Column(e,t){return this.fromArray(e.elements,t*3)}setFromEuler(e){return this.x=e._x,this.y=e._y,this.z=e._z,this}setFromColor(e){return this.x=e.r,this.y=e.g,this.z=e.b,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){const e=Math.random()*Math.PI*2,t=Math.random()*2-1,n=Math.sqrt(1-t*t);return this.x=n*Math.cos(e),this.y=t,this.z=n*Math.sin(e),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}const wa=new I,No=new wi;class Oe{static{Oe.prototype.isMatrix3=!0}constructor(e,t,n,s,a,r,o,l,c){this.elements=[1,0,0,0,1,0,0,0,1],e!==void 0&&this.set(e,t,n,s,a,r,o,l,c)}set(e,t,n,s,a,r,o,l,c){const h=this.elements;return h[0]=e,h[1]=s,h[2]=o,h[3]=t,h[4]=a,h[5]=l,h[6]=n,h[7]=r,h[8]=c,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],this}extractBasis(e,t,n){return e.setFromMatrix3Column(this,0),t.setFromMatrix3Column(this,1),n.setFromMatrix3Column(this,2),this}setFromMatrix4(e){const t=e.elements;return this.set(t[0],t[4],t[8],t[1],t[5],t[9],t[2],t[6],t[10]),this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,a=this.elements,r=n[0],o=n[3],l=n[6],c=n[1],h=n[4],u=n[7],d=n[2],p=n[5],g=n[8],x=s[0],m=s[3],f=s[6],M=s[1],w=s[4],S=s[7],b=s[2],E=s[5],R=s[8];return a[0]=r*x+o*M+l*b,a[3]=r*m+o*w+l*E,a[6]=r*f+o*S+l*R,a[1]=c*x+h*M+u*b,a[4]=c*m+h*w+u*E,a[7]=c*f+h*S+u*R,a[2]=d*x+p*M+g*b,a[5]=d*m+p*w+g*E,a[8]=d*f+p*S+g*R,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[3]*=e,t[6]*=e,t[1]*=e,t[4]*=e,t[7]*=e,t[2]*=e,t[5]*=e,t[8]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[1],s=e[2],a=e[3],r=e[4],o=e[5],l=e[6],c=e[7],h=e[8];return t*r*h-t*o*c-n*a*h+n*o*l+s*a*c-s*r*l}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],a=e[3],r=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=h*r-o*c,d=o*l-h*a,p=c*a-r*l,g=t*u+n*d+s*p;if(g===0)return this.set(0,0,0,0,0,0,0,0,0);const x=1/g;return e[0]=u*x,e[1]=(s*c-h*n)*x,e[2]=(o*n-s*r)*x,e[3]=d*x,e[4]=(h*t-s*l)*x,e[5]=(s*a-o*t)*x,e[6]=p*x,e[7]=(n*l-c*t)*x,e[8]=(r*t-n*a)*x,this}transpose(){let e;const t=this.elements;return e=t[1],t[1]=t[3],t[3]=e,e=t[2],t[2]=t[6],t[6]=e,e=t[5],t[5]=t[7],t[7]=e,this}getNormalMatrix(e){return this.setFromMatrix4(e).invert().transpose()}transposeIntoArray(e){const t=this.elements;return e[0]=t[0],e[1]=t[3],e[2]=t[6],e[3]=t[1],e[4]=t[4],e[5]=t[7],e[6]=t[2],e[7]=t[5],e[8]=t[8],this}setUvTransform(e,t,n,s,a,r,o){const l=Math.cos(a),c=Math.sin(a);return this.set(n*l,n*c,-n*(l*r+c*o)+r+e,-s*c,s*l,-s*(-c*r+l*o)+o+t,0,0,1),this}scale(e,t){return zi("Matrix3: .scale() is deprecated. Use .makeScale() instead."),this.premultiply(Aa.makeScale(e,t)),this}rotate(e){return zi("Matrix3: .rotate() is deprecated. Use .makeRotation() instead."),this.premultiply(Aa.makeRotation(-e)),this}translate(e,t){return zi("Matrix3: .translate() is deprecated. Use .makeTranslation() instead."),this.premultiply(Aa.makeTranslation(e,t)),this}makeTranslation(e,t){return e.isVector2?this.set(1,0,e.x,0,1,e.y,0,0,1):this.set(1,0,e,0,1,t,0,0,1),this}makeRotation(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,n,t,0,0,0,1),this}makeScale(e,t){return this.set(e,0,0,0,t,0,0,0,1),this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<9;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<9;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e}clone(){return new this.constructor().fromArray(this.elements)}}const Aa=new Oe,Fo=new Oe().set(.4123908,.3575843,.1804808,.212639,.7151687,.0721923,.0193308,.1191948,.9505322),Oo=new Oe().set(3.2409699,-1.5373832,-.4986108,-.9692436,1.8759675,.0415551,.0556301,-.203977,1.0569715);function Th(){const i={enabled:!0,workingColorSpace:la,spaces:{},convert:function(s,a,r){return this.enabled===!1||a===r||!a||!r||(this.spaces[a].transfer===lt&&(s.r=zn(s.r),s.g=zn(s.g),s.b=zn(s.b)),this.spaces[a].primaries!==this.spaces[r].primaries&&(s.applyMatrix3(this.spaces[a].toXYZ),s.applyMatrix3(this.spaces[r].fromXYZ)),this.spaces[r].transfer===lt&&(s.r=Wi(s.r),s.g=Wi(s.g),s.b=Wi(s.b))),s},workingToColorSpace:function(s,a){return this.convert(s,this.workingColorSpace,a)},colorSpaceToWorking:function(s,a){return this.convert(s,a,this.workingColorSpace)},getPrimaries:function(s){return this.spaces[s].primaries},getTransfer:function(s){return s===Bn?ca:this.spaces[s].transfer},getToneMappingMode:function(s){return this.spaces[s].outputColorSpaceConfig.toneMappingMode||"standard"},getLuminanceCoefficients:function(s,a=this.workingColorSpace){return s.fromArray(this.spaces[a].luminanceCoefficients)},define:function(s){Object.assign(this.spaces,s)},_getMatrix:function(s,a,r){return s.copy(this.spaces[a].toXYZ).multiply(this.spaces[r].fromXYZ)},_getDrawingBufferColorSpace:function(s){return this.spaces[s].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(s=this.workingColorSpace){return this.spaces[s].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(s,a){return zi("ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),i.workingToColorSpace(s,a)},toWorkingColorSpace:function(s,a){return zi("ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),i.colorSpaceToWorking(s,a)}},e=[.64,.33,.3,.6,.15,.06],t=[.2126,.7152,.0722],n=[.3127,.329];return i.define({[la]:{primaries:e,whitePoint:n,transfer:ca,toXYZ:Fo,fromXYZ:Oo,luminanceCoefficients:t,workingColorSpaceConfig:{unpackColorSpace:an},outputColorSpaceConfig:{drawingBufferColorSpace:an}},[an]:{primaries:e,whitePoint:n,transfer:lt,toXYZ:Fo,fromXYZ:Oo,luminanceCoefficients:t,outputColorSpaceConfig:{drawingBufferColorSpace:an}}}),i}const Je=Th();function zn(i){return i<.04045?i*.0773993808:Math.pow(i*.9478672986+.0521327014,2.4)}function Wi(i){return i<.0031308?i*12.92:1.055*Math.pow(i,.41666)-.055}let Pi;class wh{static getDataURL(e,t="image/png"){if(/^data:/i.test(e.src)||typeof HTMLCanvasElement>"u")return e.src;let n;if(e instanceof HTMLCanvasElement)n=e;else{Pi===void 0&&(Pi=ha("canvas")),Pi.width=e.width,Pi.height=e.height;const s=Pi.getContext("2d");e instanceof ImageData?s.putImageData(e,0,0):s.drawImage(e,0,0,e.width,e.height),n=Pi}return n.toDataURL(t)}static sRGBToLinear(e){if(typeof HTMLImageElement<"u"&&e instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&e instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&e instanceof ImageBitmap){const t=ha("canvas");t.width=e.width,t.height=e.height;const n=t.getContext("2d");n.drawImage(e,0,0,e.width,e.height);const s=n.getImageData(0,0,e.width,e.height),a=s.data;for(let r=0;r<a.length;r++)a[r]=zn(a[r]/255)*255;return n.putImageData(s,0,0),t}else if(e.data){const t=e.data.slice(0);for(let n=0;n<t.length;n++)t instanceof Uint8Array||t instanceof Uint8ClampedArray?t[n]=Math.floor(zn(t[n]/255)*255):t[n]=zn(t[n]);return{data:t,width:e.width,height:e.height}}else return Fe("ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),e}}let Ah=0;class po{constructor(e=null){this.isSource=!0,Object.defineProperty(this,"id",{value:Ah++}),this.uuid=_s(),this.data=e,this.dataReady=!0,this.version=0}getSize(e){const t=this.data;return typeof HTMLVideoElement<"u"&&t instanceof HTMLVideoElement?e.set(t.videoWidth,t.videoHeight,0):typeof VideoFrame<"u"&&t instanceof VideoFrame?e.set(t.displayWidth,t.displayHeight,0):t!==null?e.set(t.width,t.height,t.depth||0):e.set(0,0,0),e}set needsUpdate(e){e===!0&&this.version++}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.images[this.uuid]!==void 0)return e.images[this.uuid];const n={uuid:this.uuid,url:""},s=this.data;if(s!==null){let a;if(Array.isArray(s)){a=[];for(let r=0,o=s.length;r<o;r++)s[r].isDataTexture?a.push(Ra(s[r].image)):a.push(Ra(s[r]))}else a=Ra(s);n.url=a}return t||(e.images[this.uuid]=n),n}}function Ra(i){return typeof HTMLImageElement<"u"&&i instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&i instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&i instanceof ImageBitmap?wh.getDataURL(i):i.data?{data:Array.from(i.data),width:i.width,height:i.height,type:i.data.constructor.name}:(Fe("Texture: Unable to serialize Texture."),{})}let Rh=0;const Ca=new I;class Vt extends Ti{constructor(e=Vt.DEFAULT_IMAGE,t=Vt.DEFAULT_MAPPING,n=Hn,s=Hn,a=Gt,r=vi,o=_n,l=on,c=Vt.DEFAULT_ANISOTROPY,h=Bn){super(),this.isTexture=!0,Object.defineProperty(this,"id",{value:Rh++}),this.uuid=_s(),this.name="",this.source=new po(e),this.mipmaps=[],this.mapping=t,this.channel=0,this.wrapS=n,this.wrapT=s,this.magFilter=a,this.minFilter=r,this.anisotropy=c,this.format=o,this.internalFormat=null,this.type=l,this.offset=new ze(0,0),this.repeat=new ze(1,1),this.center=new ze(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new Oe,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=h,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=!!(e&&e.depth&&e.depth>1),this.pmremVersion=0,this.normalized=!1}get width(){return this.source.getSize(Ca).x}get height(){return this.source.getSize(Ca).y}get depth(){return this.source.getSize(Ca).z}get image(){return this.source.data}set image(e){this.source.data=e}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy(e){return this.name=e.name,this.source=e.source,this.mipmaps=e.mipmaps.slice(0),this.mapping=e.mapping,this.channel=e.channel,this.wrapS=e.wrapS,this.wrapT=e.wrapT,this.magFilter=e.magFilter,this.minFilter=e.minFilter,this.anisotropy=e.anisotropy,this.format=e.format,this.internalFormat=e.internalFormat,this.type=e.type,this.normalized=e.normalized,this.offset.copy(e.offset),this.repeat.copy(e.repeat),this.center.copy(e.center),this.rotation=e.rotation,this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrix.copy(e.matrix),this.generateMipmaps=e.generateMipmaps,this.premultiplyAlpha=e.premultiplyAlpha,this.flipY=e.flipY,this.unpackAlignment=e.unpackAlignment,this.colorSpace=e.colorSpace,this.renderTarget=e.renderTarget,this.isRenderTargetTexture=e.isRenderTargetTexture,this.isArrayTexture=e.isArrayTexture,this.userData=JSON.parse(JSON.stringify(e.userData)),this.needsUpdate=!0,this}setValues(e){for(const t in e){const n=e[t];if(n===void 0){Fe(`Texture.setValues(): parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Fe(`Texture.setValues(): property '${t}' does not exist.`);continue}s&&n&&s.isVector2&&n.isVector2||s&&n&&s.isVector3&&n.isVector3||s&&n&&s.isMatrix3&&n.isMatrix3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";if(!t&&e.textures[this.uuid]!==void 0)return e.textures[this.uuid];const n={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON(e).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,normalized:this.normalized,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};return Object.keys(this.userData).length>0&&(n.userData=this.userData),t||(e.textures[this.uuid]=n),n}dispose(){this.dispatchEvent({type:"dispose"})}transformUv(e){if(this.mapping!==Xl)return e;if(e.applyMatrix3(this.matrix),e.x<0||e.x>1)switch(this.wrapS){case us:e.x=e.x-Math.floor(e.x);break;case Hn:e.x=e.x<0?0:1;break;case pr:Math.abs(Math.floor(e.x)%2)===1?e.x=Math.ceil(e.x)-e.x:e.x=e.x-Math.floor(e.x);break}if(e.y<0||e.y>1)switch(this.wrapT){case us:e.y=e.y-Math.floor(e.y);break;case Hn:e.y=e.y<0?0:1;break;case pr:Math.abs(Math.floor(e.y)%2)===1?e.y=Math.ceil(e.y)-e.y:e.y=e.y-Math.floor(e.y);break}return this.flipY&&(e.y=1-e.y),e}set needsUpdate(e){e===!0&&(this.version++,this.source.needsUpdate=!0)}set needsPMREMUpdate(e){e===!0&&this.pmremVersion++}}Vt.DEFAULT_IMAGE=null;Vt.DEFAULT_MAPPING=Xl;Vt.DEFAULT_ANISOTROPY=1;class xt{static{xt.prototype.isVector4=!0}constructor(e=0,t=0,n=0,s=1){this.x=e,this.y=t,this.z=n,this.w=s}get width(){return this.z}set width(e){this.z=e}get height(){return this.w}set height(e){this.w=e}set(e,t,n,s){return this.x=e,this.y=t,this.z=n,this.w=s,this}setScalar(e){return this.x=e,this.y=e,this.z=e,this.w=e,this}setX(e){return this.x=e,this}setY(e){return this.y=e,this}setZ(e){return this.z=e,this}setW(e){return this.w=e,this}setComponent(e,t){switch(e){case 0:this.x=t;break;case 1:this.y=t;break;case 2:this.z=t;break;case 3:this.w=t;break;default:throw new Error("THREE.Vector4: index is out of range: "+e)}return this}getComponent(e){switch(e){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw new Error("THREE.Vector4: index is out of range: "+e)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy(e){return this.x=e.x,this.y=e.y,this.z=e.z,this.w=e.w!==void 0?e.w:1,this}add(e){return this.x+=e.x,this.y+=e.y,this.z+=e.z,this.w+=e.w,this}addScalar(e){return this.x+=e,this.y+=e,this.z+=e,this.w+=e,this}addVectors(e,t){return this.x=e.x+t.x,this.y=e.y+t.y,this.z=e.z+t.z,this.w=e.w+t.w,this}addScaledVector(e,t){return this.x+=e.x*t,this.y+=e.y*t,this.z+=e.z*t,this.w+=e.w*t,this}sub(e){return this.x-=e.x,this.y-=e.y,this.z-=e.z,this.w-=e.w,this}subScalar(e){return this.x-=e,this.y-=e,this.z-=e,this.w-=e,this}subVectors(e,t){return this.x=e.x-t.x,this.y=e.y-t.y,this.z=e.z-t.z,this.w=e.w-t.w,this}multiply(e){return this.x*=e.x,this.y*=e.y,this.z*=e.z,this.w*=e.w,this}multiplyScalar(e){return this.x*=e,this.y*=e,this.z*=e,this.w*=e,this}applyMatrix4(e){const t=this.x,n=this.y,s=this.z,a=this.w,r=e.elements;return this.x=r[0]*t+r[4]*n+r[8]*s+r[12]*a,this.y=r[1]*t+r[5]*n+r[9]*s+r[13]*a,this.z=r[2]*t+r[6]*n+r[10]*s+r[14]*a,this.w=r[3]*t+r[7]*n+r[11]*s+r[15]*a,this}divide(e){return this.x/=e.x,this.y/=e.y,this.z/=e.z,this.w/=e.w,this}divideScalar(e){return this.multiplyScalar(1/e)}setAxisAngleFromQuaternion(e){this.w=2*Math.acos(e.w);const t=Math.sqrt(1-e.w*e.w);return t<1e-4?(this.x=1,this.y=0,this.z=0):(this.x=e.x/t,this.y=e.y/t,this.z=e.z/t),this}setAxisAngleFromRotationMatrix(e){let t,n,s,a;const l=e.elements,c=l[0],h=l[4],u=l[8],d=l[1],p=l[5],g=l[9],x=l[2],m=l[6],f=l[10];if(Math.abs(h-d)<.01&&Math.abs(u-x)<.01&&Math.abs(g-m)<.01){if(Math.abs(h+d)<.1&&Math.abs(u+x)<.1&&Math.abs(g+m)<.1&&Math.abs(c+p+f-3)<.1)return this.set(1,0,0,0),this;t=Math.PI;const w=(c+1)/2,S=(p+1)/2,b=(f+1)/2,E=(h+d)/4,R=(u+x)/4,v=(g+m)/4;return w>S&&w>b?w<.01?(n=0,s=.707106781,a=.707106781):(n=Math.sqrt(w),s=E/n,a=R/n):S>b?S<.01?(n=.707106781,s=0,a=.707106781):(s=Math.sqrt(S),n=E/s,a=v/s):b<.01?(n=.707106781,s=.707106781,a=0):(a=Math.sqrt(b),n=R/a,s=v/a),this.set(n,s,a,t),this}let M=Math.sqrt((m-g)*(m-g)+(u-x)*(u-x)+(d-h)*(d-h));return Math.abs(M)<.001&&(M=1),this.x=(m-g)/M,this.y=(u-x)/M,this.z=(d-h)/M,this.w=Math.acos((c+p+f-1)/2),this}setFromMatrixPosition(e){const t=e.elements;return this.x=t[12],this.y=t[13],this.z=t[14],this.w=t[15],this}min(e){return this.x=Math.min(this.x,e.x),this.y=Math.min(this.y,e.y),this.z=Math.min(this.z,e.z),this.w=Math.min(this.w,e.w),this}max(e){return this.x=Math.max(this.x,e.x),this.y=Math.max(this.y,e.y),this.z=Math.max(this.z,e.z),this.w=Math.max(this.w,e.w),this}clamp(e,t){return this.x=$e(this.x,e.x,t.x),this.y=$e(this.y,e.y,t.y),this.z=$e(this.z,e.z,t.z),this.w=$e(this.w,e.w,t.w),this}clampScalar(e,t){return this.x=$e(this.x,e,t),this.y=$e(this.y,e,t),this.z=$e(this.z,e,t),this.w=$e(this.w,e,t),this}clampLength(e,t){const n=this.length();return this.divideScalar(n||1).multiplyScalar($e(n,e,t))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot(e){return this.x*e.x+this.y*e.y+this.z*e.z+this.w*e.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength(e){return this.normalize().multiplyScalar(e)}lerp(e,t){return this.x+=(e.x-this.x)*t,this.y+=(e.y-this.y)*t,this.z+=(e.z-this.z)*t,this.w+=(e.w-this.w)*t,this}lerpVectors(e,t,n){return this.x=e.x+(t.x-e.x)*n,this.y=e.y+(t.y-e.y)*n,this.z=e.z+(t.z-e.z)*n,this.w=e.w+(t.w-e.w)*n,this}equals(e){return e.x===this.x&&e.y===this.y&&e.z===this.z&&e.w===this.w}fromArray(e,t=0){return this.x=e[t],this.y=e[t+1],this.z=e[t+2],this.w=e[t+3],this}toArray(e=[],t=0){return e[t]=this.x,e[t+1]=this.y,e[t+2]=this.z,e[t+3]=this.w,e}fromBufferAttribute(e,t){return this.x=e.getX(t),this.y=e.getY(t),this.z=e.getZ(t),this.w=e.getW(t),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Ch extends Ti{constructor(e=1,t=1,n={}){super(),n=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:Gt,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1,useArrayDepthTexture:!1},n),this.isRenderTarget=!0,this.width=e,this.height=t,this.depth=n.depth,this.scissor=new xt(0,0,e,t),this.scissorTest=!1,this.viewport=new xt(0,0,e,t),this.textures=[];const s={width:e,height:t,depth:n.depth},a=new Vt(s),r=n.count;for(let o=0;o<r;o++)this.textures[o]=a.clone(),this.textures[o].isRenderTargetTexture=!0,this.textures[o].renderTarget=this;this._setTextureOptions(n),this.depthBuffer=n.depthBuffer,this.stencilBuffer=n.stencilBuffer,this.resolveDepthBuffer=n.resolveDepthBuffer,this.resolveStencilBuffer=n.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=n.depthTexture,this.samples=n.samples,this.multiview=n.multiview,this.useArrayDepthTexture=n.useArrayDepthTexture}_setTextureOptions(e={}){const t={minFilter:Gt,generateMipmaps:!1,flipY:!1,internalFormat:null};e.mapping!==void 0&&(t.mapping=e.mapping),e.wrapS!==void 0&&(t.wrapS=e.wrapS),e.wrapT!==void 0&&(t.wrapT=e.wrapT),e.wrapR!==void 0&&(t.wrapR=e.wrapR),e.magFilter!==void 0&&(t.magFilter=e.magFilter),e.minFilter!==void 0&&(t.minFilter=e.minFilter),e.format!==void 0&&(t.format=e.format),e.type!==void 0&&(t.type=e.type),e.anisotropy!==void 0&&(t.anisotropy=e.anisotropy),e.colorSpace!==void 0&&(t.colorSpace=e.colorSpace),e.flipY!==void 0&&(t.flipY=e.flipY),e.generateMipmaps!==void 0&&(t.generateMipmaps=e.generateMipmaps),e.internalFormat!==void 0&&(t.internalFormat=e.internalFormat);for(let n=0;n<this.textures.length;n++)this.textures[n].setValues(t)}get texture(){return this.textures[0]}set texture(e){this.textures[0]=e}set depthTexture(e){this._depthTexture!==null&&(this._depthTexture.renderTarget=null),e!==null&&(e.renderTarget=this),this._depthTexture=e}get depthTexture(){return this._depthTexture}setSize(e,t,n=1){if(this.width!==e||this.height!==t||this.depth!==n){this.width=e,this.height=t,this.depth=n;for(let s=0,a=this.textures.length;s<a;s++)this.textures[s].image.width=e,this.textures[s].image.height=t,this.textures[s].image.depth=n,this.textures[s].isData3DTexture!==!0&&(this.textures[s].isArrayTexture=this.textures[s].image.depth>1);this.dispose()}this.viewport.set(0,0,e,t),this.scissor.set(0,0,e,t)}clone(){return new this.constructor().copy(this)}copy(e){this.width=e.width,this.height=e.height,this.depth=e.depth,this.scissor.copy(e.scissor),this.scissorTest=e.scissorTest,this.viewport.copy(e.viewport),this.textures.length=0;for(let t=0,n=e.textures.length;t<n;t++){this.textures[t]=e.textures[t].clone(),this.textures[t].isRenderTargetTexture=!0,this.textures[t].renderTarget=this;const s=Object.assign({},e.textures[t].image);this.textures[t].source=new po(s)}return this.depthBuffer=e.depthBuffer,this.stencilBuffer=e.stencilBuffer,this.resolveDepthBuffer=e.resolveDepthBuffer,this.resolveStencilBuffer=e.resolveStencilBuffer,e.depthTexture!==null&&(this.depthTexture=e.depthTexture.clone()),this.samples=e.samples,this.multiview=e.multiview,this.useArrayDepthTexture=e.useArrayDepthTexture,this}dispose(){this.dispatchEvent({type:"dispose"})}}class Pn extends Ch{constructor(e=1,t=1,n={}){super(e,t,n),this.isWebGLRenderTarget=!0}}class tc extends Vt{constructor(e=null,t=1,n=1,s=1){super(null),this.isDataArrayTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=kt,this.minFilter=kt,this.wrapR=Hn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate(e){this.layerUpdates.add(e)}clearLayerUpdates(){this.layerUpdates.clear()}}class Ph extends Vt{constructor(e=null,t=1,n=1,s=1){super(null),this.isData3DTexture=!0,this.image={data:e,width:t,height:n,depth:s},this.magFilter=kt,this.minFilter=kt,this.wrapR=Hn,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class pt{static{pt.prototype.isMatrix4=!0}constructor(e,t,n,s,a,r,o,l,c,h,u,d,p,g,x,m){this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],e!==void 0&&this.set(e,t,n,s,a,r,o,l,c,h,u,d,p,g,x,m)}set(e,t,n,s,a,r,o,l,c,h,u,d,p,g,x,m){const f=this.elements;return f[0]=e,f[4]=t,f[8]=n,f[12]=s,f[1]=a,f[5]=r,f[9]=o,f[13]=l,f[2]=c,f[6]=h,f[10]=u,f[14]=d,f[3]=p,f[7]=g,f[11]=x,f[15]=m,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new pt().fromArray(this.elements)}copy(e){const t=this.elements,n=e.elements;return t[0]=n[0],t[1]=n[1],t[2]=n[2],t[3]=n[3],t[4]=n[4],t[5]=n[5],t[6]=n[6],t[7]=n[7],t[8]=n[8],t[9]=n[9],t[10]=n[10],t[11]=n[11],t[12]=n[12],t[13]=n[13],t[14]=n[14],t[15]=n[15],this}copyPosition(e){const t=this.elements,n=e.elements;return t[12]=n[12],t[13]=n[13],t[14]=n[14],this}setFromMatrix3(e){const t=e.elements;return this.set(t[0],t[3],t[6],0,t[1],t[4],t[7],0,t[2],t[5],t[8],0,0,0,0,1),this}extractBasis(e,t,n){return this.determinantAffine()===0?(e.set(1,0,0),t.set(0,1,0),n.set(0,0,1),this):(e.setFromMatrixColumn(this,0),t.setFromMatrixColumn(this,1),n.setFromMatrixColumn(this,2),this)}makeBasis(e,t,n){return this.set(e.x,t.x,n.x,0,e.y,t.y,n.y,0,e.z,t.z,n.z,0,0,0,0,1),this}extractRotation(e){if(e.determinantAffine()===0)return this.identity();const t=this.elements,n=e.elements,s=1/Li.setFromMatrixColumn(e,0).length(),a=1/Li.setFromMatrixColumn(e,1).length(),r=1/Li.setFromMatrixColumn(e,2).length();return t[0]=n[0]*s,t[1]=n[1]*s,t[2]=n[2]*s,t[3]=0,t[4]=n[4]*a,t[5]=n[5]*a,t[6]=n[6]*a,t[7]=0,t[8]=n[8]*r,t[9]=n[9]*r,t[10]=n[10]*r,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromEuler(e){const t=this.elements,n=e.x,s=e.y,a=e.z,r=Math.cos(n),o=Math.sin(n),l=Math.cos(s),c=Math.sin(s),h=Math.cos(a),u=Math.sin(a);if(e.order==="XYZ"){const d=r*h,p=r*u,g=o*h,x=o*u;t[0]=l*h,t[4]=-l*u,t[8]=c,t[1]=p+g*c,t[5]=d-x*c,t[9]=-o*l,t[2]=x-d*c,t[6]=g+p*c,t[10]=r*l}else if(e.order==="YXZ"){const d=l*h,p=l*u,g=c*h,x=c*u;t[0]=d+x*o,t[4]=g*o-p,t[8]=r*c,t[1]=r*u,t[5]=r*h,t[9]=-o,t[2]=p*o-g,t[6]=x+d*o,t[10]=r*l}else if(e.order==="ZXY"){const d=l*h,p=l*u,g=c*h,x=c*u;t[0]=d-x*o,t[4]=-r*u,t[8]=g+p*o,t[1]=p+g*o,t[5]=r*h,t[9]=x-d*o,t[2]=-r*c,t[6]=o,t[10]=r*l}else if(e.order==="ZYX"){const d=r*h,p=r*u,g=o*h,x=o*u;t[0]=l*h,t[4]=g*c-p,t[8]=d*c+x,t[1]=l*u,t[5]=x*c+d,t[9]=p*c-g,t[2]=-c,t[6]=o*l,t[10]=r*l}else if(e.order==="YZX"){const d=r*l,p=r*c,g=o*l,x=o*c;t[0]=l*h,t[4]=x-d*u,t[8]=g*u+p,t[1]=u,t[5]=r*h,t[9]=-o*h,t[2]=-c*h,t[6]=p*u+g,t[10]=d-x*u}else if(e.order==="XZY"){const d=r*l,p=r*c,g=o*l,x=o*c;t[0]=l*h,t[4]=-u,t[8]=c*h,t[1]=d*u+x,t[5]=r*h,t[9]=p*u-g,t[2]=g*u-p,t[6]=o*h,t[10]=x*u+d}return t[3]=0,t[7]=0,t[11]=0,t[12]=0,t[13]=0,t[14]=0,t[15]=1,this}makeRotationFromQuaternion(e){return this.compose(Lh,e,Ih)}lookAt(e,t,n){const s=this.elements;return tn.subVectors(e,t),tn.lengthSq()===0&&(tn.z=1),tn.normalize(),$n.crossVectors(n,tn),$n.lengthSq()===0&&(Math.abs(n.z)===1?tn.x+=1e-4:tn.z+=1e-4,tn.normalize(),$n.crossVectors(n,tn)),$n.normalize(),Ts.crossVectors(tn,$n),s[0]=$n.x,s[4]=Ts.x,s[8]=tn.x,s[1]=$n.y,s[5]=Ts.y,s[9]=tn.y,s[2]=$n.z,s[6]=Ts.z,s[10]=tn.z,this}multiply(e){return this.multiplyMatrices(this,e)}premultiply(e){return this.multiplyMatrices(e,this)}multiplyMatrices(e,t){const n=e.elements,s=t.elements,a=this.elements,r=n[0],o=n[4],l=n[8],c=n[12],h=n[1],u=n[5],d=n[9],p=n[13],g=n[2],x=n[6],m=n[10],f=n[14],M=n[3],w=n[7],S=n[11],b=n[15],E=s[0],R=s[4],v=s[8],T=s[12],C=s[1],P=s[5],L=s[9],q=s[13],Z=s[2],N=s[6],X=s[10],G=s[14],j=s[3],se=s[7],pe=s[11],re=s[15];return a[0]=r*E+o*C+l*Z+c*j,a[4]=r*R+o*P+l*N+c*se,a[8]=r*v+o*L+l*X+c*pe,a[12]=r*T+o*q+l*G+c*re,a[1]=h*E+u*C+d*Z+p*j,a[5]=h*R+u*P+d*N+p*se,a[9]=h*v+u*L+d*X+p*pe,a[13]=h*T+u*q+d*G+p*re,a[2]=g*E+x*C+m*Z+f*j,a[6]=g*R+x*P+m*N+f*se,a[10]=g*v+x*L+m*X+f*pe,a[14]=g*T+x*q+m*G+f*re,a[3]=M*E+w*C+S*Z+b*j,a[7]=M*R+w*P+S*N+b*se,a[11]=M*v+w*L+S*X+b*pe,a[15]=M*T+w*q+S*G+b*re,this}multiplyScalar(e){const t=this.elements;return t[0]*=e,t[4]*=e,t[8]*=e,t[12]*=e,t[1]*=e,t[5]*=e,t[9]*=e,t[13]*=e,t[2]*=e,t[6]*=e,t[10]*=e,t[14]*=e,t[3]*=e,t[7]*=e,t[11]*=e,t[15]*=e,this}determinant(){const e=this.elements,t=e[0],n=e[4],s=e[8],a=e[12],r=e[1],o=e[5],l=e[9],c=e[13],h=e[2],u=e[6],d=e[10],p=e[14],g=e[3],x=e[7],m=e[11],f=e[15],M=l*p-c*d,w=o*p-c*u,S=o*d-l*u,b=r*p-c*h,E=r*d-l*h,R=r*u-o*h;return t*(x*M-m*w+f*S)-n*(g*M-m*b+f*E)+s*(g*w-x*b+f*R)-a*(g*S-x*E+m*R)}determinantAffine(){const e=this.elements,t=e[0],n=e[4],s=e[8],a=e[1],r=e[5],o=e[9],l=e[2],c=e[6],h=e[10];return t*(r*h-o*c)-n*(a*h-o*l)+s*(a*c-r*l)}transpose(){const e=this.elements;let t;return t=e[1],e[1]=e[4],e[4]=t,t=e[2],e[2]=e[8],e[8]=t,t=e[6],e[6]=e[9],e[9]=t,t=e[3],e[3]=e[12],e[12]=t,t=e[7],e[7]=e[13],e[13]=t,t=e[11],e[11]=e[14],e[14]=t,this}setPosition(e,t,n){const s=this.elements;return e.isVector3?(s[12]=e.x,s[13]=e.y,s[14]=e.z):(s[12]=e,s[13]=t,s[14]=n),this}invert(){const e=this.elements,t=e[0],n=e[1],s=e[2],a=e[3],r=e[4],o=e[5],l=e[6],c=e[7],h=e[8],u=e[9],d=e[10],p=e[11],g=e[12],x=e[13],m=e[14],f=e[15],M=t*o-n*r,w=t*l-s*r,S=t*c-a*r,b=n*l-s*o,E=n*c-a*o,R=s*c-a*l,v=h*x-u*g,T=h*m-d*g,C=h*f-p*g,P=u*m-d*x,L=u*f-p*x,q=d*f-p*m,Z=M*q-w*L+S*P+b*C-E*T+R*v;if(Z===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);const N=1/Z;return e[0]=(o*q-l*L+c*P)*N,e[1]=(s*L-n*q-a*P)*N,e[2]=(x*R-m*E+f*b)*N,e[3]=(d*E-u*R-p*b)*N,e[4]=(l*C-r*q-c*T)*N,e[5]=(t*q-s*C+a*T)*N,e[6]=(m*S-g*R-f*w)*N,e[7]=(h*R-d*S+p*w)*N,e[8]=(r*L-o*C+c*v)*N,e[9]=(n*C-t*L-a*v)*N,e[10]=(g*E-x*S+f*M)*N,e[11]=(u*S-h*E-p*M)*N,e[12]=(o*T-r*P-l*v)*N,e[13]=(t*P-n*T+s*v)*N,e[14]=(x*w-g*b-m*M)*N,e[15]=(h*b-u*w+d*M)*N,this}scale(e){const t=this.elements,n=e.x,s=e.y,a=e.z;return t[0]*=n,t[4]*=s,t[8]*=a,t[1]*=n,t[5]*=s,t[9]*=a,t[2]*=n,t[6]*=s,t[10]*=a,t[3]*=n,t[7]*=s,t[11]*=a,this}getMaxScaleOnAxis(){const e=this.elements,t=e[0]*e[0]+e[1]*e[1]+e[2]*e[2],n=e[4]*e[4]+e[5]*e[5]+e[6]*e[6],s=e[8]*e[8]+e[9]*e[9]+e[10]*e[10];return Math.sqrt(Math.max(t,n,s))}makeTranslation(e,t,n){return e.isVector3?this.set(1,0,0,e.x,0,1,0,e.y,0,0,1,e.z,0,0,0,1):this.set(1,0,0,e,0,1,0,t,0,0,1,n,0,0,0,1),this}makeRotationX(e){const t=Math.cos(e),n=Math.sin(e);return this.set(1,0,0,0,0,t,-n,0,0,n,t,0,0,0,0,1),this}makeRotationY(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,0,n,0,0,1,0,0,-n,0,t,0,0,0,0,1),this}makeRotationZ(e){const t=Math.cos(e),n=Math.sin(e);return this.set(t,-n,0,0,n,t,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis(e,t){const n=Math.cos(t),s=Math.sin(t),a=1-n,r=e.x,o=e.y,l=e.z,c=a*r,h=a*o;return this.set(c*r+n,c*o-s*l,c*l+s*o,0,c*o+s*l,h*o+n,h*l-s*r,0,c*l-s*o,h*l+s*r,a*l*l+n,0,0,0,0,1),this}makeScale(e,t,n){return this.set(e,0,0,0,0,t,0,0,0,0,n,0,0,0,0,1),this}makeShear(e,t,n,s,a,r){return this.set(1,n,a,0,e,1,r,0,t,s,1,0,0,0,0,1),this}compose(e,t,n){const s=this.elements,a=t._x,r=t._y,o=t._z,l=t._w,c=a+a,h=r+r,u=o+o,d=a*c,p=a*h,g=a*u,x=r*h,m=r*u,f=o*u,M=l*c,w=l*h,S=l*u,b=n.x,E=n.y,R=n.z;return s[0]=(1-(x+f))*b,s[1]=(p+S)*b,s[2]=(g-w)*b,s[3]=0,s[4]=(p-S)*E,s[5]=(1-(d+f))*E,s[6]=(m+M)*E,s[7]=0,s[8]=(g+w)*R,s[9]=(m-M)*R,s[10]=(1-(d+x))*R,s[11]=0,s[12]=e.x,s[13]=e.y,s[14]=e.z,s[15]=1,this}decompose(e,t,n){const s=this.elements;e.x=s[12],e.y=s[13],e.z=s[14];const a=this.determinantAffine();if(a===0)return n.set(1,1,1),t.identity(),this;let r=Li.set(s[0],s[1],s[2]).length();const o=Li.set(s[4],s[5],s[6]).length(),l=Li.set(s[8],s[9],s[10]).length();a<0&&(r=-r),fn.copy(this);const c=1/r,h=1/o,u=1/l;return fn.elements[0]*=c,fn.elements[1]*=c,fn.elements[2]*=c,fn.elements[4]*=h,fn.elements[5]*=h,fn.elements[6]*=h,fn.elements[8]*=u,fn.elements[9]*=u,fn.elements[10]*=u,t.setFromRotationMatrix(fn),n.x=r,n.y=o,n.z=l,this}makePerspective(e,t,n,s,a,r,o=Rn,l=!1){const c=this.elements,h=2*a/(t-e),u=2*a/(n-s),d=(t+e)/(t-e),p=(n+s)/(n-s);let g,x;if(l)g=a/(r-a),x=r*a/(r-a);else if(o===Rn)g=-(r+a)/(r-a),x=-2*r*a/(r-a);else if(o===ms)g=-r/(r-a),x=-r*a/(r-a);else throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=d,c[12]=0,c[1]=0,c[5]=u,c[9]=p,c[13]=0,c[2]=0,c[6]=0,c[10]=g,c[14]=x,c[3]=0,c[7]=0,c[11]=-1,c[15]=0,this}makeOrthographic(e,t,n,s,a,r,o=Rn,l=!1){const c=this.elements,h=2/(t-e),u=2/(n-s),d=-(t+e)/(t-e),p=-(n+s)/(n-s);let g,x;if(l)g=1/(r-a),x=r/(r-a);else if(o===Rn)g=-2/(r-a),x=-(r+a)/(r-a);else if(o===ms)g=-1/(r-a),x=-a/(r-a);else throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+o);return c[0]=h,c[4]=0,c[8]=0,c[12]=d,c[1]=0,c[5]=u,c[9]=0,c[13]=p,c[2]=0,c[6]=0,c[10]=g,c[14]=x,c[3]=0,c[7]=0,c[11]=0,c[15]=1,this}equals(e){const t=this.elements,n=e.elements;for(let s=0;s<16;s++)if(t[s]!==n[s])return!1;return!0}fromArray(e,t=0){for(let n=0;n<16;n++)this.elements[n]=e[n+t];return this}toArray(e=[],t=0){const n=this.elements;return e[t]=n[0],e[t+1]=n[1],e[t+2]=n[2],e[t+3]=n[3],e[t+4]=n[4],e[t+5]=n[5],e[t+6]=n[6],e[t+7]=n[7],e[t+8]=n[8],e[t+9]=n[9],e[t+10]=n[10],e[t+11]=n[11],e[t+12]=n[12],e[t+13]=n[13],e[t+14]=n[14],e[t+15]=n[15],e}}const Li=new I,fn=new pt,Lh=new I(0,0,0),Ih=new I(1,1,1),$n=new I,Ts=new I,tn=new I,Bo=new pt,Ho=new wi;class oi{constructor(e=0,t=0,n=0,s=oi.DEFAULT_ORDER){this.isEuler=!0,this._x=e,this._y=t,this._z=n,this._order=s}get x(){return this._x}set x(e){this._x=e,this._onChangeCallback()}get y(){return this._y}set y(e){this._y=e,this._onChangeCallback()}get z(){return this._z}set z(e){this._z=e,this._onChangeCallback()}get order(){return this._order}set order(e){this._order=e,this._onChangeCallback()}set(e,t,n,s=this._order){return this._x=e,this._y=t,this._z=n,this._order=s,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy(e){return this._x=e._x,this._y=e._y,this._z=e._z,this._order=e._order,this._onChangeCallback(),this}setFromRotationMatrix(e,t=this._order,n=!0){const s=e.elements,a=s[0],r=s[4],o=s[8],l=s[1],c=s[5],h=s[9],u=s[2],d=s[6],p=s[10];switch(t){case"XYZ":this._y=Math.asin($e(o,-1,1)),Math.abs(o)<.9999999?(this._x=Math.atan2(-h,p),this._z=Math.atan2(-r,a)):(this._x=Math.atan2(d,c),this._z=0);break;case"YXZ":this._x=Math.asin(-$e(h,-1,1)),Math.abs(h)<.9999999?(this._y=Math.atan2(o,p),this._z=Math.atan2(l,c)):(this._y=Math.atan2(-u,a),this._z=0);break;case"ZXY":this._x=Math.asin($e(d,-1,1)),Math.abs(d)<.9999999?(this._y=Math.atan2(-u,p),this._z=Math.atan2(-r,c)):(this._y=0,this._z=Math.atan2(l,a));break;case"ZYX":this._y=Math.asin(-$e(u,-1,1)),Math.abs(u)<.9999999?(this._x=Math.atan2(d,p),this._z=Math.atan2(l,a)):(this._x=0,this._z=Math.atan2(-r,c));break;case"YZX":this._z=Math.asin($e(l,-1,1)),Math.abs(l)<.9999999?(this._x=Math.atan2(-h,c),this._y=Math.atan2(-u,a)):(this._x=0,this._y=Math.atan2(o,p));break;case"XZY":this._z=Math.asin(-$e(r,-1,1)),Math.abs(r)<.9999999?(this._x=Math.atan2(d,c),this._y=Math.atan2(o,a)):(this._x=Math.atan2(-h,p),this._y=0);break;default:Fe("Euler: .setFromRotationMatrix() encountered an unknown order: "+t)}return this._order=t,n===!0&&this._onChangeCallback(),this}setFromQuaternion(e,t,n){return Bo.makeRotationFromQuaternion(e),this.setFromRotationMatrix(Bo,t,n)}setFromVector3(e,t=this._order){return this.set(e.x,e.y,e.z,t)}reorder(e){return Ho.setFromEuler(this),this.setFromQuaternion(Ho,e)}equals(e){return e._x===this._x&&e._y===this._y&&e._z===this._z&&e._order===this._order}fromArray(e){return this._x=e[0],this._y=e[1],this._z=e[2],e[3]!==void 0&&(this._order=e[3]),this._onChangeCallback(),this}toArray(e=[],t=0){return e[t]=this._x,e[t+1]=this._y,e[t+2]=this._z,e[t+3]=this._order,e}_onChange(e){return this._onChangeCallback=e,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}oi.DEFAULT_ORDER="XYZ";class nc{constructor(){this.mask=1}set(e){this.mask=(1<<e|0)>>>0}enable(e){this.mask|=1<<e|0}enableAll(){this.mask=-1}toggle(e){this.mask^=1<<e|0}disable(e){this.mask&=~(1<<e|0)}disableAll(){this.mask=0}test(e){return(this.mask&e.mask)!==0}isEnabled(e){return(this.mask&(1<<e|0))!==0}}let Dh=0;const Go=new I,Ii=new wi,In=new pt,ws=new I,ts=new I,Uh=new I,kh=new wi,Vo=new I(1,0,0),zo=new I(0,1,0),Wo=new I(0,0,1),qo={type:"added"},Nh={type:"removed"},Di={type:"childadded",child:null},Pa={type:"childremoved",child:null};class st extends Ti{constructor(){super(),this.isObject3D=!0,Object.defineProperty(this,"id",{value:Dh++}),this.uuid=_s(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=st.DEFAULT_UP.clone();const e=new I,t=new oi,n=new wi,s=new I(1,1,1);function a(){n.setFromEuler(t,!1)}function r(){t.setFromQuaternion(n,void 0,!1)}t._onChange(a),n._onChange(r),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:e},rotation:{configurable:!0,enumerable:!0,value:t},quaternion:{configurable:!0,enumerable:!0,value:n},scale:{configurable:!0,enumerable:!0,value:s},modelViewMatrix:{value:new pt},normalMatrix:{value:new Oe}}),this.matrix=new pt,this.matrixWorld=new pt,this.matrixAutoUpdate=st.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=st.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new nc,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.static=!1,this.userData={},this.pivot=null}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4(e){this.matrixAutoUpdate&&this.updateMatrix(),this.matrix.premultiply(e),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion(e){return this.quaternion.premultiply(e),this}setRotationFromAxisAngle(e,t){this.quaternion.setFromAxisAngle(e,t)}setRotationFromEuler(e){this.quaternion.setFromEuler(e,!0)}setRotationFromMatrix(e){this.quaternion.setFromRotationMatrix(e)}setRotationFromQuaternion(e){this.quaternion.copy(e)}rotateOnAxis(e,t){return Ii.setFromAxisAngle(e,t),this.quaternion.multiply(Ii),this}rotateOnWorldAxis(e,t){return Ii.setFromAxisAngle(e,t),this.quaternion.premultiply(Ii),this}rotateX(e){return this.rotateOnAxis(Vo,e)}rotateY(e){return this.rotateOnAxis(zo,e)}rotateZ(e){return this.rotateOnAxis(Wo,e)}translateOnAxis(e,t){return Go.copy(e).applyQuaternion(this.quaternion),this.position.add(Go.multiplyScalar(t)),this}translateX(e){return this.translateOnAxis(Vo,e)}translateY(e){return this.translateOnAxis(zo,e)}translateZ(e){return this.translateOnAxis(Wo,e)}localToWorld(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(this.matrixWorld)}worldToLocal(e){return this.updateWorldMatrix(!0,!1),e.applyMatrix4(In.copy(this.matrixWorld).invert())}lookAt(e,t,n){e.isVector3?ws.copy(e):ws.set(e,t,n);const s=this.parent;this.updateWorldMatrix(!0,!1),ts.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight?In.lookAt(ts,ws,this.up):In.lookAt(ws,ts,this.up),this.quaternion.setFromRotationMatrix(In),s&&(In.extractRotation(s.matrixWorld),Ii.setFromRotationMatrix(In),this.quaternion.premultiply(Ii.invert()))}add(e){if(arguments.length>1){for(let t=0;t<arguments.length;t++)this.add(arguments[t]);return this}return e===this?(et("Object3D.add: object can't be added as a child of itself.",e),this):(e&&e.isObject3D?(e.removeFromParent(),e.parent=this,this.children.push(e),e.dispatchEvent(qo),Di.child=e,this.dispatchEvent(Di),Di.child=null):et("Object3D.add: object not an instance of THREE.Object3D.",e),this)}remove(e){if(arguments.length>1){for(let n=0;n<arguments.length;n++)this.remove(arguments[n]);return this}const t=this.children.indexOf(e);return t!==-1&&(e.parent=null,this.children.splice(t,1),e.dispatchEvent(Nh),Pa.child=e,this.dispatchEvent(Pa),Pa.child=null),this}removeFromParent(){const e=this.parent;return e!==null&&e.remove(this),this}clear(){return this.remove(...this.children)}attach(e){return this.updateWorldMatrix(!0,!1),In.copy(this.matrixWorld).invert(),e.parent!==null&&(e.parent.updateWorldMatrix(!0,!1),In.multiply(e.parent.matrixWorld)),e.applyMatrix4(In),e.removeFromParent(),e.parent=this,this.children.push(e),e.updateWorldMatrix(!1,!0),e.dispatchEvent(qo),Di.child=e,this.dispatchEvent(Di),Di.child=null,this}getObjectById(e){return this.getObjectByProperty("id",e)}getObjectByName(e){return this.getObjectByProperty("name",e)}getObjectByProperty(e,t){if(this[e]===t)return this;for(let n=0,s=this.children.length;n<s;n++){const r=this.children[n].getObjectByProperty(e,t);if(r!==void 0)return r}}getObjectsByProperty(e,t,n=[]){this[e]===t&&n.push(this);const s=this.children;for(let a=0,r=s.length;a<r;a++)s[a].getObjectsByProperty(e,t,n);return n}getWorldPosition(e){return this.updateWorldMatrix(!0,!1),e.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ts,e,Uh),e}getWorldScale(e){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(ts,kh,e),e}getWorldDirection(e){this.updateWorldMatrix(!0,!1);const t=this.matrixWorld.elements;return e.set(t[8],t[9],t[10]).normalize()}raycast(){}traverse(e){e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverse(e)}traverseVisible(e){if(this.visible===!1)return;e(this);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].traverseVisible(e)}traverseAncestors(e){const t=this.parent;t!==null&&(e(t),t.traverseAncestors(e))}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale);const e=this.pivot;if(e!==null){const t=e.x,n=e.y,s=e.z,a=this.matrix.elements;a[12]+=t-a[0]*t-a[4]*n-a[8]*s,a[13]+=n-a[1]*t-a[5]*n-a[9]*s,a[14]+=s-a[2]*t-a[6]*n-a[10]*s}this.matrixWorldNeedsUpdate=!0}updateMatrixWorld(e){this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||e)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,e=!0);const t=this.children;for(let n=0,s=t.length;n<s;n++)t[n].updateMatrixWorld(e)}updateWorldMatrix(e,t,n=!1){const s=this.parent;if(e===!0&&s!==null&&s.updateWorldMatrix(!0,!1),this.matrixAutoUpdate&&this.updateMatrix(),(this.matrixWorldNeedsUpdate||n)&&(this.matrixWorldAutoUpdate===!0&&(this.parent===null?this.matrixWorld.copy(this.matrix):this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix)),this.matrixWorldNeedsUpdate=!1,n=!0),t===!0){const a=this.children;for(let r=0,o=a.length;r<o;r++)a[r].updateWorldMatrix(!1,!0,n)}}toJSON(e){const t=e===void 0||typeof e=="string",n={};t&&(e={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},n.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"});const s={};s.uuid=this.uuid,s.type=this.type,this.name!==""&&(s.name=this.name),this.castShadow===!0&&(s.castShadow=!0),this.receiveShadow===!0&&(s.receiveShadow=!0),this.visible===!1&&(s.visible=!1),this.frustumCulled===!1&&(s.frustumCulled=!1),this.renderOrder!==0&&(s.renderOrder=this.renderOrder),this.static!==!1&&(s.static=this.static),Object.keys(this.userData).length>0&&(s.userData=this.userData),s.layers=this.layers.mask,s.matrix=this.matrix.toArray(),s.up=this.up.toArray(),this.pivot!==null&&(s.pivot=this.pivot.toArray()),this.matrixAutoUpdate===!1&&(s.matrixAutoUpdate=!1),this.morphTargetDictionary!==void 0&&(s.morphTargetDictionary=Object.assign({},this.morphTargetDictionary)),this.morphTargetInfluences!==void 0&&(s.morphTargetInfluences=this.morphTargetInfluences.slice()),this.isInstancedMesh&&(s.type="InstancedMesh",s.count=this.count,s.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null&&(s.instanceColor=this.instanceColor.toJSON())),this.isBatchedMesh&&(s.type="BatchedMesh",s.perObjectFrustumCulled=this.perObjectFrustumCulled,s.sortObjects=this.sortObjects,s.drawRanges=this._drawRanges,s.reservedRanges=this._reservedRanges,s.geometryInfo=this._geometryInfo.map(o=>({...o,boundingBox:o.boundingBox?o.boundingBox.toJSON():void 0,boundingSphere:o.boundingSphere?o.boundingSphere.toJSON():void 0})),s.instanceInfo=this._instanceInfo.map(o=>({...o})),s.availableInstanceIds=this._availableInstanceIds.slice(),s.availableGeometryIds=this._availableGeometryIds.slice(),s.nextIndexStart=this._nextIndexStart,s.nextVertexStart=this._nextVertexStart,s.geometryCount=this._geometryCount,s.maxInstanceCount=this._maxInstanceCount,s.maxVertexCount=this._maxVertexCount,s.maxIndexCount=this._maxIndexCount,s.geometryInitialized=this._geometryInitialized,s.matricesTexture=this._matricesTexture.toJSON(e),s.indirectTexture=this._indirectTexture.toJSON(e),this._colorsTexture!==null&&(s.colorsTexture=this._colorsTexture.toJSON(e)),this.boundingSphere!==null&&(s.boundingSphere=this.boundingSphere.toJSON()),this.boundingBox!==null&&(s.boundingBox=this.boundingBox.toJSON()));function a(o,l){return o[l.uuid]===void 0&&(o[l.uuid]=l.toJSON(e)),l.uuid}if(this.isScene)this.background&&(this.background.isColor?s.background=this.background.toJSON():this.background.isTexture&&(s.background=this.background.toJSON(e).uuid)),this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0&&(s.environment=this.environment.toJSON(e).uuid);else if(this.isMesh||this.isLine||this.isPoints){s.geometry=a(e.geometries,this.geometry);const o=this.geometry.parameters;if(o!==void 0&&o.shapes!==void 0){const l=o.shapes;if(Array.isArray(l))for(let c=0,h=l.length;c<h;c++){const u=l[c];a(e.shapes,u)}else a(e.shapes,l)}}if(this.isSkinnedMesh&&(s.bindMode=this.bindMode,s.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0&&(a(e.skeletons,this.skeleton),s.skeleton=this.skeleton.uuid)),this.material!==void 0)if(Array.isArray(this.material)){const o=[];for(let l=0,c=this.material.length;l<c;l++)o.push(a(e.materials,this.material[l]));s.material=o}else s.material=a(e.materials,this.material);if(this.children.length>0){s.children=[];for(let o=0;o<this.children.length;o++)s.children.push(this.children[o].toJSON(e).object)}if(this.animations.length>0){s.animations=[];for(let o=0;o<this.animations.length;o++){const l=this.animations[o];s.animations.push(a(e.animations,l))}}if(t){const o=r(e.geometries),l=r(e.materials),c=r(e.textures),h=r(e.images),u=r(e.shapes),d=r(e.skeletons),p=r(e.animations),g=r(e.nodes);o.length>0&&(n.geometries=o),l.length>0&&(n.materials=l),c.length>0&&(n.textures=c),h.length>0&&(n.images=h),u.length>0&&(n.shapes=u),d.length>0&&(n.skeletons=d),p.length>0&&(n.animations=p),g.length>0&&(n.nodes=g)}return n.object=s,n;function r(o){const l=[];for(const c in o){const h=o[c];delete h.metadata,l.push(h)}return l}}clone(e){return new this.constructor().copy(this,e)}copy(e,t=!0){if(this.name=e.name,this.up.copy(e.up),this.position.copy(e.position),this.rotation.order=e.rotation.order,this.quaternion.copy(e.quaternion),this.scale.copy(e.scale),this.pivot=e.pivot!==null?e.pivot.clone():null,this.matrix.copy(e.matrix),this.matrixWorld.copy(e.matrixWorld),this.matrixAutoUpdate=e.matrixAutoUpdate,this.matrixWorldAutoUpdate=e.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=e.matrixWorldNeedsUpdate,this.layers.mask=e.layers.mask,this.visible=e.visible,this.castShadow=e.castShadow,this.receiveShadow=e.receiveShadow,this.frustumCulled=e.frustumCulled,this.renderOrder=e.renderOrder,this.static=e.static,this.animations=e.animations.slice(),this.userData=JSON.parse(JSON.stringify(e.userData)),t===!0)for(let n=0;n<e.children.length;n++){const s=e.children[n];this.add(s.clone())}return this}}st.DEFAULT_UP=new I(0,1,0);st.DEFAULT_MATRIX_AUTO_UPDATE=!0;st.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;class Gn extends st{constructor(){super(),this.isGroup=!0,this.type="Group"}}const Fh={type:"move"};class La{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){return this._hand===null&&(this._hand=new Gn,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1}),this._hand}getTargetRaySpace(){return this._targetRay===null&&(this._targetRay=new Gn,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new I,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new I),this._targetRay}getGripSpace(){return this._grip===null&&(this._grip=new Gn,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new I,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new I,this._grip.eventsEnabled=!1),this._grip}dispatchEvent(e){return this._targetRay!==null&&this._targetRay.dispatchEvent(e),this._grip!==null&&this._grip.dispatchEvent(e),this._hand!==null&&this._hand.dispatchEvent(e),this}connect(e){if(e&&e.hand){const t=this._hand;if(t)for(const n of e.hand.values())this._getHandJoint(t,n)}return this.dispatchEvent({type:"connected",data:e}),this}disconnect(e){return this.dispatchEvent({type:"disconnected",data:e}),this._targetRay!==null&&(this._targetRay.visible=!1),this._grip!==null&&(this._grip.visible=!1),this._hand!==null&&(this._hand.visible=!1),this}update(e,t,n){let s=null,a=null,r=null;const o=this._targetRay,l=this._grip,c=this._hand;if(e&&t.session.visibilityState!=="visible-blurred"){if(c&&e.hand){r=!0;for(const x of e.hand.values()){const m=t.getJointPose(x,n),f=this._getHandJoint(c,x);m!==null&&(f.matrix.fromArray(m.transform.matrix),f.matrix.decompose(f.position,f.rotation,f.scale),f.matrixWorldNeedsUpdate=!0,f.jointRadius=m.radius),f.visible=m!==null}const h=c.joints["index-finger-tip"],u=c.joints["thumb-tip"],d=h.position.distanceTo(u.position),p=.02,g=.005;c.inputState.pinching&&d>p+g?(c.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:e.handedness,target:this})):!c.inputState.pinching&&d<=p-g&&(c.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:e.handedness,target:this}))}else l!==null&&e.gripSpace&&(a=t.getPose(e.gripSpace,n),a!==null&&(l.matrix.fromArray(a.transform.matrix),l.matrix.decompose(l.position,l.rotation,l.scale),l.matrixWorldNeedsUpdate=!0,a.linearVelocity?(l.hasLinearVelocity=!0,l.linearVelocity.copy(a.linearVelocity)):l.hasLinearVelocity=!1,a.angularVelocity?(l.hasAngularVelocity=!0,l.angularVelocity.copy(a.angularVelocity)):l.hasAngularVelocity=!1,l.eventsEnabled&&l.dispatchEvent({type:"gripUpdated",data:e,target:this})));o!==null&&(s=t.getPose(e.targetRaySpace,n),s===null&&a!==null&&(s=a),s!==null&&(o.matrix.fromArray(s.transform.matrix),o.matrix.decompose(o.position,o.rotation,o.scale),o.matrixWorldNeedsUpdate=!0,s.linearVelocity?(o.hasLinearVelocity=!0,o.linearVelocity.copy(s.linearVelocity)):o.hasLinearVelocity=!1,s.angularVelocity?(o.hasAngularVelocity=!0,o.angularVelocity.copy(s.angularVelocity)):o.hasAngularVelocity=!1,this.dispatchEvent(Fh)))}return o!==null&&(o.visible=s!==null),l!==null&&(l.visible=a!==null),c!==null&&(c.visible=r!==null),this}_getHandJoint(e,t){if(e.joints[t.jointName]===void 0){const n=new Gn;n.matrixAutoUpdate=!1,n.visible=!1,e.joints[t.jointName]=n,e.add(n)}return e.joints[t.jointName]}}const ic={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},Qn={h:0,s:0,l:0},As={h:0,s:0,l:0};function Ia(i,e,t){return t<0&&(t+=1),t>1&&(t-=1),t<1/6?i+(e-i)*6*t:t<1/2?e:t<2/3?i+(e-i)*6*(2/3-t):i}class Le{constructor(e,t,n){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set(e,t,n)}set(e,t,n){if(t===void 0&&n===void 0){const s=e;s&&s.isColor?this.copy(s):typeof s=="number"?this.setHex(s):typeof s=="string"&&this.setStyle(s)}else this.setRGB(e,t,n);return this}setScalar(e){return this.r=e,this.g=e,this.b=e,this}setHex(e,t=an){return e=Math.floor(e),this.r=(e>>16&255)/255,this.g=(e>>8&255)/255,this.b=(e&255)/255,Je.colorSpaceToWorking(this,t),this}setRGB(e,t,n,s=Je.workingColorSpace){return this.r=e,this.g=t,this.b=n,Je.colorSpaceToWorking(this,s),this}setHSL(e,t,n,s=Je.workingColorSpace){if(e=Eh(e,1),t=$e(t,0,1),n=$e(n,0,1),t===0)this.r=this.g=this.b=n;else{const a=n<=.5?n*(1+t):n+t-n*t,r=2*n-a;this.r=Ia(r,a,e+1/3),this.g=Ia(r,a,e),this.b=Ia(r,a,e-1/3)}return Je.colorSpaceToWorking(this,s),this}setStyle(e,t=an){function n(a){a!==void 0&&parseFloat(a)<1&&Fe("Color: Alpha component of "+e+" will be ignored.")}let s;if(s=/^(\w+)\(([^\)]*)\)/.exec(e)){let a;const r=s[1],o=s[2];switch(r){case"rgb":case"rgba":if(a=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(a[4]),this.setRGB(Math.min(255,parseInt(a[1],10))/255,Math.min(255,parseInt(a[2],10))/255,Math.min(255,parseInt(a[3],10))/255,t);if(a=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(a[4]),this.setRGB(Math.min(100,parseInt(a[1],10))/100,Math.min(100,parseInt(a[2],10))/100,Math.min(100,parseInt(a[3],10))/100,t);break;case"hsl":case"hsla":if(a=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(o))return n(a[4]),this.setHSL(parseFloat(a[1])/360,parseFloat(a[2])/100,parseFloat(a[3])/100,t);break;default:Fe("Color: Unknown color model "+e)}}else if(s=/^\#([A-Fa-f\d]+)$/.exec(e)){const a=s[1],r=a.length;if(r===3)return this.setRGB(parseInt(a.charAt(0),16)/15,parseInt(a.charAt(1),16)/15,parseInt(a.charAt(2),16)/15,t);if(r===6)return this.setHex(parseInt(a,16),t);Fe("Color: Invalid hex color "+e)}else if(e&&e.length>0)return this.setColorName(e,t);return this}setColorName(e,t=an){const n=ic[e.toLowerCase()];return n!==void 0?this.setHex(n,t):Fe("Color: Unknown color "+e),this}clone(){return new this.constructor(this.r,this.g,this.b)}copy(e){return this.r=e.r,this.g=e.g,this.b=e.b,this}copySRGBToLinear(e){return this.r=zn(e.r),this.g=zn(e.g),this.b=zn(e.b),this}copyLinearToSRGB(e){return this.r=Wi(e.r),this.g=Wi(e.g),this.b=Wi(e.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex(e=an){return Je.workingToColorSpace(Ot.copy(this),e),Math.round($e(Ot.r*255,0,255))*65536+Math.round($e(Ot.g*255,0,255))*256+Math.round($e(Ot.b*255,0,255))}getHexString(e=an){return("000000"+this.getHex(e).toString(16)).slice(-6)}getHSL(e,t=Je.workingColorSpace){Je.workingToColorSpace(Ot.copy(this),t);const n=Ot.r,s=Ot.g,a=Ot.b,r=Math.max(n,s,a),o=Math.min(n,s,a);let l,c;const h=(o+r)/2;if(o===r)l=0,c=0;else{const u=r-o;switch(c=h<=.5?u/(r+o):u/(2-r-o),r){case n:l=(s-a)/u+(s<a?6:0);break;case s:l=(a-n)/u+2;break;case a:l=(n-s)/u+4;break}l/=6}return e.h=l,e.s=c,e.l=h,e}getRGB(e,t=Je.workingColorSpace){return Je.workingToColorSpace(Ot.copy(this),t),e.r=Ot.r,e.g=Ot.g,e.b=Ot.b,e}getStyle(e=an){Je.workingToColorSpace(Ot.copy(this),e);const t=Ot.r,n=Ot.g,s=Ot.b;return e!==an?`color(${e} ${t.toFixed(3)} ${n.toFixed(3)} ${s.toFixed(3)})`:`rgb(${Math.round(t*255)},${Math.round(n*255)},${Math.round(s*255)})`}offsetHSL(e,t,n){return this.getHSL(Qn),this.setHSL(Qn.h+e,Qn.s+t,Qn.l+n)}add(e){return this.r+=e.r,this.g+=e.g,this.b+=e.b,this}addColors(e,t){return this.r=e.r+t.r,this.g=e.g+t.g,this.b=e.b+t.b,this}addScalar(e){return this.r+=e,this.g+=e,this.b+=e,this}sub(e){return this.r=Math.max(0,this.r-e.r),this.g=Math.max(0,this.g-e.g),this.b=Math.max(0,this.b-e.b),this}multiply(e){return this.r*=e.r,this.g*=e.g,this.b*=e.b,this}multiplyScalar(e){return this.r*=e,this.g*=e,this.b*=e,this}lerp(e,t){return this.r+=(e.r-this.r)*t,this.g+=(e.g-this.g)*t,this.b+=(e.b-this.b)*t,this}lerpColors(e,t,n){return this.r=e.r+(t.r-e.r)*n,this.g=e.g+(t.g-e.g)*n,this.b=e.b+(t.b-e.b)*n,this}lerpHSL(e,t){this.getHSL(Qn),e.getHSL(As);const n=Ta(Qn.h,As.h,t),s=Ta(Qn.s,As.s,t),a=Ta(Qn.l,As.l,t);return this.setHSL(n,s,a),this}setFromVector3(e){return this.r=e.x,this.g=e.y,this.b=e.z,this}applyMatrix3(e){const t=this.r,n=this.g,s=this.b,a=e.elements;return this.r=a[0]*t+a[3]*n+a[6]*s,this.g=a[1]*t+a[4]*n+a[7]*s,this.b=a[2]*t+a[5]*n+a[8]*s,this}equals(e){return e.r===this.r&&e.g===this.g&&e.b===this.b}fromArray(e,t=0){return this.r=e[t],this.g=e[t+1],this.b=e[t+2],this}toArray(e=[],t=0){return e[t]=this.r,e[t+1]=this.g,e[t+2]=this.b,e}fromBufferAttribute(e,t){return this.r=e.getX(t),this.g=e.getY(t),this.b=e.getZ(t),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}const Ot=new Le;Le.NAMES=ic;class mo{constructor(e,t=25e-5){this.isFogExp2=!0,this.name="",this.color=new Le(e),this.density=t}clone(){return new mo(this.color,this.density)}toJSON(){return{type:"FogExp2",name:this.name,color:this.color.getHex(),density:this.density}}}class Oh extends st{constructor(){super(),this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new oi,this.environmentIntensity=1,this.environmentRotation=new oi,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy(e,t){return super.copy(e,t),e.background!==null&&(this.background=e.background.clone()),e.environment!==null&&(this.environment=e.environment.clone()),e.fog!==null&&(this.fog=e.fog.clone()),this.backgroundBlurriness=e.backgroundBlurriness,this.backgroundIntensity=e.backgroundIntensity,this.backgroundRotation.copy(e.backgroundRotation),this.environmentIntensity=e.environmentIntensity,this.environmentRotation.copy(e.environmentRotation),e.overrideMaterial!==null&&(this.overrideMaterial=e.overrideMaterial.clone()),this.matrixAutoUpdate=e.matrixAutoUpdate,this}toJSON(e){const t=super.toJSON(e);return this.fog!==null&&(t.object.fog=this.fog.toJSON()),this.backgroundBlurriness>0&&(t.object.backgroundBlurriness=this.backgroundBlurriness),this.backgroundIntensity!==1&&(t.object.backgroundIntensity=this.backgroundIntensity),t.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1&&(t.object.environmentIntensity=this.environmentIntensity),t.object.environmentRotation=this.environmentRotation.toArray(),t}}const pn=new I,Dn=new I,Da=new I,Un=new I,Ui=new I,ki=new I,Xo=new I,Ua=new I,ka=new I,Na=new I,Fa=new xt,Oa=new xt,Ba=new xt;class gn{constructor(e=new I,t=new I,n=new I){this.a=e,this.b=t,this.c=n}static getNormal(e,t,n,s){s.subVectors(n,t),pn.subVectors(e,t),s.cross(pn);const a=s.lengthSq();return a>0?s.multiplyScalar(1/Math.sqrt(a)):s.set(0,0,0)}static getBarycoord(e,t,n,s,a){pn.subVectors(s,t),Dn.subVectors(n,t),Da.subVectors(e,t);const r=pn.dot(pn),o=pn.dot(Dn),l=pn.dot(Da),c=Dn.dot(Dn),h=Dn.dot(Da),u=r*c-o*o;if(u===0)return a.set(0,0,0),null;const d=1/u,p=(c*l-o*h)*d,g=(r*h-o*l)*d;return a.set(1-p-g,g,p)}static containsPoint(e,t,n,s){return this.getBarycoord(e,t,n,s,Un)===null?!1:Un.x>=0&&Un.y>=0&&Un.x+Un.y<=1}static getInterpolation(e,t,n,s,a,r,o,l){return this.getBarycoord(e,t,n,s,Un)===null?(l.x=0,l.y=0,"z"in l&&(l.z=0),"w"in l&&(l.w=0),null):(l.setScalar(0),l.addScaledVector(a,Un.x),l.addScaledVector(r,Un.y),l.addScaledVector(o,Un.z),l)}static getInterpolatedAttribute(e,t,n,s,a,r){return Fa.setScalar(0),Oa.setScalar(0),Ba.setScalar(0),Fa.fromBufferAttribute(e,t),Oa.fromBufferAttribute(e,n),Ba.fromBufferAttribute(e,s),r.setScalar(0),r.addScaledVector(Fa,a.x),r.addScaledVector(Oa,a.y),r.addScaledVector(Ba,a.z),r}static isFrontFacing(e,t,n,s){return pn.subVectors(n,t),Dn.subVectors(e,t),pn.cross(Dn).dot(s)<0}set(e,t,n){return this.a.copy(e),this.b.copy(t),this.c.copy(n),this}setFromPointsAndIndices(e,t,n,s){return this.a.copy(e[t]),this.b.copy(e[n]),this.c.copy(e[s]),this}setFromAttributeAndIndices(e,t,n,s){return this.a.fromBufferAttribute(e,t),this.b.fromBufferAttribute(e,n),this.c.fromBufferAttribute(e,s),this}clone(){return new this.constructor().copy(this)}copy(e){return this.a.copy(e.a),this.b.copy(e.b),this.c.copy(e.c),this}getArea(){return pn.subVectors(this.c,this.b),Dn.subVectors(this.a,this.b),pn.cross(Dn).length()*.5}getMidpoint(e){return e.addVectors(this.a,this.b).add(this.c).multiplyScalar(1/3)}getNormal(e){return gn.getNormal(this.a,this.b,this.c,e)}getPlane(e){return e.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord(e,t){return gn.getBarycoord(e,this.a,this.b,this.c,t)}getInterpolation(e,t,n,s,a){return gn.getInterpolation(e,this.a,this.b,this.c,t,n,s,a)}containsPoint(e){return gn.containsPoint(e,this.a,this.b,this.c)}isFrontFacing(e){return gn.isFrontFacing(this.a,this.b,this.c,e)}intersectsBox(e){return e.intersectsTriangle(this)}closestPointToPoint(e,t){const n=this.a,s=this.b,a=this.c;let r,o;Ui.subVectors(s,n),ki.subVectors(a,n),Ua.subVectors(e,n);const l=Ui.dot(Ua),c=ki.dot(Ua);if(l<=0&&c<=0)return t.copy(n);ka.subVectors(e,s);const h=Ui.dot(ka),u=ki.dot(ka);if(h>=0&&u<=h)return t.copy(s);const d=l*u-h*c;if(d<=0&&l>=0&&h<=0)return r=l/(l-h),t.copy(n).addScaledVector(Ui,r);Na.subVectors(e,a);const p=Ui.dot(Na),g=ki.dot(Na);if(g>=0&&p<=g)return t.copy(a);const x=p*c-l*g;if(x<=0&&c>=0&&g<=0)return o=c/(c-g),t.copy(n).addScaledVector(ki,o);const m=h*g-p*u;if(m<=0&&u-h>=0&&p-g>=0)return Xo.subVectors(a,s),o=(u-h)/(u-h+(p-g)),t.copy(s).addScaledVector(Xo,o);const f=1/(m+x+d);return r=x*f,o=d*f,t.copy(n).addScaledVector(Ui,r).addScaledVector(ki,o)}equals(e){return e.a.equals(this.a)&&e.b.equals(this.b)&&e.c.equals(this.c)}}class vs{constructor(e=new I(1/0,1/0,1/0),t=new I(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=e,this.max=t}set(e,t){return this.min.copy(e),this.max.copy(t),this}setFromArray(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t+=3)this.expandByPoint(mn.fromArray(e,t));return this}setFromBufferAttribute(e){this.makeEmpty();for(let t=0,n=e.count;t<n;t++)this.expandByPoint(mn.fromBufferAttribute(e,t));return this}setFromPoints(e){this.makeEmpty();for(let t=0,n=e.length;t<n;t++)this.expandByPoint(e[t]);return this}setFromCenterAndSize(e,t){const n=mn.copy(t).multiplyScalar(.5);return this.min.copy(e).sub(n),this.max.copy(e).add(n),this}setFromObject(e,t=!1){return this.makeEmpty(),this.expandByObject(e,t)}clone(){return new this.constructor().copy(this)}copy(e){return this.min.copy(e.min),this.max.copy(e.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter(e){return this.isEmpty()?e.set(0,0,0):e.addVectors(this.min,this.max).multiplyScalar(.5)}getSize(e){return this.isEmpty()?e.set(0,0,0):e.subVectors(this.max,this.min)}expandByPoint(e){return this.min.min(e),this.max.max(e),this}expandByVector(e){return this.min.sub(e),this.max.add(e),this}expandByScalar(e){return this.min.addScalar(-e),this.max.addScalar(e),this}expandByObject(e,t=!1){e.updateWorldMatrix(!1,!1);const n=e.geometry;if(n!==void 0){const a=n.getAttribute("position");if(t===!0&&a!==void 0&&e.isInstancedMesh!==!0)for(let r=0,o=a.count;r<o;r++)e.isMesh===!0?e.getVertexPosition(r,mn):mn.fromBufferAttribute(a,r),mn.applyMatrix4(e.matrixWorld),this.expandByPoint(mn);else e.boundingBox!==void 0?(e.boundingBox===null&&e.computeBoundingBox(),Rs.copy(e.boundingBox)):(n.boundingBox===null&&n.computeBoundingBox(),Rs.copy(n.boundingBox)),Rs.applyMatrix4(e.matrixWorld),this.union(Rs)}const s=e.children;for(let a=0,r=s.length;a<r;a++)this.expandByObject(s[a],t);return this}containsPoint(e){return e.x>=this.min.x&&e.x<=this.max.x&&e.y>=this.min.y&&e.y<=this.max.y&&e.z>=this.min.z&&e.z<=this.max.z}containsBox(e){return this.min.x<=e.min.x&&e.max.x<=this.max.x&&this.min.y<=e.min.y&&e.max.y<=this.max.y&&this.min.z<=e.min.z&&e.max.z<=this.max.z}getParameter(e,t){return t.set((e.x-this.min.x)/(this.max.x-this.min.x),(e.y-this.min.y)/(this.max.y-this.min.y),(e.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox(e){return e.max.x>=this.min.x&&e.min.x<=this.max.x&&e.max.y>=this.min.y&&e.min.y<=this.max.y&&e.max.z>=this.min.z&&e.min.z<=this.max.z}intersectsSphere(e){return this.clampPoint(e.center,mn),mn.distanceToSquared(e.center)<=e.radius*e.radius}intersectsPlane(e){let t,n;return e.normal.x>0?(t=e.normal.x*this.min.x,n=e.normal.x*this.max.x):(t=e.normal.x*this.max.x,n=e.normal.x*this.min.x),e.normal.y>0?(t+=e.normal.y*this.min.y,n+=e.normal.y*this.max.y):(t+=e.normal.y*this.max.y,n+=e.normal.y*this.min.y),e.normal.z>0?(t+=e.normal.z*this.min.z,n+=e.normal.z*this.max.z):(t+=e.normal.z*this.max.z,n+=e.normal.z*this.min.z),t<=-e.constant&&n>=-e.constant}intersectsTriangle(e){if(this.isEmpty())return!1;this.getCenter(ns),Cs.subVectors(this.max,ns),Ni.subVectors(e.a,ns),Fi.subVectors(e.b,ns),Oi.subVectors(e.c,ns),jn.subVectors(Fi,Ni),ei.subVectors(Oi,Fi),hi.subVectors(Ni,Oi);let t=[0,-jn.z,jn.y,0,-ei.z,ei.y,0,-hi.z,hi.y,jn.z,0,-jn.x,ei.z,0,-ei.x,hi.z,0,-hi.x,-jn.y,jn.x,0,-ei.y,ei.x,0,-hi.y,hi.x,0];return!Ha(t,Ni,Fi,Oi,Cs)||(t=[1,0,0,0,1,0,0,0,1],!Ha(t,Ni,Fi,Oi,Cs))?!1:(Ps.crossVectors(jn,ei),t=[Ps.x,Ps.y,Ps.z],Ha(t,Ni,Fi,Oi,Cs))}clampPoint(e,t){return t.copy(e).clamp(this.min,this.max)}distanceToPoint(e){return this.clampPoint(e,mn).distanceTo(e)}getBoundingSphere(e){return this.isEmpty()?e.makeEmpty():(this.getCenter(e.center),e.radius=this.getSize(mn).length()*.5),e}intersect(e){return this.min.max(e.min),this.max.min(e.max),this.isEmpty()&&this.makeEmpty(),this}union(e){return this.min.min(e.min),this.max.max(e.max),this}applyMatrix4(e){return this.isEmpty()?this:(kn[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4(e),kn[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4(e),kn[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4(e),kn[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4(e),kn[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4(e),kn[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4(e),kn[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4(e),kn[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4(e),this.setFromPoints(kn),this)}translate(e){return this.min.add(e),this.max.add(e),this}equals(e){return e.min.equals(this.min)&&e.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON(e){return this.min.fromArray(e.min),this.max.fromArray(e.max),this}}const kn=[new I,new I,new I,new I,new I,new I,new I,new I],mn=new I,Rs=new vs,Ni=new I,Fi=new I,Oi=new I,jn=new I,ei=new I,hi=new I,ns=new I,Cs=new I,Ps=new I,di=new I;function Ha(i,e,t,n,s){for(let a=0,r=i.length-3;a<=r;a+=3){di.fromArray(i,a);const o=s.x*Math.abs(di.x)+s.y*Math.abs(di.y)+s.z*Math.abs(di.z),l=e.dot(di),c=t.dot(di),h=n.dot(di);if(Math.max(-Math.max(l,c,h),Math.min(l,c,h))>o)return!1}return!0}const wt=new I,Ls=new ze;let Bh=0;class Dt extends Ti{constructor(e,t,n=!1){if(super(),Array.isArray(e))throw new TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:Bh++}),this.name="",this.array=e,this.itemSize=t,this.count=e!==void 0?e.length/t:0,this.normalized=n,this.usage=Io,this.updateRanges=[],this.gpuType=An,this.version=0}onUploadCallback(){}set needsUpdate(e){e===!0&&this.version++}setUsage(e){return this.usage=e,this}addUpdateRange(e,t){this.updateRanges.push({start:e,count:t})}clearUpdateRanges(){this.updateRanges.length=0}copy(e){return this.name=e.name,this.array=new e.array.constructor(e.array),this.itemSize=e.itemSize,this.count=e.count,this.normalized=e.normalized,this.usage=e.usage,this.gpuType=e.gpuType,this}copyAt(e,t,n){e*=this.itemSize,n*=t.itemSize;for(let s=0,a=this.itemSize;s<a;s++)this.array[e+s]=t.array[n+s];return this}copyArray(e){return this.array.set(e),this}applyMatrix3(e){if(this.itemSize===2)for(let t=0,n=this.count;t<n;t++)Ls.fromBufferAttribute(this,t),Ls.applyMatrix3(e),this.setXY(t,Ls.x,Ls.y);else if(this.itemSize===3)for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.applyMatrix3(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}applyMatrix4(e){for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.applyMatrix4(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}applyNormalMatrix(e){for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.applyNormalMatrix(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}transformDirection(e){for(let t=0,n=this.count;t<n;t++)wt.fromBufferAttribute(this,t),wt.transformDirection(e),this.setXYZ(t,wt.x,wt.y,wt.z);return this}set(e,t=0){return this.array.set(e,t),this}getComponent(e,t){let n=this.array[e*this.itemSize+t];return this.normalized&&(n=es(n,this.array)),n}setComponent(e,t,n){return this.normalized&&(n=Xt(n,this.array)),this.array[e*this.itemSize+t]=n,this}getX(e){let t=this.array[e*this.itemSize];return this.normalized&&(t=es(t,this.array)),t}setX(e,t){return this.normalized&&(t=Xt(t,this.array)),this.array[e*this.itemSize]=t,this}getY(e){let t=this.array[e*this.itemSize+1];return this.normalized&&(t=es(t,this.array)),t}setY(e,t){return this.normalized&&(t=Xt(t,this.array)),this.array[e*this.itemSize+1]=t,this}getZ(e){let t=this.array[e*this.itemSize+2];return this.normalized&&(t=es(t,this.array)),t}setZ(e,t){return this.normalized&&(t=Xt(t,this.array)),this.array[e*this.itemSize+2]=t,this}getW(e){let t=this.array[e*this.itemSize+3];return this.normalized&&(t=es(t,this.array)),t}setW(e,t){return this.normalized&&(t=Xt(t,this.array)),this.array[e*this.itemSize+3]=t,this}setXY(e,t,n){return e*=this.itemSize,this.normalized&&(t=Xt(t,this.array),n=Xt(n,this.array)),this.array[e+0]=t,this.array[e+1]=n,this}setXYZ(e,t,n,s){return e*=this.itemSize,this.normalized&&(t=Xt(t,this.array),n=Xt(n,this.array),s=Xt(s,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this}setXYZW(e,t,n,s,a){return e*=this.itemSize,this.normalized&&(t=Xt(t,this.array),n=Xt(n,this.array),s=Xt(s,this.array),a=Xt(a,this.array)),this.array[e+0]=t,this.array[e+1]=n,this.array[e+2]=s,this.array[e+3]=a,this}onUpload(e){return this.onUploadCallback=e,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){const e={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};return this.name!==""&&(e.name=this.name),this.usage!==Io&&(e.usage=this.usage),e}dispose(){this.dispatchEvent({type:"dispose"})}}class sc extends Dt{constructor(e,t,n){super(new Uint16Array(e),t,n)}}class ac extends Dt{constructor(e,t,n){super(new Uint32Array(e),t,n)}}class at extends Dt{constructor(e,t,n){super(new Float32Array(e),t,n)}}const Hh=new vs,is=new I,Ga=new I;class Ji{constructor(e=new I,t=-1){this.isSphere=!0,this.center=e,this.radius=t}set(e,t){return this.center.copy(e),this.radius=t,this}setFromPoints(e,t){const n=this.center;t!==void 0?n.copy(t):Hh.setFromPoints(e).getCenter(n);let s=0;for(let a=0,r=e.length;a<r;a++)s=Math.max(s,n.distanceToSquared(e[a]));return this.radius=Math.sqrt(s),this}copy(e){return this.center.copy(e.center),this.radius=e.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint(e){return e.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint(e){return e.distanceTo(this.center)-this.radius}intersectsSphere(e){const t=this.radius+e.radius;return e.center.distanceToSquared(this.center)<=t*t}intersectsBox(e){return e.intersectsSphere(this)}intersectsPlane(e){return Math.abs(e.distanceToPoint(this.center))<=this.radius}clampPoint(e,t){const n=this.center.distanceToSquared(e);return t.copy(e),n>this.radius*this.radius&&(t.sub(this.center).normalize(),t.multiplyScalar(this.radius).add(this.center)),t}getBoundingBox(e){return this.isEmpty()?(e.makeEmpty(),e):(e.set(this.center,this.center),e.expandByScalar(this.radius),e)}applyMatrix4(e){return this.center.applyMatrix4(e),this.radius=this.radius*e.getMaxScaleOnAxis(),this}translate(e){return this.center.add(e),this}expandByPoint(e){if(this.isEmpty())return this.center.copy(e),this.radius=0,this;is.subVectors(e,this.center);const t=is.lengthSq();if(t>this.radius*this.radius){const n=Math.sqrt(t),s=(n-this.radius)*.5;this.center.addScaledVector(is,s/n),this.radius+=s}return this}union(e){return e.isEmpty()?this:this.isEmpty()?(this.copy(e),this):(this.center.equals(e.center)===!0?this.radius=Math.max(this.radius,e.radius):(Ga.subVectors(e.center,this.center).setLength(e.radius),this.expandByPoint(is.copy(e.center).add(Ga)),this.expandByPoint(is.copy(e.center).sub(Ga))),this)}equals(e){return e.center.equals(this.center)&&e.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON(e){return this.radius=e.radius,this.center.fromArray(e.center),this}}let Gh=0;const dn=new pt,Va=new st,Bi=new I,nn=new vs,ss=new vs,It=new I;class Pt extends Ti{constructor(){super(),this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:Gh++}),this.uuid=_s(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.indirectOffset=0,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={},this._transformed=!1}getIndex(){return this.index}setIndex(e){return Array.isArray(e)?this.index=new(Mh(e)?ac:sc)(e,1):this.index=e,this}setIndirect(e,t=0){return this.indirect=e,this.indirectOffset=t,this}getIndirect(){return this.indirect}getAttribute(e){return this.attributes[e]}setAttribute(e,t){return this.attributes[e]=t,this}deleteAttribute(e){return delete this.attributes[e],this}hasAttribute(e){return this.attributes[e]!==void 0}addGroup(e,t,n=0){this.groups.push({start:e,count:t,materialIndex:n})}clearGroups(){this.groups=[]}setDrawRange(e,t){this.drawRange.start=e,this.drawRange.count=t}applyMatrix4(e){const t=this.attributes.position;t!==void 0&&(t.applyMatrix4(e),t.needsUpdate=!0);const n=this.attributes.normal;if(n!==void 0){const a=new Oe().getNormalMatrix(e);n.applyNormalMatrix(a),n.needsUpdate=!0}const s=this.attributes.tangent;return s!==void 0&&(s.transformDirection(e),s.needsUpdate=!0),this.boundingBox!==null&&this.computeBoundingBox(),this.boundingSphere!==null&&this.computeBoundingSphere(),this._transformed=!0,this}applyQuaternion(e){return dn.makeRotationFromQuaternion(e),this.applyMatrix4(dn),this}rotateX(e){return dn.makeRotationX(e),this.applyMatrix4(dn),this}rotateY(e){return dn.makeRotationY(e),this.applyMatrix4(dn),this}rotateZ(e){return dn.makeRotationZ(e),this.applyMatrix4(dn),this}translate(e,t,n){return dn.makeTranslation(e,t,n),this.applyMatrix4(dn),this}scale(e,t,n){return dn.makeScale(e,t,n),this.applyMatrix4(dn),this}lookAt(e){return Va.lookAt(e),Va.updateMatrix(),this.applyMatrix4(Va.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(Bi).negate(),this.translate(Bi.x,Bi.y,Bi.z),this}setFromPoints(e){const t=this.getAttribute("position");if(t===void 0){const n=[];for(let s=0,a=e.length;s<a;s++){const r=e[s];n.push(r.x,r.y,r.z||0)}this.setAttribute("position",new at(n,3))}else{const n=Math.min(e.length,t.count);for(let s=0;s<n;s++){const a=e[s];t.setXYZ(s,a.x,a.y,a.z||0)}e.length>t.count&&Fe("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry."),t.needsUpdate=!0}return this}computeBoundingBox(){this.boundingBox===null&&(this.boundingBox=new vs);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){et("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new I(-1/0,-1/0,-1/0),new I(1/0,1/0,1/0));return}if(e!==void 0){if(this.boundingBox.setFromBufferAttribute(e),t)for(let n=0,s=t.length;n<s;n++){const a=t[n];nn.setFromBufferAttribute(a),this.morphTargetsRelative?(It.addVectors(this.boundingBox.min,nn.min),this.boundingBox.expandByPoint(It),It.addVectors(this.boundingBox.max,nn.max),this.boundingBox.expandByPoint(It)):(this.boundingBox.expandByPoint(nn.min),this.boundingBox.expandByPoint(nn.max))}}else this.boundingBox.makeEmpty();(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))&&et('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){this.boundingSphere===null&&(this.boundingSphere=new Ji);const e=this.attributes.position,t=this.morphAttributes.position;if(e&&e.isGLBufferAttribute){et("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new I,1/0);return}if(e){const n=this.boundingSphere.center;if(nn.setFromBufferAttribute(e),t)for(let a=0,r=t.length;a<r;a++){const o=t[a];ss.setFromBufferAttribute(o),this.morphTargetsRelative?(It.addVectors(nn.min,ss.min),nn.expandByPoint(It),It.addVectors(nn.max,ss.max),nn.expandByPoint(It)):(nn.expandByPoint(ss.min),nn.expandByPoint(ss.max))}nn.getCenter(n);let s=0;for(let a=0,r=e.count;a<r;a++)It.fromBufferAttribute(e,a),s=Math.max(s,n.distanceToSquared(It));if(t)for(let a=0,r=t.length;a<r;a++){const o=t[a],l=this.morphTargetsRelative;for(let c=0,h=o.count;c<h;c++)It.fromBufferAttribute(o,c),l&&(Bi.fromBufferAttribute(e,c),It.add(Bi)),s=Math.max(s,n.distanceToSquared(It))}this.boundingSphere.radius=Math.sqrt(s),isNaN(this.boundingSphere.radius)&&et('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){const e=this.index,t=this.attributes;if(e===null||t.position===void 0||t.normal===void 0||t.uv===void 0){et("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}const n=t.position,s=t.normal,a=t.uv;let r=this.getAttribute("tangent");(r===void 0||r.count!==n.count)&&(r=new Dt(new Float32Array(4*n.count),4),this.setAttribute("tangent",r));const o=[],l=[];for(let v=0;v<n.count;v++)o[v]=new I,l[v]=new I;const c=new I,h=new I,u=new I,d=new ze,p=new ze,g=new ze,x=new I,m=new I;function f(v,T,C){c.fromBufferAttribute(n,v),h.fromBufferAttribute(n,T),u.fromBufferAttribute(n,C),d.fromBufferAttribute(a,v),p.fromBufferAttribute(a,T),g.fromBufferAttribute(a,C),h.sub(c),u.sub(c),p.sub(d),g.sub(d);const P=1/(p.x*g.y-g.x*p.y);isFinite(P)&&(x.copy(h).multiplyScalar(g.y).addScaledVector(u,-p.y).multiplyScalar(P),m.copy(u).multiplyScalar(p.x).addScaledVector(h,-g.x).multiplyScalar(P),o[v].add(x),o[T].add(x),o[C].add(x),l[v].add(m),l[T].add(m),l[C].add(m))}let M=this.groups;M.length===0&&(M=[{start:0,count:e.count}]);for(let v=0,T=M.length;v<T;++v){const C=M[v],P=C.start,L=C.count;for(let q=P,Z=P+L;q<Z;q+=3)f(e.getX(q+0),e.getX(q+1),e.getX(q+2))}const w=new I,S=new I,b=new I,E=new I;function R(v){b.fromBufferAttribute(s,v),E.copy(b);const T=o[v];w.copy(T),w.sub(b.multiplyScalar(b.dot(T))).normalize(),S.crossVectors(E,T);const P=S.dot(l[v])<0?-1:1;r.setXYZW(v,w.x,w.y,w.z,P)}for(let v=0,T=M.length;v<T;++v){const C=M[v],P=C.start,L=C.count;for(let q=P,Z=P+L;q<Z;q+=3)R(e.getX(q+0)),R(e.getX(q+1)),R(e.getX(q+2))}this._transformed=!0}computeVertexNormals(){const e=this.index,t=this.getAttribute("position");if(t!==void 0){let n=this.getAttribute("normal");if(n===void 0||n.count!==t.count)n=new Dt(new Float32Array(t.count*3),3),this.setAttribute("normal",n);else for(let d=0,p=n.count;d<p;d++)n.setXYZ(d,0,0,0);const s=new I,a=new I,r=new I,o=new I,l=new I,c=new I,h=new I,u=new I;if(e)for(let d=0,p=e.count;d<p;d+=3){const g=e.getX(d+0),x=e.getX(d+1),m=e.getX(d+2);s.fromBufferAttribute(t,g),a.fromBufferAttribute(t,x),r.fromBufferAttribute(t,m),h.subVectors(r,a),u.subVectors(s,a),h.cross(u),o.fromBufferAttribute(n,g),l.fromBufferAttribute(n,x),c.fromBufferAttribute(n,m),o.add(h),l.add(h),c.add(h),n.setXYZ(g,o.x,o.y,o.z),n.setXYZ(x,l.x,l.y,l.z),n.setXYZ(m,c.x,c.y,c.z)}else for(let d=0,p=t.count;d<p;d+=3)s.fromBufferAttribute(t,d+0),a.fromBufferAttribute(t,d+1),r.fromBufferAttribute(t,d+2),h.subVectors(r,a),u.subVectors(s,a),h.cross(u),n.setXYZ(d+0,h.x,h.y,h.z),n.setXYZ(d+1,h.x,h.y,h.z),n.setXYZ(d+2,h.x,h.y,h.z);this.normalizeNormals(),n.needsUpdate=!0}}normalizeNormals(){const e=this.attributes.normal;for(let t=0,n=e.count;t<n;t++)It.fromBufferAttribute(e,t),It.normalize(),e.setXYZ(t,It.x,It.y,It.z)}toNonIndexed(){function e(o,l){const c=o.array,h=o.itemSize,u=o.normalized,d=new c.constructor(l.length*h);let p=0,g=0;for(let x=0,m=l.length;x<m;x++){o.isInterleavedBufferAttribute?p=l[x]*o.data.stride+o.offset:p=l[x]*h;for(let f=0;f<h;f++)d[g++]=c[p++]}return new Dt(d,h,u)}if(this.index===null)return Fe("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;const t=new Pt,n=this.index.array,s=this.attributes;for(const o in s){const l=s[o],c=e(l,n);t.setAttribute(o,c)}const a=this.morphAttributes;for(const o in a){const l=[],c=a[o];for(let h=0,u=c.length;h<u;h++){const d=c[h],p=e(d,n);l.push(p)}t.morphAttributes[o]=l}t.morphTargetsRelative=this.morphTargetsRelative;const r=this.groups;for(let o=0,l=r.length;o<l;o++){const c=r[o];t.addGroup(c.start,c.count,c.materialIndex)}return t}toJSON(){const e={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if(e.uuid=this.uuid,e.type=this.parameters!==void 0&&this._transformed===!0?"BufferGeometry":this.type,this.name!==""&&(e.name=this.name),Object.keys(this.userData).length>0&&(e.userData=this.userData),this.parameters!==void 0&&this._transformed!==!0){const l=this.parameters;for(const c in l)l[c]!==void 0&&(e[c]=l[c]);return e}e.data={attributes:{}};const t=this.index;t!==null&&(e.data.index={type:t.array.constructor.name,array:Array.prototype.slice.call(t.array)});const n=this.attributes;for(const l in n){const c=n[l];e.data.attributes[l]=c.toJSON(e.data)}const s={};let a=!1;for(const l in this.morphAttributes){const c=this.morphAttributes[l],h=[];for(let u=0,d=c.length;u<d;u++){const p=c[u];h.push(p.toJSON(e.data))}h.length>0&&(s[l]=h,a=!0)}a&&(e.data.morphAttributes=s,e.data.morphTargetsRelative=this.morphTargetsRelative);const r=this.groups;r.length>0&&(e.data.groups=JSON.parse(JSON.stringify(r)));const o=this.boundingSphere;return o!==null&&(e.data.boundingSphere=o.toJSON()),e}clone(){return new this.constructor().copy(this)}copy(e){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;const t={};this.name=e.name;const n=e.index;n!==null&&this.setIndex(n.clone());const s=e.attributes;for(const c in s){const h=s[c];this.setAttribute(c,h.clone(t))}const a=e.morphAttributes;for(const c in a){const h=[],u=a[c];for(let d=0,p=u.length;d<p;d++)h.push(u[d].clone(t));this.morphAttributes[c]=h}this.morphTargetsRelative=e.morphTargetsRelative;const r=e.groups;for(let c=0,h=r.length;c<h;c++){const u=r[c];this.addGroup(u.start,u.count,u.materialIndex)}const o=e.boundingBox;o!==null&&(this.boundingBox=o.clone());const l=e.boundingSphere;return l!==null&&(this.boundingSphere=l.clone()),this.drawRange.start=e.drawRange.start,this.drawRange.count=e.drawRange.count,this.userData=e.userData,this._transformed=e._transformed,this}dispose(){this.dispatchEvent({type:"dispose"})}}let Vh=0;class $i extends Ti{constructor(){super(),this.isMaterial=!0,Object.defineProperty(this,"id",{value:Vh++}),this.uuid=_s(),this.name="",this.type="Material",this.blending=Mi,this.side=ri,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=ar,this.blendDst=rr,this.blendEquation=gi,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new Le(0,0,0),this.blendAlpha=0,this.depthFunc=Xi,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=Lo,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=Ci,this.stencilZFail=Ci,this.stencilZPass=Ci,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest(e){this._alphaTest>0!=e>0&&this.version++,this._alphaTest=e}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues(e){if(e!==void 0)for(const t in e){const n=e[t];if(n===void 0){Fe(`Material: parameter '${t}' has value of undefined.`);continue}const s=this[t];if(s===void 0){Fe(`Material: '${t}' is not a property of THREE.${this.type}.`);continue}s&&s.isColor?s.set(n):s&&s.isVector2&&n&&n.isVector2||s&&s.isEuler&&n&&n.isEuler||s&&s.isVector3&&n&&n.isVector3?s.copy(n):this[t]=n}}toJSON(e){const t=e===void 0||typeof e=="string";t&&(e={textures:{},images:{}});const n={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};n.uuid=this.uuid,n.type=this.type,this.name!==""&&(n.name=this.name),this.color&&this.color.isColor&&(n.color=this.color.getHex()),this.roughness!==void 0&&(n.roughness=this.roughness),this.metalness!==void 0&&(n.metalness=this.metalness),this.sheen!==void 0&&(n.sheen=this.sheen),this.sheenColor&&this.sheenColor.isColor&&(n.sheenColor=this.sheenColor.getHex()),this.sheenRoughness!==void 0&&(n.sheenRoughness=this.sheenRoughness),this.emissive&&this.emissive.isColor&&(n.emissive=this.emissive.getHex()),this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1&&(n.emissiveIntensity=this.emissiveIntensity),this.specular&&this.specular.isColor&&(n.specular=this.specular.getHex()),this.specularIntensity!==void 0&&(n.specularIntensity=this.specularIntensity),this.specularColor&&this.specularColor.isColor&&(n.specularColor=this.specularColor.getHex()),this.shininess!==void 0&&(n.shininess=this.shininess),this.clearcoat!==void 0&&(n.clearcoat=this.clearcoat),this.clearcoatRoughness!==void 0&&(n.clearcoatRoughness=this.clearcoatRoughness),this.clearcoatMap&&this.clearcoatMap.isTexture&&(n.clearcoatMap=this.clearcoatMap.toJSON(e).uuid),this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture&&(n.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON(e).uuid),this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture&&(n.clearcoatNormalMap=this.clearcoatNormalMap.toJSON(e).uuid,n.clearcoatNormalScale=this.clearcoatNormalScale.toArray()),this.sheenColorMap&&this.sheenColorMap.isTexture&&(n.sheenColorMap=this.sheenColorMap.toJSON(e).uuid),this.sheenRoughnessMap&&this.sheenRoughnessMap.isTexture&&(n.sheenRoughnessMap=this.sheenRoughnessMap.toJSON(e).uuid),this.dispersion!==void 0&&(n.dispersion=this.dispersion),this.iridescence!==void 0&&(n.iridescence=this.iridescence),this.iridescenceIOR!==void 0&&(n.iridescenceIOR=this.iridescenceIOR),this.iridescenceThicknessRange!==void 0&&(n.iridescenceThicknessRange=this.iridescenceThicknessRange),this.iridescenceMap&&this.iridescenceMap.isTexture&&(n.iridescenceMap=this.iridescenceMap.toJSON(e).uuid),this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture&&(n.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON(e).uuid),this.anisotropy!==void 0&&(n.anisotropy=this.anisotropy),this.anisotropyRotation!==void 0&&(n.anisotropyRotation=this.anisotropyRotation),this.anisotropyMap&&this.anisotropyMap.isTexture&&(n.anisotropyMap=this.anisotropyMap.toJSON(e).uuid),this.map&&this.map.isTexture&&(n.map=this.map.toJSON(e).uuid),this.matcap&&this.matcap.isTexture&&(n.matcap=this.matcap.toJSON(e).uuid),this.alphaMap&&this.alphaMap.isTexture&&(n.alphaMap=this.alphaMap.toJSON(e).uuid),this.lightMap&&this.lightMap.isTexture&&(n.lightMap=this.lightMap.toJSON(e).uuid,n.lightMapIntensity=this.lightMapIntensity),this.aoMap&&this.aoMap.isTexture&&(n.aoMap=this.aoMap.toJSON(e).uuid,n.aoMapIntensity=this.aoMapIntensity),this.bumpMap&&this.bumpMap.isTexture&&(n.bumpMap=this.bumpMap.toJSON(e).uuid,n.bumpScale=this.bumpScale),this.normalMap&&this.normalMap.isTexture&&(n.normalMap=this.normalMap.toJSON(e).uuid,n.normalMapType=this.normalMapType,n.normalScale=this.normalScale.toArray()),this.displacementMap&&this.displacementMap.isTexture&&(n.displacementMap=this.displacementMap.toJSON(e).uuid,n.displacementScale=this.displacementScale,n.displacementBias=this.displacementBias),this.roughnessMap&&this.roughnessMap.isTexture&&(n.roughnessMap=this.roughnessMap.toJSON(e).uuid),this.metalnessMap&&this.metalnessMap.isTexture&&(n.metalnessMap=this.metalnessMap.toJSON(e).uuid),this.emissiveMap&&this.emissiveMap.isTexture&&(n.emissiveMap=this.emissiveMap.toJSON(e).uuid),this.specularMap&&this.specularMap.isTexture&&(n.specularMap=this.specularMap.toJSON(e).uuid),this.specularIntensityMap&&this.specularIntensityMap.isTexture&&(n.specularIntensityMap=this.specularIntensityMap.toJSON(e).uuid),this.specularColorMap&&this.specularColorMap.isTexture&&(n.specularColorMap=this.specularColorMap.toJSON(e).uuid),this.envMap&&this.envMap.isTexture&&(n.envMap=this.envMap.toJSON(e).uuid,this.combine!==void 0&&(n.combine=this.combine)),this.envMapRotation!==void 0&&(n.envMapRotation=this.envMapRotation.toArray()),this.envMapIntensity!==void 0&&(n.envMapIntensity=this.envMapIntensity),this.reflectivity!==void 0&&(n.reflectivity=this.reflectivity),this.refractionRatio!==void 0&&(n.refractionRatio=this.refractionRatio),this.gradientMap&&this.gradientMap.isTexture&&(n.gradientMap=this.gradientMap.toJSON(e).uuid),this.transmission!==void 0&&(n.transmission=this.transmission),this.transmissionMap&&this.transmissionMap.isTexture&&(n.transmissionMap=this.transmissionMap.toJSON(e).uuid),this.thickness!==void 0&&(n.thickness=this.thickness),this.thicknessMap&&this.thicknessMap.isTexture&&(n.thicknessMap=this.thicknessMap.toJSON(e).uuid),this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0&&(n.attenuationDistance=this.attenuationDistance),this.attenuationColor!==void 0&&(n.attenuationColor=this.attenuationColor.getHex()),this.size!==void 0&&(n.size=this.size),this.shadowSide!==null&&(n.shadowSide=this.shadowSide),this.sizeAttenuation!==void 0&&(n.sizeAttenuation=this.sizeAttenuation),this.blending!==Mi&&(n.blending=this.blending),this.side!==ri&&(n.side=this.side),this.vertexColors===!0&&(n.vertexColors=!0),this.opacity<1&&(n.opacity=this.opacity),this.transparent===!0&&(n.transparent=!0),this.blendSrc!==ar&&(n.blendSrc=this.blendSrc),this.blendDst!==rr&&(n.blendDst=this.blendDst),this.blendEquation!==gi&&(n.blendEquation=this.blendEquation),this.blendSrcAlpha!==null&&(n.blendSrcAlpha=this.blendSrcAlpha),this.blendDstAlpha!==null&&(n.blendDstAlpha=this.blendDstAlpha),this.blendEquationAlpha!==null&&(n.blendEquationAlpha=this.blendEquationAlpha),this.blendColor&&this.blendColor.isColor&&(n.blendColor=this.blendColor.getHex()),this.blendAlpha!==0&&(n.blendAlpha=this.blendAlpha),this.depthFunc!==Xi&&(n.depthFunc=this.depthFunc),this.depthTest===!1&&(n.depthTest=this.depthTest),this.depthWrite===!1&&(n.depthWrite=this.depthWrite),this.colorWrite===!1&&(n.colorWrite=this.colorWrite),this.stencilWriteMask!==255&&(n.stencilWriteMask=this.stencilWriteMask),this.stencilFunc!==Lo&&(n.stencilFunc=this.stencilFunc),this.stencilRef!==0&&(n.stencilRef=this.stencilRef),this.stencilFuncMask!==255&&(n.stencilFuncMask=this.stencilFuncMask),this.stencilFail!==Ci&&(n.stencilFail=this.stencilFail),this.stencilZFail!==Ci&&(n.stencilZFail=this.stencilZFail),this.stencilZPass!==Ci&&(n.stencilZPass=this.stencilZPass),this.stencilWrite===!0&&(n.stencilWrite=this.stencilWrite),this.rotation!==void 0&&this.rotation!==0&&(n.rotation=this.rotation),this.polygonOffset===!0&&(n.polygonOffset=!0),this.polygonOffsetFactor!==0&&(n.polygonOffsetFactor=this.polygonOffsetFactor),this.polygonOffsetUnits!==0&&(n.polygonOffsetUnits=this.polygonOffsetUnits),this.linewidth!==void 0&&this.linewidth!==1&&(n.linewidth=this.linewidth),this.dashSize!==void 0&&(n.dashSize=this.dashSize),this.gapSize!==void 0&&(n.gapSize=this.gapSize),this.scale!==void 0&&(n.scale=this.scale),this.dithering===!0&&(n.dithering=!0),this.alphaTest>0&&(n.alphaTest=this.alphaTest),this.alphaHash===!0&&(n.alphaHash=!0),this.alphaToCoverage===!0&&(n.alphaToCoverage=!0),this.premultipliedAlpha===!0&&(n.premultipliedAlpha=!0),this.forceSinglePass===!0&&(n.forceSinglePass=!0),this.allowOverride===!1&&(n.allowOverride=!1),this.wireframe===!0&&(n.wireframe=!0),this.wireframeLinewidth>1&&(n.wireframeLinewidth=this.wireframeLinewidth),this.wireframeLinecap!=="round"&&(n.wireframeLinecap=this.wireframeLinecap),this.wireframeLinejoin!=="round"&&(n.wireframeLinejoin=this.wireframeLinejoin),this.flatShading===!0&&(n.flatShading=!0),this.visible===!1&&(n.visible=!1),this.toneMapped===!1&&(n.toneMapped=!1),this.fog===!1&&(n.fog=!1),Object.keys(this.userData).length>0&&(n.userData=this.userData);function s(a){const r=[];for(const o in a){const l=a[o];delete l.metadata,r.push(l)}return r}if(t){const a=s(e.textures),r=s(e.images);a.length>0&&(n.textures=a),r.length>0&&(n.images=r)}return n}fromJSON(e,t){if(e.uuid!==void 0&&(this.uuid=e.uuid),e.name!==void 0&&(this.name=e.name),e.color!==void 0&&this.color!==void 0&&this.color.setHex(e.color),e.roughness!==void 0&&(this.roughness=e.roughness),e.metalness!==void 0&&(this.metalness=e.metalness),e.sheen!==void 0&&(this.sheen=e.sheen),e.sheenColor!==void 0&&(this.sheenColor=new Le().setHex(e.sheenColor)),e.sheenRoughness!==void 0&&(this.sheenRoughness=e.sheenRoughness),e.emissive!==void 0&&this.emissive!==void 0&&this.emissive.setHex(e.emissive),e.specular!==void 0&&this.specular!==void 0&&this.specular.setHex(e.specular),e.specularIntensity!==void 0&&(this.specularIntensity=e.specularIntensity),e.specularColor!==void 0&&this.specularColor!==void 0&&this.specularColor.setHex(e.specularColor),e.shininess!==void 0&&(this.shininess=e.shininess),e.clearcoat!==void 0&&(this.clearcoat=e.clearcoat),e.clearcoatRoughness!==void 0&&(this.clearcoatRoughness=e.clearcoatRoughness),e.dispersion!==void 0&&(this.dispersion=e.dispersion),e.iridescence!==void 0&&(this.iridescence=e.iridescence),e.iridescenceIOR!==void 0&&(this.iridescenceIOR=e.iridescenceIOR),e.iridescenceThicknessRange!==void 0&&(this.iridescenceThicknessRange=e.iridescenceThicknessRange),e.transmission!==void 0&&(this.transmission=e.transmission),e.thickness!==void 0&&(this.thickness=e.thickness),e.attenuationDistance!==void 0&&(this.attenuationDistance=e.attenuationDistance),e.attenuationColor!==void 0&&this.attenuationColor!==void 0&&this.attenuationColor.setHex(e.attenuationColor),e.anisotropy!==void 0&&(this.anisotropy=e.anisotropy),e.anisotropyRotation!==void 0&&(this.anisotropyRotation=e.anisotropyRotation),e.fog!==void 0&&(this.fog=e.fog),e.flatShading!==void 0&&(this.flatShading=e.flatShading),e.blending!==void 0&&(this.blending=e.blending),e.combine!==void 0&&(this.combine=e.combine),e.side!==void 0&&(this.side=e.side),e.shadowSide!==void 0&&(this.shadowSide=e.shadowSide),e.opacity!==void 0&&(this.opacity=e.opacity),e.transparent!==void 0&&(this.transparent=e.transparent),e.alphaTest!==void 0&&(this.alphaTest=e.alphaTest),e.alphaHash!==void 0&&(this.alphaHash=e.alphaHash),e.depthFunc!==void 0&&(this.depthFunc=e.depthFunc),e.depthTest!==void 0&&(this.depthTest=e.depthTest),e.depthWrite!==void 0&&(this.depthWrite=e.depthWrite),e.colorWrite!==void 0&&(this.colorWrite=e.colorWrite),e.blendSrc!==void 0&&(this.blendSrc=e.blendSrc),e.blendDst!==void 0&&(this.blendDst=e.blendDst),e.blendEquation!==void 0&&(this.blendEquation=e.blendEquation),e.blendSrcAlpha!==void 0&&(this.blendSrcAlpha=e.blendSrcAlpha),e.blendDstAlpha!==void 0&&(this.blendDstAlpha=e.blendDstAlpha),e.blendEquationAlpha!==void 0&&(this.blendEquationAlpha=e.blendEquationAlpha),e.blendColor!==void 0&&this.blendColor!==void 0&&this.blendColor.setHex(e.blendColor),e.blendAlpha!==void 0&&(this.blendAlpha=e.blendAlpha),e.stencilWriteMask!==void 0&&(this.stencilWriteMask=e.stencilWriteMask),e.stencilFunc!==void 0&&(this.stencilFunc=e.stencilFunc),e.stencilRef!==void 0&&(this.stencilRef=e.stencilRef),e.stencilFuncMask!==void 0&&(this.stencilFuncMask=e.stencilFuncMask),e.stencilFail!==void 0&&(this.stencilFail=e.stencilFail),e.stencilZFail!==void 0&&(this.stencilZFail=e.stencilZFail),e.stencilZPass!==void 0&&(this.stencilZPass=e.stencilZPass),e.stencilWrite!==void 0&&(this.stencilWrite=e.stencilWrite),e.wireframe!==void 0&&(this.wireframe=e.wireframe),e.wireframeLinewidth!==void 0&&(this.wireframeLinewidth=e.wireframeLinewidth),e.wireframeLinecap!==void 0&&(this.wireframeLinecap=e.wireframeLinecap),e.wireframeLinejoin!==void 0&&(this.wireframeLinejoin=e.wireframeLinejoin),e.rotation!==void 0&&(this.rotation=e.rotation),e.linewidth!==void 0&&(this.linewidth=e.linewidth),e.dashSize!==void 0&&(this.dashSize=e.dashSize),e.gapSize!==void 0&&(this.gapSize=e.gapSize),e.scale!==void 0&&(this.scale=e.scale),e.polygonOffset!==void 0&&(this.polygonOffset=e.polygonOffset),e.polygonOffsetFactor!==void 0&&(this.polygonOffsetFactor=e.polygonOffsetFactor),e.polygonOffsetUnits!==void 0&&(this.polygonOffsetUnits=e.polygonOffsetUnits),e.dithering!==void 0&&(this.dithering=e.dithering),e.alphaToCoverage!==void 0&&(this.alphaToCoverage=e.alphaToCoverage),e.premultipliedAlpha!==void 0&&(this.premultipliedAlpha=e.premultipliedAlpha),e.forceSinglePass!==void 0&&(this.forceSinglePass=e.forceSinglePass),e.allowOverride!==void 0&&(this.allowOverride=e.allowOverride),e.visible!==void 0&&(this.visible=e.visible),e.toneMapped!==void 0&&(this.toneMapped=e.toneMapped),e.userData!==void 0&&(this.userData=e.userData),e.vertexColors!==void 0&&(typeof e.vertexColors=="number"?this.vertexColors=e.vertexColors>0:this.vertexColors=e.vertexColors),e.size!==void 0&&(this.size=e.size),e.sizeAttenuation!==void 0&&(this.sizeAttenuation=e.sizeAttenuation),e.map!==void 0&&(this.map=t[e.map]||null),e.matcap!==void 0&&(this.matcap=t[e.matcap]||null),e.alphaMap!==void 0&&(this.alphaMap=t[e.alphaMap]||null),e.bumpMap!==void 0&&(this.bumpMap=t[e.bumpMap]||null),e.bumpScale!==void 0&&(this.bumpScale=e.bumpScale),e.normalMap!==void 0&&(this.normalMap=t[e.normalMap]||null),e.normalMapType!==void 0&&(this.normalMapType=e.normalMapType),e.normalScale!==void 0){let n=e.normalScale;Array.isArray(n)===!1&&(n=[n,n]),this.normalScale=new ze().fromArray(n)}return e.displacementMap!==void 0&&(this.displacementMap=t[e.displacementMap]||null),e.displacementScale!==void 0&&(this.displacementScale=e.displacementScale),e.displacementBias!==void 0&&(this.displacementBias=e.displacementBias),e.roughnessMap!==void 0&&(this.roughnessMap=t[e.roughnessMap]||null),e.metalnessMap!==void 0&&(this.metalnessMap=t[e.metalnessMap]||null),e.emissiveMap!==void 0&&(this.emissiveMap=t[e.emissiveMap]||null),e.emissiveIntensity!==void 0&&(this.emissiveIntensity=e.emissiveIntensity),e.specularMap!==void 0&&(this.specularMap=t[e.specularMap]||null),e.specularIntensityMap!==void 0&&(this.specularIntensityMap=t[e.specularIntensityMap]||null),e.specularColorMap!==void 0&&(this.specularColorMap=t[e.specularColorMap]||null),e.envMap!==void 0&&(this.envMap=t[e.envMap]||null),e.envMapRotation!==void 0&&this.envMapRotation.fromArray(e.envMapRotation),e.envMapIntensity!==void 0&&(this.envMapIntensity=e.envMapIntensity),e.reflectivity!==void 0&&(this.reflectivity=e.reflectivity),e.refractionRatio!==void 0&&(this.refractionRatio=e.refractionRatio),e.lightMap!==void 0&&(this.lightMap=t[e.lightMap]||null),e.lightMapIntensity!==void 0&&(this.lightMapIntensity=e.lightMapIntensity),e.aoMap!==void 0&&(this.aoMap=t[e.aoMap]||null),e.aoMapIntensity!==void 0&&(this.aoMapIntensity=e.aoMapIntensity),e.gradientMap!==void 0&&(this.gradientMap=t[e.gradientMap]||null),e.clearcoatMap!==void 0&&(this.clearcoatMap=t[e.clearcoatMap]||null),e.clearcoatRoughnessMap!==void 0&&(this.clearcoatRoughnessMap=t[e.clearcoatRoughnessMap]||null),e.clearcoatNormalMap!==void 0&&(this.clearcoatNormalMap=t[e.clearcoatNormalMap]||null),e.clearcoatNormalScale!==void 0&&(this.clearcoatNormalScale=new ze().fromArray(e.clearcoatNormalScale)),e.iridescenceMap!==void 0&&(this.iridescenceMap=t[e.iridescenceMap]||null),e.iridescenceThicknessMap!==void 0&&(this.iridescenceThicknessMap=t[e.iridescenceThicknessMap]||null),e.transmissionMap!==void 0&&(this.transmissionMap=t[e.transmissionMap]||null),e.thicknessMap!==void 0&&(this.thicknessMap=t[e.thicknessMap]||null),e.anisotropyMap!==void 0&&(this.anisotropyMap=t[e.anisotropyMap]||null),e.sheenColorMap!==void 0&&(this.sheenColorMap=t[e.sheenColorMap]||null),e.sheenRoughnessMap!==void 0&&(this.sheenRoughnessMap=t[e.sheenRoughnessMap]||null),this}clone(){return new this.constructor().copy(this)}copy(e){this.name=e.name,this.blending=e.blending,this.side=e.side,this.vertexColors=e.vertexColors,this.opacity=e.opacity,this.transparent=e.transparent,this.blendSrc=e.blendSrc,this.blendDst=e.blendDst,this.blendEquation=e.blendEquation,this.blendSrcAlpha=e.blendSrcAlpha,this.blendDstAlpha=e.blendDstAlpha,this.blendEquationAlpha=e.blendEquationAlpha,this.blendColor.copy(e.blendColor),this.blendAlpha=e.blendAlpha,this.depthFunc=e.depthFunc,this.depthTest=e.depthTest,this.depthWrite=e.depthWrite,this.stencilWriteMask=e.stencilWriteMask,this.stencilFunc=e.stencilFunc,this.stencilRef=e.stencilRef,this.stencilFuncMask=e.stencilFuncMask,this.stencilFail=e.stencilFail,this.stencilZFail=e.stencilZFail,this.stencilZPass=e.stencilZPass,this.stencilWrite=e.stencilWrite;const t=e.clippingPlanes;let n=null;if(t!==null){const s=t.length;n=new Array(s);for(let a=0;a!==s;++a)n[a]=t[a].clone()}return this.clippingPlanes=n,this.clipIntersection=e.clipIntersection,this.clipShadows=e.clipShadows,this.shadowSide=e.shadowSide,this.colorWrite=e.colorWrite,this.precision=e.precision,this.polygonOffset=e.polygonOffset,this.polygonOffsetFactor=e.polygonOffsetFactor,this.polygonOffsetUnits=e.polygonOffsetUnits,this.dithering=e.dithering,this.alphaTest=e.alphaTest,this.alphaHash=e.alphaHash,this.alphaToCoverage=e.alphaToCoverage,this.premultipliedAlpha=e.premultipliedAlpha,this.forceSinglePass=e.forceSinglePass,this.allowOverride=e.allowOverride,this.visible=e.visible,this.toneMapped=e.toneMapped,this.userData=JSON.parse(JSON.stringify(e.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate(e){e===!0&&this.version++}}const Nn=new I,za=new I,Is=new I,ti=new I,Wa=new I,Ds=new I,qa=new I;class rc{constructor(e=new I,t=new I(0,0,-1)){this.origin=e,this.direction=t}set(e,t){return this.origin.copy(e),this.direction.copy(t),this}copy(e){return this.origin.copy(e.origin),this.direction.copy(e.direction),this}at(e,t){return t.copy(this.origin).addScaledVector(this.direction,e)}lookAt(e){return this.direction.copy(e).sub(this.origin).normalize(),this}recast(e){return this.origin.copy(this.at(e,Nn)),this}closestPointToPoint(e,t){t.subVectors(e,this.origin);const n=t.dot(this.direction);return n<0?t.copy(this.origin):t.copy(this.origin).addScaledVector(this.direction,n)}distanceToPoint(e){return Math.sqrt(this.distanceSqToPoint(e))}distanceSqToPoint(e){const t=Nn.subVectors(e,this.origin).dot(this.direction);return t<0?this.origin.distanceToSquared(e):(Nn.copy(this.origin).addScaledVector(this.direction,t),Nn.distanceToSquared(e))}distanceSqToSegment(e,t,n,s){za.copy(e).add(t).multiplyScalar(.5),Is.copy(t).sub(e).normalize(),ti.copy(this.origin).sub(za);const a=e.distanceTo(t)*.5,r=-this.direction.dot(Is),o=ti.dot(this.direction),l=-ti.dot(Is),c=ti.lengthSq(),h=Math.abs(1-r*r);let u,d,p,g;if(h>0)if(u=r*l-o,d=r*o-l,g=a*h,u>=0)if(d>=-g)if(d<=g){const x=1/h;u*=x,d*=x,p=u*(u+r*d+2*o)+d*(r*u+d+2*l)+c}else d=a,u=Math.max(0,-(r*d+o)),p=-u*u+d*(d+2*l)+c;else d=-a,u=Math.max(0,-(r*d+o)),p=-u*u+d*(d+2*l)+c;else d<=-g?(u=Math.max(0,-(-r*a+o)),d=u>0?-a:Math.min(Math.max(-a,-l),a),p=-u*u+d*(d+2*l)+c):d<=g?(u=0,d=Math.min(Math.max(-a,-l),a),p=d*(d+2*l)+c):(u=Math.max(0,-(r*a+o)),d=u>0?a:Math.min(Math.max(-a,-l),a),p=-u*u+d*(d+2*l)+c);else d=r>0?-a:a,u=Math.max(0,-(r*d+o)),p=-u*u+d*(d+2*l)+c;return n&&n.copy(this.origin).addScaledVector(this.direction,u),s&&s.copy(za).addScaledVector(Is,d),p}intersectSphere(e,t){Nn.subVectors(e.center,this.origin);const n=Nn.dot(this.direction),s=Nn.dot(Nn)-n*n,a=e.radius*e.radius;if(s>a)return null;const r=Math.sqrt(a-s),o=n-r,l=n+r;return l<0?null:o<0?this.at(l,t):this.at(o,t)}intersectsSphere(e){return e.radius<0?!1:this.distanceSqToPoint(e.center)<=e.radius*e.radius}distanceToPlane(e){const t=e.normal.dot(this.direction);if(t===0)return e.distanceToPoint(this.origin)===0?0:null;const n=-(this.origin.dot(e.normal)+e.constant)/t;return n>=0?n:null}intersectPlane(e,t){const n=this.distanceToPlane(e);return n===null?null:this.at(n,t)}intersectsPlane(e){const t=e.distanceToPoint(this.origin);return t===0||e.normal.dot(this.direction)*t<0}intersectBox(e,t){let n,s,a,r,o,l;const c=1/this.direction.x,h=1/this.direction.y,u=1/this.direction.z,d=this.origin;return c>=0?(n=(e.min.x-d.x)*c,s=(e.max.x-d.x)*c):(n=(e.max.x-d.x)*c,s=(e.min.x-d.x)*c),h>=0?(a=(e.min.y-d.y)*h,r=(e.max.y-d.y)*h):(a=(e.max.y-d.y)*h,r=(e.min.y-d.y)*h),n>r||a>s||((a>n||isNaN(n))&&(n=a),(r<s||isNaN(s))&&(s=r),u>=0?(o=(e.min.z-d.z)*u,l=(e.max.z-d.z)*u):(o=(e.max.z-d.z)*u,l=(e.min.z-d.z)*u),n>l||o>s)||((o>n||n!==n)&&(n=o),(l<s||s!==s)&&(s=l),s<0)?null:this.at(n>=0?n:s,t)}intersectsBox(e){return this.intersectBox(e,Nn)!==null}intersectTriangle(e,t,n,s,a){Wa.subVectors(t,e),Ds.subVectors(n,e),qa.crossVectors(Wa,Ds);let r=this.direction.dot(qa),o;if(r>0){if(s)return null;o=1}else if(r<0)o=-1,r=-r;else return null;ti.subVectors(this.origin,e);const l=o*this.direction.dot(Ds.crossVectors(ti,Ds));if(l<0)return null;const c=o*this.direction.dot(Wa.cross(ti));if(c<0||l+c>r)return null;const h=-o*ti.dot(qa);return h<0?null:this.at(h/r,a)}applyMatrix4(e){return this.origin.applyMatrix4(e),this.direction.transformDirection(e),this}equals(e){return e.origin.equals(this.origin)&&e.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class oc extends $i{constructor(e){super(),this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new Le(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new oi,this.combine=Bl,this.reflectivity=1,this.refractionRatio=.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.specularMap=e.specularMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.combine=e.combine,this.reflectivity=e.reflectivity,this.refractionRatio=e.refractionRatio,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.fog=e.fog,this}}const Yo=new pt,ui=new rc,Us=new Ji,Ko=new I,ks=new I,Ns=new I,Fs=new I,Xa=new I,Os=new I,Zo=new I,Bs=new I;class Ye extends st{constructor(e=new Pt,t=new oc){super(),this.isMesh=!0,this.type="Mesh",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),e.morphTargetInfluences!==void 0&&(this.morphTargetInfluences=e.morphTargetInfluences.slice()),e.morphTargetDictionary!==void 0&&(this.morphTargetDictionary=Object.assign({},e.morphTargetDictionary)),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let a=0,r=s.length;a<r;a++){const o=s[a].name||String(a);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=a}}}}getVertexPosition(e,t){const n=this.geometry,s=n.attributes.position,a=n.morphAttributes.position,r=n.morphTargetsRelative;t.fromBufferAttribute(s,e);const o=this.morphTargetInfluences;if(a&&o){Os.set(0,0,0);for(let l=0,c=a.length;l<c;l++){const h=o[l],u=a[l];h!==0&&(Xa.fromBufferAttribute(u,e),r?Os.addScaledVector(Xa,h):Os.addScaledVector(Xa.sub(t),h))}t.add(Os)}return t}raycast(e,t){const n=this.geometry,s=this.material,a=this.matrixWorld;s!==void 0&&(n.boundingSphere===null&&n.computeBoundingSphere(),Us.copy(n.boundingSphere),Us.applyMatrix4(a),ui.copy(e.ray).recast(e.near),!(Us.containsPoint(ui.origin)===!1&&(ui.intersectSphere(Us,Ko)===null||ui.origin.distanceToSquared(Ko)>(e.far-e.near)**2))&&(Yo.copy(a).invert(),ui.copy(e.ray).applyMatrix4(Yo),!(n.boundingBox!==null&&ui.intersectsBox(n.boundingBox)===!1)&&this._computeIntersections(e,t,ui)))}_computeIntersections(e,t,n){let s;const a=this.geometry,r=this.material,o=a.index,l=a.attributes.position,c=a.attributes.uv,h=a.attributes.uv1,u=a.attributes.normal,d=a.groups,p=a.drawRange;if(o!==null)if(Array.isArray(r))for(let g=0,x=d.length;g<x;g++){const m=d[g],f=r[m.materialIndex],M=Math.max(m.start,p.start),w=Math.min(o.count,Math.min(m.start+m.count,p.start+p.count));for(let S=M,b=w;S<b;S+=3){const E=o.getX(S),R=o.getX(S+1),v=o.getX(S+2);s=Hs(this,f,e,n,c,h,u,E,R,v),s&&(s.faceIndex=Math.floor(S/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const g=Math.max(0,p.start),x=Math.min(o.count,p.start+p.count);for(let m=g,f=x;m<f;m+=3){const M=o.getX(m),w=o.getX(m+1),S=o.getX(m+2);s=Hs(this,r,e,n,c,h,u,M,w,S),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}else if(l!==void 0)if(Array.isArray(r))for(let g=0,x=d.length;g<x;g++){const m=d[g],f=r[m.materialIndex],M=Math.max(m.start,p.start),w=Math.min(l.count,Math.min(m.start+m.count,p.start+p.count));for(let S=M,b=w;S<b;S+=3){const E=S,R=S+1,v=S+2;s=Hs(this,f,e,n,c,h,u,E,R,v),s&&(s.faceIndex=Math.floor(S/3),s.face.materialIndex=m.materialIndex,t.push(s))}}else{const g=Math.max(0,p.start),x=Math.min(l.count,p.start+p.count);for(let m=g,f=x;m<f;m+=3){const M=m,w=m+1,S=m+2;s=Hs(this,r,e,n,c,h,u,M,w,S),s&&(s.faceIndex=Math.floor(m/3),t.push(s))}}}}function zh(i,e,t,n,s,a,r,o){let l;if(e.side===Jt?l=n.intersectTriangle(r,a,s,!0,o):l=n.intersectTriangle(s,a,r,e.side===ri,o),l===null)return null;Bs.copy(o),Bs.applyMatrix4(i.matrixWorld);const c=t.ray.origin.distanceTo(Bs);return c<t.near||c>t.far?null:{distance:c,point:Bs.clone(),object:i}}function Hs(i,e,t,n,s,a,r,o,l,c){i.getVertexPosition(o,ks),i.getVertexPosition(l,Ns),i.getVertexPosition(c,Fs);const h=zh(i,e,t,n,ks,Ns,Fs,Zo);if(h){const u=new I;gn.getBarycoord(Zo,ks,Ns,Fs,u),s&&(h.uv=gn.getInterpolatedAttribute(s,o,l,c,u,new ze)),a&&(h.uv1=gn.getInterpolatedAttribute(a,o,l,c,u,new ze)),r&&(h.normal=gn.getInterpolatedAttribute(r,o,l,c,u,new I),h.normal.dot(n.direction)>0&&h.normal.multiplyScalar(-1));const d={a:o,b:l,c,normal:new I,materialIndex:0};gn.getNormal(ks,Ns,Fs,d.normal),h.face=d,h.barycoord=u}return h}class Wh extends Vt{constructor(e=null,t=1,n=1,s,a,r,o,l,c=kt,h=kt,u,d){super(null,r,o,l,c,h,s,a,u,d),this.isDataTexture=!0,this.image={data:e,width:t,height:n},this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}const Ya=new I,qh=new I,Xh=new Oe;class mi{constructor(e=new I(1,0,0),t=0){this.isPlane=!0,this.normal=e,this.constant=t}set(e,t){return this.normal.copy(e),this.constant=t,this}setComponents(e,t,n,s){return this.normal.set(e,t,n),this.constant=s,this}setFromNormalAndCoplanarPoint(e,t){return this.normal.copy(e),this.constant=-t.dot(this.normal),this}setFromCoplanarPoints(e,t,n){const s=Ya.subVectors(n,t).cross(qh.subVectors(e,t)).normalize();return this.setFromNormalAndCoplanarPoint(s,e),this}copy(e){return this.normal.copy(e.normal),this.constant=e.constant,this}normalize(){const e=1/this.normal.length();return this.normal.multiplyScalar(e),this.constant*=e,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint(e){return this.normal.dot(e)+this.constant}distanceToSphere(e){return this.distanceToPoint(e.center)-e.radius}projectPoint(e,t){return t.copy(e).addScaledVector(this.normal,-this.distanceToPoint(e))}intersectLine(e,t,n=!0){const s=e.delta(Ya),a=this.normal.dot(s);if(a===0)return this.distanceToPoint(e.start)===0?t.copy(e.start):null;const r=-(e.start.dot(this.normal)+this.constant)/a;return n===!0&&(r<0||r>1)?null:t.copy(e.start).addScaledVector(s,r)}intersectsLine(e){const t=this.distanceToPoint(e.start),n=this.distanceToPoint(e.end);return t<0&&n>0||n<0&&t>0}intersectsBox(e){return e.intersectsPlane(this)}intersectsSphere(e){return e.intersectsPlane(this)}coplanarPoint(e){return e.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4(e,t){const n=t||Xh.getNormalMatrix(e),s=this.coplanarPoint(Ya).applyMatrix4(e),a=this.normal.applyMatrix3(n).normalize();return this.constant=-s.dot(a),this}translate(e){return this.constant-=e.dot(this.normal),this}equals(e){return e.normal.equals(this.normal)&&e.constant===this.constant}clone(){return new this.constructor().copy(this)}}const fi=new Ji,Yh=new ze(.5,.5),Gs=new I;class go{constructor(e=new mi,t=new mi,n=new mi,s=new mi,a=new mi,r=new mi){this.planes=[e,t,n,s,a,r]}set(e,t,n,s,a,r){const o=this.planes;return o[0].copy(e),o[1].copy(t),o[2].copy(n),o[3].copy(s),o[4].copy(a),o[5].copy(r),this}copy(e){const t=this.planes;for(let n=0;n<6;n++)t[n].copy(e.planes[n]);return this}setFromProjectionMatrix(e,t=Rn,n=!1){const s=this.planes,a=e.elements,r=a[0],o=a[1],l=a[2],c=a[3],h=a[4],u=a[5],d=a[6],p=a[7],g=a[8],x=a[9],m=a[10],f=a[11],M=a[12],w=a[13],S=a[14],b=a[15];if(s[0].setComponents(c-r,p-h,f-g,b-M).normalize(),s[1].setComponents(c+r,p+h,f+g,b+M).normalize(),s[2].setComponents(c+o,p+u,f+x,b+w).normalize(),s[3].setComponents(c-o,p-u,f-x,b-w).normalize(),n)s[4].setComponents(l,d,m,S).normalize(),s[5].setComponents(c-l,p-d,f-m,b-S).normalize();else if(s[4].setComponents(c-l,p-d,f-m,b-S).normalize(),t===Rn)s[5].setComponents(c+l,p+d,f+m,b+S).normalize();else if(t===ms)s[5].setComponents(l,d,m,S).normalize();else throw new Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+t);return this}intersectsObject(e){if(e.boundingSphere!==void 0)e.boundingSphere===null&&e.computeBoundingSphere(),fi.copy(e.boundingSphere).applyMatrix4(e.matrixWorld);else{const t=e.geometry;t.boundingSphere===null&&t.computeBoundingSphere(),fi.copy(t.boundingSphere).applyMatrix4(e.matrixWorld)}return this.intersectsSphere(fi)}intersectsSprite(e){fi.center.set(0,0,0);const t=Yh.distanceTo(e.center);return fi.radius=.7071067811865476+t,fi.applyMatrix4(e.matrixWorld),this.intersectsSphere(fi)}intersectsSphere(e){const t=this.planes,n=e.center,s=-e.radius;for(let a=0;a<6;a++)if(t[a].distanceToPoint(n)<s)return!1;return!0}intersectsBox(e){const t=this.planes;for(let n=0;n<6;n++){const s=t[n];if(Gs.x=s.normal.x>0?e.max.x:e.min.x,Gs.y=s.normal.y>0?e.max.y:e.min.y,Gs.z=s.normal.z>0?e.max.z:e.min.z,s.distanceToPoint(Gs)<0)return!1}return!0}containsPoint(e){const t=this.planes;for(let n=0;n<6;n++)if(t[n].distanceToPoint(e)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class Kh extends $i{constructor(e){super(),this.isPointsMaterial=!0,this.type="PointsMaterial",this.color=new Le(16777215),this.map=null,this.alphaMap=null,this.size=1,this.sizeAttenuation=!0,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.color.copy(e.color),this.map=e.map,this.alphaMap=e.alphaMap,this.size=e.size,this.sizeAttenuation=e.sizeAttenuation,this.fog=e.fog,this}}const Jo=new pt,Yr=new rc,Vs=new Ji,zs=new I;class Kr extends st{constructor(e=new Pt,t=new Kh){super(),this.isPoints=!0,this.type="Points",this.geometry=e,this.material=t,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy(e,t){return super.copy(e,t),this.material=Array.isArray(e.material)?e.material.slice():e.material,this.geometry=e.geometry,this}raycast(e,t){const n=this.geometry,s=this.matrixWorld,a=e.params.Points.threshold,r=n.drawRange;if(n.boundingSphere===null&&n.computeBoundingSphere(),Vs.copy(n.boundingSphere),Vs.applyMatrix4(s),Vs.radius+=a,e.ray.intersectsSphere(Vs)===!1)return;Jo.copy(s).invert(),Yr.copy(e.ray).applyMatrix4(Jo);const o=a/((this.scale.x+this.scale.y+this.scale.z)/3),l=o*o,c=n.index,u=n.attributes.position;if(c!==null){const d=Math.max(0,r.start),p=Math.min(c.count,r.start+r.count);for(let g=d,x=p;g<x;g++){const m=c.getX(g);zs.fromBufferAttribute(u,m),$o(zs,m,l,s,e,t,this)}}else{const d=Math.max(0,r.start),p=Math.min(u.count,r.start+r.count);for(let g=d,x=p;g<x;g++)zs.fromBufferAttribute(u,g),$o(zs,g,l,s,e,t,this)}}updateMorphTargets(){const t=this.geometry.morphAttributes,n=Object.keys(t);if(n.length>0){const s=t[n[0]];if(s!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let a=0,r=s.length;a<r;a++){const o=s[a].name||String(a);this.morphTargetInfluences.push(0),this.morphTargetDictionary[o]=a}}}}}function $o(i,e,t,n,s,a,r){const o=Yr.distanceSqToPoint(i);if(o<t){const l=new I;Yr.closestPointToPoint(i,l),l.applyMatrix4(n);const c=s.ray.origin.distanceTo(l);if(c<s.near||c>s.far)return;a.push({distance:c,distanceToRay:Math.sqrt(o),point:l,index:e,face:null,faceIndex:null,barycoord:null,object:r})}}class lc extends Vt{constructor(e=[],t=yi,n,s,a,r,o,l,c,h){super(e,t,n,s,a,r,o,l,c,h),this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images(e){this.image=e}}class Zh extends Vt{constructor(e,t,n,s,a,r,o,l,c){super(e,t,n,s,a,r,o,l,c),this.isCanvasTexture=!0,this.needsUpdate=!0}}class Ki extends Vt{constructor(e,t,n=Ln,s,a,r,o=kt,l=kt,c,h=qn,u=1){if(h!==qn&&h!==xi)throw new Error("THREE.DepthTexture: format must be either THREE.DepthFormat or THREE.DepthStencilFormat");const d={width:e,height:t,depth:u};super(d,s,a,r,o,l,h,n,c),this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy(e){return super.copy(e),this.source=new po(Object.assign({},e.image)),this.compareFunction=e.compareFunction,this}toJSON(e){const t=super.toJSON(e);return this.compareFunction!==null&&(t.compareFunction=this.compareFunction),t}}class Jh extends Ki{constructor(e,t=Ln,n=yi,s,a,r=kt,o=kt,l,c=qn){const h={width:e,height:e,depth:1},u=[h,h,h,h,h,h];super(e,e,t,n,s,a,r,o,l,c),this.image=u,this.isCubeDepthTexture=!0,this.isCubeTexture=!0}get images(){return this.image}set images(e){this.image=e}}class cc extends Vt{constructor(e=null){super(),this.sourceTexture=e,this.isExternalTexture=!0}copy(e){return super.copy(e),this.sourceTexture=e.sourceTexture,this}}class Zt extends Pt{constructor(e=1,t=1,n=1,s=1,a=1,r=1){super(),this.type="BoxGeometry",this.parameters={width:e,height:t,depth:n,widthSegments:s,heightSegments:a,depthSegments:r};const o=this;s=Math.floor(s),a=Math.floor(a),r=Math.floor(r);const l=[],c=[],h=[],u=[];let d=0,p=0;g("z","y","x",-1,-1,n,t,e,r,a,0),g("z","y","x",1,-1,n,t,-e,r,a,1),g("x","z","y",1,1,e,n,t,s,r,2),g("x","z","y",1,-1,e,n,-t,s,r,3),g("x","y","z",1,-1,e,t,n,s,a,4),g("x","y","z",-1,-1,e,t,-n,s,a,5),this.setIndex(l),this.setAttribute("position",new at(c,3)),this.setAttribute("normal",new at(h,3)),this.setAttribute("uv",new at(u,2));function g(x,m,f,M,w,S,b,E,R,v,T){const C=S/R,P=b/v,L=S/2,q=b/2,Z=E/2,N=R+1,X=v+1;let G=0,j=0;const se=new I;for(let pe=0;pe<X;pe++){const re=pe*P-q;for(let Me=0;Me<N;Me++){const Be=Me*C-L;se[x]=Be*M,se[m]=re*w,se[f]=Z,c.push(se.x,se.y,se.z),se[x]=0,se[m]=0,se[f]=E>0?1:-1,h.push(se.x,se.y,se.z),u.push(Me/R),u.push(1-pe/v),G+=1}}for(let pe=0;pe<v;pe++)for(let re=0;re<R;re++){const Me=d+re+N*pe,Be=d+re+N*(pe+1),tt=d+(re+1)+N*(pe+1),qe=d+(re+1)+N*pe;l.push(Me,Be,qe),l.push(Be,tt,qe),j+=6}o.addGroup(p,j,T),p+=j,d+=G}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Zt(e.width,e.height,e.depth,e.widthSegments,e.heightSegments,e.depthSegments)}}class ft extends Pt{constructor(e=1,t=1,n=4,s=8,a=1){super(),this.type="CapsuleGeometry",this.parameters={radius:e,height:t,capSegments:n,radialSegments:s,heightSegments:a},t=Math.max(0,t),n=Math.max(1,Math.floor(n)),s=Math.max(3,Math.floor(s)),a=Math.max(1,Math.floor(a));const r=[],o=[],l=[],c=[],h=t/2,u=Math.PI/2*e,d=t,p=2*u+d,g=n*2+a,x=s+1,m=new I,f=new I;for(let M=0;M<=g;M++){let w=0,S=0,b=0,E=0;if(M<=n){const T=M/n,C=T*Math.PI/2;S=-h-e*Math.cos(C),b=e*Math.sin(C),E=-e*Math.cos(C),w=T*u}else if(M<=n+a){const T=(M-n)/a;S=-h+T*t,b=e,E=0,w=u+T*d}else{const T=(M-n-a)/n,C=T*Math.PI/2;S=h+e*Math.sin(C),b=e*Math.cos(C),E=e*Math.sin(C),w=u+d+T*u}const R=Math.max(0,Math.min(1,w/p));let v=0;M===0?v=.5/s:M===g&&(v=-.5/s);for(let T=0;T<=s;T++){const C=T/s,P=C*Math.PI*2,L=Math.sin(P),q=Math.cos(P);f.x=-b*q,f.y=S,f.z=b*L,o.push(f.x,f.y,f.z),m.set(-b*q,E,b*L),m.normalize(),l.push(m.x,m.y,m.z),c.push(C+v,R)}if(M>0){const T=(M-1)*x;for(let C=0;C<s;C++){const P=T+C,L=T+C+1,q=M*x+C,Z=M*x+C+1;r.push(P,L,q),r.push(L,Z,q)}}}this.setIndex(r),this.setAttribute("position",new at(o,3)),this.setAttribute("normal",new at(l,3)),this.setAttribute("uv",new at(c,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new ft(e.radius,e.height,e.capSegments,e.radialSegments,e.heightSegments)}}class da extends Pt{constructor(e=1,t=32,n=0,s=Math.PI*2){super(),this.type="CircleGeometry",this.parameters={radius:e,segments:t,thetaStart:n,thetaLength:s},t=Math.max(3,t);const a=[],r=[],o=[],l=[],c=new I,h=new ze;r.push(0,0,0),o.push(0,0,1),l.push(.5,.5);for(let u=0,d=3;u<=t;u++,d+=3){const p=n+u/t*s;c.x=e*Math.cos(p),c.y=e*Math.sin(p),r.push(c.x,c.y,c.z),o.push(0,0,1),h.x=(r[d]/e+1)/2,h.y=(r[d+1]/e+1)/2,l.push(h.x,h.y)}for(let u=1;u<=t;u++)a.push(u,u+1,0);this.setIndex(a),this.setAttribute("position",new at(r,3)),this.setAttribute("normal",new at(o,3)),this.setAttribute("uv",new at(l,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new da(e.radius,e.segments,e.thetaStart,e.thetaLength)}}class Ht extends Pt{constructor(e=1,t=1,n=1,s=32,a=1,r=!1,o=0,l=Math.PI*2){super(),this.type="CylinderGeometry",this.parameters={radiusTop:e,radiusBottom:t,height:n,radialSegments:s,heightSegments:a,openEnded:r,thetaStart:o,thetaLength:l};const c=this;s=Math.floor(s),a=Math.floor(a);const h=[],u=[],d=[],p=[];let g=0;const x=[],m=n/2;let f=0;M(),r===!1&&(e>0&&w(!0),t>0&&w(!1)),this.setIndex(h),this.setAttribute("position",new at(u,3)),this.setAttribute("normal",new at(d,3)),this.setAttribute("uv",new at(p,2));function M(){const S=new I,b=new I;let E=0;const R=(t-e)/n;for(let v=0;v<=a;v++){const T=[],C=v/a,P=C*(t-e)+e;for(let L=0;L<=s;L++){const q=L/s,Z=q*l+o,N=Math.sin(Z),X=Math.cos(Z);b.x=P*N,b.y=-C*n+m,b.z=P*X,u.push(b.x,b.y,b.z),S.set(N,R,X).normalize(),d.push(S.x,S.y,S.z),p.push(q,1-C),T.push(g++)}x.push(T)}for(let v=0;v<s;v++)for(let T=0;T<a;T++){const C=x[T][v],P=x[T+1][v],L=x[T+1][v+1],q=x[T][v+1];(e>0||T!==0)&&(h.push(C,P,q),E+=3),(t>0||T!==a-1)&&(h.push(P,L,q),E+=3)}c.addGroup(f,E,0),f+=E}function w(S){const b=g,E=new ze,R=new I;let v=0;const T=S===!0?e:t,C=S===!0?1:-1;for(let L=1;L<=s;L++)u.push(0,m*C,0),d.push(0,C,0),p.push(.5,.5),g++;const P=g;for(let L=0;L<=s;L++){const Z=L/s*l+o,N=Math.cos(Z),X=Math.sin(Z);R.x=T*X,R.y=m*C,R.z=T*N,u.push(R.x,R.y,R.z),d.push(0,C,0),E.x=N*.5+.5,E.y=X*.5*C+.5,p.push(E.x,E.y),g++}for(let L=0;L<s;L++){const q=b+L,Z=P+L;S===!0?h.push(Z,Z+1,q):h.push(Z+1,Z,q),v+=3}c.addGroup(f,v,S===!0?1:2),f+=v}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Ht(e.radiusTop,e.radiusBottom,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class ua extends Ht{constructor(e=1,t=1,n=32,s=1,a=!1,r=0,o=Math.PI*2){super(0,e,t,n,s,a,r,o),this.type="ConeGeometry",this.parameters={radius:e,height:t,radialSegments:n,heightSegments:s,openEnded:a,thetaStart:r,thetaLength:o}}static fromJSON(e){return new ua(e.radius,e.height,e.radialSegments,e.heightSegments,e.openEnded,e.thetaStart,e.thetaLength)}}class xs extends Pt{constructor(e=[],t=[],n=1,s=0){super(),this.type="PolyhedronGeometry",this.parameters={vertices:e,indices:t,radius:n,detail:s};const a=[],r=[];o(s),c(n),h(),this.setAttribute("position",new at(a,3)),this.setAttribute("normal",new at(a.slice(),3)),this.setAttribute("uv",new at(r,2)),s===0?this.computeVertexNormals():this.normalizeNormals();function o(M){const w=new I,S=new I,b=new I;for(let E=0;E<t.length;E+=3)p(t[E+0],w),p(t[E+1],S),p(t[E+2],b),l(w,S,b,M)}function l(M,w,S,b){const E=b+1,R=[];for(let v=0;v<=E;v++){R[v]=[];const T=M.clone().lerp(S,v/E),C=w.clone().lerp(S,v/E),P=E-v;for(let L=0;L<=P;L++)L===0&&v===E?R[v][L]=T:R[v][L]=T.clone().lerp(C,L/P)}for(let v=0;v<E;v++)for(let T=0;T<2*(E-v)-1;T++){const C=Math.floor(T/2);T%2===0?(d(R[v][C+1]),d(R[v+1][C]),d(R[v][C])):(d(R[v][C+1]),d(R[v+1][C+1]),d(R[v+1][C]))}}function c(M){const w=new I;for(let S=0;S<a.length;S+=3)w.x=a[S+0],w.y=a[S+1],w.z=a[S+2],w.normalize().multiplyScalar(M),a[S+0]=w.x,a[S+1]=w.y,a[S+2]=w.z}function h(){const M=new I;for(let w=0;w<a.length;w+=3){M.x=a[w+0],M.y=a[w+1],M.z=a[w+2];const S=m(M)/2/Math.PI+.5,b=f(M)/Math.PI+.5;r.push(S,1-b)}g(),u()}function u(){for(let M=0;M<r.length;M+=6){const w=r[M+0],S=r[M+2],b=r[M+4],E=Math.max(w,S,b),R=Math.min(w,S,b);E>.9&&R<.1&&(w<.2&&(r[M+0]+=1),S<.2&&(r[M+2]+=1),b<.2&&(r[M+4]+=1))}}function d(M){a.push(M.x,M.y,M.z)}function p(M,w){const S=M*3;w.x=e[S+0],w.y=e[S+1],w.z=e[S+2]}function g(){const M=new I,w=new I,S=new I,b=new I,E=new ze,R=new ze,v=new ze;for(let T=0,C=0;T<a.length;T+=9,C+=6){M.set(a[T+0],a[T+1],a[T+2]),w.set(a[T+3],a[T+4],a[T+5]),S.set(a[T+6],a[T+7],a[T+8]),E.set(r[C+0],r[C+1]),R.set(r[C+2],r[C+3]),v.set(r[C+4],r[C+5]),b.copy(M).add(w).add(S).divideScalar(3);const P=m(b);x(E,C+0,M,P),x(R,C+2,w,P),x(v,C+4,S,P)}}function x(M,w,S,b){b<0&&M.x===1&&(r[w]=M.x-1),S.x===0&&S.z===0&&(r[w]=b/2/Math.PI+.5)}function m(M){return Math.atan2(M.z,-M.x)}function f(M){return Math.atan2(-M.y,Math.sqrt(M.x*M.x+M.z*M.z))}}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new xs(e.vertices,e.indices,e.radius,e.detail)}}class _o extends xs{constructor(e=1,t=0){const n=(1+Math.sqrt(5))/2,s=1/n,a=[-1,-1,-1,-1,-1,1,-1,1,-1,-1,1,1,1,-1,-1,1,-1,1,1,1,-1,1,1,1,0,-s,-n,0,-s,n,0,s,-n,0,s,n,-s,-n,0,-s,n,0,s,-n,0,s,n,0,-n,0,-s,n,0,-s,-n,0,s,n,0,s],r=[3,11,7,3,7,15,3,15,13,7,19,17,7,17,6,7,6,15,17,4,8,17,8,10,17,10,6,8,0,16,8,16,2,8,2,10,0,12,1,0,1,18,0,18,16,6,10,2,6,2,13,6,13,15,2,16,18,2,18,3,2,3,13,18,1,9,18,9,11,18,11,3,4,14,12,4,12,0,4,0,8,11,9,5,11,5,19,11,19,7,19,5,14,19,14,4,19,4,17,1,12,14,1,14,5,1,5,9];super(a,r,e,t),this.type="DodecahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new _o(e.radius,e.detail)}}class Qi extends xs{constructor(e=1,t=0){const n=(1+Math.sqrt(5))/2,s=[-1,n,0,1,n,0,-1,-n,0,1,-n,0,0,-1,n,0,1,n,0,-1,-n,0,1,-n,n,0,-1,n,0,1,-n,0,-1,-n,0,1],a=[0,11,5,0,5,1,0,1,7,0,7,10,0,10,11,1,5,9,5,11,4,11,10,2,10,7,6,7,1,8,3,9,4,3,4,2,3,2,6,3,6,8,3,8,9,4,9,5,2,4,11,6,2,10,8,6,7,9,8,1];super(s,a,e,t),this.type="IcosahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new Qi(e.radius,e.detail)}}class _t extends Pt{constructor(e=1,t=1,n=1,s=1){super(),this.type="PlaneGeometry",this.parameters={width:e,height:t,widthSegments:n,heightSegments:s};const a=e/2,r=t/2,o=Math.floor(n),l=Math.floor(s),c=o+1,h=l+1,u=e/o,d=t/l,p=[],g=[],x=[],m=[];for(let f=0;f<h;f++){const M=f*d-r;for(let w=0;w<c;w++){const S=w*u-a;g.push(S,-M,0),x.push(0,0,1),m.push(w/o),m.push(1-f/l)}}for(let f=0;f<l;f++)for(let M=0;M<o;M++){const w=M+c*f,S=M+c*(f+1),b=M+1+c*(f+1),E=M+1+c*f;p.push(w,S,E),p.push(S,b,E)}this.setIndex(p),this.setAttribute("position",new at(g,3)),this.setAttribute("normal",new at(x,3)),this.setAttribute("uv",new at(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new _t(e.width,e.height,e.widthSegments,e.heightSegments)}}class vo extends Pt{constructor(e=.5,t=1,n=32,s=1,a=0,r=Math.PI*2){super(),this.type="RingGeometry",this.parameters={innerRadius:e,outerRadius:t,thetaSegments:n,phiSegments:s,thetaStart:a,thetaLength:r},n=Math.max(3,n),s=Math.max(1,s);const o=[],l=[],c=[],h=[];let u=e;const d=(t-e)/s,p=new I,g=new ze;for(let x=0;x<=s;x++){for(let m=0;m<=n;m++){const f=a+m/n*r;p.x=u*Math.cos(f),p.y=u*Math.sin(f),l.push(p.x,p.y,p.z),c.push(0,0,1),g.x=(p.x/t+1)/2,g.y=(p.y/t+1)/2,h.push(g.x,g.y)}u+=d}for(let x=0;x<s;x++){const m=x*(n+1);for(let f=0;f<n;f++){const M=f+m,w=M,S=M+n+1,b=M+n+2,E=M+1;o.push(w,S,E),o.push(S,b,E)}}this.setIndex(o),this.setAttribute("position",new at(l,3)),this.setAttribute("normal",new at(c,3)),this.setAttribute("uv",new at(h,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new vo(e.innerRadius,e.outerRadius,e.thetaSegments,e.phiSegments,e.thetaStart,e.thetaLength)}}class si extends Pt{constructor(e=1,t=32,n=16,s=0,a=Math.PI*2,r=0,o=Math.PI){super(),this.type="SphereGeometry",this.parameters={radius:e,widthSegments:t,heightSegments:n,phiStart:s,phiLength:a,thetaStart:r,thetaLength:o},t=Math.max(3,Math.floor(t)),n=Math.max(2,Math.floor(n));const l=Math.min(r+o,Math.PI);let c=0;const h=[],u=new I,d=new I,p=[],g=[],x=[],m=[];for(let f=0;f<=n;f++){const M=[],w=f/n,S=r+w*o,b=e*Math.cos(S),E=Math.sqrt(e*e-b*b);let R=0;f===0&&r===0?R=.5/t:f===n&&l===Math.PI&&(R=-.5/t);for(let v=0;v<=t;v++){const T=v/t,C=s+T*a;u.x=-E*Math.cos(C),u.y=b,u.z=E*Math.sin(C),g.push(u.x,u.y,u.z),d.copy(u).normalize(),x.push(d.x,d.y,d.z),m.push(T+R,1-w),M.push(c++)}h.push(M)}for(let f=0;f<n;f++)for(let M=0;M<t;M++){const w=h[f][M+1],S=h[f][M],b=h[f+1][M],E=h[f+1][M+1];(f!==0||r>0)&&p.push(w,S,E),(f!==n-1||l<Math.PI)&&p.push(S,b,E)}this.setIndex(p),this.setAttribute("position",new at(g,3)),this.setAttribute("normal",new at(x,3)),this.setAttribute("uv",new at(m,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new si(e.radius,e.widthSegments,e.heightSegments,e.phiStart,e.phiLength,e.thetaStart,e.thetaLength)}}class xo extends xs{constructor(e=1,t=0){const n=[1,1,1,-1,-1,1,-1,1,-1,1,-1,-1],s=[2,1,0,0,3,2,1,3,0,2,3,1];super(n,s,e,t),this.type="TetrahedronGeometry",this.parameters={radius:e,detail:t}}static fromJSON(e){return new xo(e.radius,e.detail)}}class Si extends Pt{constructor(e=1,t=.4,n=12,s=48,a=Math.PI*2,r=0,o=Math.PI*2){super(),this.type="TorusGeometry",this.parameters={radius:e,tube:t,radialSegments:n,tubularSegments:s,arc:a,thetaStart:r,thetaLength:o},n=Math.floor(n),s=Math.floor(s);const l=[],c=[],h=[],u=[],d=new I,p=new I,g=new I;for(let x=0;x<=n;x++){const m=r+x/n*o;for(let f=0;f<=s;f++){const M=f/s*a;p.x=(e+t*Math.cos(m))*Math.cos(M),p.y=(e+t*Math.cos(m))*Math.sin(M),p.z=t*Math.sin(m),c.push(p.x,p.y,p.z),d.x=e*Math.cos(M),d.y=e*Math.sin(M),g.subVectors(p,d).normalize(),h.push(g.x,g.y,g.z),u.push(f/s),u.push(x/n)}}for(let x=1;x<=n;x++)for(let m=1;m<=s;m++){const f=(s+1)*x+m-1,M=(s+1)*(x-1)+m-1,w=(s+1)*(x-1)+m,S=(s+1)*x+m;l.push(f,M,S),l.push(M,w,S)}this.setIndex(l),this.setAttribute("position",new at(c,3)),this.setAttribute("normal",new at(h,3)),this.setAttribute("uv",new at(u,2))}copy(e){return super.copy(e),this.parameters=Object.assign({},e.parameters),this}static fromJSON(e){return new Si(e.radius,e.tube,e.radialSegments,e.tubularSegments,e.arc)}}function Zi(i){const e={};for(const t in i){e[t]={};for(const n in i[t]){const s=i[t][n];if(Qo(s))s.isRenderTargetTexture?(Fe("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),e[t][n]=null):e[t][n]=s.clone();else if(Array.isArray(s))if(Qo(s[0])){const a=[];for(let r=0,o=s.length;r<o;r++)a[r]=s[r].clone();e[t][n]=a}else e[t][n]=s.slice();else e[t][n]=s}}return e}function zt(i){const e={};for(let t=0;t<i.length;t++){const n=Zi(i[t]);for(const s in n)e[s]=n[s]}return e}function Qo(i){return i&&(i.isColor||i.isMatrix3||i.isMatrix4||i.isVector2||i.isVector3||i.isVector4||i.isTexture||i.isQuaternion)}function $h(i){const e=[];for(let t=0;t<i.length;t++)e.push(i[t].clone());return e}function hc(i){const e=i.getRenderTarget();return e===null?i.outputColorSpace:e.isXRRenderTarget===!0?e.texture.colorSpace:Je.workingColorSpace}const Qh={clone:Zi,merge:zt};var jh=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,ed=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class $t extends $i{constructor(e){super(),this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=jh,this.fragmentShader=ed,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,e!==void 0&&this.setValues(e)}copy(e){return super.copy(e),this.fragmentShader=e.fragmentShader,this.vertexShader=e.vertexShader,this.uniforms=Zi(e.uniforms),this.uniformsGroups=$h(e.uniformsGroups),this.defines=Object.assign({},e.defines),this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.fog=e.fog,this.lights=e.lights,this.clipping=e.clipping,this.extensions=Object.assign({},e.extensions),this.glslVersion=e.glslVersion,this.defaultAttributeValues=Object.assign({},e.defaultAttributeValues),this.index0AttributeName=e.index0AttributeName,this.uniformsNeedUpdate=e.uniformsNeedUpdate,this}toJSON(e){const t=super.toJSON(e);t.glslVersion=this.glslVersion,t.uniforms={};for(const s in this.uniforms){const r=this.uniforms[s].value;r&&r.isTexture?t.uniforms[s]={type:"t",value:r.toJSON(e).uuid}:r&&r.isColor?t.uniforms[s]={type:"c",value:r.getHex()}:r&&r.isVector2?t.uniforms[s]={type:"v2",value:r.toArray()}:r&&r.isVector3?t.uniforms[s]={type:"v3",value:r.toArray()}:r&&r.isVector4?t.uniforms[s]={type:"v4",value:r.toArray()}:r&&r.isMatrix3?t.uniforms[s]={type:"m3",value:r.toArray()}:r&&r.isMatrix4?t.uniforms[s]={type:"m4",value:r.toArray()}:t.uniforms[s]={value:r}}Object.keys(this.defines).length>0&&(t.defines=this.defines),t.vertexShader=this.vertexShader,t.fragmentShader=this.fragmentShader,t.lights=this.lights,t.clipping=this.clipping;const n={};for(const s in this.extensions)this.extensions[s]===!0&&(n[s]=!0);return Object.keys(n).length>0&&(t.extensions=n),t}fromJSON(e,t){if(super.fromJSON(e,t),e.uniforms!==void 0)for(const n in e.uniforms){const s=e.uniforms[n];switch(this.uniforms[n]={},s.type){case"t":this.uniforms[n].value=t[s.value]||null;break;case"c":this.uniforms[n].value=new Le().setHex(s.value);break;case"v2":this.uniforms[n].value=new ze().fromArray(s.value);break;case"v3":this.uniforms[n].value=new I().fromArray(s.value);break;case"v4":this.uniforms[n].value=new xt().fromArray(s.value);break;case"m3":this.uniforms[n].value=new Oe().fromArray(s.value);break;case"m4":this.uniforms[n].value=new pt().fromArray(s.value);break;default:this.uniforms[n].value=s.value}}if(e.defines!==void 0&&(this.defines=e.defines),e.vertexShader!==void 0&&(this.vertexShader=e.vertexShader),e.fragmentShader!==void 0&&(this.fragmentShader=e.fragmentShader),e.glslVersion!==void 0&&(this.glslVersion=e.glslVersion),e.extensions!==void 0)for(const n in e.extensions)this.extensions[n]=e.extensions[n];return e.lights!==void 0&&(this.lights=e.lights),e.clipping!==void 0&&(this.clipping=e.clipping),this}}class td extends $t{constructor(e){super(e),this.isRawShaderMaterial=!0,this.type="RawShaderMaterial"}}class Et extends $i{constructor(e){super(),this.isMeshStandardMaterial=!0,this.type="MeshStandardMaterial",this.defines={STANDARD:""},this.color=new Le(16777215),this.roughness=1,this.metalness=0,this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.emissive=new Le(0),this.emissiveIntensity=1,this.emissiveMap=null,this.bumpMap=null,this.bumpScale=1,this.normalMap=null,this.normalMapType=qr,this.normalScale=new ze(1,1),this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.roughnessMap=null,this.metalnessMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new oi,this.envMapIntensity=1,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.flatShading=!1,this.fog=!0,this.setValues(e)}copy(e){return super.copy(e),this.defines={STANDARD:""},this.color.copy(e.color),this.roughness=e.roughness,this.metalness=e.metalness,this.map=e.map,this.lightMap=e.lightMap,this.lightMapIntensity=e.lightMapIntensity,this.aoMap=e.aoMap,this.aoMapIntensity=e.aoMapIntensity,this.emissive.copy(e.emissive),this.emissiveMap=e.emissiveMap,this.emissiveIntensity=e.emissiveIntensity,this.bumpMap=e.bumpMap,this.bumpScale=e.bumpScale,this.normalMap=e.normalMap,this.normalMapType=e.normalMapType,this.normalScale.copy(e.normalScale),this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.roughnessMap=e.roughnessMap,this.metalnessMap=e.metalnessMap,this.alphaMap=e.alphaMap,this.envMap=e.envMap,this.envMapRotation.copy(e.envMapRotation),this.envMapIntensity=e.envMapIntensity,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this.wireframeLinecap=e.wireframeLinecap,this.wireframeLinejoin=e.wireframeLinejoin,this.flatShading=e.flatShading,this.fog=e.fog,this}}class nd extends $i{constructor(e){super(),this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=uh,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues(e)}copy(e){return super.copy(e),this.depthPacking=e.depthPacking,this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this.wireframe=e.wireframe,this.wireframeLinewidth=e.wireframeLinewidth,this}}class id extends $i{constructor(e){super(),this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues(e)}copy(e){return super.copy(e),this.map=e.map,this.alphaMap=e.alphaMap,this.displacementMap=e.displacementMap,this.displacementScale=e.displacementScale,this.displacementBias=e.displacementBias,this}}class ga extends st{constructor(e,t=1){super(),this.isLight=!0,this.type="Light",this.color=new Le(e),this.intensity=t}dispose(){this.dispatchEvent({type:"dispose"})}copy(e,t){return super.copy(e,t),this.color.copy(e.color),this.intensity=e.intensity,this}toJSON(e){const t=super.toJSON(e);return t.object.color=this.color.getHex(),t.object.intensity=this.intensity,t}}class sd extends ga{constructor(e,t,n){super(e,n),this.isHemisphereLight=!0,this.type="HemisphereLight",this.position.copy(st.DEFAULT_UP),this.updateMatrix(),this.groundColor=new Le(t)}copy(e,t){return super.copy(e,t),this.groundColor.copy(e.groundColor),this}toJSON(e){const t=super.toJSON(e);return t.object.groundColor=this.groundColor.getHex(),t}}const Ka=new pt,jo=new I,el=new I;class dc{constructor(e){this.camera=e,this.intensity=1,this.bias=0,this.biasNode=null,this.normalBias=0,this.radius=1,this.blurSamples=8,this.mapSize=new ze(512,512),this.mapType=on,this.map=null,this.mapPass=null,this.matrix=new pt,this.autoUpdate=!0,this.needsUpdate=!1,this._frustum=new go,this._frameExtents=new ze(1,1),this._viewportCount=1,this._viewports=[new xt(0,0,1,1)]}getViewportCount(){return this._viewportCount}getFrustum(){return this._frustum}updateMatrices(e){const t=this.camera,n=this.matrix;jo.setFromMatrixPosition(e.matrixWorld),t.position.copy(jo),el.setFromMatrixPosition(e.target.matrixWorld),t.lookAt(el),t.updateMatrixWorld(),Ka.multiplyMatrices(t.projectionMatrix,t.matrixWorldInverse),this._frustum.setFromProjectionMatrix(Ka,t.coordinateSystem,t.reversedDepth),t.coordinateSystem===ms||t.reversedDepth?n.set(.5,0,0,.5,0,.5,0,.5,0,0,1,0,0,0,0,1):n.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1),n.multiply(Ka)}getViewport(e){return this._viewports[e]}getFrameExtents(){return this._frameExtents}dispose(){this.map&&this.map.dispose(),this.mapPass&&this.mapPass.dispose()}copy(e){return this.camera=e.camera.clone(),this.intensity=e.intensity,this.bias=e.bias,this.radius=e.radius,this.autoUpdate=e.autoUpdate,this.needsUpdate=e.needsUpdate,this.normalBias=e.normalBias,this.blurSamples=e.blurSamples,this.mapSize.copy(e.mapSize),this.biasNode=e.biasNode,this}clone(){return new this.constructor().copy(this)}toJSON(){const e={};return this.intensity!==1&&(e.intensity=this.intensity),this.bias!==0&&(e.bias=this.bias),this.normalBias!==0&&(e.normalBias=this.normalBias),this.radius!==1&&(e.radius=this.radius),(this.mapSize.x!==512||this.mapSize.y!==512)&&(e.mapSize=this.mapSize.toArray()),e.camera=this.camera.toJSON(!1).object,delete e.camera.matrix,e}}const Ws=new I,qs=new wi,yn=new I;class uc extends st{constructor(){super(),this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new pt,this.projectionMatrix=new pt,this.projectionMatrixInverse=new pt,this.coordinateSystem=Rn,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy(e,t){return super.copy(e,t),this.matrixWorldInverse.copy(e.matrixWorldInverse),this.projectionMatrix.copy(e.projectionMatrix),this.projectionMatrixInverse.copy(e.projectionMatrixInverse),this.coordinateSystem=e.coordinateSystem,this}getWorldDirection(e){return super.getWorldDirection(e).negate()}updateMatrixWorld(e){super.updateMatrixWorld(e),this.matrixWorld.decompose(Ws,qs,yn),yn.x===1&&yn.y===1&&yn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ws,qs,yn.set(1,1,1)).invert()}updateWorldMatrix(e,t,n=!1){super.updateWorldMatrix(e,t,n),this.matrixWorld.decompose(Ws,qs,yn),yn.x===1&&yn.y===1&&yn.z===1?this.matrixWorldInverse.copy(this.matrixWorld).invert():this.matrixWorldInverse.compose(Ws,qs,yn.set(1,1,1)).invert()}clone(){return new this.constructor().copy(this)}}const ni=new I,tl=new ze,nl=new ze;class rn extends uc{constructor(e=50,t=1,n=.1,s=2e3){super(),this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=e,this.zoom=1,this.near=n,this.far=s,this.focus=10,this.aspect=t,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.fov=e.fov,this.zoom=e.zoom,this.near=e.near,this.far=e.far,this.focus=e.focus,this.aspect=e.aspect,this.view=e.view===null?null:Object.assign({},e.view),this.filmGauge=e.filmGauge,this.filmOffset=e.filmOffset,this}setFocalLength(e){const t=.5*this.getFilmHeight()/e;this.fov=Xr*2*Math.atan(t),this.updateProjectionMatrix()}getFocalLength(){const e=Math.tan(Ea*.5*this.fov);return .5*this.getFilmHeight()/e}getEffectiveFOV(){return Xr*2*Math.atan(Math.tan(Ea*.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds(e,t,n){ni.set(-1,-1,.5).applyMatrix4(this.projectionMatrixInverse),t.set(ni.x,ni.y).multiplyScalar(-e/ni.z),ni.set(1,1,.5).applyMatrix4(this.projectionMatrixInverse),n.set(ni.x,ni.y).multiplyScalar(-e/ni.z)}getViewSize(e,t){return this.getViewBounds(e,tl,nl),t.subVectors(nl,tl)}setViewOffset(e,t,n,s,a,r){this.aspect=e/t,this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=a,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=this.near;let t=e*Math.tan(Ea*.5*this.fov)/this.zoom,n=2*t,s=this.aspect*n,a=-.5*s;const r=this.view;if(this.view!==null&&this.view.enabled){const l=r.fullWidth,c=r.fullHeight;a+=r.offsetX*s/l,t-=r.offsetY*n/c,s*=r.width/l,n*=r.height/c}const o=this.filmOffset;o!==0&&(a+=e*o/this.getFilmWidth()),this.projectionMatrix.makePerspective(a,a+s,t,t-n,e,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.fov=this.fov,t.object.zoom=this.zoom,t.object.near=this.near,t.object.far=this.far,t.object.focus=this.focus,t.object.aspect=this.aspect,this.view!==null&&(t.object.view=Object.assign({},this.view)),t.object.filmGauge=this.filmGauge,t.object.filmOffset=this.filmOffset,t}}class ad extends dc{constructor(){super(new rn(90,1,.5,500)),this.isPointLightShadow=!0}}class rd extends ga{constructor(e,t,n=0,s=2){super(e,t),this.isPointLight=!0,this.type="PointLight",this.distance=n,this.decay=s,this.shadow=new ad}get power(){return this.intensity*4*Math.PI}set power(e){this.intensity=e/(4*Math.PI)}dispose(){super.dispose(),this.shadow.dispose()}copy(e,t){return super.copy(e,t),this.distance=e.distance,this.decay=e.decay,this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.distance=this.distance,t.object.decay=this.decay,t.object.shadow=this.shadow.toJSON(),t}}class Mo extends uc{constructor(e=-1,t=1,n=1,s=-1,a=.1,r=2e3){super(),this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=e,this.right=t,this.top=n,this.bottom=s,this.near=a,this.far=r,this.updateProjectionMatrix()}copy(e,t){return super.copy(e,t),this.left=e.left,this.right=e.right,this.top=e.top,this.bottom=e.bottom,this.near=e.near,this.far=e.far,this.zoom=e.zoom,this.view=e.view===null?null:Object.assign({},e.view),this}setViewOffset(e,t,n,s,a,r){this.view===null&&(this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1}),this.view.enabled=!0,this.view.fullWidth=e,this.view.fullHeight=t,this.view.offsetX=n,this.view.offsetY=s,this.view.width=a,this.view.height=r,this.updateProjectionMatrix()}clearViewOffset(){this.view!==null&&(this.view.enabled=!1),this.updateProjectionMatrix()}updateProjectionMatrix(){const e=(this.right-this.left)/(2*this.zoom),t=(this.top-this.bottom)/(2*this.zoom),n=(this.right+this.left)/2,s=(this.top+this.bottom)/2;let a=n-e,r=n+e,o=s+t,l=s-t;if(this.view!==null&&this.view.enabled){const c=(this.right-this.left)/this.view.fullWidth/this.zoom,h=(this.top-this.bottom)/this.view.fullHeight/this.zoom;a+=c*this.view.offsetX,r=a+c*this.view.width,o-=h*this.view.offsetY,l=o-h*this.view.height}this.projectionMatrix.makeOrthographic(a,r,o,l,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON(e){const t=super.toJSON(e);return t.object.zoom=this.zoom,t.object.left=this.left,t.object.right=this.right,t.object.top=this.top,t.object.bottom=this.bottom,t.object.near=this.near,t.object.far=this.far,this.view!==null&&(t.object.view=Object.assign({},this.view)),t}}class od extends dc{constructor(){super(new Mo(-5,5,5,-5,.5,500)),this.isDirectionalLightShadow=!0}}class hs extends ga{constructor(e,t){super(e,t),this.isDirectionalLight=!0,this.type="DirectionalLight",this.position.copy(st.DEFAULT_UP),this.updateMatrix(),this.target=new st,this.shadow=new od}dispose(){super.dispose(),this.shadow.dispose()}copy(e){return super.copy(e),this.target=e.target.clone(),this.shadow=e.shadow.clone(),this}toJSON(e){const t=super.toJSON(e);return t.object.shadow=this.shadow.toJSON(),t.object.target=this.target.uuid,t}}class fc extends ga{constructor(e,t){super(e,t),this.isAmbientLight=!0,this.type="AmbientLight"}}const Hi=-90,Gi=1;class ld extends st{constructor(e,t,n){super(),this.type="CubeCamera",this.renderTarget=n,this.coordinateSystem=null,this.activeMipmapLevel=0;const s=new rn(Hi,Gi,e,t);s.layers=this.layers,this.add(s);const a=new rn(Hi,Gi,e,t);a.layers=this.layers,this.add(a);const r=new rn(Hi,Gi,e,t);r.layers=this.layers,this.add(r);const o=new rn(Hi,Gi,e,t);o.layers=this.layers,this.add(o);const l=new rn(Hi,Gi,e,t);l.layers=this.layers,this.add(l);const c=new rn(Hi,Gi,e,t);c.layers=this.layers,this.add(c)}updateCoordinateSystem(){const e=this.coordinateSystem,t=this.children.concat(),[n,s,a,r,o,l]=t;for(const c of t)this.remove(c);if(e===Rn)n.up.set(0,1,0),n.lookAt(1,0,0),s.up.set(0,1,0),s.lookAt(-1,0,0),a.up.set(0,0,-1),a.lookAt(0,1,0),r.up.set(0,0,1),r.lookAt(0,-1,0),o.up.set(0,1,0),o.lookAt(0,0,1),l.up.set(0,1,0),l.lookAt(0,0,-1);else if(e===ms)n.up.set(0,-1,0),n.lookAt(-1,0,0),s.up.set(0,-1,0),s.lookAt(1,0,0),a.up.set(0,0,1),a.lookAt(0,1,0),r.up.set(0,0,-1),r.lookAt(0,-1,0),o.up.set(0,-1,0),o.lookAt(0,0,1),l.up.set(0,-1,0),l.lookAt(0,0,-1);else throw new Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+e);for(const c of t)this.add(c),c.updateMatrixWorld()}update(e,t){this.parent===null&&this.updateMatrixWorld();const{renderTarget:n,activeMipmapLevel:s}=this;this.coordinateSystem!==e.coordinateSystem&&(this.coordinateSystem=e.coordinateSystem,this.updateCoordinateSystem());const[a,r,o,l,c,h]=this.children,u=e.getRenderTarget(),d=e.getActiveCubeFace(),p=e.getActiveMipmapLevel(),g=e.xr.enabled;e.xr.enabled=!1;const x=n.texture.generateMipmaps;n.texture.generateMipmaps=!1;let m=!1;e.isWebGLRenderer===!0?m=e.state.buffers.depth.getReversed():m=e.reversedDepthBuffer,e.setRenderTarget(n,0,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,a),e.setRenderTarget(n,1,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,r),e.setRenderTarget(n,2,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,o),e.setRenderTarget(n,3,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,l),e.setRenderTarget(n,4,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,c),n.texture.generateMipmaps=x,e.setRenderTarget(n,5,s),m&&e.autoClear===!1&&e.clearDepth(),e.render(t,h),e.setRenderTarget(u,d,p),e.xr.enabled=g,n.texture.needsPMREMUpdate=!0}}class cd extends rn{constructor(e=[]){super(),this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=e}}class pc{static{pc.prototype.isMatrix2=!0}constructor(e,t,n,s){this.elements=[1,0,0,1],e!==void 0&&this.set(e,t,n,s)}identity(){return this.set(1,0,0,1),this}fromArray(e,t=0){for(let n=0;n<4;n++)this.elements[n]=e[n+t];return this}set(e,t,n,s){const a=this.elements;return a[0]=e,a[2]=t,a[1]=n,a[3]=s,this}}function il(i,e,t,n){const s=hd(n);switch(t){case $l:return i*e;case jl:return i*e/s.components*s.byteLength;case lo:return i*e/s.components*s.byteLength;case Ei:return i*e*2/s.components*s.byteLength;case co:return i*e*2/s.components*s.byteLength;case Ql:return i*e*3/s.components*s.byteLength;case _n:return i*e*4/s.components*s.byteLength;case ho:return i*e*4/s.components*s.byteLength;case Qs:case js:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case ea:case ta:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case gr:case vr:return Math.max(i,16)*Math.max(e,8)/4;case mr:case _r:return Math.max(i,8)*Math.max(e,8)/2;case xr:case Mr:case br:case yr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*8;case Sr:case ra:case Er:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case Tr:return Math.floor((i+3)/4)*Math.floor((e+3)/4)*16;case wr:return Math.floor((i+4)/5)*Math.floor((e+3)/4)*16;case Ar:return Math.floor((i+4)/5)*Math.floor((e+4)/5)*16;case Rr:return Math.floor((i+5)/6)*Math.floor((e+4)/5)*16;case Cr:return Math.floor((i+5)/6)*Math.floor((e+5)/6)*16;case Pr:return Math.floor((i+7)/8)*Math.floor((e+4)/5)*16;case Lr:return Math.floor((i+7)/8)*Math.floor((e+5)/6)*16;case Ir:return Math.floor((i+7)/8)*Math.floor((e+7)/8)*16;case Dr:return Math.floor((i+9)/10)*Math.floor((e+4)/5)*16;case Ur:return Math.floor((i+9)/10)*Math.floor((e+5)/6)*16;case kr:return Math.floor((i+9)/10)*Math.floor((e+7)/8)*16;case Nr:return Math.floor((i+9)/10)*Math.floor((e+9)/10)*16;case Fr:return Math.floor((i+11)/12)*Math.floor((e+9)/10)*16;case Or:return Math.floor((i+11)/12)*Math.floor((e+11)/12)*16;case Br:case Hr:case Gr:return Math.ceil(i/4)*Math.ceil(e/4)*16;case Vr:case zr:return Math.ceil(i/4)*Math.ceil(e/4)*8;case oa:case Wr:return Math.ceil(i/4)*Math.ceil(e/4)*16}throw new Error(`Unable to determine texture byte length for ${t} format.`)}function hd(i){switch(i){case on:case Yl:return{byteLength:1,components:1};case fs:case Kl:case Wn:return{byteLength:2,components:1};case ro:case oo:return{byteLength:2,components:4};case Ln:case ao:case An:return{byteLength:4,components:1};case Zl:case Jl:return{byteLength:4,components:3}}throw new Error(`THREE.TextureUtils: Unknown texture type ${i}.`)}typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:io}}));typeof window<"u"&&(window.__THREE__?Fe("WARNING: Multiple instances of Three.js being imported."):window.__THREE__=io);/**
 * @license
 * Copyright 2010-2026 Three.js Authors
 * SPDX-License-Identifier: MIT
 */function mc(){let i=null,e=!1,t=null,n=null;function s(a,r){t(a,r),n=i.requestAnimationFrame(s)}return{start:function(){e!==!0&&t!==null&&i!==null&&(n=i.requestAnimationFrame(s),e=!0)},stop:function(){i!==null&&i.cancelAnimationFrame(n),e=!1},setAnimationLoop:function(a){t=a},setContext:function(a){i=a}}}function dd(i){const e=new WeakMap;function t(o,l){const c=o.array,h=o.usage,u=c.byteLength,d=i.createBuffer();i.bindBuffer(l,d),i.bufferData(l,c,h),o.onUploadCallback();let p;if(c instanceof Float32Array)p=i.FLOAT;else if(typeof Float16Array<"u"&&c instanceof Float16Array)p=i.HALF_FLOAT;else if(c instanceof Uint16Array)o.isFloat16BufferAttribute?p=i.HALF_FLOAT:p=i.UNSIGNED_SHORT;else if(c instanceof Int16Array)p=i.SHORT;else if(c instanceof Uint32Array)p=i.UNSIGNED_INT;else if(c instanceof Int32Array)p=i.INT;else if(c instanceof Int8Array)p=i.BYTE;else if(c instanceof Uint8Array)p=i.UNSIGNED_BYTE;else if(c instanceof Uint8ClampedArray)p=i.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+c);return{buffer:d,type:p,bytesPerElement:c.BYTES_PER_ELEMENT,version:o.version,size:u}}function n(o,l,c){const h=l.array,u=l.updateRanges;if(i.bindBuffer(c,o),u.length===0)i.bufferSubData(c,0,h);else{u.sort((p,g)=>p.start-g.start);let d=0;for(let p=1;p<u.length;p++){const g=u[d],x=u[p];x.start<=g.start+g.count+1?g.count=Math.max(g.count,x.start+x.count-g.start):(++d,u[d]=x)}u.length=d+1;for(let p=0,g=u.length;p<g;p++){const x=u[p];i.bufferSubData(c,x.start*h.BYTES_PER_ELEMENT,h,x.start,x.count)}l.clearUpdateRanges()}l.onUploadCallback()}function s(o){return o.isInterleavedBufferAttribute&&(o=o.data),e.get(o)}function a(o){o.isInterleavedBufferAttribute&&(o=o.data);const l=e.get(o);l&&(i.deleteBuffer(l.buffer),e.delete(o))}function r(o,l){if(o.isInterleavedBufferAttribute&&(o=o.data),o.isGLBufferAttribute){const h=e.get(o);(!h||h.version<o.version)&&e.set(o,{buffer:o.buffer,type:o.type,bytesPerElement:o.elementSize,version:o.version});return}const c=e.get(o);if(c===void 0)e.set(o,t(o,l));else if(c.version<o.version){if(c.size!==o.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");n(c.buffer,o,l),c.version=o.version}}return{get:s,remove:a,update:r}}var ud=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,fd=`#ifdef USE_ALPHAHASH
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
#endif`,pd=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,md=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,gd=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,_d=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,vd=`#ifdef USE_AOMAP
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
#endif`,xd=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Md=`#ifdef USE_BATCHING
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
	vec4 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );
	}
#endif`,Sd=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,bd=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,yd=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Ed=`float G_BlinnPhong_Implicit( ) {
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
} // validated`,Td=`#ifdef USE_IRIDESCENCE
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
#endif`,wd=`#ifdef USE_BUMPMAP
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
#endif`,Ad=`#if NUM_CLIPPING_PLANES > 0
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
#endif`,Rd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Cd=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Pd=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Ld=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#endif`,Id=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#endif`,Dd=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec4 vColor;
#endif`,Ud=`#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec4( 1.0 );
#endif
#ifdef USE_COLOR_ALPHA
	vColor *= color;
#elif defined( USE_COLOR )
	vColor.rgb *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.rgb *= instanceColor.rgb;
#endif
#ifdef USE_BATCHING_COLOR
	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );
#endif`,kd=`#define PI 3.141592653589793
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
#define inverseTransformDirection transformDirectionByInverseViewMatrix
vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {
	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );
}
vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {
	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );
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
} // validated`,Nd=`#ifdef ENVMAP_TYPE_CUBE_UV
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
#endif`,Fd=`vec3 transformedNormal = objectNormal;
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
#endif`,Od=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Bd=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Hd=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Gd=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,Vd="gl_FragColor = linearToOutputTexel( gl_FragColor );",zd=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,Wd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
			outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	#endif
#endif`,qd=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
#endif`,Xd=`#ifdef USE_ENVMAP
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
#endif`,Yd=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Kd=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Zd=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Jd=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,$d=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,Qd=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,jd=`#ifdef USE_GRADIENTMAP
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
}`,eu=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,tu=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,nu=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,iu=`uniform bool receiveShadow;
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
	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
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
#endif
#include <lightprobes_pars_fragment>`,su=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );
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
#endif`,au=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,ru=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,ou=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,lu=`varying vec3 vViewPosition;
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
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,cu=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;
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
	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
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
	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );
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
#endif`,hu=`uniform sampler2D dfgLUT;
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
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
		vec3 iridescenceFresnelDielectric;
		vec3 iridescenceFresnelMetallic;
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
		return 0.5 / max( gv + gl, EPSILON );
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
	vec3 f0 = material.specularColorBlended;
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
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );
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
	float rInv = 1.0 / ( roughness + 0.1 );
	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;
	float DG = exp( a * dotNV + b );
	return saturate( DG );
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;
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
vec3 BRDF_GGX_Multiscatter( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 singleScatter = BRDF_GGX( lightDir, viewDir, normal, material );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 dfgV = texture2D( dfgLUT, vec2( material.roughness, dotNV ) ).rg;
	vec2 dfgL = texture2D( dfgLUT, vec2( material.roughness, dotNL ) ).rg;
	vec3 FssEss_V = material.specularColorBlended * dfgV.x + material.specularF90 * dfgV.y;
	vec3 FssEss_L = material.specularColorBlended * dfgL.x + material.specularF90 * dfgL.y;
	float Ess_V = dfgV.x + dfgV.y;
	float Ess_L = dfgL.x + dfgL.y;
	float Ems_V = 1.0 - Ess_V;
	float Ems_L = 1.0 - Ess_L;
	vec3 Favg = material.specularColorBlended + ( 1.0 - material.specularColorBlended ) * 0.047619;
	vec3 Fms = FssEss_V * FssEss_L * Favg / ( 1.0 - Ems_V * Ems_L * Favg + EPSILON );
	float compensationFactor = Ems_V * Ems_L;
	vec3 multiScatter = Fms * compensationFactor;
	return singleScatter + multiScatter;
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
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
		#ifdef USE_CLEARCOAT
			vec3 Ncc = geometryClearcoatNormal;
			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );
			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );
			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;
			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );
		#endif
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
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX_Multiscatter( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution );
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		diffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectDiffuse += diffuse;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;
 	#endif
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnelDielectric, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceFresnelMetallic, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( geometryNormal, geometryViewDir, material.diffuseColor, material.specularF90, material.roughness, singleScatteringMetallic, multiScatteringMetallic );
	#endif
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;
	#ifdef USE_SHEEN
		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;
		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;
	#endif
	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,du=`
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
		material.iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );
		material.iridescenceFresnel = mix( material.iridescenceFresnelDielectric, material.iridescenceFresnelMetallic, material.metalness );
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
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
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
	#ifdef USE_LIGHT_PROBES_GRID
		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,uu=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )
			iblIrradiance += getIBLIrradiance( geometryNormal );
		#endif
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
#endif`,fu=`#if defined( RE_IndirectDiffuse )
	#if defined( LAMBERT ) || defined( PHONG )
		irradiance += iblIrradiance;
	#endif
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,pu=`#ifdef USE_LIGHT_PROBES_GRID
uniform highp sampler3D probesSH;
uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;
vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {
	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );
	uvw = uvw * resMinusOne / res + 0.5 / res;
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;
	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;
	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );
	return max( result, vec3( 0.0 ) );
}
#endif`,mu=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,gu=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,_u=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,vu=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,xu=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,Mu=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Su=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
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
#endif`,bu=`#if defined( USE_POINTS_UV )
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
#endif`,yu=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,Eu=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,Tu=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,wu=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,Au=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Ru=`#ifdef USE_MORPHTARGETS
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
#endif`,Cu=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Pu=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
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
	#ifdef DOUBLE_SIDED
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
	#ifdef DOUBLE_SIDED
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,Lu=`#ifdef USE_NORMALMAP_OBJECTSPACE
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
	#if defined( USE_PACKED_NORMALMAP )
		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );
	#endif
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,Iu=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Du=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,Uu=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
		#ifdef FLIP_SIDED
			vBitangent = - vBitangent;
		#endif
	#endif
#endif`,ku=`#ifdef USE_NORMALMAP
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
#endif`,Nu=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,Fu=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,Ou=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,Bu=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,Hu=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,Gu=`vec3 packNormalToRGB( const in vec3 normal ) {
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
	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;
	#else
		return depth * ( near - far ) - near;
	#endif
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER
		return ( near * far ) / ( ( near - far ) * depth - near );
	#else
		return ( near * far ) / ( ( far - near ) * depth - far );
	#endif
}`,Vu=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,zu=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,Wu=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,qu=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,Xu=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,Yu=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,Ku=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#else
			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		#endif
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
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#else
			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		#endif
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
		#if defined( SHADOWMAP_TYPE_PCF )
			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#elif defined( SHADOWMAP_TYPE_BASIC )
			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		#endif
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
	#if defined( SHADOWMAP_TYPE_PCF )
		float interleavedGradientNoise( vec2 position ) {
			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );
		}
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {
			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;
		}
	#endif
	#if defined( SHADOWMAP_TYPE_PCF )
		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#elif defined( SHADOWMAP_TYPE_VSM )
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;
				float mean = distribution.x;
				float variance = distribution.y * distribution.y;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					float hard_shadow = step( mean, shadowCoord.z );
				#else
					float hard_shadow = step( shadowCoord.z, mean );
				#endif
				
				if ( hard_shadow == 1.0 ) {
					shadow = 1.0;
				} else {
					variance = max( variance, 0.0000001 );
					float d = shadowCoord.z - mean;
					float p_max = variance / ( variance + d * d );
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );
					shadow = max( hard_shadow, p_max );
				}
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#else
		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
			float shadow = 1.0;
			shadowCoord.xyz /= shadowCoord.w;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				shadowCoord.z -= shadowBias;
			#else
				shadowCoord.z += shadowBias;
			#endif
			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
			if ( frustumTest ) {
				float depth = texture2D( shadowMap, shadowCoord.xy ).r;
				#ifdef USE_REVERSED_DEPTH_BUFFER
					shadow = step( depth, shadowCoord.z );
				#else
					shadow = step( shadowCoord.z, depth );
				#endif
			}
			return mix( 1.0, shadow, shadowIntensity );
		}
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	#if defined( SHADOWMAP_TYPE_PCF )
	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 bd3D = normalize( lightToPosition );
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			#ifdef USE_REVERSED_DEPTH_BUFFER
				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;
			#else
				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;
			#endif
			float texelSize = shadowRadius / shadowMapSize.x;
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;
			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );
			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#elif defined( SHADOWMAP_TYPE_BASIC )
	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );
		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {
			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			float depth = textureCube( shadowMap, bd3D ).r;
			#ifdef USE_REVERSED_DEPTH_BUFFER
				depth = 1.0 - depth;
			#endif
			shadow = step( dp, depth );
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	#endif
	#endif
#endif`,Zu=`#if NUM_SPOT_LIGHT_COORDS > 0
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
#endif`,Ju=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	#ifdef HAS_NORMAL
		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );
	#else
		vec3 shadowWorldNormal = vec3( 0.0 );
	#endif
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
#endif`,$u=`float getShadowMask() {
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
	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
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
}`,Qu=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,ju=`#ifdef USE_SKINNING
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
#endif`,ef=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,tf=`#ifdef USE_SKINNING
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
#endif`,nf=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,sf=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,af=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,rf=`#ifndef saturate
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
vec3 CustomToneMapping( vec3 color ) { return color; }`,of=`#ifdef USE_TRANSMISSION
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
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,lf=`#ifdef USE_TRANSMISSION
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
#endif`,cf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,hf=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,df=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
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
#endif`,uf=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const ff=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,pf=`uniform sampler2D t2D;
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
}`,mf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,gf=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,_f=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,vf=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,xf=`#include <common>
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
}`,Mf=`#if DEPTH_PACKING == 3200
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
}`,Sf=`#define DISTANCE
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
}`,bf=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );
}`,yf=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Ef=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Tf=`uniform float scale;
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
}`,wf=`uniform vec3 diffuse;
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
}`,Af=`#include <common>
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
}`,Rf=`uniform vec3 diffuse;
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
}`,Cf=`#define LAMBERT
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
}`,Pf=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
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
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
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
}`,Lf=`#define MATCAP
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
}`,If=`#define MATCAP
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
}`,Df=`#define NORMAL
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
}`,Uf=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
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
	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,kf=`#define PHONG
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
}`,Nf=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
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
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
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
}`,Ff=`#define STANDARD
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
}`,Of=`#define STANDARD
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
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
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
}`,Bf=`#define TOON
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
}`,Hf=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
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
}`,Gf=`uniform float size;
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
}`,Vf=`uniform vec3 diffuse;
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
}`,zf=`#include <common>
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
}`,Wf=`uniform vec3 color;
uniform float opacity;
#include <common>
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
	#include <premultiplied_alpha_fragment>
}`,qf=`uniform float rotation;
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
}`,Xf=`uniform vec3 diffuse;
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
}`,Ve={alphahash_fragment:ud,alphahash_pars_fragment:fd,alphamap_fragment:pd,alphamap_pars_fragment:md,alphatest_fragment:gd,alphatest_pars_fragment:_d,aomap_fragment:vd,aomap_pars_fragment:xd,batching_pars_vertex:Md,batching_vertex:Sd,begin_vertex:bd,beginnormal_vertex:yd,bsdfs:Ed,iridescence_fragment:Td,bumpmap_pars_fragment:wd,clipping_planes_fragment:Ad,clipping_planes_pars_fragment:Rd,clipping_planes_pars_vertex:Cd,clipping_planes_vertex:Pd,color_fragment:Ld,color_pars_fragment:Id,color_pars_vertex:Dd,color_vertex:Ud,common:kd,cube_uv_reflection_fragment:Nd,defaultnormal_vertex:Fd,displacementmap_pars_vertex:Od,displacementmap_vertex:Bd,emissivemap_fragment:Hd,emissivemap_pars_fragment:Gd,colorspace_fragment:Vd,colorspace_pars_fragment:zd,envmap_fragment:Wd,envmap_common_pars_fragment:qd,envmap_pars_fragment:Xd,envmap_pars_vertex:Yd,envmap_physical_pars_fragment:su,envmap_vertex:Kd,fog_vertex:Zd,fog_pars_vertex:Jd,fog_fragment:$d,fog_pars_fragment:Qd,gradientmap_pars_fragment:jd,lightmap_pars_fragment:eu,lights_lambert_fragment:tu,lights_lambert_pars_fragment:nu,lights_pars_begin:iu,lights_toon_fragment:au,lights_toon_pars_fragment:ru,lights_phong_fragment:ou,lights_phong_pars_fragment:lu,lights_physical_fragment:cu,lights_physical_pars_fragment:hu,lights_fragment_begin:du,lights_fragment_maps:uu,lights_fragment_end:fu,lightprobes_pars_fragment:pu,logdepthbuf_fragment:mu,logdepthbuf_pars_fragment:gu,logdepthbuf_pars_vertex:_u,logdepthbuf_vertex:vu,map_fragment:xu,map_pars_fragment:Mu,map_particle_fragment:Su,map_particle_pars_fragment:bu,metalnessmap_fragment:yu,metalnessmap_pars_fragment:Eu,morphinstance_vertex:Tu,morphcolor_vertex:wu,morphnormal_vertex:Au,morphtarget_pars_vertex:Ru,morphtarget_vertex:Cu,normal_fragment_begin:Pu,normal_fragment_maps:Lu,normal_pars_fragment:Iu,normal_pars_vertex:Du,normal_vertex:Uu,normalmap_pars_fragment:ku,clearcoat_normal_fragment_begin:Nu,clearcoat_normal_fragment_maps:Fu,clearcoat_pars_fragment:Ou,iridescence_pars_fragment:Bu,opaque_fragment:Hu,packing:Gu,premultiplied_alpha_fragment:Vu,project_vertex:zu,dithering_fragment:Wu,dithering_pars_fragment:qu,roughnessmap_fragment:Xu,roughnessmap_pars_fragment:Yu,shadowmap_pars_fragment:Ku,shadowmap_pars_vertex:Zu,shadowmap_vertex:Ju,shadowmask_pars_fragment:$u,skinbase_vertex:Qu,skinning_pars_vertex:ju,skinning_vertex:ef,skinnormal_vertex:tf,specularmap_fragment:nf,specularmap_pars_fragment:sf,tonemapping_fragment:af,tonemapping_pars_fragment:rf,transmission_fragment:of,transmission_pars_fragment:lf,uv_pars_fragment:cf,uv_pars_vertex:hf,uv_vertex:df,worldpos_vertex:uf,background_vert:ff,background_frag:pf,backgroundCube_vert:mf,backgroundCube_frag:gf,cube_vert:_f,cube_frag:vf,depth_vert:xf,depth_frag:Mf,distance_vert:Sf,distance_frag:bf,equirect_vert:yf,equirect_frag:Ef,linedashed_vert:Tf,linedashed_frag:wf,meshbasic_vert:Af,meshbasic_frag:Rf,meshlambert_vert:Cf,meshlambert_frag:Pf,meshmatcap_vert:Lf,meshmatcap_frag:If,meshnormal_vert:Df,meshnormal_frag:Uf,meshphong_vert:kf,meshphong_frag:Nf,meshphysical_vert:Ff,meshphysical_frag:Of,meshtoon_vert:Bf,meshtoon_frag:Hf,points_vert:Gf,points_frag:Vf,shadow_vert:zf,shadow_frag:Wf,sprite_vert:qf,sprite_frag:Xf},ge={common:{diffuse:{value:new Le(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new Oe},alphaMap:{value:null},alphaMapTransform:{value:new Oe},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new Oe}},envmap:{envMap:{value:null},envMapRotation:{value:new Oe},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98},dfgLUT:{value:null}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new Oe}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new Oe}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new Oe},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new Oe},normalScale:{value:new ze(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new Oe},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new Oe}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new Oe}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new Oe}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Le(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null},probesSH:{value:null},probesMin:{value:new I},probesMax:{value:new I},probesResolution:{value:new I}},points:{diffuse:{value:new Le(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new Oe},alphaTest:{value:0},uvTransform:{value:new Oe}},sprite:{diffuse:{value:new Le(16777215)},opacity:{value:1},center:{value:new ze(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new Oe},alphaMap:{value:null},alphaMapTransform:{value:new Oe},alphaTest:{value:0}}},wn={basic:{uniforms:zt([ge.common,ge.specularmap,ge.envmap,ge.aomap,ge.lightmap,ge.fog]),vertexShader:Ve.meshbasic_vert,fragmentShader:Ve.meshbasic_frag},lambert:{uniforms:zt([ge.common,ge.specularmap,ge.envmap,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.fog,ge.lights,{emissive:{value:new Le(0)},envMapIntensity:{value:1}}]),vertexShader:Ve.meshlambert_vert,fragmentShader:Ve.meshlambert_frag},phong:{uniforms:zt([ge.common,ge.specularmap,ge.envmap,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.fog,ge.lights,{emissive:{value:new Le(0)},specular:{value:new Le(1118481)},shininess:{value:30},envMapIntensity:{value:1}}]),vertexShader:Ve.meshphong_vert,fragmentShader:Ve.meshphong_frag},standard:{uniforms:zt([ge.common,ge.envmap,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.roughnessmap,ge.metalnessmap,ge.fog,ge.lights,{emissive:{value:new Le(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Ve.meshphysical_vert,fragmentShader:Ve.meshphysical_frag},toon:{uniforms:zt([ge.common,ge.aomap,ge.lightmap,ge.emissivemap,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.gradientmap,ge.fog,ge.lights,{emissive:{value:new Le(0)}}]),vertexShader:Ve.meshtoon_vert,fragmentShader:Ve.meshtoon_frag},matcap:{uniforms:zt([ge.common,ge.bumpmap,ge.normalmap,ge.displacementmap,ge.fog,{matcap:{value:null}}]),vertexShader:Ve.meshmatcap_vert,fragmentShader:Ve.meshmatcap_frag},points:{uniforms:zt([ge.points,ge.fog]),vertexShader:Ve.points_vert,fragmentShader:Ve.points_frag},dashed:{uniforms:zt([ge.common,ge.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Ve.linedashed_vert,fragmentShader:Ve.linedashed_frag},depth:{uniforms:zt([ge.common,ge.displacementmap]),vertexShader:Ve.depth_vert,fragmentShader:Ve.depth_frag},normal:{uniforms:zt([ge.common,ge.bumpmap,ge.normalmap,ge.displacementmap,{opacity:{value:1}}]),vertexShader:Ve.meshnormal_vert,fragmentShader:Ve.meshnormal_frag},sprite:{uniforms:zt([ge.sprite,ge.fog]),vertexShader:Ve.sprite_vert,fragmentShader:Ve.sprite_frag},background:{uniforms:{uvTransform:{value:new Oe},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Ve.background_vert,fragmentShader:Ve.background_frag},backgroundCube:{uniforms:{envMap:{value:null},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new Oe}},vertexShader:Ve.backgroundCube_vert,fragmentShader:Ve.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Ve.cube_vert,fragmentShader:Ve.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Ve.equirect_vert,fragmentShader:Ve.equirect_frag},distance:{uniforms:zt([ge.common,ge.displacementmap,{referencePosition:{value:new I},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Ve.distance_vert,fragmentShader:Ve.distance_frag},shadow:{uniforms:zt([ge.lights,ge.fog,{color:{value:new Le(0)},opacity:{value:1}}]),vertexShader:Ve.shadow_vert,fragmentShader:Ve.shadow_frag}};wn.physical={uniforms:zt([wn.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new Oe},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new Oe},clearcoatNormalScale:{value:new ze(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new Oe},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new Oe},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new Oe},sheen:{value:0},sheenColor:{value:new Le(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new Oe},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new Oe},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new Oe},transmissionSamplerSize:{value:new ze},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new Oe},attenuationDistance:{value:0},attenuationColor:{value:new Le(0)},specularColor:{value:new Le(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new Oe},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new Oe},anisotropyVector:{value:new ze},anisotropyMap:{value:null},anisotropyMapTransform:{value:new Oe}}]),vertexShader:Ve.meshphysical_vert,fragmentShader:Ve.meshphysical_frag};const Xs={r:0,b:0,g:0},Yf=new pt,gc=new Oe;gc.set(-1,0,0,0,1,0,0,0,1);function Kf(i,e,t,n,s,a){const r=new Le(0);let o=s===!0?0:1,l,c,h=null,u=0,d=null;function p(M){let w=M.isScene===!0?M.background:null;if(w&&w.isTexture){const S=M.backgroundBlurriness>0;w=e.get(w,S)}return w}function g(M){let w=!1;const S=p(M);S===null?m(r,o):S&&S.isColor&&(m(S,1),w=!0);const b=i.xr.getEnvironmentBlendMode();b==="additive"?t.buffers.color.setClear(0,0,0,1,a):b==="alpha-blend"&&t.buffers.color.setClear(0,0,0,0,a),(i.autoClear||w)&&(t.buffers.depth.setTest(!0),t.buffers.depth.setMask(!0),t.buffers.color.setMask(!0),i.clear(i.autoClearColor,i.autoClearDepth,i.autoClearStencil))}function x(M,w){const S=p(w);S&&(S.isCubeTexture||S.mapping===ma)?(c===void 0&&(c=new Ye(new Zt(1,1,1),new $t({name:"BackgroundCubeMaterial",uniforms:Zi(wn.backgroundCube.uniforms),vertexShader:wn.backgroundCube.vertexShader,fragmentShader:wn.backgroundCube.fragmentShader,side:Jt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),c.geometry.deleteAttribute("normal"),c.geometry.deleteAttribute("uv"),c.onBeforeRender=function(b,E,R){this.matrixWorld.copyPosition(R.matrixWorld)},Object.defineProperty(c.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),n.update(c)),c.material.uniforms.envMap.value=S,c.material.uniforms.backgroundBlurriness.value=w.backgroundBlurriness,c.material.uniforms.backgroundIntensity.value=w.backgroundIntensity,c.material.uniforms.backgroundRotation.value.setFromMatrix4(Yf.makeRotationFromEuler(w.backgroundRotation)).transpose(),S.isCubeTexture&&S.isRenderTargetTexture===!1&&c.material.uniforms.backgroundRotation.value.premultiply(gc),c.material.toneMapped=Je.getTransfer(S.colorSpace)!==lt,(h!==S||u!==S.version||d!==i.toneMapping)&&(c.material.needsUpdate=!0,h=S,u=S.version,d=i.toneMapping),c.layers.enableAll(),M.unshift(c,c.geometry,c.material,0,0,null)):S&&S.isTexture&&(l===void 0&&(l=new Ye(new _t(2,2),new $t({name:"BackgroundMaterial",uniforms:Zi(wn.background.uniforms),vertexShader:wn.background.vertexShader,fragmentShader:wn.background.fragmentShader,side:ri,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),l.geometry.deleteAttribute("normal"),Object.defineProperty(l.material,"map",{get:function(){return this.uniforms.t2D.value}}),n.update(l)),l.material.uniforms.t2D.value=S,l.material.uniforms.backgroundIntensity.value=w.backgroundIntensity,l.material.toneMapped=Je.getTransfer(S.colorSpace)!==lt,S.matrixAutoUpdate===!0&&S.updateMatrix(),l.material.uniforms.uvTransform.value.copy(S.matrix),(h!==S||u!==S.version||d!==i.toneMapping)&&(l.material.needsUpdate=!0,h=S,u=S.version,d=i.toneMapping),l.layers.enableAll(),M.unshift(l,l.geometry,l.material,0,0,null))}function m(M,w){M.getRGB(Xs,hc(i)),t.buffers.color.setClear(Xs.r,Xs.g,Xs.b,w,a)}function f(){c!==void 0&&(c.geometry.dispose(),c.material.dispose(),c=void 0),l!==void 0&&(l.geometry.dispose(),l.material.dispose(),l=void 0)}return{getClearColor:function(){return r},setClearColor:function(M,w=1){r.set(M),o=w,m(r,o)},getClearAlpha:function(){return o},setClearAlpha:function(M){o=M,m(r,o)},render:g,addToRenderList:x,dispose:f}}function Zf(i,e){const t=i.getParameter(i.MAX_VERTEX_ATTRIBS),n={},s=d(null);let a=s,r=!1;function o(P,L,q,Z,N){let X=!1;const G=u(P,Z,q,L);a!==G&&(a=G,c(a.object)),X=p(P,Z,q,N),X&&g(P,Z,q,N),N!==null&&e.update(N,i.ELEMENT_ARRAY_BUFFER),(X||r)&&(r=!1,S(P,L,q,Z),N!==null&&i.bindBuffer(i.ELEMENT_ARRAY_BUFFER,e.get(N).buffer))}function l(){return i.createVertexArray()}function c(P){return i.bindVertexArray(P)}function h(P){return i.deleteVertexArray(P)}function u(P,L,q,Z){const N=Z.wireframe===!0;let X=n[L.id];X===void 0&&(X={},n[L.id]=X);const G=P.isInstancedMesh===!0?P.id:0;let j=X[G];j===void 0&&(j={},X[G]=j);let se=j[q.id];se===void 0&&(se={},j[q.id]=se);let pe=se[N];return pe===void 0&&(pe=d(l()),se[N]=pe),pe}function d(P){const L=[],q=[],Z=[];for(let N=0;N<t;N++)L[N]=0,q[N]=0,Z[N]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:L,enabledAttributes:q,attributeDivisors:Z,object:P,attributes:{},index:null}}function p(P,L,q,Z){const N=a.attributes,X=L.attributes;let G=0;const j=q.getAttributes();for(const se in j)if(j[se].location>=0){const re=N[se];let Me=X[se];if(Me===void 0&&(se==="instanceMatrix"&&P.instanceMatrix&&(Me=P.instanceMatrix),se==="instanceColor"&&P.instanceColor&&(Me=P.instanceColor)),re===void 0||re.attribute!==Me||Me&&re.data!==Me.data)return!0;G++}return a.attributesNum!==G||a.index!==Z}function g(P,L,q,Z){const N={},X=L.attributes;let G=0;const j=q.getAttributes();for(const se in j)if(j[se].location>=0){let re=X[se];re===void 0&&(se==="instanceMatrix"&&P.instanceMatrix&&(re=P.instanceMatrix),se==="instanceColor"&&P.instanceColor&&(re=P.instanceColor));const Me={};Me.attribute=re,re&&re.data&&(Me.data=re.data),N[se]=Me,G++}a.attributes=N,a.attributesNum=G,a.index=Z}function x(){const P=a.newAttributes;for(let L=0,q=P.length;L<q;L++)P[L]=0}function m(P){f(P,0)}function f(P,L){const q=a.newAttributes,Z=a.enabledAttributes,N=a.attributeDivisors;q[P]=1,Z[P]===0&&(i.enableVertexAttribArray(P),Z[P]=1),N[P]!==L&&(i.vertexAttribDivisor(P,L),N[P]=L)}function M(){const P=a.newAttributes,L=a.enabledAttributes;for(let q=0,Z=L.length;q<Z;q++)L[q]!==P[q]&&(i.disableVertexAttribArray(q),L[q]=0)}function w(P,L,q,Z,N,X,G){G===!0?i.vertexAttribIPointer(P,L,q,N,X):i.vertexAttribPointer(P,L,q,Z,N,X)}function S(P,L,q,Z){x();const N=Z.attributes,X=q.getAttributes(),G=L.defaultAttributeValues;for(const j in X){const se=X[j];if(se.location>=0){let pe=N[j];if(pe===void 0&&(j==="instanceMatrix"&&P.instanceMatrix&&(pe=P.instanceMatrix),j==="instanceColor"&&P.instanceColor&&(pe=P.instanceColor)),pe!==void 0){const re=pe.normalized,Me=pe.itemSize,Be=e.get(pe);if(Be===void 0)continue;const tt=Be.buffer,qe=Be.type,$=Be.bytesPerElement,le=qe===i.INT||qe===i.UNSIGNED_INT||pe.gpuType===ao;if(pe.isInterleavedBufferAttribute){const ie=pe.data,Ie=ie.stride,ke=pe.offset;if(ie.isInstancedInterleavedBuffer){for(let Ae=0;Ae<se.locationSize;Ae++)f(se.location+Ae,ie.meshPerAttribute);P.isInstancedMesh!==!0&&Z._maxInstanceCount===void 0&&(Z._maxInstanceCount=ie.meshPerAttribute*ie.count)}else for(let Ae=0;Ae<se.locationSize;Ae++)m(se.location+Ae);i.bindBuffer(i.ARRAY_BUFFER,tt);for(let Ae=0;Ae<se.locationSize;Ae++)w(se.location+Ae,Me/se.locationSize,qe,re,Ie*$,(ke+Me/se.locationSize*Ae)*$,le)}else{if(pe.isInstancedBufferAttribute){for(let ie=0;ie<se.locationSize;ie++)f(se.location+ie,pe.meshPerAttribute);P.isInstancedMesh!==!0&&Z._maxInstanceCount===void 0&&(Z._maxInstanceCount=pe.meshPerAttribute*pe.count)}else for(let ie=0;ie<se.locationSize;ie++)m(se.location+ie);i.bindBuffer(i.ARRAY_BUFFER,tt);for(let ie=0;ie<se.locationSize;ie++)w(se.location+ie,Me/se.locationSize,qe,re,Me*$,Me/se.locationSize*ie*$,le)}}else if(G!==void 0){const re=G[j];if(re!==void 0)switch(re.length){case 2:i.vertexAttrib2fv(se.location,re);break;case 3:i.vertexAttrib3fv(se.location,re);break;case 4:i.vertexAttrib4fv(se.location,re);break;default:i.vertexAttrib1fv(se.location,re)}}}}M()}function b(){T();for(const P in n){const L=n[P];for(const q in L){const Z=L[q];for(const N in Z){const X=Z[N];for(const G in X)h(X[G].object),delete X[G];delete Z[N]}}delete n[P]}}function E(P){if(n[P.id]===void 0)return;const L=n[P.id];for(const q in L){const Z=L[q];for(const N in Z){const X=Z[N];for(const G in X)h(X[G].object),delete X[G];delete Z[N]}}delete n[P.id]}function R(P){for(const L in n){const q=n[L];for(const Z in q){const N=q[Z];if(N[P.id]===void 0)continue;const X=N[P.id];for(const G in X)h(X[G].object),delete X[G];delete N[P.id]}}}function v(P){for(const L in n){const q=n[L],Z=P.isInstancedMesh===!0?P.id:0,N=q[Z];if(N!==void 0){for(const X in N){const G=N[X];for(const j in G)h(G[j].object),delete G[j];delete N[X]}delete q[Z],Object.keys(q).length===0&&delete n[L]}}}function T(){C(),r=!0,a!==s&&(a=s,c(a.object))}function C(){s.geometry=null,s.program=null,s.wireframe=!1}return{setup:o,reset:T,resetDefaultState:C,dispose:b,releaseStatesOfGeometry:E,releaseStatesOfObject:v,releaseStatesOfProgram:R,initAttributes:x,enableAttribute:m,disableUnusedAttributes:M}}function Jf(i,e,t){let n;function s(l){n=l}function a(l,c){i.drawArrays(n,l,c),t.update(c,n,1)}function r(l,c,h){h!==0&&(i.drawArraysInstanced(n,l,c,h),t.update(c,n,h))}function o(l,c,h){if(h===0)return;e.get("WEBGL_multi_draw").multiDrawArraysWEBGL(n,l,0,c,0,h);let d=0;for(let p=0;p<h;p++)d+=c[p];t.update(d,n,1)}this.setMode=s,this.render=a,this.renderInstances=r,this.renderMultiDraw=o}function $f(i,e,t,n){let s;function a(){if(s!==void 0)return s;if(e.has("EXT_texture_filter_anisotropic")===!0){const R=e.get("EXT_texture_filter_anisotropic");s=i.getParameter(R.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else s=0;return s}function r(R){return!(R!==_n&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_FORMAT))}function o(R){const v=R===Wn&&(e.has("EXT_color_buffer_half_float")||e.has("EXT_color_buffer_float"));return!(R!==on&&n.convert(R)!==i.getParameter(i.IMPLEMENTATION_COLOR_READ_TYPE)&&R!==An&&!v)}function l(R){if(R==="highp"){if(i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.HIGH_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.HIGH_FLOAT).precision>0)return"highp";R="mediump"}return R==="mediump"&&i.getShaderPrecisionFormat(i.VERTEX_SHADER,i.MEDIUM_FLOAT).precision>0&&i.getShaderPrecisionFormat(i.FRAGMENT_SHADER,i.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let c=t.precision!==void 0?t.precision:"highp";const h=l(c);h!==c&&(Fe("WebGLRenderer:",c,"not supported, using",h,"instead."),c=h);const u=t.logarithmicDepthBuffer===!0,d=t.reversedDepthBuffer===!0&&e.has("EXT_clip_control");t.reversedDepthBuffer===!0&&d===!1&&Fe("WebGLRenderer: Unable to use reversed depth buffer due to missing EXT_clip_control extension. Fallback to default depth buffer.");const p=i.getParameter(i.MAX_TEXTURE_IMAGE_UNITS),g=i.getParameter(i.MAX_VERTEX_TEXTURE_IMAGE_UNITS),x=i.getParameter(i.MAX_TEXTURE_SIZE),m=i.getParameter(i.MAX_CUBE_MAP_TEXTURE_SIZE),f=i.getParameter(i.MAX_VERTEX_ATTRIBS),M=i.getParameter(i.MAX_VERTEX_UNIFORM_VECTORS),w=i.getParameter(i.MAX_VARYING_VECTORS),S=i.getParameter(i.MAX_FRAGMENT_UNIFORM_VECTORS),b=i.getParameter(i.MAX_SAMPLES),E=i.getParameter(i.SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:a,getMaxPrecision:l,textureFormatReadable:r,textureTypeReadable:o,precision:c,logarithmicDepthBuffer:u,reversedDepthBuffer:d,maxTextures:p,maxVertexTextures:g,maxTextureSize:x,maxCubemapSize:m,maxAttributes:f,maxVertexUniforms:M,maxVaryings:w,maxFragmentUniforms:S,maxSamples:b,samples:E}}function Qf(i){const e=this;let t=null,n=0,s=!1,a=!1;const r=new mi,o=new Oe,l={value:null,needsUpdate:!1};this.uniform=l,this.numPlanes=0,this.numIntersection=0,this.init=function(u,d){const p=u.length!==0||d||n!==0||s;return s=d,n=u.length,p},this.beginShadows=function(){a=!0,h(null)},this.endShadows=function(){a=!1},this.setGlobalState=function(u,d){t=h(u,d,0)},this.setState=function(u,d,p){const g=u.clippingPlanes,x=u.clipIntersection,m=u.clipShadows,f=i.get(u);if(!s||g===null||g.length===0||a&&!m)a?h(null):c();else{const M=a?0:n,w=M*4;let S=f.clippingState||null;l.value=S,S=h(g,d,w,p);for(let b=0;b!==w;++b)S[b]=t[b];f.clippingState=S,this.numIntersection=x?this.numPlanes:0,this.numPlanes+=M}};function c(){l.value!==t&&(l.value=t,l.needsUpdate=n>0),e.numPlanes=n,e.numIntersection=0}function h(u,d,p,g){const x=u!==null?u.length:0;let m=null;if(x!==0){if(m=l.value,g!==!0||m===null){const f=p+x*4,M=d.matrixWorldInverse;o.getNormalMatrix(M),(m===null||m.length<f)&&(m=new Float32Array(f));for(let w=0,S=p;w!==x;++w,S+=4)r.copy(u[w]).applyMatrix4(M,o),r.normal.toArray(m,S),m[S+3]=r.constant}l.value=m,l.needsUpdate=!0}return e.numPlanes=x,e.numIntersection=0,m}}const ai=4,sl=[.125,.215,.35,.446,.526,.582],_i=20,jf=256,as=new Mo,al=new Le;let Za=null,Ja=0,$a=0,Qa=!1;const ep=new I;class rl{constructor(e){this._renderer=e,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._sizeLods=[],this._sigmas=[],this._lodMeshes=[],this._backgroundBox=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._blurMaterial=null,this._ggxMaterial=null}fromScene(e,t=0,n=.1,s=100,a={}){const{size:r=256,position:o=ep}=a;Za=this._renderer.getRenderTarget(),Ja=this._renderer.getActiveCubeFace(),$a=this._renderer.getActiveMipmapLevel(),Qa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(r);const l=this._allocateTargets();return l.depthBuffer=!0,this._sceneToCubeUV(e,n,s,l,o),t>0&&this._blur(l,0,0,t),this._applyPMREM(l),this._cleanup(l),l}fromEquirectangular(e,t=null){return this._fromTexture(e,t)}fromCubemap(e,t=null){return this._fromTexture(e,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=cl(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=ll(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose(),this._backgroundBox!==null&&(this._backgroundBox.geometry.dispose(),this._backgroundBox.material.dispose())}_setSize(e){this._lodMax=Math.floor(Math.log2(e)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._ggxMaterial!==null&&this._ggxMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let e=0;e<this._lodMeshes.length;e++)this._lodMeshes[e].geometry.dispose()}_cleanup(e){this._renderer.setRenderTarget(Za,Ja,$a),this._renderer.xr.enabled=Qa,e.scissorTest=!1,Vi(e,0,0,e.width,e.height)}_fromTexture(e,t){e.mapping===yi||e.mapping===Yi?this._setSize(e.image.length===0?16:e.image[0].width||e.image[0].image.width):this._setSize(e.image.width/4),Za=this._renderer.getRenderTarget(),Ja=this._renderer.getActiveCubeFace(),$a=this._renderer.getActiveMipmapLevel(),Qa=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const n=t||this._allocateTargets();return this._textureToCubeUV(e,n),this._applyPMREM(n),this._cleanup(n),n}_allocateTargets(){const e=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,n={magFilter:Gt,minFilter:Gt,generateMipmaps:!1,type:Wn,format:_n,colorSpace:la,depthBuffer:!1},s=ol(e,t,n);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==e||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=ol(e,t,n);const{_lodMax:a}=this;({lodMeshes:this._lodMeshes,sizeLods:this._sizeLods,sigmas:this._sigmas}=tp(a)),this._blurMaterial=ip(a,e,t),this._ggxMaterial=np(a,e,t)}return s}_compileMaterial(e){const t=new Ye(new Pt,e);this._renderer.compile(t,as)}_sceneToCubeUV(e,t,n,s,a){const l=new rn(90,1,t,n),c=[1,-1,1,1,1,1],h=[1,1,1,-1,-1,-1],u=this._renderer,d=u.autoClear,p=u.toneMapping;u.getClearColor(al),u.toneMapping=Cn,u.autoClear=!1,u.state.buffers.depth.getReversed()&&(u.setRenderTarget(s),u.clearDepth(),u.setRenderTarget(null)),this._backgroundBox===null&&(this._backgroundBox=new Ye(new Zt,new oc({name:"PMREM.Background",side:Jt,depthWrite:!1,depthTest:!1})));const x=this._backgroundBox,m=x.material;let f=!1;const M=e.background;M?M.isColor&&(m.color.copy(M),e.background=null,f=!0):(m.color.copy(al),f=!0);for(let w=0;w<6;w++){const S=w%3;S===0?(l.up.set(0,c[w],0),l.position.set(a.x,a.y,a.z),l.lookAt(a.x+h[w],a.y,a.z)):S===1?(l.up.set(0,0,c[w]),l.position.set(a.x,a.y,a.z),l.lookAt(a.x,a.y+h[w],a.z)):(l.up.set(0,c[w],0),l.position.set(a.x,a.y,a.z),l.lookAt(a.x,a.y,a.z+h[w]));const b=this._cubeSize;Vi(s,S*b,w>2?b:0,b,b),u.setRenderTarget(s),f&&u.render(x,l),u.render(e,l)}u.toneMapping=p,u.autoClear=d,e.background=M}_textureToCubeUV(e,t){const n=this._renderer,s=e.mapping===yi||e.mapping===Yi;s?(this._cubemapMaterial===null&&(this._cubemapMaterial=cl()),this._cubemapMaterial.uniforms.flipEnvMap.value=e.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=ll());const a=s?this._cubemapMaterial:this._equirectMaterial,r=this._lodMeshes[0];r.material=a;const o=a.uniforms;o.envMap.value=e;const l=this._cubeSize;Vi(t,0,0,3*l,2*l),n.setRenderTarget(t),n.render(r,as)}_applyPMREM(e){const t=this._renderer,n=t.autoClear;t.autoClear=!1;const s=this._lodMeshes.length;for(let a=1;a<s;a++)this._applyGGXFilter(e,a-1,a);t.autoClear=n}_applyGGXFilter(e,t,n){const s=this._renderer,a=this._pingPongRenderTarget,r=this._ggxMaterial,o=this._lodMeshes[n];o.material=r;const l=r.uniforms,c=n/(this._lodMeshes.length-1),h=t/(this._lodMeshes.length-1),u=Math.sqrt(c*c-h*h),d=0+c*1.25,p=u*d,{_lodMax:g}=this,x=this._sizeLods[n],m=3*x*(n>g-ai?n-g+ai:0),f=4*(this._cubeSize-x);l.envMap.value=e.texture,l.roughness.value=p,l.mipInt.value=g-t,Vi(a,m,f,3*x,2*x),s.setRenderTarget(a),s.render(o,as),l.envMap.value=a.texture,l.roughness.value=0,l.mipInt.value=g-n,Vi(e,m,f,3*x,2*x),s.setRenderTarget(e),s.render(o,as)}_blur(e,t,n,s,a){const r=this._pingPongRenderTarget;this._halfBlur(e,r,t,n,s,"latitudinal",a),this._halfBlur(r,e,n,n,s,"longitudinal",a)}_halfBlur(e,t,n,s,a,r,o){const l=this._renderer,c=this._blurMaterial;r!=="latitudinal"&&r!=="longitudinal"&&et("blur direction must be either latitudinal or longitudinal!");const h=3,u=this._lodMeshes[s];u.material=c;const d=c.uniforms,p=this._sizeLods[n]-1,g=isFinite(a)?Math.PI/(2*p):2*Math.PI/(2*_i-1),x=a/g,m=isFinite(a)?1+Math.floor(h*x):_i;m>_i&&Fe(`sigmaRadians, ${a}, is too large and will clip, as it requested ${m} samples when the maximum is set to ${_i}`);const f=[];let M=0;for(let R=0;R<_i;++R){const v=R/x,T=Math.exp(-v*v/2);f.push(T),R===0?M+=T:R<m&&(M+=2*T)}for(let R=0;R<f.length;R++)f[R]=f[R]/M;d.envMap.value=e.texture,d.samples.value=m,d.weights.value=f,d.latitudinal.value=r==="latitudinal",o&&(d.poleAxis.value=o);const{_lodMax:w}=this;d.dTheta.value=g,d.mipInt.value=w-n;const S=this._sizeLods[s],b=3*S*(s>w-ai?s-w+ai:0),E=4*(this._cubeSize-S);Vi(t,b,E,3*S,2*S),l.setRenderTarget(t),l.render(u,as)}}function tp(i){const e=[],t=[],n=[];let s=i;const a=i-ai+1+sl.length;for(let r=0;r<a;r++){const o=Math.pow(2,s);e.push(o);let l=1/o;r>i-ai?l=sl[r-i+ai-1]:r===0&&(l=0),t.push(l);const c=1/(o-2),h=-c,u=1+c,d=[h,h,u,h,u,u,h,h,u,u,h,u],p=6,g=6,x=3,m=2,f=1,M=new Float32Array(x*g*p),w=new Float32Array(m*g*p),S=new Float32Array(f*g*p);for(let E=0;E<p;E++){const R=E%3*2/3-1,v=E>2?0:-1,T=[R,v,0,R+2/3,v,0,R+2/3,v+1,0,R,v,0,R+2/3,v+1,0,R,v+1,0];M.set(T,x*g*E),w.set(d,m*g*E);const C=[E,E,E,E,E,E];S.set(C,f*g*E)}const b=new Pt;b.setAttribute("position",new Dt(M,x)),b.setAttribute("uv",new Dt(w,m)),b.setAttribute("faceIndex",new Dt(S,f)),n.push(new Ye(b,null)),s>ai&&s--}return{lodMeshes:n,sizeLods:e,sigmas:t}}function ol(i,e,t){const n=new Pn(i,e,t);return n.texture.mapping=ma,n.texture.name="PMREM.cubeUv",n.scissorTest=!0,n}function Vi(i,e,t,n,s){i.viewport.set(e,t,n,s),i.scissor.set(e,t,n,s)}function np(i,e,t){return new $t({name:"PMREMGGXConvolution",defines:{GGX_SAMPLES:jf,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},roughness:{value:0},mipInt:{value:0}},vertexShader:_a(),fragmentShader:`

			precision highp float;
			precision highp int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform float roughness;
			uniform float mipInt;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			#define PI 3.14159265359

			// Van der Corput radical inverse
			float radicalInverse_VdC(uint bits) {
				bits = (bits << 16u) | (bits >> 16u);
				bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
				bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
				bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
				bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
				return float(bits) * 2.3283064365386963e-10; // / 0x100000000
			}

			// Hammersley sequence
			vec2 hammersley(uint i, uint N) {
				return vec2(float(i) / float(N), radicalInverse_VdC(i));
			}

			// GGX VNDF importance sampling (Eric Heitz 2018)
			// "Sampling the GGX Distribution of Visible Normals"
			// https://jcgt.org/published/0007/04/01/
			vec3 importanceSampleGGX_VNDF(vec2 Xi, vec3 V, float roughness) {
				float alpha = roughness * roughness;

				// Section 4.1: Orthonormal basis
				vec3 T1 = vec3(1.0, 0.0, 0.0);
				vec3 T2 = cross(V, T1);

				// Section 4.2: Parameterization of projected area
				float r = sqrt(Xi.x);
				float phi = 2.0 * PI * Xi.y;
				float t1 = r * cos(phi);
				float t2 = r * sin(phi);
				float s = 0.5 * (1.0 + V.z);
				t2 = (1.0 - s) * sqrt(1.0 - t1 * t1) + s * t2;

				// Section 4.3: Reprojection onto hemisphere
				vec3 Nh = t1 * T1 + t2 * T2 + sqrt(max(0.0, 1.0 - t1 * t1 - t2 * t2)) * V;

				// Section 3.4: Transform back to ellipsoid configuration
				return normalize(vec3(alpha * Nh.x, alpha * Nh.y, max(0.0, Nh.z)));
			}

			void main() {
				vec3 N = normalize(vOutputDirection);
				vec3 V = N; // Assume view direction equals normal for pre-filtering

				vec3 prefilteredColor = vec3(0.0);
				float totalWeight = 0.0;

				// For very low roughness, just sample the environment directly
				if (roughness < 0.001) {
					gl_FragColor = vec4(bilinearCubeUV(envMap, N, mipInt), 1.0);
					return;
				}

				// Tangent space basis for VNDF sampling
				vec3 up = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
				vec3 tangent = normalize(cross(up, N));
				vec3 bitangent = cross(N, tangent);

				for(uint i = 0u; i < uint(GGX_SAMPLES); i++) {
					vec2 Xi = hammersley(i, uint(GGX_SAMPLES));

					// For PMREM, V = N, so in tangent space V is always (0, 0, 1)
					vec3 H_tangent = importanceSampleGGX_VNDF(Xi, vec3(0.0, 0.0, 1.0), roughness);

					// Transform H back to world space
					vec3 H = normalize(tangent * H_tangent.x + bitangent * H_tangent.y + N * H_tangent.z);
					vec3 L = normalize(2.0 * dot(V, H) * H - V);

					float NdotL = max(dot(N, L), 0.0);

					if(NdotL > 0.0) {
						// Sample environment at fixed mip level
						// VNDF importance sampling handles the distribution filtering
						vec3 sampleColor = bilinearCubeUV(envMap, L, mipInt);

						// Weight by NdotL for the split-sum approximation
						// VNDF PDF naturally accounts for the visible microfacet distribution
						prefilteredColor += sampleColor * NdotL;
						totalWeight += NdotL;
					}
				}

				if (totalWeight > 0.0) {
					prefilteredColor = prefilteredColor / totalWeight;
				}

				gl_FragColor = vec4(prefilteredColor, 1.0);
			}
		`,blending:Vn,depthTest:!1,depthWrite:!1})}function ip(i,e,t){const n=new Float32Array(_i),s=new I(0,1,0);return new $t({name:"SphericalGaussianBlur",defines:{n:_i,CUBEUV_TEXEL_WIDTH:1/e,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${i}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:n},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:s}},vertexShader:_a(),fragmentShader:`

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
		`,blending:Vn,depthTest:!1,depthWrite:!1})}function ll(){return new $t({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:_a(),fragmentShader:`

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
		`,blending:Vn,depthTest:!1,depthWrite:!1})}function cl(){return new $t({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:_a(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:Vn,depthTest:!1,depthWrite:!1})}function _a(){return`

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
	`}class _c extends Pn{constructor(e=1,t={}){super(e,e,t),this.isWebGLCubeRenderTarget=!0;const n={width:e,height:e,depth:1},s=[n,n,n,n,n,n];this.texture=new lc(s),this._setTextureOptions(t),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture(e,t){this.texture.type=t.type,this.texture.colorSpace=t.colorSpace,this.texture.generateMipmaps=t.generateMipmaps,this.texture.minFilter=t.minFilter,this.texture.magFilter=t.magFilter;const n={uniforms:{tEquirect:{value:null}},vertexShader:`

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
			`},s=new Zt(5,5,5),a=new $t({name:"CubemapFromEquirect",uniforms:Zi(n.uniforms),vertexShader:n.vertexShader,fragmentShader:n.fragmentShader,side:Jt,blending:Vn});a.uniforms.tEquirect.value=t;const r=new Ye(s,a),o=t.minFilter;return t.minFilter===vi&&(t.minFilter=Gt),new ld(1,10,this).update(e,r),t.minFilter=o,r.geometry.dispose(),r.material.dispose(),this}clear(e,t=!0,n=!0,s=!0){const a=e.getRenderTarget();for(let r=0;r<6;r++)e.setRenderTarget(this,r),e.clear(t,n,s);e.setRenderTarget(a)}}function sp(i){let e=new WeakMap,t=new WeakMap,n=null;function s(d,p=!1){return d==null?null:p?r(d):a(d)}function a(d){if(d&&d.isTexture){const p=d.mapping;if(p===Sa||p===ba)if(e.has(d)){const g=e.get(d).texture;return o(g,d.mapping)}else{const g=d.image;if(g&&g.height>0){const x=new _c(g.height);return x.fromEquirectangularTexture(i,d),e.set(d,x),d.addEventListener("dispose",c),o(x.texture,d.mapping)}else return null}}return d}function r(d){if(d&&d.isTexture){const p=d.mapping,g=p===Sa||p===ba,x=p===yi||p===Yi;if(g||x){let m=t.get(d);const f=m!==void 0?m.texture.pmremVersion:0;if(d.isRenderTargetTexture&&d.pmremVersion!==f)return n===null&&(n=new rl(i)),m=g?n.fromEquirectangular(d,m):n.fromCubemap(d,m),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),m.texture;if(m!==void 0)return m.texture;{const M=d.image;return g&&M&&M.height>0||x&&M&&l(M)?(n===null&&(n=new rl(i)),m=g?n.fromEquirectangular(d):n.fromCubemap(d),m.texture.pmremVersion=d.pmremVersion,t.set(d,m),d.addEventListener("dispose",h),m.texture):null}}}return d}function o(d,p){return p===Sa?d.mapping=yi:p===ba&&(d.mapping=Yi),d}function l(d){let p=0;const g=6;for(let x=0;x<g;x++)d[x]!==void 0&&p++;return p===g}function c(d){const p=d.target;p.removeEventListener("dispose",c);const g=e.get(p);g!==void 0&&(e.delete(p),g.dispose())}function h(d){const p=d.target;p.removeEventListener("dispose",h);const g=t.get(p);g!==void 0&&(t.delete(p),g.dispose())}function u(){e=new WeakMap,t=new WeakMap,n!==null&&(n.dispose(),n=null)}return{get:s,dispose:u}}function ap(i){const e={};function t(n){if(e[n]!==void 0)return e[n];const s=i.getExtension(n);return e[n]=s,s}return{has:function(n){return t(n)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(n){const s=t(n);return s===null&&zi("WebGLRenderer: "+n+" extension not supported."),s}}}function rp(i,e,t,n){const s={},a=new WeakMap;function r(u){const d=u.target;d.index!==null&&e.remove(d.index);for(const g in d.attributes)e.remove(d.attributes[g]);d.removeEventListener("dispose",r),delete s[d.id];const p=a.get(d);p&&(e.remove(p),a.delete(d)),n.releaseStatesOfGeometry(d),d.isInstancedBufferGeometry===!0&&delete d._maxInstanceCount,t.memory.geometries--}function o(u,d){return s[d.id]===!0||(d.addEventListener("dispose",r),s[d.id]=!0,t.memory.geometries++),d}function l(u){const d=u.attributes;for(const p in d)e.update(d[p],i.ARRAY_BUFFER)}function c(u){const d=[],p=u.index,g=u.attributes.position;let x=0;if(g===void 0)return;if(p!==null){const M=p.array;x=p.version;for(let w=0,S=M.length;w<S;w+=3){const b=M[w+0],E=M[w+1],R=M[w+2];d.push(b,E,E,R,R,b)}}else{const M=g.array;x=g.version;for(let w=0,S=M.length/3-1;w<S;w+=3){const b=w+0,E=w+1,R=w+2;d.push(b,E,E,R,R,b)}}const m=new(g.count>=65535?ac:sc)(d,1);m.version=x;const f=a.get(u);f&&e.remove(f),a.set(u,m)}function h(u){const d=a.get(u);if(d){const p=u.index;p!==null&&d.version<p.version&&c(u)}else c(u);return a.get(u)}return{get:o,update:l,getWireframeAttribute:h}}function op(i,e,t){let n;function s(u){n=u}let a,r;function o(u){a=u.type,r=u.bytesPerElement}function l(u,d){i.drawElements(n,d,a,u*r),t.update(d,n,1)}function c(u,d,p){p!==0&&(i.drawElementsInstanced(n,d,a,u*r,p),t.update(d,n,p))}function h(u,d,p){if(p===0)return;e.get("WEBGL_multi_draw").multiDrawElementsWEBGL(n,d,0,a,u,0,p);let x=0;for(let m=0;m<p;m++)x+=d[m];t.update(x,n,1)}this.setMode=s,this.setIndex=o,this.render=l,this.renderInstances=c,this.renderMultiDraw=h}function lp(i){const e={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function n(a,r,o){switch(t.calls++,r){case i.TRIANGLES:t.triangles+=o*(a/3);break;case i.LINES:t.lines+=o*(a/2);break;case i.LINE_STRIP:t.lines+=o*(a-1);break;case i.LINE_LOOP:t.lines+=o*a;break;case i.POINTS:t.points+=o*a;break;default:et("WebGLInfo: Unknown draw mode:",r);break}}function s(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:e,render:t,programs:null,autoReset:!0,reset:s,update:n}}function cp(i,e,t){const n=new WeakMap,s=new xt;function a(r,o,l){const c=r.morphTargetInfluences,h=o.morphAttributes.position||o.morphAttributes.normal||o.morphAttributes.color,u=h!==void 0?h.length:0;let d=n.get(o);if(d===void 0||d.count!==u){let C=function(){v.dispose(),n.delete(o),o.removeEventListener("dispose",C)};var p=C;d!==void 0&&d.texture.dispose();const g=o.morphAttributes.position!==void 0,x=o.morphAttributes.normal!==void 0,m=o.morphAttributes.color!==void 0,f=o.morphAttributes.position||[],M=o.morphAttributes.normal||[],w=o.morphAttributes.color||[];let S=0;g===!0&&(S=1),x===!0&&(S=2),m===!0&&(S=3);let b=o.attributes.position.count*S,E=1;b>e.maxTextureSize&&(E=Math.ceil(b/e.maxTextureSize),b=e.maxTextureSize);const R=new Float32Array(b*E*4*u),v=new tc(R,b,E,u);v.type=An,v.needsUpdate=!0;const T=S*4;for(let P=0;P<u;P++){const L=f[P],q=M[P],Z=w[P],N=b*E*4*P;for(let X=0;X<L.count;X++){const G=X*T;g===!0&&(s.fromBufferAttribute(L,X),R[N+G+0]=s.x,R[N+G+1]=s.y,R[N+G+2]=s.z,R[N+G+3]=0),x===!0&&(s.fromBufferAttribute(q,X),R[N+G+4]=s.x,R[N+G+5]=s.y,R[N+G+6]=s.z,R[N+G+7]=0),m===!0&&(s.fromBufferAttribute(Z,X),R[N+G+8]=s.x,R[N+G+9]=s.y,R[N+G+10]=s.z,R[N+G+11]=Z.itemSize===4?s.w:1)}}d={count:u,texture:v,size:new ze(b,E)},n.set(o,d),o.addEventListener("dispose",C)}if(r.isInstancedMesh===!0&&r.morphTexture!==null)l.getUniforms().setValue(i,"morphTexture",r.morphTexture,t);else{let g=0;for(let m=0;m<c.length;m++)g+=c[m];const x=o.morphTargetsRelative?1:1-g;l.getUniforms().setValue(i,"morphTargetBaseInfluence",x),l.getUniforms().setValue(i,"morphTargetInfluences",c)}l.getUniforms().setValue(i,"morphTargetsTexture",d.texture,t),l.getUniforms().setValue(i,"morphTargetsTextureSize",d.size)}return{update:a}}function hp(i,e,t,n,s){let a=new WeakMap;function r(c){const h=s.render.frame,u=c.geometry,d=e.get(c,u);if(a.get(d)!==h&&(e.update(d),a.set(d,h)),c.isInstancedMesh&&(c.hasEventListener("dispose",l)===!1&&c.addEventListener("dispose",l),a.get(c)!==h&&(t.update(c.instanceMatrix,i.ARRAY_BUFFER),c.instanceColor!==null&&t.update(c.instanceColor,i.ARRAY_BUFFER),a.set(c,h))),c.isSkinnedMesh){const p=c.skeleton;a.get(p)!==h&&(p.update(),a.set(p,h))}return d}function o(){a=new WeakMap}function l(c){const h=c.target;h.removeEventListener("dispose",l),n.releaseStatesOfObject(h),t.remove(h.instanceMatrix),h.instanceColor!==null&&t.remove(h.instanceColor)}return{update:r,dispose:o}}const dp={[Hl]:"LINEAR_TONE_MAPPING",[Gl]:"REINHARD_TONE_MAPPING",[Vl]:"CINEON_TONE_MAPPING",[so]:"ACES_FILMIC_TONE_MAPPING",[Wl]:"AGX_TONE_MAPPING",[ql]:"NEUTRAL_TONE_MAPPING",[zl]:"CUSTOM_TONE_MAPPING"};function up(i,e,t,n,s,a){const r=new Pn(e,t,{type:i,depthBuffer:s,stencilBuffer:a,samples:n?4:0,depthTexture:s?new Ki(e,t):void 0}),o=new Pn(e,t,{type:Wn,depthBuffer:!1,stencilBuffer:!1}),l=new Pt;l.setAttribute("position",new at([-1,3,0,-1,-1,0,3,-1,0],3)),l.setAttribute("uv",new at([0,2,0,0,2,0],2));const c=new td({uniforms:{tDiffuse:{value:null}},vertexShader:`
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

			varying vec2 vUv;

			#include <tonemapping_pars_fragment>
			#include <colorspace_pars_fragment>

			void main() {
				gl_FragColor = texture2D( tDiffuse, vUv );

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

				#ifdef SRGB_TRANSFER
					gl_FragColor = sRGBTransferOETF( gl_FragColor );
				#endif
			}`,depthTest:!1,depthWrite:!1}),h=new Ye(l,c),u=new Mo(-1,1,1,-1,0,1);let d=null,p=null,g=!1,x,m=null,f=[],M=!1;this.setSize=function(w,S){r.setSize(w,S),o.setSize(w,S);for(let b=0;b<f.length;b++){const E=f[b];E.setSize&&E.setSize(w,S)}},this.setEffects=function(w){f=w,M=f.length>0&&f[0].isRenderPass===!0;const S=r.width,b=r.height;for(let E=0;E<f.length;E++){const R=f[E];R.setSize&&R.setSize(S,b)}},this.begin=function(w,S){if(g||w.toneMapping===Cn&&f.length===0)return!1;if(m=S,S!==null){const b=S.width,E=S.height;(r.width!==b||r.height!==E)&&this.setSize(b,E)}return M===!1&&w.setRenderTarget(r),x=w.toneMapping,w.toneMapping=Cn,!0},this.hasRenderPass=function(){return M},this.end=function(w,S){w.toneMapping=x,g=!0;let b=r,E=o;for(let R=0;R<f.length;R++){const v=f[R];if(v.enabled!==!1&&(v.render(w,E,b,S),v.needsSwap!==!1)){const T=b;b=E,E=T}}if(d!==w.outputColorSpace||p!==w.toneMapping){d=w.outputColorSpace,p=w.toneMapping,c.defines={},Je.getTransfer(d)===lt&&(c.defines.SRGB_TRANSFER="");const R=dp[p];R&&(c.defines[R]=""),c.needsUpdate=!0}c.uniforms.tDiffuse.value=b.texture,w.setRenderTarget(m),w.render(h,u),m=null,g=!1},this.isCompositing=function(){return g},this.dispose=function(){r.depthTexture&&r.depthTexture.dispose(),r.dispose(),o.dispose(),l.dispose(),c.dispose()}}const vc=new Vt,Zr=new Ki(1,1),xc=new tc,Mc=new Ph,Sc=new lc,hl=[],dl=[],ul=new Float32Array(16),fl=new Float32Array(9),pl=new Float32Array(4);function ji(i,e,t){const n=i[0];if(n<=0||n>0)return i;const s=e*t;let a=hl[s];if(a===void 0&&(a=new Float32Array(s),hl[s]=a),e!==0){n.toArray(a,0);for(let r=1,o=0;r!==e;++r)o+=t,i[r].toArray(a,o)}return a}function Rt(i,e){if(i.length!==e.length)return!1;for(let t=0,n=i.length;t<n;t++)if(i[t]!==e[t])return!1;return!0}function Ct(i,e){for(let t=0,n=e.length;t<n;t++)i[t]=e[t]}function va(i,e){let t=dl[e];t===void 0&&(t=new Int32Array(e),dl[e]=t);for(let n=0;n!==e;++n)t[n]=i.allocateTextureUnit();return t}function fp(i,e){const t=this.cache;t[0]!==e&&(i.uniform1f(this.addr,e),t[0]=e)}function pp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2f(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Rt(t,e))return;i.uniform2fv(this.addr,e),Ct(t,e)}}function mp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3f(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else if(e.r!==void 0)(t[0]!==e.r||t[1]!==e.g||t[2]!==e.b)&&(i.uniform3f(this.addr,e.r,e.g,e.b),t[0]=e.r,t[1]=e.g,t[2]=e.b);else{if(Rt(t,e))return;i.uniform3fv(this.addr,e),Ct(t,e)}}function gp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4f(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Rt(t,e))return;i.uniform4fv(this.addr,e),Ct(t,e)}}function _p(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Rt(t,e))return;i.uniformMatrix2fv(this.addr,!1,e),Ct(t,e)}else{if(Rt(t,n))return;pl.set(n),i.uniformMatrix2fv(this.addr,!1,pl),Ct(t,n)}}function vp(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Rt(t,e))return;i.uniformMatrix3fv(this.addr,!1,e),Ct(t,e)}else{if(Rt(t,n))return;fl.set(n),i.uniformMatrix3fv(this.addr,!1,fl),Ct(t,n)}}function xp(i,e){const t=this.cache,n=e.elements;if(n===void 0){if(Rt(t,e))return;i.uniformMatrix4fv(this.addr,!1,e),Ct(t,e)}else{if(Rt(t,n))return;ul.set(n),i.uniformMatrix4fv(this.addr,!1,ul),Ct(t,n)}}function Mp(i,e){const t=this.cache;t[0]!==e&&(i.uniform1i(this.addr,e),t[0]=e)}function Sp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2i(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Rt(t,e))return;i.uniform2iv(this.addr,e),Ct(t,e)}}function bp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3i(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Rt(t,e))return;i.uniform3iv(this.addr,e),Ct(t,e)}}function yp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4i(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Rt(t,e))return;i.uniform4iv(this.addr,e),Ct(t,e)}}function Ep(i,e){const t=this.cache;t[0]!==e&&(i.uniform1ui(this.addr,e),t[0]=e)}function Tp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y)&&(i.uniform2ui(this.addr,e.x,e.y),t[0]=e.x,t[1]=e.y);else{if(Rt(t,e))return;i.uniform2uiv(this.addr,e),Ct(t,e)}}function wp(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z)&&(i.uniform3ui(this.addr,e.x,e.y,e.z),t[0]=e.x,t[1]=e.y,t[2]=e.z);else{if(Rt(t,e))return;i.uniform3uiv(this.addr,e),Ct(t,e)}}function Ap(i,e){const t=this.cache;if(e.x!==void 0)(t[0]!==e.x||t[1]!==e.y||t[2]!==e.z||t[3]!==e.w)&&(i.uniform4ui(this.addr,e.x,e.y,e.z,e.w),t[0]=e.x,t[1]=e.y,t[2]=e.z,t[3]=e.w);else{if(Rt(t,e))return;i.uniform4uiv(this.addr,e),Ct(t,e)}}function Rp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s);let a;this.type===i.SAMPLER_2D_SHADOW?(Zr.compareFunction=t.isReversedDepthBuffer()?fo:uo,a=Zr):a=vc,t.setTexture2D(e||a,s)}function Cp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture3D(e||Mc,s)}function Pp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTextureCube(e||Sc,s)}function Lp(i,e,t){const n=this.cache,s=t.allocateTextureUnit();n[0]!==s&&(i.uniform1i(this.addr,s),n[0]=s),t.setTexture2DArray(e||xc,s)}function Ip(i){switch(i){case 5126:return fp;case 35664:return pp;case 35665:return mp;case 35666:return gp;case 35674:return _p;case 35675:return vp;case 35676:return xp;case 5124:case 35670:return Mp;case 35667:case 35671:return Sp;case 35668:case 35672:return bp;case 35669:case 35673:return yp;case 5125:return Ep;case 36294:return Tp;case 36295:return wp;case 36296:return Ap;case 35678:case 36198:case 36298:case 36306:case 35682:return Rp;case 35679:case 36299:case 36307:return Cp;case 35680:case 36300:case 36308:case 36293:return Pp;case 36289:case 36303:case 36311:case 36292:return Lp}}function Dp(i,e){i.uniform1fv(this.addr,e)}function Up(i,e){const t=ji(e,this.size,2);i.uniform2fv(this.addr,t)}function kp(i,e){const t=ji(e,this.size,3);i.uniform3fv(this.addr,t)}function Np(i,e){const t=ji(e,this.size,4);i.uniform4fv(this.addr,t)}function Fp(i,e){const t=ji(e,this.size,4);i.uniformMatrix2fv(this.addr,!1,t)}function Op(i,e){const t=ji(e,this.size,9);i.uniformMatrix3fv(this.addr,!1,t)}function Bp(i,e){const t=ji(e,this.size,16);i.uniformMatrix4fv(this.addr,!1,t)}function Hp(i,e){i.uniform1iv(this.addr,e)}function Gp(i,e){i.uniform2iv(this.addr,e)}function Vp(i,e){i.uniform3iv(this.addr,e)}function zp(i,e){i.uniform4iv(this.addr,e)}function Wp(i,e){i.uniform1uiv(this.addr,e)}function qp(i,e){i.uniform2uiv(this.addr,e)}function Xp(i,e){i.uniform3uiv(this.addr,e)}function Yp(i,e){i.uniform4uiv(this.addr,e)}function Kp(i,e,t){const n=this.cache,s=e.length,a=va(t,s);Rt(n,a)||(i.uniform1iv(this.addr,a),Ct(n,a));let r;this.type===i.SAMPLER_2D_SHADOW?r=Zr:r=vc;for(let o=0;o!==s;++o)t.setTexture2D(e[o]||r,a[o])}function Zp(i,e,t){const n=this.cache,s=e.length,a=va(t,s);Rt(n,a)||(i.uniform1iv(this.addr,a),Ct(n,a));for(let r=0;r!==s;++r)t.setTexture3D(e[r]||Mc,a[r])}function Jp(i,e,t){const n=this.cache,s=e.length,a=va(t,s);Rt(n,a)||(i.uniform1iv(this.addr,a),Ct(n,a));for(let r=0;r!==s;++r)t.setTextureCube(e[r]||Sc,a[r])}function $p(i,e,t){const n=this.cache,s=e.length,a=va(t,s);Rt(n,a)||(i.uniform1iv(this.addr,a),Ct(n,a));for(let r=0;r!==s;++r)t.setTexture2DArray(e[r]||xc,a[r])}function Qp(i){switch(i){case 5126:return Dp;case 35664:return Up;case 35665:return kp;case 35666:return Np;case 35674:return Fp;case 35675:return Op;case 35676:return Bp;case 5124:case 35670:return Hp;case 35667:case 35671:return Gp;case 35668:case 35672:return Vp;case 35669:case 35673:return zp;case 5125:return Wp;case 36294:return qp;case 36295:return Xp;case 36296:return Yp;case 35678:case 36198:case 36298:case 36306:case 35682:return Kp;case 35679:case 36299:case 36307:return Zp;case 35680:case 36300:case 36308:case 36293:return Jp;case 36289:case 36303:case 36311:case 36292:return $p}}class jp{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.setValue=Ip(t.type)}}class e0{constructor(e,t,n){this.id=e,this.addr=n,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Qp(t.type)}}class t0{constructor(e){this.id=e,this.seq=[],this.map={}}setValue(e,t,n){const s=this.seq;for(let a=0,r=s.length;a!==r;++a){const o=s[a];o.setValue(e,t[o.id],n)}}}const ja=/(\w+)(\])?(\[|\.)?/g;function ml(i,e){i.seq.push(e),i.map[e.id]=e}function n0(i,e,t){const n=i.name,s=n.length;for(ja.lastIndex=0;;){const a=ja.exec(n),r=ja.lastIndex;let o=a[1];const l=a[2]==="]",c=a[3];if(l&&(o=o|0),c===void 0||c==="["&&r+2===s){ml(t,c===void 0?new jp(o,i,e):new e0(o,i,e));break}else{let u=t.map[o];u===void 0&&(u=new t0(o),ml(t,u)),t=u}}}class na{constructor(e,t){this.seq=[],this.map={};const n=e.getProgramParameter(t,e.ACTIVE_UNIFORMS);for(let r=0;r<n;++r){const o=e.getActiveUniform(t,r),l=e.getUniformLocation(t,o.name);n0(o,l,this)}const s=[],a=[];for(const r of this.seq)r.type===e.SAMPLER_2D_SHADOW||r.type===e.SAMPLER_CUBE_SHADOW||r.type===e.SAMPLER_2D_ARRAY_SHADOW?s.push(r):a.push(r);s.length>0&&(this.seq=s.concat(a))}setValue(e,t,n,s){const a=this.map[t];a!==void 0&&a.setValue(e,n,s)}setOptional(e,t,n){const s=t[n];s!==void 0&&this.setValue(e,n,s)}static upload(e,t,n,s){for(let a=0,r=t.length;a!==r;++a){const o=t[a],l=n[o.id];l.needsUpdate!==!1&&o.setValue(e,l.value,s)}}static seqWithValue(e,t){const n=[];for(let s=0,a=e.length;s!==a;++s){const r=e[s];r.id in t&&n.push(r)}return n}}function gl(i,e,t){const n=i.createShader(e);return i.shaderSource(n,t),i.compileShader(n),n}const i0=37297;let s0=0;function a0(i,e){const t=i.split(`
`),n=[],s=Math.max(e-6,0),a=Math.min(e+6,t.length);for(let r=s;r<a;r++){const o=r+1;n.push(`${o===e?">":" "} ${o}: ${t[r]}`)}return n.join(`
`)}const _l=new Oe;function r0(i){Je._getMatrix(_l,Je.workingColorSpace,i);const e=`mat3( ${_l.elements.map(t=>t.toFixed(4))} )`;switch(Je.getTransfer(i)){case ca:return[e,"LinearTransferOETF"];case lt:return[e,"sRGBTransferOETF"];default:return Fe("WebGLProgram: Unsupported color space: ",i),[e,"LinearTransferOETF"]}}function vl(i,e,t){const n=i.getShaderParameter(e,i.COMPILE_STATUS),a=(i.getShaderInfoLog(e)||"").trim();if(n&&a==="")return"";const r=/ERROR: 0:(\d+)/.exec(a);if(r){const o=parseInt(r[1]);return t.toUpperCase()+`

`+a+`

`+a0(i.getShaderSource(e),o)}else return a}function o0(i,e){const t=r0(e);return[`vec4 ${i}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}const l0={[Hl]:"Linear",[Gl]:"Reinhard",[Vl]:"Cineon",[so]:"ACESFilmic",[Wl]:"AgX",[ql]:"Neutral",[zl]:"Custom"};function c0(i,e){const t=l0[e];return t===void 0?(Fe("WebGLProgram: Unsupported toneMapping:",e),"vec3 "+i+"( vec3 color ) { return LinearToneMapping( color ); }"):"vec3 "+i+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const Ys=new I;function h0(){Je.getLuminanceCoefficients(Ys);const i=Ys.x.toFixed(4),e=Ys.y.toFixed(4),t=Ys.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${i}, ${e}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function d0(i){return[i.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",i.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(cs).join(`
`)}function u0(i){const e=[];for(const t in i){const n=i[t];n!==!1&&e.push("#define "+t+" "+n)}return e.join(`
`)}function f0(i,e){const t={},n=i.getProgramParameter(e,i.ACTIVE_ATTRIBUTES);for(let s=0;s<n;s++){const a=i.getActiveAttrib(e,s),r=a.name;let o=1;a.type===i.FLOAT_MAT2&&(o=2),a.type===i.FLOAT_MAT3&&(o=3),a.type===i.FLOAT_MAT4&&(o=4),t[r]={type:a.type,location:i.getAttribLocation(e,r),locationSize:o}}return t}function cs(i){return i!==""}function xl(i,e){const t=e.numSpotLightShadows+e.numSpotLightMaps-e.numSpotLightShadowsWithMaps;return i.replace(/NUM_DIR_LIGHTS/g,e.numDirLights).replace(/NUM_SPOT_LIGHTS/g,e.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,e.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,e.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,e.numPointLights).replace(/NUM_HEMI_LIGHTS/g,e.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,e.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,e.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,e.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,e.numPointLightShadows)}function Ml(i,e){return i.replace(/NUM_CLIPPING_PLANES/g,e.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,e.numClippingPlanes-e.numClipIntersection)}const p0=/^[ \t]*#include +<([\w\d./]+)>/gm;function Jr(i){return i.replace(p0,g0)}const m0=new Map;function g0(i,e){let t=Ve[e];if(t===void 0){const n=m0.get(e);if(n!==void 0)t=Ve[n],Fe('WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',e,n);else throw new Error("THREE.WebGLProgram: Can not resolve #include <"+e+">")}return Jr(t)}const _0=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function Sl(i){return i.replace(_0,v0)}function v0(i,e,t,n){let s="";for(let a=parseInt(e);a<parseInt(t);a++)s+=n.replace(/\[\s*i\s*\]/g,"[ "+a+" ]").replace(/UNROLLED_LOOP_INDEX/g,a);return s}function bl(i){let e=`precision ${i.precision} float;
	precision ${i.precision} int;
	precision ${i.precision} sampler2D;
	precision ${i.precision} samplerCube;
	precision ${i.precision} sampler3D;
	precision ${i.precision} sampler2DArray;
	precision ${i.precision} sampler2DShadow;
	precision ${i.precision} samplerCubeShadow;
	precision ${i.precision} sampler2DArrayShadow;
	precision ${i.precision} isampler2D;
	precision ${i.precision} isampler3D;
	precision ${i.precision} isamplerCube;
	precision ${i.precision} isampler2DArray;
	precision ${i.precision} usampler2D;
	precision ${i.precision} usampler3D;
	precision ${i.precision} usamplerCube;
	precision ${i.precision} usampler2DArray;
	`;return i.precision==="highp"?e+=`
#define HIGH_PRECISION`:i.precision==="mediump"?e+=`
#define MEDIUM_PRECISION`:i.precision==="lowp"&&(e+=`
#define LOW_PRECISION`),e}const x0={[$s]:"SHADOWMAP_TYPE_PCF",[ls]:"SHADOWMAP_TYPE_VSM"};function M0(i){return x0[i.shadowMapType]||"SHADOWMAP_TYPE_BASIC"}const S0={[yi]:"ENVMAP_TYPE_CUBE",[Yi]:"ENVMAP_TYPE_CUBE",[ma]:"ENVMAP_TYPE_CUBE_UV"};function b0(i){return i.envMap===!1?"ENVMAP_TYPE_CUBE":S0[i.envMapMode]||"ENVMAP_TYPE_CUBE"}const y0={[Yi]:"ENVMAP_MODE_REFRACTION"};function E0(i){return i.envMap===!1?"ENVMAP_MODE_REFLECTION":y0[i.envMapMode]||"ENVMAP_MODE_REFLECTION"}const T0={[Bl]:"ENVMAP_BLENDING_MULTIPLY",[ch]:"ENVMAP_BLENDING_MIX",[hh]:"ENVMAP_BLENDING_ADD"};function w0(i){return i.envMap===!1?"ENVMAP_BLENDING_NONE":T0[i.combine]||"ENVMAP_BLENDING_NONE"}function A0(i){const e=i.envMapCubeUVHeight;if(e===null)return null;const t=Math.log2(e)-2,n=1/e;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:n,maxMip:t}}function R0(i,e,t,n){const s=i.getContext(),a=t.defines;let r=t.vertexShader,o=t.fragmentShader;const l=M0(t),c=b0(t),h=E0(t),u=w0(t),d=A0(t),p=d0(t),g=u0(a),x=s.createProgram();let m,f,M=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(m=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(cs).join(`
`),m.length>0&&(m+=`
`),f=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g].filter(cs).join(`
`),f.length>0&&(f+=`
`)):(m=[bl(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+h:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexNormals?"#define HAS_NORMAL":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(cs).join(`
`),f=[bl(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,g,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+c:"",t.envMap?"#define "+h:"",t.envMap?"#define "+u:"",d?"#define CUBEUV_TEXEL_WIDTH "+d.texelWidth:"",d?"#define CUBEUV_TEXEL_HEIGHT "+d.texelHeight:"",d?"#define CUBEUV_MAX_MIP "+d.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.packedNormalMap?"#define USE_PACKED_NORMALMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor?"#define USE_COLOR":"",t.vertexAlphas||t.batchingColor?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+l:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.numLightProbeGrids>0?"#define USE_LIGHT_PROBES_GRID":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Cn?"#define TONE_MAPPING":"",t.toneMapping!==Cn?Ve.tonemapping_pars_fragment:"",t.toneMapping!==Cn?c0("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Ve.colorspace_pars_fragment,o0("linearToOutputTexel",t.outputColorSpace),h0(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(cs).join(`
`)),r=Jr(r),r=xl(r,t),r=Ml(r,t),o=Jr(o),o=xl(o,t),o=Ml(o,t),r=Sl(r),o=Sl(o),t.isRawShaderMaterial!==!0&&(M=`#version 300 es
`,m=[p,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+m,f=["#define varying in",t.glslVersion===Do?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Do?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+f);const w=M+m+r,S=M+f+o,b=gl(s,s.VERTEX_SHADER,w),E=gl(s,s.FRAGMENT_SHADER,S);s.attachShader(x,b),s.attachShader(x,E),t.index0AttributeName!==void 0?s.bindAttribLocation(x,0,t.index0AttributeName):t.hasPositionAttribute===!0&&s.bindAttribLocation(x,0,"position"),s.linkProgram(x);function R(P){if(i.debug.checkShaderErrors){const L=s.getProgramInfoLog(x)||"",q=s.getShaderInfoLog(b)||"",Z=s.getShaderInfoLog(E)||"",N=L.trim(),X=q.trim(),G=Z.trim();let j=!0,se=!0;if(s.getProgramParameter(x,s.LINK_STATUS)===!1)if(j=!1,typeof i.debug.onShaderError=="function")i.debug.onShaderError(s,x,b,E);else{const pe=vl(s,b,"vertex"),re=vl(s,E,"fragment");et("WebGLProgram: Shader Error "+s.getError()+" - VALIDATE_STATUS "+s.getProgramParameter(x,s.VALIDATE_STATUS)+`

Material Name: `+P.name+`
Material Type: `+P.type+`

Program Info Log: `+N+`
`+pe+`
`+re)}else N!==""?Fe("WebGLProgram: Program Info Log:",N):(X===""||G==="")&&(se=!1);se&&(P.diagnostics={runnable:j,programLog:N,vertexShader:{log:X,prefix:m},fragmentShader:{log:G,prefix:f}})}s.deleteShader(b),s.deleteShader(E),v=new na(s,x),T=f0(s,x)}let v;this.getUniforms=function(){return v===void 0&&R(this),v};let T;this.getAttributes=function(){return T===void 0&&R(this),T};let C=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return C===!1&&(C=s.getProgramParameter(x,i0)),C},this.destroy=function(){n.releaseStatesOfProgram(this),s.deleteProgram(x),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=s0++,this.cacheKey=e,this.usedTimes=1,this.program=x,this.vertexShader=b,this.fragmentShader=E,this}let C0=0;class P0{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(e,t,n){const s=this._getShaderCacheForMaterial(e);return s.has(t)===!1&&(s.add(t),t.usedTimes++),s.has(n)===!1&&(s.add(n),n.usedTimes++),this}remove(e){const t=this.materialCache.get(e);for(const n of t)n.usedTimes--,n.usedTimes===0&&this.shaderCache.delete(n.code);return this.materialCache.delete(e),this}getVertexShaderStage(e){return this._getShaderStage(e.vertexShader)}getFragmentShaderStage(e){return this._getShaderStage(e.fragmentShader)}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(e){const t=this.materialCache;let n=t.get(e);return n===void 0&&(n=new Set,t.set(e,n)),n}_getShaderStage(e){const t=this.shaderCache;let n=t.get(e);return n===void 0&&(n=new L0(e),t.set(e,n)),n}}class L0{constructor(e){this.id=C0++,this.code=e,this.usedTimes=0}}function I0(i){return i===Ei||i===ra||i===oa}function D0(i,e,t,n,s,a){const r=new nc,o=new P0,l=new Set,c=[],h=new Map,u=n.logarithmicDepthBuffer;let d=n.precision;const p={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distance",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function g(v){return l.add(v),v===0?"uv":`uv${v}`}function x(v,T,C,P,L,q){const Z=P.fog,N=L.geometry,X=v.isMeshStandardMaterial||v.isMeshLambertMaterial||v.isMeshPhongMaterial?P.environment:null,G=v.isMeshStandardMaterial||v.isMeshLambertMaterial&&!v.envMap||v.isMeshPhongMaterial&&!v.envMap,j=e.get(v.envMap||X,G),se=j&&j.mapping===ma?j.image.height:null,pe=p[v.type];v.precision!==null&&(d=n.getMaxPrecision(v.precision),d!==v.precision&&Fe("WebGLProgram.getParameters:",v.precision,"not supported, using",d,"instead."));const re=N.morphAttributes.position||N.morphAttributes.normal||N.morphAttributes.color,Me=re!==void 0?re.length:0;let Be=0;N.morphAttributes.position!==void 0&&(Be=1),N.morphAttributes.normal!==void 0&&(Be=2),N.morphAttributes.color!==void 0&&(Be=3);let tt,qe,$,le;if(pe){const ne=wn[pe];tt=ne.vertexShader,qe=ne.fragmentShader}else{tt=v.vertexShader,qe=v.fragmentShader;const ne=o.getVertexShaderStage(v),xe=o.getFragmentShaderStage(v);o.update(v,ne,xe),$=ne.id,le=xe.id}const ie=i.getRenderTarget(),Ie=i.state.buffers.depth.getReversed(),ke=L.isInstancedMesh===!0,Ae=L.isBatchedMesh===!0,nt=!!v.map,De=!!v.matcap,Ke=!!j,Ze=!!v.aoMap,He=!!v.lightMap,rt=!!v.bumpMap&&v.wireframe===!1,mt=!!v.normalMap,gt=!!v.displacementMap,Mt=!!v.emissiveMap,it=!!v.metalnessMap,ot=!!v.roughnessMap,D=v.anisotropy>0,Lt=v.clearcoat>0,oe=v.dispersion>0,A=v.iridescence>0,_=v.sheen>0,k=v.transmission>0,O=D&&!!v.anisotropyMap,z=Lt&&!!v.clearcoatMap,ee=Lt&&!!v.clearcoatNormalMap,te=Lt&&!!v.clearcoatRoughnessMap,K=A&&!!v.iridescenceMap,J=A&&!!v.iridescenceThicknessMap,de=_&&!!v.sheenColorMap,Ee=_&&!!v.sheenRoughnessMap,ue=!!v.specularMap,ce=!!v.specularColorMap,Te=!!v.specularIntensityMap,Ce=k&&!!v.transmissionMap,Ue=k&&!!v.thicknessMap,U=!!v.gradientMap,he=!!v.alphaMap,Q=v.alphaTest>0,fe=!!v.alphaHash,me=!!v.extensions;let B=Cn;v.toneMapped&&(ie===null||ie.isXRRenderTarget===!0)&&(B=i.toneMapping);const ae={shaderID:pe,shaderType:v.type,shaderName:v.name,vertexShader:tt,fragmentShader:qe,defines:v.defines,customVertexShaderID:$,customFragmentShaderID:le,isRawShaderMaterial:v.isRawShaderMaterial===!0,glslVersion:v.glslVersion,precision:d,batching:Ae,batchingColor:Ae&&L._colorsTexture!==null,instancing:ke,instancingColor:ke&&L.instanceColor!==null,instancingMorph:ke&&L.morphTexture!==null,outputColorSpace:ie===null?i.outputColorSpace:ie.isXRRenderTarget===!0?ie.texture.colorSpace:Je.workingColorSpace,alphaToCoverage:!!v.alphaToCoverage,map:nt,matcap:De,envMap:Ke,envMapMode:Ke&&j.mapping,envMapCubeUVHeight:se,aoMap:Ze,lightMap:He,bumpMap:rt,normalMap:mt,displacementMap:gt,emissiveMap:Mt,normalMapObjectSpace:mt&&v.normalMapType===fh,normalMapTangentSpace:mt&&v.normalMapType===qr,packedNormalMap:mt&&v.normalMapType===qr&&I0(v.normalMap.format),metalnessMap:it,roughnessMap:ot,anisotropy:D,anisotropyMap:O,clearcoat:Lt,clearcoatMap:z,clearcoatNormalMap:ee,clearcoatRoughnessMap:te,dispersion:oe,iridescence:A,iridescenceMap:K,iridescenceThicknessMap:J,sheen:_,sheenColorMap:de,sheenRoughnessMap:Ee,specularMap:ue,specularColorMap:ce,specularIntensityMap:Te,transmission:k,transmissionMap:Ce,thicknessMap:Ue,gradientMap:U,opaque:v.transparent===!1&&v.blending===Mi&&v.alphaToCoverage===!1,alphaMap:he,alphaTest:Q,alphaHash:fe,combine:v.combine,mapUv:nt&&g(v.map.channel),aoMapUv:Ze&&g(v.aoMap.channel),lightMapUv:He&&g(v.lightMap.channel),bumpMapUv:rt&&g(v.bumpMap.channel),normalMapUv:mt&&g(v.normalMap.channel),displacementMapUv:gt&&g(v.displacementMap.channel),emissiveMapUv:Mt&&g(v.emissiveMap.channel),metalnessMapUv:it&&g(v.metalnessMap.channel),roughnessMapUv:ot&&g(v.roughnessMap.channel),anisotropyMapUv:O&&g(v.anisotropyMap.channel),clearcoatMapUv:z&&g(v.clearcoatMap.channel),clearcoatNormalMapUv:ee&&g(v.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:te&&g(v.clearcoatRoughnessMap.channel),iridescenceMapUv:K&&g(v.iridescenceMap.channel),iridescenceThicknessMapUv:J&&g(v.iridescenceThicknessMap.channel),sheenColorMapUv:de&&g(v.sheenColorMap.channel),sheenRoughnessMapUv:Ee&&g(v.sheenRoughnessMap.channel),specularMapUv:ue&&g(v.specularMap.channel),specularColorMapUv:ce&&g(v.specularColorMap.channel),specularIntensityMapUv:Te&&g(v.specularIntensityMap.channel),transmissionMapUv:Ce&&g(v.transmissionMap.channel),thicknessMapUv:Ue&&g(v.thicknessMap.channel),alphaMapUv:he&&g(v.alphaMap.channel),vertexTangents:!!N.attributes.tangent&&(mt||D),vertexNormals:!!N.attributes.normal,vertexColors:v.vertexColors,vertexAlphas:v.vertexColors===!0&&!!N.attributes.color&&N.attributes.color.itemSize===4,pointsUvs:L.isPoints===!0&&!!N.attributes.uv&&(nt||he),fog:!!Z,useFog:v.fog===!0,fogExp2:!!Z&&Z.isFogExp2,flatShading:v.wireframe===!1&&(v.flatShading===!0||N.attributes.normal===void 0&&mt===!1&&(v.isMeshLambertMaterial||v.isMeshPhongMaterial||v.isMeshStandardMaterial||v.isMeshPhysicalMaterial)),sizeAttenuation:v.sizeAttenuation===!0,logarithmicDepthBuffer:u,reversedDepthBuffer:Ie,skinning:L.isSkinnedMesh===!0,hasPositionAttribute:N.attributes.position!==void 0,morphTargets:N.morphAttributes.position!==void 0,morphNormals:N.morphAttributes.normal!==void 0,morphColors:N.morphAttributes.color!==void 0,morphTargetsCount:Me,morphTextureStride:Be,numDirLights:T.directional.length,numPointLights:T.point.length,numSpotLights:T.spot.length,numSpotLightMaps:T.spotLightMap.length,numRectAreaLights:T.rectArea.length,numHemiLights:T.hemi.length,numDirLightShadows:T.directionalShadowMap.length,numPointLightShadows:T.pointShadowMap.length,numSpotLightShadows:T.spotShadowMap.length,numSpotLightShadowsWithMaps:T.numSpotLightShadowsWithMaps,numLightProbes:T.numLightProbes,numLightProbeGrids:q.length,numClippingPlanes:a.numPlanes,numClipIntersection:a.numIntersection,dithering:v.dithering,shadowMapEnabled:i.shadowMap.enabled&&C.length>0,shadowMapType:i.shadowMap.type,toneMapping:B,decodeVideoTexture:nt&&v.map.isVideoTexture===!0&&Je.getTransfer(v.map.colorSpace)===lt,decodeVideoTextureEmissive:Mt&&v.emissiveMap.isVideoTexture===!0&&Je.getTransfer(v.emissiveMap.colorSpace)===lt,premultipliedAlpha:v.premultipliedAlpha,doubleSided:v.side===qt,flipSided:v.side===Jt,useDepthPacking:v.depthPacking>=0,depthPacking:v.depthPacking||0,index0AttributeName:v.index0AttributeName,extensionClipCullDistance:me&&v.extensions.clipCullDistance===!0&&t.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(me&&v.extensions.multiDraw===!0||Ae)&&t.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:t.has("KHR_parallel_shader_compile"),customProgramCacheKey:v.customProgramCacheKey()};return ae.vertexUv1s=l.has(1),ae.vertexUv2s=l.has(2),ae.vertexUv3s=l.has(3),l.clear(),ae}function m(v){const T=[];if(v.shaderID?T.push(v.shaderID):(T.push(v.customVertexShaderID),T.push(v.customFragmentShaderID)),v.defines!==void 0)for(const C in v.defines)T.push(C),T.push(v.defines[C]);return v.isRawShaderMaterial===!1&&(f(T,v),M(T,v),T.push(i.outputColorSpace)),T.push(v.customProgramCacheKey),T.join()}function f(v,T){v.push(T.precision),v.push(T.outputColorSpace),v.push(T.envMapMode),v.push(T.envMapCubeUVHeight),v.push(T.mapUv),v.push(T.alphaMapUv),v.push(T.lightMapUv),v.push(T.aoMapUv),v.push(T.bumpMapUv),v.push(T.normalMapUv),v.push(T.displacementMapUv),v.push(T.emissiveMapUv),v.push(T.metalnessMapUv),v.push(T.roughnessMapUv),v.push(T.anisotropyMapUv),v.push(T.clearcoatMapUv),v.push(T.clearcoatNormalMapUv),v.push(T.clearcoatRoughnessMapUv),v.push(T.iridescenceMapUv),v.push(T.iridescenceThicknessMapUv),v.push(T.sheenColorMapUv),v.push(T.sheenRoughnessMapUv),v.push(T.specularMapUv),v.push(T.specularColorMapUv),v.push(T.specularIntensityMapUv),v.push(T.transmissionMapUv),v.push(T.thicknessMapUv),v.push(T.combine),v.push(T.fogExp2),v.push(T.sizeAttenuation),v.push(T.morphTargetsCount),v.push(T.morphAttributeCount),v.push(T.numDirLights),v.push(T.numPointLights),v.push(T.numSpotLights),v.push(T.numSpotLightMaps),v.push(T.numHemiLights),v.push(T.numRectAreaLights),v.push(T.numDirLightShadows),v.push(T.numPointLightShadows),v.push(T.numSpotLightShadows),v.push(T.numSpotLightShadowsWithMaps),v.push(T.numLightProbes),v.push(T.shadowMapType),v.push(T.toneMapping),v.push(T.numClippingPlanes),v.push(T.numClipIntersection),v.push(T.depthPacking)}function M(v,T){r.disableAll(),T.instancing&&r.enable(0),T.instancingColor&&r.enable(1),T.instancingMorph&&r.enable(2),T.matcap&&r.enable(3),T.envMap&&r.enable(4),T.normalMapObjectSpace&&r.enable(5),T.normalMapTangentSpace&&r.enable(6),T.clearcoat&&r.enable(7),T.iridescence&&r.enable(8),T.alphaTest&&r.enable(9),T.vertexColors&&r.enable(10),T.vertexAlphas&&r.enable(11),T.vertexUv1s&&r.enable(12),T.vertexUv2s&&r.enable(13),T.vertexUv3s&&r.enable(14),T.vertexTangents&&r.enable(15),T.anisotropy&&r.enable(16),T.alphaHash&&r.enable(17),T.batching&&r.enable(18),T.dispersion&&r.enable(19),T.batchingColor&&r.enable(20),T.gradientMap&&r.enable(21),T.packedNormalMap&&r.enable(22),T.vertexNormals&&r.enable(23),v.push(r.mask),r.disableAll(),T.fog&&r.enable(0),T.useFog&&r.enable(1),T.flatShading&&r.enable(2),T.logarithmicDepthBuffer&&r.enable(3),T.reversedDepthBuffer&&r.enable(4),T.skinning&&r.enable(5),T.morphTargets&&r.enable(6),T.morphNormals&&r.enable(7),T.morphColors&&r.enable(8),T.premultipliedAlpha&&r.enable(9),T.shadowMapEnabled&&r.enable(10),T.doubleSided&&r.enable(11),T.flipSided&&r.enable(12),T.useDepthPacking&&r.enable(13),T.dithering&&r.enable(14),T.transmission&&r.enable(15),T.sheen&&r.enable(16),T.opaque&&r.enable(17),T.pointsUvs&&r.enable(18),T.decodeVideoTexture&&r.enable(19),T.decodeVideoTextureEmissive&&r.enable(20),T.alphaToCoverage&&r.enable(21),T.numLightProbeGrids>0&&r.enable(22),T.hasPositionAttribute&&r.enable(23),v.push(r.mask)}function w(v){const T=p[v.type];let C;if(T){const P=wn[T];C=Qh.clone(P.uniforms)}else C=v.uniforms;return C}function S(v,T){let C=h.get(T);return C!==void 0?++C.usedTimes:(C=new R0(i,T,v,s),c.push(C),h.set(T,C)),C}function b(v){if(--v.usedTimes===0){const T=c.indexOf(v);c[T]=c[c.length-1],c.pop(),h.delete(v.cacheKey),v.destroy()}}function E(v){o.remove(v)}function R(){o.dispose()}return{getParameters:x,getProgramCacheKey:m,getUniforms:w,acquireProgram:S,releaseProgram:b,releaseShaderCache:E,programs:c,dispose:R}}function U0(){let i=new WeakMap;function e(r){return i.has(r)}function t(r){let o=i.get(r);return o===void 0&&(o={},i.set(r,o)),o}function n(r){i.delete(r)}function s(r,o,l){i.get(r)[o]=l}function a(){i=new WeakMap}return{has:e,get:t,remove:n,update:s,dispose:a}}function k0(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.material.id!==e.material.id?i.material.id-e.material.id:i.materialVariant!==e.materialVariant?i.materialVariant-e.materialVariant:i.z!==e.z?i.z-e.z:i.id-e.id}function yl(i,e){return i.groupOrder!==e.groupOrder?i.groupOrder-e.groupOrder:i.renderOrder!==e.renderOrder?i.renderOrder-e.renderOrder:i.z!==e.z?e.z-i.z:i.id-e.id}function El(){const i=[];let e=0;const t=[],n=[],s=[];function a(){e=0,t.length=0,n.length=0,s.length=0}function r(d){let p=0;return d.isInstancedMesh&&(p+=2),d.isSkinnedMesh&&(p+=1),p}function o(d,p,g,x,m,f){let M=i[e];return M===void 0?(M={id:d.id,object:d,geometry:p,material:g,materialVariant:r(d),groupOrder:x,renderOrder:d.renderOrder,z:m,group:f},i[e]=M):(M.id=d.id,M.object=d,M.geometry=p,M.material=g,M.materialVariant=r(d),M.groupOrder=x,M.renderOrder=d.renderOrder,M.z=m,M.group=f),e++,M}function l(d,p,g,x,m,f){const M=o(d,p,g,x,m,f);g.transmission>0?n.push(M):g.transparent===!0?s.push(M):t.push(M)}function c(d,p,g,x,m,f){const M=o(d,p,g,x,m,f);g.transmission>0?n.unshift(M):g.transparent===!0?s.unshift(M):t.unshift(M)}function h(d,p,g){t.length>1&&t.sort(d||k0),n.length>1&&n.sort(p||yl),s.length>1&&s.sort(p||yl),g&&(t.reverse(),n.reverse(),s.reverse())}function u(){for(let d=e,p=i.length;d<p;d++){const g=i[d];if(g.id===null)break;g.id=null,g.object=null,g.geometry=null,g.material=null,g.group=null}}return{opaque:t,transmissive:n,transparent:s,init:a,push:l,unshift:c,finish:u,sort:h}}function N0(){let i=new WeakMap;function e(n,s){const a=i.get(n);let r;return a===void 0?(r=new El,i.set(n,[r])):s>=a.length?(r=new El,a.push(r)):r=a[s],r}function t(){i=new WeakMap}return{get:e,dispose:t}}function F0(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={direction:new I,color:new Le};break;case"SpotLight":t={position:new I,direction:new I,color:new Le,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new I,color:new Le,distance:0,decay:0};break;case"HemisphereLight":t={direction:new I,skyColor:new Le,groundColor:new Le};break;case"RectAreaLight":t={color:new Le,position:new I,halfWidth:new I,halfHeight:new I};break}return i[e.id]=t,t}}}function O0(){const i={};return{get:function(e){if(i[e.id]!==void 0)return i[e.id];let t;switch(e.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new ze,shadowCameraNear:1,shadowCameraFar:1e3};break}return i[e.id]=t,t}}}let B0=0;function H0(i,e){return(e.castShadow?2:0)-(i.castShadow?2:0)+(e.map?1:0)-(i.map?1:0)}function G0(i){const e=new F0,t=O0(),n={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let c=0;c<9;c++)n.probe.push(new I);const s=new I,a=new pt,r=new pt;function o(c){let h=0,u=0,d=0;for(let T=0;T<9;T++)n.probe[T].set(0,0,0);let p=0,g=0,x=0,m=0,f=0,M=0,w=0,S=0,b=0,E=0,R=0;c.sort(H0);for(let T=0,C=c.length;T<C;T++){const P=c[T],L=P.color,q=P.intensity,Z=P.distance;let N=null;if(P.shadow&&P.shadow.map&&(P.shadow.map.texture.format===Ei?N=P.shadow.map.texture:N=P.shadow.map.depthTexture||P.shadow.map.texture),P.isAmbientLight)h+=L.r*q,u+=L.g*q,d+=L.b*q;else if(P.isLightProbe){for(let X=0;X<9;X++)n.probe[X].addScaledVector(P.sh.coefficients[X],q);R++}else if(P.isDirectionalLight){const X=e.get(P);if(X.color.copy(P.color).multiplyScalar(P.intensity),P.castShadow){const G=P.shadow,j=t.get(P);j.shadowIntensity=G.intensity,j.shadowBias=G.bias,j.shadowNormalBias=G.normalBias,j.shadowRadius=G.radius,j.shadowMapSize=G.mapSize,n.directionalShadow[p]=j,n.directionalShadowMap[p]=N,n.directionalShadowMatrix[p]=P.shadow.matrix,M++}n.directional[p]=X,p++}else if(P.isSpotLight){const X=e.get(P);X.position.setFromMatrixPosition(P.matrixWorld),X.color.copy(L).multiplyScalar(q),X.distance=Z,X.coneCos=Math.cos(P.angle),X.penumbraCos=Math.cos(P.angle*(1-P.penumbra)),X.decay=P.decay,n.spot[x]=X;const G=P.shadow;if(P.map&&(n.spotLightMap[b]=P.map,b++,G.updateMatrices(P),P.castShadow&&E++),n.spotLightMatrix[x]=G.matrix,P.castShadow){const j=t.get(P);j.shadowIntensity=G.intensity,j.shadowBias=G.bias,j.shadowNormalBias=G.normalBias,j.shadowRadius=G.radius,j.shadowMapSize=G.mapSize,n.spotShadow[x]=j,n.spotShadowMap[x]=N,S++}x++}else if(P.isRectAreaLight){const X=e.get(P);X.color.copy(L).multiplyScalar(q),X.halfWidth.set(P.width*.5,0,0),X.halfHeight.set(0,P.height*.5,0),n.rectArea[m]=X,m++}else if(P.isPointLight){const X=e.get(P);if(X.color.copy(P.color).multiplyScalar(P.intensity),X.distance=P.distance,X.decay=P.decay,P.castShadow){const G=P.shadow,j=t.get(P);j.shadowIntensity=G.intensity,j.shadowBias=G.bias,j.shadowNormalBias=G.normalBias,j.shadowRadius=G.radius,j.shadowMapSize=G.mapSize,j.shadowCameraNear=G.camera.near,j.shadowCameraFar=G.camera.far,n.pointShadow[g]=j,n.pointShadowMap[g]=N,n.pointShadowMatrix[g]=P.shadow.matrix,w++}n.point[g]=X,g++}else if(P.isHemisphereLight){const X=e.get(P);X.skyColor.copy(P.color).multiplyScalar(q),X.groundColor.copy(P.groundColor).multiplyScalar(q),n.hemi[f]=X,f++}}m>0&&(i.has("OES_texture_float_linear")===!0?(n.rectAreaLTC1=ge.LTC_FLOAT_1,n.rectAreaLTC2=ge.LTC_FLOAT_2):(n.rectAreaLTC1=ge.LTC_HALF_1,n.rectAreaLTC2=ge.LTC_HALF_2)),n.ambient[0]=h,n.ambient[1]=u,n.ambient[2]=d;const v=n.hash;(v.directionalLength!==p||v.pointLength!==g||v.spotLength!==x||v.rectAreaLength!==m||v.hemiLength!==f||v.numDirectionalShadows!==M||v.numPointShadows!==w||v.numSpotShadows!==S||v.numSpotMaps!==b||v.numLightProbes!==R)&&(n.directional.length=p,n.spot.length=x,n.rectArea.length=m,n.point.length=g,n.hemi.length=f,n.directionalShadow.length=M,n.directionalShadowMap.length=M,n.pointShadow.length=w,n.pointShadowMap.length=w,n.spotShadow.length=S,n.spotShadowMap.length=S,n.directionalShadowMatrix.length=M,n.pointShadowMatrix.length=w,n.spotLightMatrix.length=S+b-E,n.spotLightMap.length=b,n.numSpotLightShadowsWithMaps=E,n.numLightProbes=R,v.directionalLength=p,v.pointLength=g,v.spotLength=x,v.rectAreaLength=m,v.hemiLength=f,v.numDirectionalShadows=M,v.numPointShadows=w,v.numSpotShadows=S,v.numSpotMaps=b,v.numLightProbes=R,n.version=B0++)}function l(c,h){let u=0,d=0,p=0,g=0,x=0;const m=h.matrixWorldInverse;for(let f=0,M=c.length;f<M;f++){const w=c[f];if(w.isDirectionalLight){const S=n.directional[u];S.direction.setFromMatrixPosition(w.matrixWorld),s.setFromMatrixPosition(w.target.matrixWorld),S.direction.sub(s),S.direction.transformDirection(m),u++}else if(w.isSpotLight){const S=n.spot[p];S.position.setFromMatrixPosition(w.matrixWorld),S.position.applyMatrix4(m),S.direction.setFromMatrixPosition(w.matrixWorld),s.setFromMatrixPosition(w.target.matrixWorld),S.direction.sub(s),S.direction.transformDirection(m),p++}else if(w.isRectAreaLight){const S=n.rectArea[g];S.position.setFromMatrixPosition(w.matrixWorld),S.position.applyMatrix4(m),r.identity(),a.copy(w.matrixWorld),a.premultiply(m),r.extractRotation(a),S.halfWidth.set(w.width*.5,0,0),S.halfHeight.set(0,w.height*.5,0),S.halfWidth.applyMatrix4(r),S.halfHeight.applyMatrix4(r),g++}else if(w.isPointLight){const S=n.point[d];S.position.setFromMatrixPosition(w.matrixWorld),S.position.applyMatrix4(m),d++}else if(w.isHemisphereLight){const S=n.hemi[x];S.direction.setFromMatrixPosition(w.matrixWorld),S.direction.transformDirection(m),x++}}}return{setup:o,setupView:l,state:n}}function Tl(i){const e=new G0(i),t=[],n=[],s=[];function a(d){u.camera=d,t.length=0,n.length=0,s.length=0}function r(d){t.push(d)}function o(d){n.push(d)}function l(d){s.push(d)}function c(){e.setup(t)}function h(d){e.setupView(t,d)}const u={lightsArray:t,shadowsArray:n,lightProbeGridArray:s,camera:null,lights:e,transmissionRenderTarget:{},textureUnits:0};return{init:a,state:u,setupLights:c,setupLightsView:h,pushLight:r,pushShadow:o,pushLightProbeGrid:l}}function V0(i){let e=new WeakMap;function t(s,a=0){const r=e.get(s);let o;return r===void 0?(o=new Tl(i),e.set(s,[o])):a>=r.length?(o=new Tl(i),r.push(o)):o=r[a],o}function n(){e=new WeakMap}return{get:t,dispose:n}}const z0=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,W0=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ).rg;
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ).r;
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( max( 0.0, squared_mean - mean * mean ) );
	gl_FragColor = vec4( mean, std_dev, 0.0, 1.0 );
}`,q0=[new I(1,0,0),new I(-1,0,0),new I(0,1,0),new I(0,-1,0),new I(0,0,1),new I(0,0,-1)],X0=[new I(0,-1,0),new I(0,-1,0),new I(0,0,1),new I(0,0,-1),new I(0,-1,0),new I(0,-1,0)],wl=new pt,rs=new I,er=new I;function Y0(i,e,t){let n=new go;const s=new ze,a=new ze,r=new xt,o=new nd,l=new id,c={},h=t.maxTextureSize,u={[ri]:Jt,[Jt]:ri,[qt]:qt},d=new $t({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new ze},radius:{value:4}},vertexShader:z0,fragmentShader:W0}),p=d.clone();p.defines.HORIZONTAL_PASS=1;const g=new Pt;g.setAttribute("position",new Dt(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const x=new Ye(g,d),m=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=$s;let f=this.type;this.render=function(E,R,v){if(m.enabled===!1||m.autoUpdate===!1&&m.needsUpdate===!1||E.length===0)return;this.type===Ol&&(Fe("WebGLShadowMap: PCFSoftShadowMap has been deprecated. Using PCFShadowMap instead."),this.type=$s);const T=i.getRenderTarget(),C=i.getActiveCubeFace(),P=i.getActiveMipmapLevel(),L=i.state;L.setBlending(Vn),L.buffers.depth.getReversed()===!0?L.buffers.color.setClear(0,0,0,0):L.buffers.color.setClear(1,1,1,1),L.buffers.depth.setTest(!0),L.setScissorTest(!1);const q=f!==this.type;q&&R.traverse(function(Z){Z.material&&(Array.isArray(Z.material)?Z.material.forEach(N=>N.needsUpdate=!0):Z.material.needsUpdate=!0)});for(let Z=0,N=E.length;Z<N;Z++){const X=E[Z],G=X.shadow;if(G===void 0){Fe("WebGLShadowMap:",X,"has no shadow.");continue}if(G.autoUpdate===!1&&G.needsUpdate===!1)continue;s.copy(G.mapSize);const j=G.getFrameExtents();s.multiply(j),a.copy(G.mapSize),(s.x>h||s.y>h)&&(s.x>h&&(a.x=Math.floor(h/j.x),s.x=a.x*j.x,G.mapSize.x=a.x),s.y>h&&(a.y=Math.floor(h/j.y),s.y=a.y*j.y,G.mapSize.y=a.y));const se=i.state.buffers.depth.getReversed();if(G.camera._reversedDepth=se,G.map===null||q===!0){if(G.map!==null&&(G.map.depthTexture!==null&&(G.map.depthTexture.dispose(),G.map.depthTexture=null),G.map.dispose()),this.type===ls){if(X.isPointLight){Fe("WebGLShadowMap: VSM shadow maps are not supported for PointLights. Use PCF or BasicShadowMap instead.");continue}G.map=new Pn(s.x,s.y,{format:Ei,type:Wn,minFilter:Gt,magFilter:Gt,generateMipmaps:!1}),G.map.texture.name=X.name+".shadowMap",G.map.depthTexture=new Ki(s.x,s.y,An),G.map.depthTexture.name=X.name+".shadowMapDepth",G.map.depthTexture.format=qn,G.map.depthTexture.compareFunction=null,G.map.depthTexture.minFilter=kt,G.map.depthTexture.magFilter=kt}else X.isPointLight?(G.map=new _c(s.x),G.map.depthTexture=new Jh(s.x,Ln)):(G.map=new Pn(s.x,s.y),G.map.depthTexture=new Ki(s.x,s.y,Ln)),G.map.depthTexture.name=X.name+".shadowMap",G.map.depthTexture.format=qn,this.type===$s?(G.map.depthTexture.compareFunction=se?fo:uo,G.map.depthTexture.minFilter=Gt,G.map.depthTexture.magFilter=Gt):(G.map.depthTexture.compareFunction=null,G.map.depthTexture.minFilter=kt,G.map.depthTexture.magFilter=kt);G.camera.updateProjectionMatrix()}const pe=G.map.isWebGLCubeRenderTarget?6:1;for(let re=0;re<pe;re++){if(G.map.isWebGLCubeRenderTarget)i.setRenderTarget(G.map,re),i.clear();else{re===0&&(i.setRenderTarget(G.map),i.clear());const Me=G.getViewport(re);r.set(a.x*Me.x,a.y*Me.y,a.x*Me.z,a.y*Me.w),L.viewport(r)}if(X.isPointLight){const Me=G.camera,Be=G.matrix,tt=X.distance||Me.far;tt!==Me.far&&(Me.far=tt,Me.updateProjectionMatrix()),rs.setFromMatrixPosition(X.matrixWorld),Me.position.copy(rs),er.copy(Me.position),er.add(q0[re]),Me.up.copy(X0[re]),Me.lookAt(er),Me.updateMatrixWorld(),Be.makeTranslation(-rs.x,-rs.y,-rs.z),wl.multiplyMatrices(Me.projectionMatrix,Me.matrixWorldInverse),G._frustum.setFromProjectionMatrix(wl,Me.coordinateSystem,Me.reversedDepth)}else G.updateMatrices(X);n=G.getFrustum(),S(R,v,G.camera,X,this.type)}G.isPointLightShadow!==!0&&this.type===ls&&M(G,v),G.needsUpdate=!1}f=this.type,m.needsUpdate=!1,i.setRenderTarget(T,C,P)};function M(E,R){const v=e.update(x);d.defines.VSM_SAMPLES!==E.blurSamples&&(d.defines.VSM_SAMPLES=E.blurSamples,p.defines.VSM_SAMPLES=E.blurSamples,d.needsUpdate=!0,p.needsUpdate=!0),E.mapPass===null&&(E.mapPass=new Pn(s.x,s.y,{format:Ei,type:Wn})),d.uniforms.shadow_pass.value=E.map.depthTexture,d.uniforms.resolution.value=E.mapSize,d.uniforms.radius.value=E.radius,i.setRenderTarget(E.mapPass),i.clear(),i.renderBufferDirect(R,null,v,d,x,null),p.uniforms.shadow_pass.value=E.mapPass.texture,p.uniforms.resolution.value=E.mapSize,p.uniforms.radius.value=E.radius,i.setRenderTarget(E.map),i.clear(),i.renderBufferDirect(R,null,v,p,x,null)}function w(E,R,v,T){let C=null;const P=v.isPointLight===!0?E.customDistanceMaterial:E.customDepthMaterial;if(P!==void 0)C=P;else if(C=v.isPointLight===!0?l:o,i.localClippingEnabled&&R.clipShadows===!0&&Array.isArray(R.clippingPlanes)&&R.clippingPlanes.length!==0||R.displacementMap&&R.displacementScale!==0||R.alphaMap&&R.alphaTest>0||R.map&&R.alphaTest>0||R.alphaToCoverage===!0){const L=C.uuid,q=R.uuid;let Z=c[L];Z===void 0&&(Z={},c[L]=Z);let N=Z[q];N===void 0&&(N=C.clone(),Z[q]=N,R.addEventListener("dispose",b)),C=N}if(C.visible=R.visible,C.wireframe=R.wireframe,T===ls?C.side=R.shadowSide!==null?R.shadowSide:R.side:C.side=R.shadowSide!==null?R.shadowSide:u[R.side],C.alphaMap=R.alphaMap,C.alphaTest=R.alphaToCoverage===!0?.5:R.alphaTest,C.map=R.map,C.clipShadows=R.clipShadows,C.clippingPlanes=R.clippingPlanes,C.clipIntersection=R.clipIntersection,C.displacementMap=R.displacementMap,C.displacementScale=R.displacementScale,C.displacementBias=R.displacementBias,C.wireframeLinewidth=R.wireframeLinewidth,C.linewidth=R.linewidth,v.isPointLight===!0&&C.isMeshDistanceMaterial===!0){const L=i.properties.get(C);L.light=v}return C}function S(E,R,v,T,C){if(E.visible===!1)return;if(E.layers.test(R.layers)&&(E.isMesh||E.isLine||E.isPoints)&&(E.castShadow||E.receiveShadow&&C===ls)&&(!E.frustumCulled||n.intersectsObject(E))){E.modelViewMatrix.multiplyMatrices(v.matrixWorldInverse,E.matrixWorld);const q=e.update(E),Z=E.material;if(Array.isArray(Z)){const N=q.groups;for(let X=0,G=N.length;X<G;X++){const j=N[X],se=Z[j.materialIndex];if(se&&se.visible){const pe=w(E,se,T,C);E.onBeforeShadow(i,E,R,v,q,pe,j),i.renderBufferDirect(v,null,q,pe,E,j),E.onAfterShadow(i,E,R,v,q,pe,j)}}}else if(Z.visible){const N=w(E,Z,T,C);E.onBeforeShadow(i,E,R,v,q,N,null),i.renderBufferDirect(v,null,q,N,E,null),E.onAfterShadow(i,E,R,v,q,N,null)}}const L=E.children;for(let q=0,Z=L.length;q<Z;q++)S(L[q],R,v,T,C)}function b(E){E.target.removeEventListener("dispose",b);for(const v in c){const T=c[v],C=E.target.uuid;C in T&&(T[C].dispose(),delete T[C])}}}function K0(i,e){function t(){let U=!1;const he=new xt;let Q=null;const fe=new xt(0,0,0,0);return{setMask:function(me){Q!==me&&!U&&(i.colorMask(me,me,me,me),Q=me)},setLocked:function(me){U=me},setClear:function(me,B,ae,ne,xe){xe===!0&&(me*=ne,B*=ne,ae*=ne),he.set(me,B,ae,ne),fe.equals(he)===!1&&(i.clearColor(me,B,ae,ne),fe.copy(he))},reset:function(){U=!1,Q=null,fe.set(-1,0,0,0)}}}function n(){let U=!1,he=!1,Q=null,fe=null,me=null;return{setReversed:function(B){if(he!==B){const ae=e.get("EXT_clip_control");B?ae.clipControlEXT(ae.LOWER_LEFT_EXT,ae.ZERO_TO_ONE_EXT):ae.clipControlEXT(ae.LOWER_LEFT_EXT,ae.NEGATIVE_ONE_TO_ONE_EXT),he=B;const ne=me;me=null,this.setClear(ne)}},getReversed:function(){return he},setTest:function(B){B?ie(i.DEPTH_TEST):Ie(i.DEPTH_TEST)},setMask:function(B){Q!==B&&!U&&(i.depthMask(B),Q=B)},setFunc:function(B){if(he&&(B=yh[B]),fe!==B){switch(B){case or:i.depthFunc(i.NEVER);break;case lr:i.depthFunc(i.ALWAYS);break;case cr:i.depthFunc(i.LESS);break;case Xi:i.depthFunc(i.LEQUAL);break;case hr:i.depthFunc(i.EQUAL);break;case dr:i.depthFunc(i.GEQUAL);break;case ur:i.depthFunc(i.GREATER);break;case fr:i.depthFunc(i.NOTEQUAL);break;default:i.depthFunc(i.LEQUAL)}fe=B}},setLocked:function(B){U=B},setClear:function(B){me!==B&&(me=B,he&&(B=1-B),i.clearDepth(B))},reset:function(){U=!1,Q=null,fe=null,me=null,he=!1}}}function s(){let U=!1,he=null,Q=null,fe=null,me=null,B=null,ae=null,ne=null,xe=null;return{setTest:function(be){U||(be?ie(i.STENCIL_TEST):Ie(i.STENCIL_TEST))},setMask:function(be){he!==be&&!U&&(i.stencilMask(be),he=be)},setFunc:function(be,Xe,Qe){(Q!==be||fe!==Xe||me!==Qe)&&(i.stencilFunc(be,Xe,Qe),Q=be,fe=Xe,me=Qe)},setOp:function(be,Xe,Qe){(B!==be||ae!==Xe||ne!==Qe)&&(i.stencilOp(be,Xe,Qe),B=be,ae=Xe,ne=Qe)},setLocked:function(be){U=be},setClear:function(be){xe!==be&&(i.clearStencil(be),xe=be)},reset:function(){U=!1,he=null,Q=null,fe=null,me=null,B=null,ae=null,ne=null,xe=null}}}const a=new t,r=new n,o=new s,l=new WeakMap,c=new WeakMap;let h={},u={},d={},p=new WeakMap,g=[],x=null,m=!1,f=null,M=null,w=null,S=null,b=null,E=null,R=null,v=new Le(0,0,0),T=0,C=!1,P=null,L=null,q=null,Z=null,N=null;const X=i.getParameter(i.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let G=!1,j=0;const se=i.getParameter(i.VERSION);se.indexOf("WebGL")!==-1?(j=parseFloat(/^WebGL (\d)/.exec(se)[1]),G=j>=1):se.indexOf("OpenGL ES")!==-1&&(j=parseFloat(/^OpenGL ES (\d)/.exec(se)[1]),G=j>=2);let pe=null,re={};const Me=i.getParameter(i.SCISSOR_BOX),Be=i.getParameter(i.VIEWPORT),tt=new xt().fromArray(Me),qe=new xt().fromArray(Be);function $(U,he,Q,fe){const me=new Uint8Array(4),B=i.createTexture();i.bindTexture(U,B),i.texParameteri(U,i.TEXTURE_MIN_FILTER,i.NEAREST),i.texParameteri(U,i.TEXTURE_MAG_FILTER,i.NEAREST);for(let ae=0;ae<Q;ae++)U===i.TEXTURE_3D||U===i.TEXTURE_2D_ARRAY?i.texImage3D(he,0,i.RGBA,1,1,fe,0,i.RGBA,i.UNSIGNED_BYTE,me):i.texImage2D(he+ae,0,i.RGBA,1,1,0,i.RGBA,i.UNSIGNED_BYTE,me);return B}const le={};le[i.TEXTURE_2D]=$(i.TEXTURE_2D,i.TEXTURE_2D,1),le[i.TEXTURE_CUBE_MAP]=$(i.TEXTURE_CUBE_MAP,i.TEXTURE_CUBE_MAP_POSITIVE_X,6),le[i.TEXTURE_2D_ARRAY]=$(i.TEXTURE_2D_ARRAY,i.TEXTURE_2D_ARRAY,1,1),le[i.TEXTURE_3D]=$(i.TEXTURE_3D,i.TEXTURE_3D,1,1),a.setClear(0,0,0,1),r.setClear(1),o.setClear(0),ie(i.DEPTH_TEST),r.setFunc(Xi),rt(!1),mt(Ro),ie(i.CULL_FACE),Ze(Vn);function ie(U){h[U]!==!0&&(i.enable(U),h[U]=!0)}function Ie(U){h[U]!==!1&&(i.disable(U),h[U]=!1)}function ke(U,he){return d[U]!==he?(i.bindFramebuffer(U,he),d[U]=he,U===i.DRAW_FRAMEBUFFER&&(d[i.FRAMEBUFFER]=he),U===i.FRAMEBUFFER&&(d[i.DRAW_FRAMEBUFFER]=he),!0):!1}function Ae(U,he){let Q=g,fe=!1;if(U){Q=p.get(he),Q===void 0&&(Q=[],p.set(he,Q));const me=U.textures;if(Q.length!==me.length||Q[0]!==i.COLOR_ATTACHMENT0){for(let B=0,ae=me.length;B<ae;B++)Q[B]=i.COLOR_ATTACHMENT0+B;Q.length=me.length,fe=!0}}else Q[0]!==i.BACK&&(Q[0]=i.BACK,fe=!0);fe&&i.drawBuffers(Q)}function nt(U){return x!==U?(i.useProgram(U),x=U,!0):!1}const De={[gi]:i.FUNC_ADD,[Xc]:i.FUNC_SUBTRACT,[Yc]:i.FUNC_REVERSE_SUBTRACT};De[Kc]=i.MIN,De[Zc]=i.MAX;const Ke={[Jc]:i.ZERO,[$c]:i.ONE,[Qc]:i.SRC_COLOR,[ar]:i.SRC_ALPHA,[sh]:i.SRC_ALPHA_SATURATE,[nh]:i.DST_COLOR,[eh]:i.DST_ALPHA,[jc]:i.ONE_MINUS_SRC_COLOR,[rr]:i.ONE_MINUS_SRC_ALPHA,[ih]:i.ONE_MINUS_DST_COLOR,[th]:i.ONE_MINUS_DST_ALPHA,[ah]:i.CONSTANT_COLOR,[rh]:i.ONE_MINUS_CONSTANT_COLOR,[oh]:i.CONSTANT_ALPHA,[lh]:i.ONE_MINUS_CONSTANT_ALPHA};function Ze(U,he,Q,fe,me,B,ae,ne,xe,be){if(U===Vn){m===!0&&(Ie(i.BLEND),m=!1);return}if(m===!1&&(ie(i.BLEND),m=!0),U!==qc){if(U!==f||be!==C){if((M!==gi||b!==gi)&&(i.blendEquation(i.FUNC_ADD),M=gi,b=gi),be)switch(U){case Mi:i.blendFuncSeparate(i.ONE,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case qi:i.blendFunc(i.ONE,i.ONE);break;case Co:i.blendFuncSeparate(i.ZERO,i.ONE_MINUS_SRC_COLOR,i.ZERO,i.ONE);break;case Po:i.blendFuncSeparate(i.DST_COLOR,i.ONE_MINUS_SRC_ALPHA,i.ZERO,i.ONE);break;default:et("WebGLState: Invalid blending: ",U);break}else switch(U){case Mi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE_MINUS_SRC_ALPHA,i.ONE,i.ONE_MINUS_SRC_ALPHA);break;case qi:i.blendFuncSeparate(i.SRC_ALPHA,i.ONE,i.ONE,i.ONE);break;case Co:et("WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Po:et("WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:et("WebGLState: Invalid blending: ",U);break}w=null,S=null,E=null,R=null,v.set(0,0,0),T=0,f=U,C=be}return}me=me||he,B=B||Q,ae=ae||fe,(he!==M||me!==b)&&(i.blendEquationSeparate(De[he],De[me]),M=he,b=me),(Q!==w||fe!==S||B!==E||ae!==R)&&(i.blendFuncSeparate(Ke[Q],Ke[fe],Ke[B],Ke[ae]),w=Q,S=fe,E=B,R=ae),(ne.equals(v)===!1||xe!==T)&&(i.blendColor(ne.r,ne.g,ne.b,xe),v.copy(ne),T=xe),f=U,C=!1}function He(U,he){U.side===qt?Ie(i.CULL_FACE):ie(i.CULL_FACE);let Q=U.side===Jt;he&&(Q=!Q),rt(Q),U.blending===Mi&&U.transparent===!1?Ze(Vn):Ze(U.blending,U.blendEquation,U.blendSrc,U.blendDst,U.blendEquationAlpha,U.blendSrcAlpha,U.blendDstAlpha,U.blendColor,U.blendAlpha,U.premultipliedAlpha),r.setFunc(U.depthFunc),r.setTest(U.depthTest),r.setMask(U.depthWrite),a.setMask(U.colorWrite);const fe=U.stencilWrite;o.setTest(fe),fe&&(o.setMask(U.stencilWriteMask),o.setFunc(U.stencilFunc,U.stencilRef,U.stencilFuncMask),o.setOp(U.stencilFail,U.stencilZFail,U.stencilZPass)),Mt(U.polygonOffset,U.polygonOffsetFactor,U.polygonOffsetUnits),U.alphaToCoverage===!0?ie(i.SAMPLE_ALPHA_TO_COVERAGE):Ie(i.SAMPLE_ALPHA_TO_COVERAGE)}function rt(U){P!==U&&(U?i.frontFace(i.CW):i.frontFace(i.CCW),P=U)}function mt(U){U!==zc?(ie(i.CULL_FACE),U!==L&&(U===Ro?i.cullFace(i.BACK):U===Wc?i.cullFace(i.FRONT):i.cullFace(i.FRONT_AND_BACK))):Ie(i.CULL_FACE),L=U}function gt(U){U!==q&&(G&&i.lineWidth(U),q=U)}function Mt(U,he,Q){U?(ie(i.POLYGON_OFFSET_FILL),(Z!==he||N!==Q)&&(Z=he,N=Q,r.getReversed()&&(he=-he),i.polygonOffset(he,Q))):Ie(i.POLYGON_OFFSET_FILL)}function it(U){U?ie(i.SCISSOR_TEST):Ie(i.SCISSOR_TEST)}function ot(U){U===void 0&&(U=i.TEXTURE0+X-1),pe!==U&&(i.activeTexture(U),pe=U)}function D(U,he,Q){Q===void 0&&(pe===null?Q=i.TEXTURE0+X-1:Q=pe);let fe=re[Q];fe===void 0&&(fe={type:void 0,texture:void 0},re[Q]=fe),(fe.type!==U||fe.texture!==he)&&(pe!==Q&&(i.activeTexture(Q),pe=Q),i.bindTexture(U,he||le[U]),fe.type=U,fe.texture=he)}function Lt(){const U=re[pe];U!==void 0&&U.type!==void 0&&(i.bindTexture(U.type,null),U.type=void 0,U.texture=void 0)}function oe(){try{i.compressedTexImage2D(...arguments)}catch(U){et("WebGLState:",U)}}function A(){try{i.compressedTexImage3D(...arguments)}catch(U){et("WebGLState:",U)}}function _(){try{i.texSubImage2D(...arguments)}catch(U){et("WebGLState:",U)}}function k(){try{i.texSubImage3D(...arguments)}catch(U){et("WebGLState:",U)}}function O(){try{i.compressedTexSubImage2D(...arguments)}catch(U){et("WebGLState:",U)}}function z(){try{i.compressedTexSubImage3D(...arguments)}catch(U){et("WebGLState:",U)}}function ee(){try{i.texStorage2D(...arguments)}catch(U){et("WebGLState:",U)}}function te(){try{i.texStorage3D(...arguments)}catch(U){et("WebGLState:",U)}}function K(){try{i.texImage2D(...arguments)}catch(U){et("WebGLState:",U)}}function J(){try{i.texImage3D(...arguments)}catch(U){et("WebGLState:",U)}}function de(U){return u[U]!==void 0?u[U]:i.getParameter(U)}function Ee(U,he){u[U]!==he&&(i.pixelStorei(U,he),u[U]=he)}function ue(U){tt.equals(U)===!1&&(i.scissor(U.x,U.y,U.z,U.w),tt.copy(U))}function ce(U){qe.equals(U)===!1&&(i.viewport(U.x,U.y,U.z,U.w),qe.copy(U))}function Te(U,he){let Q=c.get(he);Q===void 0&&(Q=new WeakMap,c.set(he,Q));let fe=Q.get(U);fe===void 0&&(fe=i.getUniformBlockIndex(he,U.name),Q.set(U,fe))}function Ce(U,he){const fe=c.get(he).get(U);l.get(he)!==fe&&(i.uniformBlockBinding(he,fe,U.__bindingPointIndex),l.set(he,fe))}function Ue(){i.disable(i.BLEND),i.disable(i.CULL_FACE),i.disable(i.DEPTH_TEST),i.disable(i.POLYGON_OFFSET_FILL),i.disable(i.SCISSOR_TEST),i.disable(i.STENCIL_TEST),i.disable(i.SAMPLE_ALPHA_TO_COVERAGE),i.blendEquation(i.FUNC_ADD),i.blendFunc(i.ONE,i.ZERO),i.blendFuncSeparate(i.ONE,i.ZERO,i.ONE,i.ZERO),i.blendColor(0,0,0,0),i.colorMask(!0,!0,!0,!0),i.clearColor(0,0,0,0),i.depthMask(!0),i.depthFunc(i.LESS),r.setReversed(!1),i.clearDepth(1),i.stencilMask(4294967295),i.stencilFunc(i.ALWAYS,0,4294967295),i.stencilOp(i.KEEP,i.KEEP,i.KEEP),i.clearStencil(0),i.cullFace(i.BACK),i.frontFace(i.CCW),i.polygonOffset(0,0),i.activeTexture(i.TEXTURE0),i.bindFramebuffer(i.FRAMEBUFFER,null),i.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),i.bindFramebuffer(i.READ_FRAMEBUFFER,null),i.useProgram(null),i.lineWidth(1),i.scissor(0,0,i.canvas.width,i.canvas.height),i.viewport(0,0,i.canvas.width,i.canvas.height),i.pixelStorei(i.PACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_ALIGNMENT,4),i.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,!1),i.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),i.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,i.BROWSER_DEFAULT_WEBGL),i.pixelStorei(i.PACK_ROW_LENGTH,0),i.pixelStorei(i.PACK_SKIP_PIXELS,0),i.pixelStorei(i.PACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_ROW_LENGTH,0),i.pixelStorei(i.UNPACK_IMAGE_HEIGHT,0),i.pixelStorei(i.UNPACK_SKIP_PIXELS,0),i.pixelStorei(i.UNPACK_SKIP_ROWS,0),i.pixelStorei(i.UNPACK_SKIP_IMAGES,0),h={},u={},pe=null,re={},d={},p=new WeakMap,g=[],x=null,m=!1,f=null,M=null,w=null,S=null,b=null,E=null,R=null,v=new Le(0,0,0),T=0,C=!1,P=null,L=null,q=null,Z=null,N=null,tt.set(0,0,i.canvas.width,i.canvas.height),qe.set(0,0,i.canvas.width,i.canvas.height),a.reset(),r.reset(),o.reset()}return{buffers:{color:a,depth:r,stencil:o},enable:ie,disable:Ie,bindFramebuffer:ke,drawBuffers:Ae,useProgram:nt,setBlending:Ze,setMaterial:He,setFlipSided:rt,setCullFace:mt,setLineWidth:gt,setPolygonOffset:Mt,setScissorTest:it,activeTexture:ot,bindTexture:D,unbindTexture:Lt,compressedTexImage2D:oe,compressedTexImage3D:A,texImage2D:K,texImage3D:J,pixelStorei:Ee,getParameter:de,updateUBOMapping:Te,uniformBlockBinding:Ce,texStorage2D:ee,texStorage3D:te,texSubImage2D:_,texSubImage3D:k,compressedTexSubImage2D:O,compressedTexSubImage3D:z,scissor:ue,viewport:ce,reset:Ue}}function Z0(i,e,t,n,s,a,r){const o=e.has("WEBGL_multisampled_render_to_texture")?e.get("WEBGL_multisampled_render_to_texture"):null,l=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),c=new ze,h=new WeakMap,u=new Set;let d;const p=new WeakMap;let g=!1;try{g=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function x(A,_){return g?new OffscreenCanvas(A,_):ha("canvas")}function m(A,_,k){let O=1;const z=oe(A);if((z.width>k||z.height>k)&&(O=k/Math.max(z.width,z.height)),O<1)if(typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&A instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&A instanceof ImageBitmap||typeof VideoFrame<"u"&&A instanceof VideoFrame){const ee=Math.floor(O*z.width),te=Math.floor(O*z.height);d===void 0&&(d=x(ee,te));const K=_?x(ee,te):d;return K.width=ee,K.height=te,K.getContext("2d").drawImage(A,0,0,ee,te),Fe("WebGLRenderer: Texture has been resized from ("+z.width+"x"+z.height+") to ("+ee+"x"+te+")."),K}else return"data"in A&&Fe("WebGLRenderer: Image in DataTexture is too big ("+z.width+"x"+z.height+")."),A;return A}function f(A){return A.generateMipmaps}function M(A){i.generateMipmap(A)}function w(A){return A.isWebGLCubeRenderTarget?i.TEXTURE_CUBE_MAP:A.isWebGL3DRenderTarget?i.TEXTURE_3D:A.isWebGLArrayRenderTarget||A.isCompressedArrayTexture?i.TEXTURE_2D_ARRAY:i.TEXTURE_2D}function S(A,_,k,O,z,ee=!1){if(A!==null){if(i[A]!==void 0)return i[A];Fe("WebGLRenderer: Attempt to use non-existing WebGL internal format '"+A+"'")}let te;O&&(te=e.get("EXT_texture_norm16"),te||Fe("WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension"));let K=_;if(_===i.RED&&(k===i.FLOAT&&(K=i.R32F),k===i.HALF_FLOAT&&(K=i.R16F),k===i.UNSIGNED_BYTE&&(K=i.R8),k===i.UNSIGNED_SHORT&&te&&(K=te.R16_EXT),k===i.SHORT&&te&&(K=te.R16_SNORM_EXT)),_===i.RED_INTEGER&&(k===i.UNSIGNED_BYTE&&(K=i.R8UI),k===i.UNSIGNED_SHORT&&(K=i.R16UI),k===i.UNSIGNED_INT&&(K=i.R32UI),k===i.BYTE&&(K=i.R8I),k===i.SHORT&&(K=i.R16I),k===i.INT&&(K=i.R32I)),_===i.RG&&(k===i.FLOAT&&(K=i.RG32F),k===i.HALF_FLOAT&&(K=i.RG16F),k===i.UNSIGNED_BYTE&&(K=i.RG8),k===i.UNSIGNED_SHORT&&te&&(K=te.RG16_EXT),k===i.SHORT&&te&&(K=te.RG16_SNORM_EXT)),_===i.RG_INTEGER&&(k===i.UNSIGNED_BYTE&&(K=i.RG8UI),k===i.UNSIGNED_SHORT&&(K=i.RG16UI),k===i.UNSIGNED_INT&&(K=i.RG32UI),k===i.BYTE&&(K=i.RG8I),k===i.SHORT&&(K=i.RG16I),k===i.INT&&(K=i.RG32I)),_===i.RGB_INTEGER&&(k===i.UNSIGNED_BYTE&&(K=i.RGB8UI),k===i.UNSIGNED_SHORT&&(K=i.RGB16UI),k===i.UNSIGNED_INT&&(K=i.RGB32UI),k===i.BYTE&&(K=i.RGB8I),k===i.SHORT&&(K=i.RGB16I),k===i.INT&&(K=i.RGB32I)),_===i.RGBA_INTEGER&&(k===i.UNSIGNED_BYTE&&(K=i.RGBA8UI),k===i.UNSIGNED_SHORT&&(K=i.RGBA16UI),k===i.UNSIGNED_INT&&(K=i.RGBA32UI),k===i.BYTE&&(K=i.RGBA8I),k===i.SHORT&&(K=i.RGBA16I),k===i.INT&&(K=i.RGBA32I)),_===i.RGB&&(k===i.UNSIGNED_SHORT&&te&&(K=te.RGB16_EXT),k===i.SHORT&&te&&(K=te.RGB16_SNORM_EXT),k===i.UNSIGNED_INT_5_9_9_9_REV&&(K=i.RGB9_E5),k===i.UNSIGNED_INT_10F_11F_11F_REV&&(K=i.R11F_G11F_B10F)),_===i.RGBA){const J=ee?ca:Je.getTransfer(z);k===i.FLOAT&&(K=i.RGBA32F),k===i.HALF_FLOAT&&(K=i.RGBA16F),k===i.UNSIGNED_BYTE&&(K=J===lt?i.SRGB8_ALPHA8:i.RGBA8),k===i.UNSIGNED_SHORT&&te&&(K=te.RGBA16_EXT),k===i.SHORT&&te&&(K=te.RGBA16_SNORM_EXT),k===i.UNSIGNED_SHORT_4_4_4_4&&(K=i.RGBA4),k===i.UNSIGNED_SHORT_5_5_5_1&&(K=i.RGB5_A1)}return(K===i.R16F||K===i.R32F||K===i.RG16F||K===i.RG32F||K===i.RGBA16F||K===i.RGBA32F)&&e.get("EXT_color_buffer_float"),K}function b(A,_){let k;return A?_===null||_===Ln||_===ps?k=i.DEPTH24_STENCIL8:_===An?k=i.DEPTH32F_STENCIL8:_===fs&&(k=i.DEPTH24_STENCIL8,Fe("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):_===null||_===Ln||_===ps?k=i.DEPTH_COMPONENT24:_===An?k=i.DEPTH_COMPONENT32F:_===fs&&(k=i.DEPTH_COMPONENT16),k}function E(A,_){return f(A)===!0||A.isFramebufferTexture&&A.minFilter!==kt&&A.minFilter!==Gt?Math.log2(Math.max(_.width,_.height))+1:A.mipmaps!==void 0&&A.mipmaps.length>0?A.mipmaps.length:A.isCompressedTexture&&Array.isArray(A.image)?_.mipmaps.length:1}function R(A){const _=A.target;_.removeEventListener("dispose",R),T(_),_.isVideoTexture&&h.delete(_),_.isHTMLTexture&&u.delete(_)}function v(A){const _=A.target;_.removeEventListener("dispose",v),P(_)}function T(A){const _=n.get(A);if(_.__webglInit===void 0)return;const k=A.source,O=p.get(k);if(O){const z=O[_.__cacheKey];z.usedTimes--,z.usedTimes===0&&C(A),Object.keys(O).length===0&&p.delete(k)}n.remove(A)}function C(A){const _=n.get(A);i.deleteTexture(_.__webglTexture);const k=A.source,O=p.get(k);delete O[_.__cacheKey],r.memory.textures--}function P(A){const _=n.get(A);if(A.depthTexture&&(A.depthTexture.dispose(),n.remove(A.depthTexture)),A.isWebGLCubeRenderTarget)for(let O=0;O<6;O++){if(Array.isArray(_.__webglFramebuffer[O]))for(let z=0;z<_.__webglFramebuffer[O].length;z++)i.deleteFramebuffer(_.__webglFramebuffer[O][z]);else i.deleteFramebuffer(_.__webglFramebuffer[O]);_.__webglDepthbuffer&&i.deleteRenderbuffer(_.__webglDepthbuffer[O])}else{if(Array.isArray(_.__webglFramebuffer))for(let O=0;O<_.__webglFramebuffer.length;O++)i.deleteFramebuffer(_.__webglFramebuffer[O]);else i.deleteFramebuffer(_.__webglFramebuffer);if(_.__webglDepthbuffer&&i.deleteRenderbuffer(_.__webglDepthbuffer),_.__webglMultisampledFramebuffer&&i.deleteFramebuffer(_.__webglMultisampledFramebuffer),_.__webglColorRenderbuffer)for(let O=0;O<_.__webglColorRenderbuffer.length;O++)_.__webglColorRenderbuffer[O]&&i.deleteRenderbuffer(_.__webglColorRenderbuffer[O]);_.__webglDepthRenderbuffer&&i.deleteRenderbuffer(_.__webglDepthRenderbuffer)}const k=A.textures;for(let O=0,z=k.length;O<z;O++){const ee=n.get(k[O]);ee.__webglTexture&&(i.deleteTexture(ee.__webglTexture),r.memory.textures--),n.remove(k[O])}n.remove(A)}let L=0;function q(){L=0}function Z(){return L}function N(A){L=A}function X(){const A=L;return A>=s.maxTextures&&Fe("WebGLTextures: Trying to use "+A+" texture units while this GPU supports only "+s.maxTextures),L+=1,A}function G(A){const _=[];return _.push(A.wrapS),_.push(A.wrapT),_.push(A.wrapR||0),_.push(A.magFilter),_.push(A.minFilter),_.push(A.anisotropy),_.push(A.internalFormat),_.push(A.format),_.push(A.type),_.push(A.generateMipmaps),_.push(A.premultiplyAlpha),_.push(A.flipY),_.push(A.unpackAlignment),_.push(A.colorSpace),_.join()}function j(A,_){const k=n.get(A);if(A.isVideoTexture&&D(A),A.isRenderTargetTexture===!1&&A.isExternalTexture!==!0&&A.version>0&&k.__version!==A.version){const O=A.image;if(O===null)Fe("WebGLRenderer: Texture marked for update but no image data found.");else if(O.complete===!1)Fe("WebGLRenderer: Texture marked for update but image is incomplete");else{Ie(k,A,_);return}}else A.isExternalTexture&&(k.__webglTexture=A.sourceTexture?A.sourceTexture:null);t.bindTexture(i.TEXTURE_2D,k.__webglTexture,i.TEXTURE0+_)}function se(A,_){const k=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&k.__version!==A.version){Ie(k,A,_);return}else A.isExternalTexture&&(k.__webglTexture=A.sourceTexture?A.sourceTexture:null);t.bindTexture(i.TEXTURE_2D_ARRAY,k.__webglTexture,i.TEXTURE0+_)}function pe(A,_){const k=n.get(A);if(A.isRenderTargetTexture===!1&&A.version>0&&k.__version!==A.version){Ie(k,A,_);return}t.bindTexture(i.TEXTURE_3D,k.__webglTexture,i.TEXTURE0+_)}function re(A,_){const k=n.get(A);if(A.isCubeDepthTexture!==!0&&A.version>0&&k.__version!==A.version){ke(k,A,_);return}t.bindTexture(i.TEXTURE_CUBE_MAP,k.__webglTexture,i.TEXTURE0+_)}const Me={[us]:i.REPEAT,[Hn]:i.CLAMP_TO_EDGE,[pr]:i.MIRRORED_REPEAT},Be={[kt]:i.NEAREST,[dh]:i.NEAREST_MIPMAP_NEAREST,[Es]:i.NEAREST_MIPMAP_LINEAR,[Gt]:i.LINEAR,[ya]:i.LINEAR_MIPMAP_NEAREST,[vi]:i.LINEAR_MIPMAP_LINEAR},tt={[ph]:i.NEVER,[xh]:i.ALWAYS,[mh]:i.LESS,[uo]:i.LEQUAL,[gh]:i.EQUAL,[fo]:i.GEQUAL,[_h]:i.GREATER,[vh]:i.NOTEQUAL};function qe(A,_){if(_.type===An&&e.has("OES_texture_float_linear")===!1&&(_.magFilter===Gt||_.magFilter===ya||_.magFilter===Es||_.magFilter===vi||_.minFilter===Gt||_.minFilter===ya||_.minFilter===Es||_.minFilter===vi)&&Fe("WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),i.texParameteri(A,i.TEXTURE_WRAP_S,Me[_.wrapS]),i.texParameteri(A,i.TEXTURE_WRAP_T,Me[_.wrapT]),(A===i.TEXTURE_3D||A===i.TEXTURE_2D_ARRAY)&&i.texParameteri(A,i.TEXTURE_WRAP_R,Me[_.wrapR]),i.texParameteri(A,i.TEXTURE_MAG_FILTER,Be[_.magFilter]),i.texParameteri(A,i.TEXTURE_MIN_FILTER,Be[_.minFilter]),_.compareFunction&&(i.texParameteri(A,i.TEXTURE_COMPARE_MODE,i.COMPARE_REF_TO_TEXTURE),i.texParameteri(A,i.TEXTURE_COMPARE_FUNC,tt[_.compareFunction])),e.has("EXT_texture_filter_anisotropic")===!0){if(_.magFilter===kt||_.minFilter!==Es&&_.minFilter!==vi||_.type===An&&e.has("OES_texture_float_linear")===!1)return;if(_.anisotropy>1||n.get(_).__currentAnisotropy){const k=e.get("EXT_texture_filter_anisotropic");i.texParameterf(A,k.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(_.anisotropy,s.getMaxAnisotropy())),n.get(_).__currentAnisotropy=_.anisotropy}}}function $(A,_){let k=!1;A.__webglInit===void 0&&(A.__webglInit=!0,_.addEventListener("dispose",R));const O=_.source;let z=p.get(O);z===void 0&&(z={},p.set(O,z));const ee=G(_);if(ee!==A.__cacheKey){z[ee]===void 0&&(z[ee]={texture:i.createTexture(),usedTimes:0},r.memory.textures++,k=!0),z[ee].usedTimes++;const te=z[A.__cacheKey];te!==void 0&&(z[A.__cacheKey].usedTimes--,te.usedTimes===0&&C(_)),A.__cacheKey=ee,A.__webglTexture=z[ee].texture}return k}function le(A,_,k){return Math.floor(Math.floor(A/k)/_)}function ie(A,_,k,O){const ee=A.updateRanges;if(ee.length===0)t.texSubImage2D(i.TEXTURE_2D,0,0,0,_.width,_.height,k,O,_.data);else{ee.sort((Ee,ue)=>Ee.start-ue.start);let te=0;for(let Ee=1;Ee<ee.length;Ee++){const ue=ee[te],ce=ee[Ee],Te=ue.start+ue.count,Ce=le(ce.start,_.width,4),Ue=le(ue.start,_.width,4);ce.start<=Te+1&&Ce===Ue&&le(ce.start+ce.count-1,_.width,4)===Ce?ue.count=Math.max(ue.count,ce.start+ce.count-ue.start):(++te,ee[te]=ce)}ee.length=te+1;const K=t.getParameter(i.UNPACK_ROW_LENGTH),J=t.getParameter(i.UNPACK_SKIP_PIXELS),de=t.getParameter(i.UNPACK_SKIP_ROWS);t.pixelStorei(i.UNPACK_ROW_LENGTH,_.width);for(let Ee=0,ue=ee.length;Ee<ue;Ee++){const ce=ee[Ee],Te=Math.floor(ce.start/4),Ce=Math.ceil(ce.count/4),Ue=Te%_.width,U=Math.floor(Te/_.width),he=Ce,Q=1;t.pixelStorei(i.UNPACK_SKIP_PIXELS,Ue),t.pixelStorei(i.UNPACK_SKIP_ROWS,U),t.texSubImage2D(i.TEXTURE_2D,0,Ue,U,he,Q,k,O,_.data)}A.clearUpdateRanges(),t.pixelStorei(i.UNPACK_ROW_LENGTH,K),t.pixelStorei(i.UNPACK_SKIP_PIXELS,J),t.pixelStorei(i.UNPACK_SKIP_ROWS,de)}}function Ie(A,_,k){let O=i.TEXTURE_2D;(_.isDataArrayTexture||_.isCompressedArrayTexture)&&(O=i.TEXTURE_2D_ARRAY),_.isData3DTexture&&(O=i.TEXTURE_3D);const z=$(A,_),ee=_.source;t.bindTexture(O,A.__webglTexture,i.TEXTURE0+k);const te=n.get(ee);if(ee.version!==te.__version||z===!0){if(t.activeTexture(i.TEXTURE0+k),(typeof ImageBitmap<"u"&&_.image instanceof ImageBitmap)===!1){const Q=Je.getPrimaries(Je.workingColorSpace),fe=_.colorSpace===Bn?null:Je.getPrimaries(_.colorSpace),me=_.colorSpace===Bn||Q===fe?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,_.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,me)}t.pixelStorei(i.UNPACK_ALIGNMENT,_.unpackAlignment);let J=m(_.image,!1,s.maxTextureSize);J=Lt(_,J);const de=a.convert(_.format,_.colorSpace),Ee=a.convert(_.type);let ue=S(_.internalFormat,de,Ee,_.normalized,_.colorSpace,_.isVideoTexture);qe(O,_);let ce;const Te=_.mipmaps,Ce=_.isVideoTexture!==!0,Ue=te.__version===void 0||z===!0,U=ee.dataReady,he=E(_,J);if(_.isDepthTexture)ue=b(_.format===xi,_.type),Ue&&(Ce?t.texStorage2D(i.TEXTURE_2D,1,ue,J.width,J.height):t.texImage2D(i.TEXTURE_2D,0,ue,J.width,J.height,0,de,Ee,null));else if(_.isDataTexture)if(Te.length>0){Ce&&Ue&&t.texStorage2D(i.TEXTURE_2D,he,ue,Te[0].width,Te[0].height);for(let Q=0,fe=Te.length;Q<fe;Q++)ce=Te[Q],Ce?U&&t.texSubImage2D(i.TEXTURE_2D,Q,0,0,ce.width,ce.height,de,Ee,ce.data):t.texImage2D(i.TEXTURE_2D,Q,ue,ce.width,ce.height,0,de,Ee,ce.data);_.generateMipmaps=!1}else Ce?(Ue&&t.texStorage2D(i.TEXTURE_2D,he,ue,J.width,J.height),U&&ie(_,J,de,Ee)):t.texImage2D(i.TEXTURE_2D,0,ue,J.width,J.height,0,de,Ee,J.data);else if(_.isCompressedTexture)if(_.isCompressedArrayTexture){Ce&&Ue&&t.texStorage3D(i.TEXTURE_2D_ARRAY,he,ue,Te[0].width,Te[0].height,J.depth);for(let Q=0,fe=Te.length;Q<fe;Q++)if(ce=Te[Q],_.format!==_n)if(de!==null)if(Ce){if(U)if(_.layerUpdates.size>0){const me=il(ce.width,ce.height,_.format,_.type);for(const B of _.layerUpdates){const ae=ce.data.subarray(B*me/ce.data.BYTES_PER_ELEMENT,(B+1)*me/ce.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Q,0,0,B,ce.width,ce.height,1,de,ae)}_.clearLayerUpdates()}else t.compressedTexSubImage3D(i.TEXTURE_2D_ARRAY,Q,0,0,0,ce.width,ce.height,J.depth,de,ce.data)}else t.compressedTexImage3D(i.TEXTURE_2D_ARRAY,Q,ue,ce.width,ce.height,J.depth,0,ce.data,0,0);else Fe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else Ce?U&&t.texSubImage3D(i.TEXTURE_2D_ARRAY,Q,0,0,0,ce.width,ce.height,J.depth,de,Ee,ce.data):t.texImage3D(i.TEXTURE_2D_ARRAY,Q,ue,ce.width,ce.height,J.depth,0,de,Ee,ce.data)}else{Ce&&Ue&&t.texStorage2D(i.TEXTURE_2D,he,ue,Te[0].width,Te[0].height);for(let Q=0,fe=Te.length;Q<fe;Q++)ce=Te[Q],_.format!==_n?de!==null?Ce?U&&t.compressedTexSubImage2D(i.TEXTURE_2D,Q,0,0,ce.width,ce.height,de,ce.data):t.compressedTexImage2D(i.TEXTURE_2D,Q,ue,ce.width,ce.height,0,ce.data):Fe("WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):Ce?U&&t.texSubImage2D(i.TEXTURE_2D,Q,0,0,ce.width,ce.height,de,Ee,ce.data):t.texImage2D(i.TEXTURE_2D,Q,ue,ce.width,ce.height,0,de,Ee,ce.data)}else if(_.isDataArrayTexture)if(Ce){if(Ue&&t.texStorage3D(i.TEXTURE_2D_ARRAY,he,ue,J.width,J.height,J.depth),U)if(_.layerUpdates.size>0){const Q=il(J.width,J.height,_.format,_.type);for(const fe of _.layerUpdates){const me=J.data.subarray(fe*Q/J.data.BYTES_PER_ELEMENT,(fe+1)*Q/J.data.BYTES_PER_ELEMENT);t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,fe,J.width,J.height,1,de,Ee,me)}_.clearLayerUpdates()}else t.texSubImage3D(i.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,de,Ee,J.data)}else t.texImage3D(i.TEXTURE_2D_ARRAY,0,ue,J.width,J.height,J.depth,0,de,Ee,J.data);else if(_.isData3DTexture)Ce?(Ue&&t.texStorage3D(i.TEXTURE_3D,he,ue,J.width,J.height,J.depth),U&&t.texSubImage3D(i.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,de,Ee,J.data)):t.texImage3D(i.TEXTURE_3D,0,ue,J.width,J.height,J.depth,0,de,Ee,J.data);else if(_.isFramebufferTexture){if(Ue)if(Ce)t.texStorage2D(i.TEXTURE_2D,he,ue,J.width,J.height);else{let Q=J.width,fe=J.height;for(let me=0;me<he;me++)t.texImage2D(i.TEXTURE_2D,me,ue,Q,fe,0,de,Ee,null),Q>>=1,fe>>=1}}else if(_.isHTMLTexture){if("texElementImage2D"in i){const Q=i.canvas;if(Q.hasAttribute("layoutsubtree")||Q.setAttribute("layoutsubtree","true"),J.parentNode!==Q){Q.appendChild(J),u.add(_),Q.onpaint=fe=>{const me=fe.changedElements;for(const B of u)me.includes(B.image)&&(B.needsUpdate=!0)},Q.requestPaint();return}if(i.texElementImage2D.length===3)i.texElementImage2D(i.TEXTURE_2D,i.RGBA8,J);else{const me=i.RGBA,B=i.RGBA,ae=i.UNSIGNED_BYTE;i.texElementImage2D(i.TEXTURE_2D,0,me,B,ae,J)}i.texParameteri(i.TEXTURE_2D,i.TEXTURE_MIN_FILTER,i.LINEAR),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_S,i.CLAMP_TO_EDGE),i.texParameteri(i.TEXTURE_2D,i.TEXTURE_WRAP_T,i.CLAMP_TO_EDGE)}}else if(Te.length>0){if(Ce&&Ue){const Q=oe(Te[0]);t.texStorage2D(i.TEXTURE_2D,he,ue,Q.width,Q.height)}for(let Q=0,fe=Te.length;Q<fe;Q++)ce=Te[Q],Ce?U&&t.texSubImage2D(i.TEXTURE_2D,Q,0,0,de,Ee,ce):t.texImage2D(i.TEXTURE_2D,Q,ue,de,Ee,ce);_.generateMipmaps=!1}else if(Ce){if(Ue){const Q=oe(J);t.texStorage2D(i.TEXTURE_2D,he,ue,Q.width,Q.height)}U&&t.texSubImage2D(i.TEXTURE_2D,0,0,0,de,Ee,J)}else t.texImage2D(i.TEXTURE_2D,0,ue,de,Ee,J);f(_)&&M(O),te.__version=ee.version,_.onUpdate&&_.onUpdate(_)}A.__version=_.version}function ke(A,_,k){if(_.image.length!==6)return;const O=$(A,_),z=_.source;t.bindTexture(i.TEXTURE_CUBE_MAP,A.__webglTexture,i.TEXTURE0+k);const ee=n.get(z);if(z.version!==ee.__version||O===!0){t.activeTexture(i.TEXTURE0+k);const te=Je.getPrimaries(Je.workingColorSpace),K=_.colorSpace===Bn?null:Je.getPrimaries(_.colorSpace),J=_.colorSpace===Bn||te===K?i.NONE:i.BROWSER_DEFAULT_WEBGL;t.pixelStorei(i.UNPACK_FLIP_Y_WEBGL,_.flipY),t.pixelStorei(i.UNPACK_PREMULTIPLY_ALPHA_WEBGL,_.premultiplyAlpha),t.pixelStorei(i.UNPACK_ALIGNMENT,_.unpackAlignment),t.pixelStorei(i.UNPACK_COLORSPACE_CONVERSION_WEBGL,J);const de=_.isCompressedTexture||_.image[0].isCompressedTexture,Ee=_.image[0]&&_.image[0].isDataTexture,ue=[];for(let B=0;B<6;B++)!de&&!Ee?ue[B]=m(_.image[B],!0,s.maxCubemapSize):ue[B]=Ee?_.image[B].image:_.image[B],ue[B]=Lt(_,ue[B]);const ce=ue[0],Te=a.convert(_.format,_.colorSpace),Ce=a.convert(_.type),Ue=S(_.internalFormat,Te,Ce,_.normalized,_.colorSpace),U=_.isVideoTexture!==!0,he=ee.__version===void 0||O===!0,Q=z.dataReady;let fe=E(_,ce);qe(i.TEXTURE_CUBE_MAP,_);let me;if(de){U&&he&&t.texStorage2D(i.TEXTURE_CUBE_MAP,fe,Ue,ce.width,ce.height);for(let B=0;B<6;B++){me=ue[B].mipmaps;for(let ae=0;ae<me.length;ae++){const ne=me[ae];_.format!==_n?Te!==null?U?Q&&t.compressedTexSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,ae,0,0,ne.width,ne.height,Te,ne.data):t.compressedTexImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,ae,Ue,ne.width,ne.height,0,ne.data):Fe("WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):U?Q&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,ae,0,0,ne.width,ne.height,Te,Ce,ne.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,ae,Ue,ne.width,ne.height,0,Te,Ce,ne.data)}}}else{if(me=_.mipmaps,U&&he){me.length>0&&fe++;const B=oe(ue[0]);t.texStorage2D(i.TEXTURE_CUBE_MAP,fe,Ue,B.width,B.height)}for(let B=0;B<6;B++)if(Ee){U?Q&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,0,0,0,ue[B].width,ue[B].height,Te,Ce,ue[B].data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,0,Ue,ue[B].width,ue[B].height,0,Te,Ce,ue[B].data);for(let ae=0;ae<me.length;ae++){const xe=me[ae].image[B].image;U?Q&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,ae+1,0,0,xe.width,xe.height,Te,Ce,xe.data):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,ae+1,Ue,xe.width,xe.height,0,Te,Ce,xe.data)}}else{U?Q&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,0,0,0,Te,Ce,ue[B]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,0,Ue,Te,Ce,ue[B]);for(let ae=0;ae<me.length;ae++){const ne=me[ae];U?Q&&t.texSubImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,ae+1,0,0,Te,Ce,ne.image[B]):t.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+B,ae+1,Ue,Te,Ce,ne.image[B])}}}f(_)&&M(i.TEXTURE_CUBE_MAP),ee.__version=z.version,_.onUpdate&&_.onUpdate(_)}A.__version=_.version}function Ae(A,_,k,O,z,ee){const te=a.convert(k.format,k.colorSpace),K=a.convert(k.type),J=S(k.internalFormat,te,K,k.normalized,k.colorSpace),de=n.get(_),Ee=n.get(k);if(Ee.__renderTarget=_,!de.__hasExternalTextures){const ue=Math.max(1,_.width>>ee),ce=Math.max(1,_.height>>ee);z===i.TEXTURE_3D||z===i.TEXTURE_2D_ARRAY?t.texImage3D(z,ee,J,ue,ce,_.depth,0,te,K,null):t.texImage2D(z,ee,J,ue,ce,0,te,K,null)}t.bindFramebuffer(i.FRAMEBUFFER,A),ot(_)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,O,z,Ee.__webglTexture,0,it(_)):(z===i.TEXTURE_2D||z>=i.TEXTURE_CUBE_MAP_POSITIVE_X&&z<=i.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&i.framebufferTexture2D(i.FRAMEBUFFER,O,z,Ee.__webglTexture,ee),t.bindFramebuffer(i.FRAMEBUFFER,null)}function nt(A,_,k){if(i.bindRenderbuffer(i.RENDERBUFFER,A),_.depthBuffer){const O=_.depthTexture,z=O&&O.isDepthTexture?O.type:null,ee=b(_.stencilBuffer,z),te=_.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;ot(_)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,it(_),ee,_.width,_.height):k?i.renderbufferStorageMultisample(i.RENDERBUFFER,it(_),ee,_.width,_.height):i.renderbufferStorage(i.RENDERBUFFER,ee,_.width,_.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,te,i.RENDERBUFFER,A)}else{const O=_.textures;for(let z=0;z<O.length;z++){const ee=O[z],te=a.convert(ee.format,ee.colorSpace),K=a.convert(ee.type),J=S(ee.internalFormat,te,K,ee.normalized,ee.colorSpace);ot(_)?o.renderbufferStorageMultisampleEXT(i.RENDERBUFFER,it(_),J,_.width,_.height):k?i.renderbufferStorageMultisample(i.RENDERBUFFER,it(_),J,_.width,_.height):i.renderbufferStorage(i.RENDERBUFFER,J,_.width,_.height)}}i.bindRenderbuffer(i.RENDERBUFFER,null)}function De(A,_,k){const O=_.isWebGLCubeRenderTarget===!0;if(t.bindFramebuffer(i.FRAMEBUFFER,A),!(_.depthTexture&&_.depthTexture.isDepthTexture))throw new Error("THREE.WebGLTextures: renderTarget.depthTexture must be an instance of THREE.DepthTexture.");const z=n.get(_.depthTexture);if(z.__renderTarget=_,(!z.__webglTexture||_.depthTexture.image.width!==_.width||_.depthTexture.image.height!==_.height)&&(_.depthTexture.image.width=_.width,_.depthTexture.image.height=_.height,_.depthTexture.needsUpdate=!0),O){if(z.__webglInit===void 0&&(z.__webglInit=!0,_.depthTexture.addEventListener("dispose",R)),z.__webglTexture===void 0){z.__webglTexture=i.createTexture(),t.bindTexture(i.TEXTURE_CUBE_MAP,z.__webglTexture),qe(i.TEXTURE_CUBE_MAP,_.depthTexture);const de=a.convert(_.depthTexture.format),Ee=a.convert(_.depthTexture.type);let ue;_.depthTexture.format===qn?ue=i.DEPTH_COMPONENT24:_.depthTexture.format===xi&&(ue=i.DEPTH24_STENCIL8);for(let ce=0;ce<6;ce++)i.texImage2D(i.TEXTURE_CUBE_MAP_POSITIVE_X+ce,0,ue,_.width,_.height,0,de,Ee,null)}}else j(_.depthTexture,0);const ee=z.__webglTexture,te=it(_),K=O?i.TEXTURE_CUBE_MAP_POSITIVE_X+k:i.TEXTURE_2D,J=_.depthTexture.format===xi?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;if(_.depthTexture.format===qn)ot(_)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,J,K,ee,0,te):i.framebufferTexture2D(i.FRAMEBUFFER,J,K,ee,0);else if(_.depthTexture.format===xi)ot(_)?o.framebufferTexture2DMultisampleEXT(i.FRAMEBUFFER,J,K,ee,0,te):i.framebufferTexture2D(i.FRAMEBUFFER,J,K,ee,0);else throw new Error("THREE.WebGLTextures: Unknown depthTexture format.")}function Ke(A){const _=n.get(A),k=A.isWebGLCubeRenderTarget===!0;if(_.__boundDepthTexture!==A.depthTexture){const O=A.depthTexture;if(_.__depthDisposeCallback&&_.__depthDisposeCallback(),O){const z=()=>{delete _.__boundDepthTexture,delete _.__depthDisposeCallback,O.removeEventListener("dispose",z)};O.addEventListener("dispose",z),_.__depthDisposeCallback=z}_.__boundDepthTexture=O}if(A.depthTexture&&!_.__autoAllocateDepthBuffer)if(k)for(let O=0;O<6;O++)De(_.__webglFramebuffer[O],A,O);else{const O=A.texture.mipmaps;O&&O.length>0?De(_.__webglFramebuffer[0],A,0):De(_.__webglFramebuffer,A,0)}else if(k){_.__webglDepthbuffer=[];for(let O=0;O<6;O++)if(t.bindFramebuffer(i.FRAMEBUFFER,_.__webglFramebuffer[O]),_.__webglDepthbuffer[O]===void 0)_.__webglDepthbuffer[O]=i.createRenderbuffer(),nt(_.__webglDepthbuffer[O],A,!1);else{const z=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ee=_.__webglDepthbuffer[O];i.bindRenderbuffer(i.RENDERBUFFER,ee),i.framebufferRenderbuffer(i.FRAMEBUFFER,z,i.RENDERBUFFER,ee)}}else{const O=A.texture.mipmaps;if(O&&O.length>0?t.bindFramebuffer(i.FRAMEBUFFER,_.__webglFramebuffer[0]):t.bindFramebuffer(i.FRAMEBUFFER,_.__webglFramebuffer),_.__webglDepthbuffer===void 0)_.__webglDepthbuffer=i.createRenderbuffer(),nt(_.__webglDepthbuffer,A,!1);else{const z=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,ee=_.__webglDepthbuffer;i.bindRenderbuffer(i.RENDERBUFFER,ee),i.framebufferRenderbuffer(i.FRAMEBUFFER,z,i.RENDERBUFFER,ee)}}t.bindFramebuffer(i.FRAMEBUFFER,null)}function Ze(A,_,k){const O=n.get(A);_!==void 0&&Ae(O.__webglFramebuffer,A,A.texture,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,0),k!==void 0&&Ke(A)}function He(A){const _=A.texture,k=n.get(A),O=n.get(_);A.addEventListener("dispose",v);const z=A.textures,ee=A.isWebGLCubeRenderTarget===!0,te=z.length>1;if(te||(O.__webglTexture===void 0&&(O.__webglTexture=i.createTexture()),O.__version=_.version,r.memory.textures++),ee){k.__webglFramebuffer=[];for(let K=0;K<6;K++)if(_.mipmaps&&_.mipmaps.length>0){k.__webglFramebuffer[K]=[];for(let J=0;J<_.mipmaps.length;J++)k.__webglFramebuffer[K][J]=i.createFramebuffer()}else k.__webglFramebuffer[K]=i.createFramebuffer()}else{if(_.mipmaps&&_.mipmaps.length>0){k.__webglFramebuffer=[];for(let K=0;K<_.mipmaps.length;K++)k.__webglFramebuffer[K]=i.createFramebuffer()}else k.__webglFramebuffer=i.createFramebuffer();if(te)for(let K=0,J=z.length;K<J;K++){const de=n.get(z[K]);de.__webglTexture===void 0&&(de.__webglTexture=i.createTexture(),r.memory.textures++)}if(A.samples>0&&ot(A)===!1){k.__webglMultisampledFramebuffer=i.createFramebuffer(),k.__webglColorRenderbuffer=[],t.bindFramebuffer(i.FRAMEBUFFER,k.__webglMultisampledFramebuffer);for(let K=0;K<z.length;K++){const J=z[K];k.__webglColorRenderbuffer[K]=i.createRenderbuffer(),i.bindRenderbuffer(i.RENDERBUFFER,k.__webglColorRenderbuffer[K]);const de=a.convert(J.format,J.colorSpace),Ee=a.convert(J.type),ue=S(J.internalFormat,de,Ee,J.normalized,J.colorSpace,A.isXRRenderTarget===!0),ce=it(A);i.renderbufferStorageMultisample(i.RENDERBUFFER,ce,ue,A.width,A.height),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+K,i.RENDERBUFFER,k.__webglColorRenderbuffer[K])}i.bindRenderbuffer(i.RENDERBUFFER,null),A.depthBuffer&&(k.__webglDepthRenderbuffer=i.createRenderbuffer(),nt(k.__webglDepthRenderbuffer,A,!0)),t.bindFramebuffer(i.FRAMEBUFFER,null)}}if(ee){t.bindTexture(i.TEXTURE_CUBE_MAP,O.__webglTexture),qe(i.TEXTURE_CUBE_MAP,_);for(let K=0;K<6;K++)if(_.mipmaps&&_.mipmaps.length>0)for(let J=0;J<_.mipmaps.length;J++)Ae(k.__webglFramebuffer[K][J],A,_,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+K,J);else Ae(k.__webglFramebuffer[K],A,_,i.COLOR_ATTACHMENT0,i.TEXTURE_CUBE_MAP_POSITIVE_X+K,0);f(_)&&M(i.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(te){for(let K=0,J=z.length;K<J;K++){const de=z[K],Ee=n.get(de);let ue=i.TEXTURE_2D;(A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(ue=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(ue,Ee.__webglTexture),qe(ue,de),Ae(k.__webglFramebuffer,A,de,i.COLOR_ATTACHMENT0+K,ue,0),f(de)&&M(ue)}t.unbindTexture()}else{let K=i.TEXTURE_2D;if((A.isWebGL3DRenderTarget||A.isWebGLArrayRenderTarget)&&(K=A.isWebGL3DRenderTarget?i.TEXTURE_3D:i.TEXTURE_2D_ARRAY),t.bindTexture(K,O.__webglTexture),qe(K,_),_.mipmaps&&_.mipmaps.length>0)for(let J=0;J<_.mipmaps.length;J++)Ae(k.__webglFramebuffer[J],A,_,i.COLOR_ATTACHMENT0,K,J);else Ae(k.__webglFramebuffer,A,_,i.COLOR_ATTACHMENT0,K,0);f(_)&&M(K),t.unbindTexture()}A.depthBuffer&&Ke(A)}function rt(A){const _=A.textures;for(let k=0,O=_.length;k<O;k++){const z=_[k];if(f(z)){const ee=w(A),te=n.get(z).__webglTexture;t.bindTexture(ee,te),M(ee),t.unbindTexture()}}}const mt=[],gt=[];function Mt(A){if(A.samples>0){if(ot(A)===!1){const _=A.textures,k=A.width,O=A.height;let z=i.COLOR_BUFFER_BIT;const ee=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT,te=n.get(A),K=_.length>1;if(K)for(let de=0;de<_.length;de++)t.bindFramebuffer(i.FRAMEBUFFER,te.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+de,i.RENDERBUFFER,null),t.bindFramebuffer(i.FRAMEBUFFER,te.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+de,i.TEXTURE_2D,null,0);t.bindFramebuffer(i.READ_FRAMEBUFFER,te.__webglMultisampledFramebuffer);const J=A.texture.mipmaps;J&&J.length>0?t.bindFramebuffer(i.DRAW_FRAMEBUFFER,te.__webglFramebuffer[0]):t.bindFramebuffer(i.DRAW_FRAMEBUFFER,te.__webglFramebuffer);for(let de=0;de<_.length;de++){if(A.resolveDepthBuffer&&(A.depthBuffer&&(z|=i.DEPTH_BUFFER_BIT),A.stencilBuffer&&A.resolveStencilBuffer&&(z|=i.STENCIL_BUFFER_BIT)),K){i.framebufferRenderbuffer(i.READ_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.RENDERBUFFER,te.__webglColorRenderbuffer[de]);const Ee=n.get(_[de]).__webglTexture;i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0,i.TEXTURE_2D,Ee,0)}i.blitFramebuffer(0,0,k,O,0,0,k,O,z,i.NEAREST),l===!0&&(mt.length=0,gt.length=0,mt.push(i.COLOR_ATTACHMENT0+de),A.depthBuffer&&A.resolveDepthBuffer===!1&&(mt.push(ee),gt.push(ee),i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,gt)),i.invalidateFramebuffer(i.READ_FRAMEBUFFER,mt))}if(t.bindFramebuffer(i.READ_FRAMEBUFFER,null),t.bindFramebuffer(i.DRAW_FRAMEBUFFER,null),K)for(let de=0;de<_.length;de++){t.bindFramebuffer(i.FRAMEBUFFER,te.__webglMultisampledFramebuffer),i.framebufferRenderbuffer(i.FRAMEBUFFER,i.COLOR_ATTACHMENT0+de,i.RENDERBUFFER,te.__webglColorRenderbuffer[de]);const Ee=n.get(_[de]).__webglTexture;t.bindFramebuffer(i.FRAMEBUFFER,te.__webglFramebuffer),i.framebufferTexture2D(i.DRAW_FRAMEBUFFER,i.COLOR_ATTACHMENT0+de,i.TEXTURE_2D,Ee,0)}t.bindFramebuffer(i.DRAW_FRAMEBUFFER,te.__webglMultisampledFramebuffer)}else if(A.depthBuffer&&A.resolveDepthBuffer===!1&&l){const _=A.stencilBuffer?i.DEPTH_STENCIL_ATTACHMENT:i.DEPTH_ATTACHMENT;i.invalidateFramebuffer(i.DRAW_FRAMEBUFFER,[_])}}}function it(A){return Math.min(s.maxSamples,A.samples)}function ot(A){const _=n.get(A);return A.samples>0&&e.has("WEBGL_multisampled_render_to_texture")===!0&&_.__useRenderToTexture!==!1}function D(A){const _=r.render.frame;h.get(A)!==_&&(h.set(A,_),A.update())}function Lt(A,_){const k=A.colorSpace,O=A.format,z=A.type;return A.isCompressedTexture===!0||A.isVideoTexture===!0||k!==la&&k!==Bn&&(Je.getTransfer(k)===lt?(O!==_n||z!==on)&&Fe("WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):et("WebGLTextures: Unsupported texture color space:",k)),_}function oe(A){return typeof HTMLImageElement<"u"&&A instanceof HTMLImageElement?(c.width=A.naturalWidth||A.width,c.height=A.naturalHeight||A.height):typeof VideoFrame<"u"&&A instanceof VideoFrame?(c.width=A.displayWidth,c.height=A.displayHeight):(c.width=A.width,c.height=A.height),c}this.allocateTextureUnit=X,this.resetTextureUnits=q,this.getTextureUnits=Z,this.setTextureUnits=N,this.setTexture2D=j,this.setTexture2DArray=se,this.setTexture3D=pe,this.setTextureCube=re,this.rebindTextures=Ze,this.setupRenderTarget=He,this.updateRenderTargetMipmap=rt,this.updateMultisampleRenderTarget=Mt,this.setupDepthRenderbuffer=Ke,this.setupFrameBufferTexture=Ae,this.useMultisampledRTT=ot,this.isReversedDepthBuffer=function(){return t.buffers.depth.getReversed()}}function J0(i,e){function t(n,s=Bn){let a;const r=Je.getTransfer(s);if(n===on)return i.UNSIGNED_BYTE;if(n===ro)return i.UNSIGNED_SHORT_4_4_4_4;if(n===oo)return i.UNSIGNED_SHORT_5_5_5_1;if(n===Zl)return i.UNSIGNED_INT_5_9_9_9_REV;if(n===Jl)return i.UNSIGNED_INT_10F_11F_11F_REV;if(n===Yl)return i.BYTE;if(n===Kl)return i.SHORT;if(n===fs)return i.UNSIGNED_SHORT;if(n===ao)return i.INT;if(n===Ln)return i.UNSIGNED_INT;if(n===An)return i.FLOAT;if(n===Wn)return i.HALF_FLOAT;if(n===$l)return i.ALPHA;if(n===Ql)return i.RGB;if(n===_n)return i.RGBA;if(n===qn)return i.DEPTH_COMPONENT;if(n===xi)return i.DEPTH_STENCIL;if(n===jl)return i.RED;if(n===lo)return i.RED_INTEGER;if(n===Ei)return i.RG;if(n===co)return i.RG_INTEGER;if(n===ho)return i.RGBA_INTEGER;if(n===Qs||n===js||n===ea||n===ta)if(r===lt)if(a=e.get("WEBGL_compressed_texture_s3tc_srgb"),a!==null){if(n===Qs)return a.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(n===js)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(n===ea)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(n===ta)return a.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(a=e.get("WEBGL_compressed_texture_s3tc"),a!==null){if(n===Qs)return a.COMPRESSED_RGB_S3TC_DXT1_EXT;if(n===js)return a.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(n===ea)return a.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(n===ta)return a.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(n===mr||n===gr||n===_r||n===vr)if(a=e.get("WEBGL_compressed_texture_pvrtc"),a!==null){if(n===mr)return a.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(n===gr)return a.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(n===_r)return a.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(n===vr)return a.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(n===xr||n===Mr||n===Sr||n===br||n===yr||n===ra||n===Er)if(a=e.get("WEBGL_compressed_texture_etc"),a!==null){if(n===xr||n===Mr)return r===lt?a.COMPRESSED_SRGB8_ETC2:a.COMPRESSED_RGB8_ETC2;if(n===Sr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:a.COMPRESSED_RGBA8_ETC2_EAC;if(n===br)return a.COMPRESSED_R11_EAC;if(n===yr)return a.COMPRESSED_SIGNED_R11_EAC;if(n===ra)return a.COMPRESSED_RG11_EAC;if(n===Er)return a.COMPRESSED_SIGNED_RG11_EAC}else return null;if(n===Tr||n===wr||n===Ar||n===Rr||n===Cr||n===Pr||n===Lr||n===Ir||n===Dr||n===Ur||n===kr||n===Nr||n===Fr||n===Or)if(a=e.get("WEBGL_compressed_texture_astc"),a!==null){if(n===Tr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:a.COMPRESSED_RGBA_ASTC_4x4_KHR;if(n===wr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:a.COMPRESSED_RGBA_ASTC_5x4_KHR;if(n===Ar)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:a.COMPRESSED_RGBA_ASTC_5x5_KHR;if(n===Rr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:a.COMPRESSED_RGBA_ASTC_6x5_KHR;if(n===Cr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:a.COMPRESSED_RGBA_ASTC_6x6_KHR;if(n===Pr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:a.COMPRESSED_RGBA_ASTC_8x5_KHR;if(n===Lr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:a.COMPRESSED_RGBA_ASTC_8x6_KHR;if(n===Ir)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:a.COMPRESSED_RGBA_ASTC_8x8_KHR;if(n===Dr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:a.COMPRESSED_RGBA_ASTC_10x5_KHR;if(n===Ur)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:a.COMPRESSED_RGBA_ASTC_10x6_KHR;if(n===kr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:a.COMPRESSED_RGBA_ASTC_10x8_KHR;if(n===Nr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:a.COMPRESSED_RGBA_ASTC_10x10_KHR;if(n===Fr)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:a.COMPRESSED_RGBA_ASTC_12x10_KHR;if(n===Or)return r===lt?a.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:a.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(n===Br||n===Hr||n===Gr)if(a=e.get("EXT_texture_compression_bptc"),a!==null){if(n===Br)return r===lt?a.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:a.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(n===Hr)return a.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(n===Gr)return a.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(n===Vr||n===zr||n===oa||n===Wr)if(a=e.get("EXT_texture_compression_rgtc"),a!==null){if(n===Vr)return a.COMPRESSED_RED_RGTC1_EXT;if(n===zr)return a.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(n===oa)return a.COMPRESSED_RED_GREEN_RGTC2_EXT;if(n===Wr)return a.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return n===ps?i.UNSIGNED_INT_24_8:i[n]!==void 0?i[n]:null}return{convert:t}}const $0=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,Q0=`
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

}`;class j0{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(e,t){if(this.texture===null){const n=new cc(e.texture);(e.depthNear!==t.depthNear||e.depthFar!==t.depthFar)&&(this.depthNear=e.depthNear,this.depthFar=e.depthFar),this.texture=n}}getMesh(e){if(this.texture!==null&&this.mesh===null){const t=e.cameras[0].viewport,n=new $t({vertexShader:$0,fragmentShader:Q0,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new Ye(new _t(20,20),n)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class em extends Ti{constructor(e,t){super();const n=this;let s=null,a=1,r=null,o="local-floor",l=1,c=null,h=null,u=null,d=null,p=null,g=null;const x=typeof XRWebGLBinding<"u",m=new j0,f={},M=t.getContextAttributes();let w=null,S=null;const b=[],E=[],R=new ze;let v=null;const T=new rn;T.viewport=new xt;const C=new rn;C.viewport=new xt;const P=[T,C],L=new cd;let q=null,Z=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function($){let le=b[$];return le===void 0&&(le=new La,b[$]=le),le.getTargetRaySpace()},this.getControllerGrip=function($){let le=b[$];return le===void 0&&(le=new La,b[$]=le),le.getGripSpace()},this.getHand=function($){let le=b[$];return le===void 0&&(le=new La,b[$]=le),le.getHandSpace()};function N($){const le=E.indexOf($.inputSource);if(le===-1)return;const ie=b[le];ie!==void 0&&(ie.update($.inputSource,$.frame,c||r),ie.dispatchEvent({type:$.type,data:$.inputSource}))}function X(){s.removeEventListener("select",N),s.removeEventListener("selectstart",N),s.removeEventListener("selectend",N),s.removeEventListener("squeeze",N),s.removeEventListener("squeezestart",N),s.removeEventListener("squeezeend",N),s.removeEventListener("end",X),s.removeEventListener("inputsourceschange",G);for(let $=0;$<b.length;$++){const le=E[$];le!==null&&(E[$]=null,b[$].disconnect(le))}q=null,Z=null,m.reset();for(const $ in f)delete f[$];e.setRenderTarget(w),p=null,d=null,u=null,s=null,S=null,qe.stop(),n.isPresenting=!1,e.setPixelRatio(v),e.setSize(R.width,R.height,!1),n.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function($){a=$,n.isPresenting===!0&&Fe("WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function($){o=$,n.isPresenting===!0&&Fe("WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return c||r},this.setReferenceSpace=function($){c=$},this.getBaseLayer=function(){return d!==null?d:p},this.getBinding=function(){return u===null&&x&&(u=new XRWebGLBinding(s,t)),u},this.getFrame=function(){return g},this.getSession=function(){return s},this.setSession=async function($){if(s=$,s!==null){if(w=e.getRenderTarget(),s.addEventListener("select",N),s.addEventListener("selectstart",N),s.addEventListener("selectend",N),s.addEventListener("squeeze",N),s.addEventListener("squeezestart",N),s.addEventListener("squeezeend",N),s.addEventListener("end",X),s.addEventListener("inputsourceschange",G),M.xrCompatible!==!0&&await t.makeXRCompatible(),v=e.getPixelRatio(),e.getSize(R),x&&"createProjectionLayer"in XRWebGLBinding.prototype){let ie=null,Ie=null,ke=null;M.depth&&(ke=M.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,ie=M.stencil?xi:qn,Ie=M.stencil?ps:Ln);const Ae={colorFormat:t.RGBA8,depthFormat:ke,scaleFactor:a};u=this.getBinding(),d=u.createProjectionLayer(Ae),s.updateRenderState({layers:[d]}),e.setPixelRatio(1),e.setSize(d.textureWidth,d.textureHeight,!1),S=new Pn(d.textureWidth,d.textureHeight,{format:_n,type:on,depthTexture:new Ki(d.textureWidth,d.textureHeight,Ie,void 0,void 0,void 0,void 0,void 0,void 0,ie),stencilBuffer:M.stencil,colorSpace:e.outputColorSpace,samples:M.antialias?4:0,resolveDepthBuffer:d.ignoreDepthValues===!1,resolveStencilBuffer:d.ignoreDepthValues===!1})}else{const ie={antialias:M.antialias,alpha:!0,depth:M.depth,stencil:M.stencil,framebufferScaleFactor:a};p=new XRWebGLLayer(s,t,ie),s.updateRenderState({baseLayer:p}),e.setPixelRatio(1),e.setSize(p.framebufferWidth,p.framebufferHeight,!1),S=new Pn(p.framebufferWidth,p.framebufferHeight,{format:_n,type:on,colorSpace:e.outputColorSpace,stencilBuffer:M.stencil,resolveDepthBuffer:p.ignoreDepthValues===!1,resolveStencilBuffer:p.ignoreDepthValues===!1})}S.isXRRenderTarget=!0,this.setFoveation(l),c=null,r=await s.requestReferenceSpace(o),qe.setContext(s),qe.start(),n.isPresenting=!0,n.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(s!==null)return s.environmentBlendMode},this.getDepthTexture=function(){return m.getDepthTexture()};function G($){for(let le=0;le<$.removed.length;le++){const ie=$.removed[le],Ie=E.indexOf(ie);Ie>=0&&(E[Ie]=null,b[Ie].disconnect(ie))}for(let le=0;le<$.added.length;le++){const ie=$.added[le];let Ie=E.indexOf(ie);if(Ie===-1){for(let Ae=0;Ae<b.length;Ae++)if(Ae>=E.length){E.push(ie),Ie=Ae;break}else if(E[Ae]===null){E[Ae]=ie,Ie=Ae;break}if(Ie===-1)break}const ke=b[Ie];ke&&ke.connect(ie)}}const j=new I,se=new I;function pe($,le,ie){j.setFromMatrixPosition(le.matrixWorld),se.setFromMatrixPosition(ie.matrixWorld);const Ie=j.distanceTo(se),ke=le.projectionMatrix.elements,Ae=ie.projectionMatrix.elements,nt=ke[14]/(ke[10]-1),De=ke[14]/(ke[10]+1),Ke=(ke[9]+1)/ke[5],Ze=(ke[9]-1)/ke[5],He=(ke[8]-1)/ke[0],rt=(Ae[8]+1)/Ae[0],mt=nt*He,gt=nt*rt,Mt=Ie/(-He+rt),it=Mt*-He;if(le.matrixWorld.decompose($.position,$.quaternion,$.scale),$.translateX(it),$.translateZ(Mt),$.matrixWorld.compose($.position,$.quaternion,$.scale),$.matrixWorldInverse.copy($.matrixWorld).invert(),ke[10]===-1)$.projectionMatrix.copy(le.projectionMatrix),$.projectionMatrixInverse.copy(le.projectionMatrixInverse);else{const ot=nt+Mt,D=De+Mt,Lt=mt-it,oe=gt+(Ie-it),A=Ke*De/D*ot,_=Ze*De/D*ot;$.projectionMatrix.makePerspective(Lt,oe,A,_,ot,D),$.projectionMatrixInverse.copy($.projectionMatrix).invert()}}function re($,le){le===null?$.matrixWorld.copy($.matrix):$.matrixWorld.multiplyMatrices(le.matrixWorld,$.matrix),$.matrixWorldInverse.copy($.matrixWorld).invert()}this.updateCamera=function($){if(s===null)return;let le=$.near,ie=$.far;m.texture!==null&&(m.depthNear>0&&(le=m.depthNear),m.depthFar>0&&(ie=m.depthFar)),L.near=C.near=T.near=le,L.far=C.far=T.far=ie,(q!==L.near||Z!==L.far)&&(s.updateRenderState({depthNear:L.near,depthFar:L.far}),q=L.near,Z=L.far),L.layers.mask=$.layers.mask|6,T.layers.mask=L.layers.mask&-5,C.layers.mask=L.layers.mask&-3;const Ie=$.parent,ke=L.cameras;re(L,Ie);for(let Ae=0;Ae<ke.length;Ae++)re(ke[Ae],Ie);ke.length===2?pe(L,T,C):L.projectionMatrix.copy(T.projectionMatrix),Me($,L,Ie)};function Me($,le,ie){ie===null?$.matrix.copy(le.matrixWorld):($.matrix.copy(ie.matrixWorld),$.matrix.invert(),$.matrix.multiply(le.matrixWorld)),$.matrix.decompose($.position,$.quaternion,$.scale),$.updateMatrixWorld(!0),$.projectionMatrix.copy(le.projectionMatrix),$.projectionMatrixInverse.copy(le.projectionMatrixInverse),$.isPerspectiveCamera&&($.fov=Xr*2*Math.atan(1/$.projectionMatrix.elements[5]),$.zoom=1)}this.getCamera=function(){return L},this.getFoveation=function(){if(!(d===null&&p===null))return l},this.setFoveation=function($){l=$,d!==null&&(d.fixedFoveation=$),p!==null&&p.fixedFoveation!==void 0&&(p.fixedFoveation=$)},this.hasDepthSensing=function(){return m.texture!==null},this.getDepthSensingMesh=function(){return m.getMesh(L)},this.getCameraTexture=function($){return f[$]};let Be=null;function tt($,le){if(h=le.getViewerPose(c||r),g=le,h!==null){const ie=h.views;p!==null&&(e.setRenderTargetFramebuffer(S,p.framebuffer),e.setRenderTarget(S));let Ie=!1;ie.length!==L.cameras.length&&(L.cameras.length=0,Ie=!0);for(let De=0;De<ie.length;De++){const Ke=ie[De];let Ze=null;if(p!==null)Ze=p.getViewport(Ke);else{const rt=u.getViewSubImage(d,Ke);Ze=rt.viewport,De===0&&(e.setRenderTargetTextures(S,rt.colorTexture,rt.depthStencilTexture),e.setRenderTarget(S))}let He=P[De];He===void 0&&(He=new rn,He.layers.enable(De),He.viewport=new xt,P[De]=He),He.matrix.fromArray(Ke.transform.matrix),He.matrix.decompose(He.position,He.quaternion,He.scale),He.projectionMatrix.fromArray(Ke.projectionMatrix),He.projectionMatrixInverse.copy(He.projectionMatrix).invert(),He.viewport.set(Ze.x,Ze.y,Ze.width,Ze.height),De===0&&(L.matrix.copy(He.matrix),L.matrix.decompose(L.position,L.quaternion,L.scale)),Ie===!0&&L.cameras.push(He)}const ke=s.enabledFeatures;if(ke&&ke.includes("depth-sensing")&&s.depthUsage=="gpu-optimized"&&x){u=n.getBinding();const De=u.getDepthInformation(ie[0]);De&&De.isValid&&De.texture&&m.init(De,s.renderState)}if(ke&&ke.includes("camera-access")&&x){e.state.unbindTexture(),u=n.getBinding();for(let De=0;De<ie.length;De++){const Ke=ie[De].camera;if(Ke){let Ze=f[Ke];Ze||(Ze=new cc,f[Ke]=Ze);const He=u.getCameraImage(Ke);Ze.sourceTexture=He}}}}for(let ie=0;ie<b.length;ie++){const Ie=E[ie],ke=b[ie];Ie!==null&&ke!==void 0&&ke.update(Ie,le,c||r)}Be&&Be($,le),le.detectedPlanes&&n.dispatchEvent({type:"planesdetected",data:le}),g=null}const qe=new mc;qe.setAnimationLoop(tt),this.setAnimationLoop=function($){Be=$},this.dispose=function(){}}}const tm=new pt,bc=new Oe;bc.set(-1,0,0,0,1,0,0,0,1);function nm(i,e){function t(m,f){m.matrixAutoUpdate===!0&&m.updateMatrix(),f.value.copy(m.matrix)}function n(m,f){f.color.getRGB(m.fogColor.value,hc(i)),f.isFog?(m.fogNear.value=f.near,m.fogFar.value=f.far):f.isFogExp2&&(m.fogDensity.value=f.density)}function s(m,f,M,w,S){f.isNodeMaterial?f.uniformsNeedUpdate=!1:f.isMeshBasicMaterial?a(m,f):f.isMeshLambertMaterial?(a(m,f),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)):f.isMeshToonMaterial?(a(m,f),u(m,f)):f.isMeshPhongMaterial?(a(m,f),h(m,f),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)):f.isMeshStandardMaterial?(a(m,f),d(m,f),f.isMeshPhysicalMaterial&&p(m,f,S)):f.isMeshMatcapMaterial?(a(m,f),g(m,f)):f.isMeshDepthMaterial?a(m,f):f.isMeshDistanceMaterial?(a(m,f),x(m,f)):f.isMeshNormalMaterial?a(m,f):f.isLineBasicMaterial?(r(m,f),f.isLineDashedMaterial&&o(m,f)):f.isPointsMaterial?l(m,f,M,w):f.isSpriteMaterial?c(m,f):f.isShadowMaterial?(m.color.value.copy(f.color),m.opacity.value=f.opacity):f.isShaderMaterial&&(f.uniformsNeedUpdate=!1)}function a(m,f){m.opacity.value=f.opacity,f.color&&m.diffuse.value.copy(f.color),f.emissive&&m.emissive.value.copy(f.emissive).multiplyScalar(f.emissiveIntensity),f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.bumpMap&&(m.bumpMap.value=f.bumpMap,t(f.bumpMap,m.bumpMapTransform),m.bumpScale.value=f.bumpScale,f.side===Jt&&(m.bumpScale.value*=-1)),f.normalMap&&(m.normalMap.value=f.normalMap,t(f.normalMap,m.normalMapTransform),m.normalScale.value.copy(f.normalScale),f.side===Jt&&m.normalScale.value.negate()),f.displacementMap&&(m.displacementMap.value=f.displacementMap,t(f.displacementMap,m.displacementMapTransform),m.displacementScale.value=f.displacementScale,m.displacementBias.value=f.displacementBias),f.emissiveMap&&(m.emissiveMap.value=f.emissiveMap,t(f.emissiveMap,m.emissiveMapTransform)),f.specularMap&&(m.specularMap.value=f.specularMap,t(f.specularMap,m.specularMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest);const M=e.get(f),w=M.envMap,S=M.envMapRotation;w&&(m.envMap.value=w,m.envMapRotation.value.setFromMatrix4(tm.makeRotationFromEuler(S)).transpose(),w.isCubeTexture&&w.isRenderTargetTexture===!1&&m.envMapRotation.value.premultiply(bc),m.reflectivity.value=f.reflectivity,m.ior.value=f.ior,m.refractionRatio.value=f.refractionRatio),f.lightMap&&(m.lightMap.value=f.lightMap,m.lightMapIntensity.value=f.lightMapIntensity,t(f.lightMap,m.lightMapTransform)),f.aoMap&&(m.aoMap.value=f.aoMap,m.aoMapIntensity.value=f.aoMapIntensity,t(f.aoMap,m.aoMapTransform))}function r(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform))}function o(m,f){m.dashSize.value=f.dashSize,m.totalSize.value=f.dashSize+f.gapSize,m.scale.value=f.scale}function l(m,f,M,w){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.size.value=f.size*M,m.scale.value=w*.5,f.map&&(m.map.value=f.map,t(f.map,m.uvTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function c(m,f){m.diffuse.value.copy(f.color),m.opacity.value=f.opacity,m.rotation.value=f.rotation,f.map&&(m.map.value=f.map,t(f.map,m.mapTransform)),f.alphaMap&&(m.alphaMap.value=f.alphaMap,t(f.alphaMap,m.alphaMapTransform)),f.alphaTest>0&&(m.alphaTest.value=f.alphaTest)}function h(m,f){m.specular.value.copy(f.specular),m.shininess.value=Math.max(f.shininess,1e-4)}function u(m,f){f.gradientMap&&(m.gradientMap.value=f.gradientMap)}function d(m,f){m.metalness.value=f.metalness,f.metalnessMap&&(m.metalnessMap.value=f.metalnessMap,t(f.metalnessMap,m.metalnessMapTransform)),m.roughness.value=f.roughness,f.roughnessMap&&(m.roughnessMap.value=f.roughnessMap,t(f.roughnessMap,m.roughnessMapTransform)),f.envMap&&(m.envMapIntensity.value=f.envMapIntensity)}function p(m,f,M){m.ior.value=f.ior,f.sheen>0&&(m.sheenColor.value.copy(f.sheenColor).multiplyScalar(f.sheen),m.sheenRoughness.value=f.sheenRoughness,f.sheenColorMap&&(m.sheenColorMap.value=f.sheenColorMap,t(f.sheenColorMap,m.sheenColorMapTransform)),f.sheenRoughnessMap&&(m.sheenRoughnessMap.value=f.sheenRoughnessMap,t(f.sheenRoughnessMap,m.sheenRoughnessMapTransform))),f.clearcoat>0&&(m.clearcoat.value=f.clearcoat,m.clearcoatRoughness.value=f.clearcoatRoughness,f.clearcoatMap&&(m.clearcoatMap.value=f.clearcoatMap,t(f.clearcoatMap,m.clearcoatMapTransform)),f.clearcoatRoughnessMap&&(m.clearcoatRoughnessMap.value=f.clearcoatRoughnessMap,t(f.clearcoatRoughnessMap,m.clearcoatRoughnessMapTransform)),f.clearcoatNormalMap&&(m.clearcoatNormalMap.value=f.clearcoatNormalMap,t(f.clearcoatNormalMap,m.clearcoatNormalMapTransform),m.clearcoatNormalScale.value.copy(f.clearcoatNormalScale),f.side===Jt&&m.clearcoatNormalScale.value.negate())),f.dispersion>0&&(m.dispersion.value=f.dispersion),f.iridescence>0&&(m.iridescence.value=f.iridescence,m.iridescenceIOR.value=f.iridescenceIOR,m.iridescenceThicknessMinimum.value=f.iridescenceThicknessRange[0],m.iridescenceThicknessMaximum.value=f.iridescenceThicknessRange[1],f.iridescenceMap&&(m.iridescenceMap.value=f.iridescenceMap,t(f.iridescenceMap,m.iridescenceMapTransform)),f.iridescenceThicknessMap&&(m.iridescenceThicknessMap.value=f.iridescenceThicknessMap,t(f.iridescenceThicknessMap,m.iridescenceThicknessMapTransform))),f.transmission>0&&(m.transmission.value=f.transmission,m.transmissionSamplerMap.value=M.texture,m.transmissionSamplerSize.value.set(M.width,M.height),f.transmissionMap&&(m.transmissionMap.value=f.transmissionMap,t(f.transmissionMap,m.transmissionMapTransform)),m.thickness.value=f.thickness,f.thicknessMap&&(m.thicknessMap.value=f.thicknessMap,t(f.thicknessMap,m.thicknessMapTransform)),m.attenuationDistance.value=f.attenuationDistance,m.attenuationColor.value.copy(f.attenuationColor)),f.anisotropy>0&&(m.anisotropyVector.value.set(f.anisotropy*Math.cos(f.anisotropyRotation),f.anisotropy*Math.sin(f.anisotropyRotation)),f.anisotropyMap&&(m.anisotropyMap.value=f.anisotropyMap,t(f.anisotropyMap,m.anisotropyMapTransform))),m.specularIntensity.value=f.specularIntensity,m.specularColor.value.copy(f.specularColor),f.specularColorMap&&(m.specularColorMap.value=f.specularColorMap,t(f.specularColorMap,m.specularColorMapTransform)),f.specularIntensityMap&&(m.specularIntensityMap.value=f.specularIntensityMap,t(f.specularIntensityMap,m.specularIntensityMapTransform))}function g(m,f){f.matcap&&(m.matcap.value=f.matcap)}function x(m,f){const M=e.get(f).light;m.referencePosition.value.setFromMatrixPosition(M.matrixWorld),m.nearDistance.value=M.shadow.camera.near,m.farDistance.value=M.shadow.camera.far}return{refreshFogUniforms:n,refreshMaterialUniforms:s}}function im(i,e,t,n){let s={},a={},r=[];const o=i.getParameter(i.MAX_UNIFORM_BUFFER_BINDINGS);function l(S,b){const E=b.program;n.uniformBlockBinding(S,E)}function c(S,b){let E=s[S.id];E===void 0&&(m(S),E=h(S),s[S.id]=E,S.addEventListener("dispose",M));const R=b.program;n.updateUBOMapping(S,R);const v=e.render.frame;a[S.id]!==v&&(d(S),a[S.id]=v)}function h(S){const b=u();S.__bindingPointIndex=b;const E=i.createBuffer(),R=S.__size,v=S.usage;return i.bindBuffer(i.UNIFORM_BUFFER,E),i.bufferData(i.UNIFORM_BUFFER,R,v),i.bindBuffer(i.UNIFORM_BUFFER,null),i.bindBufferBase(i.UNIFORM_BUFFER,b,E),E}function u(){for(let S=0;S<o;S++)if(r.indexOf(S)===-1)return r.push(S),S;return et("WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function d(S){const b=s[S.id],E=S.uniforms,R=S.__cache;i.bindBuffer(i.UNIFORM_BUFFER,b);for(let v=0,T=E.length;v<T;v++){const C=E[v];if(Array.isArray(C))for(let P=0,L=C.length;P<L;P++)p(C[P],v,P,R);else p(C,v,0,R)}i.bindBuffer(i.UNIFORM_BUFFER,null)}function p(S,b,E,R){if(x(S,b,E,R)===!0){const v=S.__offset,T=S.value;if(Array.isArray(T)){let C=0;for(let P=0;P<T.length;P++){const L=T[P],q=f(L);g(L,S.__data,C),typeof L!="number"&&typeof L!="boolean"&&!L.isMatrix3&&!ArrayBuffer.isView(L)&&(C+=q.storage/Float32Array.BYTES_PER_ELEMENT)}}else g(T,S.__data,0);i.bufferSubData(i.UNIFORM_BUFFER,v,S.__data)}}function g(S,b,E){typeof S=="number"||typeof S=="boolean"?b[0]=S:S.isMatrix3?(b[0]=S.elements[0],b[1]=S.elements[1],b[2]=S.elements[2],b[3]=0,b[4]=S.elements[3],b[5]=S.elements[4],b[6]=S.elements[5],b[7]=0,b[8]=S.elements[6],b[9]=S.elements[7],b[10]=S.elements[8],b[11]=0):ArrayBuffer.isView(S)?b.set(new S.constructor(S.buffer,S.byteOffset,b.length)):S.toArray(b,E)}function x(S,b,E,R){const v=S.value,T=b+"_"+E;if(R[T]===void 0)return typeof v=="number"||typeof v=="boolean"?R[T]=v:ArrayBuffer.isView(v)?R[T]=v.slice():R[T]=v.clone(),!0;{const C=R[T];if(typeof v=="number"||typeof v=="boolean"){if(C!==v)return R[T]=v,!0}else{if(ArrayBuffer.isView(v))return!0;if(C.equals(v)===!1)return C.copy(v),!0}}return!1}function m(S){const b=S.uniforms;let E=0;const R=16;for(let T=0,C=b.length;T<C;T++){const P=Array.isArray(b[T])?b[T]:[b[T]];for(let L=0,q=P.length;L<q;L++){const Z=P[L],N=Array.isArray(Z.value)?Z.value:[Z.value];for(let X=0,G=N.length;X<G;X++){const j=N[X],se=f(j),pe=E%R,re=pe%se.boundary,Me=pe+re;E+=re,Me!==0&&R-Me<se.storage&&(E+=R-Me),Z.__data=new Float32Array(se.storage/Float32Array.BYTES_PER_ELEMENT),Z.__offset=E,E+=se.storage}}}const v=E%R;return v>0&&(E+=R-v),S.__size=E,S.__cache={},this}function f(S){const b={boundary:0,storage:0};return typeof S=="number"||typeof S=="boolean"?(b.boundary=4,b.storage=4):S.isVector2?(b.boundary=8,b.storage=8):S.isVector3||S.isColor?(b.boundary=16,b.storage=12):S.isVector4?(b.boundary=16,b.storage=16):S.isMatrix3?(b.boundary=48,b.storage=48):S.isMatrix4?(b.boundary=64,b.storage=64):S.isTexture?Fe("WebGLRenderer: Texture samplers can not be part of an uniforms group."):ArrayBuffer.isView(S)?(b.boundary=16,b.storage=S.byteLength):Fe("WebGLRenderer: Unsupported uniform value type.",S),b}function M(S){const b=S.target;b.removeEventListener("dispose",M);const E=r.indexOf(b.__bindingPointIndex);r.splice(E,1),i.deleteBuffer(s[b.id]),delete s[b.id],delete a[b.id]}function w(){for(const S in s)i.deleteBuffer(s[S]);r=[],s={},a={}}return{bind:l,update:c,dispose:w}}const sm=new Uint16Array([12469,15057,12620,14925,13266,14620,13807,14376,14323,13990,14545,13625,14713,13328,14840,12882,14931,12528,14996,12233,15039,11829,15066,11525,15080,11295,15085,10976,15082,10705,15073,10495,13880,14564,13898,14542,13977,14430,14158,14124,14393,13732,14556,13410,14702,12996,14814,12596,14891,12291,14937,11834,14957,11489,14958,11194,14943,10803,14921,10506,14893,10278,14858,9960,14484,14039,14487,14025,14499,13941,14524,13740,14574,13468,14654,13106,14743,12678,14818,12344,14867,11893,14889,11509,14893,11180,14881,10751,14852,10428,14812,10128,14765,9754,14712,9466,14764,13480,14764,13475,14766,13440,14766,13347,14769,13070,14786,12713,14816,12387,14844,11957,14860,11549,14868,11215,14855,10751,14825,10403,14782,10044,14729,9651,14666,9352,14599,9029,14967,12835,14966,12831,14963,12804,14954,12723,14936,12564,14917,12347,14900,11958,14886,11569,14878,11247,14859,10765,14828,10401,14784,10011,14727,9600,14660,9289,14586,8893,14508,8533,15111,12234,15110,12234,15104,12216,15092,12156,15067,12010,15028,11776,14981,11500,14942,11205,14902,10752,14861,10393,14812,9991,14752,9570,14682,9252,14603,8808,14519,8445,14431,8145,15209,11449,15208,11451,15202,11451,15190,11438,15163,11384,15117,11274,15055,10979,14994,10648,14932,10343,14871,9936,14803,9532,14729,9218,14645,8742,14556,8381,14461,8020,14365,7603,15273,10603,15272,10607,15267,10619,15256,10631,15231,10614,15182,10535,15118,10389,15042,10167,14963,9787,14883,9447,14800,9115,14710,8665,14615,8318,14514,7911,14411,7507,14279,7198,15314,9675,15313,9683,15309,9712,15298,9759,15277,9797,15229,9773,15166,9668,15084,9487,14995,9274,14898,8910,14800,8539,14697,8234,14590,7790,14479,7409,14367,7067,14178,6621,15337,8619,15337,8631,15333,8677,15325,8769,15305,8871,15264,8940,15202,8909,15119,8775,15022,8565,14916,8328,14804,8009,14688,7614,14569,7287,14448,6888,14321,6483,14088,6171,15350,7402,15350,7419,15347,7480,15340,7613,15322,7804,15287,7973,15229,8057,15148,8012,15046,7846,14933,7611,14810,7357,14682,7069,14552,6656,14421,6316,14251,5948,14007,5528,15356,5942,15356,5977,15353,6119,15348,6294,15332,6551,15302,6824,15249,7044,15171,7122,15070,7050,14949,6861,14818,6611,14679,6349,14538,6067,14398,5651,14189,5311,13935,4958,15359,4123,15359,4153,15356,4296,15353,4646,15338,5160,15311,5508,15263,5829,15188,6042,15088,6094,14966,6001,14826,5796,14678,5543,14527,5287,14377,4985,14133,4586,13869,4257,15360,1563,15360,1642,15358,2076,15354,2636,15341,3350,15317,4019,15273,4429,15203,4732,15105,4911,14981,4932,14836,4818,14679,4621,14517,4386,14359,4156,14083,3795,13808,3437,15360,122,15360,137,15358,285,15355,636,15344,1274,15322,2177,15281,2765,15215,3223,15120,3451,14995,3569,14846,3567,14681,3466,14511,3305,14344,3121,14037,2800,13753,2467,15360,0,15360,1,15359,21,15355,89,15346,253,15325,479,15287,796,15225,1148,15133,1492,15008,1749,14856,1882,14685,1886,14506,1783,14324,1608,13996,1398,13702,1183]);let En=null;function am(){return En===null&&(En=new Wh(sm,16,16,Ei,Wn),En.name="DFG_LUT",En.minFilter=Gt,En.magFilter=Gt,En.wrapS=Hn,En.wrapT=Hn,En.generateMipmaps=!1,En.needsUpdate=!0),En}class rm{constructor(e={}){const{canvas:t=Sh(),context:n=null,depth:s=!0,stencil:a=!1,alpha:r=!1,antialias:o=!1,premultipliedAlpha:l=!0,preserveDrawingBuffer:c=!1,powerPreference:h="default",failIfMajorPerformanceCaveat:u=!1,reversedDepthBuffer:d=!1,outputBufferType:p=on}=e;this.isWebGLRenderer=!0;let g;if(n!==null){if(typeof WebGLRenderingContext<"u"&&n instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");g=n.getContextAttributes().alpha}else g=r;const x=p,m=new Set([ho,co,lo]),f=new Set([on,Ln,fs,ps,ro,oo]),M=new Uint32Array(4),w=new Int32Array(4),S=new I;let b=null,E=null;const R=[],v=[];let T=null;this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Cn,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const C=this;let P=!1,L=null,q=null,Z=null,N=null;this._outputColorSpace=an;let X=0,G=0,j=null,se=-1,pe=null;const re=new xt,Me=new xt;let Be=null;const tt=new Le(0);let qe=0,$=t.width,le=t.height,ie=1,Ie=null,ke=null;const Ae=new xt(0,0,$,le),nt=new xt(0,0,$,le);let De=!1;const Ke=new go;let Ze=!1,He=!1;const rt=new pt,mt=new I,gt=new xt,Mt={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let it=!1;function ot(){return j===null?ie:1}let D=n;function Lt(y,F){return t.getContext(y,F)}try{const y={alpha:!0,depth:s,stencil:a,antialias:o,premultipliedAlpha:l,preserveDrawingBuffer:c,powerPreference:h,failIfMajorPerformanceCaveat:u};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${io}`),t.addEventListener("webglcontextlost",xe,!1),t.addEventListener("webglcontextrestored",be,!1),t.addEventListener("webglcontextcreationerror",Xe,!1),D===null){const F="webgl2";if(D=Lt(F,y),D===null)throw Lt(F)?new Error("THREE.WebGLRenderer: Error creating WebGL context with your selected attributes."):new Error("THREE.WebGLRenderer: Error creating WebGL context.")}}catch(y){throw et("WebGLRenderer: "+y.message),y}let oe,A,_,k,O,z,ee,te,K,J,de,Ee,ue,ce,Te,Ce,Ue,U,he,Q,fe,me,B;function ae(){oe=new ap(D),oe.init(),fe=new J0(D,oe),A=new $f(D,oe,e,fe),_=new K0(D,oe),A.reversedDepthBuffer&&d&&_.buffers.depth.setReversed(!0),q=D.createFramebuffer(),Z=D.createFramebuffer(),N=D.createFramebuffer(),k=new lp(D),O=new U0,z=new Z0(D,oe,_,O,A,fe,k),ee=new sp(C),te=new dd(D),me=new Zf(D,te),K=new rp(D,te,k,me),J=new hp(D,K,te,me,k),U=new cp(D,A,z),Te=new Qf(O),de=new D0(C,ee,oe,A,me,Te),Ee=new nm(C,O),ue=new N0,ce=new V0(oe),Ue=new Kf(C,ee,_,J,g,l),Ce=new Y0(C,J,A),B=new im(D,k,A,_),he=new Jf(D,oe,k),Q=new op(D,oe,k),k.programs=de.programs,C.capabilities=A,C.extensions=oe,C.properties=O,C.renderLists=ue,C.shadowMap=Ce,C.state=_,C.info=k}ae(),x!==on&&(T=new up(x,t.width,t.height,o,s,a));const ne=new em(C,D);this.xr=ne,this.getContext=function(){return D},this.getContextAttributes=function(){return D.getContextAttributes()},this.forceContextLoss=function(){const y=oe.get("WEBGL_lose_context");y&&y.loseContext()},this.forceContextRestore=function(){const y=oe.get("WEBGL_lose_context");y&&y.restoreContext()},this.getPixelRatio=function(){return ie},this.setPixelRatio=function(y){y!==void 0&&(ie=y,this.setSize($,le,!1))},this.getSize=function(y){return y.set($,le)},this.setSize=function(y,F,Y=!0){if(ne.isPresenting){Fe("WebGLRenderer: Can't change size while VR device is presenting.");return}$=y,le=F,t.width=Math.floor(y*ie),t.height=Math.floor(F*ie),Y===!0&&(t.style.width=y+"px",t.style.height=F+"px"),T!==null&&T.setSize(t.width,t.height),this.setViewport(0,0,y,F)},this.getDrawingBufferSize=function(y){return y.set($*ie,le*ie).floor()},this.setDrawingBufferSize=function(y,F,Y){$=y,le=F,ie=Y,t.width=Math.floor(y*Y),t.height=Math.floor(F*Y),this.setViewport(0,0,y,F)},this.setEffects=function(y){if(x===on){et("WebGLRenderer: setEffects() requires outputBufferType set to HalfFloatType or FloatType.");return}if(y){for(let F=0;F<y.length;F++)if(y[F].isOutputPass===!0){Fe("WebGLRenderer: OutputPass is not needed in setEffects(). Tone mapping and color space conversion are applied automatically.");break}}T.setEffects(y||[])},this.getCurrentViewport=function(y){return y.copy(re)},this.getViewport=function(y){return y.copy(Ae)},this.setViewport=function(y,F,Y,V){y.isVector4?Ae.set(y.x,y.y,y.z,y.w):Ae.set(y,F,Y,V),_.viewport(re.copy(Ae).multiplyScalar(ie).round())},this.getScissor=function(y){return y.copy(nt)},this.setScissor=function(y,F,Y,V){y.isVector4?nt.set(y.x,y.y,y.z,y.w):nt.set(y,F,Y,V),_.scissor(Me.copy(nt).multiplyScalar(ie).round())},this.getScissorTest=function(){return De},this.setScissorTest=function(y){_.setScissorTest(De=y)},this.setOpaqueSort=function(y){Ie=y},this.setTransparentSort=function(y){ke=y},this.getClearColor=function(y){return y.copy(Ue.getClearColor())},this.setClearColor=function(){Ue.setClearColor(...arguments)},this.getClearAlpha=function(){return Ue.getClearAlpha()},this.setClearAlpha=function(){Ue.setClearAlpha(...arguments)},this.clear=function(y=!0,F=!0,Y=!0){let V=0;if(y){let W=!1;if(j!==null){const ve=j.texture.format;W=m.has(ve)}if(W){const ve=j.texture.type,ye=f.has(ve),_e=Ue.getClearColor(),we=Ue.getClearAlpha(),Re=_e.r,Ge=_e.g,We=_e.b;ye?(M[0]=Re,M[1]=Ge,M[2]=We,M[3]=we,D.clearBufferuiv(D.COLOR,0,M)):(w[0]=Re,w[1]=Ge,w[2]=We,w[3]=we,D.clearBufferiv(D.COLOR,0,w))}else V|=D.COLOR_BUFFER_BIT}F&&(V|=D.DEPTH_BUFFER_BIT,this.state.buffers.depth.setMask(!0)),Y&&(V|=D.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),V!==0&&D.clear(V)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.setNodesHandler=function(y){y.setRenderer(this),L=y},this.dispose=function(){t.removeEventListener("webglcontextlost",xe,!1),t.removeEventListener("webglcontextrestored",be,!1),t.removeEventListener("webglcontextcreationerror",Xe,!1),Ue.dispose(),ue.dispose(),ce.dispose(),O.dispose(),ee.dispose(),J.dispose(),me.dispose(),B.dispose(),de.dispose(),ne.dispose(),ne.removeEventListener("sessionstart",ci),ne.removeEventListener("sessionend",cn),Sn.stop()};function xe(y){y.preventDefault(),ko("WebGLRenderer: Context Lost."),P=!0}function be(){ko("WebGLRenderer: Context Restored."),P=!1;const y=k.autoReset,F=Ce.enabled,Y=Ce.autoUpdate,V=Ce.needsUpdate,W=Ce.type;ae(),k.autoReset=y,Ce.enabled=F,Ce.autoUpdate=Y,Ce.needsUpdate=V,Ce.type=W}function Xe(y){et("WebGLRenderer: A WebGL context could not be created. Reason: ",y.statusMessage)}function Qe(y){const F=y.target;F.removeEventListener("dispose",Qe),Ne(F)}function Ne(y){xn(y),O.remove(y)}function xn(y){const F=O.get(y).programs;F!==void 0&&(F.forEach(function(Y){de.releaseProgram(Y)}),y.isShaderMaterial&&de.releaseShaderCache(y))}this.renderBufferDirect=function(y,F,Y,V,W,ve){F===null&&(F=Mt);const ye=W.isMesh&&W.matrixWorld.determinantAffine()<0,_e=Hc(y,F,Y,V,W);_.setMaterial(V,ye);let we=Y.index,Re=1;if(V.wireframe===!0){if(we=K.getWireframeAttribute(Y),we===void 0)return;Re=2}const Ge=Y.drawRange,We=Y.attributes.position;let Pe=Ge.start*Re,ct=(Ge.start+Ge.count)*Re;ve!==null&&(Pe=Math.max(Pe,ve.start*Re),ct=Math.min(ct,(ve.start+ve.count)*Re)),we!==null?(Pe=Math.max(Pe,0),ct=Math.min(ct,we.count)):We!=null&&(Pe=Math.max(Pe,0),ct=Math.min(ct,We.count));const bt=ct-Pe;if(bt<0||bt===1/0)return;me.setup(W,V,_e,Y,we);let St,ht=he;if(we!==null&&(St=te.get(we),ht=Q,ht.setIndex(St)),W.isMesh)V.wireframe===!0?(_.setLineWidth(V.wireframeLinewidth*ot()),ht.setMode(D.LINES)):ht.setMode(D.TRIANGLES);else if(W.isLine){let Nt=V.linewidth;Nt===void 0&&(Nt=1),_.setLineWidth(Nt*ot()),W.isLineSegments?ht.setMode(D.LINES):W.isLineLoop?ht.setMode(D.LINE_LOOP):ht.setMode(D.LINE_STRIP)}else W.isPoints?ht.setMode(D.POINTS):W.isSprite&&ht.setMode(D.TRIANGLES);if(W.isBatchedMesh)if(oe.get("WEBGL_multi_draw"))ht.renderMultiDraw(W._multiDrawStarts,W._multiDrawCounts,W._multiDrawCount);else{const Nt=W._multiDrawStarts,Se=W._multiDrawCounts,en=W._multiDrawCount,je=we?te.get(we).bytesPerElement:1,hn=O.get(V).currentProgram.getUniforms();for(let bn=0;bn<en;bn++)hn.setValue(D,"_gl_DrawID",bn),ht.render(Nt[bn]/je,Se[bn])}else if(W.isInstancedMesh)ht.renderInstances(Pe,bt,W.count);else if(Y.isInstancedBufferGeometry){const Nt=Y._maxInstanceCount!==void 0?Y._maxInstanceCount:1/0,Se=Math.min(Y.instanceCount,Nt);ht.renderInstances(Pe,bt,Se)}else ht.render(Pe,bt)};function Mn(y,F,Y){y.transparent===!0&&y.side===qt&&y.forceSinglePass===!1?(y.side=Jt,y.needsUpdate=!0,ys(y,F,Y),y.side=ri,y.needsUpdate=!0,ys(y,F,Y),y.side=qt):ys(y,F,Y)}this.compile=function(y,F,Y=null){Y===null&&(Y=y),E=ce.get(Y),E.init(F),v.push(E),Y.traverseVisible(function(W){W.isLight&&W.layers.test(F.layers)&&(E.pushLight(W),W.castShadow&&E.pushShadow(W))}),y!==Y&&y.traverseVisible(function(W){W.isLight&&W.layers.test(F.layers)&&(E.pushLight(W),W.castShadow&&E.pushShadow(W))}),E.setupLights();const V=new Set;return y.traverse(function(W){if(!(W.isMesh||W.isPoints||W.isLine||W.isSprite))return;const ve=W.material;if(ve)if(Array.isArray(ve))for(let ye=0;ye<ve.length;ye++){const _e=ve[ye];Mn(_e,Y,W),V.add(_e)}else Mn(ve,Y,W),V.add(ve)}),E=v.pop(),V},this.compileAsync=function(y,F,Y=null){const V=this.compile(y,F,Y);return new Promise(W=>{function ve(){if(V.forEach(function(ye){O.get(ye).currentProgram.isReady()&&V.delete(ye)}),V.size===0){W(y);return}setTimeout(ve,10)}oe.get("KHR_parallel_shader_compile")!==null?ve():setTimeout(ve,10)})};let Xn=null;function ln(y){Xn&&Xn(y)}function ci(){Sn.stop()}function cn(){Sn.start()}const Sn=new mc;Sn.setAnimationLoop(ln),typeof self<"u"&&Sn.setContext(self),this.setAnimationLoop=function(y){Xn=y,ne.setAnimationLoop(y),y===null?Sn.stop():Sn.start()},ne.addEventListener("sessionstart",ci),ne.addEventListener("sessionend",cn),this.render=function(y,F){if(F!==void 0&&F.isCamera!==!0){et("WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(P===!0)return;L!==null&&L.renderStart(y,F);const Y=ne.enabled===!0&&ne.isPresenting===!0,V=T!==null&&(j===null||Y)&&T.begin(C,j);if(y.matrixWorldAutoUpdate===!0&&y.updateMatrixWorld(),F.parent===null&&F.matrixWorldAutoUpdate===!0&&F.updateMatrixWorld(),ne.enabled===!0&&ne.isPresenting===!0&&(T===null||T.isCompositing()===!1)&&(ne.cameraAutoUpdate===!0&&ne.updateCamera(F),F=ne.getCamera()),y.isScene===!0&&y.onBeforeRender(C,y,F,j),E=ce.get(y,v.length),E.init(F),E.state.textureUnits=z.getTextureUnits(),v.push(E),rt.multiplyMatrices(F.projectionMatrix,F.matrixWorldInverse),Ke.setFromProjectionMatrix(rt,Rn,F.reversedDepth),He=this.localClippingEnabled,Ze=Te.init(this.clippingPlanes,He),b=ue.get(y,R.length),b.init(),R.push(b),ne.enabled===!0&&ne.isPresenting===!0){const ye=C.xr.getDepthSensingMesh();ye!==null&&Yn(ye,F,-1/0,C.sortObjects)}Yn(y,F,0,C.sortObjects),b.finish(),C.sortObjects===!0&&b.sort(Ie,ke,F.reversedDepth),it=ne.enabled===!1||ne.isPresenting===!1||ne.hasDepthSensing()===!1,it&&Ue.addToRenderList(b,y),this.info.render.frame++,this.info.autoReset===!0&&this.info.reset(),Ze===!0&&Te.beginShadows();const W=E.state.shadowsArray;if(Ce.render(W,y,F),Ze===!0&&Te.endShadows(),(V&&T.hasRenderPass())===!1){const ye=b.opaque,_e=b.transmissive;if(E.setupLights(),F.isArrayCamera){const we=F.cameras;if(_e.length>0)for(let Re=0,Ge=we.length;Re<Ge;Re++){const We=we[Re];yo(ye,_e,y,We)}it&&Ue.render(y);for(let Re=0,Ge=we.length;Re<Ge;Re++){const We=we[Re];Tt(b,y,We,We.viewport)}}else _e.length>0&&yo(ye,_e,y,F),it&&Ue.render(y),Tt(b,y,F)}j!==null&&G===0&&(z.updateMultisampleRenderTarget(j),z.updateRenderTargetMipmap(j)),V&&T.end(C),y.isScene===!0&&y.onAfterRender(C,y,F),me.resetDefaultState(),se=-1,pe=null,v.pop(),v.length>0?(E=v[v.length-1],z.setTextureUnits(E.state.textureUnits),Ze===!0&&Te.setGlobalState(C.clippingPlanes,E.state.camera)):E=null,R.pop(),R.length>0?b=R[R.length-1]:b=null,L!==null&&L.renderEnd()};function Yn(y,F,Y,V){if(y.visible===!1)return;if(y.layers.test(F.layers)){if(y.isGroup)Y=y.renderOrder;else if(y.isLOD)y.autoUpdate===!0&&y.update(F);else if(y.isLightProbeGrid)E.pushLightProbeGrid(y);else if(y.isLight)E.pushLight(y),y.castShadow&&E.pushShadow(y);else if(y.isSprite){if(!y.frustumCulled||Ke.intersectsSprite(y)){V&&gt.setFromMatrixPosition(y.matrixWorld).applyMatrix4(rt);const ye=J.update(y),_e=y.material;_e.visible&&b.push(y,ye,_e,Y,gt.z,null)}}else if((y.isMesh||y.isLine||y.isPoints)&&(!y.frustumCulled||Ke.intersectsObject(y))){const ye=J.update(y),_e=y.material;if(V&&(y.boundingSphere!==void 0?(y.boundingSphere===null&&y.computeBoundingSphere(),gt.copy(y.boundingSphere.center)):(ye.boundingSphere===null&&ye.computeBoundingSphere(),gt.copy(ye.boundingSphere.center)),gt.applyMatrix4(y.matrixWorld).applyMatrix4(rt)),Array.isArray(_e)){const we=ye.groups;for(let Re=0,Ge=we.length;Re<Ge;Re++){const We=we[Re],Pe=_e[We.materialIndex];Pe&&Pe.visible&&b.push(y,ye,Pe,Y,gt.z,We)}}else _e.visible&&b.push(y,ye,_e,Y,gt.z,null)}}const ve=y.children;for(let ye=0,_e=ve.length;ye<_e;ye++)Yn(ve[ye],F,Y,V)}function Tt(y,F,Y,V){const{opaque:W,transmissive:ve,transparent:ye}=y;E.setupLightsView(Y),Ze===!0&&Te.setGlobalState(C.clippingPlanes,Y),V&&_.viewport(re.copy(V)),W.length>0&&bs(W,F,Y),ve.length>0&&bs(ve,F,Y),ye.length>0&&bs(ye,F,Y),_.buffers.depth.setTest(!0),_.buffers.depth.setMask(!0),_.buffers.color.setMask(!0),_.setPolygonOffset(!1)}function yo(y,F,Y,V){if((Y.isScene===!0?Y.overrideMaterial:null)!==null)return;if(E.state.transmissionRenderTarget[V.id]===void 0){const Pe=oe.has("EXT_color_buffer_half_float")||oe.has("EXT_color_buffer_float");E.state.transmissionRenderTarget[V.id]=new Pn(1,1,{generateMipmaps:!0,type:Pe?Wn:on,minFilter:vi,samples:Math.max(4,A.samples),stencilBuffer:a,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:Je.workingColorSpace})}const ve=E.state.transmissionRenderTarget[V.id],ye=V.viewport||re;ve.setSize(ye.z*C.transmissionResolutionScale,ye.w*C.transmissionResolutionScale);const _e=C.getRenderTarget(),we=C.getActiveCubeFace(),Re=C.getActiveMipmapLevel();C.setRenderTarget(ve),C.getClearColor(tt),qe=C.getClearAlpha(),qe<1&&C.setClearColor(16777215,.5),C.clear(),it&&Ue.render(Y);const Ge=C.toneMapping;C.toneMapping=Cn;const We=V.viewport;if(V.viewport!==void 0&&(V.viewport=void 0),E.setupLightsView(V),Ze===!0&&Te.setGlobalState(C.clippingPlanes,V),bs(y,Y,V),z.updateMultisampleRenderTarget(ve),z.updateRenderTargetMipmap(ve),oe.has("WEBGL_multisampled_render_to_texture")===!1){let Pe=!1;for(let ct=0,bt=F.length;ct<bt;ct++){const St=F[ct],{object:ht,geometry:Nt,material:Se,group:en}=St;if(Se.side===qt&&ht.layers.test(V.layers)){const je=Se.side;Se.side=Jt,Se.needsUpdate=!0,Eo(ht,Y,V,Nt,Se,en),Se.side=je,Se.needsUpdate=!0,Pe=!0}}Pe===!0&&(z.updateMultisampleRenderTarget(ve),z.updateRenderTargetMipmap(ve))}C.setRenderTarget(_e,we,Re),C.setClearColor(tt,qe),We!==void 0&&(V.viewport=We),C.toneMapping=Ge}function bs(y,F,Y){const V=F.isScene===!0?F.overrideMaterial:null;for(let W=0,ve=y.length;W<ve;W++){const ye=y[W],{object:_e,geometry:we,group:Re}=ye;let Ge=ye.material;Ge.allowOverride===!0&&V!==null&&(Ge=V),_e.layers.test(Y.layers)&&Eo(_e,F,Y,we,Ge,Re)}}function Eo(y,F,Y,V,W,ve){y.onBeforeRender(C,F,Y,V,W,ve),y.modelViewMatrix.multiplyMatrices(Y.matrixWorldInverse,y.matrixWorld),y.normalMatrix.getNormalMatrix(y.modelViewMatrix),W.onBeforeRender(C,F,Y,V,y,ve),W.transparent===!0&&W.side===qt&&W.forceSinglePass===!1?(W.side=Jt,W.needsUpdate=!0,C.renderBufferDirect(Y,F,V,W,y,ve),W.side=ri,W.needsUpdate=!0,C.renderBufferDirect(Y,F,V,W,y,ve),W.side=qt):C.renderBufferDirect(Y,F,V,W,y,ve),y.onAfterRender(C,F,Y,V,W,ve)}function ys(y,F,Y){F.isScene!==!0&&(F=Mt);const V=O.get(y),W=E.state.lights,ve=E.state.shadowsArray,ye=W.state.version,_e=de.getParameters(y,W.state,ve,F,Y,E.state.lightProbeGridArray),we=de.getProgramCacheKey(_e);let Re=V.programs;V.environment=y.isMeshStandardMaterial||y.isMeshLambertMaterial||y.isMeshPhongMaterial?F.environment:null,V.fog=F.fog;const Ge=y.isMeshStandardMaterial||y.isMeshLambertMaterial&&!y.envMap||y.isMeshPhongMaterial&&!y.envMap;V.envMap=ee.get(y.envMap||V.environment,Ge),V.envMapRotation=V.environment!==null&&y.envMap===null?F.environmentRotation:y.envMapRotation,Re===void 0&&(y.addEventListener("dispose",Qe),Re=new Map,V.programs=Re);let We=Re.get(we);if(We!==void 0){if(V.currentProgram===We&&V.lightsStateVersion===ye)return wo(y,_e),We}else _e.uniforms=de.getUniforms(y),L!==null&&y.isNodeMaterial&&L.build(y,Y,_e),y.onBeforeCompile(_e,C),We=de.acquireProgram(_e,we),Re.set(we,We),V.uniforms=_e.uniforms;const Pe=V.uniforms;return(!y.isShaderMaterial&&!y.isRawShaderMaterial||y.clipping===!0)&&(Pe.clippingPlanes=Te.uniform),wo(y,_e),V.needsLights=Vc(y),V.lightsStateVersion=ye,V.needsLights&&(Pe.ambientLightColor.value=W.state.ambient,Pe.lightProbe.value=W.state.probe,Pe.directionalLights.value=W.state.directional,Pe.directionalLightShadows.value=W.state.directionalShadow,Pe.spotLights.value=W.state.spot,Pe.spotLightShadows.value=W.state.spotShadow,Pe.rectAreaLights.value=W.state.rectArea,Pe.ltc_1.value=W.state.rectAreaLTC1,Pe.ltc_2.value=W.state.rectAreaLTC2,Pe.pointLights.value=W.state.point,Pe.pointLightShadows.value=W.state.pointShadow,Pe.hemisphereLights.value=W.state.hemi,Pe.directionalShadowMatrix.value=W.state.directionalShadowMatrix,Pe.spotLightMatrix.value=W.state.spotLightMatrix,Pe.spotLightMap.value=W.state.spotLightMap,Pe.pointShadowMatrix.value=W.state.pointShadowMatrix),V.lightProbeGrid=E.state.lightProbeGridArray.length>0,V.currentProgram=We,V.uniformsList=null,We}function To(y){if(y.uniformsList===null){const F=y.currentProgram.getUniforms();y.uniformsList=na.seqWithValue(F.seq,y.uniforms)}return y.uniformsList}function wo(y,F){const Y=O.get(y);Y.outputColorSpace=F.outputColorSpace,Y.batching=F.batching,Y.batchingColor=F.batchingColor,Y.instancing=F.instancing,Y.instancingColor=F.instancingColor,Y.instancingMorph=F.instancingMorph,Y.skinning=F.skinning,Y.morphTargets=F.morphTargets,Y.morphNormals=F.morphNormals,Y.morphColors=F.morphColors,Y.morphTargetsCount=F.morphTargetsCount,Y.numClippingPlanes=F.numClippingPlanes,Y.numIntersection=F.numClipIntersection,Y.vertexAlphas=F.vertexAlphas,Y.vertexTangents=F.vertexTangents,Y.toneMapping=F.toneMapping}function Bc(y,F){if(y.length===0)return null;if(y.length===1)return y[0].texture!==null?y[0]:null;S.setFromMatrixPosition(F.matrixWorld);for(let Y=0,V=y.length;Y<V;Y++){const W=y[Y];if(W.texture!==null&&W.boundingBox.containsPoint(S))return W}return null}function Hc(y,F,Y,V,W){F.isScene!==!0&&(F=Mt),z.resetTextureUnits();const ve=F.fog,ye=V.isMeshStandardMaterial||V.isMeshLambertMaterial||V.isMeshPhongMaterial?F.environment:null,_e=j===null?C.outputColorSpace:j.isXRRenderTarget===!0?j.texture.colorSpace:Je.workingColorSpace,we=V.isMeshStandardMaterial||V.isMeshLambertMaterial&&!V.envMap||V.isMeshPhongMaterial&&!V.envMap,Re=ee.get(V.envMap||ye,we),Ge=V.vertexColors===!0&&!!Y.attributes.color&&Y.attributes.color.itemSize===4,We=!!Y.attributes.tangent&&(!!V.normalMap||V.anisotropy>0),Pe=!!Y.morphAttributes.position,ct=!!Y.morphAttributes.normal,bt=!!Y.morphAttributes.color;let St=Cn;V.toneMapped&&(j===null||j.isXRRenderTarget===!0)&&(St=C.toneMapping);const ht=Y.morphAttributes.position||Y.morphAttributes.normal||Y.morphAttributes.color,Nt=ht!==void 0?ht.length:0,Se=O.get(V),en=E.state.lights;if(Ze===!0&&(He===!0||y!==pe)){const ut=y===pe&&V.id===se;Te.setState(V,y,ut)}let je=!1;V.version===Se.__version?(Se.needsLights&&Se.lightsStateVersion!==en.state.version||Se.outputColorSpace!==_e||W.isBatchedMesh&&Se.batching===!1||!W.isBatchedMesh&&Se.batching===!0||W.isBatchedMesh&&Se.batchingColor===!0&&W.colorTexture===null||W.isBatchedMesh&&Se.batchingColor===!1&&W.colorTexture!==null||W.isInstancedMesh&&Se.instancing===!1||!W.isInstancedMesh&&Se.instancing===!0||W.isSkinnedMesh&&Se.skinning===!1||!W.isSkinnedMesh&&Se.skinning===!0||W.isInstancedMesh&&Se.instancingColor===!0&&W.instanceColor===null||W.isInstancedMesh&&Se.instancingColor===!1&&W.instanceColor!==null||W.isInstancedMesh&&Se.instancingMorph===!0&&W.morphTexture===null||W.isInstancedMesh&&Se.instancingMorph===!1&&W.morphTexture!==null||Se.envMap!==Re||V.fog===!0&&Se.fog!==ve||Se.numClippingPlanes!==void 0&&(Se.numClippingPlanes!==Te.numPlanes||Se.numIntersection!==Te.numIntersection)||Se.vertexAlphas!==Ge||Se.vertexTangents!==We||Se.morphTargets!==Pe||Se.morphNormals!==ct||Se.morphColors!==bt||Se.toneMapping!==St||Se.morphTargetsCount!==Nt||!!Se.lightProbeGrid!=E.state.lightProbeGridArray.length>0)&&(je=!0):(je=!0,Se.__version=V.version);let hn=Se.currentProgram;je===!0&&(hn=ys(V,F,W),L&&V.isNodeMaterial&&L.onUpdateProgram(V,hn,Se));let bn=!1,Kn=!1,Ai=!1;const dt=hn.getUniforms(),yt=Se.uniforms;if(_.useProgram(hn.program)&&(bn=!0,Kn=!0,Ai=!0),V.id!==se&&(se=V.id,Kn=!0),Se.needsLights){const ut=Bc(E.state.lightProbeGridArray,W);Se.lightProbeGrid!==ut&&(Se.lightProbeGrid=ut,Kn=!0)}if(bn||pe!==y){_.buffers.depth.getReversed()&&y.reversedDepth!==!0&&(y._reversedDepth=!0,y.updateProjectionMatrix()),dt.setValue(D,"projectionMatrix",y.projectionMatrix),dt.setValue(D,"viewMatrix",y.matrixWorldInverse);const Jn=dt.map.cameraPosition;Jn!==void 0&&Jn.setValue(D,mt.setFromMatrixPosition(y.matrixWorld)),A.logarithmicDepthBuffer&&dt.setValue(D,"logDepthBufFC",2/(Math.log(y.far+1)/Math.LN2)),(V.isMeshPhongMaterial||V.isMeshToonMaterial||V.isMeshLambertMaterial||V.isMeshBasicMaterial||V.isMeshStandardMaterial||V.isShaderMaterial)&&dt.setValue(D,"isOrthographic",y.isOrthographicCamera===!0),pe!==y&&(pe=y,Kn=!0,Ai=!0)}if(Se.needsLights&&(en.state.directionalShadowMap.length>0&&dt.setValue(D,"directionalShadowMap",en.state.directionalShadowMap,z),en.state.spotShadowMap.length>0&&dt.setValue(D,"spotShadowMap",en.state.spotShadowMap,z),en.state.pointShadowMap.length>0&&dt.setValue(D,"pointShadowMap",en.state.pointShadowMap,z)),W.isSkinnedMesh){dt.setOptional(D,W,"bindMatrix"),dt.setOptional(D,W,"bindMatrixInverse");const ut=W.skeleton;ut&&(ut.boneTexture===null&&ut.computeBoneTexture(),dt.setValue(D,"boneTexture",ut.boneTexture,z))}W.isBatchedMesh&&(dt.setOptional(D,W,"batchingTexture"),dt.setValue(D,"batchingTexture",W._matricesTexture,z),dt.setOptional(D,W,"batchingIdTexture"),dt.setValue(D,"batchingIdTexture",W._indirectTexture,z),dt.setOptional(D,W,"batchingColorTexture"),W._colorsTexture!==null&&dt.setValue(D,"batchingColorTexture",W._colorsTexture,z));const Zn=Y.morphAttributes;if((Zn.position!==void 0||Zn.normal!==void 0||Zn.color!==void 0)&&U.update(W,Y,hn),(Kn||Se.receiveShadow!==W.receiveShadow)&&(Se.receiveShadow=W.receiveShadow,dt.setValue(D,"receiveShadow",W.receiveShadow)),(V.isMeshStandardMaterial||V.isMeshLambertMaterial||V.isMeshPhongMaterial)&&V.envMap===null&&F.environment!==null&&(yt.envMapIntensity.value=F.environmentIntensity),yt.dfgLUT!==void 0&&(yt.dfgLUT.value=am()),Kn){if(dt.setValue(D,"toneMappingExposure",C.toneMappingExposure),Se.needsLights&&Gc(yt,Ai),ve&&V.fog===!0&&Ee.refreshFogUniforms(yt,ve),Ee.refreshMaterialUniforms(yt,V,ie,le,E.state.transmissionRenderTarget[y.id]),Se.needsLights&&Se.lightProbeGrid){const ut=Se.lightProbeGrid;yt.probesSH.value=ut.texture,yt.probesMin.value.copy(ut.boundingBox.min),yt.probesMax.value.copy(ut.boundingBox.max),yt.probesResolution.value.copy(ut.resolution)}na.upload(D,To(Se),yt,z)}if(V.isShaderMaterial&&V.uniformsNeedUpdate===!0&&(na.upload(D,To(Se),yt,z),V.uniformsNeedUpdate=!1),V.isSpriteMaterial&&dt.setValue(D,"center",W.center),dt.setValue(D,"modelViewMatrix",W.modelViewMatrix),dt.setValue(D,"normalMatrix",W.normalMatrix),dt.setValue(D,"modelMatrix",W.matrixWorld),V.uniformsGroups!==void 0){const ut=V.uniformsGroups;for(let Jn=0,Ri=ut.length;Jn<Ri;Jn++){const Ao=ut[Jn];B.update(Ao,hn),B.bind(Ao,hn)}}return hn}function Gc(y,F){y.ambientLightColor.needsUpdate=F,y.lightProbe.needsUpdate=F,y.directionalLights.needsUpdate=F,y.directionalLightShadows.needsUpdate=F,y.pointLights.needsUpdate=F,y.pointLightShadows.needsUpdate=F,y.spotLights.needsUpdate=F,y.spotLightShadows.needsUpdate=F,y.rectAreaLights.needsUpdate=F,y.hemisphereLights.needsUpdate=F}function Vc(y){return y.isMeshLambertMaterial||y.isMeshToonMaterial||y.isMeshPhongMaterial||y.isMeshStandardMaterial||y.isShadowMaterial||y.isShaderMaterial&&y.lights===!0}this.getActiveCubeFace=function(){return X},this.getActiveMipmapLevel=function(){return G},this.getRenderTarget=function(){return j},this.setRenderTargetTextures=function(y,F,Y){const V=O.get(y);V.__autoAllocateDepthBuffer=y.resolveDepthBuffer===!1,V.__autoAllocateDepthBuffer===!1&&(V.__useRenderToTexture=!1),O.get(y.texture).__webglTexture=F,O.get(y.depthTexture).__webglTexture=V.__autoAllocateDepthBuffer?void 0:Y,V.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(y,F){const Y=O.get(y);Y.__webglFramebuffer=F,Y.__useDefaultFramebuffer=F===void 0},this.setRenderTarget=function(y,F=0,Y=0){j=y,X=F,G=Y;let V=null,W=!1,ve=!1;if(y){const _e=O.get(y);if(_e.__useDefaultFramebuffer!==void 0){_.bindFramebuffer(D.FRAMEBUFFER,_e.__webglFramebuffer),re.copy(y.viewport),Me.copy(y.scissor),Be=y.scissorTest,_.viewport(re),_.scissor(Me),_.setScissorTest(Be),se=-1;return}else if(_e.__webglFramebuffer===void 0)z.setupRenderTarget(y);else if(_e.__hasExternalTextures)z.rebindTextures(y,O.get(y.texture).__webglTexture,O.get(y.depthTexture).__webglTexture);else if(y.depthBuffer){const Ge=y.depthTexture;if(_e.__boundDepthTexture!==Ge){if(Ge!==null&&O.has(Ge)&&(y.width!==Ge.image.width||y.height!==Ge.image.height))throw new Error("THREE.WebGLRenderer: Attached DepthTexture is initialized to the incorrect size.");z.setupDepthRenderbuffer(y)}}const we=y.texture;(we.isData3DTexture||we.isDataArrayTexture||we.isCompressedArrayTexture)&&(ve=!0);const Re=O.get(y).__webglFramebuffer;y.isWebGLCubeRenderTarget?(Array.isArray(Re[F])?V=Re[F][Y]:V=Re[F],W=!0):y.samples>0&&z.useMultisampledRTT(y)===!1?V=O.get(y).__webglMultisampledFramebuffer:Array.isArray(Re)?V=Re[Y]:V=Re,re.copy(y.viewport),Me.copy(y.scissor),Be=y.scissorTest}else re.copy(Ae).multiplyScalar(ie).floor(),Me.copy(nt).multiplyScalar(ie).floor(),Be=De;if(Y!==0&&(V=q),_.bindFramebuffer(D.FRAMEBUFFER,V)&&_.drawBuffers(y,V),_.viewport(re),_.scissor(Me),_.setScissorTest(Be),W){const _e=O.get(y.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_CUBE_MAP_POSITIVE_X+F,_e.__webglTexture,Y)}else if(ve){const _e=F;for(let we=0;we<y.textures.length;we++){const Re=O.get(y.textures[we]);D.framebufferTextureLayer(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0+we,Re.__webglTexture,Y,_e)}}else if(y!==null&&Y!==0){const _e=O.get(y.texture);D.framebufferTexture2D(D.FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,_e.__webglTexture,Y)}se=-1},this.readRenderTargetPixels=function(y,F,Y,V,W,ve,ye,_e=0){if(!(y&&y.isWebGLRenderTarget)){et("WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let we=O.get(y).__webglFramebuffer;if(y.isWebGLCubeRenderTarget&&ye!==void 0&&(we=we[ye]),we){_.bindFramebuffer(D.FRAMEBUFFER,we);try{const Re=y.textures[_e],Ge=Re.format,We=Re.type;if(y.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+_e),!A.textureFormatReadable(Ge)){et("WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!A.textureTypeReadable(We)){et("WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}F>=0&&F<=y.width-V&&Y>=0&&Y<=y.height-W&&D.readPixels(F,Y,V,W,fe.convert(Ge),fe.convert(We),ve)}finally{const Re=j!==null?O.get(j).__webglFramebuffer:null;_.bindFramebuffer(D.FRAMEBUFFER,Re)}}},this.readRenderTargetPixelsAsync=async function(y,F,Y,V,W,ve,ye,_e=0){if(!(y&&y.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let we=O.get(y).__webglFramebuffer;if(y.isWebGLCubeRenderTarget&&ye!==void 0&&(we=we[ye]),we)if(F>=0&&F<=y.width-V&&Y>=0&&Y<=y.height-W){_.bindFramebuffer(D.FRAMEBUFFER,we);const Re=y.textures[_e],Ge=Re.format,We=Re.type;if(y.textures.length>1&&D.readBuffer(D.COLOR_ATTACHMENT0+_e),!A.textureFormatReadable(Ge))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!A.textureTypeReadable(We))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Pe=D.createBuffer();D.bindBuffer(D.PIXEL_PACK_BUFFER,Pe),D.bufferData(D.PIXEL_PACK_BUFFER,ve.byteLength,D.STREAM_READ),D.readPixels(F,Y,V,W,fe.convert(Ge),fe.convert(We),0);const ct=j!==null?O.get(j).__webglFramebuffer:null;_.bindFramebuffer(D.FRAMEBUFFER,ct);const bt=D.fenceSync(D.SYNC_GPU_COMMANDS_COMPLETE,0);return D.flush(),await bh(D,bt,4),D.bindBuffer(D.PIXEL_PACK_BUFFER,Pe),D.getBufferSubData(D.PIXEL_PACK_BUFFER,0,ve),D.deleteBuffer(Pe),D.deleteSync(bt),ve}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(y,F=null,Y=0){const V=Math.pow(2,-Y),W=Math.floor(y.image.width*V),ve=Math.floor(y.image.height*V),ye=F!==null?F.x:0,_e=F!==null?F.y:0;z.setTexture2D(y,0),D.copyTexSubImage2D(D.TEXTURE_2D,Y,0,0,ye,_e,W,ve),_.unbindTexture()},this.copyTextureToTexture=function(y,F,Y=null,V=null,W=0,ve=0){let ye,_e,we,Re,Ge,We,Pe,ct,bt;const St=y.isCompressedTexture?y.mipmaps[ve]:y.image;if(Y!==null)ye=Y.max.x-Y.min.x,_e=Y.max.y-Y.min.y,we=Y.isBox3?Y.max.z-Y.min.z:1,Re=Y.min.x,Ge=Y.min.y,We=Y.isBox3?Y.min.z:0;else{const yt=Math.pow(2,-W);ye=Math.floor(St.width*yt),_e=Math.floor(St.height*yt),y.isDataArrayTexture?we=St.depth:y.isData3DTexture?we=Math.floor(St.depth*yt):we=1,Re=0,Ge=0,We=0}V!==null?(Pe=V.x,ct=V.y,bt=V.z):(Pe=0,ct=0,bt=0);const ht=fe.convert(F.format),Nt=fe.convert(F.type);let Se;F.isData3DTexture?(z.setTexture3D(F,0),Se=D.TEXTURE_3D):F.isDataArrayTexture||F.isCompressedArrayTexture?(z.setTexture2DArray(F,0),Se=D.TEXTURE_2D_ARRAY):(z.setTexture2D(F,0),Se=D.TEXTURE_2D),_.activeTexture(D.TEXTURE0),_.pixelStorei(D.UNPACK_FLIP_Y_WEBGL,F.flipY),_.pixelStorei(D.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),_.pixelStorei(D.UNPACK_ALIGNMENT,F.unpackAlignment);const en=_.getParameter(D.UNPACK_ROW_LENGTH),je=_.getParameter(D.UNPACK_IMAGE_HEIGHT),hn=_.getParameter(D.UNPACK_SKIP_PIXELS),bn=_.getParameter(D.UNPACK_SKIP_ROWS),Kn=_.getParameter(D.UNPACK_SKIP_IMAGES);_.pixelStorei(D.UNPACK_ROW_LENGTH,St.width),_.pixelStorei(D.UNPACK_IMAGE_HEIGHT,St.height),_.pixelStorei(D.UNPACK_SKIP_PIXELS,Re),_.pixelStorei(D.UNPACK_SKIP_ROWS,Ge),_.pixelStorei(D.UNPACK_SKIP_IMAGES,We);const Ai=y.isDataArrayTexture||y.isData3DTexture,dt=F.isDataArrayTexture||F.isData3DTexture;if(y.isDepthTexture){const yt=O.get(y),Zn=O.get(F),ut=O.get(yt.__renderTarget),Jn=O.get(Zn.__renderTarget);_.bindFramebuffer(D.READ_FRAMEBUFFER,ut.__webglFramebuffer),_.bindFramebuffer(D.DRAW_FRAMEBUFFER,Jn.__webglFramebuffer);for(let Ri=0;Ri<we;Ri++)Ai&&(D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,O.get(y).__webglTexture,W,We+Ri),D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,O.get(F).__webglTexture,ve,bt+Ri)),D.blitFramebuffer(Re,Ge,ye,_e,Pe,ct,ye,_e,D.DEPTH_BUFFER_BIT,D.NEAREST);_.bindFramebuffer(D.READ_FRAMEBUFFER,null),_.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else if(W!==0||y.isRenderTargetTexture||O.has(y)){const yt=O.get(y),Zn=O.get(F);_.bindFramebuffer(D.READ_FRAMEBUFFER,Z),_.bindFramebuffer(D.DRAW_FRAMEBUFFER,N);for(let ut=0;ut<we;ut++)Ai?D.framebufferTextureLayer(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,yt.__webglTexture,W,We+ut):D.framebufferTexture2D(D.READ_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,yt.__webglTexture,W),dt?D.framebufferTextureLayer(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,Zn.__webglTexture,ve,bt+ut):D.framebufferTexture2D(D.DRAW_FRAMEBUFFER,D.COLOR_ATTACHMENT0,D.TEXTURE_2D,Zn.__webglTexture,ve),W!==0?D.blitFramebuffer(Re,Ge,ye,_e,Pe,ct,ye,_e,D.COLOR_BUFFER_BIT,D.NEAREST):dt?D.copyTexSubImage3D(Se,ve,Pe,ct,bt+ut,Re,Ge,ye,_e):D.copyTexSubImage2D(Se,ve,Pe,ct,Re,Ge,ye,_e);_.bindFramebuffer(D.READ_FRAMEBUFFER,null),_.bindFramebuffer(D.DRAW_FRAMEBUFFER,null)}else dt?y.isDataTexture||y.isData3DTexture?D.texSubImage3D(Se,ve,Pe,ct,bt,ye,_e,we,ht,Nt,St.data):F.isCompressedArrayTexture?D.compressedTexSubImage3D(Se,ve,Pe,ct,bt,ye,_e,we,ht,St.data):D.texSubImage3D(Se,ve,Pe,ct,bt,ye,_e,we,ht,Nt,St):y.isDataTexture?D.texSubImage2D(D.TEXTURE_2D,ve,Pe,ct,ye,_e,ht,Nt,St.data):y.isCompressedTexture?D.compressedTexSubImage2D(D.TEXTURE_2D,ve,Pe,ct,St.width,St.height,ht,St.data):D.texSubImage2D(D.TEXTURE_2D,ve,Pe,ct,ye,_e,ht,Nt,St);_.pixelStorei(D.UNPACK_ROW_LENGTH,en),_.pixelStorei(D.UNPACK_IMAGE_HEIGHT,je),_.pixelStorei(D.UNPACK_SKIP_PIXELS,hn),_.pixelStorei(D.UNPACK_SKIP_ROWS,bn),_.pixelStorei(D.UNPACK_SKIP_IMAGES,Kn),ve===0&&F.generateMipmaps&&D.generateMipmap(Se),_.unbindTexture()},this.initRenderTarget=function(y){O.get(y).__webglFramebuffer===void 0&&z.setupRenderTarget(y)},this.initTexture=function(y){y.isCubeTexture?z.setTextureCube(y,0):y.isData3DTexture?z.setTexture3D(y,0):y.isDataArrayTexture||y.isCompressedArrayTexture?z.setTexture2DArray(y,0):z.setTexture2D(y,0),_.unbindTexture()},this.resetState=function(){X=0,G=0,j=null,_.reset(),me.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Rn}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(e){this._outputColorSpace=e;const t=this.getContext();t.drawingBufferColorSpace=Je._getDrawingBufferColorSpace(e),t.unpackColorSpace=Je._getUnpackColorSpace()}}const On={expedition:{id:"expedition",name:"远征",subtitle:"EXPEDITION",blurb:["判定窗口宽松，提示提前 450ms","腥风血雨为 5 段简化版","倒逆仅 2 回合，治疗有二次确认"],bossHp:7e4,bossDamageMul:.7,bossSpeedMul:.9,skillPerfect:110,skillGood:260,blockPerfect:100,blockOuter:260,telegraphLead:450,invertedTurns:2,invertedConfirm:!0,bloodStormHits:5,bossExtra:"none",weakDurability:1,rhythmVariants:!1,feints:!1,invertedFromHalfHp:!1},standard:{id:"standard",name:"标准",subtitle:"STANDARD",blurb:["原作节奏，提示提前 320ms","腥风血雨 7 段","阶段三有低概率额外行动"],bossHp:96e3,bossDamageMul:1,bossSpeedMul:1,skillPerfect:80,skillGood:180,blockPerfect:70,blockOuter:160,telegraphLead:320,invertedTurns:3,invertedConfirm:!1,bloodStormHits:7,bossExtra:"phase3rare",weakDurability:2,rhythmVariants:!1,feints:!1,invertedFromHalfHp:!1},expert:{id:"expert",name:"专家",subtitle:"EXPERT",blurb:["窗口极窄，提示提前 220ms","招式有节奏变体与假动作","阶段二起 Boss 会插入额外行动"],bossHp:13e4,bossDamageMul:1.25,bossSpeedMul:1.12,skillPerfect:50,skillGood:120,blockPerfect:45,blockOuter:105,telegraphLead:220,invertedTurns:3,invertedConfirm:!1,bloodStormHits:9,bossExtra:"phase2rule",weakDurability:3,rhythmVariants:!0,feints:!0,invertedFromHalfHp:!0}},om=["expedition","standard","expert"],lm=[{id:"sciel",name:"熙艾尔",role:"先见 / 增益 / 插队",hp:932,attack:170,defense:120,speed:118,ap:4,critRate:.1,weaponElement:"dark",portrait:"熙",color:"#a97cff",rimColor:"#7f6bd8",blurb:"以先见叠层与日月姿态操纵战局节奏。"},{id:"lune",name:"吕涅",role:"异色 / 燃烧 / 治疗",hp:1424,attack:155,defense:108,speed:106,ap:4,critRate:.08,weaponElement:"ice",portrait:"吕",color:"#59c9f2",rimColor:"#4aa6e8",blurb:"收集五色异色印记，以元素组合改写伤害与治疗。"},{id:"maelle",name:"玛埃尔",role:"姿态 / 爆发 / 破防",hp:1193,attack:190,defense:115,speed:125,ap:5,critRate:.12,weaponElement:"light",portrait:"玛",color:"#ff6f5e",rimColor:"#ffd479",blurb:"在攻守之间切换姿态，于高手态爆发致命剑舞。"}];function cm(i,e){return{id:i.id,name:i.name,kind:"player",role:i.role,hp:i.hp,maxHp:i.hp,ap:i.ap,maxAp:9,attack:i.attack,defense:i.defense,speed:i.speed,critRate:i.critRate,critResist:0,shield:2,maxShield:5,alive:!0,statuses:[],nextActAt:0,seq:e,weaponElement:i.weaponElement,elementMods:{},foretell:{},phaseTag:"sun",twilightTurns:0,alternations:0,lastTagUsed:null,stains:[],maxStains:4,stance:"none",breakGauge:0,breakMax:0,broken:!1,brokenSkipPending:!1,weakPoints:[],fateUsedInChain:!1,extraTurnUsedInRound:!1,portrait:i.portrait,color:i.color}}const ia=[{id:"heal",name:"中瓶疗愈亮色",target:"ally",desc:"恢复 45% 最大生命",longDesc:"单个友方恢复其最大生命 45%。若目标处于倒逆，治疗将转为等量伤害。",actionDelay:.95},{id:"energy",name:"强力精力亮色",target:"ally",desc:"获得 7 点行动点",longDesc:"单个友方获得 7 点行动点，上限 9。",actionDelay:.95},{id:"revive",name:"复苏亮色",target:"deadAlly",desc:"复活并恢复 50% 生命",longDesc:"复活一名已倒下的远征队员，并恢复其最大生命 50%。",actionDelay:.95}],At=i=>({element:"physical",power:0,hitWeights:[1],promptTimes:[],hitTimes:[1],actionDelay:1,tags:[],breakValue:0,kind:"attack",effects:[],...i}),$r=At({id:"basic",name:"攻击",owner:"*",ap:0,target:"enemy",element:"weapon",power:1100,hitWeights:[.3,.3,.4,.35,.45],promptTimes:[.72,1.36],hitTimes:[.8,1.44,2.06,2.6,3.06],actionDelay:1,breakValue:6,desc:"3 段武器攻击，赚取行动点",longDesc:"3 段武器攻击。0.72s / 1.36s 出现连协提示：第二次 Perfect 追加第 4 段；两次都 Perfect 时再追加一次小型协同击。每段造成生命伤害获得 1 行动点（每次攻击最多 3 点），最后一击的 Perfect 额外 +1。"}),yc=[At({id:"shadow_mark",name:"暗影标记",owner:"sciel",ap:3,target:"enemy",element:"dark",power:900,hitWeights:[.45,.55],promptTimes:[.62,1.16],hitTimes:[.7,1.24],tags:["moon"],breakValue:10,desc:"2 段暗影斩，施加 3 层先见与标记",longDesc:"对单体造成 2 段暗影伤害，施加 3 层先见与 1 层标记（下一段造成生命伤害的命中 x1.5）。2 次连协提示。属于「月相」标签。"}),At({id:"phantom_blade",name:"幻影之刃",owner:"sciel",ap:6,target:"enemy",element:"dark",power:3600,hitWeights:[1],promptTimes:[1.05],hitTimes:[1.15],actionDelay:1.15,tags:["sun"],breakValue:25,desc:"消耗先见的单体重击",longDesc:"消耗目标身上最多 10 层先见，每层使本次伤害 +15%。破防值 +25。连协 Perfect 时追加一段 35% 威力的影刃。属于「旭日」标签，旭日姿态下每消耗 1 层先见返还 1 行动点（最多 4 点）。"}),At({id:"foretell_gather",name:"先见汇聚",owner:"sciel",ap:3,target:"enemy",element:"physical",power:700,hitWeights:[1],promptTimes:[.6],hitTimes:[.72],tags:["moon"],breakValue:8,desc:"施加 2 层先见（0 层时改为 5 层）",longDesc:"对单体造成物理伤害并施加 2 层先见；若目标当前先见为 0 层，则改为施加 5 层。属于「月相」标签。"}),At({id:"full_prep",name:"准备万全",owner:"sciel",ap:5,target:"allyAll",element:"light",power:0,hitWeights:[1],promptTimes:[],hitTimes:[1],tags:["sun"],kind:"support",desc:"全队获得强力、坚壳、迅捷",longDesc:"全体友方获得强力（伤害 x1.25）、坚壳（受伤 x0.80）、迅捷（速度 x1.20），各持续 3 个自身回合。属于「旭日」标签。"}),At({id:"shadow_cleanse",name:"暗影洗涤",owner:"sciel",ap:4,target:"ally",element:"dark",power:0,hitWeights:[1],promptTimes:[],hitTimes:[.95],tags:["moon"],kind:"support",desc:"净化一个负面并扩散增益",longDesc:"清除目标身上的倒逆 / 虚弱 / 迟缓 / 着火 之一（按此优先级），并把该目标的正面增益以剩余时间 -1 扩散给全队。属于「月相」标签。"}),At({id:"fate_intervention",name:"命运干预",owner:"sciel",ap:7,target:"ally",element:"light",power:0,hitWeights:[1],promptTimes:[],hitTimes:[.9],tags:["sun"],kind:"support",desc:"目标立刻插到队首并 +4 AP",longDesc:"目标立即被插入行动队列首位，并获得 4 点行动点。同一行动链内同一角色不可再次被命运干预。属于「旭日」标签。"}),At({id:"immolation",name:"焚身",owner:"lune",ap:3,target:"enemy",element:"fire",power:800,hitWeights:[1],promptTimes:[.66],hitTimes:[.78],breakValue:8,desc:"施加 3 层着火，生成火异色",longDesc:"对单体造成火焰伤害并施加 3 层着火；若消费 1 个雷异色，额外施加 2 层。结算后生成 1 个火异色。"}),At({id:"thermal_conversion",name:"热能转化",owner:"lune",ap:3,target:"enemy",element:"ice",power:700,hitWeights:[.5,.5],promptTimes:[.6,1.1],hitTimes:[.68,1.18],breakValue:8,desc:"2 段冰伤，目标着火时返还 4 AP",longDesc:"对单体造成 2 段冰霜伤害。若目标处于着火状态，返还 4 点行动点；消费 1 个火异色时伤害 +50%。结算后生成 1 个冰异色。"}),At({id:"tidal_ice",name:"巨浪成冰",owner:"lune",ap:5,target:"enemyAll",element:"ice",power:1800,hitWeights:[1],promptTimes:[.85],hitTimes:[1],breakValue:12,desc:"全体冰伤 + 迟缓 2 回合",longDesc:"对敌方全体造成冰霜伤害并施加迟缓 2 回合；消费 1 个土异色时伤害 +75%。结算后生成 1 个冰异色。"}),At({id:"rampage",name:"狂杀",owner:"lune",ap:7,target:"enemy",element:"dynamic",power:3200,hitWeights:[1],promptTimes:[.75,1.23,1.71,2.19],hitTimes:[.85,1.33,1.81,2.29],actionDelay:1.15,breakValue:15,desc:"消耗全部异色，每色一段",longDesc:"消耗当前全部异色，每一种异色形成一段对应元素的攻击（1～4 段）。同时消费 4 种不同异色时额外 +45 破防值；最后一次连协 Perfect 额外 +20 破防值。"}),At({id:"typhoon",name:"台风",owner:"lune",ap:7,target:"field",element:"ice",power:0,hitWeights:[1],promptTimes:[],hitTimes:[1.2],kind:"support",desc:"延迟光环：每回合冰伤 + 治疗",longDesc:"布置台风光环：吕涅每个回合开始时对敌方全体造成 1400 威力冰霜伤害，并治疗全队最大生命 12%，默认持续 3 回合；同时消费火与冰异色时延长至 5 回合。注意：处于倒逆的队员会因治疗受到伤害。"}),At({id:"rebirth",name:"重生",owner:"lune",ap:5,target:"deadAlly",element:"light",power:0,hitWeights:[1],promptTimes:[],hitTimes:[1.1],kind:"revive",desc:"复活友方并恢复 50% 生命",longDesc:"复活一名已倒下的友方并恢复其最大生命 50%。消费 1 个光异色时行动点消耗降为 3。"}),At({id:"breakthrough",name:"势如破竹",owner:"maelle",ap:3,target:"enemy",element:"physical",power:800,hitWeights:[.5,.5],promptTimes:[.6,1.1],hitTimes:[.7,1.2],breakValue:10,desc:"2 段破盾，摧毁护盾返还 AP",longDesc:"2 段物理攻击，每段优先移除目标 1 层护盾，每摧毁 1 层返还 1 点行动点。若目标已经破防，玛埃尔额外获得一个回合（每轮最多一次）。"}),At({id:"stride_wide",name:"大步流星",owner:"maelle",ap:3,target:"enemy",element:"weapon",power:750,hitWeights:[1],promptTimes:[.62],hitTimes:[.74],breakValue:8,desc:"目标着火则进入高手，否则进入攻",longDesc:"单体武器元素攻击。若目标处于着火状态则进入「高手」姿态，否则进入「攻」姿态。连协 Miss / Good / Perfect 分别获得 0 / 1 / 2 点行动点。"}),At({id:"pierce_wind",name:"刺剑如风",owner:"maelle",ap:4,target:"enemyAll",element:"physical",power:1200,hitWeights:[1],promptTimes:[.7],hitTimes:[.85],breakValue:10,desc:"全体物理 + 破绽，结束进入守",longDesc:"对敌方全体造成物理伤害并施加破绽 1 回合（防御 x0.75）。动作结束后进入「守」姿态。"}),At({id:"blooming_slash",name:"剑花怒放",owner:"maelle",ap:5,target:"enemy",element:"physical",power:2600,hitWeights:[.32,.32,.36],promptTimes:[.68,1.22],hitTimes:[.78,1.32,1.86],actionDelay:1.15,breakValue:35,desc:"3 段爆发，+35 破防值",longDesc:"3 段物理攻击，破防值 +35。第一次连协 Miss 会取消第 3 段；两次提示都 Perfect 时，若原本处于高手姿态则保持高手，否则回到无姿态。"}),At({id:"sword_dance",name:"剑舞",owner:"maelle",ap:9,target:"enemy",element:"weapon",power:5200,hitWeights:[.18,.18,.2,.2,.24,.28],promptTimes:[.62,1.18,1.86],hitTimes:[.72,1.28,1.96,2.5,3,3.5],actionDelay:1.15,breakValue:20,desc:"5 段独立暴击，暴击 x2.0",longDesc:"5 段武器元素攻击，每段独立判定暴击且暴击伤害 x2.0。第一次连协 Miss 取消第 4 段，第二次 Miss 取消第 5 段，三次 Perfect 追加第 6 段。结算后离开高手姿态。"}),At({id:"offensive_shift",name:"进攻转换",owner:"maelle",ap:2,target:"enemy",element:"weapon",power:650,hitWeights:[1],promptTimes:[.58],hitTimes:[.7],breakValue:6,desc:"施加破绽 3 回合并进入攻",longDesc:"单体武器元素攻击，施加破绽 3 回合（防御 x0.75）并进入「攻」姿态（造成伤害 x1.50，所受伤害 x1.35）。"})],ii=Object.fromEntries([$r,...yc].map(i=>[i.id,i]));function Ec(i){return yc.filter(e=>e.owner===i)}function Qr(i,e){return i.id==="rebirth"&&e.stains.includes("light")?3:i.ap}const Ks={basic:{plan:()=>({hitCount:3}),onPrompt:(i,e,t)=>{e===1&&t==="perfect"&&(i.extendHit(.54,.35),i.action.flags.extra4=!0,i.log("连协成功 —— 追加第 4 段","perfect"),i.action.promptResults[0]==="perfect"&&(i.extendHit(.46,.45),i.action.flags.coop=!0,i.log("全 Perfect —— 队伍协同击","perfect")))},onEnd:i=>{const e=i.action.promptResults[i.action.promptResults.length-1];e==="perfect"&&i.addAp(i.actor.id,1,"基础攻击完美连协");const t=i.primaryTarget;i.actor.id==="sciel"&&t&&i.addForetell(t.id,1),i.actor.id==="lune"&&e==="perfect"&&i.addStain("light"),i.actor.id==="maelle"&&i.actor.stance==="none"&&i.setStance("defensive")}},shadow_mark:{onEnd:i=>{const e=i.primaryTarget;e&&(i.addForetell(e.id,3),i.applyStatus(e.id,"mark",1,3))}},phantom_blade:{plan:i=>{const e=i.primaryTarget;if(!e)return;const t=i.actor.phaseTag==="twilight"?20:10,n=i.consumeForetell(e.id,Math.min(10,t));return i.action.consumedForetell=n,n>0&&i.log("消耗 "+n+" 层先见 —— 伤害 +"+n*15+"%","sciel"),i.actor.phaseTag==="sun"&&n>0&&i.addAp(i.actor.id,Math.min(4,n),"旭日：先见返还"),{powerMul:1+.15*n}},onPrompt:(i,e,t)=>{e===0&&t==="perfect"&&(i.extendHit(.5,.35),i.action.flags.shadowBlade=!0,i.log("影刃追加段！","perfect"))}},foretell_gather:{onEnd:i=>{const e=i.primaryTarget;if(!e)return;const t=i.foretellOn(e.id);i.addForetell(e.id,t===0?5:2)}},full_prep:{onHit:i=>{for(const e of i.allies())i.applyStatus(e.id,"strong",1,3,e.id),i.applyStatus(e.id,"sturdy",1,3,e.id),i.applyStatus(e.id,"swift",1,3,e.id);i.log("准备万全 —— 全队 强力 / 坚壳 / 迅捷","buff")}},shadow_cleanse:{onHit:i=>{const e=i.primaryTarget;if(e){for(const t of["inverted","weak","slow","burn"])if(i.removeStatus(e.id,t)){i.log("暗影洗涤：清除 "+t,"buff");break}i.spreadBuffs(e.id)}}},fate_intervention:{onHit:i=>{const e=i.primaryTarget;e&&(i.insertAtQueueHead(e.id)?(i.addAp(e.id,4,"命运干预"),i.log("命运干预 —— "+e.name+" 立刻行动","sciel")):i.log("命运干预无效：该角色本行动链已被干预","warn"))}},immolation:{plan:i=>{i.action.flags.boostBurn=i.consumeStain("lightning")},onEnd:i=>{const e=i.primaryTarget;if(!e)return;const t=3+(i.action.flags.boostBurn?2:0);i.applyStatus(e.id,"burn",t,99),i.addStain("fire")}},thermal_conversion:{plan:i=>{const e=i.consumeStain("fire");return i.action.flags.boosted=e,{powerMul:e?1.5:1}},onStart:i=>{const e=i.primaryTarget;e&&i.hasStatus(e.id,"burn")&&i.addAp(i.actor.id,4,"热能转化：目标着火")},onEnd:i=>i.addStain("ice")},tidal_ice:{plan:i=>{const e=i.consumeStain("earth");return i.action.flags.boosted=e,{powerMul:e?1.75:1}},onEnd:i=>{for(const e of i.enemies())i.applyStatus(e.id,"slow",1,2,i.actor.id);i.addStain("ice")}},rampage:{plan:i=>{const e=[...i.actor.stains];if(i.action.consumedStains=e,i.actor.stains=[],new Set(e).size>=4&&(i.addBreak(45),i.log("四色狂杀 —— 破防值 +45","perfect")),e.length===0)return i.log("无异色可消耗 —— 狂杀仅 1 段","warn"),{hitCount:1,elements:[i.actor.weaponElement]};const n=e.map(()=>1/e.length);return i.action.weightsOverride=n,{hitCount:e.length,elements:e.map(s=>s)}},onPrompt:(i,e,t)=>{const n=i.action.consumedStains.length||1;e===n-1&&t==="perfect"&&(i.addBreak(20),i.log("狂杀收招 Perfect —— 破防值 +20","perfect"))}},typhoon:{plan:i=>{const e=i.consumeStain("fire"),t=i.consumeStain("ice");i.action.flags.longTyphoon=e&&t},onHit:i=>{const e=i.action.flags.longTyphoon?5:3;i.applyStatus(i.actor.id,"typhoon",1,e,i.actor.id),i.state.typhoonSourceId=i.actor.id,i.log("台风成形 —— 将在吕涅每个回合开始时触发 "+e+" 次","lune")}},rebirth:{plan:i=>{i.consumeStain("light")},onHit:i=>{const e=i.primaryTarget;e&&i.reviveActor(e.id,.5)}},breakthrough:{onHit:(i,e,t,n)=>{n&&i.addAp(i.actor.id,1,"势如破竹：摧毁护盾")},onEnd:i=>{const e=i.primaryTarget;e&&e.broken&&i.grantExtraTurn(i.actor.id)&&i.log("势如破竹 —— 玛埃尔额外获得一个回合","maelle")}},stride_wide:{onPrompt:(i,e,t)=>{const n=t==="perfect"?2:t==="good"?1:0;n>0&&i.addAp(i.actor.id,n,"大步流星连协")},onEnd:i=>{const e=i.primaryTarget;e&&i.hasStatus(e.id,"burn")?(i.setStance("virtuose"),i.log("目标着火 —— 玛埃尔进入高手姿态","maelle")):i.setStance("offensive")}},pierce_wind:{onEnd:i=>{for(const e of i.enemies())i.applyStatus(e.id,"vulnerable",1,1,i.actor.id);i.setStance("defensive")}},blooming_slash:{onPrompt:(i,e,t)=>{e===0&&t==="miss"&&(i.cancelHit(2),i.log("连协失手 —— 第 3 段取消","warn"))},onEnd:i=>{const[e,t]=i.action.promptResults;e==="perfect"&&t==="perfect"&&i.actor.stance==="virtuose"?i.log("剑花怒放全 Perfect —— 保持高手姿态","perfect"):i.setStance("none")}},sword_dance:{plan:()=>({hitCount:5}),onPrompt:(i,e,t)=>{e===0&&t==="miss"&&(i.cancelHit(3),i.log("剑舞第一次失手 —— 第 4 段取消","warn")),e===1&&t==="miss"&&(i.cancelHit(4),i.log("剑舞第二次失手 —— 第 5 段取消","warn")),e===2&&i.action.promptResults.slice(0,3).every(s=>s==="perfect")&&t==="perfect"&&(i.extendHit(.5,.28),i.action.flags.dance6=!0,i.log("三连 Perfect —— 追加第 6 段！","perfect"))},onEnd:i=>{i.actor.stance==="virtuose"&&i.setStance("none")}},offensive_shift:{onEnd:i=>{const e=i.primaryTarget;e&&i.applyStatus(e.id,"vulnerable",1,3,i.actor.id),i.setStance("offensive")}}};function tr(i){return{fire:"火",ice:"冰",lightning:"雷",earth:"土",light:"光"}[i]}function hm(i){return{fire:"#ff5a3c",ice:"#6fd9ff",lightning:"#ffd93b",earth:"#7ddb7a",light:"#fff6d8"}[i]}const pi=i=>i,fa=[pi({id:"four_arm_combo",name:"四臂连击",warning:"四臂连击",defenseHint:"四段递进 —— 最后一段最重",target:"single",impactTimes:[.98,1.54,2.32,2.68],power:1300,hitWeights:[.18,.2,.25,.37],elements:["physical","fire","dark","physical"],jumpHits:[],phases:[1,2,3],actionDelay:1,tail:.9,desc:"四条手臂依次挥落，最后一段命中会施加破绽。"}),pi({id:"swift_thrust",name:"迅敏突刺",warning:"动作迅敏",defenseHint:"三段急促 —— 前两段间隔极短",target:"single",impactTimes:[.72,.98,1.62],power:1050,hitWeights:[.25,.25,.5],elements:["physical","physical","dark"],jumpHits:[],phases:[1,2,3],actionDelay:.95,tail:.8,desc:"极快的三段突刺。任一段未完美格挡会让 Boss 恢复 10 点破防值。"}),pi({id:"sweeping_slash",name:"全体斩击",warning:"全体斩击",defenseHint:"金 / 紫 / 灰三波扫过全队",target:"all",impactTimes:[1.25,2.05,2.84],power:1450,hitWeights:[.3,.3,.4],elements:["fire","dark","physical"],jumpHits:[],phases:[1,2,3],actionDelay:1,tail:.9,desc:"三波剑气横扫全队。金色波未完美施加着火，紫色波有 35% 施加迟缓。"}),pi({id:"inverted_array",name:"倒逆剑阵",warning:"倒逆剑阵",defenseHint:"单段大范围 —— 完美格挡可完全免疫倒逆",target:"all",impactTimes:[1.75],power:260,hitWeights:[1],elements:["dark"],jumpHits:[],phases:[2,3],actionDelay:1,tail:1,desc:"低伤害但会施加倒逆：治疗将转为伤害。完美格挡完全免疫。"}),pi({id:"blade_charge",name:"刀锋蓄势",warning:"刀锋蓄势",defenseHint:"无攻击 —— Boss 正在强化",target:"self",impactTimes:[1.1],power:0,hitWeights:[1],elements:["light"],jumpHits:[],phases:[2,3],actionDelay:.9,tail:.6,desc:"Boss 获得 3 层护盾与强力 2 回合，下一次行动更偏向单体连击。"}),pi({id:"twin_execution",name:"双刃处刑",warning:"双刃处刑",defenseHint:"两段处刑 —— 瞄准最脆弱的人",target:"lowest",impactTimes:[.9,1.86],power:1550,hitWeights:[.35,.65],elements:["light","dark"],jumpHits:[],phases:[3],actionDelay:1.05,tail:.9,desc:"对生命最低者的两段处刑。第二段未完美且目标低于 30% 生命时额外施加 2 层着火。"}),pi({id:"blood_storm",name:"腥风血雨",warning:"腥风血雨",defenseHint:"七段混合 —— 第 3 / 6 段为地面横扫，同样按空格跳跃",target:"all",impactTimes:[1.08,1.56,1.96,2.75,3.06,3.48,4.32],power:2400,hitWeights:[.1,.1,.12,.14,.14,.16,.24],elements:["fire","dark","physical","fire","dark","physical","light"],jumpHits:[2,5],phases:[3],actionDelay:1.25,tail:1.2,desc:"终结技。任一段 Miss 会让下一段速度 +8%；全 Perfect 时队伍反击伤害额外 x1.5。"})],sa=Object.fromEntries(fa.map(i=>[i.id,i])),dm={physical:1,fire:.85,ice:1.25,lightning:1,earth:.9,light:1.1,dark:.8};function um(i){const e=[{id:"gold_core",name:"金剑核心",durability:i.weakDurability,maxDurability:i.weakDurability,broken:!1,anchor:[1.15,2.35,.35],color:"#ffcf6b"},{id:"violet_core",name:"紫剑核心",durability:i.weakDurability,maxDurability:i.weakDurability,broken:!1,anchor:[-1.15,2.35,.35],color:"#b483ff"}];return{id:"boss",name:"四手剑客",kind:"boss",role:"苍白之城的守卫",hp:i.bossHp,maxHp:i.bossHp,ap:0,maxAp:0,attack:210,defense:135,speed:100*i.bossSpeedMul,critRate:.05,critResist:.2,shield:0,maxShield:5,alive:!0,statuses:[],nextActAt:0,seq:10,weaponElement:"dark",elementMods:{...dm},foretell:{},phaseTag:"sun",twilightTurns:0,alternations:0,lastTagUsed:null,stains:[],maxStains:0,stance:"none",breakGauge:0,breakMax:100,broken:!1,brokenSkipPending:!1,weakPoints:e,fateUsedInChain:!1,extraTurnUsedInRound:!1,portrait:"四",color:"#e8dccb"}}function fm(i,e,t){let n=[...i.impactTimes],s=[...i.hitWeights],a=[...i.elements],r=[...i.jumpHits],o=null,l=null;return i.id==="blood_storm"&&(e.bloodStormHits===5?(n=[1.08,1.62,2.1,2.9,3.4],s=[.16,.18,.2,.2,.26],a=["fire","dark","physical","dark","light"],r=[2],l="简化五段"):e.bloodStormHits===9&&(n=[...n,4.68,5.1],s=[.08,.08,.1,.11,.11,.12,.16,.1,.14],a=[...a,"dark","fire"],r=[2,5,7],l="九段变体")),e.rhythmVariants&&i.id==="four_arm_combo"&&t>.5&&(n=[.88,1.24,2.08,2.34,2.7],s=[.14,.16,.2,.22,.28],a=["physical","fire","dark","physical","dark"],l="五段疾风节奏"),e.rhythmVariants&&i.id==="sweeping_slash"&&t>.55&&(n=[n[0],n[1],n[2]+.22],l="第三波延迟"),e.feints&&i.id==="swift_thrust"&&t>.45&&(o=Math.max(.2,n[0]-.34),l="带假动作"),{move:i,impactTimes:n,hitWeights:s,elements:a,jumpHits:r,feintAt:o,variantName:l,tail:i.tail}}const sn=i=>i,ds={burn:sn({id:"burn",name:"着火",kind:"debuff",stacking:"stacks",maxStacks:10,tickOn:"self",icon:"火",describe:i=>"自身回合结束时受到 最大生命 1.2% x "+i.stacks+" 的火焰伤害，然后减少 1 层。"}),mark:sn({id:"mark",name:"标记",kind:"debuff",stacking:"refresh",maxStacks:1,tickOn:"applier",icon:"标",describe:()=>"下一段造成生命伤害的命中伤害 x1.5，随后移除。被护盾完全吸收时不消耗。"}),vulnerable:sn({id:"vulnerable",name:"破绽",kind:"debuff",stacking:"refresh",maxStacks:1,tickOn:"applier",icon:"绽",describe:()=>"防御 x0.75（按施加者回合计时）。"}),strong:sn({id:"strong",name:"强力",kind:"buff",stacking:"refresh",maxStacks:1,tickOn:"self",icon:"强",describe:()=>"造成伤害 x1.25。"}),sturdy:sn({id:"sturdy",name:"坚壳",kind:"buff",stacking:"refresh",maxStacks:1,tickOn:"self",icon:"壳",describe:()=>"所受伤害 x0.80。"}),swift:sn({id:"swift",name:"迅捷",kind:"buff",stacking:"refresh",maxStacks:1,tickOn:"self",icon:"迅",describe:()=>"速度 x1.20，并立即重算尚未执行的下一次行动时间。"}),slow:sn({id:"slow",name:"迟缓",kind:"debuff",stacking:"refresh",maxStacks:1,tickOn:"self",icon:"迟",describe:()=>"速度 x0.80。"}),weak:sn({id:"weak",name:"虚弱",kind:"debuff",stacking:"refresh",maxStacks:1,tickOn:"self",icon:"弱",describe:()=>"造成伤害 x0.75。"}),inverted:sn({id:"inverted",name:"倒逆",kind:"debuff",stacking:"refresh",maxStacks:1,tickOn:"self",icon:"逆",describe:()=>"所有正数治疗转为等量无元素伤害，可以致死。慎用治疗与台风！"}),typhoon:sn({id:"typhoon",name:"台风",kind:"buff",stacking:"refresh",maxStacks:1,tickOn:"self",icon:"台",describe:i=>"吕涅回合开始时对敌方全体造成冰伤并治疗全队最大生命 12%，剩余 "+i.turns+" 次。"}),broken:sn({id:"broken",name:"破防",kind:"debuff",stacking:"refresh",maxStacks:1,tickOn:"self",icon:"破",describe:()=>"所受伤害 x1.25，并失去下一次排定行动。"}),noFireInfuse:sn({id:"noFireInfuse",name:"金剑核心破损",kind:"debuff",stacking:"refresh",maxStacks:1,tickOn:"self",icon:"金",describe:i=>"着火附加能力失效，剩余 "+i.turns+" 个 Boss 回合。"}),defenseUp:sn({id:"defenseUp",name:"守势",kind:"buff",stacking:"refresh",maxStacks:1,tickOn:"self",icon:"守",describe:()=>"防御 x1.25。"})};function pm(i){return ds[i.id].describe(i)}const Al=9999;function Wt(i,e){return i.statuses.some(t=>t.id===e&&(t.stacks>0||t.turns>0))}function mm(i,e){const t=i.statuses.find(n=>n.id===e);return t?t.stacks:0}function gm(i){let e=1;return Wt(i,"strong")&&(e*=1.25),Wt(i,"weak")&&(e*=.75),e}function _m(i){let e=1;return Wt(i,"sturdy")&&(e*=.8),i.broken&&(e*=1.25),i.stance==="offensive"&&(e*=1.35),i.stance==="defensive"&&(e*=.5),e}function vm(i){return i.stance==="offensive"?1.5:i.stance==="virtuose"?3:1}function xm(i){return i.phaseTag==="twilight"?1.75:1}function Mm(i){let e=i.defense;return Wt(i,"vulnerable")&&(e*=.75),Wt(i,"defenseUp")&&(e*=1.25),e}function Sm(i){let e=i.speed;return Wt(i,"swift")&&(e*=1.2),Wt(i,"slow")&&(e*=.8),Math.max(1,e)}function bm(i,e){const t=i.elementMods[e];return t===void 0?1:t}function ym(i){return i==="perfect"?1.25:i==="good"?1:i==="miss"?.65:1}function Em(i){const e=i.power*(i.attacker.attack/160)*i.hitWeight*i.powerMul,n=100/(100+Math.max(0,Mm(i.target)*i.defenseModifier)),s=vm(i.attacker),a=gm(i.attacker)*_m(i.target),r=bm(i.target,i.element),o=i.markConsumed?1.5:1,l=i.qteMul,c=i.crit?i.critMultiplier:1,h=xm(i.attacker),u=e*n*s*a*r*o*l*c*i.variance*h*i.extraMul,d=Math.floor(u),p=d<0?-1:1,g=Math.abs(d)>Al;return{damage:g?p*Al:d,uncapped:d,capped:g,base:e,mitigation:n,factors:{stance:s,buff:a,element:r,mark:o,qte:l,crit:c,variance:i.variance,twilight:h,extra:i.extraMul},weakness:r>1,resist:r<1&&r>0,immune:r===0,absorb:r<0}}function Tm(i,e){return Math.max(0,i.critRate-e.critResist)}function wm(i,e){const t=Math.abs(i);return t<=e.skillPerfect?"perfect":t<=e.skillGood?"good":"miss"}function Am(i,e){const t=Math.abs(i);return t<=e.blockPerfect?"perfect":t<=e.blockOuter?"block":"outside"}const Rl=60,nr=250,Rm=120,Cm=650;function Pm(i){return i==="perfect"?0:i==="block"?.3:1}function Zs(i,e){return 1e3/Sm(i)*e}const jr=["four_arm_combo","sweeping_slash","swift_thrust"];function Lm(i){return fa.filter(e=>e.phases.includes(i))}function Im(i,e){const t=i.actors[i.bossId],n=i.partyOrder.map(g=>i.actors[g]).filter(g=>g.alive);if(i.forcedBossMove){const g=fa.find(x=>x.id===i.forcedBossMove);if(g)return{move:g,reason:"阶段强制"}}if(i.phase===1&&i.tutorialIndex<jr.length){const g=jr[i.tutorialIndex],x=fa.find(m=>m.id===g);if(x)return{move:x,reason:"教学节奏"}}const s=Lm(i.phase),a=Math.max(0,...n.map(g=>g.ap)),r=n.some(g=>g.stance==="virtuose"),o=n.some(g=>Wt(g,"typhoon")),l=n.some(g=>Wt(g,"inverted")),c=t.hp/t.maxHp,h=i.bossHistory[i.bossHistory.length-1],u=i.bossActionCount-i.lastBloodStormAt>=4,d=s.map(g=>{let x=1,m="常规";switch(g.id){case"four_arm_combo":x=3,r&&(x+=2.5,m="压制高手姿态");break;case"swift_thrust":x=2.4,a>=7&&(x+=1.6,m="打断高 AP 角色");break;case"sweeping_slash":x=2.6,n.length===3&&(x+=.8);break;case"inverted_array":x=1.6,o&&(x+=3.2,m="台风将反噬远征队"),!l&&a>=6&&(x+=1.2,m="压制治疗节奏"),l&&(x-=1.2);break;case"blade_charge":x=1.2,t.shield===0&&c<.6&&(x+=1.8,m="重整刀锋"),t.broken&&(x+=1.5);break;case"twin_execution":{x=2.2;const f=n.slice().sort((M,w)=>M.hp/M.maxHp-w.hp/w.maxHp)[0];f&&f.hp/f.maxHp<.45&&(x+=2.6,m="处刑濒死者");break}case"blood_storm":x=u?2:0,m="终结技";break;default:x=1}return g.id===h&&(x*=.35),{item:{move:g,reason:m},weight:Math.max(0,x)}});return e.weighted(d)}function Dm(i,e,t){const n=i.partyOrder.map(r=>i.actors[r]).filter(r=>r.alive);if(n.length===0)return[];if(e.target==="all")return n;if(e.target==="self")return[i.actors[i.bossId]];if(e.target==="lowest")return[n.slice().sort((r,o)=>r.hp/r.maxHp-o.hp/o.maxHp)[0]];let s=n;if(n.length>1&&i.lastSingleTargetId){const r=n.filter(o=>o.id!==i.lastSingleTargetId);r.length>0&&(s=r)}const a=t.next();if(a<.4)return[s.slice().sort((o,l)=>l.ap-o.ap)[0]];if(a<.65){const r=s.find(o=>o.stance==="virtuose");if(r)return[r]}return[t.pick(s)]}function Um(i,e,t){return e==="none"?!1:e==="phase2rule"?i.phase>=2&&i.bossActionCount>0&&i.bossActionCount%3===0:e==="phase3rare"?i.phase>=3&&t.chance(.22):!1}class So{s;seed;calls=0;constructor(e){this.seed=e>>>0,this.s=e>>>0||2654435769}next(){this.calls++,this.s=this.s+1831565813>>>0;let e=this.s;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}range(e,t){return e+this.next()*(t-e)}int(e,t){return Math.floor(this.range(e,t))}chance(e){return this.next()<e}pick(e){return e[Math.min(e.length-1,Math.floor(this.next()*e.length))]}weighted(e){const t=e.reduce((s,a)=>s+Math.max(0,a.weight),0);if(t<=0)return e[0].item;let n=this.next()*t;for(const s of e)if(n-=Math.max(0,s.weight),n<=0)return s.item;return e[e.length-1].item}clone(){const e=new So(this.seed);return e.s=this.s,e.calls=this.calls,e}snapshot(){return{s:this.s,calls:this.calls}}restore(e){this.s=e.s,this.calls=e.calls}}const km=2e3,Nm=1850,Cl=800,ir=700,Pl=460,Fm=1e3,Om=260,Bm=1400;class Tc{cfg;rng;state;out=[];records=[];inputs=[];idSeq=0;pressSeq=0;currentEntryIsExtra=!1;pendingBossTurnEnd=!1;currentMoveTimeline=null;disposed=!1;constructor(e){this.cfg=On[e.difficulty];const t=e.seed===void 0?Math.floor(Math.random()*4294967295)>>>0:e.seed>>>0;this.rng=new So(t),this.state=this.createState(e.difficulty,t)}createState(e,t){const n={},s=[];lm.forEach((r,o)=>{const l=cm(r,o);l.nextActAt=1e3/l.speed,n[l.id]=l,s.push(l.id)});const a=um(this.cfg);return a.nextActAt=1e3/a.speed,n[a.id]=a,{fsm:"BOOT",difficulty:e,seed:t,now:0,paused:!1,actors:n,partyOrder:s,bossId:a.id,phase:1,pendingPhase:null,inventory:{heal:2,energy:2,revive:1},stats:{startedAt:0,elapsedMs:0,totalDamage:0,maxHit:0,damageTaken:0,perfectBlocks:0,normalBlocks:0,missedBlocks:0,dodges:0,fullCounters:0,promptPerfect:0,promptGood:0,promptMiss:0,bestBlockChain:0,turns:0,weakPointsBroken:0,healing:0},currentActorId:null,action:null,pending:null,blockChain:0,chainDefensibleCount:0,chainPerfectCount:0,chainResolvedCount:0,apFromBlocksThisChain:{},defensiveApThisChain:{},counterArmed:!1,counterWindow:null,counterResolved:!1,spamCooldownUntil:-1,activePrompt:null,activeDefense:null,bossHistory:[],bossActionCount:0,bossMoveName:null,bossMoveVariant:null,bossMoveHint:null,extraEntries:[],forcedBossMove:null,lastBloodStormAt:-99,lastSingleTargetId:null,typhoonSourceId:null,outcome:"none",pendingVictoryAt:null,pendingDefeatAt:null,phaseTransitionEndsAt:null,introEndsAt:null,roundCounter:1,aimShotsFired:0,tutorialIndex:0,lastPressId:0,lastPromptDelta:null,lastDefenseDelta:null,message:null,seqCounter:100,queueNow:0,invertedReduction:0,counterBonusMul:1}}start(){this.state.fsm="INTRO",this.state.introEndsAt=this.state.now+km,this.state.stats.startedAt=this.state.now,this.emit("stateChange",{from:"BOOT",to:"INTRO"}),this.emit("log",{text:"远征队与四手剑客对峙 —— 空格键即是生死线",tone:"intro"}),this.emit("queueChange",{entries:this.previewQueue(8)})}dispose(){this.disposed=!0,this.out=[],this.state.action&&(this.state.action.cancelled=!0),this.state.action=null,this.state.counterWindow=null,this.state.activePrompt=null,this.state.activeDefense=null}emit(e,t){this.disposed||(this.out.push({type:e,payload:t,at:this.state.now}),this.records.push({t:Math.round(this.state.now),kind:e,data:t}),this.records.length>6e3&&this.records.splice(0,2e3))}drain(){const e=this.out;return this.out=[],e}setFsm(e){if(this.state.fsm===e)return;const t=this.state.fsm;this.state.fsm=e,this.emit("stateChange",{from:t,to:e})}nextId(e){return this.idSeq+=1,e+"_"+this.idSeq}recordInput(e,t){this.inputs.push({t:this.state.now,kind:e,data:t})}advance(e){if(this.state.paused||this.disposed)return;const t=Math.max(0,Math.min(e,500)),n=this.state.now+t;let s=0;for(;s++<4e3;){const a=this.earliestDue(n);if(!a)break;a.at>this.state.now&&(this.state.now=a.at),this.announceWindows(),a.run()}n>this.state.now&&(this.state.now=n),this.announceWindows(),this.state.outcome==="none"&&(this.checkOutcomes(),this.state.stats.elapsedMs=this.state.now-this.state.stats.startedAt)}advanceTo(e){let t=0;for(;this.state.now<e&&t++<2e4;){const n=Math.min(500,e-this.state.now),s=this.state.now;if(this.advance(n),this.state.now<=s)break}}setPaused(e){this.state.paused=e}pump(){let e=0;for(;e++<4e3;){const t=this.earliestDue(this.state.now);if(!t)break;this.announceWindows(),t.run()}this.announceWindows()}earliestDue(e){const t=this.state;if(t.outcome!=="none")return null;const n=[];if(t.pendingVictoryAt!==null&&e>=t.pendingVictoryAt&&n.push({at:t.pendingVictoryAt,prio:0,run:()=>this.finishVictory()}),t.pendingDefeatAt!==null&&e>=t.pendingDefeatAt&&n.push({at:t.pendingDefeatAt,prio:0,run:()=>this.finishDefeat()}),t.fsm==="INTRO"&&t.introEndsAt!==null&&e>=t.introEndsAt&&n.push({at:t.introEndsAt,prio:2,run:()=>{t.introEndsAt=null,this.beginNextTurn()}}),t.fsm==="PHASE_TRANSITION"&&t.phaseTransitionEndsAt!==null&&e>=t.phaseTransitionEndsAt&&n.push({at:t.phaseTransitionEndsAt,prio:2,run:()=>{t.phaseTransitionEndsAt=null,this.beginNextTurn()}}),t.counterWindow&&!t.counterResolved&&e>t.counterWindow.closesAt){const a=t.counterWindow;n.push({at:a.closesAt,prio:3,run:()=>{t.counterResolved=!0,t.counterArmed=!1,this.emit("log",{text:"反击窗口错过 —— 队伍收剑",tone:"warn"}),this.finishBossAction()}})}const s=t.action;if(s&&!s.cancelled){const a=this.dueEvent(s,e);a&&n.push({at:this.eventDueTime(a),prio:1,run:()=>this.resolveEvent(s,a)})}return n.length===0?null:(n.sort((a,r)=>a.at-r.at||a.prio-r.prio),n[0])}eventDueTime(e){return e.type==="prompt"?e.at+this.cfg.skillGood:e.type==="defenseHit"&&e.defensible?e.bufferedPressAt!==void 0?e.at-this.cfg.blockOuter:e.at+this.cfg.blockOuter:e.at}hitBlockedByPrompt(e,t){if(t.type!=="hit"||t.promptFor===void 0||t.promptFor<0)return!1;const n=e.events.find(s=>s.type==="prompt"&&s.index===t.promptFor);return n?!n.resolved&&!n.cancelled:!1}dueEvent(e,t){let n=null,s=1/0,a=!1;for(const r of e.events)r.resolved||r.cancelled||r.type!=="end"&&(a=!0);for(const r of e.events){if(r.resolved||r.cancelled||r.type==="end"&&a||this.hitBlockedByPrompt(e,r))continue;const o=this.eventDueTime(r);o<=t&&o<s&&(n=r,s=o)}return n}skipDeadTargetHits(e){const t=this.state;if(e.kind!=="boss")return;let n=!1;for(const s of e.events){if(s.type!=="defenseHit"||!s.defensible||s.resolved||s.cancelled)continue;const a=s.targetIds&&s.targetIds.length?s.targetIds:s.targetId?[s.targetId]:[];a.length!==0&&a.every(r=>!t.actors[r]||!t.actors[r].alive)&&(s.cancelled=!0,t.chainDefensibleCount=Math.max(0,t.chainDefensibleCount-1),n=!0,this.emit("log",{text:"目标已倒下 —— 该段攻击落空",tone:"info"}))}n&&(this.refreshActionEnd(e),e.events.filter(a=>a.type==="defenseHit"&&a.defensible&&!a.resolved&&!a.cancelled).length===0&&this.maybeOpenCounter(e))}announceWindows(){const e=this.state,t=e.action;if(e.activePrompt=null,e.activeDefense=null,!t||t.cancelled)return;this.skipDeadTargetHits(t);const n=Math.max(this.cfg.telegraphLead,this.cfg.skillGood),s=Math.max(this.cfg.telegraphLead,this.cfg.blockOuter+Rl),a=t.events.filter(o=>o.type==="prompt"),r=t.events.filter(o=>o.type==="defenseHit"&&o.defensible);for(const o of a)o.resolved||o.cancelled||e.now>=o.at-n&&(o.announced||(o.announced=!0,this.emit("promptOpen",{eventId:o.id,at:o.at,index:o.index,total:a.length,kind:"skill"})),e.activePrompt===null&&(e.activePrompt={eventId:o.id,at:o.at,index:o.index,total:a.length,kind:"skill"}));for(const o of r)o.resolved||o.cancelled||e.now>=o.at-s&&(o.announced||(o.announced=!0,e.fsm==="BOSS_TELEGRAPH"&&this.setFsm("DEFENSE_SEQUENCE"),this.emit("defenseOpen",{eventId:o.id,at:o.at,index:o.index,total:e.chainDefensibleCount,targetId:o.targetId||"",jump:!!o.jump})),e.activeDefense===null&&(e.activeDefense={eventId:o.id,at:o.at,jump:!!o.jump,targetId:o.targetId||"",index:o.index,total:e.chainDefensibleCount}))}queueEntries(){const e=this.state,t=[];for(const n of[...e.partyOrder,e.bossId]){const s=e.actors[n];s.alive&&t.push({actorId:n,at:s.nextActAt,seq:s.seq,kind:"actor"})}for(const n of e.extraEntries)e.actors[n.actorId]&&e.actors[n.actorId].alive&&t.push(n);return t.sort((n,s)=>n.at-s.at||n.seq-s.seq),t}previewQueue(e=8){const t=this.state,n=this.queueEntries().map(l=>({...l})),s={};for(const l of n)l.kind==="actor"&&(s[l.actorId]=l.at);const a=[],r=n.slice();let o=0;for(;a.length<e&&o++<60;){r.sort((c,h)=>c.at-h.at||c.seq-h.seq);const l=r.shift();if(!l)break;if(a.push({...l}),l.kind==="actor"){const c=t.actors[l.actorId],h=Zs(c,1);r.push({actorId:l.actorId,at:l.at+h,seq:c.seq,kind:"actor"})}}return a}advanceActorClock(e,t){e.nextActAt=Math.max(e.nextActAt,this.state.queueNow)+Zs(e,t)}beginNextTurn(){const e=this.state;if(e.outcome!=="none"||e.pendingVictoryAt!==null||e.pendingDefeatAt!==null)return;if(e.pendingPhase!==null){this.startPhaseTransition(e.pendingPhase);return}e.action=null,e.pending=null,e.counterWindow=null,e.counterArmed=!1,e.counterResolved=!1;const t=this.queueEntries();if(t.length===0)return;const n=t[0];if(e.queueNow=n.at,this.currentEntryIsExtra=n.kind==="extra",this.currentEntryIsExtra){const a=e.extraEntries.findIndex(r=>r.actorId===n.actorId&&r.at===n.at);a>=0&&e.extraEntries.splice(a,1)}e.currentActorId=n.actorId;const s=e.actors[n.actorId];if(e.stats.turns+=1,this.setFsm("TURN_START"),this.emit("turnStart",{actorId:s.id,isBoss:s.kind==="boss"}),this.emit("queueChange",{entries:this.previewQueue(8)}),s.kind==="boss"){if(s.brokenSkipPending){s.brokenSkipPending=!1,s.broken=!1,s.breakGauge=0,this.emit("breakChange",{value:0,broken:!1}),this.emit("log",{text:"四手剑客从破防中恢复 —— 失去这次行动",tone:"break"}),this.advanceActorClock(s,1),this.beginNextTurn();return}this.startBossAction();return}this.onPlayerTurnStart(s)}onPlayerTurnStart(e){if(Wt(e,"typhoon")&&this.triggerTyphoon(e),!(this.state.outcome!=="none"||this.state.pendingVictoryAt!==null||this.state.pendingDefeatAt!==null)){if(!e.alive){this.endTurn(1);return}this.setFsm("COMMAND")}}triggerTyphoon(e){const t=this.state,n=e.statuses.find(a=>a.id==="typhoon");if(!n)return;this.emit("log",{text:"台风席卷战场 —— 冰霜伤敌并治疗全队",tone:"lune"});const s=t.actors[t.bossId];s.alive&&this.dealDamage({attacker:e,target:s,power:Bm,hitWeight:1,element:"ice",qteMul:1,powerMul:1,critMultiplier:1.5,eventId:this.nextId("typhoon"),index:0,extraMul:1,allowShield:!0,canCrit:!0});for(const a of t.partyOrder){const r=t.actors[a];r.alive&&this.healActor(r.id,Math.floor(r.maxHp*.12),e.id)}n.turns-=1,n.turns<=0?(this.removeStatus(e.id,"typhoon"),t.typhoonSourceId=null,this.emit("log",{text:"台风消散",tone:"info"})):this.emit("statusChange",{targetId:e.id,statusId:"typhoon",stacks:1,turns:n.turns,removed:!1}),this.checkOutcomes()}availableSkills(e){return Ec(e)}chooseCommand(e){const t=this.state;return t.fsm!=="COMMAND"?!1:(this.recordInput("command",{kind:e}),e==="attack"?(t.pending={kind:"attack"},this.setFsm("TARGET_SELECT"),!0):e==="aim"?t.actors[t.currentActorId].ap<1?!1:(t.pending={kind:"aim"},t.aimShotsFired=0,this.setFsm("AIM"),!0):!0)}chooseSkill(e){const t=this.state;if(t.fsm!=="COMMAND")return!1;const n=t.actors[t.currentActorId],s=ii[e];return!s||s.owner!==n.id||n.ap<Qr(s,n)?!1:(this.recordInput("skill",{skillId:e}),t.pending={kind:"skill",skillId:e},s.target==="allyAll"||s.target==="field"||s.target==="self"?(this.startPlayerAction(),!0):(this.setFsm("TARGET_SELECT"),!0))}chooseItem(e){const t=this.state;return t.fsm!=="COMMAND"||!ia.find(s=>s.id===e)||t.inventory[e]<=0?!1:(this.recordInput("item",{itemId:e}),t.pending={kind:"item",itemId:e},this.setFsm("TARGET_SELECT"),!0)}legalTargets(){const e=this.state;if(!e.pending)return[];const t=e.pending;let n="enemy";switch(t.kind==="skill"&&t.skillId&&(n=ii[t.skillId].target),t.kind==="item"&&t.itemId&&(n=ia.find(s=>s.id===t.itemId).target),t.kind==="attack"&&(n="enemy"),n){case"enemy":case"enemyAll":return[e.bossId];case"ally":return e.partyOrder.filter(s=>e.actors[s].alive);case"allyAll":return e.partyOrder.filter(s=>e.actors[s].alive);case"deadAlly":return e.partyOrder.filter(s=>!e.actors[s].alive);case"self":return[e.currentActorId];default:return[e.bossId]}}chooseTarget(e){const t=this.state;return t.fsm!=="TARGET_SELECT"||!t.pending||!this.legalTargets().includes(e)?!1:(this.recordInput("target",{targetId:e}),this.startPlayerAction(e),!0)}back(){const e=this.state;return e.fsm==="TARGET_SELECT"?(e.pending=null,this.setFsm("COMMAND"),this.recordInput("back"),!0):e.fsm==="AIM"?(this.exitAim(),!0):!1}makeAction(e,t,n){return{id:this.nextId("act"),actorId:t,kind:e,targetIds:n,startedAt:this.state.now,events:[],promptResults:[],blockResults:[],cancelled:!1,apSpent:0,breakAccrued:0,flags:{},consumedStains:[],consumedForetell:0,cameraShots:0,endsAt:this.state.now,powerMul:1,defensibleTotal:0,perfectChain:!0}}startPlayerAction(e){const t=this.state,n=t.pending;if(!n)return;const s=t.actors[t.currentActorId];if(t.pending=null,n.kind==="item"){this.startItemAction(s,n.itemId,e);return}const a=n.kind==="attack"?$r:ii[n.skillId],r=this.resolveTargetIds(a.target,e),o=this.makeAction(n.kind==="attack"?"attack":"skill",s.id,r);o.skillId=a.id;const l=Qr(a,s);if(s.ap<l){this.emit("log",{text:"行动点不足",tone:"warn"}),this.setFsm("COMMAND");return}l>0&&(this.addAp(s.id,-l,a.name),o.apSpent=l),t.action=o,this.applyPhaseTagAlternation(s,a.tags);const c=this.runtimeFor(o),h=Ks[a.id];let u={};h&&h.plan&&(u=h.plan(c)||{}),o.powerMul=u.powerMul===void 0?1:u.powerMul,u.elements&&(o.elementsOverride=u.elements),this.scheduleSkillEvents(o,a,u),this.setFsm("PLAYER_ACTION"),this.emit("actionStart",{action:o}),this.emit("log",{text:s.name+" 使用 "+a.name,tone:s.id}),h&&h.onStart&&h.onStart(c)}startItemAction(e,t,n){const s=this.state,a=ia.find(l=>l.id===t),r=s.inventory;if(r[t]<=0){this.setFsm("COMMAND");return}r[t]-=1;const o=this.makeAction("item",e.id,[n]);o.itemId=t,o.events.push({id:this.nextId("ev"),at:s.now+800,type:"hit",index:0,resolved:!1,weight:1}),o.endsAt=s.now+800+ir,o.events.push({id:this.nextId("ev"),at:o.endsAt,type:"end",index:0,resolved:!1}),s.action=o,this.setFsm("PLAYER_ACTION"),this.emit("actionStart",{action:o}),this.emit("log",{text:e.name+" 使用 "+a.name,tone:e.id})}resolveTargetIds(e,t){const n=this.state;return e==="enemyAll"?[n.bossId]:e==="allyAll"?n.partyOrder.filter(s=>n.actors[s].alive):e==="field"?[n.currentActorId]:e==="self"?[n.currentActorId]:t?[t]:[n.bossId]}resolveElement(e,t,n,s){if(e.element==="weapon")return t.weaponElement;if(e.element==="dynamic"){const a=s.elementsOverride;return a&&a[n]?a[n]:t.weaponElement}return e.element}scheduleSkillEvents(e,t,n){const s=this.state,a=e.startedAt,r=Math.min(t.hitTimes.length,t.hitWeights.length),o=Math.max(1,Math.min(n.hitCount===void 0?r:n.hitCount,t.hitTimes.length)),l=s.actors[e.actorId],c=t.element==="dynamic"?Math.min(t.promptTimes.length,o):t.promptTimes.length;for(let h=0;h<o;h++){const u=e.weightsOverride?e.weightsOverride[h]===void 0?1:e.weightsOverride[h]:t.hitWeights[Math.min(h,t.hitWeights.length-1)],d=t.promptTimes.length===t.hitTimes.length||h<c?h:-1;e.events.push({id:this.nextId("ev"),at:a+t.hitTimes[h]*1e3,type:"hit",index:h,resolved:!1,weight:u,element:this.resolveElement(t,l,h,e),promptFor:d})}for(let h=0;h<c;h++)e.events.push({id:this.nextId("ev"),at:a+t.promptTimes[h]*1e3,type:"prompt",index:h,resolved:!1});this.refreshActionEnd(e)}refreshActionEnd(e){let t=e.startedAt;for(const a of e.events)a.type!=="end"&&(a.cancelled||(t=Math.max(t,this.eventDueTime(a))));const n=t+ir;e.endsAt=n;const s=e.events.find(a=>a.type==="end");s?s.at=n:e.events.push({id:this.nextId("ev"),at:n,type:"end",index:0,resolved:!1})}resolveEvent(e,t){switch(t.type){case"prompt":t.resolved=!0,this.applyPromptGrade(e,t,"miss",this.cfg.skillGood+1);break;case"hit":t.resolved=!0,this.resolveHitEvent(e,t);break;case"defenseHit":t.resolved=!0,t.defensible?this.applyBlockGrade(e,t,"miss",this.cfg.blockOuter+1):this.resolveBossSelfEvent(e,t);break;case"counterHit":t.resolved=!0,this.resolveCounterHit(e,t);break;case"end":t.resolved=!0,this.finishAction(e);break;default:t.resolved=!0}}lastPromptGrade(e){return e.promptResults.length===0?null:e.promptResults[e.promptResults.length-1]}resolveHitEvent(e,t){const n=this.state,s=n.actors[e.actorId];if(e.kind==="item"){this.applyItemEffect(e);return}const a=ii[e.skillId],r=Ks[a.id],o=this.runtimeFor(e);let l=0,c=!1;if(a.power>0){const h=e.targetIds.map(g=>n.actors[g]).filter(g=>g&&g.alive),u=t.promptFor,d=u!==void 0&&u>=0?e.promptResults[u]===void 0?"good":e.promptResults[u]:this.lastPromptGrade(e),p=ym(d);for(const g of h){const x=this.dealDamage({attacker:s,target:g,power:a.power,hitWeight:t.weight===void 0?1:t.weight,element:t.element||this.resolveElement(a,s,t.index,e),qteMul:p,powerMul:e.powerMul,critMultiplier:a.id==="sword_dance"?2:1.5,eventId:t.id,index:t.index,extraMul:1,allowShield:!0,canCrit:!0});l+=x.damage,c=c||x.absorbed}if(l>0&&a.breakValue>0){const g=a.breakValue/Math.max(1,e.events.filter(x=>x.type==="hit").length);this.addBreak(g)}}if(r&&r.onHit&&r.onHit(o,t.index,l,c),e.kind==="attack"&&l>0){const h=e.flags.apGained||0;h<3&&(e.flags.apGained=h+1,this.addAp(s.id,1,"基础攻击命中"))}this.checkOutcomes()}applyItemEffect(e){const n=this.state.actors[e.targetIds[0]];n&&(e.itemId==="heal"?this.healActor(n.id,Math.floor(n.maxHp*.45),e.actorId):e.itemId==="energy"?this.addAp(n.id,7,"强力精力亮色"):e.itemId==="revive"&&this.reviveActor(n.id,.5),this.checkOutcomes())}resolveBossSelfEvent(e,t){const n=this.state.actors[this.state.bossId];e.moveId==="blade_charge"&&(this.addShield(n.id,3),this.applyStatus(n.id,"strong",1,2,n.id),this.emit("log",{text:"四手剑客蓄势 —— 获得 3 层护盾与强力",tone:"boss"}))}dealDamage(e){const t=this.state,{attacker:n,target:s}=e;if(!s.alive)return{damage:0,absorbed:!1};const a=e.blockGrade,r=a?Pm(a):1;if(r===0)return this.emit("hit",{eventId:e.eventId,sourceId:n.id,targetId:s.id,damage:0,element:e.element,crit:!1,weakness:!1,resist:!1,absorbed:!1,shielded:!1,grade:a,heal:!1,overkill:!1,index:e.index}),{damage:0,absorbed:!1};if(e.allowShield&&s.shield>0)return this.addShield(s.id,-1),this.emit("hit",{eventId:e.eventId,sourceId:n.id,targetId:s.id,damage:0,element:e.element,crit:!1,weakness:!1,resist:!1,absorbed:!0,shielded:!0,grade:a,heal:!1,overkill:!1,index:e.index}),{damage:0,absorbed:!0};const o=s.statuses.find(d=>d.id==="mark"),l=e.canCrit===!1?!1:this.rng.chance(Tm(n,s)),c=this.rng.range(.96,1.04),h=Em({attacker:n,target:s,power:e.power,hitWeight:e.hitWeight,element:e.element,qteMul:e.qteMul,powerMul:e.powerMul,crit:l,critMultiplier:e.critMultiplier,markConsumed:!!o,variance:c,defenseModifier:1,extraMul:e.extraMul*r});let u=h.damage;if(h.absorb){const d=Math.abs(u);return this.healActor(s.id,d,n.id),{damage:0,absorbed:!1}}return o&&u>0&&this.removeStatus(s.id,"mark"),s.hp=Math.max(0,s.hp-u),n.kind==="player"?(t.stats.totalDamage+=u,t.stats.maxHit=Math.max(t.stats.maxHit,u)):t.stats.damageTaken+=u,this.emit("hit",{eventId:e.eventId,sourceId:n.id,targetId:s.id,damage:u,element:e.element,crit:l,weakness:h.weakness,resist:h.resist,absorbed:!1,shielded:!1,grade:a,heal:!1,overkill:s.hp<=0,index:e.index}),s.hp<=0&&s.alive&&this.killActor(s),{damage:u,absorbed:!1}}killActor(e){e.alive=!1,e.hp=0,e.stance="none",this.state.extraEntries=this.state.extraEntries.filter(t=>t.actorId!==e.id),this.emit("death",{actorId:e.id}),this.emit("log",{text:e.name+(e.kind==="boss"?" 崩解！":" 倒下了"),tone:"death"}),this.checkOutcomes()}checkOutcomes(){const e=this.state;if(e.outcome!=="none")return;const t=e.actors[e.bossId];if(!t.alive||t.hp<=0){e.pendingVictoryAt===null&&(e.pendingVictoryAt=e.now+Cl,e.pendingPhase=null,this.emit("log",{text:"四手剑客的四臂同时垂落 ——",tone:"victory"}));return}!e.partyOrder.some(s=>e.actors[s].alive)&&e.pendingDefeatAt===null&&(e.pendingDefeatAt=e.now+Cl)}finishVictory(){const e=this.state;e.outcome==="none"&&(e.outcome="victory",e.action&&(e.action.cancelled=!0),e.action=null,e.counterWindow=null,e.activeDefense=null,e.activePrompt=null,e.stats.elapsedMs=e.now-e.stats.startedAt,this.setFsm("VICTORY"),this.emit("victory",{stats:{...e.stats}}))}finishDefeat(){const e=this.state;e.outcome==="none"&&(e.outcome="defeat",e.action&&(e.action.cancelled=!0),e.action=null,e.counterWindow=null,e.stats.elapsedMs=e.now-e.stats.startedAt,this.setFsm("DEFEAT"),this.emit("defeat",{stats:{...e.stats}}))}addAp(e,t,n){const s=this.state.actors[e];if(!s)return;const a=s.ap;s.ap=Math.max(0,Math.min(s.maxAp,s.ap+t)),s.ap!==a&&this.emit("apChange",{actorId:e,delta:s.ap-a,reason:n,ap:s.ap})}addShield(e,t){const n=this.state.actors[e];if(!n)return;const s=n.shield;n.shield=Math.max(0,Math.min(n.maxShield,n.shield+t)),n.shield!==s&&this.emit("shieldChange",{actorId:e,shield:n.shield,delta:n.shield-s})}healActor(e,t,n){const s=this.state.actors[e];if(!s||!s.alive||t<=0)return;if(Wt(s,"inverted")){s.hp=Math.max(0,s.hp-t),this.state.stats.damageTaken+=t,this.emit("heal",{targetId:e,amount:-t,sourceId:n,inverted:!0}),this.emit("hit",{eventId:this.nextId("inv"),sourceId:n,targetId:e,damage:t,element:"physical",crit:!1,weakness:!1,resist:!1,absorbed:!1,shielded:!1,heal:!1,overkill:s.hp<=0,index:0}),s.hp<=0&&this.killActor(s);return}const a=s.hp;s.hp=Math.min(s.maxHp,s.hp+t);const r=s.hp-a;this.state.stats.healing+=r,this.emit("heal",{targetId:e,amount:r,sourceId:n,inverted:!1})}applyStatus(e,t,n,s,a){const r=this.state,o=r.actors[e];if(!o||!o.alive)return;if(t==="burn"&&Wt(r.actors[r.bossId],"noFireInfuse")&&a===r.bossId){this.emit("log",{text:"金剑核心已破损 —— 着火附加失效",tone:"aim"});return}let l=s;t==="inverted"&&r.invertedReduction>0&&(l=Math.max(1,l-r.invertedReduction),r.invertedReduction=0,this.emit("log",{text:"紫剑核心破损 —— 倒逆持续时间 -1",tone:"aim"}));const c=ds[t],h=o.statuses.find(u=>u.id===t);if(h){c.stacking==="stacks"&&(h.stacks=Math.min(c.maxStacks,h.stacks+n)),h.turns=Math.max(h.turns,l),h.appliedTurn=r.stats.turns,a&&(h.applierId=a),this.emit("statusChange",{targetId:e,statusId:t,stacks:h.stacks,turns:h.turns,removed:!1});return}o.statuses.push({id:t,stacks:Math.min(c.maxStacks,n),turns:l,applierId:a||r.currentActorId||e,appliedTurn:r.stats.turns}),this.emit("statusChange",{targetId:e,statusId:t,stacks:n,turns:l,removed:!1}),t==="swift"&&this.recomputeNextAct(o),t==="slow"&&this.recomputeNextAct(o)}recomputeNextAct(e){const t=e.nextActAt-this.state.queueNow;if(t<=0)return;const n=Wt(e,"swift")?1/1.2:Wt(e,"slow")?1/.8:1;e.nextActAt=this.state.queueNow+t*n,this.emit("queueChange",{entries:this.previewQueue(8)})}removeStatus(e,t){const n=this.state.actors[e];if(!n)return!1;const s=n.statuses.findIndex(a=>a.id===t);return s<0?!1:(n.statuses.splice(s,1),this.emit("statusChange",{targetId:e,statusId:t,stacks:0,turns:0,removed:!0}),!0)}addBreak(e){const t=this.state,n=t.actors[t.bossId];if(n.alive&&(n.breakGauge=Math.max(0,Math.min(n.breakMax,n.breakGauge+e)),this.emit("breakChange",{value:n.breakGauge,broken:n.broken}),!n.broken&&n.breakGauge>=n.breakMax)){n.broken=!0,n.brokenSkipPending=!0,this.emit("breakChange",{value:n.breakGauge,broken:!0}),this.emit("log",{text:"四手剑客破防！受到伤害 x1.25 并失去下一次行动",tone:"break"});const s=t.action;if(s&&s.kind==="boss"&&!s.events.some(r=>r.type==="defenseHit"&&r.resolved)){for(const r of s.events)r.type==="defenseHit"&&(r.cancelled=!0);this.emit("log",{text:"Boss 的招式被打断",tone:"break"}),this.refreshActionEnd(s)}}}addForetell(e,t){const s=this.state.actors.sciel;if(!s)return;const a=s.phaseTag==="twilight"?20:10,r=s.phaseTag==="twilight"?2:1,o=s.foretell[e]||0;s.foretell[e]=Math.min(a,o+t*r),this.emit("log",{text:"先见 "+s.foretell[e]+" 层",tone:"sciel"})}consumeForetell(e,t){const n=this.state.actors.sciel;if(!n)return 0;const s=n.foretell[e]||0,a=Math.min(s,t);return n.foretell[e]=s-a,a}addStain(e){const t=this.state.actors.lune;t&&(t.stains.length>=t.maxStains&&t.stains.shift(),t.stains.push(e),this.emit("log",{text:"生成异色："+e,tone:"lune"}))}consumeStain(e){const t=this.state.actors.lune;if(!t)return!1;const n=t.stains.indexOf(e);return n<0?!1:(t.stains.splice(n,1),this.emit("log",{text:"消费异色："+e,tone:"lune"}),!0)}setStance(e){const t=this.state.actors.maelle;t&&(t.stance=e,this.emit("statusChange",{targetId:"maelle",statusId:"defenseUp",stacks:0,turns:0,removed:!0}),this.emit("log",{text:"玛埃尔姿态："+e,tone:"maelle"}))}applyPhaseTagAlternation(e,t){if(e.id!=="sciel"||t.length===0)return;const n=t[0];if(e.phaseTag==="twilight")return;e.lastTagUsed!==null&&e.lastTagUsed!==n?(e.alternations+=1,e.alternations>=2&&(e.phaseTag="twilight",e.twilightTurns=2,e.alternations=0,this.emit("log",{text:"熙艾尔进入薄暮 —— 伤害 +75%，先见层数与上限翻倍",tone:"sciel"}))):(e.alternations=0,e.phaseTag=n),e.lastTagUsed=n}insertAtQueueHead(e){const t=this.state,n=t.actors[e];if(!n||!n.alive||n.fateUsedInChain)return!1;n.fateUsedInChain=!0;const s=this.queueEntries(),a=s.length?s[0].at:t.queueNow;return n.nextActAt=Math.min(n.nextActAt,a)-.001,this.emit("queueChange",{entries:this.previewQueue(8)}),!0}grantExtraTurn(e){const t=this.state,n=t.actors[e];if(!n||!n.alive||n.extraTurnUsedInRound)return!1;n.extraTurnUsedInRound=!0;const s=this.queueEntries(),a=s.length?s[0].at:t.queueNow;return t.extraEntries.push({actorId:e,at:a-.002,seq:n.seq,kind:"extra",label:"额外回合"}),this.emit("queueChange",{entries:this.previewQueue(8)}),!0}reviveActor(e,t){const n=this.state,s=n.actors[e];return!s||s.alive?!1:(s.alive=!0,s.hp=Math.max(1,Math.floor(s.maxHp*t)),s.statuses=[],s.nextActAt=n.queueNow+Zs(s,1),this.emit("revive",{actorId:e}),this.emit("log",{text:s.name+" 归队",tone:"buff"}),this.emit("queueChange",{entries:this.previewQueue(8)}),!0)}spreadBuffs(e){const t=this.state,n=t.actors[e];if(!n)return;const s=n.statuses.filter(a=>ds[a.id].kind==="buff");for(const a of s)for(const r of t.partyOrder)r!==e&&this.applyStatus(r,a.id,a.stacks,Math.max(1,a.turns-1),r);s.length>0&&this.emit("log",{text:"增益扩散至全队",tone:"buff"})}runtimeFor(e){const t=this.state,n=this,s=t.actors[e.actorId],a=e.targetIds.map(r=>t.actors[r]).filter(Boolean);return{state:t,actor:s,targets:a,primaryTarget:a[0]||null,action:e,rng:this.rng,difficulty:this.cfg,log:(r,o)=>n.emit("log",{text:r,tone:o}),addAp:(r,o,l)=>n.addAp(r,o,l),applyStatus:(r,o,l,c,h)=>n.applyStatus(r,o,l,c,h||s.id),removeStatus:(r,o)=>n.removeStatus(r,o),hasStatus:(r,o)=>t.actors[r]?Wt(t.actors[r],o):!1,statusStacks:(r,o)=>t.actors[r]?mm(t.actors[r],o):0,addShield:(r,o)=>n.addShield(r,o),healActor:(r,o,l)=>n.healActor(r,o,l),addBreak:r=>n.addBreak(r),addForetell:(r,o)=>n.addForetell(r,o),foretellOn:r=>t.actors.sciel&&t.actors.sciel.foretell[r]||0,consumeForetell:(r,o)=>n.consumeForetell(r,o),addStain:r=>n.addStain(r),consumeStain:r=>n.consumeStain(r),setStance:r=>n.setStance(r),insertAtQueueHead:r=>n.insertAtQueueHead(r),grantExtraTurn:r=>n.grantExtraTurn(r),reviveActor:(r,o)=>n.reviveActor(r,o),extendHit:(r,o,l)=>n.extendHit(e,r,o,l),cancelHit:r=>n.cancelHit(e,r),spreadBuffs:r=>n.spreadBuffs(r),allies:()=>t.partyOrder.map(r=>t.actors[r]).filter(r=>r.alive),enemies:()=>[t.actors[t.bossId]].filter(r=>r.alive)}}extendHit(e,t,n,s){const a=e.events.filter(h=>h.type==="hit"&&!h.cancelled),r=a.length?a[a.length-1]:null,o=(r?r.at:this.state.now)+t*1e3,l=this.state.actors[e.actorId],c=e.skillId?ii[e.skillId]:$r;e.events.push({id:this.nextId("ev"),at:o,type:"hit",index:a.length,resolved:!1,weight:n,element:s||this.resolveElement(c,l,a.length,e)}),this.refreshActionEnd(e)}cancelHit(e,t){const s=e.events.filter(a=>a.type==="hit").find(a=>a.index===t);s&&!s.resolved&&(s.cancelled=!0,this.refreshActionEnd(e))}pressSpace(){const e=this.state;if(this.disposed||e.paused||e.outcome!=="none")return;if(this.pressSeq+=1,e.lastPressId=this.pressSeq,this.recordInput("press"),e.now<e.spamCooldownUntil){this.emit("spam",{until:e.spamCooldownUntil});return}const t=e.action;if(!t||t.cancelled)return;const n=t.events.filter(a=>a.type==="defenseHit"&&a.defensible&&!a.resolved&&!a.cancelled);if(n.length>0){let a=n[0];for(const c of n)Math.abs(c.at-e.now)<Math.abs(a.at-e.now)&&(a=c);const r=e.now-a.at;if(r>this.cfg.blockOuter){e.spamCooldownUntil=e.now+nr,this.emit("spam",{until:e.spamCooldownUntil});return}if(r<-this.cfg.blockOuter){if(r>=-(this.cfg.blockOuter+Rl)){a.bufferedPressAt=e.now,this.emit("log",{text:"早按已缓冲",tone:"info"});return}e.spamCooldownUntil=e.now+nr,this.emit("spam",{until:e.spamCooldownUntil});return}const o=Am(r,this.cfg),l=o==="perfect"?"perfect":o==="block"?"block":"miss";a.resolved=!0,this.applyBlockGrade(t,a,l,r),this.pump();return}if(e.counterWindow&&!e.counterResolved&&e.counterArmed){if(e.now>=e.counterWindow.opensAt&&e.now<=e.counterWindow.closesAt){const a=e.now-e.counterWindow.idealAt,r=Math.abs(a)<=this.cfg.skillPerfect;e.counterResolved=!0,e.counterArmed=!1,this.emit("counterJudged",{grade:r?"perfect":"block",deltaMs:a}),this.performCounter(r);return}if(e.now<e.counterWindow.opensAt){e.spamCooldownUntil=e.now+nr,this.emit("spam",{until:e.spamCooldownUntil});return}}const s=t.events.filter(a=>a.type==="prompt"&&!a.resolved&&!a.cancelled);if(s.length>0){let a=s[0];for(const o of s)Math.abs(o.at-e.now)<Math.abs(a.at-e.now)&&(a=o);const r=e.now-a.at;if(Math.abs(r)<=this.cfg.skillGood){a.resolved=!0;const o=wm(r,this.cfg);this.applyPromptGrade(t,a,o,r),this.pump();return}}}applyPromptGrade(e,t,n,s){const a=this.state;t.grade=n,e.promptResults[t.index]=n,a.lastPromptDelta=s,n==="perfect"?a.stats.promptPerfect+=1:n==="good"?a.stats.promptGood+=1:a.stats.promptMiss+=1,this.emit("promptJudged",{eventId:t.id,grade:n,deltaMs:s,index:t.index});const r=e.skillId?ii[e.skillId]:null,o=r?Ks[r.id]:null;o&&o.onPrompt&&o.onPrompt(this.runtimeFor(e),t.index,n),this.refreshActionEnd(e)}applyBlockGrade(e,t,n,s){const a=this.state;n==="miss"&&t.bufferedPressAt!==void 0&&(n="block",s=t.bufferedPressAt-t.at),t.grade=n,a.lastDefenseDelta=s,e.blockResults[t.index]=n,a.chainResolvedCount+=1;const r=(t.targetIds||[t.targetId||""]).map(h=>a.actors[h]).filter(h=>h&&h.alive);if(n==="perfect"){a.chainPerfectCount+=1,a.blockChain+=1,a.stats.perfectBlocks+=1,a.stats.bestBlockChain=Math.max(a.stats.bestBlockChain,a.blockChain);for(const h of r)this.rewardBlockAp(h,!0)}else if(n==="block"){a.stats.normalBlocks+=1,a.blockChain=0,e.perfectChain=!1;for(const h of r)this.rewardBlockAp(h,!1)}else a.stats.missedBlocks+=1,a.blockChain=0,e.perfectChain=!1;this.emit("defenseJudged",{eventId:t.id,grade:n,deltaMs:s,index:t.index,targetId:t.targetId||""});const o=e.moveId?sa[e.moveId]:null,l=a.actors[a.bossId];if(o&&o.power>0&&n!=="perfect")for(const h of r)this.dealDamage({attacker:l,target:h,power:o.power,hitWeight:t.weight===void 0?1:t.weight,element:t.element||"physical",qteMul:1,powerMul:1,critMultiplier:1.5,eventId:t.id,index:t.index,extraMul:this.cfg.bossDamageMul,allowShield:!0,canCrit:!0,blockGrade:n});o&&this.applyMoveSideEffects(o,t,n,r,e),this.checkOutcomes(),e.events.filter(h=>h.type==="defenseHit"&&h.defensible&&!h.resolved&&!h.cancelled).length===0&&this.maybeOpenCounter(e)}rewardBlockAp(e,t){const n=this.state;if(t){const s=n.apFromBlocksThisChain[e.id]||0;s<3&&(n.apFromBlocksThisChain[e.id]=s+1,this.addAp(e.id,1,"完美格挡"))}if(e.id==="maelle"&&e.stance==="defensive"){const s=n.defensiveApThisChain[e.id]||0;s<2&&(n.defensiveApThisChain[e.id]=s+1,this.addAp(e.id,1,"守势格挡"))}}applyMoveSideEffects(e,t,n,s,a){const r=this.state,o=r.actors[r.bossId],l=t.index===r.chainDefensibleCount-1;switch(e.id){case"four_arm_combo":if(l&&n!=="perfect")for(const c of s)this.applyStatus(c.id,"vulnerable",1,1,o.id);break;case"swift_thrust":n==="miss"&&(o.breakGauge=Math.max(0,o.breakGauge-10),this.emit("breakChange",{value:o.breakGauge,broken:o.broken}),this.emit("log",{text:"突刺未被完美格挡 —— Boss 恢复 10 破防值",tone:"boss"}));break;case"sweeping_slash":if(n==="miss"&&t.index===0)for(const c of s)this.applyStatus(c.id,"burn",1,99,o.id);if(n==="miss"&&t.index===1&&this.rng.chance(.35))for(const c of s)this.applyStatus(c.id,"slow",1,2,o.id);break;case"inverted_array":if(n==="block")for(const c of s)this.applyStatus(c.id,"inverted",1,2,o.id);else if(n==="miss")for(const c of s)this.applyStatus(c.id,"inverted",1,this.cfg.invertedTurns,o.id);break;case"twin_execution":if(t.index===1&&n!=="perfect")for(const c of s)c.alive&&c.hp/c.maxHp<.3&&this.applyStatus(c.id,"burn",2,99,o.id);break;case"blood_storm":n!=="perfect"&&this.speedUpRemaining(a,.08);break}}speedUpRemaining(e,t){const n=this.state,s=e.events.filter(l=>l.type==="defenseHit"&&!l.resolved&&!l.cancelled).sort((l,c)=>l.at-c.at);if(s.length===0)return;const r=s[0].at-n.now;if(r<=0)return;const o=r*t;for(const l of s)l.at-=o;this.refreshActionEnd(e),this.emit("log",{text:"剑势加速 —— 下一段提前 "+Math.round(o)+"ms",tone:"warn"})}maybeOpenCounter(e){const t=this.state;if(e.kind!=="boss"||e.flags.counterOpened||t.chainDefensibleCount===0||t.partyOrder.filter(r=>t.actors[r].alive).length===0||t.chainPerfectCount!==t.chainDefensibleCount)return;const s=Math.max(...e.events.filter(r=>r.type==="defenseHit").map(r=>r.at)),a=Math.max(t.now,s)+Rm;e.flags.counterOpened=!0,t.counterWindow={opensAt:a,closesAt:a+Cm,idealAt:a+200},t.counterArmed=!0,t.counterResolved=!1,t.counterBonusMul=e.moveId==="blood_storm"?1.5:1,this.setFsm("COUNTER_WINDOW"),this.emit("counterOpen",{opensAt:a,closesAt:t.counterWindow.closesAt}),this.emit("log",{text:"完美格挡！按空格发动队伍反击",tone:"perfect"})}performCounter(e){const t=this.state,n=t.partyOrder.filter(r=>t.actors[r].alive);t.stats.fullCounters+=1;const s=this.makeAction("counter",n[0],[t.bossId]),a=(e?1.25:1)*t.counterBonusMul;s.powerMul=a,n.forEach((r,o)=>{s.events.push({id:this.nextId("ev"),at:t.now+120+o*Pl,type:"counterHit",index:o,resolved:!1,weight:1,targetId:t.bossId,meta:{actorId:r}})}),s.endsAt=t.now+120+n.length*Pl+ir,s.events.push({id:this.nextId("ev"),at:s.endsAt,type:"end",index:0,resolved:!1}),this.pendingBossTurnEnd=!0,t.action=s,this.addBreak(30),this.emit("counterPerformed",{actorIds:n,perfect:e}),this.emit("log",{text:e?"完美反击！伤害 x1.25":"队伍反击",tone:"perfect"})}resolveCounterHit(e,t){const n=this.state,s=t.meta&&t.meta.actorId||e.actorId,a=n.actors[s],r=n.actors[n.bossId];!a||!a.alive||!r.alive||(this.dealDamage({attacker:a,target:r,power:Fm,hitWeight:1,element:a.weaponElement,qteMul:1,powerMul:e.powerMul,critMultiplier:1.5,eventId:t.id,index:t.index,extraMul:1,allowShield:!0,canCrit:!0}),this.checkOutcomes())}startBossAction(){const e=this.state,t=e.actors[e.bossId];for(const u of e.partyOrder)e.actors[u].fateUsedInChain=!1,e.actors[u].extraTurnUsedInRound=!1;e.roundCounter+=1;const s=Im(e,this.rng).move;e.phase===1&&e.tutorialIndex<jr.length&&!e.forcedBossMove&&(e.tutorialIndex+=1),e.forcedBossMove=null,s.id==="blood_storm"&&(e.lastBloodStormAt=e.bossActionCount),e.bossActionCount+=1,e.bossHistory.push(s.id);const a=this.rng.next(),r=fm(s,this.cfg,a);this.currentMoveTimeline=r;const o=Dm(e,s,this.rng);s.target==="single"&&o[0]&&(e.lastSingleTargetId=o[0].id);const l=this.makeAction("boss",t.id,o.map(u=>u.id));l.moveId=s.id;const c=e.now,h=s.power>0;r.impactTimes.forEach((u,d)=>{l.events.push({id:this.nextId("ev"),at:c+u*1e3,type:"defenseHit",index:d,resolved:!1,weight:r.hitWeights[Math.min(d,r.hitWeights.length-1)],element:r.elements[Math.min(d,r.elements.length-1)],defensible:h,jump:r.jumpHits.includes(d),targetId:o[0]?o[0].id:void 0,targetIds:o.map(p=>p.id)})}),l.defensibleTotal=h?r.impactTimes.length:0,e.chainDefensibleCount=l.defensibleTotal,e.chainPerfectCount=0,e.chainResolvedCount=0,e.apFromBlocksThisChain={},e.defensiveApThisChain={},e.counterWindow=null,e.counterArmed=!1,e.counterResolved=!1,e.bossMoveName=s.name,e.bossMoveVariant=r.variantName,e.bossMoveHint=s.defenseHint,this.refreshActionEnd(l),e.action=l,this.setFsm("BOSS_TELEGRAPH"),this.emit("bossTelegraph",{moveId:s.id,name:s.name,warning:s.warning,hint:s.defenseHint+(r.variantName?"（"+r.variantName+"）":""),targetIds:o.map(u=>u.id),total:l.defensibleTotal}),this.emit("log",{text:"四手剑客："+s.name+(r.variantName?"（"+r.variantName+"）":""),tone:"boss"}),r.feintAt!==null&&this.emit("log",{text:"注意：剑光中夹着假动作",tone:"warn"})}finishBossAction(){const e=this.state.action;if(!e){this.endTurn(1);return}const t=e.moveId?sa[e.moveId]:null;this.endTurn(t?t.actionDelay:1)}finishAction(e){const t=this.state;if(e.cancelled)return;if(e.kind==="counter"){this.pendingBossTurnEnd=!1,t.counterWindow=null,this.emit("actionEnd",{actionId:e.id}),this.endTurn(1);return}if(e.kind==="boss"){if(t.counterArmed&&!t.counterResolved)return;this.emit("actionEnd",{actionId:e.id});const a=e.moveId?sa[e.moveId]:null;this.endTurn(a?a.actionDelay:1);return}const n=e.skillId?ii[e.skillId]:null;if(n){const a=Ks[n.id];a&&a.onEnd&&a.onEnd(this.runtimeFor(e))}this.emit("actionEnd",{actionId:e.id}),this.checkOutcomes();const s=n?n.actionDelay:e.kind==="item"?.95:1;this.endTurn(s)}endTurn(e){const t=this.state,n=t.currentActorId;if(!n)return;const s=t.actors[n];this.setFsm("RESOLVE"),this.tickTurnEnd(s),!this.currentEntryIsExtra&&s.alive&&this.advanceActorClock(s,e),t.action=null,t.activeDefense=null,t.activePrompt=null,t.counterWindow=null,t.counterArmed=!1,this.checkOutcomes(),this.evaluatePhase(),this.emit("queueChange",{entries:this.previewQueue(8)}),this.setFsm("ADVANCE_QUEUE"),t.outcome==="none"&&t.pendingVictoryAt===null&&t.pendingDefeatAt===null&&this.beginNextTurn()}tickTurnEnd(e){const t=this.state,n=t.stats.turns;if(e.alive){const s=e.statuses.find(a=>a.id==="burn");if(s&&s.stacks>0){const a=Math.floor(e.maxHp*.012*s.stacks);this.emit("log",{text:e.name+" 燃烧 "+s.stacks+" 层 —— "+a+" 点火焰伤害",tone:"fire"});const r=e.hp;e.hp=Math.max(0,e.hp-a),e.kind==="player"?t.stats.damageTaken+=a:(t.stats.totalDamage+=a,t.stats.maxHit=Math.max(t.stats.maxHit,a)),this.emit("hit",{eventId:this.nextId("burn"),sourceId:"burn",targetId:e.id,damage:a,element:"fire",crit:!1,weakness:!1,resist:!1,absorbed:!1,shielded:!1,heal:!1,overkill:e.hp<=0,index:0}),s.stacks-=1,s.stacks<=0?this.removeStatus(e.id,"burn"):this.emit("statusChange",{targetId:e.id,statusId:"burn",stacks:s.stacks,turns:s.turns,removed:!1}),e.hp<=0&&r>0&&this.killActor(e)}}for(const s of Object.keys(t.actors)){const a=t.actors[s],r=[];for(const o of a.statuses){if(o.appliedTurn===n){r.push(o);continue}const l=ds[o.id],c=l.tickOn==="self"&&a.id===e.id,h=l.tickOn==="applier"&&o.applierId===e.id;if(o.id==="burn"||o.id==="typhoon"){r.push(o);continue}if(c||h){if(o.turns-=1,o.turns<=0){this.emit("statusChange",{targetId:a.id,statusId:o.id,stacks:0,turns:0,removed:!0});continue}this.emit("statusChange",{targetId:a.id,statusId:o.id,stacks:o.stacks,turns:o.turns,removed:!1})}r.push(o)}a.statuses=r}if(e.id==="sciel"&&e.phaseTag==="twilight"&&(e.twilightTurns-=1,e.twilightTurns<=0&&(e.phaseTag="sun",this.emit("log",{text:"薄暮结束 —— 熙艾尔回到旭日",tone:"sciel"}))),e.kind==="boss"&&this.cfg.bossExtra!=="none"&&Um(t,this.cfg.bossExtra,this.rng)){const s=Zs(e,1);t.extraEntries.push({actorId:e.id,at:Math.max(e.nextActAt,t.queueNow)+s*.45,seq:e.seq+1,kind:"extra",label:"额外行动"}),this.emit("log",{text:"四手剑客将插入一次额外行动",tone:"warn"})}}evaluatePhase(){const e=this.state;if(e.outcome!=="none"||e.pendingVictoryAt!==null)return;const t=e.actors[e.bossId];if(!t.alive)return;const n=t.hp/t.maxHp;let s=1;n<=.32?s=3:n<=.68&&(s=2),s>e.phase&&e.pendingPhase===null&&(e.pendingPhase=s)}startPhaseTransition(e){const t=this.state;t.pendingPhase=null,t.phase=e;const n=t.actors[t.bossId];e===2?(n.speed=n.speed*1.12,this.removeStatus(n.id,"slow"),this.emit("log",{text:"阶段二 —— 金紫双剑亮起，速度提升 12%",tone:"phase"})):e===3&&(t.forcedBossMove="blood_storm",this.emit("log",{text:"阶段三 —— 四臂全开，下一击是腥风血雨！",tone:"phase"})),t.phaseTransitionEndsAt=t.now+Nm,this.setFsm("PHASE_TRANSITION"),this.emit("phaseChange",{phase:e})}aimShot(e){const t=this.state;if(t.fsm!=="AIM")return;const n=t.actors[t.currentActorId];if(n.ap<1){this.exitAim();return}this.recordInput("aimShot",{weakPointId:e}),this.addAp(n.id,-1,"瞄准射击"),t.aimShotsFired+=1;const s=t.actors[t.bossId],a=e?s.weakPoints.find(l=>l.id===e&&!l.broken):null,r=this.nextId("aim"),o=this.dealDamage({attacker:n,target:s,power:Om,hitWeight:1,element:"physical",qteMul:1,powerMul:a?1.5:1,critMultiplier:1.5,eventId:r,index:0,extraMul:1,allowShield:!1,canCrit:!1});a&&(this.addBreak(20),a.durability-=1,a.durability<=0&&(a.broken=!0,t.stats.weakPointsBroken+=1,this.emit("weakPointBroken",{id:a.id,name:a.name}),this.emit("log",{text:a.name+" 被击碎！",tone:"aim"}),a.id==="gold_core"&&this.applyStatus(s.id,"noFireInfuse",1,2,s.id),a.id==="violet_core"&&(t.invertedReduction=1))),this.emit("aimShot",{hit:!0,weakPointId:a?a.id:null,damage:o.damage}),this.checkOutcomes(),n.ap<=0&&this.exitAim()}exitAim(){const e=this.state;if(e.fsm==="AIM"){if(this.recordInput("aimEnd"),e.pending=null,e.aimShotsFired===0){this.setFsm("COMMAND");return}this.endTurn(1)}}exportLog(){return{version:1,difficulty:this.state.difficulty,seed:this.state.seed,inputs:this.inputs.slice(),records:this.records.slice(),result:{outcome:this.state.outcome,stats:{...this.state.stats}}}}getInputs(){return this.inputs.slice()}debugDamageBoss(e){const t=this.state.actors[this.state.bossId];t.hp=Math.max(0,t.hp-e),this.emit("hit",{eventId:this.nextId("dbg"),sourceId:"debug",targetId:t.id,damage:e,element:"physical",crit:!1,weakness:!1,resist:!1,absorbed:!1,shielded:!1,heal:!1,overkill:t.hp<=0,index:0}),t.hp<=0&&this.killActor(t),this.evaluatePhase()}debugSetBossHpRatio(e){const t=this.state.actors[this.state.bossId];t.hp=Math.max(1,Math.floor(t.maxHp*e)),this.evaluatePhase()}debugGiveAp(){for(const e of this.state.partyOrder)this.addAp(e,9,"debug")}debugForceMove(e){this.state.forcedBossMove=e}}function Hm(i){const e=new Tc({difficulty:i.difficulty,seed:i.seed});e.start();for(const n of i.inputs){e.advanceTo(n.t);const s=n.data||{};switch(n.kind){case"command":e.chooseCommand(s.kind);break;case"skill":e.chooseSkill(s.skillId);break;case"item":e.chooseItem(s.itemId);break;case"target":e.chooseTarget(s.targetId);break;case"press":e.pressSpace();break;case"back":e.back();break;case"aimShot":e.aimShot(s.weakPointId||null);break;case"aimEnd":e.exitAim();break}}let t=0;for(;e.state.outcome==="none"&&t++<2e4;)e.advance(100);return e}function Gm(i){const e=JSON.parse(i);if(!e||typeof e.seed!="number"||!Array.isArray(e.inputs))throw new Error("战斗日志格式不正确");return e}const vt={warmBrown:"#4a3524",charcoal:"#15120f",charcoalSoft:"#241d18",boneWhite:"#e6dcc6",boneShadow:"#b3a68a",bloodRed:"#8e1c1c",bloodBright:"#d63a2a",gold:"#e8a828",violet:"#7a48c8",violetDeep:"#3a1f5c"};function Vm(){return typeof document<"u"&&typeof document.createElement=="function"}function vn(i){let e=i>>>0||1;return function(){e=e+1831565813>>>0;let n=e;return n=Math.imul(n^n>>>15,n|1),n^=n+Math.imul(n^n>>>7,n|61),((n^n>>>14)>>>0)/4294967296}}function Qt(i,e){if(!Vm())return null;const t=document.createElement("canvas");t.width=Math.max(1,Math.floor(i)),t.height=Math.max(1,Math.floor(e));const n=t.getContext("2d");return n?{canvas:t,ctx:n}:null}function jt(i,e,t=1){const n=new Zh(i);return n.wrapS=us,n.wrapT=us,n.repeat.set(t,t),n.colorSpace=e?an:Bn,n.anisotropy=4,n.needsUpdate=!0,n}function wc(i,e,t){const n=new Array(e*t);for(let s=0;s<n.length;s++)n[s]=i();return n}function pa(i,e,t,n,s){const a=n*e,r=s*t,o=Math.floor(a),l=Math.floor(r),c=a-o,h=r-l,u=c*c*(3-2*c),d=h*h*(3-2*h),p=(M,w)=>i[(w%t+t)%t*e+(M%e+e)%e],g=p(o,l),x=p(o+1,l),m=p(o,l+1),f=p(o+1,l+1);return(g*(1-u)+x*u)*(1-d)+(m*(1-u)+f*u)*d}function eo(i,e,t,n,s,a,r,o){let l=e,c=t,h=n;const u=6+Math.floor(o()*5),d=s/u;i.lineWidth=Math.max(.6,a),i.beginPath(),i.moveTo(l,c);for(let p=0;p<u;p++)if(h+=(o()-.5)*.55,l+=Math.cos(h)*d,c+=Math.sin(h)*d,i.lineTo(l,c),r>0&&o()<.32){const g=o()<.5?1:-1;eo(i,l,c,h+g*(.5+o()*.7),s*(.35+o()*.3),a*.55,r-1,o),i.lineWidth=Math.max(.6,a),i.beginPath(),i.moveTo(l,c)}i.stroke()}function gs(i,e,t,n,s,a,r){const o=vn(t);i.save(),i.strokeStyle=n,i.lineCap="round",i.lineJoin="round",a>0&&(i.shadowBlur=a,i.shadowColor=r);const l=e*.5,c=e*.5,h=9;for(let u=0;u<h;u++){const d=u/h*Math.PI*2+o()*.4,p=e*(.03+o()*.06);eo(i,l+Math.cos(d)*p,c+Math.sin(d)*p,d,e*(.24+o()*.22),4.2*s,3,o)}for(let u=0;u<14;u++){const d=o()*Math.PI*2,p=e*(.2+o()*.28);eo(i,l+Math.cos(d)*p,c+Math.sin(d)*p,o()*Math.PI*2,e*(.08+o()*.12),2.2*s,2,o)}i.restore()}function zm(i=1024,e=20331){const t=Qt(i,i);if(!t)return null;const{ctx:n,canvas:s}=t,a=vn(e),r=n.createRadialGradient(i*.5,i*.5,i*.05,i*.5,i*.5,i*.5);r.addColorStop(0,vt.charcoalSoft),r.addColorStop(.55,"#33251a"),r.addColorStop(1,vt.warmBrown),n.fillStyle=r,n.fillRect(0,0,i,i);const o=48,l=wc(a,o,o),c=i/128;for(let d=0;d<128;d++)for(let p=0;p<128;p++){const g=pa(l,o,o,p/128,d/128),x=pa(l,o,o,p*3.1/128,d*3.1/128),m=g*.65+x*.35;n.fillStyle="rgba("+Math.floor(20+m*46)+","+Math.floor(16+m*34)+","+Math.floor(12+m*24)+",0.55)",n.fillRect(p*c,d*c,c+1,c+1)}const h=[vt.gold,vt.bloodRed,vt.violet,vt.boneShadow,vt.violetDeep,vt.bloodBright];for(let d=0;d<42;d++){const p=a()*i,g=a()*i,x=i*(.015+a()*.07),m=h[Math.floor(a()*h.length)],f=n.createRadialGradient(p,g,0,p,g,x);f.addColorStop(0,m),f.addColorStop(1,"rgba(0,0,0,0)"),n.globalAlpha=.06+a()*.14,n.fillStyle=f,n.beginPath(),n.ellipse(p,g,x,x*(.4+a()*.8),a()*Math.PI,0,Math.PI*2),n.fill(),n.globalAlpha=1}n.globalAlpha=.1;for(let d=0;d<26;d++){const p=a()*i,g=a()*i,x=a()*Math.PI*2,m=i*(.05+a()*.18);n.strokeStyle=a()<.4?vt.boneShadow:vt.charcoal,n.lineWidth=2+a()*12,n.beginPath(),n.moveTo(p,g),n.quadraticCurveTo(p+Math.cos(x)*m*.5+(a()-.5)*40,g+Math.sin(x)*m*.5+(a()-.5)*40,p+Math.cos(x)*m,g+Math.sin(x)*m),n.stroke()}n.globalAlpha=1,gs(n,i,e,"rgba(8,6,5,0.95)",1,6,"rgba(0,0,0,0.9)"),gs(n,i,e,"rgba(150,32,22,0.5)",.32,5,"rgba(190,50,30,0.55)");const u=n.createRadialGradient(i*.5,i*.5,i*.3,i*.5,i*.5,i*.52);return u.addColorStop(0,"rgba(0,0,0,0)"),u.addColorStop(1,"rgba(0,0,0,0.65)"),n.fillStyle=u,n.fillRect(0,0,i,i),jt(s,!0,1)}function Wm(i=512,e=20331){const t=Qt(i,i);if(!t)return null;const{ctx:n,canvas:s}=t;n.fillStyle="#000000",n.fillRect(0,0,i,i),gs(n,i,e,"rgba(214,58,42,0.95)",.5,14,"rgba(255,70,40,0.85)"),gs(n,i,e,"rgba(255,196,120,0.5)",.16,5,"rgba(255,150,60,0.7)");const a=n.createRadialGradient(i*.5,i*.5,0,i*.5,i*.5,i*.28);return a.addColorStop(0,"rgba(120,26,18,0.55)"),a.addColorStop(1,"rgba(0,0,0,0)"),n.fillStyle=a,n.fillRect(0,0,i,i),jt(s,!0,1)}function qm(i=512,e=771){const t=Qt(i,i);if(!t)return null;const{ctx:n,canvas:s}=t,a=vn(e),r=32,o=wc(a,r,r),l=96,c=i/l;for(let h=0;h<l;h++)for(let u=0;u<l;u++){const d=pa(o,r,r,u/l,h/l)*.6+pa(o,r,r,u*4/l,h*4/l)*.4,p=Math.floor(120+d*110);n.fillStyle="rgb("+p+","+p+","+p+")",n.fillRect(u*c,h*c,c+1,c+1)}return gs(n,i,20331,"rgba(40,40,40,0.9)",.6,4,"rgba(0,0,0,0.5)"),jt(s,!1,1)}function Ac(i=512,e=4404,t=vt.boneWhite,n=vt.charcoal){const s=Qt(i,i);if(!s)return null;const{ctx:a,canvas:r}=s,o=vn(e);a.fillStyle=t,a.fillRect(0,0,i,i),a.globalAlpha=.07,a.strokeStyle=n,a.lineWidth=1;for(let c=0;c<i;c+=3)a.beginPath(),a.moveTo(0,c+(o()-.5)*2),a.lineTo(i,c+(o()-.5)*2),a.stroke();a.globalAlpha=1;const l=a.createLinearGradient(0,i*.25,0,i);l.addColorStop(0,"rgba(0,0,0,0)"),l.addColorStop(.45,"rgba(18,16,14,0.75)"),l.addColorStop(1,n),a.fillStyle=l,a.fillRect(0,0,i,i);for(let c=0;c<60;c++){const h=o()*i,u=o()*i,d=i*(.004+o()*.045);a.fillStyle=o()<.14?vt.bloodRed:n,a.globalAlpha=.18+o()*.55,a.beginPath(),a.ellipse(h,u,d,d*(.5+o()),o()*Math.PI,0,Math.PI*2),a.fill()}a.globalAlpha=1,a.strokeStyle=vt.gold,a.globalAlpha=.5,a.lineWidth=i*.012,a.beginPath(),a.moveTo(0,i*.06);for(let c=0;c<=i;c+=i/16)a.lineTo(c,i*.06+Math.sin(c*.05)*i*.008);a.stroke(),a.strokeStyle=vt.violet,a.globalAlpha=.35,a.lineWidth=i*.004,a.beginPath(),a.moveTo(0,i*.42);for(let c=0;c<=i;c+=i/24)a.lineTo(c,i*.42+Math.sin(c*.09)*i*.02);return a.stroke(),a.globalAlpha=1,jt(r,!0,1)}function Xm(i=512,e=9182){const t=Qt(i,i);if(!t)return null;const{ctx:n,canvas:s}=t,a=vn(e);n.fillStyle="#ffffff",n.fillRect(0,0,i,i);for(let r=0;r<220;r++){const o=a()*i,l=i-Math.pow(a(),1.7)*i*.55,c=i*(.01+a()*.06);n.fillStyle="#000000",n.globalAlpha=.5+a()*.5,n.beginPath(),n.ellipse(o,l,c,c*(.6+a()*1.4),a()*Math.PI,0,Math.PI*2),n.fill()}n.globalAlpha=1;for(let r=0;r<16;r++){const o=a()*i,l=a()*i,c=i*(.01+a()*.035),h=n.createRadialGradient(o,l,0,o,l,c);h.addColorStop(0,"#000000"),h.addColorStop(.7,"#000000"),h.addColorStop(1,"rgba(255,255,255,0)"),n.fillStyle=h,n.beginPath(),n.arc(o,l,c,0,Math.PI*2),n.fill()}return jt(s,!1,1)}function Ym(i=512){const e=Qt(i,i);if(!e)return null;const{ctx:t,canvas:n}=e,s=vn(5150);t.fillStyle=vt.boneWhite,t.fillRect(0,0,i,i),t.globalAlpha=.25;for(let a=0;a<40;a++){const r=s()*i,o=s()*i,l=i*(.01+s()*.06);t.fillStyle=s()<.5?vt.boneShadow:"#cfc3a6",t.beginPath(),t.arc(r,o,l,0,Math.PI*2),t.fill()}t.globalAlpha=1,t.fillStyle="#120c18",t.fillRect(0,i*.4,i,i*.085),t.fillStyle="rgba(122,72,200,0.55)",t.fillRect(0,i*.41,i,i*.02),t.strokeStyle=vt.gold,t.lineWidth=i*.006,t.globalAlpha=.8;for(let a=0;a<18;a++){const r=s()*i;t.beginPath(),t.moveTo(r,i*(.05+s()*.3)),t.lineTo(r+(s()-.5)*i*.12,i*(.55+s()*.4)),t.stroke()}return t.globalAlpha=.9,t.fillStyle=vt.bloodRed,t.beginPath(),t.arc(i*.5,i*.2,i*.03,0,Math.PI*2),t.fill(),t.globalAlpha=1,jt(n,!0,1)}function bo(i=256,e=616,t="#5a5348"){const n=Qt(i,i);if(!n)return null;const{ctx:s,canvas:a}=n,r=vn(e);s.fillStyle=t,s.fillRect(0,0,i,i);for(let o=0;o<i;o++){const l=r();s.fillStyle="rgba(255,255,255,"+(l*.07).toFixed(3)+")",s.fillRect(o,0,1,i),s.fillStyle="rgba(0,0,0,"+(r()*.09).toFixed(3)+")",s.fillRect(o,i*r(),1,i*(.1+r()*.5))}for(let o=0;o<30;o++)s.fillStyle="rgba(20,16,12,0.4)",s.beginPath(),s.arc(r()*i,r()*i,i*(.004+r()*.02),0,Math.PI*2),s.fill();return jt(a,!0,1)}function xa(i=128,e=2.2,t="rgba(255,255,255,1)"){const n=Qt(i,i);if(!n)return null;const{ctx:s,canvas:a}=n;s.clearRect(0,0,i,i);const r=s.createRadialGradient(i/2,i/2,0,i/2,i/2,i/2),o=8;for(let l=0;l<=o;l++){const c=l/o,h=Math.pow(1-c,e);r.addColorStop(c,l===0?t:"rgba(255,255,255,"+h.toFixed(3)+")")}return s.fillStyle=r,s.fillRect(0,0,i,i),jt(a,!1,1)}function Rc(i=64,e=3311){const t=Qt(i,i);if(!t)return null;const{ctx:n,canvas:s}=t,a=vn(e);n.clearRect(0,0,i,i),n.fillStyle="#ffffff",n.beginPath();const r=7;for(let l=0;l<=r;l++){const c=l/r*Math.PI*2,h=i*(.2+a()*.24),u=i/2+Math.cos(c)*h,d=i/2+Math.sin(c)*h*.8;l===0?n.moveTo(u,d):n.lineTo(u,d)}n.closePath(),n.fill();const o=n.createRadialGradient(i/2,i/2,i*.2,i/2,i/2,i*.5);return o.addColorStop(0,"rgba(255,255,255,0)"),o.addColorStop(1,"rgba(0,0,0,0.85)"),n.globalCompositeOperation="destination-out",n.fillStyle=o,n.fillRect(0,0,i,i),n.globalCompositeOperation="source-over",jt(s,!1,1)}function Cc(i=64,e=256){const t=Qt(i,e);if(!t)return null;const{ctx:n,canvas:s}=t;n.clearRect(0,0,i,e);for(let a=0;a<e;a++){const r=a/(e-1),o=Math.sin(Math.pow(r,.75)*Math.PI)*(.55+.45*(1-r));for(let l=0;l<i;l++){const c=l/(i-1)*2-1,h=Math.pow(Math.max(0,1-Math.abs(c)),2.4),u=Math.min(1,o*h*1.5);n.fillStyle="rgba(255,255,255,"+u.toFixed(3)+")",n.fillRect(l,a,1,1)}}return jt(s,!1,1)}function Km(i=256,e=8123){const t=Qt(i,i);if(!t)return null;const{ctx:n,canvas:s}=t,a=vn(e);n.clearRect(0,0,i,i),n.fillStyle="#ffffff",n.beginPath(),n.moveTo(i*.5,0),n.quadraticCurveTo(i*.95,i*.35,i*.55,i),n.quadraticCurveTo(i*.5,i*.6,i*.45,i),n.quadraticCurveTo(i*.05,i*.35,i*.5,0),n.fill(),n.globalCompositeOperation="destination-out";for(let r=0;r<60;r++){const o=Math.pow(a(),.6)*i,l=a()<.5?-1:1,c=i*.5+l*(i*(.1+a()*.42));n.beginPath(),n.ellipse(c,o,i*(.01+a()*.05),i*(.01+a()*.03),a()*Math.PI,0,Math.PI*2),n.fill()}return n.globalCompositeOperation="source-over",jt(s,!1,1)}function Zm(i=128,e=4242){const t=Qt(i,i);if(!t)return null;const{ctx:n,canvas:s}=t,a=vn(e);n.clearRect(0,0,i,i);for(let r=0;r<5;r++){const o=i*(.2+a()*.6),l=i*(.12+a()*.3);n.strokeStyle="rgba(90,80,64,0.85)",n.lineWidth=i*.012,n.beginPath(),n.moveTo(o,i),n.quadraticCurveTo(o+(a()-.5)*i*.2,i*.6,o+(a()-.5)*i*.1,l),n.stroke();const c=o+(a()-.5)*i*.1;for(let h=0;h<5;h++){const u=h/5*Math.PI*2+a();n.fillStyle=h%2===0?"rgba(230,220,198,0.95)":"rgba(179,166,138,0.9)",n.beginPath(),n.ellipse(c+Math.cos(u)*i*.035,l+Math.sin(u)*i*.035,i*.03,i*.016,u,0,Math.PI*2),n.fill()}n.fillStyle="rgba(232,168,40,0.8)",n.beginPath(),n.arc(c,l,i*.012,0,Math.PI*2),n.fill()}return jt(s,!0,1)}function Jm(i=128,e=7777){const t=Qt(i,i);if(!t)return null;const{ctx:n,canvas:s}=t,a=vn(e);n.clearRect(0,0,i,i);const r=[vt.gold,vt.bloodBright,vt.violet,vt.boneWhite];for(let o=0;o<4;o++){n.fillStyle=r[o],n.globalAlpha=.55+a()*.4,n.beginPath();const l=i*(.25+a()*.5),c=i*(.25+a()*.5),h=3+Math.floor(a()*3);for(let u=0;u<=h;u++){const d=u/h*Math.PI*2,p=i*(.08+a()*.2),g=l+Math.cos(d)*p,x=c+Math.sin(d)*p;u===0?n.moveTo(g,x):n.lineTo(g,x)}n.closePath(),n.fill()}return n.globalAlpha=1,jt(s,!0,1)}function $m(i=256,e=.16){const t=Qt(i,i);if(!t)return null;const{ctx:n,canvas:s}=t;n.clearRect(0,0,i,i);const a=24;for(let r=0;r<a;r++){const o=r/(a-1),l=i*(.5-e*.5+e*o*.5)*.96,c=Math.sin(o*Math.PI);n.strokeStyle="rgba(255,255,255,"+(c*.16).toFixed(3)+")",n.lineWidth=i*e/a+1.5,n.beginPath(),n.arc(i/2,i/2,l,0,Math.PI*2),n.stroke()}return jt(s,!1,1)}const un=(i,e,t)=>i<e?e:i>t?t:i,aa=(i,e,t)=>i+(e-i)*t,to=i=>{const e=un(i,0,1);return e*e*(3-2*e)},bi=(i,e,t,n)=>i+(e-i)*(1-Math.exp(-t*n));function Ma(i){let e=i>>>0||1;return()=>{e=e+1831565813>>>0;let t=e;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}class Ms{geos=new Set;mats=new Set;texs=new Set;geo(e){return this.geos.add(e),e}mat(e){return this.mats.add(e),e}tex(e){return e&&this.texs.add(e),e}dispose(){this.geos.forEach(e=>e.dispose()),this.mats.forEach(e=>e.dispose()),this.texs.forEach(e=>e.dispose()),this.geos.clear(),this.mats.clear(),this.texs.clear()}}function Ss(i){for(i.traverse(e=>{e.userData={}});i.children.length;)i.remove(i.children[0]);i.parent&&i.parent.remove(i)}function Pc(i,e=16773852){return{uDissolve:{value:0},uFlash:{value:0},uFlashColor:{value:new Le(e)},uEdgeColor:{value:new Le(i)},uTime:{value:0}}}const Qm=["float dsHash(vec3 p){","  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));","  p *= 17.0;","  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));","}","float dsNoise(vec3 p){","  vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);","  return mix(mix(mix(dsHash(i), dsHash(i + vec3(1,0,0)), f.x),","                 mix(dsHash(i + vec3(0,1,0)), dsHash(i + vec3(1,1,0)), f.x), f.y),","             mix(mix(dsHash(i + vec3(0,0,1)), dsHash(i + vec3(1,0,1)), f.x),","                 mix(dsHash(i + vec3(0,1,1)), dsHash(i + vec3(1,1,1)), f.x), f.y), f.z);","}"].join(`
`);function no(i,e,t=1){i.onBeforeCompile=n=>{n.uniforms.uDissolve=e.uDissolve,n.uniforms.uFlash=e.uFlash,n.uniforms.uFlashColor=e.uFlashColor,n.uniforms.uEdgeColor=e.uEdgeColor,n.uniforms.uTime=e.uTime,n.uniforms.uVBias={value:t},n.vertexShader=`varying vec3 vDsPos;
`+n.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
  vDsPos = position;`),n.fragmentShader=`varying vec3 vDsPos;
uniform float uDissolve;
uniform float uFlash;
uniform vec3 uFlashColor;
uniform vec3 uEdgeColor;
uniform float uTime;
uniform float uVBias;
`+Qm+`
`+n.fragmentShader.replace("#include <clipping_planes_fragment>",["#include <clipping_planes_fragment>","  float dsField = dsNoise(vDsPos * 5.5 + vec3(0.0, uTime * 0.15, 0.0)) * 0.72","               + dsNoise(vDsPos * 17.0) * 0.28;","  dsField = clamp(dsField * 0.82 + (0.5 - vDsPos.y * 0.16 * uVBias) * 0.3, 0.0, 1.0);","  float dsCut = uDissolve * 1.12;","  if (dsField < dsCut - 0.015) discard;","  float dsEdge = 1.0 - smoothstep(dsCut, dsCut + 0.14, dsField);"].join(`
`)).replace("#include <color_fragment>",`#include <color_fragment>
  diffuseColor.rgb = mix(diffuseColor.rgb, uFlashColor, clamp(uFlash, 0.0, 1.0) * 0.72);`).replace("#include <emissivemap_fragment>",["#include <emissivemap_fragment>","  totalEmissiveRadiance += uEdgeColor * dsEdge * step(0.001, uDissolve) * 3.4;","  totalEmissiveRadiance += uFlashColor * clamp(uFlash, 0.0, 1.0) * 1.6;"].join(`
`))},i.needsUpdate=!0}function li(i,e,t,n=1){const s={value:new Le(e)},a={value:.5},r={value:n},o={uColor:s,uPulse:a,uOpacity:r};t&&(o.uMap={value:t});const l=["uniform vec3 uColor;","uniform float uPulse;","uniform float uOpacity;",t?"uniform sampler2D uMap;":"","varying vec2 vUv;","void main(){",t?"  float shape = texture2D(uMap, vUv).r;":"  float shape = pow(max(0.0, 1.0 - abs(vUv.x - 0.5) * 2.0), 2.0) * sin(clamp(vUv.y, 0.0, 1.0) * 3.14159);","  float p = clamp(uPulse, 0.0, 3.0);","  vec3 c = uColor * (0.55 + p * 1.25);","  float a = shape * uOpacity * (0.45 + 0.55 * p);","  if (a < 0.004) discard;","  gl_FragColor = vec4(c, a);","}"].filter(h=>h.length>0).join(`
`);return{mat:i.mat(new $t({uniforms:o,vertexShader:["varying vec2 vUv;","void main(){","  vUv = uv;","  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);","}"].join(`
`),fragmentShader:l,transparent:!0,blending:qi,depthWrite:!1,side:qt,toneMapped:!1})),uColor:s,uPulse:a,uOpacity:r}}function Lc(i,e,t=0,n=2.6){const s={value:new Le(e)},a={value:t},r={value:n};return{mat:i.mat(new $t({uniforms:{uColor:s,uIntensity:a,uPower:r},vertexShader:["varying vec3 vN;","varying vec3 vV;","void main(){","  vN = normalize(normalMatrix * normal);","  vec4 mv = modelViewMatrix * vec4(position, 1.0);","  vV = normalize(-mv.xyz);","  gl_Position = projectionMatrix * mv;","}"].join(`
`),fragmentShader:["uniform vec3 uColor;","uniform float uIntensity;","uniform float uPower;","varying vec3 vN;","varying vec3 vV;","void main(){","  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);","  float a = f * uIntensity;","  if (a < 0.004) discard;","  gl_FragColor = vec4(uColor * (0.6 + uIntensity), a);","}"].join(`
`),transparent:!0,blending:qi,depthWrite:!1,toneMapped:!1})),uColor:s,uIntensity:a,uPower:r}}function Ic(){const i={},e={};return{joints:i,rest:e,add(t,n,s,a=[0,0,0]){const r=new st;return r.name=t,r.position.set(s[0],s[1],s[2]),r.rotation.set(a[0],a[1],a[2]),n.add(r),i[t]=r,e[t]={p:[s[0],s[1],s[2]],r:[a[0],a[1],a[2]]},r},reset(){for(const t in i){const n=i[t],s=e[t];n.position.set(s.p[0],s.p[1],s.p[2]),n.rotation.set(s.r[0],s.r[1],s.r[2])}}}}function Dc(i,e,t,n){const s=e.keys;let a=0;for(;a<s.length-2&&s[a+1].t<t;)a++;const r=s[a],o=s[Math.min(a+1,s.length-1)],l=Math.max(1e-4,o.t-r.t),c=to((t-r.t)/l),h=(p,g,x,m,f,M)=>{const w=x&&x[g],S=m&&m[g],b=aa(w?w[0]:0,S?S[0]:0,c)*M,E=aa(w?w[1]:0,S?S[1]:0,c)*M,R=aa(w?w[2]:0,S?S[2]:0,c)*M;f?(p.position.x+=b,p.position.y+=E,p.position.z+=R):(p.rotation.x+=b,p.rotation.y+=E,p.rotation.z+=R)},u=new Set;for(const p of s)if(p.rot)for(const g in p.rot)u.add(g);u.forEach(p=>{const g=i.joints[p];if(!g)return;const x=e.full&&e.full.indexOf(p)>=0?1:n;h(g,p,r.rot,o.rot,!1,x)});const d=new Set;for(const p of s)if(p.pos)for(const g in p.pos)d.add(g);d.forEach(p=>{const g=i.joints[p];if(!g)return;const x=e.full&&e.full.indexOf(p)>=0?1:n;h(g,p,r.pos,o.pos,!0,x)})}function Uc(i){return i<=0||i>=1?0:i<.08?to(i/.08):i>.86?to((1-i)/.14):1}function jm(){const i=new Ms,e=new Gn;e.name="arena";const t=Ma(9931),n=i.tex(zm(1024)),s=i.tex(qm(512)),a=i.tex(Wm(512)),r=i.mat(new Et({color:n?16777215:2760729,roughness:.94,metalness:.06}));n&&(r.map=n),s&&(r.roughnessMap=s),a?(r.emissiveMap=a,r.emissive=new Le(9315346),r.emissiveIntensity=.55):(r.emissive=new Le(2755334),r.emissiveIntensity=.35);const o=new Ye(i.geo(new da(10,72)),r);o.rotation.x=-Math.PI/2,o.receiveShadow=!0,e.add(o);const l=li(i,14039594,a,.5),c=new Ye(i.geo(new da(9.98,72)),l.mat);c.rotation.x=-Math.PI/2,c.position.y=.012,e.add(c);const h=i.mat(new Et({color:1774608,roughness:1,metalness:0})),u=new Ye(i.geo(new vo(9.9,34,56,1)),h);u.rotation.x=-Math.PI/2,u.position.y=-.02,e.add(u);const d=i.mat(new Et({color:854793,roughness:.85,metalness:.1})),p=new Ye(i.geo(new Si(10.05,.16,6,64)),d);p.rotation.x=Math.PI/2,p.position.y=.02,e.add(p);const g=i.tex(bo(256,4141,"#3a2f26")),x=i.mat(new Et({color:2892572,roughness:.95,metalness:.05,flatShading:!0}));g&&(x.map=g);const m=i.geo(new Qi(1,0)),f=i.geo(new _o(1,0)),M=i.geo(new Zt(1,1,1));for(let L=0;L<16;L++){const q=L/16*Math.PI*2+t()*.3,Z=12+t()*14,N=t(),X=new Ye(N<.4?m:N<.75?f:M,x),G=.9+t()*2.6;X.scale.set(G*(.7+t()*.8),G*(N>.75?2.6+t()*3.4:1+t()),G*(.7+t()*.8)),X.position.set(Math.cos(q)*Z,X.scale.y*.28-.1,Math.sin(q)*Z),X.rotation.set((t()-.5)*.55,t()*Math.PI,(t()-.5)*.5),e.add(X)}const w=i.tex(Zm(128)),S=i.mat(new Et({color:w?16777215:14208176,roughness:.8,transparent:!0,alphaTest:.35,side:qt,emissive:new Le(4866869),emissiveIntensity:.5}));w&&(S.map=w,S.alphaMap=w);const b=i.geo(new _t(1,1));for(let L=0;L<26;L++){const q=t()*Math.PI*2,Z=10.6+t()*12,N=new Ye(b,S),X=.5+t()*.85;N.scale.set(X,X,X),N.position.set(Math.cos(q)*Z,X*.5-.05,Math.sin(q)*Z),N.rotation.y=t()*Math.PI,e.add(N)}const E=i.tex(Jm(128)),R=i.mat(new Et({color:E?16777215:10115642,roughness:.6,transparent:!0,alphaTest:.2,side:qt,emissive:new Le(3810322),emissiveIntensity:.6}));E&&(R.map=E,R.alphaMap=E);const v=i.geo(new _t(1,1)),T=[];for(let L=0;L<30;L++){const q=t()*Math.PI*2,Z=3+t()*16,N=new Ye(v,R),X=.12+t()*.42;N.scale.set(X,X,X);const G=t()<.45,j=G?.5+t()*3.4:.02;N.position.set(Math.cos(q)*Z,j,Math.sin(q)*Z),N.rotation.set(G?t()*Math.PI:-Math.PI/2,t()*Math.PI,t()*Math.PI),e.add(N),G&&T.push({mesh:N,baseY:j,spin:(t()-.5)*.5,phase:t()*6.283})}let C=1,P=0;return{group:e,update(L,q){P=bi(P,C===3?1:C===2?.55:.25,2.5,q);const Z=.35+.25*Math.sin(L*1.35)+.14*Math.sin(L*4.1+1.7)+P*.7;l.uPulse.value=Z,r.emissiveIntensity=.32+Z*.55;for(let N=0;N<T.length;N++){const X=T[N];X.mesh.position.y=X.baseY+Math.sin(L*.45+X.phase)*.22,X.mesh.rotation.y+=X.spin*q,X.mesh.rotation.z+=X.spin*.4*q}},setPhase(L){C=un(Math.round(L),1,3);const q=C===1?11545112:C===2?14711330:12595338;l.uColor.value.setHex(q),r.emissive.setHex(C===3?10491968:C===2?10897938:9315346),x.emissive=new Le(C===3?2756656:1182728),x.emissiveIntensity=C===3?.5:.2,S.emissiveIntensity=C===3?.9:.5},dispose(){Ss(e),i.dispose(),T.length=0}}}function Ll(i,e,t,n,s,a,r){const o={value:0},l={value:1},c={value:a},h={uTime:o,uOpacity:l,uSize:c,uColorA:{value:new Le(t)},uColorB:{value:new Le(n)},uHeight:{value:r}};return e&&(h.uMap={value:e}),{mat:i.mat(new $t({uniforms:h,vertexShader:["attribute float aSeed;","attribute float aSpeed;","attribute float aScale;","uniform float uTime;","uniform float uSize;","uniform float uHeight;","varying float vSeed;","void main(){","  vSeed = aSeed;","  float ph = aSeed * 6.28318;","  float y = mod(position.y - uTime * aSpeed, uHeight);","  vec3 p = vec3(","    position.x + sin(uTime * 0.5 + ph) * 0.5 + sin(uTime * 1.7 + ph * 2.1) * 0.12,","    y,","    position.z + cos(uTime * 0.43 + ph) * 0.5 + cos(uTime * 1.9 + ph * 1.7) * 0.12);","  vec4 mv = modelViewMatrix * vec4(p, 1.0);","  gl_PointSize = clamp(uSize * aScale * (2.4 / max(0.6, -mv.z)), 1.0, 14.0);","  gl_Position = projectionMatrix * mv;","}"].join(`
`),fragmentShader:["uniform vec3 uColorA;","uniform vec3 uColorB;","uniform float uOpacity;",e?"uniform sampler2D uMap;":"","varying float vSeed;","void main(){",e?"  float a = texture2D(uMap, gl_PointCoord).r;":"  float a = max(0.0, 1.0 - length(gl_PointCoord - vec2(0.5)) * 2.0);","  if (a < 0.05) discard;","  vec3 c = mix(uColorA, uColorB, fract(vSeed * 7.13));","  gl_FragColor = vec4(c, a * uOpacity);","}"].filter(d=>d.length>0).join(`
`),transparent:!0,depthWrite:!1,blending:s?qi:Mi,toneMapped:!1})),uTime:o,uOpacity:l,uSize:c}}function Il(i,e,t,n,s){const a=Ma(s),r=new Float32Array(e*3),o=new Float32Array(e),l=new Float32Array(e),c=new Float32Array(e);for(let u=0;u<e;u++){const d=a()*Math.PI*2,p=Math.sqrt(a())*t;r[u*3]=Math.cos(d)*p,r[u*3+1]=a()*n,r[u*3+2]=Math.sin(d)*p,o[u]=a(),l[u]=.35+a()*1.15,c[u]=.45+a()*1.2}const h=i.geo(new Pt);return h.setAttribute("position",new Dt(r,3)),h.setAttribute("aSeed",new Dt(o,1)),h.setAttribute("aSpeed",new Dt(l,1)),h.setAttribute("aScale",new Dt(c,1)),h.boundingSphere=new Ji(new I(0,n*.5,0),t*1.8),h}function eg(){const i=new Ms,e=new Gn;e.name="ambient-particles";const t=i.tex(Rc(64)),n=i.tex(xa(64,2.4)),s=Ll(i,t,723208,2366485,!1,9,13),a=new Kr(Il(i,900,15,13,3313),s.mat);a.frustumCulled=!1,e.add(a);const r=Ll(i,n,15247400,10120447,!0,7,13),o=new Kr(Il(i,420,13,13,7717),r.mat);o.frustumCulled=!1,e.add(o);let l=1,c=1;return{group:e,update(h,u){c=bi(c,l,3,u),s.uTime.value=h,r.uTime.value=h,s.uOpacity.value=.55*c,r.uOpacity.value=.75*c*(.8+.2*Math.sin(h*2.3)),s.uSize.value=9*(.75+.35*c),r.uSize.value=7*(.7+.5*c)},setIntensity(h){l=un(h,0,3)},dispose(){Ss(e),i.dispose()}}}const tg={combo:{keys:[{t:0},{t:.1,rot:{aUpR:[-1.5,.1,-.35],aLoR:[-.85,0,0],chest:[-.05,.34,0],spine:[0,.16,0],head:[0,.2,0]}},{t:.24,rot:{aUpR:[.72,-.1,.5],aLoR:[-.14,0,0],chest:[.16,-.38,0],spine:[.06,-.16,0],head:[.1,-.16,0]}},{t:.38,rot:{aUpL:[-1.45,-.1,.35],aLoL:[-.9,0,0],chest:[-.05,-.34,0],spine:[0,-.16,0],head:[0,-.2,0]}},{t:.54,rot:{aUpL:[.68,.1,-.5],aLoL:[-.12,0,0],chest:[.14,.36,0],spine:[.05,.16,0],head:[.1,.16,0]}},{t:.7,rot:{aUpR:[-1.85,0,-.5],aUpL:[-1.85,0,.5],aLoR:[-.5,0,0],aLoL:[-.5,0,0],chest:[-.2,0,0],spine:[-.12,0,0],head:[-.24,0,0]},pos:{root:[0,.12,0]}},{t:.85,rot:{aUpR:[1,0,.62],aUpL:[1,0,-.62],aLoR:[-.1,0,0],aLoL:[-.1,0,0],chest:[.3,0,0],spine:[.16,0,0],pelvis:[.12,0,0],head:[.28,0,0]},pos:{root:[0,-.1,.14]}},{t:1}]},sweep:{keys:[{t:0},{t:.16,rot:{chest:[0,1.15,0],spine:[0,.5,0],aUpR:[-.6,.2,-1.15],aLoR:[-.45,0,0],aUpL:[.3,0,.5],head:[0,.5,0]},pos:{root:[.12,-.06,-.1]}},{t:.46,rot:{chest:[0,-1.2,0],spine:[0,-.55,0],aUpR:[-.25,-.3,-1.5],aLoR:[-.1,0,0],aUpL:[-.2,0,.9],head:[0,-.5,0]},pos:{root:[-.12,-.02,.12]}},{t:.72,rot:{chest:[0,.9,0],spine:[0,.4,0],aUpL:[-.3,.3,1.45],aLoL:[-.15,0,0],aUpR:[-.2,0,-.7],head:[0,.4,0]},pos:{root:[.1,-.02,.06]}},{t:1}]},thrust:{keys:[{t:0},{t:.22,rot:{aUpR:[-.55,.35,-.25],aLoR:[-1.75,0,0],chest:[0,.45,0],spine:[.08,.2,0],thighR:[.25,0,0],thighL:[-.15,0,0],head:[.05,.28,0]},pos:{root:[0,-.14,-.22]}},{t:.4,rot:{aUpR:[-1.35,.05,-.1],aLoR:[-.05,0,0],chest:[.04,-.12,0],spine:[-.06,-.06,0],thighR:[-.1,0,0],head:[-.05,-.06,0]},pos:{root:[0,.04,.82]}},{t:.58,rot:{aUpR:[-1.3,.05,-.1],aLoR:[-.08,0,0],chest:[.06,-.1,0]},pos:{root:[0,.02,.74]}},{t:.8,rot:{aUpR:[-.4,0,-.1],aLoR:[-.6,0,0],chest:[.1,.1,0]},pos:{root:[0,-.05,.2]}},{t:1}]},array:{keys:[{t:0},{t:.26,rot:{aUpR:[-2,0,-.95],aUpL:[-2,0,.95],aLoR:[-.35,0,0],aLoL:[-.35,0,0],bUpR:[-.9,0,-1.5],bUpL:[-.9,0,1.5],bLoR:[-.7,0,0],bLoL:[-.7,0,0],head:[-.32,0,0],chest:[-.14,0,0],wingL:[0,.5,-.5],wingR:[0,-.5,.5]},pos:{root:[0,.3,0]}},{t:.62,rot:{aUpR:[-2.05,0,-1.05],aUpL:[-2.05,0,1.05],bUpR:[-1,0,-1.55],bUpL:[-1,0,1.55],chest:[-.14,.28,0],head:[-.3,.2,0],wingL:[0,.6,-.6],wingR:[0,-.6,.6]},pos:{root:[0,.34,0]}},{t:.86,rot:{aUpR:[-.5,0,-.3],aUpL:[-.5,0,.3],bUpR:[-.2,0,-.4],bUpL:[-.2,0,.4],chest:[.16,0,0]},pos:{root:[0,-.08,0]}},{t:1}]},charge:{keys:[{t:0},{t:.3,rot:{thighR:[.55,0,.12],thighL:[.55,0,-.12],shinR:[-.85,0,0],shinL:[-.85,0,0],spine:[.35,0,0],chest:[.28,0,0],head:[.4,0,0],aUpR:[-.9,.6,-.1],aLoR:[-1.5,0,0],aUpL:[-.9,-.6,.1],aLoL:[-1.5,0,0],bUpR:[-.4,.3,-.2],bUpL:[-.4,-.3,.2],cloak0:[-.3,0,0]},pos:{root:[0,-.42,-.08]}},{t:.72,rot:{thighR:[.6,0,.12],thighL:[.6,0,-.12],shinR:[-.9,0,0],shinL:[-.9,0,0],spine:[.38,0,0],chest:[.3,0,0],head:[.44,0,0],aUpR:[-.95,.65,-.1],aLoR:[-1.6,0,0],aUpL:[-.95,-.65,.1],aLoL:[-1.6,0,0],cloak0:[-.34,0,0]},pos:{root:[0,-.46,-.08]}},{t:.9,rot:{spine:[-.3,0,0],chest:[-.25,0,0],head:[-.4,0,0],aUpR:[-1.7,0,-1.2],aUpL:[-1.7,0,1.2],bUpR:[-1.2,0,-1.4],bUpL:[-1.2,0,1.4],cloak0:[.4,0,0],wingL:[0,.7,-.7],wingR:[0,-.7,.7]},pos:{root:[0,.18,0]}},{t:1}]},execution:{keys:[{t:0},{t:.28,rot:{aUpR:[-2.5,.15,-.2],aLoR:[-.55,0,0],spine:[-.4,0,0],chest:[-.34,0,0],head:[-.45,0,0],pelvis:[-.12,0,0],aUpL:[-.6,0,.7],wingL:[0,.55,-.55],wingR:[0,-.55,.55]},pos:{root:[0,.32,-.12]}},{t:.5,rot:{aUpR:[-2.6,.1,-.15],aLoR:[-.5,0,0],spine:[-.44,0,0],chest:[-.36,0,0],head:[-.5,0,0],aUpL:[-.65,0,.75]},pos:{root:[0,.36,-.12]}},{t:.62,rot:{aUpR:[1.15,0,.2],aLoR:[-.05,0,0],spine:[.46,0,0],chest:[.34,0,0],head:[.5,0,0],pelvis:[.2,0,0],thighR:[.3,0,0],thighL:[.3,0,0],shinR:[-.5,0,0],shinL:[-.5,0,0]},pos:{root:[0,-.24,.3]}},{t:.82,rot:{aUpR:[.4,0,.15],aLoR:[-.4,0,0],spine:[.2,0,0],chest:[.16,0,0],head:[.2,0,0]},pos:{root:[0,-.12,.12]}},{t:1}]},storm:{full:["root"],keys:[{t:0,rot:{root:[0,0,0]}},{t:.14,rot:{root:[0,.6,0],aUpR:[-.15,0,-1.5],aUpL:[-.15,0,1.5],aLoR:[-.1,0,0],aLoL:[-.1,0,0],bUpR:[-.1,0,-1.35],bUpL:[-.1,0,1.35],chest:[-.08,0,0]},pos:{root:[0,.12,0]}},{t:.86,rot:{root:[0,11.6,0],aUpR:[-.2,0,-1.58],aUpL:[-.2,0,1.58],aLoR:[-.05,0,0],aLoL:[-.05,0,0],bUpR:[-.15,0,-1.4],bUpL:[-.15,0,1.4],chest:[-.1,0,0]},pos:{root:[0,.16,0]}},{t:1,rot:{root:[0,12.566,0]}}]}};function Dl(i,e,t){const n=new st;n.name="sword",e.add(n);const s=new Ye(i.geo(new Ht(.028,.034,.3,6)),t.hiltMat);s.position.y=-.1,n.add(s);const a=new Ye(i.geo(new Qi(.045,0)),t.hiltMat);a.position.y=-.27,n.add(a);const r=new Ye(i.geo(new Zt(.36,.045,.1)),t.metalMat);r.position.y=.06,n.add(r);const o=i.geo(new Ht(t.bladeWidth*.28,t.bladeWidth,t.bladeLen,4,1)),l=new Ye(o,t.metalMat);l.position.y=.06+t.bladeLen*.5,l.rotation.y=Math.PI*.25,t.curved&&(l.rotation.z=.06),l.scale.set(1,1,.42),n.add(l);const c=[],h=i.geo(new _t(t.bladeWidth*9,t.bladeLen*1.16));for(let g=0;g<2;g++){const x=li(i,t.color,t.streak,1),m=new Ye(h,x.mat);m.position.y=.06+t.bladeLen*.52,m.rotation.y=g===0?0:Math.PI/2,t.curved&&(m.rotation.z=.06),n.add(m),c.push(x)}const u=li(i,t.color,null,.9),d=new Ye(i.geo(new _t(.3,.3)),u.mat);d.position.y=.08,n.add(d),c.push(u);const p=new st;return p.name="tip",p.position.y=.06+t.bladeLen*1.02,n.add(p),{root:n,tip:p,glows:c,blade:l}}function Ul(){const i=new Ms,e=new Gn;e.name="boss";const t=Ic(),n=Ma(31337),s=Pc(16747050,16774370),a=i.tex(Ac(512,4404)),r=i.tex(Xm(512,9182)),o=i.tex(Ym(512)),l=i.tex(bo(256,616,"#4a4238")),c=i.tex(Km(256)),h=i.tex(Cc(64,256)),u=i.tex(xa(128,2)),d=i.mat(new Et({color:1709588,roughness:.72,metalness:.18})),p=i.mat(new Et({color:a?16777215:12103317,roughness:.88,metalness:.04,side:qt,transparent:!0,alphaTest:.28}));a&&(p.map=a),r&&(p.alphaMap=r);const g=i.mat(new Et({color:o?16777215:15129798,roughness:.55,metalness:.12}));o&&(g.map=o);const x=i.mat(new Et({color:l?16777215:5919560,roughness:.34,metalness:.85}));l&&(x.map=l);const m=i.mat(new Et({color:2760986,roughness:.65,metalness:.4})),f=i.mat(new Et({color:1315087,roughness:.95,side:qt,transparent:!0,alphaTest:.3,emissive:new Le(2757152),emissiveIntensity:.4}));c&&(f.alphaMap=c);const M=i.mat(new Et({color:3811848,roughness:.3,metalness:.6,emissive:new Le(16756778),emissiveIntensity:2.4})),w=i.mat(new Et({color:1575466,roughness:.3,metalness:.6,emissive:new Le(10112255),emissiveIntensity:2.2}));for(const B of[d,p,g,x,m,f,M,w])no(B,s);const S=t.add("root",e,[0,0,0]),b=t.add("pelvis",S,[0,1.7,0]),E=t.add("spine",b,[0,.16,-.01]),R=t.add("chest",E,[0,.34,0]),v=t.add("neck",R,[0,.42,-.02]),T=t.add("head",v,[0,.18,.03]),C=(B,ae,ne,xe,be,Xe)=>{const Qe=new Ye(B,ae);return Qe.position.set(xe[0],xe[1],xe[2]),be&&Qe.rotation.set(be[0],be[1],be[2]),Xe&&Qe.scale.set(Xe[0],Xe[1],Xe[2]),ne.add(Qe),Qe};C(i.geo(new ft(.17,.14,3,10)),d,b,[0,0,0],void 0,[1,1,.82]),C(i.geo(new ft(.185,.24,3,10)),d,E,[0,.14,0],void 0,[1,1,.78]),C(i.geo(new ft(.215,.3,4,10)),d,R,[0,.14,0],void 0,[1.05,1,.76]),C(i.geo(new Zt(.34,.4,.14)),x,R,[0,.14,.15],[.06,0,0]),C(i.geo(new ft(.115,.14,2,8)),x,R,[.34,.32,0],[0,0,1.35]),C(i.geo(new ft(.115,.14,2,8)),x,R,[-.34,.32,0],[0,0,-1.35]),C(i.geo(new Ht(.22,.4,.62,12,1,!0)),p,b,[0,-.28,0]),C(i.geo(new Ht(.062,.075,.18,8)),d,v,[0,.08,0]),C(i.geo(new si(.17,14,12)),g,T,[0,0,0],void 0,[.88,1.08,.95]),C(i.geo(new Si(.16,.028,5,14)),x,T,[0,-.03,0],[1.45,0,0]);const P=i.geo(new ua(.042,.44,6));C(P,x,T,[.11,.14,-.05],[-.55,0,.34]),C(P,x,T,[-.11,.14,-.05],[-.55,0,-.34]),C(i.geo(new ua(.03,.3,5)),x,T,[0,.2,-.02],[-.2,0,0]);const L=i.geo(new ft(.072,.46,3,8)),q=i.geo(new ft(.06,.4,3,8)),Z=i.geo(new Zt(.09,.14,.07)),N=i.geo(new ft(.058,.38,3,8)),X=i.geo(new ft(.05,.32,3,8)),G=i.geo(new si(.1,8,6)),j=(B,ae,ne,xe,be,Xe)=>{const Qe=t.add(B,R,xe,be),Ne=t.add(ae,Qe,[0,Xe?-.56:-.46,0],[-.22,0,0]),xn=t.add(ne,Ne,[0,Xe?-.48:-.4,0]);return C(Xe?L:N,d,Qe,[0,Xe?-.27:-.22,0]),C(Xe?q:X,d,Ne,[0,Xe?-.23:-.19,0]),C(Z,d,xn,[0,-.06,0]),Xe&&C(G,x,Qe,[0,-.02,0],void 0,[1,.8,1]),xn},se=j("aUpR","aLoR","handR",[.34,.28,.02],[.12,0,-.2],!0),pe=j("aUpL","aLoL","handL",[-.34,.28,.02],[.12,0,.2],!0),re=j("bUpR","bLoR","handBR",[.3,.04,-.12],[.05,0,-.55],!1),Me=j("bUpL","bLoL","handBL",[-.3,.04,-.12],[.05,0,.55],!1),Be=Dl(i,se,{bladeLen:1.62,bladeWidth:.062,color:16753704,metalMat:x,hiltMat:m,streak:h,curved:!1});Be.root.rotation.set(-2,0,.1);const tt=Dl(i,pe,{bladeLen:1.74,bladeWidth:.05,color:10116351,metalMat:x,hiltMat:m,streak:h,curved:!0});tt.root.rotation.set(-2.08,0,-.1);const qe=i.geo(new Ht(.012,.03,.62,4)),$=(B,ae,ne)=>{const xe=new st;xe.rotation.set(-1.5,0,ne*.2),B.add(xe);const be=new Ye(qe,x);be.position.y=.34,be.rotation.y=Math.PI*.25,be.scale.set(1,1,.5),xe.add(be);const Xe=li(i,ae,h,.85),Qe=new Ye(i.geo(new _t(.24,.78)),Xe.mat);return Qe.position.y=.36,xe.add(Qe),xe.scale.setScalar(.001),{root:xe,glow:Xe}},le=$(re,16742954,-1),ie=$(Me,11562239,1),Ie=i.geo(new Qi(.082,1)),ke=i.geo(new xo(.045,0)),Ae=(B,ae,ne)=>{const xe=new st;xe.position.set(ne[0],ne[1],ne[2]),R.add(xe);const be=new Ye(Ie,B);xe.add(be);const Xe=li(i,ae,u,.9),Qe=new Ye(i.geo(new _t(.5,.5)),Xe.mat);Qe.position.z=.04,xe.add(Qe);const Ne=[];for(let xn=0;xn<5;xn++){const Mn=new Ye(ke,x),Xn=xn/5*Math.PI*2;Mn.position.set(Math.cos(Xn)*.09,Math.sin(Xn)*.09,.02+n()*.03),Mn.rotation.set(n()*3,n()*3,n()*3),Mn.visible=!1,xe.add(Mn),Ne.push(Mn)}return{holder:xe,core:be,halo:Xe,shards:Ne}},nt=Ae(M,16756778,[.17,.2,.2]),De=Ae(w,10112255,[-.17,.05,.2]),Ke=i.geo(new _t(.34,1.25,1,3)),Ze=(B,ae)=>{const ne=t.add(B,R,[ae*.26,.3,-.19],[.22,ae*-.35,ae*.2]);for(let xe=0;xe<5;xe++){const be=C(Ke,f,ne,[ae*(.06+xe*.09),-.55-xe*.06,-.02-xe*.04],[.1+xe*.05,ae*(.12+xe*.14),ae*(.12+xe*.18)],[1-xe*.1,1-xe*.08,1]);be.name=B+"-f"+xe}return ne};Ze("wingL",-1),Ze("wingR",1);const He=t.add("cloak0",R,[0,.36,-.17],[.14,0,0]),rt=t.add("cloak1",He,[0,-.56,-.02],[.06,0,0]),mt=t.add("cloak2",rt,[0,-.56,-.02],[.05,0,0]),gt=i.geo(new _t(.96,.6,3,2)),Mt=i.geo(new _t(.86,.6,3,2)),it=i.geo(new _t(.7,.62,3,2));C(gt,p,He,[0,-.28,0]),C(Mt,p,rt,[0,-.28,0]),C(it,p,mt,[0,-.3,0]);const ot=i.geo(new ft(.1,.58,3,8)),D=i.geo(new ft(.082,.6,3,8)),Lt=i.geo(new Zt(.14,.09,.3)),oe=(B,ae,ne,xe)=>{const be=t.add(B,b,[xe*.16,-.1,0],[.04,0,xe*.05]),Xe=t.add(ae,be,[0,-.78,0],[-.06,0,0]),Qe=t.add(ne,Xe,[0,-.76,0],[.02,0,0]);C(ot,d,be,[0,-.39,0]),C(D,d,Xe,[0,-.38,0]),C(Lt,x,Qe,[0,-.04,.06]),C(i.geo(new ft(.09,.06,2,8)),x,Xe,[0,.02,.02])};oe("thighR","shinR","footR",1),oe("thighL","shinL","footL",-1);const A=Lc(i,16742954,.18,2.4),_=new Ye(i.geo(new ft(.32,.62,4,12)),A.mat);_.position.y=.12,_.scale.set(1.16,1.12,1),R.add(_);const k=new st;k.position.set(0,.26,0),T.add(k);const O=new st;O.position.set(0,.16,.16),R.add(O);const z={head:k,chest:O,goldTip:Be.tip,violetTip:tt.tip,gold_core:nt.core,violet_core:De.core};let ee=1,te=null,K=0,J=1,de=0,Ee=0,ue=0,ce=0,Te=0,Ce=0,Ue=0,U=0,he=!1,Q=!1,fe=0;const me=(B,ae,ne)=>{for(let xe=0;xe<B.length;xe++)B[xe].uPulse.value=ae,B[xe].uOpacity.value=ne};return{group:e,anchors:z,update(B,ae){const ne=un(ae,0,.1);s.uTime.value=B,de*=Math.exp(-ne*7.5),Ee*=Math.exp(-ne*4.5),ce*=Math.exp(-ne*9),Te*=Math.exp(-ne*5.5),Ce*=Math.exp(-ne*5.5),s.uFlash.value=de,s.uDissolve.value=un(Math.max(ue,Ee*.28),0,1);let xe=0;te&&(K+=ne/J,K>=1?(te=null,K=0):xe=Uc(K)),t.reset();const be=1-.74*xe,Xe=Math.sin(B*1.15),Qe=ee>=3?.16:ee>=2?.08:0,Ne=t.joints;if(Ne.spine.rotation.x+=(Xe*.028+Qe*.5)*be+Qe*.5,Ne.chest.rotation.x+=(Xe*.034+Qe)*be,Ne.chest.rotation.y+=Math.sin(B*.47)*.05*be,Ne.neck.rotation.x+=-Xe*.02*be,Ne.head.rotation.x+=(Math.sin(B*.9+1.1)*.03-Qe*.6)*be,Ne.head.rotation.y+=Math.sin(B*.33)*.12*be,Ne.pelvis.rotation.y+=Math.sin(B*.52)*.04*be,Ne.aUpR.rotation.x+=(Math.sin(B*.83)*.05-.05)*be,Ne.aUpR.rotation.z+=Math.sin(B*.61+.7)*.04*be,Ne.aUpL.rotation.x+=(Math.sin(B*.79+2.1)*.05-.05)*be,Ne.aUpL.rotation.z+=-Math.sin(B*.58+1.3)*.04*be,Ne.aLoR.rotation.x+=Math.sin(B*.9+.4)*.06*be,Ne.aLoL.rotation.x+=Math.sin(B*.87+2.6)*.06*be,Ne.bUpR.rotation.z+=Math.sin(B*.7+1.9)*.06*be,Ne.bUpL.rotation.z+=-Math.sin(B*.73+.5)*.06*be,fe=bi(fe,ee>=3?1:0,1.6,ne),Ne.root.position.y+=(Math.sin(B*1.6)*.03+.06)*fe+Xe*.012*be,te&&Dc(t,te,K,xe),ce>.001){const Tt=ce;Ne.chest.rotation.x+=Math.sin(B*62)*.05*Tt,Ne.chest.rotation.z+=Math.sin(B*71+1.3)*.05*Tt,Ne.head.rotation.z+=Math.sin(B*83)*.06*Tt,Ne.root.position.x+=Math.sin(B*77)*.02*Tt}const xn=Math.sin(B*1.25),Mn=Math.sin(B*1.25-.7),Xn=Math.sin(B*1.25-1.4),ln=1+xe*1.8+ce*2;Ne.cloak0.rotation.x+=xn*.05*ln,Ne.cloak0.rotation.z+=Math.sin(B*.9)*.04*ln,Ne.cloak1.rotation.x+=Mn*.09*ln,Ne.cloak1.rotation.z+=Math.sin(B*.95+1)*.06*ln,Ne.cloak2.rotation.x+=Xn*.13*ln,Ne.cloak2.rotation.z+=Math.sin(B*1.05+2)*.08*ln,Ne.wingL.rotation.z+=(Math.sin(B*.85)*.07-.03)*ln,Ne.wingR.rotation.z+=(-Math.sin(B*.85+.4)*.07+.03)*ln,Ne.wingL.rotation.x+=Math.sin(B*.6)*.05*ln,Ne.wingR.rotation.x+=Math.sin(B*.62+1.7)*.05*ln;const ci=.3+ee*.14+.12*Math.sin(B*2.6),cn=1-ue;me(Be.glows,(ci+Te*1.7)*(he?.35:1),cn*(he?.5:1)),me(tt.glows,(ci*.9+Ce*1.7)*(Q?.35:1),cn*(Q?.5:1)),Ue=bi(Ue,U,6,ne);const Sn=Math.max(.001,Ue);le.root.scale.setScalar(Sn),ie.root.scale.setScalar(Sn),le.glow.uPulse.value=ci*Ue,ie.glow.uPulse.value=ci*Ue,le.glow.uOpacity.value=.85*Ue*cn,ie.glow.uOpacity.value=.85*Ue*cn;const Yn=.55+.45*Math.sin(B*3.1);if(he||(M.emissiveIntensity=(1.6+Yn*1.4)*cn,nt.halo.uPulse.value=.5+Yn*.7,nt.halo.uOpacity.value=.85*cn,nt.core.rotation.y+=ne*.8,nt.core.rotation.x+=ne*.4),Q||(w.emissiveIntensity=(1.4+Yn*1.3)*cn,De.halo.uPulse.value=.45+Yn*.65,De.halo.uOpacity.value=.85*cn,De.core.rotation.y-=ne*.7,De.core.rotation.z+=ne*.35),A.uIntensity.value=(.1+ee*.06+de*.5+xe*.12)*cn,ue>.001){const Tt=ue;Ne.root.position.y-=Tt*.42,Ne.spine.rotation.x+=Tt*.5,Ne.chest.rotation.x+=Tt*.4,Ne.head.rotation.x+=Tt*.55,Ne.aUpR.rotation.x+=Tt*.4,Ne.aUpL.rotation.x+=Tt*.4,Ne.thighR.rotation.x+=Tt*.5,Ne.thighL.rotation.x+=Tt*.5,Ne.shinR.rotation.x-=Tt*.7,Ne.shinL.rotation.x-=Tt*.7,Ne.cloak2.rotation.x+=Tt*.5,f.opacity=1-Tt,f.transparent=!0}},setPhase(B){ee=un(Math.round(B),1,3);const ae=ee===1?16742954:ee===2?11556351:14032954;A.uColor.value.setHex(ae),U=ee>=2?1:0,p.color.setHex(ee>=3?10129272:16777215),s.uEdgeColor.value.setHex(ee>=3?16726570:16747050),M.emissive.setHex(ee>=3?16765034:16756778),w.emissive.setHex(ee>=3?13135103:10112255)},hitFlash(B){const ae=un(B,0,1);de=Math.max(de,ae),Ee=Math.max(Ee,ae*.5),ce=Math.max(ce,ae*.55)},playAttack(B,ae){const ne=tg[B];ne&&(te=ne,K=0,J=Math.max(.2,ae/1e3),B==="array"||B==="storm"?U=1:ee<2&&(U=0))},strike(B){ce=Math.max(ce,.7),B%2===0?Te=1.6:Ce=1.6,B>=2&&(Te=Math.max(Te,1.2),Ce=Math.max(Ce,1.2))},breakWeakPoint(B){const ae=B==="gold_core"?nt:De,ne=B==="gold_core"?M:w;B==="gold_core"?he=!0:Q=!0,ne.emissive.setHex(1314572),ne.emissiveIntensity=.12,ne.color.setHex(1051658),ne.roughness=.95,ne.metalness=.15,ae.core.scale.setScalar(.62),ae.core.rotation.set(.6,.4,.9),ae.halo.uOpacity.value=0,ae.halo.uPulse.value=0;for(let xe=0;xe<ae.shards.length;xe++){const be=ae.shards[xe];be.visible=!0,be.position.multiplyScalar(1.35)}},dissolve(B){ue=un(B,0,1)},dispose(){Ss(e),i.dispose()}}}const ng={slash:{keys:[{t:0},{t:.18,rot:{aUpR:[-1.7,.2,-.5],aLoR:[-.7,0,0],chest:[-.1,.42,0],spine:[0,.2,0],head:[-.05,.3,0],thighR:[-.15,0,0]},pos:{root:[0,.02,-.1]}},{t:.42,rot:{aUpR:[.62,-.2,.45],aLoR:[-.1,0,0],chest:[.2,-.45,0],spine:[.1,-.2,0],head:[.14,-.24,0],thighR:[.28,0,0],shinR:[-.3,0,0]},pos:{root:[0,-.04,.4]}},{t:.66,rot:{aUpR:[.2,-.1,.2],aLoR:[-.5,0,0],chest:[.08,-.2,0]},pos:{root:[0,-.02,.22]}},{t:1}]},cast:{keys:[{t:0},{t:.24,rot:{aUpR:[-1.25,-.35,-.7],aLoR:[-1.1,0,0],aUpL:[-1.25,.35,.7],aLoL:[-1.1,0,0],spine:[-.16,0,0],chest:[-.14,0,0],head:[-.28,0,0]},pos:{root:[0,.04,-.06]}},{t:.56,rot:{aUpR:[-1.5,-.15,-.35],aLoR:[-.6,0,0],aUpL:[-1.5,.15,.35],aLoL:[-.6,0,0],spine:[-.2,0,0],chest:[-.18,0,0],head:[-.34,0,0]},pos:{root:[0,.06,-.04]}},{t:.76,rot:{aUpR:[-1.62,.1,0],aLoR:[-.12,0,0],aUpL:[-1.62,-.1,0],aLoL:[-.12,0,0],spine:[.18,0,0],chest:[.14,0,0],head:[.1,0,0]},pos:{root:[0,-.02,.16]}},{t:1}]},thrust:{keys:[{t:0},{t:.2,rot:{aUpR:[-.45,.4,-.2],aLoR:[-1.7,0,0],chest:[0,.4,0],thighR:[.2,0,0]},pos:{root:[0,-.06,-.14]}},{t:.4,rot:{aUpR:[-1.4,.05,-.08],aLoR:[-.06,0,0],chest:[.05,-.14,0],thighL:[-.3,0,0],shinL:[.2,0,0]},pos:{root:[0,0,.52]}},{t:.64,rot:{aUpR:[-1.35,.05,-.08],aLoR:[-.1,0,0]},pos:{root:[0,0,.46]}},{t:1}]},counter:{keys:[{t:0},{t:.14,rot:{aUpR:[-.9,0,-1.1],aLoR:[-1.4,0,0],chest:[0,-.35,0],spine:[.1,-.15,0],head:[0,-.3,0]},pos:{root:[-.2,-.05,.05]}},{t:.34,rot:{aUpR:[-2,.2,-.4],aLoR:[-.5,0,0],chest:[-.12,.2,0],head:[-.16,.2,0]},pos:{root:[-.1,.03,0]}},{t:.58,rot:{aUpR:[-1.2,.1,.1],aLoR:[-.2,0,0],chest:[.12,-.3,0],spine:[.06,-.14,0]},pos:{root:[0,-.02,.34]}},{t:1}]},item:{keys:[{t:0},{t:.26,rot:{aUpR:[.35,.5,-.3],aLoR:[-1.5,0,0],spine:[.22,0,0],chest:[.16,0,0],head:[.34,0,0]}},{t:.58,rot:{aUpR:[-1.15,.15,-.15],aLoR:[-1.9,0,0],spine:[-.1,0,0],chest:[-.08,0,0],head:[-.2,0,0]}},{t:.8,rot:{aUpR:[-.8,.1,-.1],aLoR:[-1.5,0,0],head:[-.1,0,0]}},{t:1}]}};function kl(i){const e=new Ms,t=new Gn;t.name="char-"+i.id;const n=Ic(),s=Pc(16765066,16777215),a=new Le(i.color),r=new Le(i.rimColor),o=i.id==="sciel",l=i.id==="lune",c=i.id==="maelle",h=o?3351322:l?1249301:8141336,u=e.tex(Ac(256,o?1201:l?1301:1401,"#cfc4ab","#191518")),d=e.tex(bo(128,909,"#6a6355")),p=e.tex(Cc(32,128)),g=e.tex(xa(64,2.2)),x=e.mat(new Et({color:11569770,roughness:.78,metalness:.05})),m=e.mat(new Et({color:a.clone().multiplyScalar(.85),roughness:.86,metalness:.06}));u&&(m.map=u);const f=e.mat(new Et({color:a.clone().multiplyScalar(o?.45:.7),roughness:.9,metalness:.05,side:qt})),M=e.mat(new Et({color:1840921,roughness:.8,metalness:.1})),w=e.mat(new Et({color:d?14209732:10130308,roughness:.36,metalness:.82}));d&&(w.map=d);const S=e.mat(new Et({color:h,roughness:.72,metalness:.08}));for(const oe of[x,m,f,M,w,S])no(oe,s);const b=(oe,A,_,k,O,z)=>{const ee=new Ye(oe,A);return ee.position.set(k[0],k[1],k[2]),O&&ee.rotation.set(O[0],O[1],O[2]),z&&ee.scale.set(z[0],z[1],z[2]),_.add(ee),ee},E=n.add("root",t,[0,0,0]),R=n.add("pelvis",E,[0,1,0]),v=n.add("spine",R,[0,.1,0]),T=n.add("chest",v,[0,.24,0]),C=n.add("neck",T,[0,.24,-.01]),P=n.add("head",C,[0,.13,.02]);if(b(e.geo(new ft(.12,.1,3,8)),m,R,[0,0,0],void 0,[1,1,.8]),b(e.geo(new ft(.13,.16,3,8)),m,v,[0,.1,0],void 0,[1,1,.76]),b(e.geo(new ft(.145,.2,3,10)),m,T,[0,.1,0],void 0,[1.04,1,.74]),b(e.geo(new Ht(.045,.055,.12,7)),x,C,[0,.05,0]),b(e.geo(new si(.115,12,10)),x,P,[0,0,0],void 0,[.9,1.05,.94]),b(e.geo(new si(.125,12,10)),S,P,[0,.018,-.012],void 0,l?[.96,1,1]:[1,.98,1.02]),o&&b(e.geo(new ft(.055,.28,3,7)),S,P,[0,-.16,-.1],[.3,0,0]),l&&b(e.geo(new ft(.05,.34,3,7)),S,P,[0,-.2,-.09],[.2,0,0]),c&&b(e.geo(new ft(.048,.16,3,7)),S,P,[0,-.1,-.11],[.45,0,0]),o){const oe=n.add("coat0",T,[0,.02,-.02],[.05,0,0]),A=n.add("coat1",oe,[0,-.42,-.01],[.04,0,0]);b(e.geo(new _t(.5,.46,2,2)),f,oe,[0,-.22,-.1]),b(e.geo(new _t(.44,.48,2,2)),f,A,[0,-.24,-.1]),b(e.geo(new Ht(.16,.24,.5,10,1,!0)),f,R,[0,-.2,0])}else if(l){b(e.geo(new Ht(.15,.3,.66,12,1,!0)),f,R,[0,-.26,0]);const oe=n.add("coat0",T,[0,.04,-.03],[.06,0,0]);b(e.geo(new _t(.42,.6,2,2)),f,oe,[0,-.3,-.08])}else{b(e.geo(new Zt(.26,.28,.14)),w,T,[0,.1,.09],[.05,0,0]),b(e.geo(new Ht(.15,.19,.2,10)),w,R,[0,-.04,0]);const oe=n.add("coat0",R,[0,-.1,-.04],[.04,0,0]);b(e.geo(new _t(.34,.36,2,2)),f,oe,[0,-.18,-.06])}const L=e.geo(new ft(.048,.22,3,7)),q=e.geo(new ft(.04,.2,3,7)),Z=e.geo(new Zt(.062,.1,.05)),N=(oe,A,_,k)=>{const O=n.add(oe,T,[k*.175,.17,0],[.08,0,k*-.14]),z=n.add(A,O,[0,-.3,0],[-.2,0,0]),ee=n.add(_,z,[0,-.28,0]);return b(L,m,O,[0,-.14,0]),b(q,c?w:m,z,[0,-.13,0]),b(Z,x,ee,[0,-.05,0]),c&&b(e.geo(new si(.062,8,6)),w,O,[0,-.01,0],void 0,[1,.75,1]),ee},X=N("aUpR","aLoR","handR",1);N("aUpL","aLoL","handL",-1);const G=e.geo(new ft(.062,.3,3,7)),j=e.geo(new ft(.05,.3,3,7)),se=e.geo(new Zt(.085,.06,.2)),pe=(oe,A,_,k)=>{const O=n.add(oe,R,[k*.095,-.08,0],[.03,0,k*.03]),z=n.add(A,O,[0,-.44,0],[-.05,0,0]),ee=n.add(_,z,[0,-.42,0],[.02,0,0]);b(G,l?f:M,O,[0,-.21,0]),b(j,c?w:M,z,[0,-.2,0]),b(se,M,ee,[0,-.03,.04])};pe("thighR","shinR","footR",1),pe("thighL","shinL","footL",-1);const re=new st;X.add(re);const Me=new st,Be=li(e,a.getHex(),p,.85),tt=[];let qe=null;if(o){re.rotation.set(-1.85,0,.12),b(e.geo(new Ht(.022,.026,1.16,6)),M,re,[0,.42,0]),b(e.geo(new Si(.34,.022,4,14,2.1)),w,re,[0,.96,0],[Math.PI/2,0,-.6]).scale.set(1,1,2.6);const A=new Ye(e.geo(new _t(.22,.86)),Be.mat);A.position.set(.16,.98,0),A.rotation.set(0,Math.PI/2,.5),re.add(A),Me.position.set(.3,1.24,0)}else if(l){re.rotation.set(-.32,0,.08),b(e.geo(new Ht(.02,.024,1.5,6)),M,re,[0,.6,0]),b(e.geo(new Si(.1,.018,4,12)),w,re,[0,1.36,0],[Math.PI/2,0,0]);const oe=e.mat(new Et({color:a.clone().multiplyScalar(.3),roughness:.2,metalness:.4,emissive:a.clone(),emissiveIntensity:2.2}));no(oe,s),qe=b(e.geo(new Qi(.06,1)),oe,re,[0,1.36,0]);const A=new Ye(e.geo(new _t(.34,.34)),Be.mat);A.position.set(0,1.36,0),re.add(A);for(let _=0;_<2;_++){const k=new st;k.position.set(0,1.36,0),re.add(k);const O=b(e.geo(new Si(.075,.01,3,10)),w,k,[.17,0,0],[_===0?.6:-.8,.4,0]);O.name="orbit"+_,tt.push(k)}Me.position.set(0,1.46,0)}else{re.rotation.set(-1.95,0,.08),b(e.geo(new Ht(.018,.022,.22,6)),M,re,[0,-.06,0]),b(e.geo(new Zt(.2,.03,.05)),w,re,[0,.06,0]),b(e.geo(new Ht(.014,.036,1,4)),w,re,[0,.57,0],[0,Math.PI/4,0]).scale.set(1,1,.4);const A=new Ye(e.geo(new _t(.2,1.1)),Be.mat);A.position.set(0,.58,0),re.add(A);const _=new Ye(e.geo(new _t(.2,1.1)),Be.mat);_.position.set(0,.58,0),_.rotation.y=Math.PI/2,re.add(_),Me.position.set(0,1.1,0)}re.add(Me);const $=Lc(e,r.getHex(),0,2.6),le=new Ye(e.geo(new ft(.17,.34,4,12)),$.mat);le.position.y=.06,le.scale.set(1.1,1.1,.95),T.add(le);const ie=new Ye(e.geo(new si(.14,12,10)),$.mat);ie.scale.set(.98,1.06,1),P.add(ie);const Ie=li(e,r.getHex(),g,0),ke=new Ye(e.geo(new _t(1.1,1.1)),Ie.mat);ke.rotation.x=-Math.PI/2,ke.position.y=.02,E.add(ke);const Ae=new st;Ae.position.set(0,.16,0),P.add(Ae);const nt=new st;nt.position.set(0,.1,.12),T.add(nt);let De=null,Ke=0,Ze=1,He=0,rt="none",mt=0,gt=0,Mt=!1,it=0,ot=!1,D=0;const Lt={none:r.getHex(),offensive:16738856,defensive:5809919,virtuose:16765514};return{group:t,anchors:{chest:nt,weaponTip:Me,head:Ae},update(oe,A){const _=un(A,0,.1);s.uTime.value=oe,He*=Math.exp(-_*8),s.uFlash.value=He;let k=0;De&&(Ke+=_/Ze,Ke>=1?(De=null,Ke=0):k=Uc(Ke)),n.reset();const O=1-D,z=(1-.72*k)*O,ee=Math.sin(oe*1.5+(l?1.2:o?.4:2.3)),te=n.joints;te.spine.rotation.x+=ee*.03*z,te.chest.rotation.x+=ee*.035*z,te.chest.rotation.y+=Math.sin(oe*.6)*.05*z,te.head.rotation.y+=Math.sin(oe*.42+1)*.14*z,te.head.rotation.x+=Math.sin(oe*1.1)*.025*z,te.aUpR.rotation.x+=Math.sin(oe*1)*.05*z,te.aUpR.rotation.z+=Math.sin(oe*.7)*.03*z,te.aUpL.rotation.x+=Math.sin(oe*1+2.2)*.05*z,te.aUpL.rotation.z+=-Math.sin(oe*.72+1)*.03*z,te.pelvis.rotation.y+=Math.sin(oe*.55)*.04*z,te.root.position.y+=ee*.008*z,De&&!ot&&Dc(n,De,Ke,k),te.coat0&&(te.coat0.rotation.x+=Math.sin(oe*1.3)*.05*(1+k*1.6),te.coat0.rotation.z+=Math.sin(oe*.95)*.03),te.coat1&&(te.coat1.rotation.x+=Math.sin(oe*1.3-.8)*.08*(1+k*1.6),te.coat1.rotation.z+=Math.sin(oe*1+1.2)*.05),it=bi(it,Mt&&!ot?1:0,5,_),te.root.position.z+=it*.45,te.pelvis.rotation.x+=it*.06,D=bi(D,ot?1:0,ot?3.2:5,_),D>.001&&(te.root.rotation.x-=D*1.42,te.root.position.y-=D*.1,te.spine.rotation.x+=D*.28,te.head.rotation.x+=D*.4,te.aUpR.rotation.z+=D*.5,te.aUpL.rotation.z-=D*.5,te.thighR.rotation.x+=D*.35,te.thighL.rotation.x+=D*.2),gt=bi(gt,mt*O,5,_);const K=rt==="virtuose"?.28*(.5+.5*Math.sin(oe*5.2)):rt==="offensive"?.08*Math.sin(oe*3.4):0;$.uIntensity.value=Math.max(0,gt+K+He*.6),$.uPower.value=rt==="defensive"?3.4:rt==="virtuose"?2:2.6,Be.uPulse.value=(.3+.2*Math.sin(oe*2.4)+k*.9)*O,Be.uOpacity.value=.85*O,Ie.uOpacity.value=it*.5*O,Ie.uPulse.value=.4+.3*Math.sin(oe*2.2),ke.scale.setScalar(.9+.1*Math.sin(oe*2.2));for(let J=0;J<tt.length;J++)tt[J].rotation.y=oe*(J===0?1.6:-1.15)+J*2.1,tt[J].rotation.z=Math.sin(oe*.8+J)*.4;qe&&(qe.rotation.y+=_*1.2,qe.rotation.x+=_*.6)},hitFlash(oe){He=Math.max(He,un(oe,0,1))},playAttack(oe,A){if(ot)return;const _=ng[oe];_&&(De=_,Ke=0,Ze=Math.max(.2,A/1e3))},setStance(oe){rt=oe,$.uColor.value.setHex(Lt[oe]??r.getHex()),mt=oe==="none"?.1:oe==="defensive"?.42:oe==="offensive"?.55:.75},setActive(oe){Mt=oe},setDead(oe){ot=oe,oe&&(De=null,Ke=0)},dispose(){Ss(t),e.dispose(),tt.length=0}}}const Nl={physical:[16770752,12618320,0,.42],fire:[16756778,14035474,1,.62],ice:[10149119,4881110,2,.7],lightning:[16773792,9071871,3,.34],earth:[13148266,5913122,4,.72],light:[16774872,16761418,5,.6],dark:[11562239,2756672,6,.68]};function ig(){const i=new Ms,e=new Gn;e.name="fx";const t=i.tex(xa(64,2)),n=i.tex(Rc(64,2024)),s=i.tex($m(256,.14)),a=14,r=56,o=[];for(let f=0;f<3;f++){const M=Ma(5e3+f*37),w=new Float32Array(r*3),S=new Float32Array(r*3),b=new Float32Array(r),E=new Float32Array(r);for(let v=0;v<r;v++){const T=M()*Math.PI*2,C=Math.acos(2*M()-1);w[v*3]=Math.sin(C)*Math.cos(T),w[v*3+1]=Math.cos(C),w[v*3+2]=Math.sin(C)*Math.sin(T),b[v]=M(),E[v]=.5+M()*1.3}const R=i.geo(new Pt);R.setAttribute("position",new Dt(S,3)),R.setAttribute("aDir",new Dt(w,3)),R.setAttribute("aSeed",new Dt(b,1)),R.setAttribute("aScale",new Dt(E,1)),R.boundingSphere=new Ji(new I(0,0,0),6),o.push(R)}const l=["attribute vec3 aDir;","attribute float aSeed;","attribute float aScale;","uniform float uProgress;","uniform float uScale;","uniform float uForm;","uniform float uSize;","varying float vSeed;","varying float vFade;","void main(){","  vSeed = aSeed;","  float p = clamp(uProgress, 0.0, 1.0);","  float ease = 1.0 - pow(1.0 - p, 2.6);","  vec3 dir = aDir;","  float r = uScale * ease * mix(0.7, 1.5, aSeed);","  vec3 q = dir * r;","  float sz = 1.0;","  if (uForm < 0.5) {","    q = dir * r * 0.6; q.y -= p * p * uScale * 0.9; sz = 1.0 - p * 0.4;","  } else if (uForm < 1.5) {","    q = dir * r * vec3(0.75, 0.4, 0.75); q.y += ease * uScale * 1.5 * mix(0.6, 1.4, aSeed);","    q.xz *= 1.0 - p * 0.35; sz = 1.2 - p * 0.5;","  } else if (uForm < 2.5) {","    float sp = pow(p, 0.7);","    q = dir * uScale * sp * mix(0.8, 1.8, aSeed);","    q.y += sp * uScale * 0.35; sz = 1.1 - p * 0.75;","  } else if (uForm < 3.5) {","    float sp = pow(p, 0.35);","    q = dir * uScale * sp * 1.4;","    q += dir.zxy * sin(p * 60.0 + aSeed * 30.0) * uScale * 0.14;","    sz = 1.3 - p * 0.9;","  } else if (uForm < 4.5) {","    q = dir * r * vec3(1.35, 0.25, 1.35);","    q.y += (p * 1.6 - p * p * 3.2) * uScale * 0.55 + 0.05;","    sz = 1.2 - p * 0.4;","  } else if (uForm < 5.5) {","    q = dir * r * 1.15;","    q.y += ease * uScale * 0.9 * step(0.55, aSeed);","    sz = 1.15 - p * 0.65;","  } else {","    float inv = 1.0 - ease;","    float a = p * 6.0 + aSeed * 6.28;","    q = vec3(dir.x * cos(a) - dir.z * sin(a), dir.y, dir.x * sin(a) + dir.z * cos(a)) * uScale * (0.25 + inv * 1.25);","    sz = 0.9 + p * 0.5;","  }","  vFade = sz;","  vec4 mv = modelViewMatrix * vec4(q, 1.0);","  gl_PointSize = clamp(uSize * aScale * max(0.1, sz) * (1.8 / max(0.6, -mv.z)), 1.0, 22.0);","  gl_Position = projectionMatrix * mv;","}"].join(`
`),c=["uniform vec3 uColorA;","uniform vec3 uColorB;","uniform float uOpacity;","uniform float uProgress;","uniform sampler2D uMap;","varying float vSeed;","varying float vFade;","void main(){","  float a = texture2D(uMap, gl_PointCoord).r;","  float life = pow(1.0 - clamp(uProgress, 0.0, 1.0), 1.4);","  float al = a * life * uOpacity * max(0.0, vFade);","  if (al < 0.01) discard;","  vec3 c = mix(uColorA, uColorB, fract(vSeed * 5.31));","  gl_FragColor = vec4(c * (1.0 + life * 0.8), al);","}"].join(`
`),h=[];for(let f=0;f<a;f++){const M={uProgress:{value:0},uScale:{value:1},uForm:{value:0},uSize:{value:26},uOpacity:{value:1},uColorA:{value:new Le(16777215)},uColorB:{value:new Le(16755268)}},w={uProgress:M.uProgress,uScale:M.uScale,uForm:M.uForm,uSize:M.uSize,uOpacity:M.uOpacity,uColorA:M.uColorA,uColorB:M.uColorB,uMap:{value:f%2===0?t:n}},S=i.mat(new $t({uniforms:w,vertexShader:l,fragmentShader:c,transparent:!0,depthWrite:!1,blending:qi,toneMapped:!1})),b=new Kr(o[f%o.length],S);b.frustumCulled=!1,b.visible=!1,e.add(b),h.push({points:b,u:M,active:!1,life:0,dur:.5})}const u=10,d=i.geo(new _t(1,1)),p=[];for(let f=0;f<u;f++){const M=li(i,16777215,s,0),w=new Ye(d,M.mat);w.rotation.x=-Math.PI/2,w.visible=!1,e.add(w),p.push({mesh:w,glow:M,active:!1,life:0,dur:.5,from:.2,to:3,tilt:!1})}const g=()=>{for(let M=0;M<h.length;M++)if(!h[M].active)return h[M];let f=h[0];for(let M=1;M<h.length;M++)h[M].life/h[M].dur>f.life/f.dur&&(f=h[M]);return f},x=()=>{for(let M=0;M<p.length;M++)if(!p[M].active)return p[M];let f=p[0];for(let M=1;M<p.length;M++)p[M].life/p[M].dur>f.life/f.dur&&(f=p[M]);return f},m=(f,M,w,S,b)=>{const E=x();E.active=!0,E.life=0,E.dur=S,E.from=w*.25,E.to=w*2.4,E.tilt=b,E.mesh.visible=!0,E.mesh.position.copy(f),E.mesh.position.y+=.03,E.mesh.rotation.set(b?-Math.PI/2+.35:-Math.PI/2,0,0),E.mesh.scale.setScalar(E.from),E.glow.uColor.value.setHex(M),E.glow.uOpacity.value=1,E.glow.uPulse.value=1.4};return{group:e,update(f,M){const w=un(M,0,.1);for(let S=0;S<h.length;S++){const b=h[S];if(!b.active)continue;b.life+=w;const E=b.life/b.dur;if(E>=1){b.active=!1,b.points.visible=!1,b.u.uProgress.value=0;continue}b.u.uProgress.value=E}for(let S=0;S<p.length;S++){const b=p[S];if(!b.active)continue;b.life+=w;const E=b.life/b.dur;if(E>=1){b.active=!1,b.mesh.visible=!1,b.glow.uOpacity.value=0;continue}const R=1-Math.pow(1-E,2.4);b.mesh.scale.setScalar(aa(b.from,b.to,R)),b.glow.uOpacity.value=Math.pow(1-E,1.5),b.glow.uPulse.value=.5+1.2*(1-E)}},burst(f,M,w){const S=Nl[M]??Nl.physical,b=g();b.active=!0,b.life=0,b.dur=S[3],b.points.visible=!0,b.points.position.copy(f),b.points.rotation.y=(f.x*7.13+f.z*3.71)%6.283,b.u.uProgress.value=0,b.u.uScale.value=Math.max(.05,w),b.u.uForm.value=S[2],b.u.uOpacity.value=1,b.u.uSize.value=M==="ice"?20:M==="earth"?30:26,b.u.uColorA.value.setHex(S[0]),b.u.uColorB.value.setHex(S[1]),(M==="fire"||M==="earth"||M==="light")&&m(f,S[0],w*.9,.5,!1)},ring(f,M,w){m(f,M,w,.55,!1)},perfectRing(f){m(f,16765514,1.25,.42,!1),m(f,16773824,.8,.6,!0);const M=g();M.active=!0,M.life=0,M.dur=.45,M.points.visible=!0,M.points.position.copy(f),M.u.uProgress.value=0,M.u.uScale.value=.9,M.u.uForm.value=5,M.u.uOpacity.value=1,M.u.uSize.value=22,M.u.uColorA.value.setHex(16775388),M.u.uColorB.value.setHex(16761418)},dispose(){Ss(e),i.dispose(),h.length=0,p.length=0}}}function sg(i){const e=i.fog,t=i.background,n=new fc(4863268,.55),s=new sd(7032888,1183242,.6),a=new hs(16763e3,2.5);a.position.set(2.2,7.2,-7),a.target.position.set(0,1.4,0);const r=new hs(9090303,.95);r.position.set(-5.5,3.2,5.5),r.target.position.set(0,1,1.5);const o=new hs(10512127,.6);o.position.set(6,2.6,2),o.target.position.set(0,1.2,0);const l=new rd(14032954,5.5,16,2);l.position.set(0,.5,-2.2),i.add(n,s,a,a.target,r,r.target,o,o.target,l);const c=new mo(3811868,.028);i.fog=c,i.background||(i.background=new Le(1840144));let h=1,u=2.5,d=.6,p=5.5,g=.028;return{update(x,m){const f=.92+.08*Math.sin(x*2.3)+.05*Math.sin(x*7.7+1.1);a.intensity=u*f,l.intensity=p*(.8+.35*Math.sin(x*1.4)+.12*Math.sin(x*5.1)),o.intensity=d*(.85+.15*Math.sin(x*.9+2));const M=x*.18;o.position.set(Math.cos(M)*6.5,2.6+Math.sin(M*1.3)*.8,Math.sin(M)*4.5),c.density=g*(.96+.06*Math.sin(x*.6))},setPhase(x){h=un(Math.round(x),1,3),h===1?(u=2.5,a.color.setHex(16763e3),d=.55,p=5,g=.028,n.intensity=.55,s.color.setHex(7032888),r.intensity=.95):h===2?(u=2.2,a.color.setHex(16757850),d=1.15,p=7,g=.033,n.intensity=.45,s.color.setHex(5913170),r.intensity=.8):(u=1.9,a.color.setHex(16747080),d=1.5,p=10,g=.04,n.intensity=.35,s.color.setHex(5906480),r.intensity=.6),i.background=new Le(h===3?2756114:h===2?2233372:1840144)},dispose(){for(const x of[n,s,a,a.target,r,r.target,o,o.target,l])x.parent&&x.parent.remove(x);n.dispose(),s.dispose(),a.dispose(),r.dispose(),o.dispose(),l.dispose(),i.fog=e,i.background=t}}}const Js={sciel:new I(-2.45,0,2.55),lune:new I(.05,0,3.35),maelle:new I(2.5,0,2.5)},Tn=new I(0,0,-4.3);class ag{renderer;scene=new Oh;camera;boss;chars={};fx=ig();arena=jm();particles=eg();lighting;fillAmbient;fillLight;frontLight;t=0;camState="intro";camOpts={};camTarget;curPos=new I;curLook=new I;curFov=42;shakeAmt=0;shakeSeed=Math.random()*100;reduceShake=!1;lowPerf=!1;timeScale=1;orbitT=0;lookMatrix=new pt;lookQuat=new wi;UP=new I(0,1,0);disposed=!1;lastW=0;lastH=0;constructor(e){const t=typeof location<"u"&&(new URLSearchParams(location.search).has("probe")||new URLSearchParams(location.search).get("debug")==="1");this.renderer=new rm({canvas:e,antialias:!0,powerPreference:"high-performance",preserveDrawingBuffer:t}),this.renderer.setClearColor(657415,1),this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=Ol,this.renderer.toneMapping=so,this.renderer.toneMappingExposure=1.5,this.camera=new rn(42,16/9,.1,220),this.scene.add(this.arena.group),this.scene.add(this.particles.group),this.scene.add(this.fx.group),this.boss=Ul(),this.boss.group.position.copy(Tn),this.scene.add(this.boss.group);for(const n of["sciel","lune","maelle"]){const s={sciel:{id:n,color:"#a97cff",rimColor:"#7f6bd8"},lune:{id:n,color:"#59c9f2",rimColor:"#4aa6e8"},maelle:{id:n,color:"#ff6f5e",rimColor:"#ffd479"}}[n],a=kl(s);a.group.position.copy(Js[n]),a.group.lookAt(Tn.x,0,Tn.z),this.scene.add(a.group),this.chars[n]=a}this.lighting=sg(this.scene),this.fillAmbient=new fc(16772829,.6),this.fillLight=new hs(16771279,.95),this.fillLight.position.set(-1.5,4.4,9.5),this.fillLight.target.position.set(0,1.3,-1.5),this.frontLight=new hs(13623551,.5),this.frontLight.position.set(4.5,2.6,7.5),this.frontLight.target.position.set(0,1.6,-3.5),this.scene.add(this.fillAmbient,this.fillLight,this.fillLight.target,this.frontLight,this.frontLight.target),this.camTarget=this.computeTarget("intro",{}),this.curPos.copy(this.camTarget.pos),this.curLook.copy(this.camTarget.look),this.curFov=this.camTarget.fov,this.applyCamera(1),this.resize()}size(){return{w:this.lastW,h:this.lastH}}resize(){const e=Math.max(320,window.innerWidth),t=Math.max(240,window.innerHeight);this.lastW=e,this.lastH=t;const n=this.lowPerf?1:Math.min(window.devicePixelRatio||1,1.75);this.renderer.setPixelRatio(n),this.renderer.setSize(e,t,!1),this.camera.aspect=e/t,this.camera.updateProjectionMatrix()}setLowPerf(e){this.lowPerf=e,this.particles.setIntensity(e?.35:1),this.renderer.shadowMap.enabled=!e,this.resize()}setReduceShake(e){this.reduceShake=e}setTimeScale(e){this.timeScale=e}shake(e){const t=this.reduceShake?e*.22:e;this.shakeAmt=Math.min(1.4,this.shakeAmt+t)}setPhase(e){this.arena.setPhase(e),this.boss.setPhase(e),this.lighting.setPhase(e),this.particles.setIntensity(this.lowPerf?.35:.8+e*.25)}setCam(e,t={}){e===this.camState&&t.shot===this.camOpts.shot&&t.focusId===this.camOpts.focusId&&t.targetId===this.camOpts.targetId||(this.camState=e,this.camOpts={...t},e==="phase"&&(this.orbitT=0),this.camTarget=this.computeTarget(e,this.camOpts))}getCamState(){return this.camState}slotOf(e){return e&&Js[e]?Js[e]:new I(0,0,2.9)}ring(e,t,n){const s=e*Math.PI/180;return new I(Math.sin(s)*t,n,-.6+Math.cos(s)*t)}computeTarget(e,t){const n=this.slotOf(t.focusId),s=Tn.clone().add(new I(0,2.3,0)),a=Tn.clone().add(new I(0,1.7,0)),r=new I(0,1.5,-.9),o=n.x>.8?1:n.x<-.8?-1:0;switch(e){case"intro":return{pos:this.ring(-62,9,1.6),look:a,fov:38,speed:1.05};case"idle":return{pos:this.ring(-8+o*7,9.3,3.7),look:new I(0,1.45,-1.2),fov:42,speed:1.9};case"command":return{pos:this.ring(-30+o*7,8.3,2.05),look:new I(.35,1.4,-1.7),fov:44,speed:1.1};case"skills":return{pos:this.ring(-26+o*7,7.5,2.4),look:new I(.4,1.5,-2),fov:42,speed:1.5};case"target":return{pos:this.ring(-9,6.4,2.7),look:s,fov:36,speed:1.8};case"aim":return{pos:this.ring(-4,5.3,2.5),look:s,fov:34,speed:2.3};case"playerAction":{const l=(t.shot||0)%4;return[{pos:this.ring(-46+o*4,7.2,1.75),look:new I(0,1.55,-2.4),fov:40,speed:2.5},{pos:this.ring(40+o*3,7.6,2.3),look:new I(0,1.5,-2.6),fov:38,speed:2.5},{pos:this.ring(-10,6.3,1),look:a,fov:44,speed:2.3},{pos:this.ring(22,8.6,4.1),look:new I(0,1.2,-2.2),fov:39,speed:2.2}][l]}case"bossAttack":{const l=this.slotOf(t.targetId||t.focusId),c=l.x>.8?1:l.x<-.8?-1:0;return{pos:this.ring(-34+c*16,7.2,2.15),look:new I(l.x*.35,1.2,-1.9),fov:41,speed:1.8}}case"counter":{const l=(t.shot||0)%4,c=this.slotOf(t.focusId),h=c.x>.8?1:c.x<-.8?-1:0;return[{pos:this.ring(-40+h*10,6.5,1.55),look:new I(c.x*.3,1.45,-2.4),fov:37,speed:2.9},{pos:this.ring(34+h*8,6.7,1.4),look:new I(c.x*.2,1.5,-2.6),fov:36,speed:2.9},{pos:this.ring(-2,5.6,1.05),look:a,fov:42,speed:2.7},{pos:this.ring(-6,9.2,3.7),look:r,fov:44,speed:1.4}][l]}case"phase":return{pos:this.ring(46,6.6,.95),look:a,fov:45,speed:1};case"victory":return{pos:this.ring(-26,5.7,1.05),look:a,fov:40,speed:.9};case"defeat":return{pos:this.ring(6,8.8,1.7),look:new I(0,.7,.8),fov:44,speed:.9};default:return{pos:this.ring(0,9.3,3.6),look:r,fov:42,speed:1.6}}}applyCamera(e){if(this.camera.position.copy(this.curPos),this.shakeAmt>5e-4){const t=this.shakeAmt,n=s=>Math.sin((this.t+this.shakeSeed)*s)*t;this.camera.position.x+=n(58.3)*.075,this.camera.position.y+=n(71.7)*.06,this.camera.position.z+=n(43.1)*.05}this.lookMatrix.lookAt(this.camera.position,this.curLook,this.UP),this.lookQuat.setFromRotationMatrix(this.lookMatrix),this.camera.quaternion.slerp(this.lookQuat,Math.min(1,Math.max(.02,e))),this.camera.fov=this.curFov,this.camera.updateProjectionMatrix()}update(e){if(this.disposed)return;const t=Math.min(.1,e/1e3*this.timeScale);if(this.t+=t,this.camState==="phase"){this.orbitT+=t;const s=.8+this.orbitT*1.05,a=Math.max(5.4,7-this.orbitT*.55);this.camTarget.pos.set(Math.sin(s)*a,.9+this.orbitT*.32,-.6+Math.cos(s)*a),this.camTarget.look.set(Tn.x,1.75,Tn.z)}const n=1-Math.exp(-this.camTarget.speed*3.1*t);this.curPos.lerp(this.camTarget.pos,n),this.curLook.lerp(this.camTarget.look,Math.min(1,n*1.25)),this.curFov+=(this.camTarget.fov-this.curFov)*Math.min(1,n*1.1),this.shakeAmt*=Math.exp(-6.4*t),this.applyCamera(Math.min(1,n*1.35)),this.arena.update(this.t,t),this.particles.update(this.t,t),this.boss.update(this.t,t);for(const s of Object.keys(this.chars))this.chars[s].update(this.t,t);this.fx.update(this.t,t),this.lighting.update(this.t,t),this.renderer.render(this.scene,this.camera)}project(e){const t=e.clone().project(this.camera);return{x:(t.x*.5+.5)*this.lastW,y:(-t.y*.5+.5)*this.lastH,visible:t.z<1&&t.x>-1.35&&t.x<1.35&&t.y>-1.4&&t.y<1.4}}anchorWorld(e,t="chest"){const n=new I;if(e==="boss")return(t==="head"?this.boss.anchors.head:this.boss.anchors.chest).getWorldPosition(n),n;const s=this.chars[e];return s?((t==="head"?s.anchors.head:t==="weapon"?s.anchors.weaponTip:s.anchors.chest).getWorldPosition(n),n):n.set(0,1.4,0)}weakPointWorld(e){const t=new I;return this.boss.anchors[e].getWorldPosition(t),t}resetActors(){this.boss.dispose(),this.scene.remove(this.boss.group);const e=Ul();e.group.position.copy(Tn),this.scene.add(e.group),this.boss=e;for(const t of Object.keys(this.chars)){this.chars[t].dispose(),this.scene.remove(this.chars[t].group);const n={sciel:{id:t,color:"#a97cff",rimColor:"#7f6bd8"},lune:{id:t,color:"#59c9f2",rimColor:"#4aa6e8"},maelle:{id:t,color:"#ff6f5e",rimColor:"#ffd479"}}[t],s=kl(n);s.group.position.copy(Js[t]),s.group.lookAt(Tn.x,0,Tn.z),this.scene.add(s.group),this.chars[t]=s}this.setPhase(1),this.shakeAmt=0,this.timeScale=1,this.camState="intro",this.camOpts={},this.camTarget=this.computeTarget("intro",{}),this.curPos.copy(this.camTarget.pos),this.curLook.copy(this.camTarget.look),this.curFov=this.camTarget.fov,this.applyCamera(1)}dispose(){this.disposed=!0,this.arena.dispose(),this.particles.dispose(),this.boss.dispose();for(const e of Object.keys(this.chars))this.chars[e].dispose();this.fx.dispose(),this.lighting.dispose(),this.scene.remove(this.fillAmbient,this.fillLight,this.fillLight.target,this.frontLight,this.frontLight.target),this.fillLight.dispose(),this.frontLight.dispose(),this.fillAmbient.dispose(),this.scene.clear(),this.renderer.dispose()}}function rg(i){return new ag(i)}const og={ui_hover:.16,ui_click:.3,ui_back:.22,ui_denied:.3,perfect_block:.85,normal_block:.6,block_fail:.5,prompt_rise:.22,hit_physical:.6,hit_fire:.6,hit_ice:.6,hit_lightning:.65,hit_earth:.6,hit_light:.55,hit_dark:.6,crit:.7,weakness:.5,heal:.5,shield_break:.7,break_gauge:.5,counter_start:.55,counter_hit:.85,boss_telegraph:.55,boss_roar:.85,phase_shift:.6,aim_shot:.6,weakpoint_break:.8,death:.7,revive:.55,victory:.7,defeat:.6,inverted_warn:.55},Yt=1e-4;function Kt(i,e,t){return i<e?e:i>t?t:i}function lg(){return new cg}class cg{ctx=null;master=null;comp=null;masterVolume=.6;muted=!1;timeScale=1;disposed=!1;ambientRunning=!1;ambientTimer=null;ambientPhase=0;windSource=null;windFilter=null;windGain=null;windLfo=null;windLfoGain=null;noiseCache={white:null,pink:null,brown:null};ensureContext(){if(this.disposed)return null;if(this.ctx)return this.ctx;const e=hg();if(!e)return null;const t=new e;this.ctx=t;const n=t.createGain();n.gain.value=this.muted?0:this.masterVolume;const s=t.createDynamicsCompressor();return s.threshold.value=-18,s.knee.value=20,s.ratio.value=6,s.attack.value=.003,s.release.value=.25,n.connect(s),s.connect(t.destination),this.master=n,this.comp=s,this.noiseCache={white:null,pink:null,brown:null},t}async unlock(){const e=this.ensureContext();if(e)try{e.state!=="running"&&await e.resume()}catch{}}play(e,t){const n=this.ensureContext();if(!n)return;n.state!=="running"&&n.resume().catch(()=>{});const s=(t?.gain??1)*og[e],a=t?.detune??0;this.runSfx(e,s,a)}startAmbient(){const e=this.ensureContext();if(!e||this.ambientRunning)return;this.ambientRunning=!0;const t=this.noiseBuffer("brown"),n=e.createBufferSource();n.buffer=t,n.loop=!0;const s=e.createBiquadFilter();s.type="lowpass",s.frequency.value=240*this.pitch(),s.Q.value=.6;const a=e.createGain();a.gain.value=0,a.gain.setTargetAtTime(this.ambientLevel(),e.currentTime,1.5);const r=e.createOscillator();r.type="sine",r.frequency.value=.08*this.timeScale;const o=e.createGain();o.gain.value=140,n.connect(s),s.connect(a),a.connect(this.master),r.connect(o),o.connect(s.frequency),n.start(),r.start(),this.windSource=n,this.windFilter=s,this.windGain=a,this.windLfo=r,this.windLfoGain=o;const l=420,c=1.3;let h=e.currentTime+.6;this.ambientTimer=setInterval(()=>{const u=this.ctx;if(!(!u||!this.ambientRunning))for(;h<u.currentTime+c;)this.paintDrop(h),h+=l/1e3*(.65+Math.random()*.9)},l)}stopAmbient(){this.teardownAmbient(!1)}teardownAmbient(e){this.ambientTimer!==null&&(clearInterval(this.ambientTimer),this.ambientTimer=null);const t=this.ctx,n=t?t.currentTime:0;if(t&&this.windGain&&!e){const a=this.windGain;a.gain.cancelScheduledValues(n),a.gain.setValueAtTime(a.gain.value,n),a.gain.setTargetAtTime(0,n,.4)}const s=e?n:n+1.2;if(t&&this.windSource)try{this.windSource.stop(s)}catch{}if(t&&this.windLfo)try{this.windLfo.stop(s)}catch{}if(e){for(const a of[this.windSource,this.windFilter,this.windGain,this.windLfo,this.windLfoGain])if(a)try{a.disconnect()}catch{}}this.windSource=null,this.windFilter=null,this.windGain=null,this.windLfo=null,this.windLfoGain=null,this.ambientRunning=!1}setPhase(e){this.ambientPhase=e,this.ctx&&this.windGain&&this.windGain.gain.setTargetAtTime(this.ambientLevel(),this.ctx.currentTime,1)}setMasterVolume(e){this.masterVolume=Kt(e,0,1),this.applyMasterGain()}getMasterVolume(){return this.masterVolume}setMuted(e){this.muted=e,this.applyMasterGain()}isMuted(){return this.muted}setTimeScale(e){this.timeScale=Kt(e,.05,4);const t=this.ctx;t&&(this.windLfo&&this.windLfo.frequency.setTargetAtTime(.08*this.timeScale,t.currentTime,.1),this.windFilter&&this.windFilter.frequency.setTargetAtTime(240*this.pitch(),t.currentTime,.15))}pitch(){return Kt(this.timeScale,.25,2)}suspend(){this.ctx&&this.ctx.state==="running"&&this.ctx.suspend().catch(()=>{})}resume(){this.ctx&&this.ctx.state==="suspended"&&this.ctx.resume().catch(()=>{})}dispose(){if(this.teardownAmbient(!0),this.disposed=!0,this.master)try{this.master.disconnect()}catch{}if(this.comp)try{this.comp.disconnect()}catch{}if(this.ctx){const e=this.ctx;this.ctx=null,e.state!=="closed"&&e.close().catch(()=>{})}this.master=null,this.comp=null,this.noiseCache={white:null,pink:null,brown:null}}applyMasterGain(){if(this.master&&this.ctx){const e=this.muted?0:this.masterVolume;this.master.gain.setTargetAtTime(e,this.ctx.currentTime,.02)}}ambientLevel(){return .05+Kt(this.ambientPhase,0,5)*.02}paintDrop(e){const t=this.ctx;if(!t||!this.master)return;const n=this.pitch(),s=t.createOscillator();s.type="sine",s.frequency.setValueAtTime((520+Math.random()*420)*n,e),s.frequency.exponentialRampToValueAtTime(180*n,e+.16);const a=t.createGain();a.gain.setValueAtTime(Yt,e),a.gain.exponentialRampToValueAtTime(.06,e+.012),a.gain.exponentialRampToValueAtTime(Yt,e+.22),s.connect(a),a.connect(this.master),s.start(e),s.stop(e+.26)}noiseBuffer(e){const t=this.ctx,n=this.noiseCache[e];if(n)return n;const s=Math.floor(t.sampleRate*2),a=t.createBuffer(1,s,t.sampleRate),r=a.getChannelData(0);if(e==="white")for(let o=0;o<s;o++)r[o]=Math.random()*2-1;else if(e==="pink"){let o=0,l=0,c=0,h=0,u=0,d=0,p=0;for(let g=0;g<s;g++){const x=Math.random()*2-1;o=.99886*o+x*.0555179,l=.99332*l+x*.0750759,c=.969*c+x*.153852,h=.8665*h+x*.3104856,u=.55*u+x*.5329522,d=-.7616*d-x*.016898,r[g]=(o+l+c+h+u+d+p+x*.5362)*.11,p=x*.115926}}else{let o=0;for(let l=0;l<s;l++){const c=Math.random()*2-1;o=(o+.02*c)/1.02,r[l]=o*3.5}}return this.noiseCache[e]=a,a}tone(e){const t=this.ctx;if(!t||!this.master)return;const n=e.when??t.currentTime,s=t.createOscillator();s.type=e.type;const a=this.pitch(),r=Kt(e.freq*a,1,2e4)*Math.pow(2,(e.detuneCents??0)/1200);s.frequency.setValueAtTime(r,n),e.endFreq!==void 0&&e.endFreq!==e.freq&&s.frequency.exponentialRampToValueAtTime(Kt(e.endFreq*a,1,2e4),n+e.attack+e.decay);const o=t.createGain();o.gain.setValueAtTime(Yt,n),o.gain.exponentialRampToValueAtTime(Kt(e.gain,Yt,2),n+e.attack),o.gain.exponentialRampToValueAtTime(Yt,n+e.attack+e.decay),s.connect(o);let l=o;if(e.pan!==void 0){const c=t.createStereoPanner();c.pan.value=Kt(e.pan,-1,1),o.connect(c),l=c}l.connect(this.master),s.start(n),s.stop(n+e.attack+e.decay+.03)}noise(e){const t=this.ctx;if(!t||!this.master)return;const n=e.when??t.currentTime,s=this.pitch(),a=t.createBufferSource();a.buffer=this.noiseBuffer(e.kind),a.playbackRate.value=(e.rate??1)*s;let r=a;if(e.filterType){const l=t.createBiquadFilter();l.type=e.filterType,l.frequency.setValueAtTime(Kt((e.filterFreq??1e3)*s,1,2e4),n),l.Q.value=e.filterQ??1,e.filterEndFreq!==void 0&&e.filterEndFreq!==e.filterFreq&&l.frequency.exponentialRampToValueAtTime(Kt(e.filterEndFreq*s,1,2e4),n+e.attack+e.decay),a.connect(l),r=l}const o=t.createGain();o.gain.setValueAtTime(Yt,n),o.gain.exponentialRampToValueAtTime(Kt(e.gain,Yt,2),n+e.attack),o.gain.exponentialRampToValueAtTime(Yt,n+e.attack+e.decay),r.connect(o),o.connect(this.master),a.start(n),a.stop(n+e.attack+e.decay+.03)}fm(e){const t=this.ctx;if(!t||!this.master)return;const n=e.when??t.currentTime,s=this.pitch(),a=t.createOscillator();a.type="sine",a.frequency.value=Kt(e.carrierFreq*s,1,2e4);const r=t.createOscillator();r.type="sine",r.frequency.value=Kt(e.modFreq*s,1,2e4);const o=t.createGain();o.gain.setValueAtTime(e.modDepth*s,n),o.gain.exponentialRampToValueAtTime(Yt,n+e.attack+e.decay),r.connect(o),o.connect(a.frequency);const l=t.createGain();l.gain.setValueAtTime(Yt,n),l.gain.exponentialRampToValueAtTime(Kt(e.gain,Yt,2),n+e.attack),l.gain.exponentialRampToValueAtTime(Yt,n+e.attack+e.decay),a.connect(l),l.connect(this.master);const c=n+e.attack+e.decay+.03;a.start(n),a.stop(c),r.start(n),r.stop(c)}runSfx(e,t,n){switch(e){case"perfect_block":this.perfectBlock(t,n);break;case"normal_block":this.normalBlock(t,n);break;case"block_fail":this.blockFail(t,n);break;case"prompt_rise":this.promptRise(t,n);break;case"ui_hover":this.uiHover(t,n);break;case"ui_click":this.uiClick(t,n);break;case"ui_back":this.uiBack(t,n);break;case"ui_denied":this.uiDenied(t,n);break;case"hit_physical":this.hitPhysical(t,n);break;case"hit_fire":this.hitFire(t,n);break;case"hit_ice":this.hitIce(t,n);break;case"hit_lightning":this.hitLightning(t,n);break;case"hit_earth":this.hitEarth(t,n);break;case"hit_light":this.hitLight(t,n);break;case"hit_dark":this.hitDark(t,n);break;case"crit":this.crit(t,n);break;case"weakness":this.weakness(t,n);break;case"heal":this.heal(t,n);break;case"shield_break":this.shieldBreak(t,n);break;case"break_gauge":this.breakGauge(t,n);break;case"counter_start":this.counterStart(t,n);break;case"counter_hit":this.counterHit(t,n);break;case"boss_telegraph":this.bossTelegraph(t,n);break;case"boss_roar":this.bossRoar(t,n);break;case"phase_shift":this.phaseShift(t,n);break;case"aim_shot":this.aimShot(t,n);break;case"weakpoint_break":this.weakpointBreak(t,n);break;case"death":this.death(t,n);break;case"revive":this.revive(t,n);break;case"victory":this.victory(t,n);break;case"defeat":this.defeat(t,n);break;case"inverted_warn":this.invertedWarn(t,n);break}}perfectBlock(e,t){const n=[{ratio:1,gain:1,detune:0},{ratio:2.76,gain:.55,detune:7},{ratio:5.4,gain:.32,detune:-9},{ratio:8.3,gain:.16,detune:13}],s=4300;for(const a of n)this.tone({type:"sine",freq:s*a.ratio,detuneCents:a.detune+t,gain:.9*a.gain*e,attack:.002,decay:.5});this.fm({carrierFreq:4200,modFreq:1500,modDepth:900,gain:.35*e,attack:.002,decay:.35}),this.noise({kind:"white",filterType:"bandpass",filterFreq:7e3,filterQ:12,gain:.8*e,attack:.001,decay:.07})}normalBlock(e,t){this.tone({type:"sine",freq:400,endFreq:170,detuneCents:t,gain:.7*e,attack:.004,decay:.22}),this.tone({type:"sawtooth",freq:210,endFreq:120,detuneCents:t,gain:.18*e,attack:.004,decay:.16}),this.noise({kind:"brown",filterType:"lowpass",filterFreq:900,filterQ:.7,gain:.6*e,attack:.002,decay:.18})}blockFail(e,t){this.tone({type:"sine",freq:130,endFreq:60,detuneCents:t,gain:.8*e,attack:.004,decay:.28}),this.noise({kind:"brown",filterType:"lowpass",filterFreq:300,filterQ:.6,gain:.5*e,attack:.003,decay:.22})}promptRise(e,t){this.tone({type:"sine",freq:520,endFreq:960,detuneCents:t,gain:.5*e,attack:.05,decay:.22})}uiHover(e,t){this.tone({type:"sine",freq:1400,detuneCents:t,gain:.4*e,attack:.004,decay:.05})}uiClick(e,t){this.tone({type:"square",freq:900,endFreq:500,detuneCents:t,gain:.35*e,attack:.001,decay:.05}),this.noise({kind:"white",filterType:"highpass",filterFreq:4e3,gain:.2*e,attack:.001,decay:.02})}uiBack(e,t){this.tone({type:"sine",freq:700,endFreq:420,detuneCents:t,gain:.45*e,attack:.006,decay:.1})}uiDenied(e,t){this.tone({type:"square",freq:170,endFreq:140,detuneCents:t,gain:.5*e,attack:.004,decay:.12}),this.tone({type:"square",freq:150,detuneCents:t,gain:.4*e,attack:.004,decay:.1,when:(this.ctx?.currentTime??0)+.08})}hitPhysical(e,t){this.tone({type:"sine",freq:320,endFreq:140,detuneCents:t,gain:.75*e,attack:.003,decay:.2}),this.noise({kind:"white",filterType:"bandpass",filterFreq:950,filterQ:1.5,gain:.6*e,attack:.001,decay:.12})}hitFire(e,t){this.noise({kind:"white",filterType:"lowpass",filterFreq:3800,filterEndFreq:320,filterQ:.8,gain:.7*e,attack:.002,decay:.42}),this.tone({type:"sawtooth",freq:160,endFreq:320,detuneCents:t,gain:.3*e,attack:.02,decay:.36}),this.noise({kind:"pink",filterType:"highpass",filterFreq:3e3,gain:.2*e,attack:.001,decay:.06})}hitIce(e,t){this.tone({type:"sine",freq:2900,endFreq:2100,detuneCents:t,gain:.6*e,attack:.002,decay:.18}),this.noise({kind:"white",filterType:"bandpass",filterFreq:5600,filterQ:8,gain:.55*e,attack:.001,decay:.07});const n=this.ctx;if(n&&this.master){const s=n.currentTime,a=this.pitch(),r=n.createOscillator();r.type="sine",r.frequency.setValueAtTime(3300*a,s);const o=n.createOscillator();o.type="triangle",o.frequency.value=38;const l=n.createGain();l.gain.value=60*a,o.connect(l),l.connect(r.frequency);const c=n.createGain();c.gain.setValueAtTime(Yt,s),c.gain.exponentialRampToValueAtTime(.25*e,s+.008),c.gain.exponentialRampToValueAtTime(Yt,s+.2),r.connect(c),c.connect(this.master);const h=s+.24;r.start(s),r.stop(h),o.start(s),o.stop(h)}}hitLightning(e,t){this.tone({type:"square",freq:260,endFreq:80,detuneCents:t,gain:.5*e,attack:.001,decay:.16}),this.noise({kind:"white",filterType:"highpass",filterFreq:1500,gain:.8*e,attack:.001,decay:.05}),this.tone({type:"sine",freq:4200,detuneCents:t,gain:.3*e,attack:.001,decay:.04})}hitEarth(e,t){this.tone({type:"sine",freq:100,endFreq:45,detuneCents:t,gain:.85*e,attack:.005,decay:.4}),this.noise({kind:"brown",filterType:"lowpass",filterFreq:220,filterQ:.6,gain:.6*e,attack:.003,decay:.3})}hitLight(e,t){const s=[1,1.5,2,3],a=[.7,.3,.25,.12];s.forEach((r,o)=>{this.tone({type:"sine",freq:900*r,detuneCents:t+(o-1)*5,gain:a[o]*e,attack:.004,decay:.4})})}hitDark(e,t){this.tone({type:"sine",freq:110,endFreq:70,detuneCents:t,gain:.7*e,attack:.006,decay:.4}),this.tone({type:"sawtooth",freq:116,endFreq:74,detuneCents:t+12,gain:.25*e,attack:.006,decay:.35}),this.noise({kind:"brown",filterType:"lowpass",filterFreq:500,filterQ:.7,gain:.5*e,attack:.004,decay:.3})}crit(e,t){this.tone({type:"sine",freq:1300,endFreq:2500,detuneCents:t,gain:.6*e,attack:.008,decay:.28}),this.tone({type:"sine",freq:5200,detuneCents:t+20,gain:.3*e,attack:.002,decay:.18}),this.noise({kind:"white",filterType:"highpass",filterFreq:6e3,gain:.18*e,attack:.001,decay:.05})}weakness(e,t){const n=this.ctx,s=n?n.currentTime:0;[660,880,1320].forEach((r,o)=>{this.tone({type:"sine",freq:r,detuneCents:t,gain:.5*e,attack:.006,decay:.16,when:s+o*.07})})}heal(e,t){[392,494,587,784].forEach((s,a)=>{this.tone({type:a===0?"triangle":"sine",freq:s,detuneCents:t,gain:(a===0?.55:.3)*e,attack:.15,decay:.9})})}shieldBreak(e,t){this.noise({kind:"white",filterType:"highpass",filterFreq:2500,gain:.85*e,attack:.001,decay:.2}),this.noise({kind:"pink",filterType:"bandpass",filterFreq:4e3,filterQ:4,gain:.4*e,attack:.001,decay:.1}),this.tone({type:"sine",freq:2600,endFreq:1800,detuneCents:t,gain:.5*e,attack:.004,decay:.7}),this.tone({type:"sine",freq:3900,detuneCents:t+9,gain:.25*e,attack:.004,decay:.5})}breakGauge(e,t){this.tone({type:"sawtooth",freq:400,endFreq:1100,detuneCents:t,gain:.35*e,attack:.1,decay:.4}),this.noise({kind:"white",filterType:"bandpass",filterFreq:2e3,filterQ:3,gain:.3*e,attack:.05,decay:.2}),this.tone({type:"square",freq:880,detuneCents:t,gain:.2*e,attack:.01,decay:.08,when:(this.ctx?.currentTime??0)+.12})}counterStart(e,t){this.noise({kind:"pink",filterType:"bandpass",filterFreq:600,filterEndFreq:3200,filterQ:2,gain:.6*e,attack:.03,decay:.3}),this.tone({type:"sine",freq:1500,detuneCents:t,gain:.45*e,attack:.003,decay:.25}),this.tone({type:"sine",freq:520,endFreq:1100,detuneCents:t,gain:.3*e,attack:.04,decay:.24})}counterHit(e,t){this.tone({type:"sine",freq:200,endFreq:60,detuneCents:t,gain:.85*e,attack:.003,decay:.4}),this.tone({type:"sine",freq:960,detuneCents:t,gain:.5*e,attack:.002,decay:.45}),this.tone({type:"sine",freq:960*2.3,detuneCents:t+12,gain:.22*e,attack:.002,decay:.35}),this.noise({kind:"white",filterType:"bandpass",filterFreq:3e3,filterQ:2,gain:.6*e,attack:.001,decay:.08}),this.noise({kind:"pink",filterType:"lowpass",filterFreq:2e3,gain:.25*e,attack:.002,decay:.12})}bossTelegraph(e,t){this.tone({type:"sawtooth",freq:74,endFreq:60,detuneCents:t,gain:.6*e,attack:.3,decay:1.3}),this.tone({type:"sine",freq:84,detuneCents:t+6,gain:.35*e,attack:.3,decay:1.3}),this.noise({kind:"brown",filterType:"lowpass",filterFreq:180,filterQ:.6,gain:.45*e,attack:.25,decay:1.2})}bossRoar(e,t){this.tone({type:"sawtooth",freq:66,endFreq:50,detuneCents:t,gain:.5*e,attack:.06,decay:1.4}),this.tone({type:"sawtooth",freq:70,endFreq:53,detuneCents:t+15,gain:.4*e,attack:.06,decay:1.4}),this.tone({type:"sine",freq:42,endFreq:33,detuneCents:t,gain:.7*e,attack:.04,decay:1.5}),this.noise({kind:"brown",filterType:"lowpass",filterFreq:900,filterEndFreq:220,filterQ:.8,gain:.6*e,attack:.04,decay:1.2})}phaseShift(e,t){this.noise({kind:"pink",filterType:"bandpass",filterFreq:300,filterEndFreq:4200,filterQ:2,gain:.55*e,attack:.2,decay:.9}),this.tone({type:"triangle",freq:220,endFreq:880,detuneCents:t,gain:.45*e,attack:.25,decay:.9}),this.tone({type:"sine",freq:1760,detuneCents:t+10,gain:.2*e,attack:.6,decay:.8})}aimShot(e,t){this.tone({type:"sine",freq:500,endFreq:2e3,detuneCents:t,gain:.5*e,attack:.08,decay:.22}),this.tone({type:"sine",freq:2e3,endFreq:700,detuneCents:t,gain:.35*e,attack:.03,decay:.24,when:(this.ctx?.currentTime??0)+.3}),this.noise({kind:"pink",filterType:"bandpass",filterFreq:1500,filterQ:2,gain:.2*e,attack:.05,decay:.3})}weakpointBreak(e,t){this.noise({kind:"white",filterType:"highpass",filterFreq:2200,gain:.8*e,attack:.001,decay:.16}),this.tone({type:"sine",freq:2800,endFreq:1900,detuneCents:t,gain:.55*e,attack:.003,decay:.7}),this.tone({type:"sine",freq:2800*2.4,detuneCents:t+14,gain:.25*e,attack:.003,decay:.5}),this.noise({kind:"white",filterType:"bandpass",filterFreq:5200,filterQ:10,gain:.4*e,attack:.001,decay:.07})}death(e,t){this.tone({type:"sawtooth",freq:240,endFreq:42,detuneCents:t,gain:.55*e,attack:.02,decay:2}),this.tone({type:"sine",freq:120,endFreq:38,detuneCents:t,gain:.5*e,attack:.02,decay:2.1}),this.noise({kind:"brown",filterType:"lowpass",filterFreq:400,filterEndFreq:120,filterQ:.6,gain:.35*e,attack:.02,decay:1.6})}revive(e,t){this.tone({type:"triangle",freq:220,endFreq:780,detuneCents:t,gain:.5*e,attack:.3,decay:1}),this.tone({type:"sine",freq:523,detuneCents:t,gain:.3*e,attack:.6,decay:.9}),this.tone({type:"sine",freq:659,detuneCents:t,gain:.25*e,attack:.7,decay:.9})}victory(e,t){const n=this.ctx,s=n?n.currentTime:0;[[523.25,0],[659.25,.16],[783.99,.32],[1046.5,.48]].forEach(([r,o])=>{this.tone({type:"sine",freq:r,detuneCents:t,gain:.5*e,attack:.02,decay:.7,when:s+o}),this.tone({type:"triangle",freq:r*2,detuneCents:t,gain:.2*e,attack:.02,decay:.5,when:s+o})}),[523.25,659.25,783.99,1046.5].forEach(r=>{this.tone({type:"sine",freq:r,detuneCents:t,gain:.3*e,attack:.08,decay:1.1,when:s+1.1})}),this.tone({type:"sine",freq:2093,detuneCents:t+15,gain:.15*e,attack:.05,decay:1,when:s+1.2})}defeat(e,t){const n=this.ctx,s=n?n.currentTime:0;[[392,0],[330,.4],[262,.8],[196,1.2]].forEach(([r,o])=>{this.tone({type:"sine",freq:r,detuneCents:t,gain:.45*e,attack:.03,decay:.9,when:s+o}),this.tone({type:"triangle",freq:r/2,detuneCents:t,gain:.2*e,attack:.03,decay:.9,when:s+o})}),this.tone({type:"sine",freq:65,detuneCents:t,gain:.35*e,attack:.4,decay:2}),this.noise({kind:"brown",filterType:"lowpass",filterFreq:200,gain:.2*e,attack:.4,decay:1.6})}invertedWarn(e,t){const n=this.ctx,s=n?n.currentTime:0;for(let a=0;a<4;a++){const r=a%2===0?1760:1320;this.tone({type:"square",freq:r,detuneCents:t,gain:.4*e,attack:.004,decay:.1,when:s+a*.16}),this.tone({type:"sine",freq:r*1.5,detuneCents:t+8,gain:.15*e,attack:.004,decay:.09,when:s+a*.16})}}}function hg(){try{if(typeof AudioContext<"u")return AudioContext}catch{}try{const i=globalThis;if(typeof i.webkitAudioContext=="function")return i.webkitAudioContext}catch{}}function H(i,e,t){const n=document.createElement(i);return e&&(n.className=e),t!==void 0&&(n.textContent=t),n}function Ut(i){for(;i.firstChild;)i.removeChild(i.firstChild)}function os(i,e){i.textContent!==e&&(i.textContent=e)}function Fn(i,e,t){i.classList.toggle(e,t)}const kc={physical:"#e9e0d1",fire:"#ff6a3c",ice:"#7fd4f0",lightning:"#ffe04b",earth:"#8ddc7f",light:"#fff3cf",dark:"#b483ff"},dg={physical:"物理",fire:"火",ice:"冰",lightning:"雷",earth:"土",light:"光",dark:"暗"},sr={enemy:"单体",enemyAll:"敌方全体",ally:"单个友方",allyAll:"全体友方",deadAlly:"倒下的友方",self:"自身",field:"全场光环"},Fl={none:"无姿态",offensive:"攻",defensive:"守",virtuose:"高手"};class ug{root;hooks;bossHud;bossBar;bossGhost;bossName;breakBar;breakText;bossStatus;timeline;party;center;moveSide;moveName;moveHint;segProgress;judgeEl;commandEl;skillsEl;tooltip;markerLayer;dmgLayer;qteLayer;aimLayer;reticle;logEl;screens;debugEl;settingsEl;hudGroups=[];dimGroups=[];dmgPool=[];dmgActive=[];rings=new Map;pcNodes={};markerNodes=new Map;wpNodes=new Map;aimExit=null;judgeTimer=0;logLines=0;mouse={x:0,y:0};lastCommandKey="";lastSkillKey="";constructor(e,t){this.root=e,this.hooks=t,this.build(),window.addEventListener("mousemove",n=>{this.mouse.x=n.clientX,this.mouse.y=n.clientY})}build(){Ut(this.root);const e=H("div");e.id="boss-hud";const t=H("div");t.id="boss-bar-wrap",this.bossGhost=H("div"),this.bossGhost.id="boss-bar-ghost",this.bossBar=H("div"),this.bossBar.id="boss-bar",t.append(this.bossGhost,this.bossBar);for(const u of[68,32]){const d=H("div","phase-tick");d.style.left=u+"%",d.append(H("span",void 0,u+"%")),t.append(d)}this.bossName=H("div",void 0,"四手剑客"),this.bossName.id="boss-name";const n=H("div",void 0,"THE FOUR-ARMED SWORDSMAN");n.id="boss-sub";const s=H("div");s.id="break-wrap";const a=H("div");a.id="break-label",this.breakText=H("span",void 0,"0 / 100"),a.append(H("span",void 0,"破防槽"),this.breakText);const r=H("div");r.id="break-bar-wrap",this.breakBar=H("div"),this.breakBar.id="break-bar",r.append(this.breakBar),s.append(a,r),this.bossStatus=H("div"),this.bossStatus.id="boss-status",e.append(t,this.bossName,n,s,this.bossStatus),this.bossHud=e,this.timeline=H("div"),this.timeline.id="timeline";const o=H("div",void 0,"行动顺序");o.id="timeline-title",this.timeline.append(o),this.party=H("div"),this.party.id="party",this.center=H("div"),this.center.id="center",this.moveName=H("div"),this.moveName.id="move-name",this.center.append(this.moveName),this.moveSide=H("div"),this.moveSide.id="move-side";const l=H("div","ms-title","防御");this.moveHint=H("div"),this.moveHint.id="move-hint",this.segProgress=H("div"),this.segProgress.id="seg-progress",this.moveSide.append(l,this.moveHint,this.segProgress),this.judgeEl=H("div"),this.judgeEl.id="judge",this.commandEl=H("div"),this.commandEl.id="command",this.commandEl.classList.add("hidden"),this.skillsEl=H("div"),this.skillsEl.id="skills",this.skillsEl.classList.add("hidden"),this.tooltip=H("div"),this.tooltip.id="tooltip",this.tooltip.classList.add("hidden"),this.markerLayer=H("div"),this.markerLayer.id="marker-layer",this.dmgLayer=H("div"),this.dmgLayer.id="dmg-layer",this.qteLayer=H("div"),this.qteLayer.id="qte-layer",this.aimLayer=H("div"),this.aimLayer.id="aim-layer",this.aimLayer.classList.add("hidden"),this.reticle=H("div"),this.reticle.id="reticle",this.reticle.append(H("div","r1"),H("div","r2")),this.aimLayer.append(this.reticle),this.logEl=H("div"),this.logEl.id="log",this.settingsEl=H("div"),this.settingsEl.id="settings";const c=(u,d,p)=>{const g=H("button","mini",u);return p&&(g.id=p),g.addEventListener("click",d),g},h=H("input");h.id="volume",h.type="range",h.min="0",h.max="100",h.value="60",h.addEventListener("input",()=>this.hooks.onVolume(Number(h.value)/100)),this.settingsEl.append(c("暂停 [P]",()=>this.hooks.onTogglePause(),"btn-pause"),c("静音",()=>this.hooks.onToggleMute(),"btn-mute"),h,c("减少晃动",()=>this.hooks.onToggleShake(),"btn-shake"),c("低性能",()=>this.hooks.onTogglePerf(),"btn-perf")),this.screens=H("div"),this.screens.id="screens",this.debugEl=H("div"),this.debugEl.id="debug",this.debugEl.classList.add("hidden"),this.hudGroups=[this.timeline,this.logEl],this.dimGroups=[this.bossHud],this.root.append(this.bossHud,this.timeline,this.party,this.center,this.moveSide,this.judgeEl,this.commandEl,this.skillsEl,this.markerLayer,this.qteLayer,this.dmgLayer,this.aimLayer,this.logEl,this.settingsEl,this.tooltip,this.screens,this.debugEl)}bindTip(e,t){e.addEventListener("mouseenter",()=>{this.tooltip.innerHTML=t,this.tooltip.classList.remove("hidden"),this.positionTip()}),e.addEventListener("mousemove",()=>this.positionTip()),e.addEventListener("mouseleave",()=>this.tooltip.classList.add("hidden"))}positionTip(){const t=this.tooltip.offsetWidth||240,n=this.tooltip.offsetHeight||60;let s=this.mouse.x+14,a=this.mouse.y+14;s+t>window.innerWidth-8&&(s=this.mouse.x-t-14),a+n>window.innerHeight-8&&(a=this.mouse.y-n-14),this.tooltip.style.left=Math.max(4,s)+"px",this.tooltip.style.top=Math.max(4,a)+"px"}hideTip(){this.tooltip.classList.add("hidden")}statusIcon(e){const t=ds[e.id],n=H("div","status-icon "+t.kind,t.icon);e.stacks>1&&n.append(H("b",void 0,String(e.stacks)));const s=e.turns>90?"直到清除":e.turns+" 回合";return this.bindTip(n,"<b>"+t.name+"</b>（"+(t.stacking==="stacks"?e.stacks+" 层 / ":"")+s+"）<br>"+pm(e)+'<br><i style="color:#9a8f7d">按'+(t.tickOn==="self"?"目标自身回合":"施加者回合")+"计时</i>"),n}syncBoss(e){const t=e.actors[e.bossId],n=Math.max(0,t.hp/t.maxHp);this.bossBar.style.transform="scaleX("+n+")",this.bossGhost.style.transform="scaleX("+n+")",os(this.bossName,t.name),this.breakBar.style.width=t.breakGauge/t.breakMax*100+"%",os(this.breakText,Math.floor(t.breakGauge)+" / "+t.breakMax+(t.broken?"  破防！":"")),Fn(this.bossHud,"broken",t.broken);const s=t.statuses.map(a=>a.id+a.stacks+a.turns).join(",")+(t.broken?"B":"")+t.weakPoints.map(a=>a.broken?1:0).join("");if(this.bossStatus.dataset.key!==s){if(this.bossStatus.dataset.key=s,Ut(this.bossStatus),t.broken){const a=H("div","status-icon debuff","破");this.bindTip(a,"<b>破防</b><br>受到伤害 x1.25，并失去下一次排定行动。"),this.bossStatus.append(a)}for(const a of t.statuses)this.bossStatus.append(this.statusIcon(a));for(const a of t.weakPoints){if(!a.broken)continue;const r=H("div","status-icon buff",a.id==="gold_core"?"金":"紫");this.bindTip(r,"<b>"+a.name+"已破坏</b><br>"+(a.id==="gold_core"?"着火附加能力失效 2 个 Boss 回合。":"下一次倒逆持续时间 -1。")),this.bossStatus.append(r)}}}syncTimeline(e,t){const n=e.map(a=>a.actorId+Math.round(a.at*10)+(a.kind==="extra"?"x":"")).join("|")+"#"+t.currentActorId;if(this.timeline.dataset.key===n)return;this.timeline.dataset.key=n,Ut(this.timeline);const s=H("div",void 0,"行动顺序");s.id="timeline-title",this.timeline.append(s),e.slice(0,8).forEach((a,r)=>{const o=t.actors[a.actorId];if(!o)return;const l=H("div","tl-entry"+(r===0?" now":"")+(o.kind==="boss"?" boss":"")),c=H("div","tl-face",o.portrait);c.style.color=o.color,l.append(c),a.kind==="extra"&&l.append(H("div","tl-tag",a.label||"插队")),this.bindTip(l,"<b>"+o.name+"</b><br>"+(a.kind==="extra"?"插入行动<br>":"")+"排定时刻 "+a.at.toFixed(1)+"<br>速度 "+Math.round(o.speed)),this.timeline.append(l)})}syncParty(e){if(this.party.childElementCount!==e.partyOrder.length){Ut(this.party),this.pcNodes={};for(const t of e.partyOrder){const n=e.actors[t],s=H("div","pc"),a=H("div","pc-head"),r=H("div","pc-face",n.portrait);r.style.color=n.color;const o=H("div"),l=H("div","pc-name",n.name),c=H("div","pc-role",n.role);o.append(l,c),a.append(r,o);const h=H("div","pc-hpwrap"),u=H("div","pc-hp");h.append(u);const d=H("div","pc-hptext",""),p=H("div","pc-row"),g=H("div","pc-res"),x=H("div","pc-status");s.append(a,h,d,p,g,x),this.party.append(s),this.pcNodes[t]={card:s,hp:u,hptext:d,apRow:p,res:g,stat:x,face:r}}}for(const t of e.partyOrder){const n=e.actors[t],s=this.pcNodes[t];if(!s)continue;Fn(s.card,"active",e.currentActorId===t),Fn(s.card,"dead",!n.alive);const a=Math.max(0,n.hp/n.maxHp);s.hp.style.width=a*100+"%",Fn(s.hp,"low",a<.35),os(s.hptext,Math.ceil(n.hp)+" / "+n.maxHp);const r=n.ap+"/"+n.shield;if(s.apRow.dataset.key!==r){s.apRow.dataset.key=r,Ut(s.apRow);for(let c=0;c<9;c++){const h=H("div","diamond"+(c<n.ap?" filled":""));s.apRow.append(h)}if(n.shield>0){const c=H("div","pc-shield");for(let h=0;h<n.shield;h++)c.append(H("div","shield-pip"));this.bindTip(c,"<b>护盾 "+n.shield+" 层</b><br>每层完全吸收一段命中，然后移除一层。完美格挡不消耗护盾。"),s.apRow.append(c)}}const o=this.resourceKey(n);s.res.dataset.key!==o&&(s.res.dataset.key=o,Ut(s.res),this.renderResource(n,s.res,e));const l=n.statuses.map(c=>c.id+c.stacks+c.turns).join(",");if(s.stat.dataset.key!==l){s.stat.dataset.key=l,Ut(s.stat);for(const c of n.statuses)s.stat.append(this.statusIcon(c))}}}resourceKey(e){return e.id==="sciel"?"f"+JSON.stringify(e.foretell)+e.phaseTag+e.twilightTurns:e.id==="lune"?"s"+e.stains.join(""):"st"+e.stance}renderResource(e,t,n){if(e.id==="sciel"){const r=e.phaseTag==="sun"?"旭日":e.phaseTag==="moon"?"月相":"薄暮",o=H("span","stance-tag"+(e.phaseTag==="twilight"?" stance-virtuose":""),r),l=e.foretell[n.bossId]||0,c=H("span",void 0,"先见 "+l);t.append(o,c),this.bindTip(t,e.phaseTag==="sun"?"<b>旭日</b><br>技能消耗先见时，每消耗 1 层，行动点 +1（每次技能最多 4 点）。":e.phaseTag==="moon"?"<b>月相</b><br>消耗先见的技能每层额外 +10% 伤害（最多 10 层）。":"<b>薄暮</b><br>伤害 +75%，施加的先见层数 x2，先见层数上限 x2。剩余 "+e.twilightTurns+" 个熙艾尔回合。");return}if(e.id==="lune"){for(let r=0;r<e.maxStains;r++){const o=e.stains[r],l=H("div","stain");o?(l.style.background=hm(o),l.title=tr(o)):(l.style.background="transparent",l.style.borderColor="rgba(255,255,255,0.2)"),t.append(l)}this.bindTip(t,"<b>异色印记</b><br>当前："+(e.stains.length?e.stains.map(tr).join(" / "):"空")+"<br>从左到右填充，槽满时替换最早的一个。技能可生成或消费特定异色。");return}const s=e.stance,a=s==="offensive"?" stance-offensive":s==="defensive"?" stance-defensive":s==="virtuose"?" stance-virtuose":"";t.append(H("span","stance-tag"+a,Fl[s])),this.bindTip(t,"<b>剑术姿态："+Fl[s]+"</b><br>"+(s==="offensive"?"造成伤害 x1.50，所受伤害 x1.35。":s==="defensive"?"所受伤害 x0.50；每次格挡额外获得 1 AP（每套最多 2 点）。":s==="virtuose"?"造成伤害 x3.00；完成一个伤害技能后回到无姿态。":"尚未进入任何姿态。"))}setHudFaded(e){for(const t of this.hudGroups)Fn(t,"faded",e);for(const t of this.dimGroups)Fn(t,"dimmed",e)}showMove(e,t){os(this.moveName,e),os(this.moveHint,t),this.center.classList.add("show"),this.moveSide.classList.add("show")}hideMove(){this.center.classList.remove("show"),this.moveSide.classList.remove("show"),Ut(this.segProgress),delete this.segProgress.dataset.key}setSegments(e,t){const n=e.join(",")+"/"+t;if(this.segProgress.dataset.key===n)return;this.segProgress.dataset.key=n,Ut(this.segProgress);let s=0;for(let a=0;a<t;a++){const r=e[a];r&&(s+=1),this.segProgress.append(H("div","seg"+(r?" "+r:"")))}this.segProgress.append(H("span",void 0,s+" / "+t))}popJudge(e,t){this.judgeEl.textContent=e,this.judgeEl.style.color=t,this.judgeEl.classList.remove("pop"),this.judgeEl.offsetWidth,this.judgeEl.classList.add("pop")}log(e,t){const n=H("div",t||"",e);for(this.logEl.prepend(n),this.logLines+=1;this.logEl.childElementCount>12;)this.logEl.lastChild&&this.logEl.removeChild(this.logEl.lastChild)}damage(e,t,n,s,a,r){let o=this.dmgPool.pop();o||(o=H("div","dmg"),this.dmgLayer.append(o)),o.style.display="block",o.style.color=s,o.style.fontSize=r+"px",Ut(o),o.append(document.createTextNode(n)),a&&o.append(H("span","tag",a));const l=this.dmgActive.filter(h=>Math.abs(h.x-e)<60&&Math.abs(h.y-t)<46).length,c={el:o,x:e+(Math.random()-.5)*34,y:t-l*26,vx:(Math.random()-.5)*26,vy:-78-Math.random()*26,life:0,total:1};this.dmgActive.push(c)}updateDamage(e){for(let t=this.dmgActive.length-1;t>=0;t--){const n=this.dmgActive[t];n.life+=e,n.x+=n.vx*e,n.y+=n.vy*e,n.vy+=132*e;const s=n.life/n.total;n.el.style.transform="translate("+Math.round(n.x)+"px,"+Math.round(n.y)+"px) scale("+(s<.16?.7+s*2.2:1.02-s*.1).toFixed(3)+")",n.el.style.opacity=String(s<.7?1:Math.max(0,1-(s-.7)/.3)),n.life>=n.total&&(n.el.style.display="none",this.dmgPool.push(n.el),this.dmgActive.splice(t,1))}}addRing(e,t,n,s,a,r){if(this.rings.has(e))return;const o=H("div","qte "+s+(a?" jump":"")),l=H("div","ring"),c=H("div","core"),h=H("div","key",a?"SPACE 跳跃":s==="counter"?"SPACE 反击":"SPACE");o.append(l,c,h),this.qteLayer.append(o),this.rings.set(e,{el:o,ring:l,at:t,lead:n,kind:s,anchor:r,done:!1,fade:0})}markRing(e,t){const n=this.rings.get(e);n&&(n.done=!0,n.fade=0,n.ring.style.borderColor=t==="perfect"?"#fff3cf":t==="good"||t==="block"?"#ffffff":"#ff5a3c",n.ring.style.boxShadow=t==="perfect"?"0 0 26px #ffe4a8":"none")}clearRings(){for(const[,e]of this.rings)e.el.remove();this.rings.clear()}updateRings(e,t){for(const[n,s]of[...this.rings]){const a=s.anchor();s.el.style.left=a.x+"px",s.el.style.top=a.y+"px";const r=s.at-e,o=Math.max(0,Math.min(1,r/s.lead)),l=s.done?1+s.fade*1.2:.34+o*1.5;s.ring.style.transform="rotate(45deg) scale("+l.toFixed(3)+")",s.el.style.opacity=String(s.done?Math.max(0,1-s.fade*3.4):a.visible?Math.min(1,(1-o)*2.6+.28):.25),s.done?(s.fade+=t,s.fade>.36&&(s.el.remove(),this.rings.delete(n))):r<-520&&(s.el.remove(),this.rings.delete(n))}}showCommand(e,t,n){const s=e.actors[e.currentActorId||""];if(!s)return;const a=s.id+s.ap+e.inventory.heal+e.inventory.energy+e.inventory.revive;if(this.commandEl.classList.remove("hidden"),this.commandEl.style.left=Math.round(Math.max(24,Math.min(t,window.innerWidth-260)))+"px",this.commandEl.style.top=Math.round(Math.max(120,Math.min(n,window.innerHeight-250)))+"px",this.lastCommandKey===a)return;this.lastCommandKey=a,Ut(this.commandEl);const r=[{label:"攻击",sub:"3 段连协 · 赚取行动点",kind:"attack"},{label:"技能",sub:s.name+" · 6 项",kind:"skill"},{label:"瞄准",sub:"击破弱点 · 每发 1 AP",kind:"aim",disabled:s.ap<1?"AP 不足":void 0},{label:"道具",sub:"亮色 "+(e.inventory.heal+e.inventory.energy+e.inventory.revive)+" 个",kind:"item",disabled:e.inventory.heal+e.inventory.energy+e.inventory.revive<=0?"库存为空":void 0}];for(const o of r){const l=H("button","cmd-btn");l.append(document.createTextNode(o.label),H("small",void 0,o.disabled?o.disabled:o.sub)),o.disabled?l.setAttribute("disabled","true"):l.addEventListener("click",()=>this.hooks.onCommand(o.kind)),this.commandEl.append(l)}}hideCommand(){this.commandEl.classList.add("hidden"),this.lastCommandKey=""}showSkills(e,t,n,s){const a=e.actors[e.currentActorId||""];if(!a)return;this.skillsEl.classList.remove("hidden"),this.skillsEl.style.left=Math.round(Math.max(24,Math.min(t,window.innerWidth-400)))+"px",this.skillsEl.style.top=Math.round(Math.max(96,Math.min(n,window.innerHeight-320)))+"px",this.skillsEl.style.transform="skewY(-4deg) rotate(0.6deg)";const r=s+a.id+a.ap+a.stains.join("")+a.stance+a.phaseTag+e.inventory.heal+e.inventory.energy+e.inventory.revive;if(this.lastSkillKey===r)return;this.lastSkillKey=r,Ut(this.skillsEl);const o=H("div");o.id="skills-head";const l=H("div",void 0,a.name+(s==="item"?" · 道具":" · 技能"));l.id="skills-owner";const c=H("div");if(c.id="skills-note",c.textContent=this.professionNote(a,e),o.append(l,c),this.skillsEl.append(o),s==="item")for(const u of ia){const d=e.inventory[u.id],p=H("div","sk"),g=H("div","sk-el");g.style.background="#8ddc7f";const x=H("div");x.append(H("div","sk-name",u.name),H("div","sk-desc",u.desc)),p.append(g,x,H("div","sk-target",sr[u.target]),H("div","sk-ap","x"+d)),d<=0?p.setAttribute("disabled","true"):p.addEventListener("click",()=>this.hooks.onItem(u.id)),this.bindTip(p,"<b>"+u.name+"</b><br>"+u.longDesc),this.skillsEl.append(p)}else for(const u of Ec(a.id)){const d=Qr(u,a),p=H("div","sk"),g=H("div","sk-el"),x=u.element==="weapon"?a.weaponElement:u.element==="dynamic"?"light":u.element;g.style.background=kc[x]||"#e9e0d1";const m=H("div");m.append(H("div","sk-name",u.name),H("div","sk-desc",u.desc));const f=H("div","sk-target");f.append(document.createTextNode(sr[u.target]||u.target));const M=H("div",void 0,u.element==="weapon"?"武器":u.element==="dynamic"?"动态":dg[u.element]);M.style.fontSize="8px",f.append(M),p.append(g,m,f,H("div","sk-ap",String(d)));const w=a.ap>=d,S=u.target==="deadAlly"&&!e.partyOrder.some(b=>!e.actors[b].alive);if(!w||S){p.setAttribute("disabled","true");const b=w?"没有倒下的队员":"AP 不足（需要 "+d+"，当前 "+a.ap+"）";this.bindTip(p,"<b>"+u.name+"</b> · "+d+" AP<br>"+u.longDesc+'<br><span style="color:#ff8f7a">'+b+"</span>")}else p.addEventListener("click",()=>this.hooks.onSkill(u.id)),this.bindTip(p,"<b>"+u.name+"</b> · "+d+" AP · "+(sr[u.target]||u.target)+"<br>"+u.longDesc+(u.breakValue?"<br>破防值 +"+u.breakValue:"")+(u.promptTimes.length?"<br>连协提示 "+u.promptTimes.length+" 次":""));this.skillsEl.append(p)}const h=H("div");h.id="skills-foot",h.append(H("span",void 0,"右键 / Esc 返回"),H("span",void 0,"当前 AP "+a.ap+" / 9")),this.skillsEl.append(h)}professionNote(e,t){if(e.id==="sciel")return e.phaseTag==="sun"?"旭日：每消耗 1 层先见，行动点 +1":e.phaseTag==="moon"?"月相：消耗先见的技能每层伤害 +10%":"薄暮：伤害 +75%，施加的先见层数 x2，先见层数上限 x2";if(e.id==="lune")return"异色 "+e.stains.length+"/4："+(e.stains.length?e.stains.map(tr).join("·"):"空槽");const n=e.stance;return n==="offensive"?"攻：造成伤害 x1.50，所受伤害 x1.35":n==="defensive"?"守：所受伤害 x0.50，格挡额外 +1 AP":n==="virtuose"?"高手：造成伤害 +200%":"无姿态：使用技能进入攻 / 守 / 高手"}hideSkills(){this.skillsEl.classList.add("hidden"),this.lastSkillKey=""}setMarkers(e){const t=new Set(e.map(n=>n.id));for(const[n,s]of[...this.markerNodes])t.has(n)||(s.el.remove(),this.markerNodes.delete(n));for(const n of e){let s=this.markerNodes.get(n.id);if(!s){const a=H("div","marker"),r=H("div",n.enemy?"cross":"rhombus"),o=H("div","label",n.label);a.append(r,o),a.addEventListener("click",l=>{l.stopPropagation(),this.hooks.onTarget(n.id)}),this.markerLayer.append(a),s={el:a,label:o},this.markerNodes.set(n.id,s)}s.el.style.left=Math.round(n.x)+"px",s.el.style.top=Math.round(n.y)+"px",s.label.textContent!==n.label&&(s.label.textContent=n.label)}}clearMarkers(){for(const[,e]of this.markerNodes)e.el.remove();this.markerNodes.clear()}setAim(e){Fn(this.aimLayer,"hidden",!e)}updateAim(e,t){this.reticle.style.left=this.mouse.x+"px",this.reticle.style.top=this.mouse.y+"px";for(const s of e){let a=this.wpNodes.get(s.id);if(!a){const o=H("div","weakpoint"),l=H("div","txt",s.name);o.append(H("div","halo"),l),o.addEventListener("click",c=>{c.stopPropagation(),this.hooks.onAimShot(s.id,this.mouse.x,this.mouse.y)}),this.aimLayer.append(o),a={el:o,txt:l},this.wpNodes.set(s.id,a)}a.el.style.left=Math.round(s.x)+"px",a.el.style.top=Math.round(s.y)+"px",Fn(a.el,"broken",s.broken);const r=s.name+(s.broken?"（已破坏）":"");a.txt.textContent!==r&&(a.txt.textContent=r)}if(!this.aimExit){const s=H("button","mini aim-exit","结束瞄准");s.style.position="absolute",s.style.right="22px",s.style.bottom="160px",s.style.pointerEvents="auto",s.addEventListener("click",a=>{a.stopPropagation(),this.hooks.onAimEnd()}),this.aimLayer.append(s),this.aimExit=s}const n="结束瞄准（剩余 "+t+" AP）";this.aimExit.textContent!==n&&(this.aimExit.textContent=n)}bindAimSurface(e){this.aimLayer.addEventListener("mousedown",t=>{t.button===0&&e(t.clientX,t.clientY)}),this.aimLayer.style.pointerEvents="auto"}showDifficulty(e){Ut(this.screens);const t=H("div","screen");t.append(this.title("四手剑客","CLAIR OBSCUR 风格 · 远征队 Boss 战原型"));const n=H("div");n.id="difficulty-list";for(const a of om){const r=On[a],o=H("div","diff-card"+(a==="standard"?" rec":""));o.append(H("h2",void 0,r.name));const l=H("div","en",r.subtitle);o.append(l);const c=H("ul");for(const h of r.blurb)c.append(H("li",void 0,h));c.append(H("li",void 0,"Boss 生命 "+r.bossHp.toLocaleString()+" · 伤害 x"+r.bossDamageMul)),o.append(c),a==="standard"&&o.append(H("div","rec-tag","推荐 · 默认")),o.addEventListener("click",()=>this.hooks.onDifficulty(a)),n.append(o)}t.append(n);const s=H("div","sub","鼠标点击操作 · 空格完成所有实时判定 · 难度在战斗中不可切换");s.style.marginTop="24px",t.append(s),this.screens.append(t)}title(e,t){const n=H("div");return n.style.textAlign="center",n.append(H("h1",void 0,e),H("div","sub",t)),n}showPause(){Ut(this.screens);const e=H("div","screen");e.id="pause-screen",e.append(this.title("暂停","模拟时钟已冻结 · 按 P 或点击继续"));const t=H("div","screen-actions"),n=H("button","big-btn","继续");n.addEventListener("click",()=>this.hooks.onTogglePause());const s=H("button","big-btn","返回难度选择");s.addEventListener("click",()=>this.hooks.onToDifficulty()),t.append(n,s),e.append(t),this.screens.append(e)}hideScreens(){Ut(this.screens)}showResult(e,t,n){Ut(this.screens);const s=H("div","screen"),a=H("div");a.id="result-panel",a.append(H("h1",void 0,e?"胜利":"失败")),a.append(H("div","sub",e?"VICTORY · 四手剑客已崩解":"DEFEAT · 远征队全员倒下"));const r=H("div","res-grid"),o=t.stats,l=Math.floor(o.elapsedMs/6e4),c=Math.floor(o.elapsedMs%6e4/1e3),h=l+":"+String(c).padStart(2,"0"),u=H("div","res-block");u.append(H("h3",void 0,"本局战斗数据"));const d=o.promptPerfect+o.promptGood+o.promptMiss,p=[["战斗用时",h],["伤害总计",o.totalDamage.toLocaleString()],["最高单段伤害",o.maxHit.toLocaleString()],["所受伤害总计",o.damageTaken.toLocaleString()],["完美格挡 / 普通 / 失手",o.perfectBlocks+" / "+o.normalBlocks+" / "+o.missedBlocks],["最佳连续格挡",String(o.bestBlockChain)],["完整反击次数",String(o.fullCounters)],["技能连协命中率",d?Math.round((o.promptPerfect+o.promptGood)/d*100)+"%":"—"],["击破弱点",String(o.weakPointsBroken)],["治疗总计",o.healing.toLocaleString()],["难度",On[t.difficulty].name],["随机种子",String(n)]];e||p.unshift(["Boss 剩余生命",Math.round(t.actors[t.bossId].hp/t.actors[t.bossId].maxHp*100)+"%"]);for(const[w,S]of p){const b=H("div","res-row");b.append(H("span",void 0,w),H("span",void 0,S)),u.append(b)}r.append(u);const g=H("div","res-block");if(e){g.append(H("h3",void 0,"战利品"));for(const[S,b]of[["经验","27,560"],["战利","3,950"],["剑客长刀","Lv.9"],["连续攻击一","武器技"],["精良催化源色","x3"]]){const E=H("div","res-row");E.append(H("span",void 0,S),H("span",void 0,b)),g.append(E)}const w=H("h3",void 0,"远征队");w.style.marginTop="12px",g.append(w);for(const S of t.partyOrder){const b=t.actors[S],E=H("div","res-lv");E.append(H("span",void 0,b.name+" Lv.32"));const R=H("div","bar"),v=H("i");v.style.width="18%",R.append(v),E.append(R);const T=H("span",void 0,"+9,186");E.append(T),g.append(E),window.setTimeout(()=>{v.style.width="76%"},260)}}else{g.append(H("h3",void 0,"战况"));for(const S of t.partyOrder){const b=t.actors[S],E=H("div","res-row");E.append(H("span",void 0,b.name),H("span",void 0,b.alive?"存活":"倒下")),g.append(E)}const w=H("div","res-row");w.append(H("span",void 0,"建议"),H("span",void 0,"逐段格挡，别用一次按键挡整套")),g.append(w)}r.append(g),a.append(r);const x=H("div","screen-actions"),m=H("button","big-btn",e?"再次挑战":"立即重试");m.addEventListener("click",()=>this.hooks.onRestart());const f=H("button","big-btn","返回难度选择");f.addEventListener("click",()=>this.hooks.onToDifficulty());const M=H("button","big-btn","导出战斗日志");M.addEventListener("click",()=>this.hooks.onExportLog()),x.append(m,f,M),a.append(x),s.append(a),this.screens.append(s)}setToggle(e,t,n){const s=this.root.querySelector("#"+e);s&&(Fn(s,"on",t),s.textContent=n)}enableDebug(){this.debugEl.classList.remove("hidden")}renderDebug(e,t,n){if(this.debugEl.classList.contains("hidden"))return;if(this.debugEl.dataset.built!=="1"){this.debugEl.dataset.built="1",Ut(this.debugEl),this.debugEl.append(H("h4",void 0,"调试面板 ?debug=1"));const r=H("div");r.id="dbg-info",this.debugEl.append(r,H("hr"));const o=H("div");o.id="dbg-btns";for(const d of t){const p=H("button",void 0,d.label);p.addEventListener("click",()=>this.hooks.onDebug(d.action)),o.append(p)}this.debugEl.append(o,H("hr"));const l=H("textarea");l.id="dbg-log",l.placeholder="战斗日志 JSON（导出后可复制；粘贴后点重放）";const c=H("div"),h=H("button",void 0,"导出日志");h.addEventListener("click",()=>this.hooks.onExportLog());const u=H("button",void 0,"导入并重放");u.addEventListener("click",()=>this.hooks.onImportLog(l.value)),c.append(h,u),this.debugEl.append(l,c)}const s=this.debugEl.querySelector("#dbg-info");s&&(s.innerHTML=e);const a=this.debugEl.querySelector("#dbg-log");a&&n&&document.activeElement!==a&&(a.value=n)}tick(e,t){const n=Math.min(.1,t/1e3);this.updateDamage(n),this.updateRings(e,n)}flashScreen(e){const t=document.getElementById("vignette");t&&(t.classList.add(e),window.setTimeout(()=>t.classList.remove(e),e==="perfect"?180:260))}}const fg={four_arm_combo:"combo",sweeping_slash:"sweep",swift_thrust:"thrust",inverted_array:"array",blade_charge:"charge",twin_execution:"execution",blood_storm:"storm"},pg={physical:"hit_physical",fire:"hit_fire",ice:"hit_ice",lightning:"hit_lightning",earth:"hit_earth",light:"hit_light",dark:"hit_dark"};class mg{container;canvas;stage;ui;audio;engine=null;difficulty="standard";seed=0;raf=0;lastPerf=0;paused=!1;autoPaused=!1;timeScale=1;hitstopUntil=0;uiLayer="none";struckEvents=new Set;ringIds=new Set;mouse={x:0,y:0};muted=!1;reduceShake=!1;lowPerf=!1;debug=!1;resultShown=!1;lastLog=null;listeners=[];pendingPresses=[];fpsAccum=0;fpsFrames=0;qualityChecked=!1;constructor(e,t,n){this.container=e,this.canvas=t,this.stage=rg(t),this.audio=lg(),this.debug=new URLSearchParams(location.search).get("debug")==="1",this.ui=new ug(n,{onDifficulty:s=>this.startBattle(s),onCommand:s=>this.onCommand(s),onSkill:s=>this.onSkill(s),onItem:s=>this.onItem(s),onTarget:s=>this.onTarget(s),onBack:()=>this.onBack(),onAimShot:s=>this.onAimShot(s),onAimEnd:()=>this.engine&&this.engine.exitAim(),onRestart:()=>this.startBattle(this.difficulty),onToDifficulty:()=>this.toDifficulty(),onTogglePause:()=>this.togglePause(),onToggleMute:()=>this.toggleMute(),onVolume:s=>{this.audio.setMasterVolume(s),this.audio.setMuted(!1),this.muted=!1,this.ui.setToggle("btn-mute",!1,"静音")},onToggleShake:()=>this.toggleShake(),onTogglePerf:()=>this.togglePerf(),onExportLog:()=>this.exportLog(),onImportLog:s=>this.importLog(s),onDebug:s=>this.onDebugAction(s)}),this.debug&&this.ui.enableDebug(),this.ui.bindAimSurface((s,a)=>{!this.engine||this.engine.state.fsm!=="AIM"||this.onAimShot(null)}),this.bindGlobal(),this.ui.showDifficulty(this.difficulty),this.lastPerf=performance.now(),this.loop(this.lastPerf)}bindGlobal(){const e=()=>this.stage.resize(),t=c=>{if(c.code==="Space"){if(c.preventDefault(),c.repeat)return;this.pressSpace();return}if(c.code==="Escape"){c.preventDefault(),this.onBack();return}c.code==="KeyP"&&this.togglePause()},n=c=>{c.preventDefault(),this.onBack()},s=c=>{this.mouse.x=c.clientX,this.mouse.y=c.clientY},a=()=>{!this.paused&&this.engine&&(this.autoPaused=!0,this.paused=!0,this.audio.suspend(),this.engine&&this.engine.setPaused(!0))},r=()=>{this.autoPaused&&(this.autoPaused=!1,this.paused=!1,this.lastPerf=performance.now(),this.audio.resume(),this.engine&&this.engine.setPaused(!1))},o=()=>{document.hidden?a():r()},l=()=>{this.audio.unlock()};window.addEventListener("resize",e),window.addEventListener("keydown",t),window.addEventListener("contextmenu",n),window.addEventListener("mousemove",s),window.addEventListener("blur",a),window.addEventListener("focus",r),document.addEventListener("visibilitychange",o),window.addEventListener("pointerdown",l,{once:!0}),this.listeners.push(()=>window.removeEventListener("resize",e),()=>window.removeEventListener("keydown",t),()=>window.removeEventListener("contextmenu",n),()=>window.removeEventListener("mousemove",s),()=>window.removeEventListener("blur",a),()=>window.removeEventListener("focus",r),()=>document.removeEventListener("visibilitychange",o))}queueTestPress(e){this.pendingPresses.push(e),this.pendingPresses.sort((t,n)=>t-n),this.pendingPresses.length>64&&(this.pendingPresses.length=64)}pressSpace(){if(!this.engine||this.paused)return;const e=performance.now(),t=(e-this.lastPerf)*this.timeScale;this.lastPerf=e,this.engine.advance(t),this.engine.pressSpace(),this.consumeEvents()}startBattle(e,t){this.difficulty=e,this.engine&&this.engine.dispose(),this.stage.resetActors(),this.struckEvents.clear(),this.ringIds.clear(),this.ui.clearRings(),this.ui.clearMarkers(),this.ui.hideSkills(),this.ui.hideCommand(),this.ui.hideMove(),this.ui.hideScreens(),this.ui.setAim(!1),this.ui.setHudFaded(!1),this.uiLayer="none",this.resultShown=!1,this.timeScale=1,this.paused=!1,this.autoPaused=!1,this.hitstopUntil=0,this.pendingPresses=[],this.seed=t===void 0?Math.floor(Math.random()*268435455)>>>0:t,this.engine=new Tc({difficulty:e,seed:this.seed}),this.engine.start(),this.audio.setPhase(1),this.audio.startAmbient(),this.audio.unlock(),this.lastPerf=performance.now(),this.consumeEvents()}toDifficulty(){this.engine&&this.engine.dispose(),this.engine=null,this.ui.clearRings(),this.ui.clearMarkers(),this.ui.hideSkills(),this.ui.hideCommand(),this.ui.hideMove(),this.ui.setAim(!1),this.ui.setHudFaded(!1),this.audio.stopAmbient(),this.paused=!1,this.ui.showDifficulty(this.difficulty)}togglePause(){!this.engine||this.engine.state.outcome!=="none"||(this.paused=!this.paused,this.engine.setPaused(this.paused),this.paused?(this.audio.suspend(),this.ui.showPause()):(this.audio.resume(),this.ui.hideScreens(),this.lastPerf=performance.now()))}toggleMute(){this.muted=!this.muted,this.audio.setMuted(this.muted),this.ui.setToggle("btn-mute",this.muted,this.muted?"已静音":"静音")}toggleShake(){this.reduceShake=!this.reduceShake,this.stage.setReduceShake(this.reduceShake),this.ui.setToggle("btn-shake",this.reduceShake,this.reduceShake?"晃动已减弱":"减少晃动")}togglePerf(){this.lowPerf=!this.lowPerf,this.stage.setLowPerf(this.lowPerf),this.ui.setToggle("btn-perf",this.lowPerf,this.lowPerf?"低性能开":"低性能")}onCommand(e){if(this.engine){if(this.audio.play("ui_click"),e==="skill"){this.uiLayer="skills";return}if(e==="item"){this.uiLayer="items";return}this.uiLayer="none",this.engine.chooseCommand(e),this.consumeEvents()}}onSkill(e){if(this.engine){if(!this.engine.chooseSkill(e)){this.audio.play("ui_denied");return}this.audio.play("ui_click"),this.uiLayer="none",this.consumeEvents()}}onItem(e){if(this.engine){if(!this.engine.chooseItem(e)){this.audio.play("ui_denied");return}this.audio.play("ui_click"),this.uiLayer="none",this.consumeEvents()}}onTarget(e){if(!this.engine)return;const t=this.engine.state,n=t.actors[e]&&t.actors[e].statuses.some(r=>r.id==="inverted"),s=t.pending,a=s&&(s.kind==="item"&&s.itemId==="heal"||s.kind==="skill"&&s.skillId==="typhoon");n&&a&&On[t.difficulty].invertedConfirm&&(this.audio.play("inverted_warn"),!window.confirm("目标处于倒逆状态：治疗会转为等量伤害，可能致死。确定继续？"))||(this.audio.play("ui_click"),this.engine.chooseTarget(e),this.consumeEvents())}onBack(){if(this.engine){if(this.uiLayer!=="none"){this.uiLayer="none",this.audio.play("ui_back");return}this.engine.back()&&this.audio.play("ui_back"),this.consumeEvents()}}onAimShot(e){this.engine&&(this.engine.aimShot(e),this.audio.play(e?"weakpoint_break":"aim_shot",{gain:e?1:.7}),this.consumeEvents())}loop=e=>{this.raf=requestAnimationFrame(this.loop);const t=Math.min(120,Math.max(0,e-this.lastPerf));if(this.lastPerf=e,this.engine&&!this.paused){const n=Math.max(0,Math.min(t,this.hitstopUntil-(e-t)));let a=(t-n)*this.timeScale+n*.06,r=0;for(;this.pendingPresses.length>0&&r++<24&&this.pendingPresses[0]<=this.engine.state.now+a;){const o=this.pendingPresses.shift(),l=Math.max(0,o-this.engine.state.now);this.engine.advance(l),a=Math.max(0,a-l),this.engine.pressSpace(),this.consumeEvents()}this.engine.advance(a),this.consumeEvents()}this.engine&&(this.syncCamera(),this.syncUi(),this.ui.tick(this.engine.state.now,t),this.checkQuality(t)),this.stage.update(t)};checkQuality(e){if(this.qualityChecked||this.paused||e<=0||(this.fpsAccum+=e,this.fpsFrames+=1,this.fpsAccum<2500))return;this.qualityChecked=!0;const t=this.fpsFrames/(this.fpsAccum/1e3);t<28&&!this.lowPerf&&(this.lowPerf=!0,this.stage.setLowPerf(!0),this.ui.setToggle("btn-perf",!0,"低性能(自动)"),this.ui.log("检测到帧率 "+t.toFixed(1)+" —— 已自动开启低性能模式（仅减少粒子/阴影，不改变判定时序）","warn"))}consumeEvents(){if(!this.engine)return;const e=this.engine.drain();for(const t of e)this.handleEvent(t)}screenOf(e,t="chest"){return this.stage.project(this.stage.anchorWorld(e,t))}handleEvent(e){const t=this.engine.state;switch(e.type){case"log":this.ui.log(e.payload.text,e.payload.tone);break;case"turnStart":this.struckEvents.clear();for(const n of t.partyOrder)this.stage.chars[n].setActive(n===e.payload.actorId);break;case"actionStart":{const n=e.payload.action;if(n.kind!=="boss"){const s=this.stage.chars[n.actorId],a=n.skillId?ii[n.skillId]:null,r=n.kind==="item"?"item":n.kind==="counter"?"counter":a&&a.kind!=="attack"||n.actorId==="lune"?"cast":"slash";s&&s.playAttack(r,Math.max(600,n.endsAt-n.startedAt))}break}case"bossTelegraph":{const n=sa[e.payload.moveId],s=n?(n.impactTimes[n.impactTimes.length-1]+n.tail)*1e3:2500;this.stage.boss.playAttack(fg[e.payload.moveId]||"combo",s),this.ui.showMove(e.payload.name,e.payload.hint),this.audio.play("boss_telegraph"),e.payload.moveId==="blood_storm"&&this.audio.play("boss_roar"),this.ui.setHudFaded(!0);break}case"actionEnd":this.ui.hideMove(),this.ui.setHudFaded(!1),this.timeScale=1,this.stage.setTimeScale(1),this.audio.setTimeScale(1);break;case"promptOpen":{const n=t.action?t.action.actorId:t.currentActorId||"maelle",s=Math.max(On[t.difficulty].telegraphLead,On[t.difficulty].skillGood);this.ui.addRing(e.payload.eventId,e.payload.at,s,"skill",!1,()=>this.screenOf(n,"weapon")),this.audio.play("prompt_rise");break}case"promptJudged":{this.ui.markRing(e.payload.eventId,e.payload.grade);const n=e.payload.grade;this.ui.popJudge(n==="perfect"?"PERFECT":n==="good"?"GOOD":"MISS",n==="perfect"?"#ffe4a8":n==="good"?"#e9e0d1":"#ff6a4a"),this.audio.play(n==="perfect"?"perfect_block":n==="good"?"normal_block":"block_fail",{gain:n==="perfect"?.85:.6}),n==="perfect"&&(this.hitstopUntil=performance.now()+55);break}case"defenseOpen":{const n=e.payload.targetId||t.partyOrder[0],s=On[t.difficulty].telegraphLead+On[t.difficulty].blockOuter;this.ui.addRing(e.payload.eventId,e.payload.at,s,"defense",e.payload.jump,()=>this.screenOf(n,"chest"));break}case"defenseJudged":{this.ui.markRing(e.payload.eventId,e.payload.grade);const n=e.payload.grade;if(n==="perfect"){this.ui.popJudge("完美格挡","#ffe4a8"),this.audio.play("perfect_block"),this.hitstopUntil=performance.now()+62,this.ui.flashScreen("perfect");const s=this.stage.anchorWorld(e.payload.targetId||t.partyOrder[0],"chest");this.stage.fx.perfectRing(s)}else n==="block"?(this.ui.popJudge("格挡","#e9e0d1"),this.audio.play("normal_block"),this.stage.shake(.35)):(this.ui.popJudge("失手","#ff5a3c"),this.audio.play("block_fail"),this.ui.flashScreen("hurt"),this.stage.shake(.7));break}case"counterOpen":{this.timeScale=.9,this.stage.setTimeScale(.92),this.audio.setTimeScale(.9),this.audio.play("counter_start"),this.ui.popJudge("完美格挡","#ffe4a8"),this.ui.addRing("counter",e.payload.opensAt+200,520,"counter",!1,()=>{const n=this.screenOf(t.bossId,"chest");return{x:n.x,y:n.y+40,visible:!0}});break}case"counterJudged":this.ui.markRing("counter",e.payload.grade==="perfect"?"perfect":"block");break;case"counterPerformed":this.audio.play("counter_hit");for(const n of e.payload.actorIds){const s=this.stage.chars[n];s&&s.playAttack("counter",900)}break;case"hit":{this.showHit(e);break}case"heal":{const n=this.screenOf(e.payload.targetId,"head"),s=e.payload.amount;s>0?(this.ui.damage(n.x,n.y,"+"+s,"#8ef0c0","治疗",22),this.audio.play("heal")):s<0&&(this.ui.damage(n.x,n.y,String(-s),"#ff6a4a","倒逆反伤",24),this.audio.play("inverted_warn"));break}case"statusChange":e.payload.statusId==="inverted"&&!e.payload.removed&&this.audio.play("inverted_warn");break;case"breakChange":e.payload.broken&&(this.audio.play("break_gauge"),this.stage.shake(.8),this.ui.popJudge("破防","#ffd479"));break;case"shieldChange":e.payload.delta<0&&this.audio.play("shield_break",{gain:.5});break;case"weakPointBroken":this.stage.boss.breakWeakPoint(e.payload.id),this.audio.play("weakpoint_break"),this.stage.shake(.5);break;case"death":e.payload.actorId===t.bossId?this.audio.play("boss_roar"):(this.stage.chars[e.payload.actorId].setDead(!0),this.audio.play("death"));break;case"revive":this.stage.chars[e.payload.actorId].setDead(!1),this.audio.play("revive");break;case"phaseChange":this.stage.setPhase(e.payload.phase),this.audio.setPhase(e.payload.phase),this.audio.play("phase_shift"),this.stage.shake(.6);break;case"spam":this.audio.play("ui_denied",{gain:.4});break;case"victory":this.audio.play("victory"),window.setTimeout(()=>{this.engine&&this.engine.state.outcome==="victory"&&!this.resultShown&&(this.resultShown=!0,this.ui.showResult(!0,this.engine.state,this.seed))},2600);break;case"defeat":this.audio.play("defeat"),window.setTimeout(()=>{this.engine&&this.engine.state.outcome==="defeat"&&!this.resultShown&&(this.resultShown=!0,this.ui.showResult(!1,this.engine.state,this.seed))},1600);break}}showHit(e){const t=e.payload,n=this.engine.state,s=t.targetId===n.bossId,a=this.screenOf(t.targetId,s?"chest":"head"),r=this.stage.anchorWorld(t.targetId,"chest"),o=t.absorbed?"#cfe4ff":t.grade==="perfect"?"#ffe4a8":t.weakness?"#ffd479":t.resist?"#9c948a":kc[t.element]||"#e9e0d1";if(t.grade!=="perfect")if(t.shielded||t.absorbed)this.ui.damage(a.x,a.y,"护盾",o,"完全吸收",18);else{const l=t.crit?"暴击":t.weakness?"弱点":t.resist?"抗性":"",c=t.crit?32:t.damage>=2e3?29:24;this.ui.damage(a.x,a.y,String(t.damage),o,l,c)}!t.absorbed&&t.damage>0&&(this.stage.fx.burst(r,t.element,t.crit?1.5:1),s?this.stage.boss.hitFlash(Math.min(1,.4+t.damage/3e3)):this.stage.chars[t.targetId]&&this.stage.chars[t.targetId].hitFlash(.8),this.stage.shake(Math.min(.9,.14+t.damage/4200)),this.audio.play(pg[t.element]||"hit_physical",{gain:.55}),t.crit?this.audio.play("crit",{gain:.6}):t.weakness&&this.audio.play("weakness",{gain:.5}),s||this.ui.flashScreen("hurt")),t.overkill&&s&&this.stage.shake(1.2)}syncCamera(){const e=this.engine.state,t=e.currentActorId||"maelle";let n="idle",s={focusId:t};switch(e.fsm){case"INTRO":n="intro";break;case"COMMAND":n=this.uiLayer==="none"?"command":"skills";break;case"TARGET_SELECT":n="target";break;case"AIM":n="aim";break;case"PLAYER_ACTION":case"SKILL_PROMPTS":{n="playerAction";const a=e.action,r=a?a.events.filter(o=>o.type==="hit"&&o.resolved).length:0;s={focusId:t,shot:r%4};break}case"BOSS_TELEGRAPH":case"DEFENSE_SEQUENCE":{n="bossAttack";const a=e.action,r=a&&a.targetIds[0]?a.targetIds[0]:t;s={focusId:r,targetId:r};break}case"COUNTER_WINDOW":{n="counter";const a=e.action,r=a?a.events.filter(l=>l.type==="counterHit"&&l.resolved).length:0,o=e.partyOrder.filter(l=>e.actors[l].alive);s={focusId:o[Math.min(r,o.length-1)]||t,shot:r};break}case"PHASE_TRANSITION":n="phase";break;case"VICTORY":n="victory";break;case"DEFEAT":n="defeat";break;default:n="idle";break}this.stage.setCam(n,s)}syncUi(){const e=this.engine,t=e.state;this.ui.syncBoss(t),this.ui.syncParty(t),this.ui.syncTimeline(e.previewQueue(8),t);const n=t.action;if(n&&n.kind==="boss"){for(const a of n.events)if(!(a.type!=="defenseHit"||this.struckEvents.has(a.id))&&t.now>=a.at){this.struckEvents.add(a.id),this.stage.boss.strike(a.index);const r=a.targetIds&&a.targetIds[0]||t.partyOrder[0];this.stage.fx.burst(this.stage.anchorWorld(r,"chest"),a.element||"physical",.9),this.stage.shake(.24)}const s=n.events.filter(a=>a.type==="defenseHit").sort((a,r)=>a.at-r.at).map(a=>a.grade);this.ui.setSegments(s,t.chainDefensibleCount)}if(t.fsm==="VICTORY"&&this.stage.boss.dissolve(Math.min(1,(t.now-(t.stats.startedAt+t.stats.elapsedMs))/1400+.25)),t.fsm==="COMMAND"&&this.uiLayer==="none"){const s=this.screenOf(t.currentActorId||"maelle","chest");this.ui.showCommand(t,s.x+54,s.y-76),this.ui.hideSkills()}else if(t.fsm==="COMMAND"&&this.uiLayer!=="none"){this.ui.hideCommand();const s=this.screenOf(t.currentActorId||"maelle","head");this.ui.showSkills(t,s.x+62,s.y-46,this.uiLayer==="items"?"item":"skill")}else this.ui.hideCommand(),this.ui.hideSkills(),this.uiLayer!=="none"&&(this.uiLayer="none");if(t.fsm==="TARGET_SELECT"){const s=e.legalTargets();this.ui.setMarkers(s.map(a=>{const r=this.screenOf(a,a===t.bossId?"chest":"head"),o=t.actors[a];return{id:a,x:r.x,y:r.y,label:o.name,enemy:o.kind==="boss"}}))}else this.ui.clearMarkers();if(t.fsm==="AIM"){this.ui.setAim(!0);const s=t.actors[t.bossId],a=t.actors[t.currentActorId||"maelle"];this.ui.updateAim(s.weakPoints.map(r=>{const o=this.stage.project(this.stage.weakPointWorld(r.id));return{id:r.id,x:o.x,y:o.y,name:r.name+" "+r.durability+"/"+r.maxDurability,broken:r.broken}}),a.ap)}else this.ui.setAim(!1);this.debug&&this.renderDebug()}renderDebug(){const e=this.engine,t=e.state,n=On[t.difficulty],s=t.action?t.action.events.filter(o=>o.type==="defenseHit"&&!o.resolved).sort((o,l)=>o.at-l.at)[0]:null,a=t.action?t.action.events.filter(o=>o.type==="prompt"&&!o.resolved).sort((o,l)=>o.at-l.at)[0]:null,r=[Bt("FSM",t.fsm),Bt("难度 / 种子",n.name+" / "+t.seed),Bt("模拟时钟",Math.round(t.now)+"ms"),Bt("阶段",String(t.phase)+(t.pendingPhase?" -> "+t.pendingPhase:"")),Bt("当前行动",t.currentActorId||"-"),Bt("Boss HP",Math.round(t.actors.boss.hp)+" / "+t.actors.boss.maxHp),Bt("破防槽",Math.round(t.actors.boss.breakGauge)+(t.actors.boss.broken?" 破防":"")),Bt("招式",(t.bossMoveName||"-")+(t.bossMoveVariant?"("+t.bossMoveVariant+")":"")),Bt("段数",t.chainResolvedCount+"/"+t.chainDefensibleCount+" perfect="+t.chainPerfectCount),Bt("下一命中",s?Math.round(s.at-t.now)+"ms":a?Math.round(a.at-t.now)+"ms(提示)":"-"),Bt("格挡窗口","±"+n.blockPerfect+" / ±"+n.blockOuter),Bt("技能窗口","±"+n.skillPerfect+" / ±"+n.skillGood),Bt("最近 delta",(t.lastDefenseDelta!==null?Math.round(t.lastDefenseDelta)+"ms(格挡)":"")+" "+(t.lastPromptDelta!==null?Math.round(t.lastPromptDelta)+"ms(连协)":"")),Bt("反击窗口",t.counterWindow?Math.round(t.counterWindow.opensAt)+"~"+Math.round(t.counterWindow.closesAt)+(t.counterResolved?" 已用":""):"-"),Bt("队列",e.previewQueue(6).map(o=>o.actorId.slice(0,2)+(o.kind==="extra"?"*":"")+o.at.toFixed(0)).join(" ")),Bt("RNG 调用",String(e.rng.calls))];this.ui.renderDebug(r.join(""),[{label:"Boss -10%",action:"dmg10"},{label:"Boss -50%",action:"dmg50"},{label:"全员 +9AP",action:"ap"},{label:"治疗全队",action:"heal"},{label:"跳阶段二",action:"phase2"},{label:"跳阶段三",action:"phase3"},{label:"四臂连击",action:"move_four_arm_combo"},{label:"迅敏突刺",action:"move_swift_thrust"},{label:"全体斩击",action:"move_sweeping_slash"},{label:"倒逆剑阵",action:"move_inverted_array"},{label:"双刃处刑",action:"move_twin_execution"},{label:"腥风血雨",action:"move_blood_storm"},{label:"刀锋蓄势",action:"move_blade_charge"}],this.lastLog?JSON.stringify(this.lastLog).slice(0,4e3):"")}onDebugAction(e){const t=this.engine;if(!t)return;const n=t.state.actors.boss;if(e==="dmg10")t.debugDamageBoss(Math.floor(n.maxHp*.1));else if(e==="dmg50")t.debugDamageBoss(Math.floor(n.maxHp*.5));else if(e==="ap")t.debugGiveAp();else if(e==="heal")for(const s of t.state.partyOrder)t.healActor(s,9999,"debug");else e==="phase2"?t.debugSetBossHpRatio(.67):e==="phase3"?t.debugSetBossHpRatio(.31):e.startsWith("move_")&&t.debugForceMove(e.slice(5));this.consumeEvents()}exportLog(){if(!this.engine)return;this.lastLog=this.engine.exportLog();const e=JSON.stringify(this.lastLog),t=new Blob([e],{type:"application/json"}),n=URL.createObjectURL(t),s=document.createElement("a");s.href=n,s.download="battle-"+this.lastLog.seed+".json",s.click(),URL.revokeObjectURL(n),this.ui.log("战斗日志已导出（"+this.lastLog.inputs.length+" 条输入）","perfect")}importLog(e){try{const t=Gm(e),n=Hm(t),s=n.state.stats;this.ui.log("重放完成："+n.state.outcome+" 伤害 "+s.totalDamage+" 最高 "+s.maxHit+" 完美格挡 "+s.perfectBlocks,"perfect"),this.engine&&this.engine.dispose(),this.engine=n,this.difficulty=t.difficulty,this.seed=t.seed,this.resultShown=!1,this.stage.resetActors(),this.stage.setPhase(n.state.phase),this.consumeEvents(),n.state.outcome!=="none"&&(this.resultShown=!0,this.ui.showResult(n.state.outcome==="victory",n.state,t.seed))}catch(t){this.ui.log("导入失败："+t.message,"warn")}}dispose(){cancelAnimationFrame(this.raf);for(const e of this.listeners)e();this.listeners=[],this.engine&&this.engine.dispose(),this.engine=null,this.audio.dispose(),this.stage.dispose(),this.container,this.canvas}}function Bt(i,e){return'<div class="kv"><span>'+i+"</span><b>"+e+"</b></div>"}const Nc=document.getElementById("app"),Fc=document.getElementById("stage"),Oc=document.getElementById("ui");if(!Nc||!Fc||!Oc)throw new Error("页面结构缺失：需要 #app / #stage / #ui");const gg=new mg(Nc,Fc,Oc);window.__GAME__=gg;window.addEventListener("error",i=>{console.error("[未捕获异常]",i.error||i.message)});
//# sourceMappingURL=index-BpNjqL8Z.js.map
