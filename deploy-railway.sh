#!/bin/bash

# SnapTag Railway Deployment Script
echo "🚀 Preparing SnapTag for Railway deployment..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Install it first:"
    echo "   npm install -g @railway/cli"
    echo "   railway login"
    exit 1
fi

# Build the client to test locally
echo "🔨 Building client..."
cd client && npm run build
if [ $? -ne 0 ]; then
    echo "❌ Client build failed!"
    exit 1
fi
cd ..

echo "✅ Client build successful!"

# Check environment variables
echo "🔍 Checking environment variables..."
if [ -f ".env" ]; then
    echo "✅ .env file found"
    echo "📋 Environment variables to set in Railway:"
    echo "   (Copy these from railway.env.example to Railway dashboard)"
    echo ""
    cat railway.env.example | grep -E "^[A-Z]" | sed 's/your_[^=]*_here/[SET THIS VALUE]/'
else
    echo "⚠️  No .env file found. Make sure to set environment variables in Railway!"
fi

echo ""
echo "🎯 Next Steps:"
echo "1. Push to GitHub: git add . && git commit -m 'Railway deployment ready' && git push"
echo "2. Go to railway.app and deploy from GitHub"
echo "3. Set environment variables from railway.env.example in Railway dashboard"
echo "4. Wait for deployment to complete"
echo ""
echo "📚 Full guide: See DEPLOYMENT.md for detailed instructions" 