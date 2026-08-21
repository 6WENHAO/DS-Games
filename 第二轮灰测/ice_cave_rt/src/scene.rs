//! Scene description shared with the GPU: the uniform block layout, the
//! physical defaults (ice optics, mist, sun/sky) and the camera presets.
//!
//! All values are in SI-ish units: metres, 1/metre for extinction, radiance in
//! arbitrary but *consistent* units (the sun/sky ratio is what matters, and the
//! exposure stage normalises the result).

use std::f32::consts::PI;

pub const MAT_NAMES: [&str; 6] = [
    "none",
    "ice-wall(shell)",
    "clear-ice(icicle/column)",
    "ice-block(SSS)",
    "crystal-sheet",
    "snow",
];

#[repr(C)]
#[derive(Clone, Copy, Debug)]
pub struct Params {
    pub cam_pos: [f32; 4],   // xyz eye,          w tan(fov/2)
    pub cam_fwd: [f32; 4],   // xyz forward,      w aspect
    pub cam_right: [f32; 4], // xyz right,        w aperture radius
    pub cam_up: [f32; 4],    // xyz up,           w focus distance
    pub sun_dir: [f32; 4],   // xyz toward sun,   w cos(angular radius)
    pub sun_rad: [f32; 4],   // rgb sun radiance, w exterior haze extinction
    pub sky_zen: [f32; 4],   // rgb zenith,       w sky scale
    pub sky_hor: [f32; 4],   // rgb horizon,      w aureole strength
    pub fog: [f32; 4],       // x base sigma_t, y frost sigma_t, z height falloff, w majorant
    pub fog2: [f32; 4],      // rgb albedo,       w HG g
    pub wall_ss: [f32; 4],   // rgb sigma_s,      w HG g
    pub wall_sa: [f32; 4],   // rgb sigma_a,      w roughness (shell)
    pub blk_ss: [f32; 4],
    pub blk_sa: [f32; 4],
    pub clr_ss: [f32; 4],
    pub clr_sa: [f32; 4],
    pub optics: [f32; 4], // x ior, y crystal dispersion, z frost amp, w snow albedo
    pub diffr: [f32; 4],  // x corona w, y glory w, z halo w, w size parameter
    pub anim: [f32; 4],   // x time, y flake drift speed, z fog scroll, w crystal wobble
    pub ctrl: [u32; 4],   // x width, y height, z max bounces, w max march steps
    pub ctrl2: [u32; 4],  // x shadow boundary cap, y rr start, z aov enable, w probe px
    pub ctrl3: [u32; 4],  // x probe py, y probe max events, z,w reserved
}

impl Params {
    pub fn as_bytes(&self) -> &[u8] {
        unsafe {
            std::slice::from_raw_parts(
                self as *const Params as *const u8,
                std::mem::size_of::<Params>(),
            )
        }
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Camera {
    pub eye: [f32; 3],
    pub target: [f32; 3],
    pub fov_y_deg: f32,
    pub aperture: f32,
}

pub fn preset_camera(name: &str) -> Option<(Camera, &'static str)> {
    let c = match name {
        // the hero shot: deep inside the cave, looking out through the mouth so
        // the frame holds the blown-out exterior, several light columns and the
        // dark far walls at once
        "hero" => (
            Camera {
                eye: [-1.20, 1.50, -12.50],
                target: [0.35, 2.15, 4.00],
                fov_y_deg: 62.0,
                aperture: 0.0,
            },
            "deep inside looking out: light columns, backlit blocks, blown exterior",
        ),
        // looking up into the ceiling apertures: maximum shaft separation
        "shafts" => (
            Camera {
                eye: [1.20, 1.10, -7.00],
                target: [-1.80, 4.30, -3.00],
                fov_y_deg: 72.0,
                aperture: 0.0,
            },
            "low angle towards the sun-aligned ceiling apertures: separated shafts",
        ),
        // close-up of the big block: LED-filament subsurface glow
        "block" => (
            Camera {
                eye: [-1.60, 1.05, -11.60],
                target: [-0.30, 0.62, -9.20],
                fov_y_deg: 45.0,
                aperture: 0.02,
            },
            "close-up of the subsurface-scattering block under its light column",
        ),
        // antisolar view: the diffraction glory ("佛光") sits around this axis
        "glory" => (
            Camera {
                eye: [0.20, 2.60, -1.20],
                target: [1.60, 0.90, -7.60],
                fov_y_deg: 76.0,
                aperture: 0.0,
            },
            "looking away from the sun into the mist: antisolar glory rings",
        ),
        // the cross-section: outside the mouth looking in
        "section" => (
            Camera {
                eye: [4.60, 2.35, 12.20],
                target: [-0.60, 1.90, -6.00],
                fov_y_deg: 62.0,
                aperture: 0.0,
            },
            "outside-in cross section: exterior glare, wall thickness, dark interior",
        ),
        _ => return None,
    };
    Some(c)
}

pub const PRESETS: [&str; 5] = ["hero", "shafts", "block", "glory", "section"];

fn norm(v: [f32; 3]) -> [f32; 3] {
    let l = (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt().max(1e-20);
    [v[0] / l, v[1] / l, v[2] / l]
}
fn cross(a: [f32; 3], b: [f32; 3]) -> [f32; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

/// Everything the CLI can override, in physical terms.
#[derive(Clone, Debug)]
pub struct SceneCfg {
    pub cam: Camera,
    pub sun_elev_deg: f32,
    pub sun_azim_deg: f32,
    pub sun_radius_deg: f32,
    pub sun_strength: f32,
    pub sky_strength: f32,
    pub haze: f32,
    pub fog_base: f32,
    pub fog_frost: f32,
    pub fog_height: f32,
    pub fog_g: f32,
    pub fog_albedo: f32,
    pub ice_ior: f32,
    pub ice_rough: f32,
    pub frost: f32,
    pub dispersion: f32,
    pub block_sigma_s: f32,
    pub wall_sigma_s: f32,
    pub wall_sigma_a: f32,
    pub snow_albedo: f32,
    pub corona: f32,
    pub glory: f32,
    pub halo: f32,
    pub size_param: f32,
    pub time: f32,
    pub bounces: u32,
    pub steps: u32,
    pub shadow_cap: u32,
    pub rr_start: u32,
}

impl Default for SceneCfg {
    fn default() -> Self {
        SceneCfg {
            cam: preset_camera("hero").unwrap().0,
            // A polar summer sun: high enough (42 deg) that the ceiling
            // apertures project steep columns onto the floor, and turned 35 deg
            // off the tunnel axis so daylight cannot simply stream down the
            // whole cave - the deep cave is lit by the columns alone.
            sun_elev_deg: 42.0,
            sun_azim_deg: -35.0,
            sun_radius_deg: 0.85,
            sun_strength: 60000.0,
            sky_strength: 2.6,
            haze: 0.0045,
            fog_base: 0.40,
            fog_frost: 0.14,
            fog_height: 1.20,
            fog_g: 0.50,
            fog_albedo: 0.86,
            ice_ior: 1.309,
            ice_rough: 0.34,
            frost: 1.0,
            dispersion: 0.018,
            block_sigma_s: 4.5,
            wall_sigma_s: 0.80,
            wall_sigma_a: 1.0,
            snow_albedo: 0.62,
            corona: 0.06,
            glory: 0.05,
            halo: 0.05,
            size_param: 55.0,
            time: 0.0,
            bounces: 28,
            steps: 160,
            shadow_cap: 8,
            rr_start: 4,
        }
    }
}

pub fn build_params(
    cfg: &SceneCfg,
    width: u32,
    height: u32,
    aov: bool,
    probe_px: u32,
    probe_py: u32,
    probe_max: u32,
) -> Params {
    let fwd = norm([
        cfg.cam.target[0] - cfg.cam.eye[0],
        cfg.cam.target[1] - cfg.cam.eye[1],
        cfg.cam.target[2] - cfg.cam.eye[2],
    ]);
    let right = norm(cross(fwd, [0.0, 1.0, 0.0]));
    let up = cross(right, fwd);
    let focus = {
        let d = [
            cfg.cam.target[0] - cfg.cam.eye[0],
            cfg.cam.target[1] - cfg.cam.eye[1],
            cfg.cam.target[2] - cfg.cam.eye[2],
        ];
        (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt()
    };

    let el = cfg.sun_elev_deg.to_radians();
    let az = cfg.sun_azim_deg.to_radians();
    let sun = norm([el.cos() * az.sin(), el.sin(), el.cos() * az.cos()]);
    let cos_r = cfg.sun_radius_deg.to_radians().cos();

    // majorant of fog_sigma_t(): turbulence <= 1, height term <= 1.0, frost <= 1
    let majorant = cfg.fog_base * 1.0 + cfg.fog_frost;

    Params {
        cam_pos: [
            cfg.cam.eye[0],
            cfg.cam.eye[1],
            cfg.cam.eye[2],
            (0.5 * cfg.cam.fov_y_deg.to_radians()).tan(),
        ],
        cam_fwd: [fwd[0], fwd[1], fwd[2], width as f32 / height as f32],
        cam_right: [right[0], right[1], right[2], cfg.cam.aperture],
        cam_up: [up[0], up[1], up[2], focus],
        sun_dir: [sun[0], sun[1], sun[2], cos_r],
        sun_rad: [
            cfg.sun_strength * 1.00,
            cfg.sun_strength * 0.965,
            cfg.sun_strength * 0.915,
            cfg.haze,
        ],
        sky_zen: [0.45, 0.62, 1.00, cfg.sky_strength],
        sky_hor: [0.85, 0.92, 1.00, 1.0],
        fog: [cfg.fog_base, cfg.fog_frost, cfg.fog_height, majorant],
        // Polar cave mist carries volcanic dust and ice crystals, so it is not
        // a perfectly conservative scatterer; the sub-unity albedo is what keeps
        // multiple scattering from washing the whole cavity into a light box.
        fog2: [
            cfg.fog_albedo * 0.970,
            cfg.fog_albedo * 0.985,
            cfg.fog_albedo * 1.000,
            cfg.fog_g,
        ],
        // Glacier ice is *clear*: absorption (strongly red-biased) dominates
        // over scattering, so thickness turns into deep blue instead of milky
        // white. sigma_t = (6.2, 2.6, 1.5)/m at the default settings, i.e. a
        // 0.4 m thin patch still glows while 4 m of ice is opaque black.
        wall_ss: [
            cfg.wall_sigma_s * 0.85,
            cfg.wall_sigma_s * 1.00,
            cfg.wall_sigma_s * 1.15,
            0.72,
        ],
        wall_sa: [
            cfg.wall_sigma_a * 5.50,
            cfg.wall_sigma_a * 1.80,
            cfg.wall_sigma_a * 0.62,
            cfg.ice_rough,
        ],
        blk_ss: [
            cfg.block_sigma_s * 0.92,
            cfg.block_sigma_s * 1.00,
            cfg.block_sigma_s * 1.10,
            0.82,
        ],
        blk_sa: [0.30, 0.070, 0.022, 0.0],
        clr_ss: [0.30, 0.36, 0.42, 0.55],
        clr_sa: [0.30, 0.08, 0.025, 0.0],
        optics: [cfg.ice_ior, cfg.dispersion, cfg.frost, cfg.snow_albedo],
        diffr: [cfg.corona, cfg.glory, cfg.halo, cfg.size_param],
        // x = time, y = flake fall speed (m/s), z = mist advection scale,
        // w = crystal tumble rate (rad/s). Tuned so a 1 s sequence shows clear
        // motion: the lattice drops ~28% of a cell and the plates visibly tumble.
        anim: [cfg.time, 0.25, 3.0, 1.60],
        ctrl: [width, height, cfg.bounces, cfg.steps],
        ctrl2: [
            cfg.shadow_cap,
            cfg.rr_start,
            if aov { 1 } else { 0 },
            probe_px,
        ],
        ctrl3: [probe_py, probe_max, 0, 0],
    }
}

/// Human readable dump used by `--print-params`.
pub fn describe(cfg: &SceneCfg, p: &Params) -> String {
    let mut s = String::new();
    s.push_str(&format!(
        "camera   eye ({:.2}, {:.2}, {:.2})  ->  ({:.2}, {:.2}, {:.2})  fov {:.1}deg  aperture {:.3}\n",
        cfg.cam.eye[0], cfg.cam.eye[1], cfg.cam.eye[2],
        cfg.cam.target[0], cfg.cam.target[1], cfg.cam.target[2],
        cfg.cam.fov_y_deg, cfg.cam.aperture
    ));
    s.push_str(&format!(
        "sun      dir ({:.3}, {:.3}, {:.3})  elev {:.1}deg  azim {:.1}deg  disc radius {:.2}deg\n",
        p.sun_dir[0], p.sun_dir[1], p.sun_dir[2], cfg.sun_elev_deg, cfg.sun_azim_deg,
        cfg.sun_radius_deg
    ));
    s.push_str(&format!(
        "         radiance ({:.0}, {:.0}, {:.0})   solid angle {:.3e} sr   irradiance {:.2}\n",
        p.sun_rad[0], p.sun_rad[1], p.sun_rad[2],
        2.0 * PI * (1.0 - p.sun_dir[3]),
        p.sun_rad[1] * 2.0 * PI * (1.0 - p.sun_dir[3]) * cfg.sun_elev_deg.to_radians().sin()
    ));
    s.push_str(&format!(
        "sky      zenith ({:.2}, {:.2}, {:.2}) horizon ({:.2}, {:.2}, {:.2}) scale {:.2}\n",
        p.sky_zen[0], p.sky_zen[1], p.sky_zen[2], p.sky_hor[0], p.sky_hor[1], p.sky_hor[2],
        p.sky_zen[3]
    ));
    s.push_str(&format!(
        "mist     sigma_t base {:.3}/m  frost {:.3}/m  majorant {:.3}/m  g {:.2}  albedo ({:.3},{:.3},{:.3})\n",
        p.fog[0], p.fog[1], p.fog[3], p.fog2[3], p.fog2[0], p.fog2[1], p.fog2[2]
    ));
    s.push_str(&format!(
        "ice wall sigma_s ({:.2},{:.2},{:.2})/m  sigma_a ({:.3},{:.3},{:.3})/m  g {:.2}  albedo ({:.3},{:.3},{:.3})\n",
        p.wall_ss[0], p.wall_ss[1], p.wall_ss[2], p.wall_sa[0], p.wall_sa[1], p.wall_sa[2],
        p.wall_ss[3],
        p.wall_ss[0] / (p.wall_ss[0] + p.wall_sa[0]),
        p.wall_ss[1] / (p.wall_ss[1] + p.wall_sa[1]),
        p.wall_ss[2] / (p.wall_ss[2] + p.wall_sa[2])
    ));
    s.push_str(&format!(
        "ice blk  sigma_s ({:.2},{:.2},{:.2})/m  sigma_a ({:.3},{:.3},{:.3})/m  g {:.2}  albedo ({:.4},{:.4},{:.4})\n",
        p.blk_ss[0], p.blk_ss[1], p.blk_ss[2], p.blk_sa[0], p.blk_sa[1], p.blk_sa[2],
        p.blk_ss[3],
        p.blk_ss[0] / (p.blk_ss[0] + p.blk_sa[0]),
        p.blk_ss[1] / (p.blk_ss[1] + p.blk_sa[1]),
        p.blk_ss[2] / (p.blk_ss[2] + p.blk_sa[2])
    ));
    s.push_str(&format!(
        "optics   ior {:.3}  dispersion +-{:.3}  frost {:.2}  snow albedo {:.2}  roughness {:.2}\n",
        p.optics[0], p.optics[1], p.optics[2], p.optics[3], p.wall_sa[3]
    ));
    s.push_str(&format!(
        "diffract corona {:.3}  glory {:.3}  halo22 {:.3}  size parameter x {:.1} (first ring ~{:.1}deg)\n",
        p.diffr[0], p.diffr[1], p.diffr[2], p.diffr[3],
        (3.8317 / p.diffr[3].max(1.0)).asin().to_degrees()
    ));
    s.push_str(&format!(
        "sampling bounces {}  march steps {}  shadow boundaries {}  rr start {}  time {:.2}s\n",
        p.ctrl[2], p.ctrl[3], p.ctrl2[0], p.ctrl2[1], p.anim[0]
    ));
    s
}
