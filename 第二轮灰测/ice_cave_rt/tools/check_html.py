#!/usr/bin/env python3
"""Static checks for the generated single-file WebGPU build.

    python tools/check_html.py

  1. extracts the embedded ES module and runs `node --check` on it (syntax)
  2. extracts every WGSL block and hands them to
     `ice_cave_rt.exe --validate-only` (naga, default/WebGPU capability set)
  3. sanity-checks the things a browser would only tell you at run time:
     uniform sizes, bind group numbering, entry point names
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML = ROOT / "ice_cave.html"
EXE = ROOT / "target" / "release" / "ice_cave_rt.exe"


def fail(msg):
    print("FAIL  " + msg)
    return False


def main() -> int:
    ok = True
    html = HTML.read_text(encoding="utf-8")

    # ---- 1. JS syntax -----------------------------------------------------
    m = re.search(r'<script type="module">(.*?)</script>', html, re.S)
    if not m:
        return 1 if fail("no <script type=\"module\"> block") else 1
    js = m.group(1)
    tmp = ROOT / "web" / "_check.mjs"
    tmp.write_text(js, encoding="utf-8")
    r = subprocess.run([("node.exe" if sys.platform == "win32" else "node"), "--check", str(tmp)],
                       capture_output=True, text=True)
    if r.returncode == 0:
        print("ok    JS module parses (%d chars)" % len(js))
    else:
        ok = fail("node --check: " + (r.stderr.strip().splitlines() or [""])[0])
    tmp.unlink(missing_ok=True)

    # ---- 2. WGSL validation ----------------------------------------------
    for name in ("ice_cave.webgpu.wgsl", "ice_cave.base.wgsl", "ice_cave.display.wgsl"):
        p = ROOT / "web" / name
        if not p.exists():
            ok = fail("%s missing - run tools/build_html.py first" % name)
            continue
        if not EXE.exists():
            print("skip  WGSL validation (%s not built)" % EXE.name)
            break
        r = subprocess.run([str(EXE), "--validate-only", str(p)], capture_output=True, text=True)
        if r.returncode == 0:
            print("ok    %s" % r.stdout.strip().replace("ok       ", ""))
        else:
            ok = fail(name + ": " + r.stdout.strip() + r.stderr.strip())

    # ---- 3. host/shader agreement ---------------------------------------
    checks = [
        (r"createBuffer\(\{\s*size:\s*352", "Params uniform is 352 B (22 x vec4)"),
        (r"createBuffer\(\{\s*size:\s*32,", "Push uniform is 32 B (2 x vec4)"),
        (r"@group\(0\) @binding\(4\) var<uniform> pc", "push constants patched to a uniform"),
        (r'entryPoint:\s*"cs_render"', "cs_render pipeline"),
        (r'entryPoint:\s*"cs_probe"', "cs_probe pipeline"),
        (r'entryPoint:\s*"cs_base"', "cs_base pipeline"),
        (r'entryPoint:\s*"fs_display"', "fs_display pipeline"),
        (r"dispatchWorkgroups\(Math\.ceil\(t\[2\] / 8\)", "tile dispatch matches @workgroup_size(8,8)"),
    ]
    for pat, what in checks:
        if re.search(pat, html):
            print("ok    " + what)
        else:
            ok = fail("missing: " + what)

    # the params packing must fill exactly 88 words
    rows = len(re.findall(r"^\s*r\(\d+,", js, re.M))
    us = re.findall(r"pu\[(\d+)\]", js)
    if rows == 19 and us and max(int(x) for x in us) == 87:
        print("ok    params packing: 19 float rows + u32 words up to 87 (= 88 words)")
    else:
        ok = fail("params packing looks wrong: %d float rows, max u32 word %s" % (rows, max(us or ['-'])))

    print("\nRESULT: " + ("ALL STATIC CHECKS PASSED" if ok else "SOME CHECKS FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
