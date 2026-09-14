@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 or newer, then run this file again.
  pause
  exit /b 1
)
echo SkillBridge - Open http://localhost:3000 in your browser.
echo Press Ctrl+C to stop.
node backend/server.js
pause
