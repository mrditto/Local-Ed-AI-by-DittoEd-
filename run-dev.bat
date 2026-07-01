@echo off
cd /d "%~dp0"
echo ===== npm install =====
call npm install
echo.
echo ===== npm run tauri dev =====
call npm run tauri dev
echo.
echo ===== Script finished (or was closed) =====
pause
