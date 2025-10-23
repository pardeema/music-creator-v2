const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// Create binaries directory
const binariesDir = path.join(__dirname, '..', 'binaries');
if (!fs.existsSync(binariesDir)) {
  fs.mkdirSync(binariesDir, { recursive: true });
}

console.log('📦 Downloading required binaries...');

// Download yt-dlp for macOS
const ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
const ytdlpPath = path.join(binariesDir, 'yt-dlp');

console.log('📥 Downloading yt-dlp...');
try {
  const ytdlpData = await downloadFile(ytdlpUrl);
  fs.writeFileSync(ytdlpPath, ytdlpData);
  fs.chmodSync(ytdlpPath, '755'); // Make executable
  console.log('✅ yt-dlp downloaded successfully');
} catch (error) {
  console.error('❌ Failed to download yt-dlp:', error.message);
}

// For ffmpeg, we'll provide instructions to install via Homebrew
// since it's a large binary and better to use system installation
const ffmpegInstructions = `
# Install ffmpeg via Homebrew
# Run this command in Terminal:
brew install ffmpeg

# Or download from: https://ffmpeg.org/download.html
`;

fs.writeFileSync(path.join(binariesDir, 'README.txt'), ffmpegInstructions);
console.log('📝 Created ffmpeg installation instructions');

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }
      
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

console.log('🎉 Binary download complete!');
