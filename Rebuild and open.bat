@echo off
REM  Double-click this file to rebuild the cards and open them in a browser.
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

set "PAGE=%~dp0docs\index.html"

REM open in a real browser (not a code editor), trying Chrome, then Edge, then default
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%PAGE%"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%PAGE%"
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%PAGE%"
) else (
  start "" "%PAGE%"
)

echo.
echo   Opened: %PAGE%
echo   (this window can be closed)
timeout /t 3 >nul
