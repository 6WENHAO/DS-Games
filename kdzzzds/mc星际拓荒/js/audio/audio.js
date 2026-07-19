"use strict";
window.G = window.G || {};

(function() {
  var _ctx = null;
  var _master = null;
  var _comp = null;
  var _buses = {};
  var _vols = {};
  var _noiseCache = {};
  var _busNames = ['music', 'sfx', 'ui', 'ambient'];

  function _ensure() {
    if (_ctx) {
      if (_ctx.state === 'suspended') _ctx.resume();
      return true;
    }
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('BlockWilds: WebAudio not available');
      return false;
    }
    _comp = _ctx.createDynamicsCompressor();
    _comp.threshold.value = -24;
    _comp.knee.value = 30;
    _comp.ratio.value = 12;
    _comp.attack.value = 0.003;
    _comp.release.value = 0.25;
    _comp.connect(_ctx.destination);

    _master = _ctx.createGain();
    _master.gain.value = 1;
    _master.connect(_comp);

    for (var i = 0; i < _busNames.length; i++) {
      var n = _busNames[i];
      var g = _ctx.createGain();
      g.gain.value = 0.49;
      g.connect(_master);
      _buses[n] = g;
      _vols[n] = 0.7;
    }
    return true;
  }

  G.Audio = {
    get ready() { return !!_ctx; },
    get ctx() { return _ctx; },

    init: function() {
      if (!_ctx) _ensure();
      else if (_ctx.state === 'suspended') _ctx.resume();
    },

    _ensure: _ensure,

    setVolume: function(bus, v) {
      v = Math.max(0, Math.min(1, v));
      _vols[bus] = v;
      if (_buses[bus] && _ctx) {
        _buses[bus].gain.setTargetAtTime(v * v, _ctx.currentTime, 0.05);
      }
    },

    getVolume: function(bus) {
      return _vols[bus] !== undefined ? _vols[bus] : 0.7;
    },

    bus: function(name) {
      return (_buses[name] || _master);
    },

    noiseBuffer: function(seconds, color) {
      if (!_ctx) return null;
      color = color || 'white';
      var key = color + '_' + seconds.toFixed(2);
      if (_noiseCache[key]) return _noiseCache[key];
      var sr = _ctx.sampleRate;
      var len = Math.max(1, Math.floor(sr * seconds));
      var buf = _ctx.createBuffer(1, len, sr);
      var d = buf.getChannelData(0);
      if (color === 'white') {
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } else if (color === 'pink') {
        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (var i = 0; i < len; i++) {
          var w = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.96900 * b2 + w * 0.1538520;
          b3 = 0.86650 * b3 + w * 0.3104856;
          b4 = 0.55000 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.0168980;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      } else if (color === 'brown') {
        var last = 0;
        for (var i = 0; i < len; i++) {
          last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
          d[i] = Math.max(-1, Math.min(1, last * 3.5));
        }
      }
      _noiseCache[key] = buf;
      return buf;
    },

    env: function(gainNode, pts) {
      if (!_ctx || !gainNode) return;
      var now = _ctx.currentTime;
      if (pts.length === 0) return;
      gainNode.gain.setValueAtTime(pts[0][1], now + pts[0][0]);
      for (var i = 1; i < pts.length; i++) {
        gainNode.gain.linearRampToValueAtTime(pts[i][1], now + pts[i][0]);
      }
    },

    osc: function(type, freq) {
      if (!_ctx) return null;
      var o = _ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq || 440;
      return o;
    },

    panner: function(pan) {
      if (!_ctx) return null;
      var p = _ctx.createStereoPanner();
      p.pan.value = pan || 0;
      return p;
    },

    createGain: function(vol) {
      if (!_ctx) return null;
      var g = _ctx.createGain();
      g.gain.value = vol !== undefined ? vol : 0.5;
      return g;
    },

    createFilter: function(type, freq, Q) {
      if (!_ctx) return null;
      var f = _ctx.createBiquadFilter();
      f.type = type || 'lowpass';
      f.frequency.value = freq || 1000;
      if (Q !== undefined) f.Q.value = Q;
      return f;
    },

    createDelay: function(time) {
      if (!_ctx) return null;
      var d = _ctx.createDelay(Math.max(time || 1, 0.1));
      d.delayTime.value = time || 1;
      return d;
    },

    // Create a plain buffer source from a noise buffer
    noiseSource: function(buf, vol, dest, loop) {
      if (!_ctx || !buf) return null;
      var src = _ctx.createBufferSource();
      src.buffer = buf;
      src.loop = !!loop;
      var g = _ctx.createGain();
      g.gain.value = vol || 0.5;
      src.connect(g);
      g.connect(dest || _buses['sfx'] || _master);
      return { src: src, gain: g };
    },

    // Safe node disconnect after delay
    gc: function(nodes, delaySec) {
      if (!_ctx) return;
      delaySec = delaySec || 0.5;
      var wait = delaySec * 1000 + 100;
      var list = Array.isArray(nodes) ? nodes.slice() : [nodes];
      setTimeout(function() {
        for (var i = 0; i < list.length; i++) {
          try { if (list[i]) list[i].disconnect(); } catch (e) {}
        }
      }, wait);
    }
  };
})();
