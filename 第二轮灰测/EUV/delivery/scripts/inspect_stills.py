#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
inspect_stills.py — 关键帧客观图像分析（画面质量验收辅助）
==================================================================
规格书 §1.3 要求「无几何穿模/相交、无闪烁、无可见噪点、无未渲染帧」。
人工审看之外，本脚本对落盘的关键帧做客观测量，把「好看」拆成可复核的数字：

  · 曝光：平均亮度、直方图、暗部/高光占比、削波比例
  · 层次：亮度标准差、局部对比度（Laplacian 能量）
  · 噪点：高频噪声估计（中值滤波残差的鲁棒标准差）
  · 构图：九宫格亮度分布、主体占比（非背景像素比）
  · 色彩：饱和度分布、色温倾向
  · HUD/字幕：底部与角标区域的高频文字能量（判断标注是否入帧）
  · 未渲染帧：近乎纯色 / 全黑 / 全白检测

用法:
  python delivery/scripts/inspect_stills.py out/stills/review1080
  python delivery/scripts/inspect_stills.py out/stills/review1080 --json out/reports/stills_report.json
"""
import argparse
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage


def luminance(rgb):
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def analyse(path):
    im = Image.open(path).convert('RGB')
    a = np.asarray(im, dtype=np.float32) / 255.0
    h, w, _ = a.shape
    L = luminance(a)

    # —— 曝光与层次 ——
    mean = float(L.mean())
    std = float(L.std())
    p = np.percentile(L, [1, 5, 25, 50, 75, 95, 99])
    dark = float((L < 0.02).mean())
    shadow = float((L < 0.10).mean())
    high = float((L > 0.85).mean())
    clip = float((L > 0.995).mean())

    # —— 局部对比度（结构丰富度）——
    lap = ndimage.laplace(L)
    detail = float(np.abs(lap).mean())

    # —— 噪点估计：中值滤波残差的鲁棒标准差（MAD）——
    med = ndimage.median_filter(L, size=3)
    resid = L - med
    mad = float(np.median(np.abs(resid - np.median(resid))))
    noise = mad * 1.4826

    # —— 构图：九宫格亮度 ——
    gy, gx = 3, 3
    grid = []
    for j in range(gy):
        row = []
        for i in range(gx):
            blk = L[j * h // gy:(j + 1) * h // gy, i * w // gx:(i + 1) * w // gx]
            row.append(round(float(blk.mean()), 3))
        grid.append(row)

    # —— 主体占比：显著高于背景的像素 ——
    bg = float(np.percentile(L, 20))
    subject = float((L > bg + 0.06).mean())

    # —— 色彩 ——
    mx = a.max(axis=2)
    mn = a.min(axis=2)
    sat = np.where(mx > 1e-4, (mx - mn) / np.maximum(mx, 1e-4), 0.0)
    sat_mean = float(sat.mean())
    warm = float((a[..., 0] - a[..., 2]).mean())

    # —— HUD / 字幕能量：底部 22% 与右上角标区 ——
    def text_energy(region):
        g = np.abs(ndimage.laplace(region))
        return float(g.mean())
    bottom = L[int(h * 0.78):, :]
    topright = L[:int(h * 0.13), int(w * 0.62):]
    left = L[int(h * 0.12):int(h * 0.92), :int(w * 0.30)]
    hud = {
        'bottom_caption_energy': round(text_energy(bottom), 5),
        'topright_badge_energy': round(text_energy(topright), 5),
        'left_panel_energy': round(text_energy(left), 5),
    }

    # —— 未渲染帧判据 ——
    flags = []
    if mean < 0.02 and p[6] < 0.08:
        flags.append('近乎全黑（疑未渲染）')
    if mean > 0.97:
        flags.append('近乎全白（疑过曝失效）')
    if std < 0.012:
        flags.append('几乎无层次（疑纯色帧）')
    if clip > 0.06:
        flags.append('高光削波 %.1f%%' % (clip * 100))
    if dark > 0.86:
        flags.append('暗部占比 %.0f%% 过高' % (dark * 100))
    if noise > 0.055:
        flags.append('噪点偏高 %.4f' % noise)
    if detail < 0.0035:
        flags.append('结构信息过少（疑空镜）')
    if hud['topright_badge_energy'] < 0.0006:
        flags.append('右上「示意/Simulation」角标区无内容')

    return {
        'file': os.path.basename(path),
        'size': [w, h],
        'bytes': os.path.getsize(path),
        'mean': round(mean, 4), 'std': round(std, 4),
        'p1': round(float(p[0]), 4), 'p50': round(float(p[3]), 4), 'p99': round(float(p[6]), 4),
        'dark_pct': round(dark * 100, 2), 'shadow_pct': round(shadow * 100, 2),
        'high_pct': round(high * 100, 2), 'clip_pct': round(clip * 100, 3),
        'detail': round(detail, 5), 'noise': round(noise, 5),
        'subject_pct': round(subject * 100, 1),
        'sat': round(sat_mean, 4), 'warm': round(warm, 4),
        'grid': grid, 'hud': hud, 'flags': flags,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('dir')
    ap.add_argument('--json', default=None)
    ap.add_argument('--quiet', action='store_true')
    args = ap.parse_args()

    d = args.dir
    files = sorted(f for f in os.listdir(d) if f.lower().endswith('.png'))
    if not files:
        print('未找到 PNG', file=sys.stderr)
        return 1

    rows = [analyse(os.path.join(d, f)) for f in files]

    if not args.quiet:
        print('%-46s %6s %6s %6s %6s %6s %7s %6s %6s  %s' % (
            '文件', 'mean', 'std', 'dark%', 'clip%', 'subj%', 'detail', 'noise', 'sat', '异常'))
        print('-' * 132)
        for r in rows:
            print('%-46s %6.3f %6.3f %6.1f %6.2f %6.1f %7.4f %6.4f %6.3f  %s' % (
                r['file'][:46], r['mean'], r['std'], r['dark_pct'], r['clip_pct'],
                r['subject_pct'], r['detail'], r['noise'], r['sat'],
                '; '.join(r['flags']) if r['flags'] else 'ok'))

        bad = [r for r in rows if r['flags']]
        print('-' * 132)
        print('共 %d 张，异常 %d 张' % (len(rows), len(bad)))
        m = np.array([r['mean'] for r in rows])
        print('平均亮度 %.3f（min %.3f / max %.3f），亮度一致性 std=%.3f' % (m.mean(), m.min(), m.max(), m.std()))
        nz = np.array([r['noise'] for r in rows])
        print('噪点 min %.4f / 中位 %.4f / max %.4f' % (nz.min(), np.median(nz), nz.max()))
        dt = np.array([r['detail'] for r in rows])
        print('结构信息 min %.4f / 中位 %.4f / max %.4f' % (dt.min(), np.median(dt), dt.max()))
        hb = np.array([r['hud']['bottom_caption_energy'] for r in rows])
        print('底部字幕区能量 min %.5f / 中位 %.5f（0 表示该帧无字幕，属正常）' % (hb.min(), np.median(hb)))

    if args.json:
        os.makedirs(os.path.dirname(args.json), exist_ok=True)
        with open(args.json, 'w', encoding='utf-8') as f:
            json.dump({'dir': d, 'count': len(rows), 'frames': rows}, f, ensure_ascii=False, indent=2)
        print('JSON 报告已写入: %s' % args.json)

    return 0


if __name__ == '__main__':
    sys.exit(main())
