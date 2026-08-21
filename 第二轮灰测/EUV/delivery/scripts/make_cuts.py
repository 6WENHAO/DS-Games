#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
make_cuts.py — 由 src/script.js 的 CUTS 定义生成 ffmpeg concat 清单
==================================================================
规格书 §2 衍生版本：30s / 60s 社媒版（横版 + 竖版）。

设计要点：社媒版不重新渲染，而是从母版帧序列按 CUTS 的时间区间摘取，
因此画面与母版逐字节一致，不会出现"两版画质不同"的验收问题。

本脚本直接解析 src/script.js 中的 CUTS 段（不依赖 Node.js），
把每个区间转换为帧号区间，再为 ffmpeg concat 生成中间片段。

用法: python make_cuts.py --root <EUV 根目录>
"""
import argparse
import json
import os
import re
import subprocess
import sys

FPS = 30


def parse_shots(script_src):
    """从 script.js 提取镜头 id 与时长，重建绝对时间轴。"""
    shots = []
    for m in re.finditer(r"id:\s*'(S\d+)'\s*,\s*name:\s*'([^']*)'\s*,\s*dur:\s*([\d.]+)", script_src):
        shots.append({'id': m.group(1), 'name': m.group(2), 'dur': float(m.group(3))})
    t = 0.0
    for s in shots:
        s['start'] = t
        t += s['dur']
        s['end'] = t
    return shots, t


def parse_cuts(script_src, shots):
    """提取 CUTS 定义中的 seg('Sxx', from, to) 三元组。"""
    by_id = {s['id']: s for s in shots}
    cuts = {}
    block = script_src[script_src.index('export const CUTS'):]
    block = block[:block.index('export function cutDuration')]
    for cm in re.finditer(r"(\w+):\s*\{\s*label:\s*'([^']*)',\s*segments:\s*\[(.*?)\]\s*,?\s*\}", block, re.S):
        key, label, body = cm.group(1), cm.group(2), cm.group(3)
        segs = []
        for sm in re.finditer(r"seg\('(S\d+)'\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)", body):
            sid, a, b = sm.group(1), float(sm.group(2)), float(sm.group(3))
            sh = by_id.get(sid)
            if not sh:
                continue
            segs.append({
                'shot': sid,
                'start': sh['start'] + a * sh['dur'],
                'end': sh['start'] + b * sh['dur'],
            })
        if segs:
            cuts[key] = {'label': label, 'segments': segs}
    return cuts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', required=True, help='EUV 项目根目录')
    ap.add_argument('--master', default=None, help='母版 mov 路径（默认自动查找）')
    args = ap.parse_args()

    root = os.path.abspath(args.root)
    script_path = os.path.join(root, 'src', 'script.js')
    with open(script_path, encoding='utf-8') as f:
        src = f.read()

    shots, total = parse_shots(src)
    cuts = parse_cuts(src, shots)
    print('[make_cuts] 镜头 %d 个，总时长 %.2f s' % (len(shots), total))

    master = args.master
    if not master:
        md = os.path.join(root, 'out', 'deliverables', 'master')
        cand = [os.path.join(md, f) for f in os.listdir(md)] if os.path.isdir(md) else []
        cand = [c for c in cand if c.lower().endswith(('.mov', '.mp4'))]
        master = cand[0] if cand else None
    if not master or not os.path.isfile(master):
        print('[make_cuts] 未找到母版视频，无法切片。请先运行 encode_all.sh 的第 1 步。', file=sys.stderr)
        return 1

    outdir = os.path.join(root, 'out', 'cuts')
    os.makedirs(outdir, exist_ok=True)

    report = {}
    for key, cut in cuts.items():
        piece_paths = []
        dur = 0.0
        for i, seg in enumerate(cut['segments']):
            # 帧对齐，避免拼接处出现半帧
            f0 = round(seg['start'] * FPS)
            f1 = round(seg['end'] * FPS)
            ss = f0 / FPS
            t = max(1, f1 - f0) / FPS
            dur += t
            piece = os.path.join(outdir, '%s_%02d.mp4' % (key, i))
            cmd = [
                'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
                '-ss', '%.4f' % ss, '-i', master, '-t', '%.4f' % t,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16',
                '-pix_fmt', 'yuv420p', '-r', str(FPS),
                '-c:a', 'aac', '-b:a', '256k', '-ar', '48000',
                '-af', 'afade=t=in:st=0:d=0.12,afade=t=out:st=%.3f:d=0.12' % max(0.0, t - 0.12),
                piece,
            ]
            print('[make_cuts] %s 片段 %d: %.2f–%.2f s (%.2f s) ← %s'
                  % (key, i, ss, ss + t, t, seg['shot']))
            r = subprocess.run(cmd)
            if r.returncode != 0:
                print('[make_cuts] ffmpeg 失败，跳过该片段', file=sys.stderr)
                continue
            piece_paths.append(piece)

        listfile = os.path.join(outdir, '%s_concat.txt' % key)
        with open(listfile, 'w', encoding='utf-8') as f:
            for p in piece_paths:
                f.write("file '%s'\n" % p.replace('\\', '/'))
        report[key] = {'label': cut['label'], 'seconds': round(dur, 2),
                       'pieces': len(piece_paths), 'list': listfile}
        print('[make_cuts] %s (%s)：%d 段，合计 %.2f s → %s'
              % (key, cut['label'], len(piece_paths), dur, listfile))

    with open(os.path.join(outdir, 'cuts_report.json'), 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    return 0


if __name__ == '__main__':
    sys.exit(main())
