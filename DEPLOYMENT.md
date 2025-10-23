# Music Creator - Deployment Guide

## Building Standalone Applications

This guide explains how to build standalone executables for Windows, Mac, and Linux.

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- For Windows builds: Windows 10/11
- For Mac builds: macOS 10.15 or higher
- For Linux builds: Ubuntu 18.04+ or similar

### Build Commands

#### Build for Current Platform
```bash
npm run dist
```

#### Build for Specific Platforms

**Windows (creates .exe installer and portable)**
```bash
npm run dist:win
```

**Mac (creates .dmg and .zip)**
```bash
npm run dist:mac
```

**Linux (creates AppImage and .deb)**
```bash
npm run dist:linux
```

**All Platforms**
```bash
npm run dist:all
```

### Output Files

After building, you'll find the executables in the `dist/` directory:

#### Windows
- `Music Creator Setup 1.0.0.exe` - NSIS installer
- `Music Creator 1.0.0.exe` - Portable executable

#### Mac
- `Music Creator-1.0.0.dmg` - DMG installer
- `Music Creator-1.0.0-mac.zip` - ZIP archive

#### Linux
- `Music Creator-1.0.0.AppImage` - AppImage
- `music-creator_1.0.0_amd64.deb` - Debian package

### Dependencies

The standalone builds include all necessary dependencies:
- Electron runtime
- React application
- Node.js modules
- Native binaries (yt-dlp, ffmpeg)

### System Requirements

#### Windows
- Windows 10 or later
- 100MB free disk space
- Internet connection for YouTube downloads

#### Mac
- macOS 10.15 (Catalina) or later
- 100MB free disk space
- Internet connection for YouTube downloads

#### Linux
- Ubuntu 18.04+ or similar
- 100MB free disk space
- Internet connection for YouTube downloads

### External Dependencies

Users will need to install:
- **yt-dlp**: `pip install yt-dlp` or download from GitHub
- **ffmpeg**: Download from https://ffmpeg.org/download.html

### Code Signing (Optional)

For distribution, consider code signing:

#### Windows
- Obtain a code signing certificate
- Add signing configuration to `package.json`

#### Mac
- Join Apple Developer Program
- Configure code signing in Xcode
- Add certificate to build process

### Distribution

1. Test the builds on target platforms
2. Create installer packages
3. Upload to distribution platforms
4. Provide installation instructions

### Troubleshooting

#### Build Issues
- Ensure all dependencies are installed
- Check Node.js version compatibility
- Verify electron-builder configuration

#### Runtime Issues
- Check external dependencies (yt-dlp, ffmpeg)
- Verify file permissions
- Check system requirements

### Development vs Production

- **Development**: Use `npm run dev` for hot reloading
- **Production**: Use `npm run dist` for optimized builds
- **Testing**: Use `npm run pack` for unpacked builds
