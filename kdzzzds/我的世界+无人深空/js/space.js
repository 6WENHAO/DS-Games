// ============ 太空场景 ============
const Space = (() => {
  let scene = null, stars = null, sun = null, nebula = [];
  let planets = [];   // { mesh, cloudMesh, config, orbitPos, radius }
  let dustField = null;
  const SYSTEM_SEED = 20260714;

  function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02040a);

    // 环境光照
    const amb = new THREE.AmbientLight(0x334455, 0.8);
    scene.add(amb);
    const sunLight = new THREE.DirectionalLight(0xfff0dd, 1.3);
    sunLight.position.set(1, 0.4, 0.6);
    scene.add(sunLight);

    buildStars();
    buildSun();
    buildPlanets();
    buildDust();
    return scene;
  }

  function buildStars() {
    const rng = Noise.makeRng(777);
    const n = 4000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 6000 + rng() * 3000;
      const theta = rng() * Math.PI * 2, phi = Math.acos(2 * rng() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const warm = rng();
      col[i * 3] = 0.7 + warm * 0.3;
      col[i * 3 + 1] = 0.75 + rng() * 0.25;
      col[i * 3 + 2] = 0.8 + (1 - warm) * 0.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 7, vertexColors: true, sizeAttenuation: true, fog: false }));
    scene.add(stars);

    // 星云面片
    const nebColors = [0x4a2a6a, 0x1a3a5a, 0x5a2a3a];
    for (let i = 0; i < 3; i++) {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
      const col3 = new THREE.Color(nebColors[i]);
      grad.addColorStop(0, `rgba(${col3.r * 255 | 0},${col3.g * 255 | 0},${col3.b * 255 | 0},0.55)`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
      const tex = new THREE.CanvasTexture(c);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, fog: false });
      const spr = new THREE.Sprite(mat);
      const rng = Noise.makeRng(900 + i);
      spr.position.set((rng() - 0.5) * 9000, (rng() - 0.5) * 4000, (rng() - 0.5) * 9000);
      spr.scale.setScalar(4500 + rng() * 2500);
      scene.add(spr);
      nebula.push(spr);
    }
  }

  function buildSun() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,240,1)');
    grad.addColorStop(0.25, 'rgba(255,230,170,0.9)');
    grad.addColorStop(1, 'rgba(255,180,80,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, fog: false }));
    sun.position.set(7000, 2800, 4200);
    sun.scale.setScalar(2600);
    scene.add(sun);
  }

  // 体素风格星球: 位移二十面体 + 平面着色
  function buildPlanetMesh(config, radius) {
    const geo = new THREE.IcosahedronGeometry(radius, 3);
    const posAttr = geo.getAttribute('position');
    const colors = [];
    const n2 = new Noise.Noise2D(config.seed);
    const cGrass = new THREE.Color(config.grass);
    const cRock = new THREE.Color(config.archIdx === 1 ? 0xc09050 : config.archIdx === 3 ? 0x9a5a48 : 0x8a8f94);
    const cSnow = new THREE.Color(0xe8f4fa);
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i).normalize();
      const h = n2.fbm(v.x * 3 + v.z, v.y * 3 - v.z * 2, 4, 2.2, 0.55);
      const disp = 1 + h * 0.09;
      // 体素感: 量化位移
      const q = Math.round(disp * 26) / 26;
      posAttr.setXYZ(i, v.x * radius * q, v.y * radius * q, v.z * radius * q);
      let col;
      if (h > 0.32) col = cSnow;
      else if (h > 0.02) col = cRock;
      else col = cGrass;
      colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);

    // 大气光晕
    const glowGeo = new THREE.SphereGeometry(radius * 1.12, 24, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color: config.sky, transparent: true, opacity: 0.16, side: THREE.BackSide, depthWrite: false,
    });
    mesh.add(new THREE.Mesh(glowGeo, glowMat));

    // 云层 (方块云 sprite 环绕)
    const cloudGroup = new THREE.Group();
    const rng = Noise.makeRng(config.seed ^ 0xC10D);
    const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
    for (let i = 0; i < 26; i++) {
      const theta = rng() * Math.PI * 2, phi = Math.acos(2 * rng() - 1);
      const r = radius * 1.06;
      const cl = new THREE.Mesh(new THREE.BoxGeometry(radius * (0.12 + rng() * 0.2), radius * 0.02, radius * (0.08 + rng() * 0.14)), cloudMat);
      cl.position.set(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
      cl.lookAt(0, 0, 0);
      cloudGroup.add(cl);
    }
    mesh.add(cloudGroup);
    mesh.userData.clouds = cloudGroup;
    return mesh;
  }

  function buildPlanets() {
    const layout = [
      { arch: 0, dist: 0, angle: 0, radius: 500 },        // 起始星球
      { arch: 2, dist: 5200, angle: 0.7, radius: 620 },
      { arch: 1, dist: 7800, angle: 2.6, radius: 560 },
      { arch: 3, dist: 6400, angle: 4.4, radius: 680 },
    ];
    layout.forEach((l, i) => {
      const config = World.makePlanet(SYSTEM_SEED + i * 1337, l.arch);
      const pos = i === 0
        ? new THREE.Vector3(0, 0, -1400)
        : new THREE.Vector3(Math.cos(l.angle) * l.dist, (Math.sin(l.angle * 3) * 800), Math.sin(l.angle) * l.dist - 1400);
      const mesh = buildPlanetMesh(config, l.radius);
      mesh.position.copy(pos);
      scene.add(mesh);
      planets.push({ mesh, config, radius: l.radius, index: i });
    });
  }

  function buildDust() {
    // 太空尘埃: 提供速度感
    const n = 500, pos = new Float32Array(n * 3);
    const rng = Noise.makeRng(555);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (rng() - 0.5) * 500;
      pos[i * 3 + 1] = (rng() - 0.5) * 500;
      pos[i * 3 + 2] = (rng() - 0.5) * 500;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    dustField = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xaaccdd, size: 0.6, transparent: true, opacity: 0.6 }));
    scene.add(dustField);
  }

  function update(dt, shipPos) {
    planets.forEach(p => {
      p.mesh.rotation.y += dt * 0.008;
      if (p.mesh.userData.clouds) p.mesh.userData.clouds.rotation.y += dt * 0.012;
    });
    // 尘埃跟随飞船 (回绕)
    if (dustField && shipPos) {
      dustField.position.set(
        Math.round(shipPos.x / 500) * 500,
        Math.round(shipPos.y / 500) * 500,
        Math.round(shipPos.z / 500) * 500
      );
    }
  }

  function nearestPlanet(pos) {
    let best = null, bestD = Infinity;
    planets.forEach(p => {
      const d = pos.distanceTo(p.mesh.position) - p.radius;
      if (d < bestD) { bestD = d; best = p; }
    });
    return { planet: best, dist: bestD };
  }

  return {
    init, update, nearestPlanet,
    get scene() { return scene; }, get planets() { return planets; },
  };
})();
