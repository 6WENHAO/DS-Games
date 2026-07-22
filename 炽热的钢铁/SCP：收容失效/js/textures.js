window.SCP = window.SCP || {};
(function (S) {
  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  }
  function tex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }
  function noise(ctx, w, h, alpha, n) {
    for (let i = 0; i < n; i++) {
      const g = Math.floor(Math.random() * 255);
      ctx.fillStyle = 'rgba(' + g + ',' + g + ',' + g + ',' + alpha + ')';
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }
  function grime(ctx, w, h, n, col) {
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = col || 'rgba(30,26,20,' + (0.04 + Math.random() * 0.1) + ')';
      ctx.beginPath();
      ctx.ellipse(Math.random() * w, Math.random() * h, 4 + Math.random() * 30, 3 + Math.random() * 18, Math.random() * 3, 0, 7);
      ctx.fill();
    }
  }

  S.buildTextures = function () {
    const T = {};

    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#b8b2a4'; x.fillRect(0, 0, 256, 256);
      for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
        const sh = 168 + Math.random() * 22;
        x.fillStyle = 'rgb(' + sh + ',' + (sh - 4) + ',' + (sh - 14) + ')';
        x.fillRect(tx * 128 + 3, ty * 128 + 3, 122, 122);
        x.strokeStyle = 'rgba(255,255,255,.18)';
        x.strokeRect(tx * 128 + 4, ty * 128 + 4, 120, 120);
      }
      x.strokeStyle = '#6d675c'; x.lineWidth = 5;
      x.strokeRect(0, 0, 256, 256);
      x.beginPath(); x.moveTo(128, 0); x.lineTo(128, 256); x.moveTo(0, 128); x.lineTo(256, 128); x.stroke();
      noise(x, 256, 256, 0.05, 900); grime(x, 256, 256, 26);
      T.lczWall = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#8f8d86'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const sh = 128 + Math.random() * 24;
        x.fillStyle = 'rgb(' + sh + ',' + sh + ',' + (sh - 6) + ')';
        x.fillRect(i * 64 + 1, j * 64 + 1, 62, 62);
      }
      noise(x, 256, 256, 0.06, 1400); grime(x, 256, 256, 40);
      T.lczFloor = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#9b988f'; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = 'rgba(60,58,52,.5)'; x.lineWidth = 3;
      for (let i = 0; i <= 2; i++) {
        x.beginPath(); x.moveTo(i * 128, 0); x.lineTo(i * 128, 256); x.stroke();
        x.beginPath(); x.moveTo(0, i * 128); x.lineTo(256, i * 128); x.stroke();
      }
      x.fillStyle = 'rgba(50,50,50,.6)';
      for (let i = 0; i < 24; i++) x.fillRect(34 + (i % 6) * 8, 96 + Math.floor(i / 6) * 10, 5, 5);
      noise(x, 256, 256, 0.05, 700);
      T.ceil = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#3d4045'; x.fillRect(0, 0, 256, 256);
      for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 1; tx++) {
        const sh = 56 + Math.random() * 14;
        x.fillStyle = 'rgb(' + sh + ',' + (sh + 3) + ',' + (sh + 7) + ')';
        x.fillRect(6, ty * 128 + 6, 244, 116);
      }
      x.fillStyle = '#23252a';
      for (let i = 0; i < 10; i++) {
        x.beginPath(); x.arc(20 + i * 24, 14, 3, 0, 7); x.fill();
        x.beginPath(); x.arc(20 + i * 24, 242, 3, 0, 7); x.fill();
      }
      const grad = x.createLinearGradient(0, 200, 0, 256);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(10,8,4,.55)');
      x.fillStyle = grad; x.fillRect(0, 200, 256, 56);
      noise(x, 256, 256, 0.07, 1500); grime(x, 256, 256, 34, 'rgba(10,10,14,.12)');
      T.hczWall = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#33353a'; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 256); x.stroke();
        x.beginPath(); x.moveTo(0, i * 64); x.lineTo(256, i * 64); x.stroke();
      }
      for (let i = 0; i < 60; i++) {
        x.fillStyle = 'rgba(140,145,155,.12)';
        x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
      }
      noise(x, 256, 256, 0.08, 1600);
      T.hczFloor = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#b5ad9c'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#a49c8a'; x.fillRect(0, 190, 256, 66);
      x.fillStyle = '#33465e'; x.fillRect(0, 182, 256, 8);
      noise(x, 256, 256, 0.04, 700); grime(x, 256, 256, 14);
      T.ezWall = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#4a4e55'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const sh = 70 + ((i + j) % 2) * 10 + Math.random() * 6;
        x.fillStyle = 'rgb(' + sh + ',' + (sh + 2) + ',' + (sh + 8) + ')';
        x.fillRect(i * 64 + 1, j * 64 + 1, 62, 62);
      }
      noise(x, 256, 256, 0.05, 900);
      T.ezFloor = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#606a70'; x.fillRect(0, 0, 256, 256);
      const g2 = x.createLinearGradient(0, 0, 256, 0);
      g2.addColorStop(0, 'rgba(255,255,255,.14)');
      g2.addColorStop(0.5, 'rgba(0,0,0,.12)');
      g2.addColorStop(1, 'rgba(255,255,255,.1)');
      x.fillStyle = g2; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#2c3236'; x.fillRect(118, 0, 20, 256);
      for (let y = 0; y < 256; y += 16) {
        x.fillStyle = ((y / 16) % 2) ? '#c9a13b' : '#1b1b1b';
        x.fillRect(0, y, 14, 16); x.fillRect(242, y, 14, 16);
      }
      x.fillStyle = '#aab4ba'; x.font = 'bold 22px monospace'; x.textAlign = 'center';
      x.save(); x.translate(70, 128); x.rotate(-Math.PI / 2);
      x.fillText('KEEP CLEAR', 0, 8); x.restore();
      noise(x, 256, 256, 0.06, 900); grime(x, 256, 256, 20, 'rgba(20,16,10,.16)');
      T.door = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#454d52'; x.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 22) {
        x.fillStyle = ((y / 22) % 2) ? '#c9a13b' : '#15161a';
        x.beginPath();
        x.moveTo(0, y); x.lineTo(256, y - 40); x.lineTo(256, y - 18); x.lineTo(0, y + 22); x.fill();
      }
      x.fillStyle = 'rgba(40,44,48,.88)'; x.fillRect(0, 96, 256, 64);
      x.fillStyle = '#d8d8d8'; x.font = 'bold 30px monospace'; x.textAlign = 'center';
      x.fillText('CHECKPOINT', 128, 137);
      noise(x, 256, 256, 0.07, 800);
      T.doorBig = tex(c);
    }
    {
      const [c, x] = cv(512, 256);
      x.fillStyle = '#dcd6c6'; x.fillRect(0, 0, 512, 256);
      x.fillStyle = '#7a1f1f'; x.fillRect(0, 0, 512, 54);
      x.fillStyle = '#efe9dc'; x.font = 'bold 34px monospace'; x.textAlign = 'center';
      x.fillText('SCP FOUNDATION', 256, 38);
      x.fillStyle = '#222';
      x.font = 'bold 26px monospace';
      x.fillText('SECURE · CONTAIN · PROTECT', 256, 110);
      x.strokeStyle = '#555'; x.lineWidth = 3;
      x.beginPath(); x.arc(256, 180, 46, 0, 7); x.stroke();
      x.beginPath(); x.arc(256, 180, 30, 0, 7); x.stroke();
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 3);
        x.save(); x.translate(256 + Math.cos(a) * 58, 180 + Math.sin(a) * 58);
        x.rotate(a + Math.PI / 2);
        x.beginPath(); x.moveTo(-8, 6); x.lineTo(0, -8); x.lineTo(8, 6); x.closePath();
        x.fillStyle = '#555'; x.fill(); x.restore();
      }
      grime(x, 512, 256, 12);
      T.poster = tex(c);
    }

    T.signCache = {};
    S.makeSignTex = function (line1, line2, opts) {
      const key = line1 + '|' + (line2 || '');
      if (T.signCache[key]) return T.signCache[key];
      const o = opts || {};
      const [c, x] = cv(512, 128);
      x.fillStyle = o.bg || '#20242a'; x.fillRect(0, 0, 512, 128);
      x.strokeStyle = o.border || '#c9a13b'; x.lineWidth = 6;
      x.strokeRect(6, 6, 500, 116);
      x.fillStyle = o.fg || '#e8e4da'; x.textAlign = 'center';
      if (line2) {
        x.font = 'bold 40px monospace'; x.fillText(line1, 256, 56);
        x.font = 'bold 28px monospace'; x.fillStyle = o.fg2 || '#c9a13b';
        x.fillText(line2, 256, 100);
      } else {
        x.font = 'bold 46px monospace'; x.fillText(line1, 256, 80);
      }
      const t = tex(c);
      T.signCache[key] = t;
      return t;
    };

    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#8a7f6a'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 260; i++) {
        const sh = 100 + Math.random() * 80;
        x.fillStyle = 'rgba(' + sh + ',' + (sh * 0.9 | 0) + ',' + (sh * 0.72 | 0) + ',' + (0.2 + Math.random() * 0.5) + ')';
        x.beginPath();
        x.ellipse(Math.random() * 256, Math.random() * 256, 3 + Math.random() * 16, 3 + Math.random() * 16, Math.random() * 3, 0, 7);
        x.fill();
      }
      for (let i = 0; i < 40; i++) {
        x.fillStyle = 'rgba(120,60,30,' + (0.1 + Math.random() * 0.25) + ')';
        x.beginPath();
        x.ellipse(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 20, 4 + Math.random() * 12, Math.random() * 3, 0, 7);
        x.fill();
      }
      noise(x, 256, 256, 0.1, 1600);
      T.skin173 = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#8a7f6a'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 200; i++) {
        const sh = 100 + Math.random() * 70;
        x.fillStyle = 'rgba(' + sh + ',' + (sh * 0.9 | 0) + ',' + (sh * 0.7 | 0) + ',' + (0.25 + Math.random() * 0.4) + ')';
        x.beginPath();
        x.ellipse(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 14, 4 + Math.random() * 14, Math.random() * 3, 0, 7);
        x.fill();
      }
      x.fillStyle = '#1c1410';
      x.beginPath(); x.ellipse(86, 104, 24, 30, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(170, 104, 24, 30, 0, 0, 7); x.fill();
      x.fillStyle = '#5c3a24';
      x.beginPath(); x.ellipse(128, 190, 52, 26, 0, 0, Math.PI); x.fill();
      x.fillStyle = '#2a1a10';
      x.beginPath(); x.ellipse(128, 196, 40, 16, 0, 0, Math.PI); x.fill();
      noise(x, 256, 256, 0.09, 900);
      T.face173 = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#181a16'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 160; i++) {
        const g = 20 + Math.random() * 40;
        x.fillStyle = 'rgba(' + (g * 0.7 | 0) + ',' + g + ',' + (g * 0.6 | 0) + ',' + (0.2 + Math.random() * 0.5) + ')';
        x.beginPath();
        x.ellipse(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 22, 3 + Math.random() * 14, Math.random() * 3, 0, 7);
        x.fill();
      }
      noise(x, 256, 256, 0.12, 1500);
      T.skin106 = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#cfc9bd'; x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 120; i++) {
        const g = 180 + Math.random() * 50;
        x.fillStyle = 'rgba(' + g + ',' + (g - 8) + ',' + (g - 18) + ',' + (0.2 + Math.random() * 0.3) + ')';
        x.beginPath();
        x.ellipse(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 18, 3 + Math.random() * 12, Math.random() * 3, 0, 7);
        x.fill();
      }
      noise(x, 256, 256, 0.05, 700);
      T.skin096 = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#d4cec2'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#141210';
      x.beginPath(); x.ellipse(92, 96, 14, 20, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(164, 96, 14, 20, 0, 0, 7); x.fill();
      x.fillStyle = '#241a14';
      x.beginPath(); x.ellipse(128, 190, 34, 44, 0, 0, 7); x.fill();
      x.fillStyle = '#0e0a08';
      x.beginPath(); x.ellipse(128, 196, 22, 32, 0, 0, 7); x.fill();
      noise(x, 256, 256, 0.06, 500);
      T.face096 = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.clearRect(0, 0, 256, 256);
      for (let i = 0; i < 26; i++) {
        x.fillStyle = 'rgba(' + (90 + Math.random() * 60 | 0) + ',8,8,' + (0.25 + Math.random() * 0.45) + ')';
        x.beginPath();
        x.ellipse(128 + (Math.random() - 0.5) * 130, 128 + (Math.random() - 0.5) * 130, 8 + Math.random() * 42, 6 + Math.random() * 30, Math.random() * 3, 0, 7);
        x.fill();
      }
      T.blood = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.clearRect(0, 0, 256, 256);
      for (let i = 0; i < 30; i++) {
        const g = 20 + Math.random() * 30;
        x.fillStyle = 'rgba(' + (g * 0.6 | 0) + ',' + g + ',' + (g * 0.5 | 0) + ',' + (0.3 + Math.random() * 0.4) + ')';
        x.beginPath();
        x.ellipse(128 + (Math.random() - 0.5) * 150, 128 + (Math.random() - 0.5) * 150, 10 + Math.random() * 40, 8 + Math.random() * 28, Math.random() * 3, 0, 7);
        x.fill();
      }
      T.corrosion = tex(c);
    }
    {
      const [c, x] = cv(128, 128);
      const g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(150,220,120,.5)');
      g.addColorStop(1, 'rgba(80,140,60,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      T.gas = tex(c);
    }
    {
      const [c, x] = cv(256, 256);
      x.fillStyle = '#101418'; x.fillRect(0, 0, 256, 256);
      for (let ry = 0; ry < 10; ry++) {
        x.fillStyle = '#181e24'; x.fillRect(10, 8 + ry * 25, 236, 20);
        for (let i = 0; i < 8; i++) {
          x.fillStyle = Math.random() < 0.5 ? '#25e065' : (Math.random() < 0.6 ? '#e0a025' : '#20262c');
          x.fillRect(20 + i * 26, 15 + ry * 25, 5, 5);
        }
      }
      T.server = tex(c);
    }

    return T;
  };

  S.buildIcons = function () {
    const I = {};
    function icon(id, draw) {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const x = c.getContext('2d');
      draw(x);
      I[id] = c.toDataURL();
      const t = new THREE.CanvasTexture(c);
      I[id + '_tex'] = t;
    }
    const cardCol = { 1: '#c8c8c8', 2: '#e0c94a', 3: '#e08b2a', 4: '#c33a3a', 5: '#7a2ae0' };
    for (let lv = 1; lv <= 5; lv++) {
      icon('keycard' + lv, x => {
        x.fillStyle = '#0a0a0a'; x.fillRect(6, 16, 52, 34);
        x.fillStyle = cardCol[lv]; x.fillRect(9, 19, 46, 28);
        x.fillStyle = '#222'; x.fillRect(12, 24, 14, 18);
        x.fillStyle = '#000'; x.font = 'bold 20px monospace';
        x.fillText('L' + lv, 32, 42);
      });
    }
    icon('gasmask', x => {
      x.fillStyle = '#2c2f33';
      x.beginPath(); x.ellipse(32, 30, 20, 24, 0, 0, 7); x.fill();
      x.fillStyle = '#9fb7c9';
      x.beginPath(); x.ellipse(24, 24, 7, 9, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(40, 24, 7, 9, 0, 0, 7); x.fill();
      x.fillStyle = '#4a4f55';
      x.beginPath(); x.arc(32, 48, 9, 0, 7); x.fill();
      x.fillStyle = '#222'; x.beginPath(); x.arc(32, 48, 5, 0, 7); x.fill();
    });
    icon('battery', x => {
      x.fillStyle = '#164a2a'; x.fillRect(16, 12, 32, 44);
      x.fillStyle = '#2ac060'; x.fillRect(16, 12, 32, 14);
      x.fillStyle = '#999'; x.fillRect(26, 6, 12, 6);
      x.fillStyle = '#dfe'; x.font = 'bold 16px monospace'; x.fillText('9V', 22, 46);
    });
    icon('firstaid', x => {
      x.fillStyle = '#e8e4da'; x.fillRect(8, 16, 48, 36);
      x.fillStyle = '#c33'; x.fillRect(26, 22, 12, 24); x.fillRect(20, 28, 24, 12);
      x.strokeStyle = '#888'; x.strokeRect(8, 16, 48, 36);
    });
    icon('eyedrops', x => {
      x.fillStyle = '#cde'; x.fillRect(24, 18, 16, 34);
      x.fillStyle = '#7db4e8'; x.fillRect(24, 30, 16, 22);
      x.fillStyle = '#556'; x.fillRect(28, 8, 8, 10);
    });
    icon('superdrops', x => {
      x.fillStyle = '#fce'; x.fillRect(24, 18, 16, 34);
      x.fillStyle = '#e87db4'; x.fillRect(24, 26, 16, 26);
      x.fillStyle = '#556'; x.fillRect(28, 8, 8, 10);
      x.fillStyle = '#fff'; x.font = 'bold 12px monospace'; x.fillText('++', 26, 44);
    });
    icon('snav', x => {
      x.fillStyle = '#22262c'; x.fillRect(10, 8, 44, 48);
      x.fillStyle = '#0f331a'; x.fillRect(14, 12, 36, 30);
      x.strokeStyle = '#2ac060'; x.lineWidth = 2;
      x.strokeRect(20, 18, 10, 8); x.strokeRect(34, 26, 10, 8);
      x.fillStyle = '#2ac060'; x.fillRect(30, 22, 4, 4);
      x.fillStyle = '#444'; x.fillRect(16, 46, 32, 6);
    });
    icon('radio', x => {
      x.fillStyle = '#33363c'; x.fillRect(12, 16, 40, 40);
      x.fillStyle = '#111'; x.fillRect(16, 22, 20, 14);
      x.fillStyle = '#2ac060'; x.fillRect(18, 26, 6, 6);
      x.fillStyle = '#666'; x.beginPath(); x.arc(44, 30, 6, 0, 7); x.fill();
      x.fillStyle = '#888'; x.fillRect(46, 4, 4, 14);
    });
    icon('doc', x => {
      x.fillStyle = '#d9d4c3'; x.fillRect(12, 8, 40, 48);
      x.fillStyle = '#7a1f1f'; x.fillRect(12, 8, 40, 10);
      x.fillStyle = '#555';
      for (let i = 0; i < 5; i++) x.fillRect(17, 24 + i * 6, 30, 3);
    });
    icon('scrap', x => {
      x.fillStyle = '#555';
      x.beginPath(); x.moveTo(14, 44); x.lineTo(30, 14); x.lineTo(40, 30); x.lineTo(52, 20); x.lineTo(46, 50); x.closePath(); x.fill();
      x.fillStyle = '#777'; x.fillRect(20, 36, 20, 8);
    });
    return I;
  };
})(window.SCP);
