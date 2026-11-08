@echo off
title CAP NHAT WEB LICH TIEN DO GD HOME LEN MANG (AUTO-DEPLOY)
color 0A

echo ============================================================================
echo   DANG DONG BO VA CAP NHAT WEB LICH TIEN DO GD HOME LEN MANG (RENDER.COM)
echo ============================================================================
echo.

set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\nodejs"
cd /d "C:\Users\KTDUC\.gemini\antigravity\scratch\timeline-calendar"

set "BACKUP_DIR=C:\Users\KTDUC\Desktop\gdhome-calendar-files"
if exist "%BACKUP_DIR%" (
    for %%F in (index.html style.css shell.css shell.js integrations-client.js ai-client.js tools-menu.css material-timeline.js export-canvas.js app.js scheduler.js holidays-data.js server.js project-profiles.js projects-client.js integrations.js package.json gdhome-icon.png gdhome-logo.png CLAUDE_HANDOVER.md) do (
        if exist "%%F" copy /Y "%%F" "%BACKUP_DIR%\" >nul
    )
)

echo [1/3] Dang gom cac chinh sua moi nhat...
REM KHONG dua data.json len GitHub nua: du lieu tren web duoc luu rieng (GitHub Gist),
REM cap nhat code se KHONG ghi de du lieu nguoi khac dang dung.
"%GIT_EXE%" add index.html style.css app.js scheduler.js holidays-data.js server.js project-profiles.js projects-client.js integrations.js package.json .gitignore tests CLAUDE_HANDOVER.md HUONG-DAN-CAI-DAT.md HUONG-DAN-NOTION-AI.md materials.js tools.html shell.css shell.js integrations-client.js ai-client.js tools-menu.css tools.css tools.js chot-ma.html material-template.js material-guest.js material-preferences.js material-editor.js material-editor-view.js material-selection.js material-assets.js material-image-ui.js material-import.js material-note-suggestions.js material-review.js material-terms.js material-print.js material-customer.js material-release.js material-schedule.js material-deadlines.js material-projects.js material-ai.js material-timeline.js export-canvas.js duyet.html docs/mau-bien-ban.md docs/HE-THONG-GIAO-DIEN.md HUONG-DAN-R2.md
"%GIT_EXE%" commit -m "Auto update GD HOME Schedule & MS Project Timeline" >nul 2>&1

echo [2/3] Dang day ban cap nhat len GitHub (ktduc/gdhome-calendar)...
echo       (Neu hien bang dang nhap GitHub, ban bam Sign in with your browser 1 lan duy nhat)
REM Khong dung --force nua: neu tren GitHub co ban moi hon, se bao loi thay vi ghi de mat code
"%GIT_EXE%" push -u origin main

if errorlevel 1 goto :deploy_error

echo.
echo ============================================================================
echo   [3/3] CAP NHAT THANH CONG 100%%!
echo   - Code moi nhat da duoc day len GitHub.
echo   - Render.com dang tu dong cap nhat lai trang web cua ban (khoang 30 giay).
echo ============================================================================
goto :end_script

:deploy_error
echo.
echo [!] Co loi khi day len GitHub. Hay kiem tra ket noi mang hoac dang nhap GitHub.
echo     Neu loi "rejected / fetch first": tren GitHub co ban moi hon ban tren may.
echo     Hay chay lenh:  git pull --rebase origin main   roi chay lai file nay.

:end_script
echo.
pause