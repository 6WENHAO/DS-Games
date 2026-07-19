'use strict';
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.autoClear = false;
renderer.domElement.className='game';
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74, innerWidth/innerHeight, 0.08, 900);
const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(56, innerWidth/innerHeight, 0.01, 10);
let SHADOW_RANGE=60;
function applyQuality(){
const q = SETTINGS.quality;
renderer.setPixelRatio(q===0?Math.min(devicePixelRatio,1):(q===1?Math.min(devicePixelRatio,1.5):Math.min(devicePixelRatio,2)));
// 紧凑阴影视锥跟随玩家: 大幅减少每帧阴影绘制的物体数
SHADOW_RANGE=q===0?42:(q===1?60:80);
sun.shadow.camera.left=-SHADOW_RANGE; sun.shadow.camera.right=SHADOW_RANGE;
sun.shadow.camera.top=SHADOW_RANGE; sun.shadow.camera.bottom=-SHADOW_RANGE;
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.mapSize.setScalar(q===0?1024:(q===1?1536:2048));
if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map=null; }
// 高画质: 软阴影 + 电影感滤镜; 低画质硬阴影无滤镜
renderer.shadowMap.type=q===2?THREE.PCFSoftShadowMap:THREE.PCFShadowMap;
renderer.domElement.style.filter=q===2?'saturate(1.1) contrast(1.06) brightness(1.02)':(q===1?'saturate(1.04) contrast(1.02)':'none');
scene.fog.far = (q===0?240:(q===1?340:420))*((WEATHER==='rain'||WEATHER==='storm')?0.78:(WEATHER==='snow'?0.85:1));
}
addEventListener('resize',()=>{
camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix();
vmCamera.aspect=camera.aspect; vmCamera.updateProjectionMatrix();
renderer.setSize(innerWidth,innerHeight);
});
scene.fog = new THREE.Fog(THEME.fog, 40, 340);
let SKY=null;
{
const c=document.createElement('canvas'); c.width=16; c.height=256;
const g=c.getContext('2d');
const gr=g.createLinearGradient(0,0,0,256);
const st=THEME.sky;
gr.addColorStop(0,st[0]); gr.addColorStop(0.42,st[1]);
gr.addColorStop(0.62,st[2]); gr.addColorStop(0.75,st[3]); gr.addColorStop(1,st[4]);
g.fillStyle=gr; g.fillRect(0,0,16,256);
const tex=new THREE.CanvasTexture(c); tex.colorSpace=THREE.SRGBColorSpace;
SKY=new THREE.Mesh(new THREE.SphereGeometry(760,24,16), new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,fog:false}));
SKY.frustumCulled=false;
scene.add(SKY);
}
const hemi = new THREE.HemisphereLight(THEME.hemi[0], THEME.hemi[1], THEME.hemi[2]);
scene.add(hemi);
const sun = new THREE.DirectionalLight(THEME.sun, THEME.sunI);
sun.position.set(-90, 120, 40);
sun.castShadow = true;
sun.shadow.camera.left=-60; sun.shadow.camera.right=60;
sun.shadow.camera.top=60; sun.shadow.camera.bottom=-60;
sun.shadow.camera.far=400; sun.shadow.bias=-0.0012; sun.shadow.normalBias=0.02;
scene.add(sun); scene.add(sun.target);
function updateSunShadow(){
// 阴影视锥跟随相机, 按纹素网格对齐减少闪烁
const texel=SHADOW_RANGE*2/sun.shadow.mapSize.x;
const cx=Math.round(camera.position.x/texel)*texel;
const cz=Math.round(camera.position.z/texel)*texel;
sun.target.position.set(cx,0,cz);
sun.position.set(cx-72,96,cz+32);
}
{
const c=document.createElement('canvas'); c.width=128; c.height=128;
const g=c.getContext('2d');
const gr=g.createRadialGradient(64,64,2,64,64,64);
gr.addColorStop(0,'rgba(255,250,230,1)'); gr.addColorStop(0.25,'rgba(255,240,200,.55)'); gr.addColorStop(1,'rgba(255,240,200,0)');
g.fillStyle=gr; g.fillRect(0,0,128,128);
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),fog:false,depthWrite:false}));
sp.position.set(-380,480,170); sp.scale.setScalar(220); scene.add(sp);
}
{
const c=document.createElement('canvas'); c.width=256; c.height=128;
const g=c.getContext('2d');
for(let i=0;i<46;i++){
const x=rand(30,226),y=rand(40,90),r=rand(14,34);
const gr=g.createRadialGradient(x,y,1,x,y,r);
gr.addColorStop(0,'rgba(255,255,255,.22)'); gr.addColorStop(1,'rgba(255,255,255,0)');
g.fillStyle=gr; g.fillRect(0,0,256,128);
}
const tex=new THREE.CanvasTexture(c);
for(let i=0;i<9;i++){
const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:rand(.5,.85),fog:false,depthWrite:false}));
sp.position.set(rand(-600,600), rand(180,280), rand(-600,600));
sp.scale.set(rand(180,340),rand(60,110),1);
scene.add(sp);
}
}
vmScene.add(new THREE.HemisphereLight(0xcfd8e8, 0x5a5844, 0.9));
{ const l=new THREE.DirectionalLight(0xffeed0,1.6); l.position.set(-1,1.6,0.6); vmScene.add(l); }
