/* DEEP SPACE CRAFT · save.js —— localStorage 存档（含方块改动稀疏 diff） */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var KEY = 'dsc.save.v1';

  var Save = {
    KEY: KEY,
    exists: function () { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },

    write: function (G) {
      try {
        var flags = [];
        G.galaxy.systems.forEach(function (s, si) {
          var pf = s.planets.map(function (p) {
            return [p.discovered ? 1 : 0, p.visited ? 1 : 0, p.scanned ? 1 : 0, p.customName || 0];
          });
          flags.push([s.visited ? 1 : 0, s.scanned ? 1 : 0, pf]);
        });
        /* 方块 diff：{planetSeed: {chunkKey: [idx,id,...]}} */
        var edits = {};
        for (var pk in G.editsByPlanet) {
          var ce = G.editsByPlanet[pk], out = {}, any = false;
          for (var ck in ce) {
            if (ce[ck] && ce[ck].length) { out[ck] = ce[ck]; any = true; }
          }
          if (any) edits[pk] = out;
        }
        var data = {
          v: 1, t: Date.now(),
          seedStr: G.galaxy.seedStr,
          current: G.galaxy.current,
          state: G.state === 'planet' || G.state === 'space' ? G.state : 'space',
          planetIndex: G.planet ? G.planet.index : -1,
          dayT: G.dayT,
          player: DSC.Player.serialize(),
          ship: DSC.Space.serialize(),
          shipLocal: [G.shipLocal.pos[0], G.shipLocal.pos[1], G.shipLocal.pos[2], G.shipLocal.yaw],
          inShip: !!G.inShip,
          discoveries: (G.discoveries || []).slice(-120),
          flags: flags,
          edits: edits,
          stats: G.stats
        };
        localStorage.setItem(KEY, JSON.stringify(data));
        return true;
      } catch (e) {
        console.error('[save]', e);
        return false;
      }
    },

    read: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (!raw) return null;
        var d = JSON.parse(raw);
        if (!d || d.v !== 1) return null;
        return d;
      } catch (e) { return null; }
    },

    clear: function () { try { localStorage.removeItem(KEY); } catch (e) { } },

    info: function () {
      var d = Save.read();
      if (!d) return '无存档 / NO DATA';
      var when = new Date(d.t);
      var pad = function (n) { return (n < 10 ? '0' : '') + n; };
      var loc = d.state === 'planet' ? '地表' : '太空';
      return '种子 ' + d.seedStr + ' · ' + loc + ' · ' + DSC.Util.fmtNum(d.player ? d.player.units : 0) + ' u\n' +
        when.getFullYear() + '-' + pad(when.getMonth() + 1) + '-' + pad(when.getDate()) + ' ' +
        pad(when.getHours()) + ':' + pad(when.getMinutes());
    },

    /* 把存档标记应用回重新生成的银河 */
    applyFlags: function (galaxy, flags) {
      if (!flags) return;
      for (var i = 0; i < flags.length && i < galaxy.systems.length; i++) {
        var s = galaxy.systems[i], f = flags[i];
        s.visited = !!f[0]; s.scanned = !!f[1];
        for (var j = 0; j < f[2].length && j < s.planets.length; j++) {
          var p = s.planets[j], pf = f[2][j];
          p.discovered = !!pf[0]; p.visited = !!pf[1]; p.scanned = !!pf[2];
          if (pf[3]) p.customName = pf[3];
        }
      }
    }
  };

  DSC.Save = Save;
})();
