'use strict';
/* ================= core.js — math / rng / noise / svg-path / geometry merge ================= */

function clamp(v,a,b){return v<a?a:v>b?b:v}
function lerp(a,b,t){return a+(b-a)*t}
function damp(a,b,l,dt){return lerp(a,b,1-Math.exp(-l*dt))}
function smoothstep(a,b,x){x=clamp((x-a)/(b-a),0,1);return x*x*(3-2*x)}
function snapG(v,g){return Math.round(v/g)*g}
const DEG=Math.PI/180;

function mulberry32(seed){let a=seed>>>0;return function(){a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hashInt(x){x=x>>>0;x=(x^61)^(x>>>16);x=x+(x<<3)|0;x^=x>>>4;x=Math.imul(x,0x27d4eb2d);x^=x>>>15;return x>>>0}
function hash2i(x,y){return hashInt(Math.imul(x|0,374761393)^Math.imul(y|0,668265263))}
function hash3i(x,y,z){return hashInt(Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(z|0,1103515245))}

/* value noise 3D (0..1) + fbm (-1..1) */
function vnoise3(x,y,z,seed){
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z);
  const xf=x-xi,yf=y-yi,zf=z-zi;
  const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),w=zf*zf*(3-2*zf);
  const s=seed|0;
  const g=(i,j,k)=>hashInt(hash3i(xi+i,yi+j,zi+k)^s)/4294967296;
  const x00=lerp(g(0,0,0),g(1,0,0),u),x10=lerp(g(0,1,0),g(1,1,0),u);
  const x01=lerp(g(0,0,1),g(1,0,1),u),x11=lerp(g(0,1,1),g(1,1,1),u);
  return lerp(lerp(x00,x10,v),lerp(x01,x11,v),w);
}
function fbm3(x,y,z,seed,oct,lac,gain){
  oct=oct||4;lac=lac||2;gain=gain||0.5;
  let a=0,amp=1,f=1,tot=0;
  for(let i=0;i<oct;i++){a+=(vnoise3(x*f,y*f,z*f,seed+i*101)*2-1)*amp;tot+=amp;amp*=gain;f*=lac}
  return a/tot;
}
function ridged3(x,y,z,seed,oct){
  oct=oct||4;let a=0,amp=0.55,f=1;
  for(let i=0;i<oct;i++){a+=(1-Math.abs(vnoise3(x*f,y*f,z*f,seed+i*77)*2-1))*amp;amp*=0.5;f*=2.1}
  return a; // ~0..1.1
}

/* ---------- SVG path parsing (authored in math coords: x=right/radius, y=up) ---------- */
function parsePathCmds(d){
  const cmds=[];const re=/([MmLlHhVvCcQqZz])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE]-?\d+)?)/g;
  let m,cur=null;
  while((m=re.exec(d))){if(m[1]){cur={c:m[1],n:[]};cmds.push(cur)}else if(cur)cur.n.push(parseFloat(m[2]))}
  return cmds;
}
/* sample path into polyline subpaths: [[{x,y},...],...] */
function samplePath(d,cs){
  cs=cs||10;
  const cmds=parsePathCmds(d);const subs=[];let pts=null;let x=0,y=0,sx=0,sy=0;
  const put=(nx,ny)=>{pts.push({x:nx,y:ny});x=nx;y=ny};
  for(const cm of cmds){const c=cm.c,n=cm.n;let i=0;
    if(c==='M'||c==='m'){let nx=n[0],ny=n[1];if(c==='m'){nx+=x;ny+=y}
      pts=[];subs.push(pts);pts.push({x:nx,y:ny});x=nx;y=ny;sx=nx;sy=ny;
      for(i=2;i+1<n.length;i+=2){let lx=n[i],ly=n[i+1];if(c==='m'){lx+=x;ly+=y}put(lx,ly)}
    }else if(c==='L'||c==='l'){for(;i+1<n.length;i+=2){let nx=n[i],ny=n[i+1];if(c==='l'){nx+=x;ny+=y}put(nx,ny)}
    }else if(c==='H'||c==='h'){for(;i<n.length;i++){let nx=n[i];if(c==='h')nx+=x;put(nx,y)}
    }else if(c==='V'||c==='v'){for(;i<n.length;i++){let ny=n[i];if(c==='v')ny+=y;put(x,ny)}
    }else if(c==='C'||c==='c'){for(;i+5<n.length;i+=6){
      let x1=n[i],y1=n[i+1],x2=n[i+2],y2=n[i+3],x3=n[i+4],y3=n[i+5];
      if(c==='c'){x1+=x;y1+=y;x2+=x;y2+=y;x3+=x;y3+=y}
      const ax=x,ay=y;
      for(let t=1;t<=cs;t++){const tt=t/cs,mt=1-tt;
        pts.push({x:mt*mt*mt*ax+3*mt*mt*tt*x1+3*mt*tt*tt*x2+tt*tt*tt*x3,
                  y:mt*mt*mt*ay+3*mt*mt*tt*y1+3*mt*tt*tt*y2+tt*tt*tt*y3})}
      x=x3;y=y3}
    }else if(c==='Q'||c==='q'){for(;i+3<n.length;i+=4){
      let x1=n[i],y1=n[i+1],x2=n[i+2],y2=n[i+3];
      if(c==='q'){x1+=x;y1+=y;x2+=x;y2+=y}
      const ax=x,ay=y;
      for(let t=1;t<=cs;t++){const tt=t/cs,mt=1-tt;
        pts.push({x:mt*mt*ax+2*mt*tt*x1+tt*tt*x2,y:mt*mt*ay+2*mt*tt*y1+tt*tt*y2})}
      x=x2;y=y2}
    }else if(c==='Z'||c==='z'){if(pts&&(x!==sx||y!==sy))put(sx,sy)}
  }
  return subs;
}
/* profile for LatheGeometry: x=radius, y=height */
function pathToLathePts(d,cs){
  const sub=samplePath(d,cs||8)[0]||[];
  return sub.map(p=>new THREE.Vector2(Math.max(0,p.x),p.y));
}
/* exact THREE.Shape for ExtrudeGeometry */
function pathToShape(d){
  const cmds=parsePathCmds(d);const shape=new THREE.Shape();let x=0,y=0,sx=0,sy=0,began=false;
  for(const cm of cmds){const c=cm.c,n=cm.n;let i=0;
    if(c==='M'||c==='m'){let nx=n[0],ny=n[1];if(c==='m'){nx+=x;ny+=y}
      shape.moveTo(nx,ny);x=nx;y=ny;sx=nx;sy=ny;began=true;
      for(i=2;i+1<n.length;i+=2){let lx=n[i],ly=n[i+1];if(c==='m'){lx+=x;ly+=y}shape.lineTo(lx,ly);x=lx;y=ly}
    }else if(c==='L'||c==='l'){for(;i+1<n.length;i+=2){let nx=n[i],ny=n[i+1];if(c==='l'){nx+=x;ny+=y}shape.lineTo(nx,ny);x=nx;y=ny}
    }else if(c==='H'||c==='h'){for(;i<n.length;i++){let nx=n[i];if(c==='h')nx+=x;shape.lineTo(nx,y);x=nx}
    }else if(c==='V'||c==='v'){for(;i<n.length;i++){let ny=n[i];if(c==='v')ny+=y;shape.lineTo(x,ny);y=ny}
    }else if(c==='C'||c==='c'){for(;i+5<n.length;i+=6){
      let x1=n[i],y1=n[i+1],x2=n[i+2],y2=n[i+3],x3=n[i+4],y3=n[i+5];
      if(c==='c'){x1+=x;y1+=y;x2+=x;y2+=y;x3+=x;y3+=y}
      shape.bezierCurveTo(x1,y1,x2,y2,x3,y3);x=x3;y=y3}
    }else if(c==='Q'||c==='q'){for(;i+3<n.length;i+=4){
      let x1=n[i],y1=n[i+1],x2=n[i+2],y2=n[i+3];
      if(c==='q'){x1+=x;y1+=y;x2+=x;y2+=y}
      shape.quadraticCurveTo(x1,y1,x2,y2);x=x2;y=y2}
    }else if(c==='Z'||c==='z'){if(began)shape.closePath();x=sx;y=sy}
  }
  return shape;
}

/* ---------- merge geometries (handles mirrored matrices: flips winding) ---------- */
function mergeGeoms(items){
  const pos=[],norm=[],uv=[];
  for(const it of items){
    let g=it.geo.index?it.geo.toNonIndexed():it.geo.clone();
    if(it.mtx)g.applyMatrix4(it.mtx);
    const p=g.attributes.position.array;
    const nm=g.attributes.normal?g.attributes.normal.array:null;
    const u=g.attributes.uv?g.attributes.uv.array:null;
    const flip=it.mtx&&it.mtx.determinant()<0;
    const vc=p.length/3;
    if(!flip){
      for(let i=0;i<p.length;i++)pos.push(p[i]);
      if(nm)for(let i=0;i<nm.length;i++)norm.push(nm[i]);else for(let i=0;i<p.length;i++)norm.push(0);
      if(u)for(let i=0;i<u.length;i++)uv.push(u[i]);else for(let i=0;i<vc*2;i++)uv.push(0);
    }else{
      for(let t=0;t<vc;t+=3){
        const order=[t,t+2,t+1];
        for(const vi of order){pos.push(p[vi*3],p[vi*3+1],p[vi*3+2]);
          if(nm)norm.push(nm[vi*3],nm[vi*3+1],nm[vi*3+2]);else norm.push(0,0,0);
          if(u)uv.push(u[vi*2],u[vi*2+1]);else uv.push(0,0)}
      }
    }
    g.dispose();
  }
  const out=new THREE.BufferGeometry();
  out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  out.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3));
  out.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  return out;
}

/* compose matrix from pos, rot(deg), scale */
function composeMtx(p,r,s){
  const m=new THREE.Matrix4();
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler((r[0]||0)*DEG,(r[1]||0)*DEG,(r[2]||0)*DEG,'XYZ'));
  m.compose(new THREE.Vector3(p[0]||0,p[1]||0,p[2]||0),q,new THREE.Vector3(s[0],s[1],s[2]));
  return m;
}

/* name generator for planets/systems */
const _SYL_A=['ak','al','an','ar','be','bo','ca','ce','da','de','el','er','fa','ga','he','io','ja','ka','ke','ki','ko','la','le','lu','ma','me','mi','na','ne','no','or','os','pa','pro','ra','re','sa','se','sol','ta','te','ti','to','ur','va','ve','vo','xa','ze','zo'];
const _SYL_B=['bar','bel','dan','dor','dra','gan','gar','gon','lan','lor','lis','mar','mir','nar','nia','nis','nor','phos','ria','ris','ron','rus','tan','tara','thea','thos','tis','ton','tura','via','vis','von','wei','xis','yara','zar'];
const _ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
function genName(rng,idx){
  let s=_SYL_A[(rng()*_SYL_A.length)|0];
  s+=_SYL_B[(rng()*_SYL_B.length)|0];
  if(rng()<0.4)s+=_SYL_A[(rng()*_SYL_A.length)|0];
  s=s.charAt(0).toUpperCase()+s.slice(1);
  if(idx!==undefined)s+=' '+_ROMAN[idx%12];
  return s;
}
