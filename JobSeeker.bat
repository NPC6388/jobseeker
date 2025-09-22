@echo off
title JobSeeker - Automated Job Search Tool
color 0B

echo.
echo     =============================================
echo     🔍 JobSeeker - Automated Job Search Tool 🔍
echo     =============================================
echo.
echo     Starting the web interface...
echo.

REM Change to the script directory
cd /d "%~dp0"

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Error: Failed to install dependencies
        pause
        exit /b 1
    )
)

REM Check if Playwright browsers are installed
if not exist "%USERPROFILE%\AppData\Local\ms-playwright\chromium-1187" (
    echo 🌐 Installing Playwright browsers...
    npx playwright install
    if errorlevel 1 (
        echo ❌ Error: Failed to install Playwright browsers
        pause
        exit /b 1
    )
)

echo ✅ Dependencies verified
echo.

REM Kill any existing process on port 3000
echo 🧹 Cleaning up any existing processes...
npx kill-port 3000 >nul 2>&1

echo 🚀 Starting JobSeeker Web Interface...
echo.
echo 📱 Web dashboard will open at: http://localhost:3000
echo 🎯 The interface will automatically open in your default browser
echo.
echo ⚠️  Keep this window open while using JobSeeker
echo 🛑 Close this window or press Ctrl+C to stop the application
echo.

REM Wait a moment then open browser
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"

REM Start the web server
npm run web

REM If we get here, the server stopped
echo.
echo 🛑 JobSeeker has stopped
pause