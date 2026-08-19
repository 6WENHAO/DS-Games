#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen-covers.py — 自动为「第二轮灰测」生成 HTML 截图封面
- 用 Chrome headless 直接截图 file:// 入口(避免本环境 Chrome 禁网问题)
- --allow-file-access-from-files 让模块游戏(file:// 下 importmap/CORS)可用
- 截图存入 第二轮灰测/covers/<顶层名>.jpg ; 成功后回填 index.html 的 thumb
- WebGL 个别游戏在无头环境可能不出图 -> 条目保持缺省(走占位),不破版
用法:  python3 gen-covers.py          # 全量生成/刷新
       python3 gen-covers.py 关键词    # 只生成封面名含关键词的游戏
"""
import os, re, sys, time, subprocess, signal, glob

REPO = os.path.dirname(os.path.abspath(__file__))
COVER_DIR = os.path.join(REPO, "第二轮灰测", "covers")
HOMEPAGE = os.path.join(REPO, "index.html")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MIN_BYTES = 6000
W, H = 1600, 900
VTB = 6000
SHOT_TIMEOUT = 28


def slug_of(game_url):
    m = re.match(r"\./(?:[^/]+/)?([^/.]+)", game_url)
    return re.sub(r'[\\/:*?"<>|]', "_", m.group(1)) if m else "game"


def file_url(game_url):
    rest = game_url[1:]  # 去掉开头的 . → "第二轮灰测/..."
    return "file://" + REPO + "/" + rest


def capture(url, out_tmp, out_final, tries=2):
    last = (None, 0)
    for _ in range(tries):
        status, size = capture_once(url, out_tmp, out_final)
        if status == "ok":
            return status, size
        last = (status, size)
        time.sleep(1.5)
    return last


def capture_once(url, out_tmp, out_final):
    udd = "/tmp/dsh-cap-%d-%d" % (os.getpid(), int(time.time() * 1000) % 100000)
    cmd = [CHROME, "--headless=new", "--no-sandbox",
           "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
           "--allow-file-access-from-files",
           "--hide-scrollbars", "--force-device-scale-factor=1",
           "--disable-background-networking",
           f"--virtual-time-budget={VTB}", "--timeout=20000",
           f"--user-data-dir={udd}", "--no-first-run", "--no-default-browser-check",
           f"--window-size={W},{H}", f"--screenshot={out_tmp}", url]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            preexec_fn=os.setsid if hasattr(os, "setsid") else None)
    t0 = time.time()
    status = "timeout"
    try:
        while time.time() - t0 < SHOT_TIMEOUT:
            if os.path.exists(out_tmp) and os.path.getsize(out_tmp) > MIN_BYTES:
                time.sleep(1.5)  # 让它写完
                status = "ok"
                break
            time.sleep(0.4)
    finally:
        try:
            if proc.poll() is None:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
        if os.path.isdir(udd):
            import shutil
            shutil.rmtree(udd, ignore_errors=True)
    if os.path.exists(out_tmp) and os.path.getsize(out_tmp) > MIN_BYTES:
        os.replace(out_tmp, out_final)
        return status, os.path.getsize(out_final)
    if os.path.exists(out_tmp):
        os.remove(out_tmp)
    return "blank", 0


def main():
    os.makedirs(COVER_DIR, exist_ok=True)
    html = open(HOMEPAGE, encoding="utf-8").read()
    entries = re.findall(r'\{ title: "([^"]*)", tag: "([^"]*)", gameUrl: "([^"]*)"(?:, thumb: "[^"]*")? \}', html)
    if not entries:
        print("!! 未找到 games 条目"); sys.exit(1)

    only = sys.argv[1] if len(sys.argv) > 1 else None
    results = []
    for i, (title, _tag, url) in enumerate(entries, 1):
        slug = slug_of(url)
        if only and only not in slug:
            continue
        cover = os.path.join(COVER_DIR, slug + ".jpg")
        status, size = capture(file_url(url), cover + ".part.jpg", cover)
        results.append((title, slug, status, size))
        print(f"[{i:02d}] {status:7s} {size:>8}  {slug}", flush=True)

    print("\n=== SUMMARY ===")
    good = [r for r in results if r[2] == "ok"]
    print(f"ok={len(good)} / {len(results)}")
    for title, slug, status, size in results:
        print(f"  {status:8s} {size:>8}  {slug}  ({title})")

    if len(sys.argv) == 1:
        changed = 0
        for title, _tag, url in entries:
            slug = slug_of(url)
            cover_rel = "./第二轮灰测/covers/" + slug + ".jpg"
            orig = '{ title: "%s", tag: "%s", gameUrl: "%s" }' % (title, _tag, url)
            if os.path.isfile(os.path.join(COVER_DIR, slug + ".jpg")) and orig in html:
                html = html.replace(orig, orig.replace(" }", ', thumb: "%s" }' % cover_rel, 1), 1)
                changed += 1
        open(HOMEPAGE, "w", encoding="utf-8").write(html)
        print(f"\n回填 thumb: {changed} 条")


if __name__ == "__main__":
    main()
