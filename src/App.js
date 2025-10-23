import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [links, setLinks] = useState([]);
  const [downloadPath, setDownloadPath] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, status: '' });
  const [results, setResults] = useState([]);
  const [errors, setErrors] = useState([]);
  const [preferences, setPreferences] = useState({});
  const [dependencies, setDependencies] = useState({ missing: [], hasAll: true });

  useEffect(() => {
    loadUserPreferences();
    checkDependencies();
  }, []);

  const checkDependencies = async () => {
    try {
      const deps = await window.electronAPI.checkDependencies();
      setDependencies(deps);
    } catch (error) {
      console.error('Failed to check dependencies:', error);
    }
  };

  const loadUserPreferences = async () => {
    try {
      const prefs = await window.electronAPI.loadPreferences();
      setPreferences(prefs);
      setDownloadPath(prefs.downloadPath || '');
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
  };

  const saveUserPreferences = async (newPrefs) => {
    try {
      await window.electronAPI.savePreferences(newPrefs);
      setPreferences(newPrefs);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  };

  const addLink = () => {
    setLinks([...links, { url: '', startTime: '', duration: 15 }]);
  };

  const updateLink = (index, field, value) => {
    const updatedLinks = [...links];
    updatedLinks[index][field] = value;
    
    // If updating URL, parse timestamp and convert youtu.be URLs
    if (field === 'url') {
      const parsedData = parseYouTubeUrl(value);
      if (parsedData.startTime) {
        updatedLinks[index].startTime = parsedData.startTime;
      }
      if (parsedData.convertedUrl) {
        updatedLinks[index].url = parsedData.convertedUrl;
      }
    }
    
    setLinks(updatedLinks);
  };

  const parseYouTubeUrl = (url) => {
    if (!url) return { startTime: null, convertedUrl: null };
    
    let convertedUrl = url;
    let startTime = null;
    
    // Convert youtu.be to youtube.com
    if (url.includes('youtu.be/')) {
      const match = url.match(/youtu\.be\/([^?&]+)(\?.*)?/);
      if (match) {
        const videoId = match[1];
        const params = match[2] || '';
        convertedUrl = `https://www.youtube.com/watch?v=${videoId}${params}`;
      }
    }
    
    // Parse timestamp from URL parameters
    const urlObj = new URL(convertedUrl);
    const tParam = urlObj.searchParams.get('t');
    const timeParam = urlObj.searchParams.get('time');
    
    if (tParam) {
      startTime = parseTimestamp(tParam);
    } else if (timeParam) {
      startTime = parseTimestamp(timeParam);
    }
    
    return { startTime, convertedUrl: convertedUrl !== url ? convertedUrl : null };
  };

  const parseTimestamp = (timestamp) => {
    if (!timestamp) return null;
    
    // Handle different timestamp formats
    if (timestamp.includes(':')) {
      return timestamp; // Already in MM:SS or H:MM:SS format
    }
    
    // Convert seconds to MM:SS if it's a number
    const seconds = parseInt(timestamp);
    if (!isNaN(seconds)) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return timestamp;
  };

  const removeLink = (index) => {
    const updatedLinks = links.filter((_, i) => i !== index);
    setLinks(updatedLinks);
  };

  const selectDownloadFolder = async () => {
    try {
      const folder = await window.electronAPI.selectDownloadFolder();
      if (folder) {
        setDownloadPath(folder);
        saveUserPreferences({ ...preferences, downloadPath: folder });
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  const processLinks = async () => {
    if (!downloadPath) {
      alert('Please select a download folder first');
      return;
    }

    if (links.length === 0) {
      alert('Please add at least one YouTube link');
      return;
    }

    setIsProcessing(true);
    setResults([]);
    setErrors([]);

    // Set up progress listener
    window.electronAPI.onDownloadProgress((event, progressData) => {
      setProgress(progressData);
    });

    try {
      const response = await window.electronAPI.processYouTubeLinks({
        links,
        downloadPath,
        defaultDuration: 15
      });

      setResults(response.results);
      setErrors(response.errors);
    } catch (error) {
      setErrors([{ error: `Processing failed: ${error.message}` }]);
    } finally {
      setIsProcessing(false);
      window.electronAPI.removeAllListeners('download-progress');
    }
  };

  const parseTimeInput = (timeStr) => {
    if (!timeStr) return '';
    
    // Handle different time formats
    if (timeStr.includes(':')) {
      return timeStr; // Already in MM:SS or H:MM:SS format
    }
    
    // Convert seconds to MM:SS if it's a number
    const seconds = parseInt(timeStr);
    if (!isNaN(seconds)) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    
    return timeStr;
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <img src="./logo.png" alt="Music Creator" className="app-logo" />
          <div className="header-text">
            <h1>Music Creator</h1>
            <p>Extract audio clips from YouTube videos for trivia content</p>
          </div>
        </div>
      </header>
      
      {!dependencies.hasAll && (
        <div className="dependency-warning">
          <div className="warning-content">
            <h3>⚠️ Missing Dependencies</h3>
            <p>The following required tools are not installed:</p>
            <ul>
              {dependencies.missing.map(dep => (
                <li key={dep}>
                  <strong>{dep}</strong> - 
                  {dep === 'yt-dlp' && ' This should be included with the app. Please reinstall Music Creator.'}
                  {dep === 'ffmpeg' && ' This should be included with the app. Please reinstall Music Creator.'}
                </li>
              ))}
            </ul>
            <p>Both yt-dlp and ffmpeg should be included with this app. If you're seeing this error, please reinstall Music Creator.</p>
            <div className="installation-instructions">
              <h4>Alternative Installation:</h4>
              <p>If the bundled tools don't work, you can install them manually:</p>
              <p><strong>ffmpeg:</strong> <code>brew install ffmpeg</code></p>
              <p><strong>yt-dlp:</strong> <code>pip install yt-dlp</code></p>
            </div>
          </div>
        </div>
      )}
      
      <main className="App-main">
        {/* Download Path Selection */}
        <section className="section">
          <h2>Download Location</h2>
          <div className="path-selector">
            <input
              type="text"
              value={downloadPath}
              placeholder="Select download folder..."
              readOnly
              className="path-input"
            />
            <button onClick={selectDownloadFolder} className="select-button">
              Choose Folder
            </button>
          </div>
        </section>


        {/* YouTube Links */}
        <section className="section">
          <div className="links-header">
            <h2>YouTube Links</h2>
            <button onClick={addLink} className="add-button">
              + Add Link
            </button>
          </div>

          {links.length === 0 && (
            <div className="empty-state">
              <p>No links added yet. Click "Add Link" to get started.</p>
            </div>
          )}

          {links.map((link, index) => (
            <div key={index} className="link-item">
              <div className="link-inputs">
                <input
                  type="url"
                  placeholder="YouTube URL (timestamps auto-detected)"
                  value={link.url}
                  onChange={(e) => updateLink(index, 'url', e.target.value)}
                  className="url-input"
                />
                <input
                  type="text"
                  placeholder="Start time (auto-filled from URL)"
                  value={link.startTime}
                  onChange={(e) => updateLink(index, 'startTime', e.target.value)}
                  className="time-input"
                />
                <input
                  type="number"
                  min="1"
                  value={link.duration}
                  onChange={(e) => updateLink(index, 'duration', parseInt(e.target.value) || 15)}
                  className="duration-input"
                />
                <span className="duration-label">sec</span>
                <button
                  onClick={() => removeLink(index)}
                  className="remove-button"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* Process Button */}
        <section className="section">
          <button
            onClick={processLinks}
            disabled={isProcessing || links.length === 0 || !downloadPath || !dependencies.hasAll}
            className="process-button"
          >
            {isProcessing ? 'Processing...' : 'Process Links'}
          </button>
        </section>

        {/* Progress */}
        {isProcessing && (
          <section className="section">
            <h3>Progress</h3>
            <div className="progress-container">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
              <p className="progress-text">
                {progress.status} ({progress.current}/{progress.total})
              </p>
            </div>
          </section>
        )}

        {/* Results */}
        {results.length > 0 && (
          <section className="section">
            <h3>Downloaded Files</h3>
            <div className="results-list">
              {results.map((result, index) => (
                <div key={index} className="result-item">
                  <span className="result-icon">
                    {result.type === 'zip' ? '📦' : '🎵'}
                  </span>
                  <span className="result-filename">{result.filename}</span>
                  {result.type === 'audio' && (
                    <span className="result-duration">
                      {result.duration}s clip from {Math.floor(result.startTime / 60)}:{(result.startTime % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <section className="section">
            <h3>Errors</h3>
            <div className="errors-list">
              {errors.map((error, index) => (
                <div key={index} className="error-item">
                  <span className="error-icon">⚠️</span>
                  <div className="error-content">
                    {error.link && <p className="error-link">{error.link}</p>}
                    <p className="error-message">{error.error}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;

