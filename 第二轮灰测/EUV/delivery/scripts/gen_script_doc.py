#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_script_doc.py — 由 src/script.js 生成《02-脚本 / 分镜表》
==================================================================
规格书 §4 要求脚本作为第一个评审里程碑的交付物。
本脚本从 src/script.js（叙事唯一真源）直接生成文档，
因此文档与成片永远同步，不存在「文档写的是旧版分镜」这一常见验收问题。

用法: python delivery/scripts/gen_script_doc.py --root <EUV 根目录>
"""
import argparse
import os
import re
import sys


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def parse_shots(src):
    """逐个镜头块解析：id / name / dur / step / act / desc / captions / audio"""
    shots = []
    # 以 "{ id: 'Sxx'" 为分块起点
    idxs = [m.start() for m in re.finditer(r"\n  \{\n    id: 'S\d+'", src)]
    idxs.append(src.index('// ═══════════════════════════════════════════════════════════════════\n// 时间轴装配'))
    for a, b in zip(idxs, idxs[1:]):
        blk = src[a:b]
        g = lambda pat, d='': (re.search(pat, blk, re.S).group(1) if re.search(pat, blk, re.S) else d)
        sid = g(r"id:\s*'(S\d+)'")
        if not sid:
            continue
        shot = {
            'id': sid,
            'name': g(r"name:\s*'([^']*)'"),
            'dur': float(g(r"dur:\s*([\d.]+)", '0')),
            'step': g(r"step:\s*'([^']*)'", '') or None,
            'act': g(r"act:\s*'([^']*)'"),
            'desc': g(r"desc:\s*'([^']*)'"),
            'camera_raw': g(r"camera:\s*\{(.*?)\n    \},"),
            'captions': [],
            'audio': [],
        }
        for m in re.finditer(r"cap\(([\d.]+),\s*([\d.]+),\s*(.+?)\),\n", blk, re.S):
            t0, t1, body = float(m.group(1)), float(m.group(2)), m.group(3)
            parts = re.findall(r"(?:'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)", body)
            texts = [(p[0] or p[1]) for p in parts]
            zh = texts[0] if texts else ''
            en = texts[1] if len(texts) > 1 else ''
            shot['captions'].append((t0, t1, zh, en))
        for m in re.finditer(r"\{\s*cue:\s*'([^']+)',\s*at:\s*([\d.]+)\s*\}", blk):
            shot['audio'].append((m.group(1), float(m.group(2))))
        shots.append(shot)
    t = 0.0
    for s in shots:
        s['start'] = t
        t += s['dur']
        s['end'] = t
    return shots, t


def parse_steps(params_src):
    steps = []
    for m in re.finditer(
            r"order:\s*(\d+),\s*\n\s*key:\s*'([^']+)',\s*\n\s*zh:\s*'([^']+)',\s*\n\s*en:\s*'([^']+)',\s*\n"
            r"\s*zhDesc:\s*'([^']+)',\s*\n\s*enDesc:\s*'([^']+)',", params_src):
        steps.append({
            'order': int(m.group(1)), 'key': m.group(2), 'zh': m.group(3),
            'en': m.group(4), 'zhDesc': m.group(5), 'enDesc': m.group(6),
        })
    return steps


def parse_cuts(src, shots):
    by_id = {s['id']: s for s in shots}
    cuts = {}
    try:
        block = src[src.index('export const CUTS'):src.index('export function cutDuration')]
    except ValueError:
        return cuts
    for cm in re.finditer(r"(\w+):\s*\{\s*label:\s*'([^']*)',\s*segments:\s*\[(.*?)\]\s*,?\s*\}", block, re.S):
        key, label, body = cm.group(1), cm.group(2), cm.group(3)
        segs = []
        for sm in re.finditer(r"seg\('(S\d+)'\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)(?:,)?\s*(?://\s*(.*))?", body):
            sid, a, b, note = sm.group(1), float(sm.group(2)), float(sm.group(3)), (sm.group(4) or '').strip()
            sh = by_id.get(sid)
            if not sh:
                continue
            segs.append({'shot': sid, 'name': sh['name'], 'note': note,
                         'start': sh['start'] + a * sh['dur'], 'end': sh['start'] + b * sh['dur']})
        if segs:
            cuts[key] = {'label': label, 'segments': segs}
    return cuts


def load_resolved_captions(root):
    """
    读取 out/subtitles/EUV_captions_review.tsv —— 由浏览器端从同一真源导出，
    其中的模板字面量（如 ${PV('machineMass')}）已求值为最终文案。
    以它作为字幕文案的权威来源，避免文档里出现未求值的模板字符串。
    """
    tsv = os.path.join(root, 'out', 'subtitles', 'EUV_captions_review.tsv')
    if not os.path.isfile(tsv):
        return None
    out = {}
    with open(tsv, encoding='utf-8') as f:
        head = f.readline().rstrip('\r\n').split('\t')
        idx = {k: i for i, k in enumerate(head)}
        for line in f:
            c = line.rstrip('\r\n').split('\t')
            if len(c) < len(head):
                continue
            out.setdefault(c[idx['shot']], []).append({
                'start': float(c[idx['start']]), 'end': float(c[idx['end']]),
                'zh': c[idx['zh']], 'en': c[idx['en']],
            })
    for k in out:
        out[k].sort(key=lambda x: x['start'])
    return out


def tc(sec, fps=30):
    f = int(round(sec * fps))
    return '%02d:%02d:%02d' % (f // (60 * fps), (f // fps) % 60, f % fps)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--root', required=True)
    args = ap.parse_args()
    root = os.path.abspath(args.root)

    src = read(os.path.join(root, 'src', 'script.js'))
    params_src = read(os.path.join(root, 'src', 'params.js'))
    shots, total = parse_shots(src)
    steps = parse_steps(params_src)
    cuts = parse_cuts(src, shots)
    step_by_key = {s['key']: s for s in steps}

    resolved = load_resolved_captions(root)
    if resolved:
        for sh in shots:
            rs = resolved.get(sh['id'])
            if rs and len(rs) == len(sh['captions']):
                sh['captions'] = [(0, 0, r['zh'], r['en'], r['start'], r['end']) for r in rs]
        print('字幕文案取自已求值的核对表 out/subtitles/EUV_captions_review.tsv')
    else:
        print('!! 未找到 out/subtitles/EUV_captions_review.tsv；'
              '字幕文案可能包含未求值的模板字面量。请先在 tools/capture.html 导出字幕。', file=sys.stderr)

    fps = 30
    L = []
    A = L.append

    A('# 02 · 脚本与分镜表（Shooting Script / Shot List）')
    A('')
    A('| 项 | 内容 |')
    A('| --- | --- |')
    A('| 文档编号 | EUV-DOC-02 |')
    A('| 版本 | v1.0 |')
    A('| 适用项目 | EUV 光刻原理 3D 演示动画 |')
    A('| 依据 | 《EUV 光刻原理 3D 演示动画制作规格书 v2.0》 |')
    A('| 编制日期 | ____-__-__ |')
    A('| 状态 | 待客户书面确认（评审里程碑 M1） |')
    A('')
    A('> **本文档为自动生成，不可手工编辑。**')
    A('> 叙事唯一真源为 `src/script.js`；本文件由 `delivery/scripts/gen_script_doc.py` 生成。')
    A('> 因此分镜表、字幕、音效提示点与成片永远一致，不存在「文档是旧版分镜」的验收风险。')
    A('> 修改分镜请改 `src/script.js` 后重跑本脚本，并重跑 `test/verify.html`。')
    A('')

    A('## 1 · 总体规格')
    A('')
    A('| 项 | 值 |')
    A('| --- | --- |')
    A('| 总时长 | %.0f 秒（%d 分 %02d 秒） |' % (total, int(total // 60), int(total % 60)))
    A('| 帧率 | %d fps |' % fps)
    A('| 总帧数 | %d 帧 |' % int(round(total * fps)))
    A('| 镜头数 | %d 个 |' % len(shots))
    A('| 字幕条数 | %d 条（中英双语） |' % sum(len(s['captions']) for s in shots))
    A('| 音效提示点 | %d 个 |' % sum(len(s['audio']) for s in shots))
    A('| 工艺步骤 | %d 个，顺序与规格书 §1.1 一致 |' % len(steps))
    A('')

    A('## 2 · 结构（幕 / 段落）')
    A('')
    acts = []
    for s in shots:
        if not acts or acts[-1][0] != s['act']:
            acts.append([s['act'], s['start'], s['end'], [s['id']]])
        else:
            acts[-1][2] = s['end']
            acts[-1][3].append(s['id'])
    A('| 幕 | 时间码 | 时长 | 镜头 |')
    A('| --- | --- | --- | --- |')
    for a in acts:
        A('| %s | %s – %s | %.0f s | %s |' % (a[0], tc(a[1]), tc(a[2]), a[2] - a[1], ', '.join(a[3])))
    A('')

    A('## 3 · 工艺步骤在时间轴上的落位')
    A('')
    A('> 验收清单第 1 项「10 个工艺步骤全部完整且顺序正确」的对照表。')
    A('> 该顺序由 `test/checks.js` 的 A 组与 E 组断言强制校验。')
    A('')
    A('| # | 工艺步骤 | English | 时间码 | 时长 | 镜头 |')
    A('| --- | --- | --- | --- | --- | --- |')
    spans = {}
    for s in shots:
        if not s['step']:
            continue
        sp = spans.setdefault(s['step'], {'start': s['start'], 'end': s['end'], 'shots': []})
        sp['end'] = s['end']
        sp['shots'].append(s['id'])
    for st in steps:
        sp = spans.get(st['key'])
        if not sp:
            A('| %d | %s | %s | **缺失** | — | — |' % (st['order'], st['zh'], st['en']))
            continue
        A('| %d | %s | %s | %s – %s | %.0f s | %s |' % (
            st['order'], st['zh'], st['en'], tc(sp['start']), tc(sp['end']),
            sp['end'] - sp['start'], ', '.join(sp['shots'])))
    A('')

    A('## 4 · 分镜表（逐镜头）')
    A('')
    for s in shots:
        st = step_by_key.get(s['step']) if s['step'] else None
        A('### %s · %s' % (s['id'], s['name']))
        A('')
        A('| 项 | 内容 |')
        A('| --- | --- |')
        A('| 时间码 | %s – %s（%.0f s，%d 帧） |' % (tc(s['start']), tc(s['end']), s['dur'], int(round(s['dur'] * fps))))
        A('| 幕 | %s |' % s['act'])
        A('| 工艺步骤 | %s |' % ('第 %d 步 · %s' % (st['order'], st['zh']) if st else '—（片头/片尾/转场）'))
        A('| 画面内容 | %s |' % s['desc'])
        cam = s['camera_raw'] or ''
        fov = re.search(r"fov:\s*\[([\d.]+),\s*([\d.]+)\]", cam)
        ease = re.search(r"ease:\s*EASE\.(\w+)", cam)
        focus = re.search(r"focus:\s*([\d.]+)", cam)
        orbit = 'orbit: true' in cam
        A('| 运镜 | %s%s |' % (
            '环绕' if orbit else '推/移',
            ('，缓动 %s' % ease.group(1)) if ease else ''))
        A('| 焦距变化 | %s |' % (('视场角 %s° → %s°' % (fov.group(1), fov.group(2))) if fov else '固定'))
        A('| 对焦距离 | %s |' % (focus.group(1) + ' 世界单位' if focus else '自动跟随视线中心'))
        A('')
        if s['captions']:
            A('**字幕**')
            A('')
            A('| 入点 | 出点 | 中文 | English |')
            A('| --- | --- | --- | --- |')
            for c in s['captions']:
                if len(c) == 6:
                    _, _, zh, en, abs0, abs1 = c
                else:
                    t0, t1, zh, en = c
                    abs0, abs1 = s['start'] + t0 * s['dur'], s['start'] + t1 * s['dur']
                A('| %s | %s | %s | %s |' % (
                    tc(abs0), tc(abs1), zh.replace('|', r'\|'), en.replace('|', r'\|')))
            A('')
        if s['audio']:
            A('**声音提示点**：' + '、'.join('`%s` @ %s' % (c, tc(s['start'] + a * s['dur'])) for c, a in s['audio']))
            A('')

    if cuts:
        A('## 5 · 衍生版本剪辑表')
        A('')
        A('> 社媒版不重新渲染，而是从母版按时间区间摘取，因此画面与母版逐字节一致。')
        A('> 由 `delivery/scripts/make_cuts.py` 解析同一真源自动生成 ffmpeg concat 清单。')
        A('')
        for key, cut in cuts.items():
            dur = sum(x['end'] - x['start'] for x in cut['segments'])
            A('### %s（%s）— 合计 %.1f s，%d 段' % (cut['label'], key, dur, len(cut['segments'])))
            A('')
            A('| # | 源镜头 | 母版入点 | 母版出点 | 时长 | 内容 |')
            A('| --- | --- | --- | --- | --- | --- |')
            for i, sg in enumerate(cut['segments'], 1):
                A('| %d | %s | %s | %s | %.1f s | %s |' % (
                    i, sg['shot'], tc(sg['start']), tc(sg['end']), sg['end'] - sg['start'],
                    sg['note'] or sg['name']))
            A('')

    A('## 6 · 节奏曲线说明')
    A('')
    A('影片节奏按「建立 → 蓄势 → 爆发 → 解析 → 收束」组织：')
    A('')
    A('- **建立（0–30 s）**：整机体量与真空环境，镜头缓慢、字幕稀疏，建立尺度感与"这台机器很难"的心理预期。')
    A('- **蓄势（30–58 s）**：锡滴发生器与射流，节奏脉冲进入，景别持续收紧到极特写，为冲击做准备。')
    A('- **爆发（58–68 s）**：预脉冲压扁 → 主脉冲汽化，全片能量峰值；白闪、机身晃动、低频冲击音同帧对齐。')
    A('- **解析（68–148 s）**：从等离子体辐射一路走到 4:1 投影，节奏转为稳定的技术叙述，HUD 图版承担信息量。')
    A('- **收束（148–180 s）**：曝光成潜影 → 显影显现芯片图形 → 全光路总览 → 品牌定版，情绪回落并给出完成感。')
    A('')
    A('每个工艺步骤开头都有一记 `chapter` 提示音，形成听觉上的章节感；')
    A('步骤内的关键动作（命中、汇聚、曝光、显影）各有独立音效，且提示点时间与画面动作由同一时间轴给出，')
    A('音画同步是结构性保证而非人工对齐（见 `test/checks.js` F 组断言）。')
    A('')

    out = os.path.join(root, 'docs', '02-脚本-shooting-script.md')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(L))
    print('已生成: %s（%d 行）' % (out, len(L)))
    print('镜头 %d 个，总时长 %.0f s，字幕 %d 条，音效点 %d 个，工艺步骤 %d 个' % (
        len(shots), total, sum(len(s['captions']) for s in shots),
        sum(len(s['audio']) for s in shots), len(steps)))
    missing = [st['key'] for st in steps if st['key'] not in spans]
    if missing:
        print('!! 时间轴缺少工艺步骤: %s' % ', '.join(missing), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
