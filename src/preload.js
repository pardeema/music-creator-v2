const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectDownloadFolder: () => ipcRenderer.invoke('select-download-folder'),
  processYouTubeLinks: (data) => ipcRenderer.invoke('process-youtube-links', data),
  checkDependencies: () => ipcRenderer.invoke('check-dependencies'),
  savePreferences: (preferences) => ipcRenderer.invoke('save-preferences', preferences),
  loadPreferences: () => ipcRenderer.invoke('load-preferences'),
  
  // Event listeners
  onDownloadProgress: (callback) => {
    ipcRenderer.on('download-progress', callback);
  },
  
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

