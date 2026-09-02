@echo off
chcp 65001 >nul
title 启萃社媒增长中台
cd /d "%~dp0feihe-mvp"
echo 正在启动本地服务（首次约需 10 秒）...
echo 启动后请访问： http://127.0.0.1:5173/
node scripts/dev.mjs
pause
