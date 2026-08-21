
struct Grade {
  dims : vec4<u32>,   // x=w y=h z=base_w w=base_h
  ctl  : vec4<f32>,   // x=exposure y=anchor z=comp w=detail
  ctl2 : vec4<f32>,   // x=local y=bloom z=denoise w=saturation
  ctl3 : vec4<f32>,   // x=view mode y=aov hi z=bloom threshold w=spp
}
fn lum3(c: vec3<f32>) -> f32 { return dot(c, vec3<f32>(0.2126, 0.7152, 0.0722)); }
fn log10f(x: f32) -> f32 { return log(max(x, 1.0e-8)) * 0.4342944819; }

const ACES_IN_0 = vec3<f32>(0.59719, 0.35458, 0.04823);
const ACES_IN_1 = vec3<f32>(0.07600, 0.90834, 0.01566);
const ACES_IN_2 = vec3<f32>(0.02840, 0.13383, 0.83777);
const ACES_OU_0 = vec3<f32>( 1.60475, -0.53108, -0.07367);
const ACES_OU_1 = vec3<f32>(-0.10208,  1.10813, -0.00605);
const ACES_OU_2 = vec3<f32>(-0.00327, -0.07276,  1.07602);

fn aces_fit(cin: vec3<f32>) -> vec3<f32> {
    let v = vec3<f32>(dot(ACES_IN_0, cin), dot(ACES_IN_1, cin), dot(ACES_IN_2, cin));
    let a = v * (v + vec3<f32>(0.0245786)) - vec3<f32>(0.000090537);
    let b = v * (0.983729 * v + vec3<f32>(0.4329510)) + vec3<f32>(0.238081);
    let f = a / b;
    let o = vec3<f32>(dot(ACES_OU_0, f), dot(ACES_OU_1, f), dot(ACES_OU_2, f));
    return clamp(o, vec3<f32>(0.0), vec3<f32>(1.0));
}
fn srgb_oetf(c: vec3<f32>) -> vec3<f32> {
    let lo = c * 12.92;
    let hi = 1.055 * pow(max(c, vec3<f32>(0.0)), vec3<f32>(1.0 / 2.4)) - vec3<f32>(0.055);
    return select(hi, lo, c <= vec3<f32>(0.0031308));
}
fn turbo(t: f32) -> vec3<f32> {
    let x = clamp(t, 0.0, 1.0);
    let r = 0.13572138 + x * (4.61539260 + x * (-42.66032258 + x * (132.13108234 + x * (-152.94239396 + x * 59.28637943))));
    let g = 0.09140261 + x * (2.19418839 + x * (  4.84296658 + x * (-14.18503333 + x * (   4.27729857 + x *  2.82956604))));
    let b = 0.10667330 + x * (12.64194608 + x * (-60.58204836 + x * (110.36276771 + x * ( -89.90310912 + x * 27.34824973))));
    return clamp(vec3<f32>(r, g, b), vec3<f32>(0.0), vec3<f32>(1.0));
}

@group(0) @binding(0) var<uniform>       G     : Grade;
@group(0) @binding(1) var<storage, read> accum : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> base  : array<vec4<f32>>;
@group(0) @binding(3) var<storage, read> aovb  : array<vec4<f32>>;

fn hdr_at(i: u32) -> vec3<f32> {
    let a = accum[i];
    if (a.w <= 0.0) { return vec3<f32>(0.0); }
    return max(a.xyz / a.w, vec3<f32>(0.0));
}

fn base_at(px: f32, py: f32) -> vec4<f32> {
    let bw = f32(G.dims.z);
    let bh = f32(G.dims.w);
    let u = clamp(px / 8.0 - 0.5, 0.0, bw - 1.0);
    let v = clamp(py / 8.0 - 0.5, 0.0, bh - 1.0);
    let x0 = floor(u);
    let y0 = floor(v);
    let x1 = min(x0 + 1.0, bw - 1.0);
    let y1 = min(y0 + 1.0, bh - 1.0);
    let fx = u - x0;
    let fy = v - y0;
    let i00 = base[u32(y0) * G.dims.z + u32(x0)];
    let i10 = base[u32(y0) * G.dims.z + u32(x1)];
    let i01 = base[u32(y1) * G.dims.z + u32(x0)];
    let i11 = base[u32(y1) * G.dims.z + u32(x1)];
    return mix(mix(i00, i10, fx), mix(i01, i11, fx), fy);
}

// 5x5 adaptive bilateral in log space: same idea as the native --denoise, the
// range sigma is wide enough to swallow Monte-Carlo grain but an order of
// magnitude below the real edges in this scene.
fn denoised(px: i32, py: i32) -> vec3<f32> {
    let w = i32(G.dims.x);
    let h = i32(G.dims.y);
    let s = G.ctl2.z;
    let c0 = hdr_at(u32(py * w + px));
    if (s <= 0.0) { return c0; }
    let l0 = log10f(max(lum3(c0), 1.0e-7));
    let sr = 0.28 * s + 0.06;
    var acc = vec3<f32>(0.0);
    var den = 0.0;
    for (var dy = -2; dy <= 2; dy = dy + 1) {
        for (var dx = -2; dx <= 2; dx = dx + 1) {
            let xx = clamp(px + dx, 0, w - 1);
            let yy = clamp(py + dy, 0, h - 1);
            let c = hdr_at(u32(yy * w + xx));
            let dl = (log10f(max(lum3(c), 1.0e-7)) - l0) / sr;
            let wt = exp(-f32(dx * dx + dy * dy) / 8.0 - dl * dl);
            acc = acc + c * wt;
            den = den + wt;
        }
    }
    return mix(c0, acc / max(den, 1.0e-6), s);
}

@vertex
fn vs_quad(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4<f32> {
    var p = array<vec2<f32>, 3>(vec2<f32>(-1.0, -3.0), vec2<f32>(-1.0, 1.0), vec2<f32>(3.0, 1.0));
    return vec4<f32>(p[vi], 0.0, 1.0);
}

@fragment
fn fs_display(@builtin(position) fc: vec4<f32>) -> @location(0) vec4<f32> {
    let w = G.dims.x;
    let h = G.dims.y;
    let px = min(u32(fc.x), w - 1u);
    let py = min(u32(fc.y), h - 1u);
    let idx = py * w + px;
    let mode = i32(G.ctl3.x);
    let spp = max(G.ctl3.w, 1.0);

    if (mode >= 1 && mode <= 3) {
        let a = aovb[idx];
        var v = 0.0;
        if (mode == 1) { v = a.y / spp; }
        if (mode == 2) { v = a.z / spp; }
        if (mode == 3) { v = a.x / spp; }
        let n = clamp(v / max(G.ctl3.y, 1.0e-5), 0.0, 1.0);
        var t = n;
        if (mode != 3) { t = log(1.0 + 40.0 * n) / log(41.0); }
        return vec4<f32>(srgb_oetf(turbo(t)), 1.0);
    }

    var c = denoised(i32(px), i32(py)) * G.ctl.x;
    let bs = base_at(fc.x, fc.y);
    let l = max(lum3(c), 1.0e-6);
    let ll = log10f(l);
    var lt = l;
    if (mode == 0) {
        let detail = clamp(ll - bs.w, -3.0, 3.0);
        let anchor = G.ctl.y;
        let local_log = (bs.w - anchor) * G.ctl.z + detail * G.ctl.w + anchor;
        lt = mix(l, pow(10.0, local_log), G.ctl2.x);
    }
    c = c * (lt / l);
    c = c + bs.xyz * G.ctl2.y;
    let lg = lum3(c);
    c = max(vec3<f32>(lg) + (c - vec3<f32>(lg)) * G.ctl2.w, vec3<f32>(0.0));
    return vec4<f32>(srgb_oetf(aces_fit(c)), 1.0);
}
