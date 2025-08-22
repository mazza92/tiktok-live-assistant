# TikTok Live Data Ingestion Test - PowerShell Runner
# Run this script to easily test the TikTokLive library

Write-Host "🎵 TikTok Live Data Ingestion Test" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check Python installation
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.8+ from https://python.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Installing/updating dependencies..." -ForegroundColor Yellow
try {
    pip install -r requirements.txt
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    Write-Host "Please check your internet connection and try again" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "🚀 Starting TikTok Live test..." -ForegroundColor Green
Write-Host ""
Write-Host "IMPORTANT: Make sure you've edited tiktok_live_test.py" -ForegroundColor Yellow
Write-Host "and replaced @YOUR_TIKTOK_USERNAME with a real username!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Enter to continue..." -ForegroundColor Cyan
Read-Host

# Run the test
try {
    python tiktok_live_test.py
} catch {
    Write-Host "❌ Error running the test: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Test completed. Press Enter to exit..." -ForegroundColor Cyan
Read-Host
