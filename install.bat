@echo off
REM Music Creator Installation Script for Windows
REM This script sets up the development environment for Music Creator

echo 🎵 Music Creator - Installation Script
echo ======================================

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed. Please install Node.js (v16 or higher) first.
    echo    Visit: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js detected

REM Check if npm is available
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm is not available. Please install npm.
    pause
    exit /b 1
)

echo ✅ npm detected

REM Install dependencies
echo 📦 Installing dependencies...
npm install

if %errorlevel% neq 0 (
    echo ❌ Failed to install dependencies
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

REM Check for yt-dlp
yt-dlp --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  yt-dlp is not installed. Please install it manually:
    echo    pip install yt-dlp
    echo    Or download from: https://github.com/yt-dlp/yt-dlp/releases
) else (
    echo ✅ yt-dlp is already installed
)

REM Check for ffmpeg
ffmpeg -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  ffmpeg is not installed. Please install it manually:
    echo    Visit: https://ffmpeg.org/download.html
    echo    Or use chocolatey: choco install ffmpeg
) else (
    echo ✅ ffmpeg is already installed
)

REM Create binaries directory
if not exist "binaries" mkdir binaries

echo.
echo 🎉 Installation complete!
echo.
echo To start the application in development mode:
echo   npm run dev
echo.
echo To build for production:
echo   npm run build
echo   npm run dist
echo.
echo For more information, see README.md
pause

