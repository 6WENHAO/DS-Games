#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tools/serve.py — 零依赖本地静态服务器（Python 3.7+，Linux/Windows/macOS 通用）
与 tools/serve.js 等价，供没装 Node 的机器使用。实现了 HTTP Range（视频定位必需）。

用法:
    python3 tools/serve.py
    python3 tools/serve.py --port 9000 --open
"""
import argparse
import mimetypes
import os
import posixpath
import re
import socket
import sys
import threading
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

EXTRA_MIME = {
    '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.mov': 'video/quicktime',
    '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.ogv': 'video/ogg',
    '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
    '.zip': 'application/zip',
}

RANGE_RE = re.compile(r'^bytes=(\d*)-(\d*)$')


def guess_type(path):
    ext = os.path.splitext(path)[1].lower()
    if ext in EXTRA_MIME:
        return EXTRA_MIME[ext]
    t, _ = mimetypes.guess_type(path)
    return t or 'application/octet-stream'


class Handler(BaseHTTPRequestHandler):
    server_version = 'dsv4p-serve/1.0'
    protocol_version = 'HTTP/1.1'
    quiet = False

    def log_message(self, fmt, *args):
        if not Handler.quiet:
            sys.stdout.write('  %s\n' % (fmt % args))

    def translate(self):
        raw = urllib.parse.urlparse(self.path).path
        raw = urllib.parse.unquote(raw)
        parts = [p for p in posixpath.normpath(raw).split('/') if p not in ('', '.', '..')]
        target = os.path.join(ROOT, *parts)
        target = os.path.abspath(target)
        if not target.startswith(ROOT):      # 阻止越权
            return None
        if os.path.isdir(target):
            target = os.path.join(target, 'index.html')
        return target

    def do_HEAD(self):
        self.serve(head_only=True)

    def do_GET(self):
        self.serve(head_only=False)

    def serve(self, head_only=False):
        target = self.translate()
        if not target or not os.path.isfile(target):
            body = ('<h1>404</h1><p>找不到：%s</p><p><a href="/">回到播放器</a></p>'
                    % urllib.parse.quote(self.path)).encode('utf-8')
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if not head_only:
                self.wfile.write(body)
            return

        size = os.path.getsize(target)
        ctype = guess_type(target)
        rng = self.headers.get('Range')
        start, end = 0, size - 1
        partial = False

        if rng:
            m = RANGE_RE.match(rng.strip())
            if m:
                g1, g2 = m.group(1), m.group(2)
                if g1 == '' and g2 != '':
                    start, end = max(0, size - int(g2)), size - 1
                elif g1 != '' and g2 == '':
                    start, end = int(g1), size - 1
                elif g1 != '' and g2 != '':
                    start, end = int(g1), min(int(g2), size - 1)
                if start > end or start >= size:
                    self.send_response(416)
                    self.send_header('Content-Range', 'bytes */%d' % size)
                    self.send_header('Content-Length', '0')
                    self.end_headers()
                    return
                partial = True

        length = end - start + 1
        self.send_response(206 if partial else 200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(length))
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        if partial:
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.end_headers()
        if head_only:
            return
        remaining = length
        with open(target, 'rb') as f:
            f.seek(start)
            while remaining > 0:
                chunk = f.read(min(262144, remaining))
                if not chunk:
                    break
                try:
                    self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    return
                remaining -= len(chunk)


def free_port(host, port, tries=12):
    for i in range(tries):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            s.bind((host, port + i))
            s.close()
            return port + i
        except OSError:
            s.close()
    return port


def main():
    ap = argparse.ArgumentParser(description='dsv4p 本地静态服务器（零依赖）')
    ap.add_argument('--port', type=int, default=8321)
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--open', action='store_true')
    ap.add_argument('--quiet', action='store_true')
    args = ap.parse_args()
    Handler.quiet = args.quiet

    port = free_port(args.host, args.port)
    httpd = ThreadingHTTPServer((args.host, port), Handler)
    url = 'http://%s:%d/index.html' % ('127.0.0.1' if args.host == '0.0.0.0' else args.host, port)
    print('')
    print('  dsv4p max stantard imdoing — 本地服务器已启动')
    print('  根目录: %s' % ROOT)
    print('  地址:   %s' % url)
    print('  (Ctrl+C 退出)')
    print('')
    if args.open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\n  已退出。')


if __name__ == '__main__':
    main()
