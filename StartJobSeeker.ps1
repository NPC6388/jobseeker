# JobSeeker Startup Script
# Automated Job Search Tool

param(
    [switch]$NoOpen
)

# Set console colors and title
$Host.UI.RawUI.WindowTitle = "JobSeeker - Automated Job Search Tool"
$Host.UI.RawUI.BackgroundColor = "DarkBlue"
$Host.UI.RawUI.ForegroundColor = "White"
Clear-Host

# ASCII Art Header
Write-Host ""
Write-Host "     ================================================" -ForegroundColor Cyan
Write-Host "     🔍 JobSeeker - Automated Job Search Tool 🔍" -ForegroundColor Yellow
Write-Host "     ================================================" -ForegroundColor Cyan
Write-Host ""

# Change to script directory
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptPath

Write-Host "📁 Working directory: $ScriptPath" -ForegroundColor Gray
Write-Host ""

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    $connection = New-Object System.Net.Sockets.TcpClient
    try {
        $connection.Connect("localhost", $Port)
        $connection.Close()
        return $true
    }
    catch {
        return $false
    }
}

# Function to kill process on port
function Stop-ProcessOnPort {
    param([int]$Port)
    try {
        $processes = netstat -ano | Select-String ":$Port " | ForEach-Object {
            $parts = $_ -split '\s+'
            $parts[4]
        }

        foreach ($pid in $processes) {
            if ($pid -and $pid -ne "0") {
                Write-Host "🧹 Stopping existing process (PID: $pid)..." -ForegroundColor Yellow
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    }
    catch {
        # Silently ignore errors
    }
}

try {
    # Check if Node.js is installed
    Write-Host "🔍 Checking Node.js installation..." -ForegroundColor Green
    $nodeVersion = node --version 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Error: Node.js is not installed or not in PATH" -ForegroundColor Red
        Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green

    # Check if dependencies are installed
    if (-not (Test-Path "node_modules")) {
        Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Error: Failed to install dependencies" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }

    # Check if Playwright browsers are installed
    $playwrightPath = "$env:USERPROFILE\AppData\Local\ms-playwright\chromium-1187"
    if (-not (Test-Path $playwrightPath)) {
        Write-Host "🌐 Installing Playwright browsers..." -ForegroundColor Yellow
        npx playwright install
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Error: Failed to install Playwright browsers" -ForegroundColor Red
            Read-Host "Press Enter to exit"
            exit 1
        }
    }

    Write-Host "✅ All dependencies verified" -ForegroundColor Green
    Write-Host ""

    # Clean up any existing processes
    if (Test-Port 3000) {
        Write-Host "🧹 Cleaning up existing processes on port 3000..." -ForegroundColor Yellow
        Stop-ProcessOnPort 3000
        Start-Sleep 2
    }

    # Start the application
    Write-Host "🚀 Starting JobSeeker Web Interface..." -ForegroundColor Green
    Write-Host ""
    Write-Host "📱 Web dashboard: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "🎯 Opening in your default browser..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️  Keep this window open while using JobSeeker" -ForegroundColor Yellow
    Write-Host "🛑 Close this window or press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host ""

    # Open browser after a short delay (unless -NoOpen is specified)
    if (-not $NoOpen) {
        Start-Job -ScriptBlock {
            Start-Sleep 4
            Start-Process "http://localhost:3000"
        } | Out-Null
    }

    # Start the web server
    npm run web

}
catch {
    Write-Host "❌ An error occurred: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
finally {
    Write-Host ""
    Write-Host "🛑 JobSeeker has stopped" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
}