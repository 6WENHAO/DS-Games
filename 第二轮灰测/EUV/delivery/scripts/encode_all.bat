@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
REM =====================================================================
REM encode_all.bat - 母版 / 正片 / 社媒衍生版 封装脚本（Windows）
REM 规格书 §2 交付物
REM ---------------------------------------------------------------------
REM 前置：
REM   1) 已用 tools\capture.html 捕获帧序列到 EUV\out\frames\master\
REM        EUV_master_%%06d.png，3840x2160，30 fps
REM   2) 已导出音频分轨到 EUV\out\audio\
REM   3) 已导出字幕到 EUV\out\subtitles\
REM   4) 本机具备 ffmpeg 且已加入 PATH
REM
REM 用法：  cd EUV\delivery\scripts  然后  encode_all.bat
REM =====================================================================

set "HERE=%~dp0"
pushd "%HERE%..\.." >nul
set "ROOT=%CD%"
popd >nul

set "OUT=%ROOT%\out"
set "FRAMES=%OUT%\frames\master"
set "AUDIO=%OUT%\audio"
set "SUBS=%OUT%\subtitles"
set "DELIV=%OUT%\deliverables"
set "FPS=30"
set "VER=v01"

where ffmpeg >nul 2>&1 || (echo [错误] 未找到 ffmpeg，请安装并加入 PATH & exit /b 1)

for %%D in (master promo social subtitles audio stills) do (
  if not exist "%DELIV%\%%D" mkdir "%DELIV%\%%D" >nul 2>&1
)

echo == 0. 校验帧序列完整性 ==
set /a COUNT=0
for %%F in ("%FRAMES%\EUV_master_*.png") do set /a COUNT+=1
echo    实测 !COUNT! 帧 / 期望 5400 帧
if not !COUNT!==5400 echo    [警告] 帧数不符，请确认捕获已完成

set "MASTER=%DELIV%\master\EUV_master_ZH-EN_3840x2160_30p_ProRes422HQ_%VER%.mov"

echo == 1. 母版 ProRes 422 HQ ==
ffmpeg -y -hide_banner -framerate %FPS% -start_number 0 -i "%FRAMES%\EUV_master_%%06d.png" ^
  -i "%AUDIO%\EUV_mix_48k24b.wav" -map 0:v -map 1:a ^
  -c:v prores_ks -profile:v 3 -vendor apl0 -pix_fmt yuv422p10le ^
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 ^
  -c:a pcm_s24le -ar 48000 -shortest "%MASTER%"
if errorlevel 1 (echo [错误] 母版封装失败 & exit /b 1)

echo == 2. 正片 H.264 / H.265 ==
ffmpeg -y -hide_banner -i "%MASTER%" ^
  -c:v libx264 -preset slow -crf 18 -profile:v high -level 5.1 -pix_fmt yuv420p ^
  -g 60 -bf 3 -movflags +faststart -c:a aac -b:a 320k -ar 48000 ^
  -metadata title="EUV 光刻原理 · How EUV Lithography Works" ^
  "%DELIV%\promo\EUV_promo_ZH-EN_3840x2160_30p_H264_%VER%.mp4"

ffmpeg -y -hide_banner -i "%MASTER%" ^
  -c:v libx265 -preset slow -crf 22 -pix_fmt yuv420p10le -tag:v hvc1 ^
  -x265-params keyint=60:bframes=4 -movflags +faststart ^
  -c:a aac -b:a 320k -ar 48000 ^
  "%DELIV%\promo\EUV_promo_ZH-EN_3840x2160_30p_H265_%VER%.mp4"

ffmpeg -y -hide_banner -i "%MASTER%" -vf "scale=1920:1080:flags=lanczos" ^
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -g 60 -movflags +faststart ^
  -c:a aac -b:a 256k -ar 48000 ^
  "%DELIV%\promo\EUV_promo_ZH-EN_1920x1080_30p_H264_%VER%.mp4"

for %%L in (zh en bi) do (
  if exist "%SUBS%\EUV_%%L.ass" (
    ffmpeg -y -hide_banner -i "%MASTER%" -vf "ass=%SUBS%/EUV_%%L.ass" ^
      -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -g 60 -movflags +faststart ^
      -c:a aac -b:a 256k -ar 48000 ^
      "%DELIV%\promo\EUV_promo_burnin-%%L_1920x1080_30p_H264_%VER%.mp4"
  )
)

echo == 3. 社媒衍生版 ==
python "%HERE%make_cuts.py" --root "%ROOT%" --master "%MASTER%"
if errorlevel 1 (echo [警告] make_cuts.py 失败，跳过社媒版)

for %%C in (social60 social30) do (
  if exist "%OUT%\cuts\%%C_concat.txt" (
    ffmpeg -y -hide_banner -f concat -safe 0 -i "%OUT%\cuts\%%C_concat.txt" ^
      -vf "scale=1920:1080:flags=lanczos,fps=%FPS%" ^
      -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -g 60 -movflags +faststart ^
      -c:a aac -b:a 256k -ar 48000 ^
      "%DELIV%\social\EUV_%%C_h_ZH-EN_1920x1080_30p_H264_%VER%.mp4"

    ffmpeg -y -hide_banner -f concat -safe 0 -i "%OUT%\cuts\%%C_concat.txt" ^
      -vf "crop=ih*9/16:ih,scale=1080:1920:flags=lanczos,fps=%FPS%" ^
      -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -g 60 -movflags +faststart ^
      -c:a aac -b:a 256k -ar 48000 ^
      "%DELIV%\social\EUV_%%C_v_ZH-EN_1080x1920_30p_H264_%VER%.mp4"
  )
)

echo == 4. 归集字幕 / 音频 / 静态资产 ==
copy /Y "%SUBS%\*.srt" "%DELIV%\subtitles\" >nul 2>&1
copy /Y "%SUBS%\*.ass" "%DELIV%\subtitles\" >nul 2>&1
copy /Y "%SUBS%\*.tsv" "%DELIV%\subtitles\" >nul 2>&1
copy /Y "%AUDIO%\*.wav" "%DELIV%\audio\" >nul 2>&1
copy /Y "%AUDIO%\*.md"  "%DELIV%\audio\" >nul 2>&1
xcopy /Y /E /I "%OUT%\stills" "%DELIV%\stills" >nul 2>&1

echo == 5. 交付物清单 ==
dir /S /B "%DELIV%"
echo.
echo 完成。交付目录：%DELIV%
endlocal
