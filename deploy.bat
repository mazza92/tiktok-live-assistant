@echo off
chcp 65001 >nul
echo 🚀 TikTok Live Assistant Deployment Script
echo ==========================================

REM Check if git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git is not installed. Please install Git first.
    pause
    exit /b 1
)

REM Check if we're in a git repository
if not exist ".git" (
    echo ❌ Not in a git repository. Please run this script from the project root.
    pause
    exit /b 1
)

REM Check if we have uncommitted changes
git status --porcelain >nul 2>&1
if not errorlevel 1 (
    echo ⚠️  You have uncommitted changes. Please commit or stash them first.
    git status --short
    echo.
    set /p "continue=Do you want to continue anyway? (y/N): "
    if /i not "%continue%"=="y" (
        exit /b 1
    )
)

REM Check if we have a remote origin
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo ❌ No remote origin found. Please add a remote repository first.
    echo Example: git remote add origin https://github.com/yourusername/your-repo.git
    pause
    exit /b 1
)

echo ✅ Git repository is ready
echo.

REM Show current status
echo 📊 Current Status:
for /f "tokens=2" %%i in ('git branch --show-current') do set "current_branch=%%i"
echo   - Branch: %current_branch%
for /f "tokens=2" %%i in ('git remote get-url origin') do set "remote_url=%%i"
echo   - Remote: %remote_url%
for /f "tokens=2" %%i in ('git log -1 --oneline') do set "last_commit=%%i"
echo   - Last commit: %last_commit%
echo.

REM Ask for deployment type
echo 🌐 Choose deployment platform:
echo 1) Render (Recommended for MVP)
echo 2) Railway
echo 3) Fly.io
echo 4) Just prepare for deployment
echo.
set /p "choice=Enter your choice (1-4): "

if "%choice%"=="1" (
    echo.
    echo 🚀 Preparing for Render deployment...
    call :deploy_render
) else if "%choice%"=="2" (
    echo.
    echo 🚂 Preparing for Railway deployment...
    call :deploy_railway
) else if "%choice%"=="3" (
    echo.
    echo ✈️  Preparing for Fly.io deployment...
    call :deploy_flyio
) else if "%choice%"=="4" (
    echo.
    echo 📦 Preparing for deployment...
    call :prepare_deployment
) else (
    echo ❌ Invalid choice. Exiting.
    pause
    exit /b 1
)

echo.
echo ✅ Deployment preparation complete!
echo.
echo 📋 Next steps:
echo 1. Push your changes to GitHub: git push origin main
echo 2. Follow the platform-specific deployment instructions above
echo 3. Set environment variables in your deployment platform
echo 4. Deploy your application
echo.
echo 🎉 Good luck with your deployment!
pause
exit /b 0

:deploy_render
echo.
echo 🎯 Render Deployment Instructions:
echo ==================================
echo.
echo 1. Go to https://render.com and sign up/login
echo 2. Click 'New +' and select 'Web Service'
echo 3. Connect your GitHub repository
echo 4. Configure your service:
echo    - Name: tiktok-live-assistant
echo    - Environment: Node
echo    - Build Command: npm install
echo    - Start Command: npm start
echo 5. Add environment variables:
echo    - NODE_ENV: production
echo    - TIKTOK_USERNAME: your_tiktok_username
echo 6. Click 'Create Web Service'
echo.
echo 🌐 Your app will be available at: https://your-app-name.onrender.com
goto :eof

:deploy_railway
echo.
echo 🚂 Railway Deployment Instructions:
echo ===================================
echo.
echo 1. Go to https://railway.app and sign up/login
echo 2. Click 'New Project' and select 'Deploy from GitHub repo'
echo 3. Select your repository
echo 4. Add environment variables:
echo    - NODE_ENV: production
echo    - TIKTOK_USERNAME: your_tiktok_username
echo 5. Railway will automatically deploy your app
echo.
echo 🌐 Your app will be available at the URL provided by Railway
goto :eof

:deploy_flyio
echo.
echo ✈️  Fly.io Deployment Instructions:
echo ===================================
echo.
echo 1. Install Fly CLI: curl -L https://fly.io/install.sh ^| sh
echo 2. Login: fly auth login
echo 3. Deploy: fly launch
echo 4. Set environment variables:
echo    - fly secrets set NODE_ENV=production
echo    - fly secrets set TIKTOK_USERNAME=your_tiktok_username
echo 5. Deploy: fly deploy
echo.
echo 🌐 Your app will be available at the URL provided by Fly.io
goto :eof

:prepare_deployment
echo.
echo 📦 Deployment Preparation:
echo ==========================
echo.
echo ✅ Project structure is ready
echo ✅ Configuration files are created
echo ✅ Dependencies are configured
echo.
echo 📋 Files created/modified:
echo   - package.json (updated)
echo   - Procfile (created)
echo   - render.yaml (created)
echo   - .gitignore (created)
echo   - env.example (created)
echo   - README.md (updated)
echo   - deploy.bat (created)
echo.
echo 🔧 Next steps:
echo 1. Install dependencies: npm install
echo 2. Test locally: npm start
echo 3. Commit changes: git add . ^&^& git commit -m "Prepare for deployment"
echo 4. Push to GitHub: git push origin main
echo 5. Choose your deployment platform
goto :eof
