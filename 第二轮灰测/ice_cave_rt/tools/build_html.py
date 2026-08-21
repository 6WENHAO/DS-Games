#!/usr/bin/env python3
"""Build the single-file WebGPU version of the renderer.

    python tools/build_html.py

Reads  shaders/ice_cave.wgsl  +  web/template.html
Writes ice_cave.html                     (self contained, just open it)
       web/ice_cave.webgpu.wgsl          (the patched shader, for validation)

The only source difference between the Vulkan build and the WebGPU build is the
push-constant block: naga/Vulkan uses `var<immediate>` (SPIR-V PushConstant),
while WebGPU has no push constants at all, so the same struct is bound as an
ordinary uniform at @group(0) @binding(4). Everything else - the SDF scene, the
media, the phase functions, both entry points - is byte-identical.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHADER = ROOT / "shaders" / "ice_cave.wgsl"
TEMPLATE = ROOT / "web" / "template.html"
OUT_HTML = ROOT / "ice_cave.html"
OUT_WGSL = ROOT / "web" / "ice_cave.webgpu.wgsl"


def main() -> int:
    src = SHADER.read_text(encoding="utf-8")
    tpl = TEMPLATE.read_text(encoding="utf-8")

    # --- patch 1: push constants -> uniform buffer -------------------------
    patched, n = re.subn(
        r"var<immediate>\s+pc\s*:\s*Push\s*;",
        "// WebGPU has no push constants: the same 32-byte block is a uniform.\n"
        "@group(0) @binding(4) var<uniform> pc : Push;",
        src,
    )
    if n != 1:
        print("error: expected exactly one `var<immediate> pc : Push;`, found %d" % n)
        return 2

    # --- sanity: the shader must be embeddable in a JS String.raw`...` -----
    for bad in ("`", "${"):
        if bad in patched:
            print("error: shader contains %r which breaks the JS template literal" % bad)
            return 2

    if "//__WGSL_TRACE__" not in tpl:
        print("error: template is missing the //__WGSL_TRACE__ placeholder")
        return 2

    html = tpl.replace("//__WGSL_TRACE__", patched)
    OUT_HTML.write_text(html, encoding="utf-8")
    OUT_WGSL.write_text(patched, encoding="utf-8")

    # --- also emit the two post-processing modules for validation ----------
    def raw_block(name: str) -> str:
        m = re.search(r"const %s = (?:WGSL_COMMON \+ )?String\.raw`(.*?)`;" % name, tpl, re.S)
        if not m:
            print("error: cannot extract %s from the template" % name)
            sys.exit(2)
        return m.group(1)

    common = raw_block("WGSL_COMMON")
    for name, path in (("WGSL_BASE", ROOT / "web" / "ice_cave.base.wgsl"),
                       ("WGSL_DISPLAY", ROOT / "web" / "ice_cave.display.wgsl")):
        path.write_text(common + raw_block(name), encoding="utf-8")
        print("output   %s" % path.relative_to(ROOT))

    kb = len(html.encode("utf-8")) / 1024.0
    print("shader   %s  (%d lines)" % (SHADER.name, patched.count("\n") + 1))
    print("patched  push constants -> @group(0) @binding(4) var<uniform>")
    print("output   %s  (%.1f KB, self contained)" % (OUT_HTML.name, kb))
    print("output   %s  (for `ice_cave_rt.exe --validate-only`)" % OUT_WGSL.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
