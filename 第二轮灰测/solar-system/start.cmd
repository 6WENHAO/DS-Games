@echo off
rem ============================================================
rem  太阳系 · 撞击实验室  —  一键启动
rem  直接双击 index.html 也能运行（没有任何外部资源依赖）。
rem  这个脚本额外起一个本地静态服务器，方便手机 / 平板在同一局域网访问。
rem ============================================================
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
  echo [1/2] 启动本地服务器  http://127.0.0.1:8777/
  start "" http://127.0.0.1:8777/index.html
  python -m http.server 8777
  goto :eof
)

where node >nul 2>nul
if %errorlevel%==0 (
  echo [1/2] 未找到 python，改用 node 启动  http://127.0.0.1:8777/
  start "" http://127.0.0.1:8777/index.html
  node -e "const h=require('http'),f=require('fs'),p=require('path');const T={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.md':'text/markdown; charset=utf-8'};h.createServer((q,s)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';const fp=p.join(process.cwd(),u);f.readFile(fp,(e,d)=>{if(e){s.writeHead(404);s.end('404');return}s.writeHead(200,{'content-type':T[p.extname(fp)]||'application/octet-stream'});s.end(d)})}).listen(8777,()=>console.log('serving on http://127.0.0.1:8777/'))"
  goto :eof
)

echo 没有找到 python 或 node，直接打开本地文件。
start "" "%~dp0index.html"
