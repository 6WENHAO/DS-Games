/* =============================================================================
   assets.js - bridges the procedural canvas texture library (tex.js) to GL
   textures, with caching and defensive fallbacks: if a texture factory is
   missing or throws, rendering simply continues untextured instead of dying.
   ========================================================================== */
(function (global) {
  'use strict';
  var TS = global.TS = global.TS || {};

  function Assets(R) {
    this.R = R;
    this.cache = {};
    this.canvases = {};
    this.failed = {};
  }

  Assets.prototype._make = function (key, factory, opt) {
    if (Object.prototype.hasOwnProperty.call(this.cache, key)) return this.cache[key];
    var t = null;
    try {
      var cv = factory();
      if (cv) {
        this.canvases[key] = cv;
        t = this.R.texture(cv, opt || {});
      }
    } catch (e) {
      this.failed[key] = String(e && e.message || e);
      if (global.console) console.warn('[assets] texture "' + key + '" failed:', e);
      t = null;
    }
    this.cache[key] = t;
    return t;
  };

  /* named library textures ------------------------------------------------- */
  Assets.prototype.get = function (name) {
    var T = TS.Tex || {};
    var self = this;
    switch (name) {
      case 'camo': return this._make('camo', function () { return T.camo({}); });
      case 'camoDark': return this._make('camoDark', function () { return T.camo({ base: '#4b5140', blotch: '#39331f' }); });
      case 'metal': return this._make('metal', function () { return T.metal({}); });
      case 'metalRust': return this._make('metalRust', function () { return T.metal({ rust: 0.75, color: '#6d6559' }); });
      case 'panel': return this._make('panel', function () { return T.panel({}); });
      case 'panelDark': return this._make('panelDark', function () { return T.panel({ color: '#39402f' }); });
      case 'rivet': return this._make('rivet', function () { return T.rivetPlate({}); });
      case 'tread': return this._make('tread', function () { return T.tread({}); });
      case 'radial': return this._make('radial', function () { return T.radial({}); }, { wrap: 'clamp' });
      case 'radialSoft': return this._make('radialSoft', function () { return T.radial({ hardness: 0.05 }); }, { wrap: 'clamp' });
      case 'reticle': return this._make('reticle', function () { return T.reticle({}); }, { wrap: 'clamp' });
      case 'screen': return this._make('screen', function () { return T.screen({}); }, { wrap: 'clamp' });
      case 'wood': return this._make('wood', function () { return T.wood({}); });
      case 'fabric': return this._make('fabric', function () { return T.canvasFabric({}); });
      default:
        if (name.indexOf('label:') === 0) return this.label(name.slice(6));
        return this._make(name, function () { return null; });
    }
  };

  Assets.prototype.label = function (text, opt) {
    var T = TS.Tex || {};
    opt = opt || {};
    var key = 'label:' + text + ':' + JSON.stringify(opt);
    return this._make(key, function () { return T.label ? T.label(text, opt) : null; }, { wrap: 'clamp' });
  };

  Assets.prototype.gauge = function (spec) {
    var T = TS.Tex || {};
    var key = 'gauge:' + JSON.stringify(spec);
    return this._make(key, function () { return T.gauge ? T.gauge(spec) : null; }, { wrap: 'clamp' });
  };

  Assets.prototype.warn = function (text, color) {
    var T = TS.Tex || {};
    var key = 'warn:' + text + ':' + color;
    return this._make(key, function () { return T.warn ? T.warn(text, { color: color }) : null; }, { wrap: 'clamp' });
  };

  /* a locally drawn texture (used for target faces, signs, ...) */
  Assets.prototype.custom = function (key, w, h, drawFn, opt) {
    return this._make(key, function () {
      var cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      drawFn(cv.getContext('2d'), w, h);
      return cv;
    }, opt);
  };

  TS.Assets = Assets;
})(typeof window !== 'undefined' ? window : this);
