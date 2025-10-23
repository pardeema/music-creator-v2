const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const archiver = require('archiver');
const Store = require('electron-store');

// Initialize store for user preferences
const store = new Store();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  // Load the React app
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Check for required dependencies (simplified, non-blocking)
function checkDependencies() {
  // For now, just return that all dependencies are available
  // The actual error handling will happen when trying to use the tools
  return [];
}

// IPC handlers for YouTube processing
ipcMain.handle('check-dependencies', async () => {
  const missing = checkDependencies();
  return { missing, hasAll: missing.length === 0 };
});

ipcMain.handle('select-download-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('process-youtube-links', async (event, { links, downloadPath, defaultDuration }) => {
  const results = [];
  const errors = [];
  
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    try {
      // Send progress update
      event.sender.send('download-progress', {
        current: i + 1,
        total: links.length,
        status: `Processing link ${i + 1}/${links.length}`,
        link: link.url
      });

      const result = await processYouTubeLink(link, downloadPath, i + 1, defaultDuration);
      results.push(result);
    } catch (error) {
      errors.push({
        link: link.url,
        error: error.message
      });
    }
  }

  // Always create zip file and clean up individual files
  if (results.length > 0) {
    try {
      // Generate timestamped zip filename
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
      const zipFilename = `music_clips_${timestamp}.zip`;
      const zipPath = path.join(downloadPath, zipFilename);
      
      // Get all audio file paths for the zip
      const audioFiles = results.filter(r => r.type === 'audio');
      const filePaths = audioFiles.map(r => r.filePath);
      
      console.log(`📦 Creating zip file: ${zipFilename}`);
      await createZipFile(filePaths, zipPath);
      
      // Clean up individual MP3 files after adding to zip
      for (const audioFile of audioFiles) {
        try {
          fs.unlinkSync(audioFile.filePath);
          console.log(`🗑️ Cleaned up individual file: ${path.basename(audioFile.filePath)}`);
        } catch (error) {
          console.error(`⚠️ Failed to delete ${audioFile.filePath}:`, error.message);
        }
      }
      
      // Return only the zip file in results
      return { 
        results: [{ type: 'zip', filePath: zipPath, filename: zipFilename }], 
        errors 
      };
    } catch (error) {
      errors.push({ error: `Failed to create zip: ${error.message}` });
    }
  }

  return { results, errors };
});

async function processYouTubeLink(linkData, downloadPath, order, defaultDuration) {
  const { url, startTime, duration } = linkData;
  
  console.log(`🔍 Link data:`, { url, startTime, duration, defaultDuration });
  
  // Parse start time
  const startSeconds = parseTimeToSeconds(startTime);
  const clipDuration = duration || defaultDuration;
  
  console.log(`⏰ Parsed start time: "${startTime}" -> ${startSeconds} seconds`);
  console.log(`⏱️ Clip duration: ${clipDuration} seconds`);
  
  // Convert youtu.be links to youtube.com format
  const processedUrl = convertYouTubeUrl(url);
  
  // Get video info first
  const videoInfo = await getVideoInfo(processedUrl);
  const safeTitle = videoInfo.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const filename = `${order.toString().padStart(2, '0')}_${safeTitle}.mp3`;
  const outputPath = path.join(downloadPath, filename);
  
  // Download and process audio
  await downloadAndProcessAudio(processedUrl, outputPath, startSeconds, clipDuration);
  
  return {
    type: 'audio',
    filePath: outputPath,
    filename: filename,
    title: videoInfo.title,
    duration: clipDuration,
    startTime: startSeconds
  };
}

function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  
  // Handle different time formats
  if (timeStr.includes(':')) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) {
      // MM:SS format
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // H:MM:SS format
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
  }
  
  // Assume seconds if it's just a number
  return parseInt(timeStr) || 0;
}

function convertYouTubeUrl(url) {
  // Convert youtu.be links to youtube.com format
  if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([^?&]+)(\?.*)?/);
    if (match) {
      const videoId = match[1];
      const params = match[2] || '';
      return `https://www.youtube.com/watch?v=${videoId}${params}`;
    }
  }
  return url;
}

async function getVideoInfo(url) {
  return new Promise((resolve, reject) => {
    const ytdlp = spawn('yt-dlp', ['--dump-json', url]);
    let output = '';
    
    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ytdlp.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(output);
          resolve({
            title: info.title,
            duration: info.duration,
            uploader: info.uploader
          });
        } catch (error) {
          reject(new Error('Failed to parse video info'));
        }
      } else {
        reject(new Error('Failed to get video info'));
      }
    });
  });
}

async function downloadAndProcessAudio(url, outputPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    console.log(`🎵 Starting audio download for: ${url}`);
    console.log(`📁 Output path: ${outputPath}`);
    console.log(`⏰ Start time: ${startTime}s, Duration: ${duration}s`);
    
    // Download audio with yt-dlp
    const tempPath = outputPath.replace('.mp3', '_temp.mp3');
    console.log(`📥 Temp file: ${tempPath}`);
    
    const ytdlpDownload = spawn('yt-dlp', [
      '--extract-audio',
      '--audio-format', 'mp3',
      '--output', tempPath,
      '--verbose', // Add verbose logging
      url
    ]);
    
    // Handle spawn errors
    ytdlpDownload.on('error', (error) => {
      console.error('❌ yt-dlp not found:', error.message);
      reject(new Error('yt-dlp is not installed. Please install yt-dlp to use this feature. Visit: https://github.com/yt-dlp/yt-dlp'));
    });
    
    // Log yt-dlp output for debugging
      ytdlpDownload.stdout.on('data', (data) => {
        console.log(`yt-dlp stdout: ${data}`);
      });
      
      ytdlpDownload.stderr.on('data', (data) => {
        console.log(`yt-dlp stderr: ${data}`);
      });
      
      ytdlpDownload.on('close', (code) => {
        console.log(`yt-dlp exit code: ${code}`);
        if (code === 0) {
          // Check if temp file exists and has content
          fs.stat(tempPath, (err, stats) => {
            if (err) {
              console.error(`❌ Temp file not found: ${err.message}`);
              reject(new Error('Temp file not created'));
              return;
            }
            console.log(`✅ Temp file size: ${stats.size} bytes`);
            
            if (stats.size === 0) {
              console.error(`❌ Temp file is empty`);
              reject(new Error('Downloaded file is empty'));
              return;
            }
            
            // Process with ffmpeg to trim and add fade-out
            processAudioWithFfmpeg(tempPath, outputPath, startTime, duration)
              .then(() => {
                // Clean up temp file
                fs.unlink(tempPath, () => {});
                console.log(`✅ Audio processing completed: ${outputPath}`);
                resolve();
              })
              .catch(reject);
          });
        } else {
          console.error(`❌ yt-dlp failed with code: ${code}`);
          reject(new Error(`Failed to download audio (exit code: ${code})`));
        }
      });
    });
  });
}

async function processAudioWithFfmpeg(inputPath, outputPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    console.log(`🎬 Starting ffmpeg processing:`);
    console.log(`📥 Input: ${inputPath}`);
    console.log(`📤 Output: ${outputPath}`);
    console.log(`⏰ Start: ${startTime}s, Duration: ${duration}s`);
    
    // First, let's check what's at the start time in the original file
    console.log(`🔍 Checking audio content at start time ${startTime}s...`);
    const probeArgs = [
      '-i', inputPath,
      '-ss', startTime.toString(),
      '-t', '5', // Check 5 seconds from start time
      '-af', 'astats=metadata=1:reset=1',
      '-f', 'null',
      '-'
    ];
    
    const probe = spawn('ffmpeg', probeArgs);
    probe.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('lavfi.astats')) {
        console.log(`📊 Audio stats at ${startTime}s:`, output);
      }
    });
    
    probe.on('close', () => {
      // Now do the actual processing
      // Use a more robust approach: first extract the segment, then apply fade
      const tempSegmentPath = outputPath.replace('.mp3', '_segment_temp.mp3');
      
      console.log(`📝 Step 1: Extract segment from ${startTime}s to ${startTime + duration}s`);
      const extractArgs = [
        '-i', inputPath,
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-acodec', 'copy', // Copy without re-encoding for speed
        '-y',
        tempSegmentPath
      ];
      
      console.log(`🔧 Extract command: ffmpeg ${extractArgs.join(' ')}`);
      
      const extract = spawn('ffmpeg', extractArgs);
      
      extract.stderr.on('data', (data) => {
        console.log(`extract stderr: ${data}`);
      });
      
      extract.on('close', (extractCode) => {
        if (extractCode === 0) {
          console.log(`✅ Segment extracted successfully`);
          
          // Step 2: Apply fade effect
          console.log(`📝 Step 2: Apply fade effect`);
          const fadeArgs = [
            '-i', tempSegmentPath,
            '-af', `afade=t=out:st=${duration - 1}:d=1`,
            '-acodec', 'libmp3lame',
            '-b:a', '128k',
            '-y',
            outputPath
          ];
          
          console.log(`🔧 Fade command: ffmpeg ${fadeArgs.join(' ')}`);
          
          const fade = spawn('ffmpeg', fadeArgs);
          
          fade.stderr.on('data', (data) => {
            console.log(`fade stderr: ${data}`);
          });
          
          fade.on('close', (fadeCode) => {
            // Clean up temp segment
            fs.unlink(tempSegmentPath, () => {});
            
            if (fadeCode === 0) {
              console.log(`✅ Fade applied successfully`);
              // Check final output
              fs.stat(outputPath, (err, stats) => {
                if (err) {
                  console.error(`❌ Final output file not found: ${err.message}`);
                  reject(new Error('Final output file not created'));
                  return;
                }
                console.log(`✅ Final output file size: ${stats.size} bytes`);
                
                if (stats.size === 0) {
                  console.error(`❌ Final output file is empty`);
                  reject(new Error('Final processed file is empty'));
                  return;
                }
                
                console.log(`🎉 Two-step audio processing successful!`);
                resolve();
              });
            } else {
              console.error(`❌ Fade processing failed with code: ${fadeCode}`);
              reject(new Error(`Failed to apply fade effect (exit code: ${fadeCode})`));
            }
          });
        } else {
          console.error(`❌ Segment extraction failed with code: ${extractCode}`);
          reject(new Error(`Failed to extract segment (exit code: ${extractCode})`));
        }
      });
    });
  });
}

async function createZipFile(filePaths, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));
    
    archive.pipe(output);
    
    filePaths.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: path.basename(filePath) });
      }
    });
    
    archive.finalize();
  });
}

// Store user preferences
ipcMain.handle('save-preferences', (event, preferences) => {
  store.set('preferences', preferences);
});

ipcMain.handle('load-preferences', () => {
  return store.get('preferences', {
    defaultDuration: 15,
    downloadPath: '',
    lastUsedPath: ''
  });
});

