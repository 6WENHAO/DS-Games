
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

@group(0) @binding(0) var<uniform>              G     : Grade;
@group(0) @binding(1) var<storage, read>        accum : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read_write>  base  : array<vec4<f32>>;

fn hdr_at(i: u32) -> vec3<f32> {
    let a = accum[i];
    if (a.w <= 0.0) { return vec3<f32>(0.0); }
    return max(a.xyz / a.w, vec3<f32>(0.0));
}

// One base pixel per 8x8 block of the frame. The block average is the centre
// value; the surrounding 3x3 blocks are folded in with a range weight, i.e. a
// cross-bilateral base layer (Durand & Dorsey) that does not bleed across the
// huge luminance step at the cave mouth. The same sweep accumulates a wide
// blurred bright-pass for the bloom.
@compute @workgroup_size(8, 8, 1)
fn cs_base(@builtin(global_invocation_id) gid: vec3<u32>) {
    let bw = G.dims.z;
    let bh = G.dims.w;
    if (gid.x >= bw || gid.y >= bh) { return; }
    let w = G.dims.x;
    let h = G.dims.y;
    let expo = G.ctl.x;
    let thr = G.ctl3.z;

    var csum = 0.0;
    var cn = 0.0;
    for (var y = 0u; y < 8u; y = y + 2u) {
        for (var x = 0u; x < 8u; x = x + 2u) {
            let px = min(gid.x * 8u + x, w - 1u);
            let py = min(gid.y * 8u + y, h - 1u);
            csum = csum + log10f(max(lum3(hdr_at(py * w + px)) * expo, 1.0e-7));
            cn = cn + 1.0;
        }
    }
    let centre = csum / cn;

    var num = 0.0;
    var den = 0.0;
    var bl = vec3<f32>(0.0);
    var bn = 0.0;
    for (var cy = -1; cy <= 1; cy = cy + 1) {
        for (var cx = -1; cx <= 1; cx = cx + 1) {
            let bx = clamp(i32(gid.x) + cx, 0, i32(bw) - 1);
            let by = clamp(i32(gid.y) + cy, 0, i32(bh) - 1);
            let sw = select(0.45, 1.0, cx == 0 && cy == 0);
            for (var y = 0u; y < 8u; y = y + 2u) {
                for (var x = 0u; x < 8u; x = x + 2u) {
                    let px = min(u32(bx) * 8u + x, w - 1u);
                    let py = min(u32(by) * 8u + y, h - 1u);
                    let c = hdr_at(py * w + px) * expo;
                    let l = max(lum3(c), 1.0e-7);
                    let ll = log10f(l);
                    let dr = (ll - centre) / 0.45;
                    let wt = sw * exp(-dr * dr);
                    num = num + ll * wt;
                    den = den + wt;
                    let k = max(l - thr, 0.0) / l;
                    bl = bl + c * k * sw;
                    bn = bn + sw;
                }
            }
        }
    }
    base[gid.y * bw + gid.x] = vec4<f32>(bl / max(bn, 1.0), num / max(den, 1.0e-6));
}
