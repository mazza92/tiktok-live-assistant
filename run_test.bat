@echo off
echo 🎵 TikTok Live Data Ingestion Test
echo ==================================================
echo.
echo Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

echo ✅ Python found
echo.
echo Installing/updating dependencies...
pip install -r requirements.txt

if errorlevel 1 (
    echo ❌ Failed to install dependencies
    echo Please check your internet connection and try again
    pause
    exit /b 1
)

echo.
echo 🚀 Starting TikTok Live test...
echo.
echo IMPORTANT: Make sure you've edited tiktok_live_test.py
echo and replaced @YOUR_TIKTOK_USERNAME with a real username!
echo.
echo Press any key to continue...
pause >nul

python tiktok_live_test.py

echo.
echo Test completed. Press any key to exit...
pause >nul
