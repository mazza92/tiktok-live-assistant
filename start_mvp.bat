@echo off
echo 🚀 Starting TikTok Live MVP System...
echo.
echo 📡 Starting Data Processor...
start "TikTok Data Processor" cmd /k "node tiktok_data_processor.js"
echo.
echo ⏳ Waiting 5 seconds for server to start...
timeout /t 5 /nobreak >nul
echo.
echo 🌐 Opening Dashboard...
start "" "dashboard.html"
echo.
echo 🎭 Opening Wizard Control...
start "" "http://localhost:3000/wizard"
echo.
echo ✅ MVP System Started!
echo.
echo 📍 Dashboard: dashboard.html (local file)
echo 🎭 Wizard Control: http://localhost:3000/wizard
echo 📊 Metrics API: http://localhost:3000/metrics
echo.
echo Press any key to close this window...
pause >nul
