//! Host-side HDR finishing: physically-motivated auto exposure, energy-added
//! bloom, Durand & Dorsey style *local* tone mapping (bilateral base/detail
//! decomposition in log10 space), ACES filmic global curve and sRGB encoding.
//!
//! Keeping this on the host means a rendered `.pfm` can be re-graded in
//! milliseconds (`--regrade`) without touching the path tracer.

pub struct Grade {
    /// `None` = automatic: the exposure that maps the brightest *base* level
    /// (99.5th percentile of the bilateral base layer) to 10^anchor.
    pub exposure: Option<f32>,
    /// 0 = purely global, 1 = full local operator
    pub local: f32,
    /// log10 range the base layer is compressed into (smaller = flatter)
    pub target_decades: f32,
    /// gain on the high-frequency detail layer
    pub detail: f32,
    pub bloom: f32,
    pub bloom_threshold: f32,
    pub saturation: f32,
    /// log10 level the brightest base region is mapped to. 0 = diffuse white,
    /// 0.34 = ~2.2x over white, i.e. the exterior clips while the interior
    /// keeps its detail.
    pub anchor: f32,
}

impl Default for Grade {
    fn default() -> Self {
        Grade {
            exposure: None,
            local: 0.80,
            target_decades: 1.55,
            detail: 1.15,
            bloom: 0.30,
            bloom_threshold: 1.1,
            saturation: 1.06,
            anchor: 0.15,
        }
    }
}

fn lum(r: f32, g: f32, b: f32) -> f32 {
    0.2126 * r + 0.7152 * g + 0.0722 * b
}

// --------------------------------------------------------------- ACES filmic
// Stephen Hill's fit of the ACES RRT+ODT (sRGB output transform).
#[rustfmt::skip]
const ACES_IN: [[f32; 3]; 3] = [
    [0.59719, 0.35458, 0.04823],
    [0.07600, 0.90834, 0.01566],
    [0.02840, 0.13383, 0.83777],
];
#[rustfmt::skip]
const ACES_OUT: [[f32; 3]; 3] = [
    [ 1.60475, -0.53108, -0.07367],
    [-0.10208,  1.10813, -0.00605],
    [-0.00327, -0.07276,  1.07602],
];

fn mul3(m: &[[f32; 3]; 3], v: [f32; 3]) -> [f32; 3] {
    [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ]
}

fn rrt_odt_fit(v: [f32; 3]) -> [f32; 3] {
    let mut o = [0f32; 3];
    for i in 0..3 {
        let x = v[i];
        let a = x * (x + 0.024_578_6) - 0.000_090_537;
        let b = x * (0.983_729 * x + 0.432_951) + 0.238_081;
        o[i] = a / b;
    }
    o
}

fn aces(c: [f32; 3]) -> [f32; 3] {
    let v = mul3(&ACES_IN, c);
    let v = rrt_odt_fit(v);
    let v = mul3(&ACES_OUT, v);
    [
        v[0].clamp(0.0, 1.0),
        v[1].clamp(0.0, 1.0),
        v[2].clamp(0.0, 1.0),
    ]
}

fn srgb_oetf(x: f32) -> f32 {
    if x <= 0.003_130_8 {
        12.92 * x
    } else {
        1.055 * x.powf(1.0 / 2.4) - 0.055
    }
}

// -------------------------------------------------------------- pyramid ops
fn downsample(src: &[f32], w: usize, h: usize) -> (Vec<f32>, usize, usize) {
    let dw = (w / 2).max(1);
    let dh = (h / 2).max(1);
    let mut out = vec![0f32; dw * dh * 3];
    for y in 0..dh {
        for x in 0..dw {
            let mut acc = [0f32; 3];
            let mut n = 0f32;
            for dy in 0..2 {
                for dx in 0..2 {
                    let sx = (x * 2 + dx).min(w - 1);
                    let sy = (y * 2 + dy).min(h - 1);
                    let i = (sy * w + sx) * 3;
                    acc[0] += src[i];
                    acc[1] += src[i + 1];
                    acc[2] += src[i + 2];
                    n += 1.0;
                }
            }
            let o = (y * dw + x) * 3;
            out[o] = acc[0] / n;
            out[o + 1] = acc[1] / n;
            out[o + 2] = acc[2] / n;
        }
    }
    (out, dw, dh)
}

fn sample_bilinear3(src: &[f32], w: usize, h: usize, u: f32, v: f32) -> [f32; 3] {
    let x = (u * w as f32 - 0.5).clamp(0.0, (w - 1) as f32);
    let y = (v * h as f32 - 0.5).clamp(0.0, (h - 1) as f32);
    let x0 = x.floor() as usize;
    let y0 = y.floor() as usize;
    let x1 = (x0 + 1).min(w - 1);
    let y1 = (y0 + 1).min(h - 1);
    let fx = x - x0 as f32;
    let fy = y - y0 as f32;
    let mut o = [0f32; 3];
    for c in 0..3 {
        let a = src[(y0 * w + x0) * 3 + c] * (1.0 - fx) + src[(y0 * w + x1) * 3 + c] * fx;
        let b = src[(y1 * w + x0) * 3 + c] * (1.0 - fx) + src[(y1 * w + x1) * 3 + c] * fx;
        o[c] = a * (1.0 - fy) + b * fy;
    }
    o
}

fn sample_bilinear1(src: &[f32], w: usize, h: usize, u: f32, v: f32) -> f32 {
    let x = (u * w as f32 - 0.5).clamp(0.0, (w - 1) as f32);
    let y = (v * h as f32 - 0.5).clamp(0.0, (h - 1) as f32);
    let x0 = x.floor() as usize;
    let y0 = y.floor() as usize;
    let x1 = (x0 + 1).min(w - 1);
    let y1 = (y0 + 1).min(h - 1);
    let fx = x - x0 as f32;
    let fy = y - y0 as f32;
    let a = src[y0 * w + x0] * (1.0 - fx) + src[y0 * w + x1] * fx;
    let b = src[y1 * w + x0] * (1.0 - fx) + src[y1 * w + x1] * fx;
    a * (1.0 - fy) + b * fy
}

/// Progressive-upsample bloom (thresholded bright pass, 6 octaves).
fn bloom(exposed: &[f32], w: usize, h: usize, threshold: f32) -> Vec<f32> {
    let mut bright = vec![0f32; w * h * 3];
    for i in 0..w * h {
        let l = lum(exposed[i * 3], exposed[i * 3 + 1], exposed[i * 3 + 2]);
        let k = if l > threshold {
            (l - threshold) / l.max(1e-6)
        } else {
            0.0
        };
        for c in 0..3 {
            bright[i * 3 + c] = exposed[i * 3 + c] * k;
        }
    }
    let mut chain: Vec<(Vec<f32>, usize, usize)> = Vec::new();
    let mut cur = (bright, w, h);
    for _ in 0..6 {
        if cur.1 <= 4 || cur.2 <= 4 {
            break;
        }
        let (d, dw, dh) = downsample(&cur.0, cur.1, cur.2);
        chain.push(cur);
        cur = (d, dw, dh);
    }
    // accumulate coarse -> fine
    let mut acc = cur;
    while let Some((fine, fw, fh)) = chain.pop() {
        let mut merged = vec![0f32; fw * fh * 3];
        for y in 0..fh {
            for x in 0..fw {
                let u = (x as f32 + 0.5) / fw as f32;
                let v = (y as f32 + 0.5) / fh as f32;
                let s = sample_bilinear3(&acc.0, acc.1, acc.2, u, v);
                let i = (y * fw + x) * 3;
                for c in 0..3 {
                    merged[i + c] = fine[i + c] * 0.5 + s[c] * 0.75;
                }
            }
        }
        acc = (merged, fw, fh);
    }
    acc.0
}

/// Cross-bilateral base layer of log10 luminance, computed at 1/4 resolution.
fn bilateral_base(log_l: &[f32], w: usize, h: usize) -> Vec<f32> {
    let ds = 4usize;
    let sw = (w / ds).max(1);
    let sh = (h / ds).max(1);
    let mut small = vec![0f32; sw * sh];
    for y in 0..sh {
        for x in 0..sw {
            let mut acc = 0f32;
            let mut n = 0f32;
            for dy in 0..ds {
                for dx in 0..ds {
                    let sx = (x * ds + dx).min(w - 1);
                    let sy = (y * ds + dy).min(h - 1);
                    acc += log_l[sy * w + sx];
                    n += 1.0;
                }
            }
            small[y * sw + x] = acc / n;
        }
    }
    // bilateral filter: spatial sigma 5 px (small grid), range sigma 0.45 decades
    let rad = 8i32;
    let inv2ss = 1.0 / (2.0 * 5.0 * 5.0);
    let inv2sr = 1.0 / (2.0 * 0.45 * 0.45);
    let mut base_small = vec![0f32; sw * sh];
    for y in 0..sh as i32 {
        for x in 0..sw as i32 {
            let c = small[(y as usize) * sw + x as usize];
            let mut num = 0f32;
            let mut den = 0f32;
            for dy in -rad..=rad {
                let yy = (y + dy).clamp(0, sh as i32 - 1) as usize;
                for dx in -rad..=rad {
                    let xx = (x + dx).clamp(0, sw as i32 - 1) as usize;
                    let v = small[yy * sw + xx];
                    let d2 = (dx * dx + dy * dy) as f32;
                    let dr = v - c;
                    let wgt = (-d2 * inv2ss - dr * dr * inv2sr).exp();
                    num += v * wgt;
                    den += wgt;
                }
            }
            base_small[(y as usize) * sw + x as usize] = num / den.max(1e-8);
        }
    }
    // upsample back to full resolution
    let mut base = vec![0f32; w * h];
    for y in 0..h {
        for x in 0..w {
            let u = (x as f32 + 0.5) / w as f32;
            let v = (y as f32 + 0.5) / h as f32;
            base[y * w + x] = sample_bilinear1(&base_small, sw, sh, u, v);
        }
    }
    base
}

fn percentile(sorted: &[f32], p: f32) -> f32 {
    if sorted.is_empty() {
        return 0.0;
    }
    let i = ((sorted.len() - 1) as f32 * p.clamp(0.0, 1.0)).round() as usize;
    sorted[i]
}

// --------------------------------------------------------------- denoising
/// Edge-preserving denoiser for Monte-Carlo grain, run on the *linear* HDR
/// frame before exposure.
///
/// It is an adaptive cross-bilateral filter in log-luminance space: the range
/// sigma is derived from a robust estimate of the image's own noise level (the
/// median absolute deviation of the 3x3 median residual, scaled by 1.4826 to
/// match a Gaussian sigma), so genuine edges - whose local contrast is far
/// larger than the noise - keep their weight while grain averages out. The same
/// weights are applied to all three channels, which removes colour speckle too.
///
/// `strength` in (0, 1] blends the filtered result with the original; 0 = off.
pub fn denoise(hdr: &mut [f32], w: usize, h: usize, strength: f32) -> f32 {
    if strength <= 0.0 || w < 5 || h < 5 {
        return 0.0;
    }
    let n = w * h;
    let logl: Vec<f32> = (0..n)
        .map(|i| lum(hdr[i * 3], hdr[i * 3 + 1], hdr[i * 3 + 2]).max(1e-6).ln())
        .collect();

    // robust noise estimate: |L - median3x3(L)|
    let mut resid = Vec::with_capacity(n);
    let mut win = [0f32; 9];
    for y in 0..h {
        for x in 0..w {
            let mut k = 0;
            for dy in -1i32..=1 {
                for dx in -1i32..=1 {
                    let yy = (y as i32 + dy).clamp(0, h as i32 - 1) as usize;
                    let xx = (x as i32 + dx).clamp(0, w as i32 - 1) as usize;
                    win[k] = logl[yy * w + xx];
                    k += 1;
                }
            }
            win.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            resid.push((logl[y * w + x] - win[4]).abs());
        }
    }
    let mut rs = resid.clone();
    rs.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let sigma_n = (percentile(&rs, 0.5) * 1.4826).max(1e-4);

    let rad = 4i32;
    let inv2ss = 1.0 / (2.0 * 2.5 * 2.5);
    // The range sigma has to be at least as wide as the grain itself, otherwise
    // the filter classifies its own noise as edges and does nothing. Real edges
    // in this scene span 2+ decades (>4.6 log units), i.e. an order of magnitude
    // above the grain, so they survive comfortably; the 0.8 ceiling only guards
    // against pathological inputs.
    let sr = (1.6 * strength.clamp(0.05, 1.0) * sigma_n).clamp(1e-4, 0.80);
    let inv2sr = 1.0 / (2.0 * sr * sr);
    let mut out = vec![0f32; n * 3];
    for y in 0..h as i32 {
        for x in 0..w as i32 {
            let ci = (y as usize) * w + x as usize;
            let lc = logl[ci];
            let mut acc = [0f32; 3];
            let mut den = 0f32;
            for dy in -rad..=rad {
                let yy = (y + dy).clamp(0, h as i32 - 1) as usize;
                for dx in -rad..=rad {
                    let xx = (x + dx).clamp(0, w as i32 - 1) as usize;
                    let qi = yy * w + xx;
                    let dl = logl[qi] - lc;
                    let wgt = (-((dx * dx + dy * dy) as f32) * inv2ss - dl * dl * inv2sr).exp();
                    acc[0] += hdr[qi * 3] * wgt;
                    acc[1] += hdr[qi * 3 + 1] * wgt;
                    acc[2] += hdr[qi * 3 + 2] * wgt;
                    den += wgt;
                }
            }
            let inv = 1.0 / den.max(1e-8);
            for c in 0..3 {
                let filtered = acc[c] * inv;
                out[ci * 3 + c] = hdr[ci * 3 + c] * (1.0 - strength) + filtered * strength;
            }
        }
    }
    hdr.copy_from_slice(&out);
    sigma_n
}

pub struct GradeReport {
    pub exposure: f32,
    pub hdr_p05: f32,
    pub hdr_p50: f32,
    pub hdr_p95: f32,
    pub hdr_max: f32,
    pub base_decades: f32,
    pub frac_over_1: f32,
}

/// Full HDR -> 8-bit sRGB pipeline. Returns the encoded pixels and statistics.
pub fn tonemap(hdr: &[f32], w: usize, h: usize, g: &Grade) -> (Vec<u8>, GradeReport) {
    let n = w * h;
    assert_eq!(hdr.len(), n * 3);

    // ---- base/detail decomposition of the *unexposed* frame ---------------
    // The bilateral base layer serves two purposes: it drives the automatic
    // exposure (anchored on the brightest large-scale level, which is robust
    // against the tiny but enormously bright solar disc) and it separates the
    // local contrast that must survive the compression.
    let mut lums: Vec<f32> = Vec::with_capacity(n);
    for i in 0..n {
        lums.push(lum(hdr[i * 3], hdr[i * 3 + 1], hdr[i * 3 + 2]).max(0.0));
    }
    let mut sorted = lums.clone();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let log_raw: Vec<f32> = lums.iter().map(|l| l.max(1e-6).log10()).collect();
    let base_raw = bilateral_base(&log_raw, w, h);
    let mut bsorted = base_raw.clone();
    bsorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let bmin = percentile(&bsorted, 0.005);
    let bmax = percentile(&bsorted, 0.995);
    let span = (bmax - bmin).max(0.05);
    let comp = (g.target_decades / span).min(1.0);

    let exposure = g
        .exposure
        .unwrap_or_else(|| 10f32.powf(g.anchor - bmax).clamp(1e-8, 1e8));

    // ---- exposure + bloom -------------------------------------------------
    let mut exposed = vec![0f32; n * 3];
    for i in 0..n * 3 {
        exposed[i] = (hdr[i] * exposure).max(0.0);
    }
    if g.bloom > 0.0 {
        let bl = bloom(&exposed, w, h, g.bloom_threshold);
        for i in 0..n * 3 {
            exposed[i] += bl[i] * g.bloom;
        }
    }

    // ---- local operator on log10 luminance --------------------------------
    let mut log_l = vec![0f32; n];
    let mut l_lin = vec![0f32; n];
    for i in 0..n {
        let l = lum(exposed[i * 3], exposed[i * 3 + 1], exposed[i * 3 + 2]).max(1e-6);
        l_lin[i] = l;
        log_l[i] = l.log10();
    }
    let base = bilateral_base(&log_l, w, h);

    let mut out = vec![0u8; n * 3];
    let mut over = 0usize;
    for i in 0..n {
        let l = l_lin[i];
        let detail = (log_l[i] - base[i]).clamp(-3.0, 3.0);
        // Durand & Dorsey: compress the base, keep (or boost) the detail, and
        // anchor the compressed range so the brightest base sits at 10^anchor
        // (deliberately above white -> the exterior clips, the interior does not).
        let local_log = (base[i] - g.anchor) * comp + detail * g.detail + g.anchor;
        let l_local = 10f32.powf(local_log);
        let l_target = l * (1.0 - g.local) + l_local * g.local;
        let s = l_target / l.max(1e-6);
        let mut c = [exposed[i * 3] * s, exposed[i * 3 + 1] * s, exposed[i * 3 + 2] * s];
        // saturation around the tone-mapped luminance
        let lg = lum(c[0], c[1], c[2]);
        for ch in 0..3 {
            c[ch] = lg + (c[ch] - lg) * g.saturation;
            c[ch] = c[ch].max(0.0);
        }
        if lum(c[0], c[1], c[2]) > 1.0 {
            over += 1;
        }
        let t = aces(c);
        for ch in 0..3 {
            let v = srgb_oetf(t[ch]).clamp(0.0, 1.0);
            out[i * 3 + ch] = (v * 255.0 + 0.5) as u8;
        }
    }

    (
        out,
        GradeReport {
            exposure,
            hdr_p05: percentile(&sorted, 0.05),
            hdr_p50: percentile(&sorted, 0.5),
            hdr_p95: percentile(&sorted, 0.95),
            hdr_max: percentile(&sorted, 1.0),
            base_decades: span,
            frac_over_1: over as f32 / n as f32,
        },
    )
}

// ------------------------------------------------------------- AOV rendering
/// Turbo-like perceptual colormap (polynomial fit, no lookup table).
fn turbo(t: f32) -> [f32; 3] {
    let x = t.clamp(0.0, 1.0);
    let r = 0.13572138 + x * (4.61539260 + x * (-42.66032258 + x * (132.13108234 + x * (-152.94239396 + x * 59.28637943))));
    let g = 0.09140261 + x * (2.19418839 + x * (4.84296658 + x * (-14.18503333 + x * (4.27729857 + x * 2.82956604))));
    let b = 0.10667330 + x * (12.64194608 + x * (-60.58204836 + x * (110.36276771 + x * (-89.90310912 + x * 27.34824973))));
    [r.clamp(0.0, 1.0), g.clamp(0.0, 1.0), b.clamp(0.0, 1.0)]
}

/// False-colour an AOV channel with the turbo map, normalised on its 99.5th
/// percentile. `log_scale` compresses a wide range so faint structure survives.
pub fn falsecolor(vals: &[f32], w: usize, h: usize, log_scale: bool) -> (Vec<u8>, f32) {
    let n = w * h;
    let mut sorted: Vec<f32> = vals.iter().copied().filter(|v| v.is_finite()).collect();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let hi = percentile(&sorted, 0.995).max(1e-6);
    let mut out = vec![0u8; n * 3];
    for i in 0..n {
        let v = (vals[i].max(0.0) / hi).clamp(0.0, 1.0);
        let t = if log_scale {
            (1.0 + 40.0 * v).ln() / 41f32.ln()
        } else {
            v
        };
        let c = turbo(t);
        for ch in 0..3 {
            out[i * 3 + ch] = (srgb_oetf(c[ch]) * 255.0 + 0.5) as u8;
        }
    }
    (out, hi)
}
