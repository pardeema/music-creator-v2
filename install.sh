#!/bin/bash

# Music Creator Installation Script
# This script sets up the development environment for Music Creator

echo "🎵 Music Creator - Installation Script"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js (v16 or higher) first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version 16 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not available. Please install npm."
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check for yt-dlp
if ! command -v yt-dlp &> /dev/null; then
    echo "⚠️  yt-dlp is not installed. Installing..."
    
    # Try different installation methods based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install yt-dlp
        else
            echo "❌ Homebrew not found. Please install yt-dlp manually:"
            echo "   pip install yt-dlp"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt &> /dev/null; then
            sudo apt update && sudo apt install yt-dlp
        elif command -v yum &> /dev/null; then
            sudo yum install yt-dlp
        else
            echo "❌ Package manager not found. Please install yt-dlp manually:"
            echo "   pip install yt-dlp"
        fi
    else
        echo "❌ Unsupported OS. Please install yt-dlp manually:"
        echo "   pip install yt-dlp"
    fi
else
    echo "✅ yt-dlp is already installed"
fi

# Check for ffmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  ffmpeg is not installed. Installing..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install ffmpeg
        else
            echo "❌ Homebrew not found. Please install ffmpeg manually:"
            echo "   Visit: https://ffmpeg.org/download.html"
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v apt &> /dev/null; then
            sudo apt update && sudo apt install ffmpeg
        elif command -v yum &> /dev/null; then
            sudo yum install ffmpeg
        else
            echo "❌ Package manager not found. Please install ffmpeg manually:"
            echo "   Visit: https://ffmpeg.org/download.html"
        fi
    else
        echo "❌ Unsupported OS. Please install ffmpeg manually:"
        echo "   Visit: https://ffmpeg.org/download.html"
    fi
else
    echo "✅ ffmpeg is already installed"
fi

# Create binaries directory
mkdir -p binaries

echo ""
echo "🎉 Installation complete!"
echo ""
echo "To start the application in development mode:"
echo "  npm run dev"
echo ""
echo "To build for production:"
echo "  npm run build"
echo "  npm run dist"
echo ""
echo "For more information, see README.md"

