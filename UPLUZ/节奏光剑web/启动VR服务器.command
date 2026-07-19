#!/bin/zsh
# 节奏光剑 Web — 本地服务器（WebXR 需要 localhost 或 HTTPS）
cd "$(dirname "$0")"
IP=$(ipconfig getifaddr en0 2>/dev/null)
echo "======================================================"
echo " 桌面浏览器 / PCVR(SteamVR·Quest Link)："
echo "   http://localhost:8000"
echo ""
if [ -n "$IP" ]; then
  echo " Quest 一体机浏览器（二选一）："
  echo "   1) USB 连接后执行: adb reverse tcp:8000 tcp:8000"
  echo "      然后在头显浏览器打开 http://localhost:8000"
  echo "   2) 局域网直连 http://$IP:8000 仅能玩桌面模式，"
  echo "      VR 模式需 HTTPS（可用 mkcert 或 ngrok）"
fi
echo "======================================================"
python3 -m http.server 8000
