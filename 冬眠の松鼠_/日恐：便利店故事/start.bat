@echo off
title Night Shift - Server
echo Starting Night Shift...
start "" http://localhost:8080
node serve.js
pause
