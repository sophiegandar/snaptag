#!/bin/bash

# SnapTag Development Startup Script

echo "🚀 Starting SnapTag Development Environment"
echo "==========================================="

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Creating .env file from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ .env file created. Please edit it with your Dropbox token."
    else
        echo "❌ .env.example not found. Please create .env manually."
    fi
fi

# Check if node_modules exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm run install-all
fi

# Create temp and data directories
mkdir -p temp
mkdir -p server/data

echo ""
echo "🔧 Environment Setup:"
echo "- Server: http://localhost:3001"
echo "- Client: http://localhost:3000"
echo "- Extension: Load ./extension in Chrome Developer Mode"
echo ""

# Check if we're in development mode
if [ "$1" = "dev" ] || [ "$1" = "" ]; then
    echo "🏃 Starting development servers..."
    npm run dev
elif [ "$1" = "build" ]; then
    echo "🔨 Building for production..."
    npm run build
elif [ "$1" = "docker" ]; then
    echo "🐳 Starting with Docker..."
    docker-compose up -d
else
    echo "Usage: ./start.sh [dev|build|docker]"
fi 