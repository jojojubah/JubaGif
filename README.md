# JubaGif — YouTube Downloader + Video to GIF Converter

on first run Mac/Windows may warn because the app isn’t code-signed yet, it’s safe, just not signed.) 
Enjoy ;)

## What it is
A desktop app that (1) downloads YouTube videos with **smart format/quality selection** using yt-dlp, and (2) converts local videos/images with **high-quality GIF** support using ffmpeg's palette workflow. (3) Add custom watermark to any video/image.

## Why
- Private offline processing
- Clean modern UI (Electron + HTML/CSS/JS)
- Great defaults: MP4 compatibility (H.264 + m4a), and GIFs that look like Ezgif or better

## Features
### Downloader
- Paste URL, choose **Format** (MP4/WEBM/MOV/MP3) and **Quality** (1080p, 720p, audio-only)
- **Smart format picking** via yt-dlp `-S` rules and `bv*+ba/b` with `--merge-output-format` for cross-player compatibility

### Converter
- Load any local video
- Trim: `-ss` / `-to`
- FPS + Width controls, aspect preserved
- **HQ GIF preset**: two-pass `palettegen` → `paletteuse` with bayer dithering
- Export: GIF / MP4 / WebM

## Dev Quickstart
```bash
npm install
npm start
```

## Build (Windows .exe)
```bash
npm run build
```

## File Structure
```
JubaGif/
│
├─ package.json
├─ main.js
├─ index.html            # Two tabs: Downloader | Converter
├─ style.css
├─ renderer.js
├─ README.md
├─ ffmpeg.exe            # Local ffmpeg binary
└─ yt-dlp.exe           # Local yt-dlp binary
```

## Dependencies
- **Electron**: Desktop app framework
- **electron-packager**: For building executables
- **Local binaries**: ffmpeg.exe and yt-dlp.exe included directly

## Usage

### Downloader Tab
1. Paste a YouTube URL
2. Select your preferred format (MP4, WEBM, MOV, MP3)
3. Choose quality (1080p, 720p, or audio-only)
4. Set output directory (optional)
5. Click Download

### Converter Tab
1. Select a local video/image file
2. Set start/end times for trimming (optional)
3. Adjust FPS and width as needed
4. Choose output format (GIF uses HQ palette, MP4/WebM for video)
5. Click Convert

## Technical Notes
- Uses local binaries for reliability and no network dependencies
- GIF conversion uses ffmpeg's two-pass palette generation for optimal quality
- Smart format selection prioritizes compatibility and quality
- Progress tracking for downloads and conversions

## Roadmap

- (Later) aria2c acceleration
- (Later) Split-Chapters, SponsorBlock toggles
- (Later) Installer via electron-builder
- (Later) Presets (Discord 8MB, Twitter 4MB)

## QA Checklist

**Downloader:**
- MP4/1080p, MP4/720p, MP3 (audio-only), WEBM/1080p test a few URLs
- Verify merged MP4 plays in Windows Movies & TV/VLC

**Converter:**
- Short trims, FPS 10/15/24, width 360/480/720
- Compare GIF quality vs direct one-pass (our preset should look better, smaller)
## Releases
- Build per platform when you are ready to ship:
  - On Windows: `npm run build:win` (outputs to `dist/`)
  - On macOS: `npm run build:mac` or `npm run build:mac-universal`
- Collect the generated installers from `dist/`; do not commit them.
- Draft a GitHub release at https://github.com/jojojubah/JubaGif/releases/new, attach the Windows `.exe` and macOS `.dmg`/`.app`, and publish it.
- Point users to the latest release downloads via https://github.com/jojojubah/JubaGif/releases/latest.
