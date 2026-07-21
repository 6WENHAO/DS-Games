import*as THREE from"three";
import{Simplex}from"./noise.js";
import{B,BLOCKS,TILE,tileUV,buildAtlas}from"./blocks.js";
import{mulberry32,hashStr,clamp,lerp}from"./util.js";

export const CHUNK=16,HEIGHT=96;
const FACES=[
  {dir:[-1,0,0],corners:[{pos:[0,1,0],uv:[0,1]},{pos:[0,0,0],uv:[0,0]},{pos:[0,1,1],uv:[1,1]},{pos:[0,0,1],uv:[1,0]}],shade:0.72},
  {dir:[1,0,0],corners:[{pos:[1,1,1],uv:[0,1]},{pos:[1,0,1],uv:[0,0]},{pos:[1,1,0],uv:[1,1]},{pos:[1,0,0],uv:[1,0]}],shade:0.72},
  {dir:[0,-1,0],corners:[{pos:[1,0,1],uv:[1,0]},{pos:[0,0,1],uv:[0,0]},{pos:[1,0,0],uv:[1,1]},{pos:[0,0,0],uv:[0,1]}],shade:0.5},
  {dir:[0,1,0],corners:[{pos:[0,1,1],uv:[1,1]},{pos:[1,1,1],uv:[0,1]},{pos:[0,1,0],uv:[1,0]},{pos:[1,1,0],uv:[0,0]}],shade:1},
  {dir:[0,0,-1],corners:[{pos:[1,0,0],uv:[0,0]},{pos:[0,0,0],uv:[1,0]},{pos:[1,1,0],uv:[0,1]},{pos:[0,1,0],uv:[1,1]}],shade:0.62},
  {dir:[0,0,1],corners:[{pos:[0,0,1],uv:[0,0]},{pos:[1,0,1],uv:[1,0]},{pos:[0,1,1],uv:[0,1]},{pos:[1,1,1],uv:[1,1]}],shade:0.82}
];
const AO_VALS=[0.42,0.62,0.82,1];

export class World{
  constructor(scene,planet,edits){
    this.scene=scene;
    this.planet=planet;
    this.edits=edits||{};
    this.seed=planet.seed;
    this.n1=new Simplex(this.seed);
    this.n2=new Simplex(this.seed+101);
    this.n3=new Simplex(this.seed+808);
    this.chunks=new Map();
    this.pending=new Map();
    this.dirty=new Set();
    this.meshQueue=[];
    this.presets=planet.presets||[];
    this.viewDist=5;
    const{tex,canvas}=buildAtlas(planet.palette);
    this.atlasCanvas=canvas;
    this.matOpaque=new THREE.MeshLambertMaterial({map:tex,vertexColors:true});
    this.matCutout=new THREE.MeshLambertMaterial({map:tex,vertexColors:true,alphaTest:0.4,side:THREE.DoubleSide});
    this.matWater=new THREE.MeshLambertMaterial({map:tex,vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide});
    this.group=new THREE.Group();
    scene.add(this.group);
    this.shadows=false;
  }
  key(cx,cz){return cx+","+cz;}
  heightAt(x,z){
    const p=this.planet;
    const cont=this.n1.fbm2(x*0.0038,z*0.0038,4)*13;
    const hills=this.n1.fbm2(x*0.016+50,z*0.016+50,3)*5.5;
    const m=this.n2.fbm2(x*0.0021+9,z*0.0021+9,2);
    const mask=clamp(m*1.6+0.15,0,1);
    const ridge=Math.pow(this.n2.ridge2(x*0.007,z*0.007,4),2.2)*34*mask;
    let h=Math.floor(34+cont+hills+ridge*p.mountain);
    return clamp(h,6,HEIGHT-14);
  }
  caveAt(x,y,z){
    if(y<3)return false;
    const n=this.n3.noise3D(x*0.058,y*0.075,z*0.058);
    const n2=this.n3.noise3D(x*0.021+40,y*0.033+40,z*0.021+40);
    return n>0.58||(n2>0.52&&n>0.3);
  }
  genColumnBlocks(data,lx,lz,wx,wz){
    const p=this.planet;
    const h=this.heightAt(wx,wz);
    const sea=p.seaLevel;
    const nearSea=h<=sea+1&&sea>0;
    for(let y=0;y<HEIGHT;y++){
      let id=B.AIR;
      if(y===0)id=B.STONE;
      else if(y<h-3){
        id=B.STONE;
        if(!nearSea&&this.caveAt(wx,y,wz))id=B.AIR;
        else{
          const o=this.n3.noise3D(wx*0.09+300,y*0.09+300,wz*0.09+300);
          if(o>0.62)id=B.FERRITE;
          else{
            const o2=this.n3.noise3D(wx*0.1+700,y*0.1+700,wz*0.1+700);
            if(o2>0.7&&y<26)id=B.COBALT;
          }
        }
      }
      else if(y<h)id=p.subBlock;
      else if(y===h)id=nearSea?p.beachBlock:p.topBlock;
      else if(y<=sea)id=B.WATER;
      if(id!==B.AIR)data[lx+lz*CHUNK+y*CHUNK*CHUNK]=id;
    }
    return h;
  }
  genChunk(cx,cz){
    const k=this.key(cx,cz);
    if(this.chunks.has(k))return this.chunks.get(k);
    const data=new Uint8Array(CHUNK*CHUNK*HEIGHT);
    const heights=new Int16Array(CHUNK*CHUNK);
    const x0=cx*CHUNK,z0=cz*CHUNK;
    for(let lz=0;lz<CHUNK;lz++)for(let lx=0;lx<CHUNK;lx++){
      heights[lx+lz*CHUNK]=this.genColumnBlocks(data,lx,lz,x0+lx,z0+lz);
    }
    const chunk={cx,cz,data,heights,meshes:null,decorated:false};
    this.chunks.set(k,chunk);
    this.decorate(chunk);
    const pend=this.pending.get(k);
    if(pend){
      for(const[idx,id]of pend)if(data[idx]===B.AIR||id===B.AIR)data[idx]=id;
      this.pending.delete(k);
    }
    for(const[pk,id]of Object.entries(this.edits)){
      const[ex,ey,ez]=pk.split(",").map(Number);
      if(ex>=x0&&ex<x0+CHUNK&&ez>=z0&&ez<z0+CHUNK){
        data[(ex-x0)+(ez-z0)*CHUNK+ey*CHUNK*CHUNK]=id;
      }
    }
    return chunk;
  }
  writeGen(wx,y,wz,id,force=false){
    if(y<0||y>=HEIGHT)return;
    const cx=Math.floor(wx/CHUNK),cz=Math.floor(wz/CHUNK);
    const k=this.key(cx,cz);
    const lx=wx-cx*CHUNK,lz=wz-cz*CHUNK;
    const idx=lx+lz*CHUNK+y*CHUNK*CHUNK;
    const ch=this.chunks.get(k);
    if(ch){
      if(force||ch.data[idx]===B.AIR)ch.data[idx]=id;
      if(ch.meshes)this.dirty.add(k);
    }else{
      if(!this.pending.has(k))this.pending.set(k,[]);
      this.pending.get(k).push([idx,id]);
    }
  }
  decorate(chunk){
    const p=this.planet;
    const{cx,cz,data,heights}=chunk;
    const x0=cx*CHUNK,z0=cz*CHUNK;
    const rng=mulberry32(hashStr(cx+"_"+cz+"_"+this.seed));
    for(const pre of this.presets){
      const pcx=Math.floor(pre.x/CHUNK),pcz=Math.floor(pre.z/CHUNK);
      if(Math.abs(pcx-cx)<=1&&Math.abs(pcz-cz)<=1)this.buildPreset(pre);
    }
    for(let lz=0;lz<CHUNK;lz++)for(let lx=0;lx<CHUNK;lx++){
      const wx=x0+lx,wz=z0+lz;
      let skipCol=false;
      for(const pre of this.presets){
        if(Math.abs(wx-pre.x)<10&&Math.abs(wz-pre.z)<10){skipCol=true;break;}
      }
      if(skipCol)continue;
      const h=heights[lx+lz*CHUNK];
      const top=data[lx+lz*CHUNK+h*CHUNK*CHUNK];
      if(top!==p.topBlock&&top!==p.beachBlock)continue;
      if(h<=p.seaLevel)continue;
      const r=rng();
      if(r<p.deco.tree&&top===p.topBlock){
        const th=3+Math.floor(rng()*3);
        for(let i=1;i<=th;i++)this.writeGen(wx,h+i,wz,p.treeTrunk,true);
        const ly=h+th;
        for(let dy=0;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
          const rr=Math.abs(dx)+Math.abs(dz)+dy*1.4;
          if(rr>3.6)continue;
          if(dx===0&&dz===0&&dy===0)continue;
          if(rng()<0.12)continue;
          this.writeGen(wx+dx,ly+dy,wz+dz,B.LEAVES);
        }
        this.writeGen(wx,ly+2,wz,B.LEAVES);
      }
      else if(p.deco.cactus>0&&r<p.deco.tree+p.deco.cactus){
        const chh=1+Math.floor(rng()*3);
        for(let i=1;i<=chh;i++)this.writeGen(wx,h+i,wz,B.CACTUS,true);
      }
      else if(r<0.25){
        const r2=rng();
        if(r2<p.deco.dihydro){
          const chh=1+Math.floor(rng()*2);
          for(let i=1;i<=chh;i++)this.writeGen(wx,h+i,wz,B.DIHYDRO,true);
        }
        else if(r2<p.deco.dihydro+p.deco.sodium)this.writeGen(wx,h+1,wz,B.SODIUM,true);
        else if(r2<p.deco.dihydro+p.deco.sodium+p.deco.oxygen)this.writeGen(wx,h+1,wz,B.OXYGEN,true);
        else if(r2<p.deco.dihydro+p.deco.sodium+p.deco.oxygen+p.deco.flower)this.writeGen(wx,h+1,wz,B.FLOWER,true);
        else if(r2<p.deco.dihydro+p.deco.sodium+p.deco.oxygen+p.deco.flower+p.deco.tuft)this.writeGen(wx,h+1,wz,B.TUFT,true);
      }
      if(rng()<0.0012){
        for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(let dy=1;dy<=2;dy++){
          if(rng()<0.5)this.writeGen(wx+dx,h+dy,wz+dz,B.COPPER,true);
        }
      }
      if(rng()<0.00045){
        for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)this.writeGen(wx+dx,h+1,wz+dz,B.MONOLITH,true);
        for(let i=2;i<=5;i++)this.writeGen(wx,h+i,wz,B.MONOLITH,true);
      }
    }
  }
  buildPreset(pre){
    if(pre.built)return;
    pre.built=true;
    const h=this.heightAt(pre.x,pre.z);
    pre.y=h;
    if(pre.type==="crash"){
      for(let dx=-7;dx<=7;dx++)for(let dz=-7;dz<=7;dz++){
        const wx=pre.x+dx,wz=pre.z+dz;
        const d=Math.hypot(dx,dz);
        if(d>7.5)continue;
        for(let y=h+1;y<h+14;y++)this.writeGen(wx,y,wz,B.AIR,true);
        const gid=d<4?B.DIRT:(this.n1.noise2D(wx*0.3,wz*0.3)>0?this.planet.topBlock:B.DIRT);
        this.writeGen(wx,h,wz,gid,true);
        this.writeGen(wx,h-1,wz,B.DIRT,true);
      }
      const rng=mulberry32(this.seed+9);
      for(let i=0;i<7;i++){
        const a=rng()*Math.PI*2,d=3+rng()*5;
        this.writeGen(pre.x+Math.round(Math.cos(a)*d),h+1,pre.z+Math.round(Math.sin(a)*d),B.PANEL,true);
      }
    }
    if(pre.type==="beacon"){
      for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++){
        for(let y=h+1;y<h+8;y++)this.writeGen(pre.x+dx,y,pre.z+dz,B.AIR,true);
        this.writeGen(pre.x+dx,h,pre.z+dz,B.PANEL,true);
      }
      this.writeGen(pre.x,h+1,pre.z,B.PANEL,true);
      this.writeGen(pre.x,h+2,pre.z,B.BEACON,true);
      this.writeGen(pre.x+2,h+1,pre.z+2,B.LIGHT,true);
      this.writeGen(pre.x-2,h+1,pre.z-2,B.LIGHT,true);
    }
    if(pre.type==="trader"){
      for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++){
        for(let y=h+1;y<h+9;y++)this.writeGen(pre.x+dx,y,pre.z+dz,B.AIR,true);
        this.writeGen(pre.x+dx,h,pre.z+dz,B.PANEL,true);
      }
      for(const[sx,sz]of[[-3,-3],[3,-3],[-3,3],[3,3]]){
        this.writeGen(pre.x+sx,h+1,pre.z+sz,B.PANEL,true);
        this.writeGen(pre.x+sx,h+2,pre.z+sz,B.LIGHT,true);
      }
      this.writeGen(pre.x,h+1,pre.z,B.BEACON,true);
    }
  }
  getBlock(x,y,z){
    if(y<0||y>=HEIGHT)return B.AIR;
    const cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK);
    const ch=this.chunks.get(this.key(cx,cz));
    if(!ch)return B.AIR;
    return ch.data[(x-cx*CHUNK)+(z-cz*CHUNK)*CHUNK+y*CHUNK*CHUNK];
  }
  isSolid(x,y,z){
    const b=this.getBlock(Math.floor(x),Math.floor(y),Math.floor(z));
    return BLOCKS[b].solid;
  }
  setBlock(x,y,z,id,record=true){
    if(y<1||y>=HEIGHT)return false;
    const cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK);
    const k=this.key(cx,cz);
    const ch=this.chunks.get(k);
    if(!ch)return false;
    const lx=x-cx*CHUNK,lz=z-cz*CHUNK;
    ch.data[lx+lz*CHUNK+y*CHUNK*CHUNK]=id;
    if(record)this.edits[x+","+y+","+z]=id;
    this.dirty.add(k);
    if(lx===0)this.dirty.add(this.key(cx-1,cz));
    if(lx===CHUNK-1)this.dirty.add(this.key(cx+1,cz));
    if(lz===0)this.dirty.add(this.key(cx,cz-1));
    if(lz===CHUNK-1)this.dirty.add(this.key(cx,cz+1));
    return true;
  }
  surfaceY(x,z){
    const cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK);
    const ch=this.chunks.get(this.key(cx,cz));
    if(!ch)return this.heightAt(x,z)+1;
    const lx=x-cx*CHUNK,lz=z-cz*CHUNK;
    for(let y=HEIGHT-1;y>0;y--){
      const b=ch.data[lx+lz*CHUNK+y*CHUNK*CHUNK];
      if(b!==B.AIR&&BLOCKS[b].solid)return y+1;
    }
    return 34;
  }
  update(px,pz,budget=2){
    const pcx=Math.floor(px/CHUNK),pcz=Math.floor(pz/CHUNK);
    const R=this.viewDist;
    const want=[];
    for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){
      const d=Math.sqrt(dx*dx+dz*dz);
      if(d>R+0.5)continue;
      want.push([pcx+dx,pcz+dz,d]);
    }
    want.sort((a,b)=>a[2]-b[2]);
    let built=0;
    for(const[cx,cz]of want){
      const k=this.key(cx,cz);
      let ch=this.chunks.get(k);
      if(!ch){
        ch=this.genChunk(cx,cz);
        built++;
      }
      if(!ch.meshes&&built<=budget+2){
        this.genChunk(cx+1,cz);this.genChunk(cx-1,cz);this.genChunk(cx,cz+1);this.genChunk(cx,cz-1);
        this.meshChunk(ch);
        built++;
      }
      if(built>budget)break;
    }
    for(const k of this.dirty){
      const ch=this.chunks.get(k);
      if(ch&&ch.meshes)this.meshChunk(ch);
    }
    this.dirty.clear();
    for(const[k,ch]of this.chunks){
      const d=Math.max(Math.abs(ch.cx-pcx),Math.abs(ch.cz-pcz));
      if(d>R+2&&ch.meshes){
        this.disposeMeshes(ch);
      }
      if(d>R+4){
        this.disposeMeshes(ch);
        this.chunks.delete(k);
      }
    }
  }
  disposeMeshes(ch){
    if(!ch.meshes)return;
    for(const m of ch.meshes){
      this.group.remove(m);
      m.geometry.dispose();
    }
    ch.meshes=null;
  }
  occludes(id){
    if(id===B.AIR)return false;
    const d=BLOCKS[id];
    return d.solid&&!d.cutout&&!d.cross&&!d.water;
  }
  meshChunk(ch){
    this.disposeMeshes(ch);
    const{cx,cz,data}=ch;
    const x0=cx*CHUNK,z0=cz*CHUNK;
    const buckets={op:{pos:[],nor:[],uv:[],col:[],idx:[]},cut:{pos:[],nor:[],uv:[],col:[],idx:[]},wat:{pos:[],nor:[],uv:[],col:[],idx:[]}};
    const get=(x,y,z)=>{
      if(y<0||y>=HEIGHT)return B.AIR;
      if(x>=0&&x<CHUNK&&z>=0&&z<CHUNK)return data[x+z*CHUNK+y*CHUNK*CHUNK];
      return this.getBlock(x0+x,y,z0+z);
    };
    for(let y=0;y<HEIGHT;y++)for(let lz=0;lz<CHUNK;lz++)for(let lx=0;lx<CHUNK;lx++){
      const id=data[lx+lz*CHUNK+y*CHUNK*CHUNK];
      if(id===B.AIR)continue;
      const def=BLOCKS[id];
      const glow=def.glow||0;
      if(def.cross){
        const bkt=buckets.cut;
        const t=def.tiles.all;
        const[u0,v0,u1,v1]=tileUV(t);
        const base=bkt.pos.length/3;
        const l=0.14,hgt=0.9;
        const quads=[
          [[l,0,l],[1-l,0,1-l],[l,hgt,l],[1-l,hgt,1-l]],
          [[1-l,0,l],[l,0,1-l],[1-l,hgt,l],[l,hgt,1-l]]
        ];
        const bright=1+glow*1.4;
        for(let q=0;q<2;q++){
          const[a,b,c2,d2]=quads[q];
          bkt.pos.push(lx+a[0],y+a[1],lz+a[2],lx+b[0],y+b[1],lz+b[2],lx+c2[0],y+c2[1],lz+c2[2],lx+d2[0],y+d2[1],lz+d2[2]);
          for(let i=0;i<4;i++){bkt.nor.push(0,1,0);bkt.col.push(bright,bright,bright);}
          bkt.uv.push(u0,v0,u1,v0,u0,v1,u1,v1);
          const s=base+q*4;
          bkt.idx.push(s,s+1,s+2,s+2,s+1,s+3);
        }
        continue;
      }
      const isWater=!!def.water;
      const isCut=!!def.cutout;
      const bkt=isWater?buckets.wat:(isCut?buckets.cut:buckets.op);
      for(const face of FACES){
        const[dx,dy,dz]=face.dir;
        const nb=get(lx+dx,y+dy,lz+dz);
        if(isWater){
          if(nb!==B.AIR&&!BLOCKS[nb].cross)continue;
        }else if(isCut){
          if(nb===id)continue;
          if(this.occludes(nb))continue;
        }else{
          if(this.occludes(nb))continue;
        }
        let t=def.tiles.all;
        if(def.tiles.top!==undefined){
          if(dy===1)t=def.tiles.top;
          else if(dy===-1)t=def.tiles.bottom;
          else t=def.tiles.side;
        }
        const[u0,v0,u1,v1]=tileUV(t);
        const base=bkt.pos.length/3;
        const axis=dx!==0?0:(dy!==0?1:2);
        for(const corner of face.corners){
          const[px,py,pz]=corner.pos;
          bkt.pos.push(lx+px,y+py,lz+pz);
          bkt.nor.push(dx,dy,dz);
          bkt.uv.push(corner.uv[0]===0?u0:u1,corner.uv[1]===0?v0:v1);
          let ao=1;
          if(!isWater){
            const d1=(axis+1)%3,d2=(axis+2)%3;
            const cpos=[px,py,pz];
            const s1=cpos[d1]===1?1:-1,s2=cpos[d2]===1?1:-1;
            const bx=lx+dx,by=y+dy,bz=lz+dz;
            const c1=[bx,by,bz];c1[d1]+=s1;
            const c2=[bx,by,bz];c2[d2]+=s2;
            const c3=[bx,by,bz];c3[d1]+=s1;c3[d2]+=s2;
            const b1=this.occludes(get(c1[0],c1[1],c1[2]))?1:0;
            const b2=this.occludes(get(c2[0],c2[1],c2[2]))?1:0;
            const b3=this.occludes(get(c3[0],c3[1],c3[2]))?1:0;
            const aoi=(b1&&b2)?0:3-(b1+b2+b3);
            ao=AO_VALS[aoi];
          }
          const bright=face.shade*ao*(1+glow*1.5)+(glow>0.6?0.3:0);
          bkt.col.push(bright,bright,bright);
        }
        bkt.idx.push(base,base+1,base+2,base+2,base+1,base+3);
      }
    }
    const meshes=[];
    const mk=(bkt,mat,renderOrder=0)=>{
      if(bkt.idx.length===0)return;
      const g=new THREE.BufferGeometry();
      g.setAttribute("position",new THREE.Float32BufferAttribute(bkt.pos,3));
      g.setAttribute("normal",new THREE.Float32BufferAttribute(bkt.nor,3));
      g.setAttribute("uv",new THREE.Float32BufferAttribute(bkt.uv,2));
      g.setAttribute("color",new THREE.Float32BufferAttribute(bkt.col,3));
      g.setIndex(bkt.idx);
      g.computeBoundingSphere();
      const m=new THREE.Mesh(g,mat);
      m.position.set(x0,0,z0);
      m.renderOrder=renderOrder;
      if(this.shadows&&mat===this.matOpaque){m.castShadow=true;m.receiveShadow=true;}
      this.group.add(m);
      meshes.push(m);
    };
    mk(buckets.op,this.matOpaque);
    mk(buckets.cut,this.matCutout);
    mk(buckets.wat,this.matWater,2);
    ch.meshes=meshes;
  }
  raycast(origin,dir,maxDist=7){
    let x=Math.floor(origin.x),y=Math.floor(origin.y),z=Math.floor(origin.z);
    const stepX=dir.x>0?1:-1,stepY=dir.y>0?1:-1,stepZ=dir.z>0?1:-1;
    const tDeltaX=Math.abs(1/(dir.x||1e-10)),tDeltaY=Math.abs(1/(dir.y||1e-10)),tDeltaZ=Math.abs(1/(dir.z||1e-10));
    let tMaxX=tDeltaX*(dir.x>0?(x+1-origin.x):(origin.x-x));
    let tMaxY=tDeltaY*(dir.y>0?(y+1-origin.y):(origin.y-y));
    let tMaxZ=tDeltaZ*(dir.z>0?(z+1-origin.z):(origin.z-z));
    let nx=0,ny=0,nz=0,t=0;
    for(let i=0;i<maxDist*3+10;i++){
      const id=this.getBlock(x,y,z);
      if(id!==B.AIR&&!BLOCKS[id].water){
        return{x,y,z,nx,ny,nz,id,dist:t};
      }
      if(tMaxX<tMaxY&&tMaxX<tMaxZ){
        x+=stepX;t=tMaxX;tMaxX+=tDeltaX;nx=-stepX;ny=0;nz=0;
      }else if(tMaxY<tMaxZ){
        y+=stepY;t=tMaxY;tMaxY+=tDeltaY;nx=0;ny=-stepY;nz=0;
      }else{
        z+=stepZ;t=tMaxZ;tMaxZ+=tDeltaZ;nx=0;ny=0;nz=-stepZ;
      }
      if(t>maxDist)break;
    }
    return null;
  }
  dispose(){
    for(const[,ch]of this.chunks)this.disposeMeshes(ch);
    this.chunks.clear();
    this.scene.remove(this.group);
    this.matOpaque.map.dispose();
    this.matOpaque.dispose();this.matCutout.dispose();this.matWater.dispose();
  }
}

export class Environment{
  constructor(scene,planet){
    this.scene=scene;
    this.planet=planet;
    this.t=0.3;
    this.dayLength=560;
    this.sun=new THREE.DirectionalLight(0xffffff,1.9);
    this.sun.position.set(60,100,40);
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.hemi=new THREE.HemisphereLight(0xcfe8ff,0x3a3226,0.75);
    scene.add(this.hemi);
    const skyGeo=new THREE.SphereGeometry(640,20,14);
    this.skyMat=new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{
        top:{value:new THREE.Color(planet.palette.skyTop)},
        bot:{value:new THREE.Color(planet.palette.skyBot)},
        sunDir:{value:new THREE.Vector3(0,1,0)},
        sunCol:{value:new THREE.Color(0xffe0b0)},
        night:{value:0}
      },
      vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;}`,
      fragmentShader:`varying vec3 vDir;uniform vec3 top;uniform vec3 bot;uniform vec3 sunDir;uniform vec3 sunCol;uniform float night;
      void main(){
        float h=clamp(vDir.y*0.5+0.5,0.0,1.0);
        vec3 col=mix(bot,top,pow(h,0.75));
        float s=clamp(dot(normalize(vDir),normalize(sunDir)),0.0,1.0);
        col+=sunCol*pow(s,110.0)*1.4;
        col+=sunCol*pow(s,7.0)*0.28*(1.0-night*0.6);
        col=mix(col,col*vec3(0.08,0.1,0.17),night);
        gl_FragColor=vec4(col,1.0);
      }`
    });
    this.sky=new THREE.Mesh(skyGeo,this.skyMat);
    this.sky.renderOrder=-10;
    scene.add(this.sky);
    const starGeo=new THREE.BufferGeometry();
    const sp=[];
    const rng=mulberry32(planet.seed+55);
    for(let i=0;i<700;i++){
      const a=rng()*Math.PI*2,b=Math.acos(rng()*2-1);
      const r=600;
      sp.push(r*Math.sin(b)*Math.cos(a),Math.abs(r*Math.cos(b))*0.9+30,r*Math.sin(b)*Math.sin(a));
    }
    starGeo.setAttribute("position",new THREE.Float32BufferAttribute(sp,3));
    this.starMat=new THREE.PointsMaterial({color:0xffffff,size:1.6,sizeAttenuation:false,transparent:true,opacity:0,fog:false});
    this.stars=new THREE.Points(starGeo,this.starMat);
    scene.add(this.stars);
    const cloudGeo=new THREE.BoxGeometry(1,1,1);
    this.cloudMat=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:0.82});
    this.clouds=new THREE.InstancedMesh(cloudGeo,this.cloudMat,140);
    const dummy=new THREE.Object3D();
    this.cloudData=[];
    const crng=mulberry32(planet.seed+77);
    for(let i=0;i<140;i++){
      const cxp=(crng()-0.5)*560,czp=(crng()-0.5)*560;
      const w=8+crng()*20,d2=8+crng()*20,hh=1.4+crng()*1.6;
      const y=84+crng()*7;
      this.cloudData.push({x:cxp,z:czp,w,d:d2,h:hh,y});
      dummy.position.set(cxp,y,czp);
      dummy.scale.set(w,hh,d2);
      dummy.updateMatrix();
      this.clouds.setMatrixAt(i,dummy.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate=true;
    scene.add(this.clouds);
    scene.fog=new THREE.Fog(new THREE.Color(planet.palette.fog),50,340);
    this.fogColor=new THREE.Color(planet.palette.fog);
    this.driftT=0;
  }
  setViewDist(vd){
    this.scene.fog.far=Math.max(180,vd*CHUNK*4.4);
    this.scene.fog.near=this.scene.fog.far*0.24;
  }
  update(dt,center,speedT=1){
    this.t=(this.t+dt/this.dayLength*speedT)%1;
    const ang=this.t*Math.PI*2-Math.PI/2;
    const sunY=Math.sin(ang),sunX=Math.cos(ang)*0.8,sunZ=Math.cos(ang)*0.45;
    const sd=new THREE.Vector3(sunX,sunY,sunZ).normalize();
    this.sun.position.copy(center).addScaledVector(sd,120);
    this.sun.target.position.copy(center);
    const day=clamp(sunY*2.2+0.25,0,1);
    const dusk=clamp(1-Math.abs(sunY)*4,0,1)*(sunY>-0.2?1:0);
    this.sun.intensity=lerp(0.04,1.9,day);
    this.hemi.intensity=lerp(0.16,0.95,day);
    const sc=new THREE.Color(0xfff3e0).lerp(new THREE.Color(0xff8a3c),dusk);
    this.sun.color.copy(sc);
    this.skyMat.uniforms.sunDir.value.copy(sd);
    this.skyMat.uniforms.night.value=1-day;
    this.skyMat.uniforms.sunCol.value.copy(sc);
    this.starMat.opacity=(1-day)*0.95;
    this.sky.position.copy(center);
    this.stars.position.copy(center);
    const fogNight=this.fogColor.clone().multiplyScalar(lerp(0.12,1,day));
    fogNight.lerp(new THREE.Color(0xff9d5c),dusk*0.35);
    this.scene.fog.color.copy(fogNight);
    if(this.scene.background===null||this.scene.background===undefined)this.scene.background=null;
    this.driftT+=dt;
    const gx=Math.round(center.x/560)*560,gz=Math.round(center.z/560)*560;
    this.clouds.position.set(gx+Math.sin(this.driftT*0.008)*80+this.driftT*0.9%280,0,gz);
    this.cloudMat.opacity=lerp(0.25,0.8,day);
    this.dayFactor=day;
  }
  dispose(){
    this.scene.remove(this.sky,this.stars,this.clouds,this.sun,this.sun.target,this.hemi);
    this.sky.geometry.dispose();this.skyMat.dispose();
    this.stars.geometry.dispose();this.starMat.dispose();
    this.clouds.geometry.dispose();this.cloudMat.dispose();
  }
}
