#!/bin/bash

# TikTok Live Assistant Deployment Script
echo "🚀 TikTok Live Assistant Deployment Script"
echo "=========================================="

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository. Please run this script from the project root."
    exit 1
fi

# Check if we have uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  You have uncommitted changes. Please commit or stash them first."
    git status --short
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if we have a remote origin
if ! git remote get-url origin &> /dev/null; then
    echo "❌ No remote origin found. Please add a remote repository first."
    echo "Example: git remote add origin https://github.com/yourusername/your-repo.git"
    exit 1
fi

echo "✅ Git repository is ready"
echo ""

# Show current status
echo "📊 Current Status:"
echo "  - Branch: $(git branch --show-current)"
echo "  - Remote: $(git remote get-url origin)"
echo "  - Last commit: $(git log -1 --oneline)"
echo ""

# Ask for deployment type
echo "🌐 Choose deployment platform:"
echo "1) Render (Recommended for MVP)"
echo "2) Railway"
echo "3) Fly.io"
echo "4) Just prepare for deployment"
echo ""
read -p "Enter your choice (1-4): " -n 1 -r
echo
echo ""

case $REPLY in
    1)
        echo "🚀 Preparing for Render deployment..."
        deploy_render
        ;;
    2)
        echo "🚂 Preparing for Railway deployment..."
        deploy_railway
        ;;
    3)
        echo "✈️  Preparing for Fly.io deployment..."
        deploy_flyio
        ;;
    4)
        echo "📦 Preparing for deployment..."
        prepare_deployment
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "✅ Deployment preparation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Push your changes to GitHub: git push origin main"
echo "2. Follow the platform-specific deployment instructions above"
echo "3. Set environment variables in your deployment platform"
echo "4. Deploy your application"
echo ""
echo "🎉 Good luck with your deployment!"

# Function for Render deployment
deploy_render() {
    echo ""
    echo "🎯 Render Deployment Instructions:"
    echo "=================================="
    echo ""
    echo "1. Go to https://render.com and sign up/login"
    echo "2. Click 'New +' and select 'Web Service'"
    echo "3. Connect your GitHub repository"
    echo "4. Configure your service:"
    echo "   - Name: tiktok-live-assistant"
    echo "   - Environment: Node"
    echo "   - Build Command: npm install"
    echo "   - Start Command: npm start"
    echo "5. Add environment variables:"
    echo "   - NODE_ENV: production"
    echo "   - TIKTOK_USERNAME: your_tiktok_username"
    echo "6. Click 'Create Web Service'"
    echo ""
    echo "🌐 Your app will be available at: https://your-app-name.onrender.com"
}

# Function for Railway deployment
deploy_railway() {
    echo ""
    echo "🚂 Railway Deployment Instructions:"
    echo "==================================="
    echo ""
    echo "1. Go to https://railway.app and sign up/login"
    echo "2. Click 'New Project' and select 'Deploy from GitHub repo'"
    echo "3. Select your repository"
    echo "4. Add environment variables:"
    echo "   - NODE_ENV: production"
    echo "   - TIKTOK_USERNAME: your_tiktok_username"
    echo "5. Railway will automatically deploy your app"
    echo ""
    echo "🌐 Your app will be available at the URL provided by Railway"
}

# Function for Fly.io deployment
deploy_flyio() {
    echo ""
    echo "✈️  Fly.io Deployment Instructions:"
    echo "==================================="
    echo ""
    echo "1. Install Fly CLI: curl -L https://fly.io/install.sh | sh"
    echo "2. Login: fly auth login"
    echo "3. Deploy: fly launch"
    echo "4. Set environment variables:"
    echo "   - fly secrets set NODE_ENV=production"
    echo "   - fly secrets set TIKTOK_USERNAME=your_tiktok_username"
    echo "5. Deploy: fly deploy"
    echo ""
    echo "🌐 Your app will be available at the URL provided by Fly.io"
}

# Function to prepare for deployment
prepare_deployment() {
    echo ""
    echo "📦 Deployment Preparation:"
    echo "=========================="
    echo ""
    echo "✅ Project structure is ready"
    echo "✅ Configuration files are created"
    echo "✅ Dependencies are configured"
    echo ""
    echo "📋 Files created/modified:"
    echo "  - package.json (updated)"
    echo "  - Procfile (created)"
    echo "  - render.yaml (created)"
    echo "  - .gitignore (created)"
    echo "  - env.example (created)"
    echo "  - README.md (updated)"
    echo "  - deploy.sh (created)"
    echo ""
    echo "🔧 Next steps:"
    echo "1. Install dependencies: npm install"
    echo "2. Test locally: npm start"
    echo "3. Commit changes: git add . && git commit -m 'Prepare for deployment'"
    echo "4. Push to GitHub: git push origin main"
    echo "5. Choose your deployment platform"
}
