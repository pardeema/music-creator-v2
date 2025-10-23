// Test script to verify the setup and core functionality
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Music Creator Setup...\n');

// Test 1: Check if yt-dlp is available
console.log('1. Testing yt-dlp availability...');
const ytdlpTest = spawn('yt-dlp', ['--version']);
ytdlpTest.on('close', (code) => {
  if (code === 0) {
    console.log('✅ yt-dlp is available');
  } else {
    console.log('❌ yt-dlp is not available. Please install it first.');
    console.log('   Run: pip install yt-dlp');
  }
});

// Test 2: Check if ffmpeg is available
console.log('2. Testing ffmpeg availability...');
const ffmpegTest = spawn('ffmpeg', ['-version']);
ffmpegTest.on('close', (code) => {
  if (code === 0) {
    console.log('✅ ffmpeg is available');
  } else {
    console.log('❌ ffmpeg is not available. Please install it first.');
    console.log('   macOS: brew install ffmpeg');
    console.log('   Linux: sudo apt install ffmpeg');
    console.log('   Windows: Download from https://ffmpeg.org/');
  }
});

// Test 3: Check Node.js dependencies
console.log('3. Testing Node.js dependencies...');
try {
  require('fluent-ffmpeg');
  require('archiver');
  require('electron-store');
  console.log('✅ All Node.js dependencies are available');
} catch (error) {
  console.log('❌ Missing dependencies:', error.message);
}

// Test 4: Check if main files exist
console.log('4. Testing file structure...');
const requiredFiles = [
  'src/main.js',
  'src/preload.js',
  'src/App.js',
  'src/App.css',
  'package.json'
];

let allFilesExist = true;
requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file} exists`);
  } else {
    console.log(`❌ ${file} missing`);
    allFilesExist = false;
  }
});

if (allFilesExist) {
  console.log('✅ All required files are present');
} else {
  console.log('❌ Some required files are missing');
}

console.log('\n🎵 Setup test complete!');
console.log('If all tests pass, you can run: npm run dev');

