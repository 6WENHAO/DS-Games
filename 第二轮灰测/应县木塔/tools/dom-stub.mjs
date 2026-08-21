// 最小 DOM 桩（供 Node 端建模测试复用）
function makeCtx2D() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k in t) return t[k];
      return (...args) => {
        switch (k) {
          case 'createRadialGradient':
          case 'createLinearGradient':
            return { addColorStop() {} };
          case 'createImageData': {
            const w = Math.max(1, args[0] | 0);
            const h = Math.max(1, args[1] | 0);
            return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
          }
          case 'getImageData': {
            const w = Math.max(1, args[2] | 0);
            const h = Math.max(1, args[3] | 0);
            return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
          }
          case 'measureText':
            return { width: 8 };
          default:
            return undefined;
        }
      };
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  });
}

const canvasStub = () => ({
  width: 1,
  height: 1,
  style: {},
  getContext: () => makeCtx2D(),
  toDataURL: () => 'data:,',
  addEventListener() {},
  removeEventListener() {},
});

globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? canvasStub() : { style: {}, appendChild() {} }),
  createElementNS: () => canvasStub(),
  getElementById: () => null,
  addEventListener() {},
  body: { classList: { toggle() {} } },
};
globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  addEventListener() {},
};
globalThis.self = globalThis.window;
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(0), 0);

export {};
