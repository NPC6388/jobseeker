@echo off
title JobSeeker - Enhanced Launcher
color 0B

echo.
echo     =============================================
echo     🔍 JobSeeker - Automated Job Search Tool 🔍
echo     =============================================
echo.

REM Change to the script directory
cd /d "%~dp0"

REM Kill any existing processes on port 3000
echo 🧹 Cleaning up existing processes...
npx kill-port 3000 >nul 2>&1
timeout /t 2 /nobreak >nul

echo 🚀 Starting JobSeeker Web Interface...
echo.

REM Start the web server in background
start /min cmd /c "npm run web"

echo ⏱️  Waiting for server to start...
timeout /t 5 /nobreak >nul

REM Test if server is responding
echo 🔍 Testing server connection...
curl -s -o nul -w "%%{http_code}" http://localhost:3000 > temp_status.txt
set /p HTTP_STATUS=<temp_status.txt
del temp_status.txt

if "%HTTP_STATUS%"=="200" (
    echo ✅ Server is running successfully!
    echo 📱 Opening web interface...
    echo.

    REM Try multiple ways to open the browser
    start "" "http://localhost:3000" >nul 2>&1
    timeout /t 2 /nobreak >nul

    REM If first attempt failed, try alternatives
    echo 🌐 Web interface is available at:
    echo    • http://localhost:3000
    echo    • http://127.0.0.1:3000
    echo.
    echo 💡 If browser doesn't open automatically, copy one of the URLs above
    echo.

) else (
    echo ❌ Server failed to start (HTTP Status: %HTTP_STATUS%)
    echo.
    echo 🔧 Troubleshooting steps:
    echo    1. Check if Node.js is installed: node --version
    echo    2. Check if port 3000 is available: netstat -ano ^| findstr :3000
    echo    3. Try running: npm install
    echo    4. Check firewall settings
    echo.
    echo 📖 See TROUBLESHOOTING.md for detailed help
    echo.
)

echo ⚠️  Keep this window open while using JobSeeker
echo 🛑 Press any key to stop the application
echo.

pause >nul

echo 🛑 Stopping JobSeeker...
npx kill-port 3000 >nul 2>&1
taskkill /F /IM node.exe /FI "WINDOWTITLE eq npm*" >nul 2>&1
echo ✅ JobSeeker stopped
timeout /t 2 /nobreak >nul