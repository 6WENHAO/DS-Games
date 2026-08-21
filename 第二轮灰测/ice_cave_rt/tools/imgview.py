#!/usr/bin/env python3
"""Terminal image inspector for the ice cave renderer.

Reads a PNG (written by src/png.rs) or a PFM HDR frame and prints
  * an ASCII luminance map (so the composition can be judged in a terminal),
  * a hue map (B = strongly blue, w = neutral, y = warm),
  * region statistics used for the acceptance criteria.

usage: python tools/inspect.py FILE [--cols N] [--rows N] [--region x0,y0,x1,y1 NAME]...
"""
import struct
import sys
import zlib

import numpy as np


def read_png(path):
    data = open(path, "rb").read()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
    pos = 8
    idat = b""
    w = h = bitdepth = colortype = None
    while pos < len(data):
        ln = struct.unpack(">I", data[pos:pos + 4])[0]
        kind = data[pos + 4:pos + 8]
        body = data[pos + 8:pos + 8 + ln]
        pos += 12 + ln
        if kind == b"IHDR":
            w, h, bitdepth, colortype = struct.unpack(">IIBB", body[:10])
        elif kind == b"IDAT":
            idat += body
        elif kind == b"IEND":
            break
    assert bitdepth == 8 and colortype == 2, "expected 8-bit truecolour"
    raw = zlib.decompress(idat)
    stride = w * 3
    out = np.zeros((h, w, 3), dtype=np.uint8)
    prev = np.zeros(stride, dtype=np.int32)
    p = 0
    for y in range(h):
        ft = raw[p]
        p += 1
        line = np.frombuffer(raw[p:p + stride], dtype=np.uint8).astype(np.int32).copy()
        p += stride
        if ft == 0:
            cur = line
        elif ft == 1:
            cur = line
            for i in range(3, stride):
                cur[i] = (cur[i] + cur[i - 3]) & 0xFF
        elif ft == 2:
            cur = (line + prev) & 0xFF
        elif ft == 3:
            cur = line
            for i in range(stride):
                a = cur[i - 3] if i >= 3 else 0
                cur[i] = (cur[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif ft == 4:
            cur = line
            for i in range(stride):
                a = cur[i - 3] if i >= 3 else 0
                b = prev[i]
                c = prev[i - 3] if i >= 3 else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                cur[i] = (cur[i] + pr) & 0xFF
        else:
            raise ValueError("bad filter %d" % ft)
        prev = cur
        out[y] = cur.reshape(w, 3).astype(np.uint8)
    return out.astype(np.float32) / 255.0


def read_pfm(path):
    f = open(path, "rb")
    magic = f.readline().strip()
    assert magic == b"PF", magic
    w, h = [int(x) for x in f.readline().split()]
    scale = float(f.readline())
    n = w * h * 3
    fmt = "<%df" % n if scale < 0 else ">%df" % n
    vals = np.array(struct.unpack(fmt, f.read(n * 4)), dtype=np.float32)
    img = vals.reshape(h, w, 3)[::-1]  # PFM is bottom-up
    return img


RAMP = " .:-=+*#%@"


def ascii_map(img, cols, rows, ramp=RAMP):
    h, w, _ = img.shape
    ys = (np.linspace(0, h, rows + 1)).astype(int)
    xs = (np.linspace(0, w, cols + 1)).astype(int)
    lum = 0.2126 * img[:, :, 0] + 0.7152 * img[:, :, 1] + 0.0722 * img[:, :, 2]
    grid = np.zeros((rows, cols), dtype=np.float32)
    rgb = np.zeros((rows, cols, 3), dtype=np.float32)
    for j in range(rows):
        for i in range(cols):
            blk = lum[ys[j]:max(ys[j + 1], ys[j] + 1), xs[i]:max(xs[i + 1], xs[i] + 1)]
            grid[j, i] = blk.mean() if blk.size else 0.0
            cblk = img[ys[j]:max(ys[j + 1], ys[j] + 1), xs[i]:max(xs[i + 1], xs[i] + 1)]
            rgb[j, i] = cblk.reshape(-1, 3).mean(axis=0) if cblk.size else 0.0
    lines = []
    for j in range(rows):
        line = ""
        for i in range(cols):
            v = float(np.clip(grid[j, i], 0.0, 1.0))
            line += ramp[min(len(ramp) - 1, int(v * (len(ramp) - 1) + 0.5))]
        lines.append(line)
    hue = []
    for j in range(rows):
        line = ""
        for i in range(cols):
            r, g, b = rgb[j, i]
            l = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if l < 0.02:
                line += " "
                continue
            bl = (b + 1e-4) / (r + 1e-4)
            if bl > 1.6:
                line += "B"
            elif bl > 1.2:
                line += "b"
            elif bl > 1.04:
                line += "c"
            elif bl > 0.94:
                line += "w"
            else:
                line += "y"
        hue.append(line)
    return lines, hue, grid, rgb


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    path = sys.argv[1]
    cols, rows = 104, 30
    regions = []
    i = 2
    while i < len(sys.argv):
        a = sys.argv[i]
        if a == "--cols":
            cols = int(sys.argv[i + 1]); i += 2
        elif a == "--rows":
            rows = int(sys.argv[i + 1]); i += 2
        elif a == "--region":
            box = [float(x) for x in sys.argv[i + 1].split(",")]
            name = sys.argv[i + 2]
            regions.append((name, box)); i += 3
        else:
            print("unknown arg", a); return 2

    img = read_pfm(path) if path.lower().endswith(".pfm") else read_png(path)
    h, w, _ = img.shape
    hdr = path.lower().endswith(".pfm")
    disp = img
    if hdr:
        # log display mapping anchored on percentiles so structure is visible
        l = 0.2126 * img[:, :, 0] + 0.7152 * img[:, :, 1] + 0.0722 * img[:, :, 2]
        lo = max(np.percentile(l, 2.0), 1e-5)
        hi = max(np.percentile(l, 99.5), lo * 10.0)
        t = np.clip((np.log10(np.maximum(l, 1e-6)) - np.log10(lo)) /
                    (np.log10(hi) - np.log10(lo)), 0.0, 1.0)
        scale = t / np.maximum(l, 1e-6)
        disp = np.clip(img * scale[:, :, None], 0.0, 1.0)

    print("file      %s  %dx%d  %s" % (path, w, h, "HDR/pfm" if hdr else "sRGB/png"))
    lum = 0.2126 * img[:, :, 0] + 0.7152 * img[:, :, 1] + 0.0722 * img[:, :, 2]
    print("luminance min %.5f  p05 %.4f  p50 %.4f  p95 %.4f  max %.4f  mean %.4f"
          % (lum.min(), np.percentile(lum, 5), np.percentile(lum, 50),
             np.percentile(lum, 95), lum.max(), lum.mean()))
    if not hdr:
        print("clipping  %.2f%% pixels >= 0.99 white, %.2f%% <= 0.01 black"
              % (100.0 * (lum >= 0.99).mean(), 100.0 * (lum <= 0.01).mean()))

    lines, hue, grid, rgb = ascii_map(disp, cols, rows)
    print("\nluminance map (' '=black  '@'=white), %d x %d blocks:" % (cols, rows))
    for j, l in enumerate(lines):
        print("%2d|%s|" % (j, l))
    print("\nhue map (B=strong blue b=blue c=cool w=neutral y=warm):")
    for j, l in enumerate(hue):
        print("%2d|%s|" % (j, l))

    for name, (x0, y0, x1, y1) in regions:
        xa, xb = int(x0 * w), int(x1 * w)
        ya, yb = int(y0 * h), int(y1 * h)
        sub = img[ya:yb, xa:xb]
        sl = 0.2126 * sub[:, :, 0] + 0.7152 * sub[:, :, 1] + 0.0722 * sub[:, :, 2]
        mean = sub.reshape(-1, 3).mean(axis=0)
        print("region %-12s x[%d:%d] y[%d:%d]  lum mean %.4f p50 %.4f max %.4f   rgb (%.3f, %.3f, %.3f)  B/R %.2f"
              % (name, xa, xb, ya, yb, sl.mean(), np.percentile(sl, 50), sl.max(),
                 mean[0], mean[1], mean[2], (mean[2] + 1e-6) / (mean[0] + 1e-6)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
