# Music Creator

A cross-platform desktop application for extracting audio clips from YouTube videos, designed specifically for trivia content creators.

## Features

- **Multiple YouTube Links**: Process multiple YouTube URLs with or without timestamps
- **Flexible Time Input**: Support for seconds (83), MM:SS (1:23), or H:MM:SS (1:23:45) formats
- **Customizable Clip Duration**: 12-25 second clips (default: 15 seconds)
- **Automatic URL Conversion**: Converts youtu.be links to youtube.com format
- **Audio Processing**: MP3 output with 1-second fade-out effect
- **Batch Processing**: Download and process multiple clips in parallel
- **File Management**: Sequential naming (01_Title.mp3, 02_Title.mp3, etc.)
- **ZIP Creation**: Automatically zip multiple files for easy sharing
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Installation

### Prerequisites

- Node.js (v16 or higher)
- yt-dlp
- ffmpeg

### Development Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd music-creator
```

2. Install dependencies:
```bash
npm install
```

3. Install yt-dlp and ffmpeg:
   - **Windows**: Download from official websites or use chocolatey
   - **macOS**: `brew install yt-dlp ffmpeg`
   - **Linux**: `sudo apt install yt-dlp ffmpeg` (Ubuntu/Debian)

4. Run in development mode:
```bash
npm run dev
```

### Building for Production

1. Build the React app:
```bash
npm run build
```

2. Create distributable packages:
```bash
npm run dist
```

The built applications will be in the `dist/` folder.

## Usage

1. **Select Download Folder**: Choose where to save your audio clips
2. **Set Default Duration**: Adjust the default clip length (12-25 seconds)
3. **Add YouTube Links**: 
   - Paste YouTube URLs (with or without timestamps)
   - For links without timestamps, specify start time
   - Adjust individual clip durations as needed
4. **Process**: Click "Process Links" to download and extract audio clips
5. **Download**: Files are saved as MP3 with fade-out effects

## Supported URL Formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://www.youtube.com/watch?v=VIDEO_ID&t=83s`
- `https://youtu.be/VIDEO_ID`
- `https://youtu.be/VIDEO_ID?t=83`

## Time Format Support

- **Seconds**: `83` (83 seconds)
- **MM:SS**: `1:23` (1 minute 23 seconds)
- **H:MM:SS**: `1:23:45` (1 hour 23 minutes 45 seconds)

## File Naming

Files are automatically named with sequential numbers:
- `01_Video_Title.mp3`
- `02_Another_Video.mp3`
- etc.

## Error Handling

The application includes comprehensive error handling:
- Invalid YouTube URLs
- Private or unavailable videos
- Network connectivity issues
- Audio processing errors

All errors are logged and displayed to the user for troubleshooting.

## Technical Details

- **Frontend**: React with modern CSS
- **Backend**: Electron with Node.js
- **Audio Processing**: yt-dlp + ffmpeg
- **Packaging**: Electron Builder
- **Cross-Platform**: Windows, macOS, Linux

## Dependencies

- `yt-dlp`: YouTube video downloading
- `ffmpeg`: Audio processing and conversion
- `archiver`: ZIP file creation
- `electron-store`: User preferences storage

## License

This project is licensed under the MIT License.

## Support

For issues or questions, please check the error logs displayed in the application and provide them when reporting issues.

