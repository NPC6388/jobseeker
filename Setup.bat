@echo off
title JobSeeker Setup
color 0A

echo.
echo     ===================================
echo     🔧 JobSeeker Setup & Installation 🔧
echo     ===================================
echo.

REM Change to the script directory
cd /d "%~dp0"

echo 📦 Installing dependencies...
npm install
if errorlevel 1 (
    echo ❌ Error: Failed to install dependencies
    pause
    exit /b 1
)

echo 🌐 Installing Playwright browsers...
npx playwright install
if errorlevel 1 (
    echo ❌ Error: Failed to install Playwright browsers
    pause
    exit /b 1
)

echo 🔗 Creating desktop shortcut...
cscript //nologo CreateShortcut.vbs

echo.
echo ✅ Setup complete!
echo.
echo 🎯 You can now use JobSeeker in the following ways:
echo.
echo   1. Double-click the "JobSeeker" icon on your desktop
echo   2. Run "JobSeeker.bat" from this folder
echo   3. Run "StartJobSeeker.ps1" for enhanced PowerShell experience
echo.
echo 📱 The web interface will be available at: http://localhost:3000
echo.
pause