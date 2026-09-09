@echo off
REM  Double-click this file to rebuild the cards and open them in your browser.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js is not installed.
  echo   Install it from https://nodejs.org  then run this file again.
  echo.
  pause
  exit /b 1
)

node build.mjs
if errorlevel 1 (
  echo.
  echo   Build failed - see the message above.
  echo.
  pause
  exit /b 1
)

start "" "%~dp0docs\index.html"
