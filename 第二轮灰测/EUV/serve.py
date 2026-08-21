#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
serve.py — EUV 演示动画本地服务器
1) ES Module 必须经 HTTP 加载（file:// 会被 CORS 拒绝），故提供静态服务。
2) 提供 POST /__save 落盘接口，使浏览器端的母版逐帧捕获可全自动写入磁盘
   （否则 5400 帧只能逐个下载，无法交付）。写入路径被严格限制在 out/ 下。
用法:  python serve.py [端口]
"""
import http.server
import socketserver
import sys
import os
import re
import json
import webbrowser
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT_ROOT = os.path.join(ROOT, 'out')
SAFE_NAME = re.compile(r'^[A-Za-z0-9._\-/]+$')


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.html': 'text/html; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.srt': 'text/plain; charset=utf-8',
        '.ass': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '': 'application/octet-stream',
    }

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        # /__save?path=frames/master/EUV_master_000001.png
        if not self.path.startswith('/__save'):
            return self._json(404, {'ok': False, 'error': 'unknown endpoint'})
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        rel = (q.get('path') or [''])[0]
        if not rel or not SAFE_NAME.match(rel) or '..' in rel:
            return self._json(400, {'ok': False, 'error': 'illegal path: %r' % rel})
        dest = os.path.normpath(os.path.join(OUT_ROOT, rel))
        if not dest.startswith(OUT_ROOT):
            return self._json(400, {'ok': False, 'error': 'path escapes out/'})
        try:
            n = int(self.headers.get('Content-Length') or 0)
            data = self.rfile.read(n) if n else b''
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'wb') as f:
                f.write(data)
            return self._json(200, {'ok': True, 'path': os.path.relpath(dest, ROOT).replace('\\', '/'), 'bytes': len(data)})
        except Exception as e:                                  # noqa: BLE001
            return self._json(500, {'ok': False, 'error': str(e)})

    def do_GET(self):
        if self.path.startswith('/__info'):
            return self._json(200, {'ok': True, 'root': ROOT, 'out': OUT_ROOT, 'port': PORT})
        return super().do_GET()

    def log_message(self, fmt, *args):
        msg = fmt % args
        if ' 404 ' in msg or ' 500 ' in msg or ' 400 ' in msg:
            sys.stderr.write('[serve] %s\n' % msg)


class ReusableServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    os.makedirs(OUT_ROOT, exist_ok=True)
    with ReusableServer(('127.0.0.1', PORT), Handler) as httpd:
        url = f'http://127.0.0.1:{PORT}/'
        print(f'[serve] EUV 演示动画  →  {url}')
        print(f'[serve] 根目录: {ROOT}')
        print(f'[serve] 输出目录: {OUT_ROOT}  (POST /__save?path=...)')
        print('[serve] 质量档: ?q=preview | review | master     语言: ?lang=zh | en | bi')
        print('[serve] Ctrl+C 停止')
        if '--no-open' not in sys.argv:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n[serve] 已停止')


if __name__ == '__main__':
    main()
