//! WGSL -> SPIR-V, entirely in-process through `naga` (no shaderc / glslc /
//! Vulkan SDK required). Both compute entry points end up in one module.

use naga::valid::{Capabilities, ValidationFlags, Validator};

pub struct CompiledShader {
    pub words: Vec<u32>,
    pub entry_points: Vec<String>,
}

pub fn compile_wgsl(src: &str) -> Result<CompiledShader, String> {
    let module = naga::front::wgsl::parse_str(src)
        .map_err(|e| format!("WGSL parse error:\n{}", e.emit_to_string(src)))?;

    // IMMEDIATES = WGSL `var<immediate>` == SPIR-V push constants.
    let caps = Capabilities::default() | Capabilities::IMMEDIATES;
    let mut validator = Validator::new(ValidationFlags::all(), caps);
    let info = validator
        .validate(&module)
        .map_err(|e| format!("WGSL validation error:\n{}", e.emit_to_string(src)))?;

    let mut opts = naga::back::spv::Options::default();
    opts.lang_version = (1, 3);
    // strip debug names: smaller module, and we never inspect SPIR-V by hand
    opts.flags = naga::back::spv::WriterFlags::empty();

    let words = naga::back::spv::write_vec(&module, &info, &opts, None)
        .map_err(|e| format!("SPIR-V backend error: {e}"))?;

    let entry_points = module.entry_points.iter().map(|e| e.name.clone()).collect();
    Ok(CompiledShader {
        words,
        entry_points,
    })
}

/// Validate WGSL under the *default* capability set — no vendor extensions, no
/// `IMMEDIATES` (push constants) — which is what a browser WebGPU
/// implementation accepts. Used by `--validate-only` to check the single-file
/// HTML build of the same shader before shipping it.
pub fn validate_webgpu(src: &str) -> Result<Vec<String>, String> {
    let module = naga::front::wgsl::parse_str(src)
        .map_err(|e| format!("WGSL parse error:\n{}", e.emit_to_string(src)))?;
    let mut validator = Validator::new(ValidationFlags::all(), Capabilities::default());
    validator
        .validate(&module)
        .map_err(|e| format!("WGSL validation error:\n{}", e.emit_to_string(src)))?;
    Ok(module.entry_points.iter().map(|e| e.name.clone()).collect())
}
