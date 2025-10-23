const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const archiver = require('archiver');
const Store = require('electron-store');

// Get the path to bundled binaries
const getBinaryPath = (binaryName) => {
  const bundledPath = path.join(process.resourcesPath, 'binaries', binaryName);
  const systemPath = binaryName; // Use system PATH
  
  // Check if bundled binary exists
  if (fs.existsSync(bundledPath)) {
    console.log(`📦 Using bundled ${binaryName}: ${bundledPath}`);
    return bundledPath;
  }
  
  // Fall back to system binary
  console.log(`🔍 Using system ${binaryName}`);
  return systemPath;
};

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

// Check for required dependencies
function checkDependencies() {
  const missing = [];
  
  // Check for yt-dlp (bundled or system)
  const ytdlpPath = getBinaryPath('yt-dlp');
  if (ytdlpPath === 'yt-dlp') {
    // Check if system yt-dlp is available
    try {
      require('child_process').execSync('yt-dlp --version', { stdio: 'ignore' });
    } catch (error) {
      missing.push('yt-dlp');
    }
  }
  
  // Check for ffmpeg (bundled or system)
  const ffmpegPath = getBinaryPath('ffmpeg');
  if (ffmpegPath === 'ffmpeg') {
    // Check if system ffmpeg is available
    try {
      require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' });
    } catch (error) {
      missing.push('ffmpeg');
    }
  }
  
  return missing;
}

// IPC handlers for YouTube processing
ipcMain.handle('check-dependencies', async () => {
  const missing = checkDependencies();
  return { missing, hasAll: missing.length === 0 };
});

// IPC handler for log listening
ipcMain.handle('on-app-log', (event, callback) => {
  // This will be handled by the renderer process
  return true;
});

// Logging system for verbose output
function logToRenderer(level, message, data = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app-log', {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    });
  }
}

// Enhanced logging functions
function logInfo(message, data = null) {
  console.log(`[INFO] ${message}`);
  logToRenderer('info', message, data);
}

function logSuccess(message, data = null) {
  console.log(`[SUCCESS] ${message}`);
  logToRenderer('success', message, data);
}

function logWarning(message, data = null) {
  console.warn(`[WARNING] ${message}`);
  logToRenderer('warning', message, data);
}

function logError(message, data = null) {
  console.error(`[ERROR] ${message}`);
  logToRenderer('error', message, data);
}

function logProcess(step, fileNumber, totalFiles, details = null) {
  const message = `${step} (File ${fileNumber}/${totalFiles})`;
  console.log(`[PROCESS] ${message}`);
  logToRenderer('process', message, { step, fileNumber, totalFiles, details });
}

ipcMain.handle('select-download-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('process-youtube-links', async (event, { links, downloadPath, defaultDuration }) => {
  const results = [];
  const errors = [];
  
  console.log(`🚀 Starting processing of ${links.length} files`);
  
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

      console.log(`🎵 Processing file ${i + 1}/${links.length}: ${link.url}`);
      logProcessStatus('Starting', i + 1, links.length);
      
      // Add timeout for entire file processing
      const fileTimeout = setTimeout(() => {
        console.error(`⏰ File ${i + 1} processing timeout (5 minutes)`);
        throw new Error(`File processing timeout (5 minutes)`);
      }, 5 * 60 * 1000); // 5 minute timeout per file
      
      try {
        const result = await processYouTubeLink(link, downloadPath, i + 1, defaultDuration);
        clearTimeout(fileTimeout);
        results.push(result);
        
        logProcessStatus('Completed', i + 1, links.length);
        console.log(`✅ Completed file ${i + 1}/${links.length}`);
      } catch (fileError) {
        clearTimeout(fileTimeout);
        logProcessStatus('Failed', i + 1, links.length);
        throw fileError;
      }
      
      // Force garbage collection and cleanup between files
      cleanupProcesses();
      
      // Longer delay to prevent resource exhaustion
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      
    } catch (error) {
      console.error(`❌ Error processing file ${i + 1}:`, error.message);
      errors.push({
        link: link.url,
        error: error.message
      });
      
      // Continue with next file even if one fails
      console.log(`⏭️ Continuing with next file...`);
    }
  }

  // Only create zip file for multiple files
  if (results.length > 1) {
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
      console.log(`📁 Files to zip: ${filePaths.length} files`);
      
      // Add timeout for zip creation
      const zipTimeout = setTimeout(() => {
        console.error('⏰ Zip creation timeout (5 minutes)');
        throw new Error('Zip creation timeout (5 minutes)');
      }, 5 * 60 * 1000); // 5 minute timeout
      
      try {
        await createZipFile(filePaths, zipPath);
        clearTimeout(zipTimeout);
        console.log(`✅ Zip created successfully: ${zipFilename}`);
      } catch (zipError) {
        clearTimeout(zipTimeout);
        throw zipError;
      }
      
      // Clean up individual MP3 files after adding to zip
      console.log(`🗑️ Cleaning up individual files...`);
      for (const audioFile of audioFiles) {
        try {
          if (fs.existsSync(audioFile.filePath)) {
            fs.unlinkSync(audioFile.filePath);
            console.log(`🗑️ Cleaned up individual file: ${path.basename(audioFile.filePath)}`);
          }
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
      console.error(`❌ Zip creation failed:`, error.message);
      errors.push({ error: `Failed to create zip: ${error.message}` });
    }
  } else if (results.length === 1) {
    console.log(`📁 Single file - keeping MP3 file directly: ${results[0].filename}`);
  }

  console.log(`🏁 Processing complete. Results: ${results.length}, Errors: ${errors.length}`);
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
  
  // Convert youtu.be links to youtube.com format and clean problematic parameters
  const convertedUrl = convertYouTubeUrl(url);
  const processedUrl = cleanYouTubeUrl(convertedUrl);
  
  // Get video info first with fallback
  logProcessStatus('Getting video info', order, '?');
  let videoInfo;
  try {
    videoInfo = await getVideoInfo(processedUrl);
  } catch (error) {
    console.warn(`⚠️ Failed to get video info: ${error.message}`);
    console.log(`🔄 Using fallback title generation`);
    // Fallback to a generic title if video info fails
    videoInfo = {
      title: `Audio_Clip_${order}`,
      duration: 0,
      uploader: 'Unknown'
    };
  }
  
  // If video info failed, we can still proceed with download
  if (videoInfo.title === `Audio_Clip_${order}`) {
    console.log(`⚠️ Proceeding without video metadata - using generic filename`);
  }
  
  const safeTitle = videoInfo.title.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  const filename = `${order.toString().padStart(2, '0')}_${safeTitle}.mp3`;
  const outputPath = path.join(downloadPath, filename);
  
  // Download and process audio
  logProcessStatus('Downloading audio', order, '?');
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

function cleanYouTubeUrl(url) {
  try {
    const urlObj = new URL(url);
    
    // Remove problematic query parameters that cause yt-dlp to hang
    const problematicParams = [
      'list',           // Playlist parameter
      'start_radio',    // Radio feature parameter
      'index',          // Playlist index
      'feature',        // YouTube features
      'ab_channel',     // Channel attribution
      'si'              // Session info
    ];
    
    // Remove problematic parameters
    problematicParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Keep only essential parameters
    const essentialParams = ['v', 't', 'time'];
    const cleanedParams = new URLSearchParams();
    
    essentialParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        cleanedParams.set(param, urlObj.searchParams.get(param));
      }
    });
    
    // Rebuild URL with only essential parameters
    const cleanedUrl = `${urlObj.origin}${urlObj.pathname}?${cleanedParams.toString()}`;
    
    console.log(`🧹 Cleaned URL: ${url} -> ${cleanedUrl}`);
    return cleanedUrl;
    
  } catch (error) {
    console.warn(`⚠️ Failed to clean URL: ${error.message}`);
    return url; // Return original URL if cleaning fails
  }
}

async function getVideoInfo(url) {
  return new Promise((resolve, reject) => {
    console.log(`🔍 Getting video info for: ${url}`);
    logInfo(`Getting video info for: ${url}`);
    const ytdlp = spawn(getBinaryPath('yt-dlp'), [
      '--dump-json',
      '--no-warnings',
      '--no-check-certificate',
      '--socket-timeout', '30',
      '--retries', '1',
      '--quiet',
      url
    ]);
    let output = '';
    
    // Add timeout for video info retrieval
    const infoTimeout = setTimeout(() => {
      console.error('⏰ Video info timeout - killing process');
      ytdlp.kill('SIGKILL');
      reject(new Error('Video info retrieval timeout (30 seconds)'));
    }, 30 * 1000); // 30 second timeout - much more aggressive
    
    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ytdlp.stderr.on('data', (data) => {
      console.log(`yt-dlp info stderr: ${data}`);
    });
    
    ytdlp.on('error', (error) => {
      clearTimeout(infoTimeout);
      console.error('❌ yt-dlp info error:', error.message);
      reject(new Error('yt-dlp info retrieval failed'));
    });
    
    ytdlp.on('close', (code) => {
      clearTimeout(infoTimeout);
      console.log(`yt-dlp info exit code: ${code}`);
      if (code === 0) {
        try {
          const info = JSON.parse(output);
          console.log(`✅ Video info retrieved: ${info.title}`);
          logSuccess(`Video info retrieved: ${info.title}`);
          resolve({
            title: info.title,
            duration: info.duration,
            uploader: info.uploader
          });
        } catch (error) {
          console.error('❌ Failed to parse video info JSON:', error.message);
          reject(new Error('Failed to parse video info'));
        }
      } else {
        console.error(`❌ yt-dlp info failed with code: ${code}`);
        reject(new Error('Failed to get video info'));
      }
    });
  });
}

async function downloadAndProcessAudio(url, outputPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    console.log(`🎵 Starting audio download for: ${url}`);
    logInfo(`Starting audio download for: ${url}`);
    console.log(`📁 Output path: ${outputPath}`);
    logInfo(`Output path: ${outputPath}`);
    console.log(`⏰ Start time: ${startTime}s, Duration: ${duration}s`);
    logInfo(`Start time: ${startTime}s, Duration: ${duration}s`);
    
    // Download audio with yt-dlp
    const tempPath = outputPath.replace('.mp3', '_temp.mp3');
    console.log(`📥 Temp file: ${tempPath}`);
    logInfo(`Temp file: ${tempPath}`);
    
    const ytdlpDownload = spawn(getBinaryPath('yt-dlp'), [
      '--extract-audio',
      '--audio-format', 'mp3',
      '--output', tempPath,
      '--no-warnings',
      '--no-check-certificate',
      '--socket-timeout', '30',
      '--retries', '1',
      '--quiet',
      url
    ]);
    
    // Add timeout for yt-dlp process
    const ytdlpTimeout = setTimeout(() => {
      console.error('⏰ yt-dlp timeout - killing process');
      ytdlpDownload.kill('SIGKILL');
      reject(new Error('yt-dlp download timeout (2 minutes)'));
    }, 2 * 60 * 1000); // 2 minute timeout for audio-only extraction
    
    // Handle spawn errors
    ytdlpDownload.on('error', (error) => {
      clearTimeout(ytdlpTimeout);
      console.error('❌ yt-dlp not found:', error.message);
      reject(new Error('yt-dlp is not available. Please ensure the application is properly installed and try again. If the issue persists, please reinstall Music Creator.'));
    });
    
    // Log yt-dlp output for debugging
    ytdlpDownload.stdout.on('data', (data) => {
      console.log(`yt-dlp stdout: ${data}`);
    });
    
    ytdlpDownload.stderr.on('data', (data) => {
      console.log(`yt-dlp stderr: ${data}`);
    });
    
    ytdlpDownload.on('close', (code) => {
      clearTimeout(ytdlpTimeout);
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
              logSuccess(`Audio processing completed: ${outputPath}`);
              resolve();
            })
            .catch(reject);
        });
      } else {
        console.error(`❌ yt-dlp failed with code: ${code}`);
        logError(`yt-dlp failed with code: ${code}`);
        reject(new Error(`Failed to download audio (exit code: ${code})`));
      }
    });
  });
}

async function processAudioWithFfmpeg(inputPath, outputPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    console.log(`🎬 Starting ffmpeg processing:`);
    logInfo(`Starting ffmpeg processing`);
    console.log(`📥 Input: ${inputPath}`);
    logInfo(`Input: ${inputPath}`);
    console.log(`📤 Output: ${outputPath}`);
    logInfo(`Output: ${outputPath}`);
    console.log(`⏰ Start: ${startTime}s, Duration: ${duration}s`);
    logInfo(`Start: ${startTime}s, Duration: ${duration}s`);
    
    // Skip the probe step to avoid hanging - go directly to processing
    processAudioSegment();
    
    function processAudioSegment() {
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
      
      const extract = spawn(getBinaryPath('ffmpeg'), extractArgs);
      
      // Add timeout for extract process
      const extractTimeout = setTimeout(() => {
        console.error('⏰ Extract timeout - killing process');
        extract.kill('SIGKILL');
        reject(new Error('ffmpeg extract timeout (2 minutes)'));
      }, 2 * 60 * 1000); // 2 minute timeout
      
      extract.stderr.on('data', (data) => {
        console.log(`extract stderr: ${data}`);
      });
      
      extract.on('close', (extractCode) => {
        clearTimeout(extractTimeout);
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
          
          const fade = spawn(getBinaryPath('ffmpeg'), fadeArgs);
          
          // Add timeout for fade process
          const fadeTimeout = setTimeout(() => {
            console.error('⏰ Fade timeout - killing process');
            fade.kill('SIGKILL');
            // Clean up temp segment
            try {
              fs.unlinkSync(tempSegmentPath);
            } catch (error) {
              console.log(`⚠️ Could not delete temp segment: ${error.message}`);
            }
            reject(new Error('ffmpeg fade timeout (2 minutes)'));
          }, 2 * 60 * 1000); // 2 minute timeout
          
          fade.stderr.on('data', (data) => {
            console.log(`fade stderr: ${data}`);
          });
          
          fade.on('close', (fadeCode) => {
            clearTimeout(fadeTimeout);
            // Clean up temp segment immediately
            try {
              fs.unlinkSync(tempSegmentPath);
              console.log(`🗑️ Cleaned up temp segment: ${path.basename(tempSegmentPath)}`);
            } catch (error) {
              console.log(`⚠️ Could not delete temp segment: ${error.message}`);
            }
            
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
    }
  });
}

async function createZipFile(filePaths, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    let addedFiles = 0;
    const totalFiles = filePaths.length;
    
    output.on('close', () => {
      console.log(`✅ Zip file created: ${archive.pointer()} bytes`);
      resolve();
    });
    
    archive.on('error', (err) => {
      console.error(`❌ Archive error:`, err);
      reject(err);
    });
    
    archive.on('entry', (entry) => {
      addedFiles++;
      console.log(`📁 Added to zip: ${entry.name} (${addedFiles}/${totalFiles})`);
    });
    
    archive.pipe(output);
    
    // Add files to archive
    filePaths.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        archive.file(filePath, { name: path.basename(filePath) });
      } else {
        console.warn(`⚠️ File not found: ${filePath}`);
      }
    });
    
    archive.finalize();
  });
}

// Process cleanup utility
function cleanupProcesses() {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Log memory usage
  const memUsage = process.memoryUsage();
  console.log(`🧠 Memory usage: RSS=${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap=${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
}

// Process monitoring utility
function logProcessStatus(step, fileNumber, totalFiles) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 📊 Process Status: ${step} (File ${fileNumber}/${totalFiles})`);
  logProcess(step, fileNumber, totalFiles);
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

