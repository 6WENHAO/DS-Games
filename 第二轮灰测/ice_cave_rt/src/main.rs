//! Polar ice cave path tracer — command line front end.
//!
//! Vulkan compute (ash) + WGSL compiled in-process (naga). Renders
//! progressively in tiles so no single GPU submission can trip the Windows
//! TDR watchdog, then finishes the HDR frame on the host.

mod gpu;
mod png;
mod post;
mod scene;
mod shader;

use ash::vk;
use gpu::{Gpu, Kernel};
use scene::{build_params, describe, preset_camera, SceneCfg, MAT_NAMES, PRESETS};
use std::path::{Path, PathBuf};
use std::time::Instant;

const EMBEDDED_WGSL: &str = include_str!("../shaders/ice_cave.wgsl");

#[repr(C)]
#[derive(Clone, Copy)]
struct Push {
    tile: [u32; 4],
    ctl: [u32; 4],
}

struct Args {
    width: u32,
    height: u32,
    spp: u32,
    out: PathBuf,
    cfg: SceneCfg,
    grade: post::Grade,
    tile: u32,
    budget_ms: f64,
    frames: u32,
    fps: f32,
    aov: bool,
    hdr: bool,
    probe: Option<(u32, u32)>,
    probe_max: u32,
    gpu_index: Option<usize>,
    shader_path: Option<PathBuf>,
    list_gpus: bool,
    print_params: bool,
    seed: u32,
    save_every: u32,
    regrade: Option<PathBuf>,
    preset_name: String,
    denoise: f32,
    validate_only: Option<PathBuf>,
}

impl Default for Args {
    fn default() -> Self {
        Args {
            width: 1280,
            height: 720,
            spp: 256,
            out: PathBuf::from("out/ice_cave.png"),
            cfg: SceneCfg::default(),
            grade: post::Grade::default(),
            tile: 96,
            budget_ms: 220.0,
            frames: 1,
            fps: 12.0,
            aov: false,
            hdr: false,
            probe: None,
            probe_max: 24,
            gpu_index: None,
            shader_path: None,
            list_gpus: false,
            print_params: false,
            seed: 0x5eed_1ce5,
            save_every: 0,
            regrade: None,
            preset_name: "hero".into(),
            denoise: 0.75,
            validate_only: None,
        }
    }
}

const HELP: &str = r#"ice_cave_rt — polar ice cave path tracer (Vulkan compute)

  Participating media (delta / ratio tracking), brute-force subsurface
  scattering inside ice, multi-layer refraction, frost normal perturbation,
  local + global HDR tone mapping, animated crystals, diffraction glory.

USAGE
  ice_cave_rt [options]

IMAGE
  --width N --height N          output resolution           (1280 x 720)
  --spp N                       samples per pixel           (256)
  --out PATH                    png path; siblings get the AOV/hdr suffixes
  --tile N                      tile edge in pixels         (96)
  --budget-ms F                 target GPU ms per submission (220, TDR safety)
  --save-every N                write a partial png every N spp passes
  --seed N                      sampler seed

CAMERA / SCENE
  --preset NAME                 hero | shafts | block | glory | section
  --eye X,Y,Z  --target X,Y,Z   explicit camera
  --fov DEG                     vertical field of view
  --aperture R                  thin lens radius (metres, 0 = pinhole)
  --time T                      animation time in seconds
  --frames N  --fps F           render an animated sequence (crystal drift)

LIGHT
  --sun-el DEG --sun-az DEG     solar elevation / azimuth   (23 / -17)
  --sun-radius DEG              angular radius of the disc  (0.85)
  --sun F --sky F --haze F      sun radiance, sky scale, exterior haze sigma_t

MEDIA / MATERIAL
  --fog F --frost F             cave mist and wall-hugging frost sigma_t
  --fog-height F --fog-g F      mist height falloff, HG anisotropy
  --fog-albedo F                mist single-scattering albedo (0.86)
  --block-ss F --wall-ss F      sigma_s of the SSS block / of the shell
  --wall-sa F                   shell absorption scale (spectral tilt fixed)
  --snow F                      snow albedo
  --ior F --rough F --frost-amp F --dispersion F
  --corona F --glory F --halo F --xsize F    diffraction lobes + size parameter

SAMPLING
  --bounces N --steps N         path length, sphere-tracing steps
  --shadow-cap N --rr-start N

TONE MAPPING (also usable alone via --regrade)
  --exposure F                  manual exposure (default: auto, see --anchor)
  --local F                     local operator blend 0..1   (0.80)
  --decades F --detail F        base compression / detail gain
  --anchor F                    log10 push of the exterior past white (0.34)
  --bloom F --bloom-th F --sat F
  --denoise F                   Monte-Carlo grain removal 0..1 (0.75; 0 = off)
  --regrade FILE.pfm            re-grade an existing HDR frame, no rendering

DIAGNOSTICS
  --aov                         write volumetric / SSS / refraction-count AOVs
  --hdr                         write the linear HDR frame as .pfm
  --probe X,Y [--probe-max N]   log the refraction chain of one pixel to csv
  --print-params                dump the resolved physical parameters
  --list-gpus                   enumerate Vulkan devices and exit
  --gpu N                       pick a device
  --shader PATH                 use an external WGSL file instead of the built-in
  --validate-only PATH          validate a WGSL file under the default (WebGPU)
                                capability set and exit - used to check the
                                single-file HTML build of the same shader
  -h, --help
"#;

fn parse_f32(s: &str, what: &str) -> f32 {
    s.parse::<f32>()
        .unwrap_or_else(|_| fail(&format!("{what}: expected a number, got '{s}'")))
}

fn parse_u32(s: &str, what: &str) -> u32 {
    s.parse::<u32>()
        .unwrap_or_else(|_| fail(&format!("{what}: expected an integer, got '{s}'")))
}

fn parse_vec3(s: &str, what: &str) -> [f32; 3] {
    let p: Vec<&str> = s.split(',').collect();
    if p.len() != 3 {
        fail(&format!("{what}: expected X,Y,Z"));
    }
    [
        parse_f32(p[0], what),
        parse_f32(p[1], what),
        parse_f32(p[2], what),
    ]
}

fn fail(msg: &str) -> ! {
    eprintln!("error: {msg}");
    std::process::exit(2);
}

fn parse_args() -> Args {
    let mut a = Args::default();
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let mut i = 0usize;
    let next = |i: &mut usize, flag: &str| -> String {
        *i += 1;
        if *i >= argv.len() {
            fail(&format!("{flag} needs a value"));
        }
        argv[*i].clone()
    };
    while i < argv.len() {
        let f = argv[i].clone();
        match f.as_str() {
            "-h" | "--help" => {
                print!("{HELP}");
                std::process::exit(0);
            }
            "--width" => a.width = parse_u32(&next(&mut i, &f), &f),
            "--height" => a.height = parse_u32(&next(&mut i, &f), &f),
            "--spp" => a.spp = parse_u32(&next(&mut i, &f), &f).max(1),
            "--out" => a.out = PathBuf::from(next(&mut i, &f)),
            "--tile" => a.tile = parse_u32(&next(&mut i, &f), &f).clamp(8, 4096),
            "--budget-ms" => a.budget_ms = parse_f32(&next(&mut i, &f), &f) as f64,
            "--save-every" => a.save_every = parse_u32(&next(&mut i, &f), &f),
            "--seed" => a.seed = parse_u32(&next(&mut i, &f), &f),
            "--preset" => {
                let n = next(&mut i, &f);
                match preset_camera(&n) {
                    Some((c, _)) => {
                        a.cfg.cam = c;
                        a.preset_name = n;
                    }
                    None => fail(&format!("unknown preset '{n}', try one of {PRESETS:?}")),
                }
            }
            "--eye" => a.cfg.cam.eye = parse_vec3(&next(&mut i, &f), &f),
            "--target" => a.cfg.cam.target = parse_vec3(&next(&mut i, &f), &f),
            "--fov" => a.cfg.cam.fov_y_deg = parse_f32(&next(&mut i, &f), &f),
            "--aperture" => a.cfg.cam.aperture = parse_f32(&next(&mut i, &f), &f),
            "--time" => a.cfg.time = parse_f32(&next(&mut i, &f), &f),
            "--frames" => a.frames = parse_u32(&next(&mut i, &f), &f).max(1),
            "--fps" => a.fps = parse_f32(&next(&mut i, &f), &f).max(0.001),
            "--sun-el" => a.cfg.sun_elev_deg = parse_f32(&next(&mut i, &f), &f),
            "--sun-az" => a.cfg.sun_azim_deg = parse_f32(&next(&mut i, &f), &f),
            "--sun-radius" => a.cfg.sun_radius_deg = parse_f32(&next(&mut i, &f), &f).max(0.01),
            "--sun" => a.cfg.sun_strength = parse_f32(&next(&mut i, &f), &f),
            "--sky" => a.cfg.sky_strength = parse_f32(&next(&mut i, &f), &f),
            "--haze" => a.cfg.haze = parse_f32(&next(&mut i, &f), &f),
            "--fog" => a.cfg.fog_base = parse_f32(&next(&mut i, &f), &f),
            "--frost" => a.cfg.fog_frost = parse_f32(&next(&mut i, &f), &f),
            "--fog-height" => a.cfg.fog_height = parse_f32(&next(&mut i, &f), &f),
            "--fog-g" => a.cfg.fog_g = parse_f32(&next(&mut i, &f), &f).clamp(-0.95, 0.95),
            "--fog-albedo" => a.cfg.fog_albedo = parse_f32(&next(&mut i, &f), &f).clamp(0.0, 1.0),
            "--block-ss" => a.cfg.block_sigma_s = parse_f32(&next(&mut i, &f), &f),
            "--wall-ss" => a.cfg.wall_sigma_s = parse_f32(&next(&mut i, &f), &f),
            "--wall-sa" => a.cfg.wall_sigma_a = parse_f32(&next(&mut i, &f), &f),
            "--snow" => a.cfg.snow_albedo = parse_f32(&next(&mut i, &f), &f).clamp(0.0, 1.0),
            "--ior" => a.cfg.ice_ior = parse_f32(&next(&mut i, &f), &f).max(1.0001),
            "--rough" => a.cfg.ice_rough = parse_f32(&next(&mut i, &f), &f).clamp(0.0, 1.0),
            "--frost-amp" => a.cfg.frost = parse_f32(&next(&mut i, &f), &f),
            "--dispersion" => a.cfg.dispersion = parse_f32(&next(&mut i, &f), &f),
            "--corona" => a.cfg.corona = parse_f32(&next(&mut i, &f), &f),
            "--glory" => a.cfg.glory = parse_f32(&next(&mut i, &f), &f),
            "--halo" => a.cfg.halo = parse_f32(&next(&mut i, &f), &f),
            "--xsize" => a.cfg.size_param = parse_f32(&next(&mut i, &f), &f).max(2.0),
            "--bounces" => a.cfg.bounces = parse_u32(&next(&mut i, &f), &f).clamp(1, 512),
            "--steps" => a.cfg.steps = parse_u32(&next(&mut i, &f), &f).clamp(16, 2048),
            "--shadow-cap" => a.cfg.shadow_cap = parse_u32(&next(&mut i, &f), &f).clamp(1, 32),
            "--rr-start" => a.cfg.rr_start = parse_u32(&next(&mut i, &f), &f),
            "--exposure" => a.grade.exposure = Some(parse_f32(&next(&mut i, &f), &f)),
            "--local" => a.grade.local = parse_f32(&next(&mut i, &f), &f).clamp(0.0, 1.0),
            "--decades" => a.grade.target_decades = parse_f32(&next(&mut i, &f), &f),
            "--anchor" => a.grade.anchor = parse_f32(&next(&mut i, &f), &f),
            "--detail" => a.grade.detail = parse_f32(&next(&mut i, &f), &f),
            "--bloom" => a.grade.bloom = parse_f32(&next(&mut i, &f), &f),
            "--bloom-th" => a.grade.bloom_threshold = parse_f32(&next(&mut i, &f), &f),
            "--sat" => a.grade.saturation = parse_f32(&next(&mut i, &f), &f),
            "--denoise" => a.denoise = parse_f32(&next(&mut i, &f), &f).clamp(0.0, 1.0),
            "--aov" => a.aov = true,
            "--hdr" => a.hdr = true,
            "--probe" => {
                let v = next(&mut i, &f);
                let p: Vec<&str> = v.split(',').collect();
                if p.len() != 2 {
                    fail("--probe expects X,Y");
                }
                a.probe = Some((parse_u32(p[0], &f), parse_u32(p[1], &f)));
            }
            "--probe-max" => a.probe_max = parse_u32(&next(&mut i, &f), &f).clamp(1, 64),
            "--gpu" => a.gpu_index = Some(parse_u32(&next(&mut i, &f), &f) as usize),
            "--shader" => a.shader_path = Some(PathBuf::from(next(&mut i, &f))),
            "--list-gpus" => a.list_gpus = true,
            "--print-params" => a.print_params = true,
            "--regrade" => a.regrade = Some(PathBuf::from(next(&mut i, &f))),
            "--validate-only" => a.validate_only = Some(PathBuf::from(next(&mut i, &f))),
            other => fail(&format!("unknown option '{other}' (try --help)")),
        }
        i += 1;
    }
    a
}

fn with_suffix(base: &Path, suffix: &str, ext: &str) -> PathBuf {
    let stem = base
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "frame".into());
    let dir = base.parent().unwrap_or(Path::new("."));
    dir.join(format!("{stem}{suffix}.{ext}"))
}

fn main() {
    let args = parse_args();

    // ---- WGSL portability check (no GPU, no push constants) ----------------
    if let Some(p) = &args.validate_only {
        let src = std::fs::read_to_string(p)
            .unwrap_or_else(|e| fail(&format!("{}: {e}", p.display())));
        match shader::validate_webgpu(&src) {
            Ok(eps) => {
                println!(
                    "ok       {} validates under the default (WebGPU) capability set; entry points {:?}",
                    p.display(),
                    eps
                );
            }
            Err(e) => fail(&e),
        }
        return;
    }

    if args.list_gpus {
        match Gpu::list() {
            Ok(v) => {
                println!("Vulkan devices:");
                for l in v {
                    println!("  {l}");
                }
            }
            Err(e) => fail(&e),
        }
        return;
    }

    // ---- pure re-grade path (no GPU work at all) --------------------------
    if let Some(p) = &args.regrade {
        let (w, h, mut hdr) =
            png::read_pfm(p).unwrap_or_else(|e| fail(&format!("{}: {e}", p.display())));
        let sigma_n = post::denoise(&mut hdr, w as usize, h as usize, args.denoise);
        let (rgb, rep) = post::tonemap(&hdr, w as usize, h as usize, &args.grade);
        png::write_rgb8(&args.out, w, h, &rgb)
            .unwrap_or_else(|e| fail(&format!("{}: {e}", args.out.display())));
        println!(
            "regraded {} ({}x{}) -> {}  exposure {:.4}  base span {:.2} decades  {:.2}% above white  denoise {:.2} (grain sigma {:.4})",
            p.display(),
            w,
            h,
            args.out.display(),
            rep.exposure,
            rep.base_decades,
            rep.frac_over_1 * 100.0,
            args.denoise,
            sigma_n
        );
        return;
    }

    // ---- shader ----------------------------------------------------------
    let (src, src_name) = match &args.shader_path {
        Some(p) => (
            std::fs::read_to_string(p).unwrap_or_else(|e| fail(&format!("{}: {e}", p.display()))),
            p.display().to_string(),
        ),
        None => (EMBEDDED_WGSL.to_string(), "<built-in>".into()),
    };
    let t_compile = Instant::now();
    let compiled = shader::compile_wgsl(&src).unwrap_or_else(|e| fail(&e));
    println!(
        "shader   {src_name}: {} SPIR-V words, entry points {:?} ({:.0} ms)",
        compiled.words.len(),
        compiled.entry_points,
        t_compile.elapsed().as_secs_f64() * 1000.0
    );

    // ---- device ----------------------------------------------------------
    let g = Gpu::new(args.gpu_index).unwrap_or_else(|e| fail(&e));
    println!(
        "device   {} ({}, Vulkan {}.{}.{}, {} MB device-local, max workgroups {}x{}x{})",
        g.info.name,
        g.info.kind,
        g.info.api.0,
        g.info.api.1,
        g.info.api.2,
        g.info.max_alloc_mb,
        g.info.max_wg[0],
        g.info.max_wg[1],
        g.info.max_wg[2]
    );

    let w = args.width;
    let h = args.height;
    let npix = (w as u64) * (h as u64);
    let probe_words = 1 + args.probe_max as u64 * 5;

    let params_buf = g
        .create_buffer(
            std::mem::size_of::<scene::Params>() as u64,
            vk::BufferUsageFlags::UNIFORM_BUFFER,
        )
        .unwrap_or_else(|e| fail(&e));
    let accum = g
        .create_buffer(npix * 16, vk::BufferUsageFlags::STORAGE_BUFFER)
        .unwrap_or_else(|e| fail(&e));
    let aovbuf = g
        .create_buffer(npix * 16, vk::BufferUsageFlags::STORAGE_BUFFER)
        .unwrap_or_else(|e| fail(&e));
    let probebuf = g
        .create_buffer(probe_words * 16, vk::BufferUsageFlags::STORAGE_BUFFER)
        .unwrap_or_else(|e| fail(&e));

    let kernel = Kernel::new(
        &g,
        &compiled.words,
        &params_buf,
        &accum,
        &aovbuf,
        &probebuf,
        std::mem::size_of::<Push>() as u32,
    )
    .unwrap_or_else(|e| fail(&e));

    // tiles: keep every submission small so the OS watchdog never fires
    let mut tiles: Vec<[u32; 4]> = Vec::new();
    let mut ty = 0u32;
    while ty < h {
        let mut tx = 0u32;
        while tx < w {
            tiles.push([tx, ty, (args.tile).min(w - tx), (args.tile).min(h - ty)]);
            tx += args.tile;
        }
        ty += args.tile;
    }

    println!(
        "frame    {}x{} @ {} spp, preset '{}', {} tiles of {}px, {} bounces, {} march steps",
        w, h, args.spp, args.preset_name, tiles.len(), args.tile, args.cfg.bounces, args.cfg.steps
    );

    for frame in 0..args.frames {
        let mut cfg = args.cfg.clone();
        if args.frames > 1 {
            cfg.time = args.cfg.time + frame as f32 / args.fps;
        }
        let probe_px = args.probe.map(|p| p.0).unwrap_or(w / 2);
        let probe_py = args.probe.map(|p| p.1).unwrap_or(h / 2);
        let params = build_params(
            &cfg,
            w,
            h,
            true, // AOVs are cheap by-products and drive the acceptance stats
            probe_px.min(w - 1),
            probe_py.min(h - 1),
            args.probe_max,
        );
        params_buf.write_bytes(params.as_bytes());
        if args.print_params && frame == 0 {
            print!("{}", describe(&cfg, &params));
        }
        accum.zero();
        aovbuf.zero();

        // ---- progressive tiled accumulation ------------------------------
        let t_start = Instant::now();
        let mut done = 0u32;
        let mut chunk = 1u32;
        let mut last_report = Instant::now();
        while done < args.spp {
            let c = chunk.min(args.spp - done);
            let t0 = Instant::now();
            for t in &tiles {
                let push = Push {
                    tile: *t,
                    ctl: [done, c, args.seed ^ frame.wrapping_mul(0x9E37_79B9), 0],
                };
                let gx = (t[2] + 7) / 8;
                let gy = (t[3] + 7) / 8;
                g.submit_sync(|cb| unsafe {
                    let d = &g.device;
                    d.cmd_bind_pipeline(cb, vk::PipelineBindPoint::COMPUTE, kernel.render);
                    d.cmd_bind_descriptor_sets(
                        cb,
                        vk::PipelineBindPoint::COMPUTE,
                        kernel.layout,
                        0,
                        &[kernel.set],
                        &[],
                    );
                    let bytes = std::slice::from_raw_parts(
                        &push as *const Push as *const u8,
                        std::mem::size_of::<Push>(),
                    );
                    d.cmd_push_constants(
                        cb,
                        kernel.layout,
                        vk::ShaderStageFlags::COMPUTE,
                        0,
                        bytes,
                    );
                    d.cmd_dispatch(cb, gx, gy, 1);
                })
                .unwrap_or_else(|e| fail(&e));
            }
            let dt = t0.elapsed().as_secs_f64();
            done += c;

            // adapt the samples per submission towards the TDR-safe budget
            let per_tile_ms = dt * 1000.0 / tiles.len() as f64 / c as f64;
            let want = (args.budget_ms / per_tile_ms.max(0.001)).floor();
            chunk = (want as u32).clamp(1, 64);

            if last_report.elapsed().as_secs_f64() > 2.0 || done >= args.spp {
                let el = t_start.elapsed().as_secs_f64();
                let eta = el / done as f64 * (args.spp - done) as f64;
                eprint!(
                    "\r  frame {}/{}  {:>5}/{} spp  {:>5.1}%  {:.1}s elapsed  {:.1}s eta  ({:.2} ms/tile/spp)   ",
                    frame + 1, args.frames, done, args.spp,
                    100.0 * done as f64 / args.spp as f64, el, eta, per_tile_ms
                );
                last_report = Instant::now();
            }
            if args.save_every > 0 && done % args.save_every == 0 && done < args.spp {
                let mut hdr = read_hdr(&accum, npix as usize);
                post::denoise(&mut hdr, w as usize, h as usize, args.denoise);
                let (rgb, _) = post::tonemap(&hdr, w as usize, h as usize, &args.grade);
                let p = with_suffix(&args.out, &format!("_partial{done:05}"), "png");
                let _ = png::write_rgb8(&p, w, h, &rgb);
            }
        }
        eprintln!();

        // ---- read back + finish ------------------------------------------
        let hdr_raw = read_hdr(&accum, npix as usize);
        let mut hdr = hdr_raw.clone();
        let sigma_n = post::denoise(&mut hdr, w as usize, h as usize, args.denoise);
        let aov = unsafe { aovbuf.as_slice::<[f32; 4]>() };
        let inv = 1.0 / args.spp as f32;

        let out_png = if args.frames > 1 {
            with_suffix(&args.out, &format!("_{frame:04}"), "png")
        } else {
            args.out.clone()
        };
        let (rgb, rep) = post::tonemap(&hdr, w as usize, h as usize, &args.grade);
        png::write_rgb8(&out_png, w, h, &rgb)
            .unwrap_or_else(|e| fail(&format!("{}: {e}", out_png.display())));

        println!(
            "render   {:.1}s  exposure {:.4}  HDR p05 {:.4} p50 {:.3} p95 {:.2} max {:.1}  ratio p95/p05 {:.0}x  base span {:.2} dec  {:.2}% > white",
            t_start.elapsed().as_secs_f64(),
            rep.exposure,
            rep.hdr_p05,
            rep.hdr_p50,
            rep.hdr_p95,
            rep.hdr_max,
            rep.hdr_p95 / rep.hdr_p05.max(1e-6),
            rep.base_decades,
            rep.frac_over_1 * 100.0
        );
        println!("output   {}", out_png.display());
        if args.denoise > 0.0 {
            println!(
                "denoise  adaptive log-domain bilateral, strength {:.2}, estimated grain sigma {:.4} (log units)",
                args.denoise, sigma_n
            );
        }

        // scene statistics that map 1:1 onto the acceptance criteria
        let mut vol_sum = 0f64;
        let mut sss_sum = 0f64;
        let mut refr_hist = [0u64; 8];
        let mut refr_max = 0f32;
        let mut vol_px = 0u64;
        let mut sss_px = 0u64;
        for p in aov.iter() {
            let r = p[0] * inv;
            let v = p[1] * inv;
            let s = p[2] * inv;
            vol_sum += v as f64;
            sss_sum += s as f64;
            if v > 0.02 {
                vol_px += 1;
            }
            if s > 0.02 {
                sss_px += 1;
            }
            refr_max = refr_max.max(r);
            refr_hist[(r.round() as usize).min(7)] += 1;
        }
        let n = npix as f64;
        println!(
            "aov      volumetric in-scatter: mean {:.4}, {:.1}% of pixels lit;  subsurface: mean {:.4}, {:.1}% of pixels",
            vol_sum / n,
            100.0 * vol_px as f64 / n,
            sss_sum / n,
            100.0 * sss_px as f64 / n
        );
        print!("refract  boundary crossings per pixel (mean over paths):");
        for (k, c) in refr_hist.iter().enumerate() {
            if *c > 0 {
                print!(" {}:{:.1}%", k, 100.0 * *c as f64 / n);
            }
        }
        println!("  max {refr_max:.2}");

        if args.hdr {
            let p = with_suffix(&out_png, "", "pfm");
            // the .pfm keeps the *raw* accumulation: denoising is a display
            // decision and must stay re-doable via --regrade
            png::write_pfm(&p, w, h, &hdr_raw)
                .unwrap_or_else(|e| fail(&format!("{}: {e}", p.display())));
            println!("output   {}", p.display());
        }
        if args.aov {
            let mut vol = vec![0f32; npix as usize];
            let mut sss = vec![0f32; npix as usize];
            let mut refr = vec![0f32; npix as usize];
            for (i, p) in aov.iter().enumerate() {
                refr[i] = p[0] * inv;
                vol[i] = p[1] * inv;
                sss[i] = p[2] * inv;
            }
            for (data, name, logscale) in [
                (&vol, "_aov_volumetric", true),
                (&sss, "_aov_subsurface", true),
                (&refr, "_aov_refractions", false),
            ] {
                let (img, hi) = post::falsecolor(data, w as usize, h as usize, logscale);
                let p = with_suffix(&out_png, name, "png");
                png::write_rgb8(&p, w, h, &img)
                    .unwrap_or_else(|e| fail(&format!("{}: {e}", p.display())));
                println!("output   {}  (99.5th percentile = {:.3})", p.display(), hi);
                if args.hdr {
                    // linear copy of the AOV as well: greyscale PFM, so the
                    // channel can be analysed without the colour map
                    let mut g3 = vec![0f32; (npix as usize) * 3];
                    for (i, v) in data.iter().enumerate() {
                        g3[i * 3] = *v;
                        g3[i * 3 + 1] = *v;
                        g3[i * 3 + 2] = *v;
                    }
                    let pp = with_suffix(&out_png, name, "pfm");
                    png::write_pfm(&pp, w, h, &g3)
                        .unwrap_or_else(|e| fail(&format!("{}: {e}", pp.display())));
                }
            }
        }

        // ---- refraction chain probe --------------------------------------
        if let Some((px, py)) = args.probe {
            probebuf.zero();
            g.submit_sync(|cb| unsafe {
                let d = &g.device;
                d.cmd_bind_pipeline(cb, vk::PipelineBindPoint::COMPUTE, kernel.probe);
                d.cmd_bind_descriptor_sets(
                    cb,
                    vk::PipelineBindPoint::COMPUTE,
                    kernel.layout,
                    0,
                    &[kernel.set],
                    &[],
                );
                let push = Push {
                    tile: [px, py, 1, 1],
                    ctl: [0, 1, args.seed, 1],
                };
                let bytes = std::slice::from_raw_parts(
                    &push as *const Push as *const u8,
                    std::mem::size_of::<Push>(),
                );
                d.cmd_push_constants(cb, kernel.layout, vk::ShaderStageFlags::COMPUTE, 0, bytes);
                d.cmd_dispatch(cb, 1, 1, 1);
            })
            .unwrap_or_else(|e| fail(&e));

            let rec = unsafe { probebuf.as_slice::<[f32; 4]>() };
            let count = rec[0][0] as usize;
            let mut csv = String::from(
                "event,material,kind,pos_x,pos_y,pos_z,seg_len,in_x,in_y,in_z,ior_in,n_x,n_y,n_z,ior_out,out_x,out_y,out_z,deviation_deg,fresnel_R,optical_depth\n",
            );
            println!(
                "probe    pixel ({px},{py}): {count} boundary events along the deterministic refracted branch"
            );
            println!(
                "  #  material                    kind      incident dir            normal                 refracted dir           dev    R      tau"
            );
            for k in 0..count.min(args.probe_max as usize) {
                let b = 1 + k * 5;
                let p = rec[b];
                let din = rec[b + 1];
                let nn = rec[b + 2];
                let dout = rec[b + 3];
                let meta = rec[b + 4];
                let mat = (meta[0] as usize).min(MAT_NAMES.len() - 1);
                let kind = match meta[1] as i32 {
                    0 => "refract",
                    1 => "TIR",
                    _ => "opaque",
                };
                println!(
                    " {:>2}  {:<26} {:<9} ({:>6.3},{:>6.3},{:>6.3})  ({:>6.3},{:>6.3},{:>6.3})  ({:>6.3},{:>6.3},{:>6.3})  {:>5.1}  {:.3}  {:.3}",
                    k + 1, MAT_NAMES[mat], kind,
                    din[0], din[1], din[2], nn[0], nn[1], nn[2], dout[0], dout[1], dout[2],
                    dout[3], meta[2], meta[3]
                );
                csv.push_str(&format!(
                    "{},{},{},{:.5},{:.5},{:.5},{:.5},{:.6},{:.6},{:.6},{:.4},{:.6},{:.6},{:.6},{:.4},{:.6},{:.6},{:.6},{:.4},{:.5},{:.5}\n",
                    k + 1, MAT_NAMES[mat], kind,
                    p[0], p[1], p[2], p[3],
                    din[0], din[1], din[2], din[3],
                    nn[0], nn[1], nn[2], nn[3],
                    dout[0], dout[1], dout[2], dout[3],
                    meta[2], meta[3]
                ));
            }
            let cp = with_suffix(&out_png, "_probe", "csv");
            if let Some(dir) = cp.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            std::fs::write(&cp, csv).unwrap_or_else(|e| fail(&format!("{}: {e}", cp.display())));
            println!("output   {}", cp.display());
        }
    }

    kernel.destroy(&g);
    g.destroy_buffer(&params_buf);
    g.destroy_buffer(&accum);
    g.destroy_buffer(&aovbuf);
    g.destroy_buffer(&probebuf);
}

fn read_hdr(accum: &gpu::Buffer, npix: usize) -> Vec<f32> {
    let src = unsafe { accum.as_slice::<[f32; 4]>() };
    let mut out = vec![0f32; npix * 3];
    for i in 0..npix {
        let p = src[i];
        let n = if p[3] > 0.0 { 1.0 / p[3] } else { 0.0 };
        out[i * 3] = p[0] * n;
        out[i * 3 + 1] = p[1] * n;
        out[i * 3 + 2] = p[2] * n;
    }
    out
}
