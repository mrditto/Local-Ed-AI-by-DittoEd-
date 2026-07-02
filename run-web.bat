@echo off
rem Frontend-only dev server (no Tauri/Rust) — for UI QA in a browser at http://localhost:3000
cd /d "%~dp0"
call npm install
call npm run dev -- --host
pause
