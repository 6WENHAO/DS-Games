// ---------- canvas texture helpers ----------
function cvs(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}
function tex(canvas, repeat = 1, ry = null) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, ry ?? repeat);
  t.magFilter = THREE.NearestFilter;
  t.anisotropy = 1;
  return t;
}

function floorTexture() {
  const c = cvs(256, 256), x = c.getContext('2d');
  x.fillStyle = '#c9c6ba'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) {
    const g = 150 + Math.random() * 90;
    x.fillStyle = `rgba(${g},${g},${g-10},0.25)`;
    x.fillRect(Math.random()*256, Math.random()*256, 2, 2);
  }
  x.strokeStyle = 'rgba(90,90,85,0.55)'; x.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke();
  }
  return c;
}
function wallTexture() {
  const c = cvs(256, 256), x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#d8d4c6'); grd.addColorStop(1, '#c2beb0');
  x.fillStyle = grd; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2000; i++) {
    x.fillStyle = `rgba(120,116,105,${Math.random()*0.08})`;
    x.fillRect(Math.random()*256, Math.random()*256, 3, 1);
  }
  const gg = x.createLinearGradient(0, 200, 0, 256);
  gg.addColorStop(0, 'rgba(70,60,45,0)'); gg.addColorStop(1, 'rgba(60,50,35,0.4)');
  x.fillStyle = gg; x.fillRect(0, 200, 256, 56);
  return c;
}
function ceilTexture() {
  const c = cvs(256, 256), x = c.getContext('2d');
  x.fillStyle = '#b9b6ac'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#8f8c82'; x.lineWidth = 4;
  x.strokeRect(6, 6, 244, 244);
  for (let i = 0; i < 800; i++) {
    x.fillStyle = `rgba(90,90,85,${Math.random()*0.3})`;
    x.fillRect(Math.random()*256, Math.random()*256, 2, 2);
  }
  return c;
}
function productTexture(base, name) {
  const c = cvs(128, 128), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 128, 128);
  x.fillStyle = 'rgba(255,255,255,0.9)'; x.fillRect(10, 44, 108, 40);
  x.fillStyle = '#222'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center';
  x.fillText(name, 64, 74);
  x.fillStyle = 'rgba(0,0,0,0.15)'; x.fillRect(0, 100, 128, 28);
  return c;
}

const MAT = {};
function initMats() {
  MAT.floor = patchMaterial(new THREE.MeshStandardMaterial({ map: tex(floorTexture(), 8, 12), roughness: 0.7 }));
  MAT.wall = patchMaterial(new THREE.MeshStandardMaterial({ map: tex(wallTexture(), 4, 1.5), roughness: 0.9 }));
  MAT.ceil = patchMaterial(new THREE.MeshStandardMaterial({ map: tex(ceilTexture(), 6, 8), roughness: 1 }));
  MAT.metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.6 });
  MAT.shelf = patchMaterial(new THREE.MeshStandardMaterial({ color: 0xd9d4c8, roughness: 0.8 }));
  MAT.dark = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.8 });
  MAT.glass = new THREE.MeshStandardMaterial({ color: 0x223033, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.35 });
  MAT.counter = patchMaterial(new THREE.MeshStandardMaterial({ color: 0xbcae8e, roughness: 0.6 }));
  MAT.wood = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x6b4e34, roughness: 0.7 }));
}

class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.colliders = [];
    this.interactables = [];
    this.lights = [];
    this.ceilingPanels = [];
    initMats();
    this.build();
  }

  addCollider(minX, maxX, minZ, maxZ) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  box(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    this.group.add(m);
    return m;
  }

  build() {
    const W = 12, D = 18, H = 3.1;
    const hx = W / 2, hz = D / 2;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), MAT.floor);
    floor.rotation.x = -Math.PI / 2; this.group.add(floor);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), MAT.ceil);
    ceil.rotation.x = Math.PI / 2; ceil.position.y = H; this.group.add(ceil);

    const wallGeoNS = new THREE.PlaneGeometry(W, H);
    const wallGeoEW = new THREE.PlaneGeometry(D, H);
    const mk = (geo, x, y, z, ry) => {
      const m = new THREE.Mesh(geo, MAT.wall);
      m.position.set(x, y, z); m.rotation.y = ry; this.group.add(m); return m;
    };
    mk(wallGeoNS, 0, H/2, -hz, 0);
    mk(wallGeoEW, -hx, H/2, 0, Math.PI/2);
    mk(wallGeoEW, hx, H/2, 0, -Math.PI/2);
    const sideW = (W - 3.2) / 2;
    const sg = new THREE.PlaneGeometry(sideW, H);
    mk(sg, -(1.6 + sideW/2), H/2, hz, Math.PI);
    mk(sg, (1.6 + sideW/2), H/2, hz, Math.PI);
    const topg = new THREE.PlaneGeometry(3.2, 0.9);
    const topm = new THREE.Mesh(topg, MAT.wall); topm.position.set(0, H-0.45, hz); topm.rotation.y = Math.PI; this.group.add(topm);

    this.addCollider(-hx-1, -hx+0.15, -hz, hz);
    this.addCollider(hx-0.15, hx+1, -hz, hz);
    this.addCollider(-hx, hx, -hz-1, -hz+0.15);
    this.addCollider(-hx, -1.6, hz-0.15, hz+1);
    this.addCollider(1.6, hx, hz-0.15, hz+1);

    this.buildEntrance(hz);
    this.buildLights(W, D, H);

    this.buildShelf(-2.0, 0, 5.5);
    this.buildShelf(2.0, 0, 5.5);
    this.buildShelf(-2.0, -6.2, 4.5);
    this.buildShelf(2.0, -6.2, 4.5);

    this.buildFridge(0, -hz + 0.55, H);
    this.buildCounter(hx - 2.0, hz - 3.2);
    this.buildBackDoor(-hx, -hz + 3.0, H);
    this.buildProps();
    this.placeInteractables(hx, hz, H);
  }

  buildEntrance(hz) {
    this.box(0.15, 2.4, 0.15, MAT.metal, -1.5, 1.2, hz);
    this.box(0.15, 2.4, 0.15, MAT.metal, 1.5, 1.2, hz);
    this.box(3.2, 0.15, 0.15, MAT.metal, 0, 2.35, hz);
    this.doorL = this.box(1.4, 2.2, 0.06, MAT.glass, -0.75, 1.15, hz);
    this.doorR = this.box(1.4, 2.2, 0.06, MAT.glass, 0.75, 1.15, hz);
    this.doorL.userData.baseX = -0.75; this.doorR.userData.baseX = 0.75;
    const outMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    this.box(2.4, 2.0, 0.02, outMat, -3.2, 1.2, hz + 0.05);
    this.box(2.4, 2.0, 0.02, outMat, 3.2, 1.2, hz + 0.05);
    const lamp = new THREE.PointLight(0x668099, 1.4, 16, 2);
    lamp.position.set(0, 2.2, hz + 3); this.group.add(lamp);
  }

  buildLights(W, D, H) {
    const panelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d8, emissiveIntensity: 1.2 });
    const positions = [
      [-2.5, -5], [2.5, -5], [-2.5, 0], [2.5, 0], [-2.5, 5], [2.5, 5],
    ];
    for (const [x, z] of positions) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.5), panelMat.clone());
      panel.position.set(x, H - 0.05, z); this.group.add(panel);
      const pl = new THREE.PointLight(0xfff2d6, 1.1, 13, 2);
      pl.position.set(x, H - 0.4, z); this.group.add(pl);
      this.lights.push(pl); this.ceilingPanels.push(panel);
    }
    this.ambient = new THREE.AmbientLight(0x40474f, 0.5);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xbfc7cf, 0x2a2620, 0.35);
    this.scene.add(this.hemi);
  }

  buildShelf(x, z, len) {
    const g = new THREE.Group();
    const w = 1.4, h = 1.7;
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), MAT.shelf);
    base.position.set(x, h/2, z); g.add(base);
    const cols = ['#c0392b','#2980b9','#27ae60','#e67e22','#8e44ad','#16a085','#d35400','#c0392b'];
    const names = ['茶','水','面','零','饭','罐','酒','盐'];
    for (let side of [-1, 1]) {
      for (let level = 0; level < 3; level++) {
        const ly = 0.45 + level * 0.55;
        const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.04, len - 0.1), MAT.metal);
        ledge.position.set(x + side * (w/2 - 0.12), ly + 0.24, z); g.add(ledge);
        const count = Math.floor(len / 0.34);
        for (let i = 0; i < count; i++) {
          const ci = (level + i + (side>0?4:0)) % cols.length;
          const pm = new THREE.MeshStandardMaterial({ map: tex(productTexture(cols[ci], names[ci]), 1, 1), roughness: 0.6 });
          const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.26, 0.16), pm);
          p.position.set(x + side * (w/2 - 0.1), ly + 0.37, z - len/2 + 0.25 + i*0.34);
          g.add(p);
        }
      }
    }
    this.group.add(g);
    this.addCollider(x - w/2 - 0.15, x + w/2 + 0.15, z - len/2, z + len/2);
  }

  buildFridge(x, z, H) {
    const w = 8, h = 2.4, d = 0.9;
    this.box(w, h, d, MAT.dark, x, h/2, z);
    const inner = new THREE.PointLight(0xd8ecff, 0.8, 6, 2);
    inner.position.set(x, 1.6, z + 0.3); this.group.add(inner); this.lights.push(inner);
    const cols = ['#3aa0ff','#ffcf3a','#59d97a','#ff6b6b','#c58bff'];
    for (let level = 0; level < 4; level++) {
      for (let i = 0; i < 22; i++) {
        const pm = new THREE.MeshStandardMaterial({ color: cols[(level+i)%cols.length], roughness: 0.4 });
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 6), pm);
        p.position.set(x - w/2 + 0.3 + i*0.34, 0.5 + level*0.5, z + 0.2);
        this.group.add(p);
      }
    }
    this.box(w, h - 0.2, 0.04, MAT.glass, x, h/2, z + d/2 + 0.02);
    this.addCollider(x - w/2, x + w/2, z - d/2, z + d/2 + 0.1);
  }

  buildCounter(x, z) {
    this.box(3.2, 1.0, 0.8, MAT.counter, x, 0.5, z);
    this.addCollider(x - 1.6, x + 1.6, z - 0.4, z + 0.4);
    this.register = this.box(0.5, 0.35, 0.4, MAT.dark, x - 0.5, 1.15, z);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x113322, emissive: 0x1a5a33, emissiveIntensity: 0.8 }));
    screen.position.set(x - 0.5, 1.2, z - 0.21); screen.rotation.y = Math.PI; this.group.add(screen);
    const cl = new THREE.PointLight(0xffe0b0, 0.7, 5, 2);
    cl.position.set(x, 2.2, z); this.group.add(cl); this.lights.push(cl);
    // light switch panel on wall near counter
    const hx = 6;
    const swPan = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.22, 0.04), MAT.metal);
    swPan.position.set(hx - 0.2, 1.3, 9 - 1.0); this.group.add(swPan);
    const swBut = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xff4444, emissive: 0xff2222, emissiveIntensity: 1 }));
    swBut.position.set(hx - 0.2, 1.3, 9 - 1.0); this.group.add(swBut);
    this.lightSwitchBut = swBut;
    this.counterPos = new THREE.Vector3(x, 1.0, z);
  }

  buildBackDoor(wallX, z, H) {
    const dm = patchMaterial(new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.6, metalness: 0.3 }));
    this.backDoor = this.box(0.12, 2.2, 1.1, dm, wallX + 0.12, 1.1, z);
    this.backDoor.userData.baseZ = z;
    this.box(0.16, 2.3, 0.1, MAT.metal, wallX + 0.1, 1.15, z - 0.6);
    this.box(0.16, 2.3, 0.1, MAT.metal, wallX + 0.1, 1.15, z + 0.6);
    const sc = cvs(128, 64), sx = sc.getContext('2d');
    sx.fillStyle = '#111'; sx.fillRect(0,0,128,64);
    sx.fillStyle = '#e8c37a'; sx.font = 'bold 18px sans-serif'; sx.textAlign='center';
    sx.fillText('闲人免进', 64, 28); sx.font='11px sans-serif'; sx.fillText('严禁入内', 64, 48);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc) }));
    sign.position.set(wallX + 0.2, 1.9, z); sign.rotation.y = Math.PI/2; this.group.add(sign);
    this.backDoorPos = new THREE.Vector3(wallX, 1.1, z);
  }

  buildProps() {
    this.box(0.5, 0.6, 0.5, new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: .6 }), 5, 0.3, -7.5);
    this.box(0.45, 0.7, 0.45, MAT.dark, -5.3, 0.35, 7);
    const boxMat = patchMaterial(new THREE.MeshStandardMaterial({ color: 0xb5915a, roughness: 0.9 }));
    this.stockBoxes = [];
    for (let i = 0; i < 3; i++) {
      const b = this.box(0.5, 0.5, 0.5, boxMat, -4.8 + i*0.05, 0.25 + i*0.5, 6.6);
      this.stockBoxes.push(b);
    }
    this.box(1.2, 0.4, 0.6, MAT.metal, 0, 2.7, 7);
  }

  placeInteractables(hx, hz, H) {
    const add = (id, pos, label, radius = 1.6, data = {}) => {
      this.interactables.push({ id, position: pos.clone(), label, radius, done: false, ...data });
    };
    // light switch on wall near counter
    add('lights', new THREE.Vector3(hx - 0.2, 1.3, hz - 1.0), '打开店内的灯', 1.8);
    // time clock near back door
    add('timeclock', new THREE.Vector3(-hx + 0.4, 1.3, -hz + 4.6), '打卡上班');
    const panel = this.box(0.4, 0.5, 0.1, MAT.dark, -hx + 0.2, 1.3, -hz + 4.6);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.03, 8),
      new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff2222, emissiveIntensity: 1 }));
    led.position.set(-hx + 0.26, 1.42, -hz + 4.6); led.rotation.y = Math.PI/2; this.group.add(led);
    this.clockLed = led;
    add('register', this.counterPos.clone().setY(1.2), '查看收银机');
    add('stock', new THREE.Vector3(-4.7, 1.0, 6.4), '将货物上架');
    add('fridge', new THREE.Vector3(0, 1.4, -hz + 1.5), '补充冷藏柜');
    add('backdoor', this.backDoorPos.clone().setY(1.2), '查看后面的仓库', 1.6, { locked: true });
    this.box(0.2, 0.02, 0.28, new THREE.MeshStandardMaterial({ color: 0xf2ecd8 }),
      this.counterPos.x + 0.9, 1.02, this.counterPos.z);
    add('note', new THREE.Vector3(this.counterPos.x + 0.9, 1.1, this.counterPos.z), '阅读便条', 1.4);
    add('exit', new THREE.Vector3(0, 1.2, hz - 0.3), '离开便利店', 1.8, { locked: true });
  }

  setLightsOn(on, intensity = 1) {
    for (const l of this.lights) {
      if (l.userData.base === undefined) l.userData.base = l.intensity || 1;
      l.intensity = on ? l.userData.base * intensity : 0;
    }
    for (const p of this.ceilingPanels) p.material.emissiveIntensity = on ? 1.2 * intensity : 0.02;
    this.ambient.intensity = on ? 0.5 : 0.08;
    this.hemi.intensity = on ? 0.35 : 0.06;
  }
}
