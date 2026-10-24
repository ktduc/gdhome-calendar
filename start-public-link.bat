@echo off
title Khoi dong Lich Tien Do & Cloudflare Public Link
echo =======================================================
echo 1. Dang khoi dong Web Server Local...
echo =======================================================
cd /d "%~dp0"
start "Lich Tien Do Server" node server.js

echo.
echo =======================================================
echo 2. Dang tao duong link Internet cong khai (Cloudflare)...
echo =======================================================
cloudflared tunnel --url http://localhost:3000
pause
