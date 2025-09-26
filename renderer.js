// --- Tab switching ---
const tabDL = document.getElementById("tab-downloader");
const tabVideoTools = document.getElementById("tab-video-tools");
const tabImageTools = document.getElementById("tab-image-tools");
const tabWM = document.getElementById("tab-watermark");
const tabCustom = document.getElementById("tab-customization");
const viewDL = document.getElementById("downloader");
const viewVideoTools = document.getElementById("video-tools");
const viewImageTools = document.getElementById("image-tools");
const viewWM = document.getElementById("watermark");
const viewCustom = document.getElementById("customization");

// Helper function to switch tabs
function switchTab(activeTab, activeView) {
  // Remove active from all tabs
  [tabDL, tabVideoTools, tabImageTools, tabWM, tabCustom].forEach(tab => tab?.classList.remove("active"));
  [viewDL, viewVideoTools, viewImageTools, viewWM, viewCustom].forEach(view => view?.classList.remove("active"));

  // Add active to selected tab and view
  activeTab.classList.add("active");
  activeView.classList.add("active");
}

// Updated sidebar navigation
const sidebar = document.getElementById('sidebar');
const items = Array.from(sidebar.querySelectorAll('.menu-item'));

function setActive(btn) {
  items.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Switch to corresponding view
  const tabId = btn.getAttribute('data-tab');
  const view = document.getElementById(tabId);
  if (view) {
    [viewDL, viewVideoTools, viewImageTools, viewWM, viewCustom].forEach(v => v?.classList.remove("active"));
    view.classList.add("active");
  }
}

// Initialize first item if none
const current = sidebar.querySelector('.menu-item.active') || items[0];
if (current) setActive(current);

items.forEach(btn => btn.addEventListener('click', () => setActive(btn)));

// --- Node bits ---
const { spawn } = require("child_process");
const { ipcRenderer } = require("electron");
const path = require("path");
const fs = require("fs");

// Cross-platform binary paths - fallback to local binaries for now
const isWindows = process.platform === 'win32';
const ffmpegBinary = isWindows ? 'ffmpeg.exe' : 'ffmpeg';
const ytdlpBinary = isWindows ? 'yt-dlp.exe' : 'yt-dlp';

// Try to use npm packages, fallback to local binaries
let ffmpegPath, ytdlpPath, ytdlpFetchPath;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (e) {
  ffmpegPath = path.join(__dirname, ffmpegBinary);
}

try {
  const ytdlpWrap = require('yt-dlp-wrap');
  // Create an instance to get the binary path
  const ytdlpInstance = new ytdlpWrap.YtDlpWrap();
  ytdlpPath = ytdlpInstance.getBinaryPath();

  // Verify the path is valid
  if (!ytdlpPath || typeof ytdlpPath !== 'string') {
    throw new Error('Invalid yt-dlp path');
  }
} catch (e) {
  console.error('yt-dlp-wrap failed:', e);
  // Fallback to local binaries with hybrid approach
  ytdlpPath = isWindows ? 'yt-dlp-downloads.exe' : 'yt-dlp-downloads'; // Old version for downloads
  ytdlpFetchPath = isWindows ? 'yt-dlp-fetch.exe' : 'yt-dlp-fetch'; // New version for fast fetch
}

// Debug: Log the resolved paths
console.log('Binary paths resolved:');
console.log('ffmpeg:', ffmpegPath);
console.log('yt-dlp (downloads):', ytdlpPath);
console.log('yt-dlp (fetch):', ytdlpFetchPath || ytdlpPath);

// --- Downloader: smart format picking ---
const dlBtn = document.getElementById("btn-download");
const dlLog = document.getElementById("dl-log");
const dlProg = document.getElementById("dl-progress");
const dlSpinner = document.getElementById("download-spinner");

// Spinner references for converter sections
const cvSpinner = document.getElementById("convert-spinner");
const imgSpinner = document.getElementById("convert-img-spinner");
const wmSpinner = document.getElementById("watermark-spinner");

function buildYtDlpArgs(url, fmt, quality, outdir) {
  // Strategy:
  //  - Always prefer separate best video+audio, then merge to MP4 when user chooses MP4/MOV
  //  - Use yt-dlp sort (-S) for "smart" selection based on user's quality/format
  //  - For MP3: use extract-audio pipeline
  const args = [url];

  // Output template (put inside chosen folder)
  if (outdir && outdir.trim()) {
    args.push("-o", path.join(outdir, "%(title)s.%(ext)s"));
  }

  // Map UI → yt-dlp rules
  const wantAudioOnly = quality === "audio" || fmt === "mp3";
  const wantMP4 = fmt === "mp4" || fmt === "mov";
  const wantWEBM = fmt === "webm";

  // Base selection: prefer best streams by resolution then codec/container
  // Examples:
  //  - For MP4: prefer H.264 (avc) + m4a (widest compatibility)
  //  - For WEBM: prefer VP9/AV1 + webm
  //  - For audio: m4a (or best)
  if (wantAudioOnly) {
    args.push("-f", "bestaudio");
    if (fmt === "mp3") {
      args.push("--extract-audio", "--audio-format", "mp3");

      // Map quality to audio bitrate/quality
      let audioQuality;
      switch(quality) {
        case "best": audioQuality = "0"; break;        // Best quality (VBR 220-260 kbps)
        case "high": audioQuality = "2"; break;        // High quality (VBR 190-250 kbps)
        case "good": audioQuality = "4"; break;        // Good quality (VBR 140-185 kbps)
        case "standard": audioQuality = "6"; break;    // Standard quality (VBR 120-165 kbps)
        case "low": audioQuality = "9"; break;         // Low quality (VBR 85-115 kbps)
        default: audioQuality = "0"; break;            // Default to best
      }

      args.push("--audio-quality", audioQuality);
    }
  } else {
    // Quality hint - support all YouTube resolutions
    let resPref;
    switch(quality) {
      case "2160": resPref = "res:2160"; break;  // 4K
      case "1440": resPref = "res:1440"; break;  // 2K
      case "1080": resPref = "res:1080"; break;  // Full HD
      case "720":  resPref = "res:720"; break;   // HD
      case "480":  resPref = "res:480"; break;
      case "360":  resPref = "res:360"; break;
      case "240":  resPref = "res:240"; break;
      case "144":  resPref = "res:144"; break;
      default:     resPref = "res:1080"; break;  // Default to 1080p
    }

    if (wantMP4) {
      args.push("-S", `${resPref},codec:avc:m4a`);
      // Prefer best video+audio and merge to MP4
      args.push("-f", "bv*+ba/b");
      args.push("--merge-output-format", "mp4");
    } else if (wantWEBM) {
      args.push("-S", `${resPref},ext:webm`);
      args.push("-f", "bv*+ba/b");
      // Merge will naturally choose webm when possible
    } else {
      // Default fallback (container-agnostic)
      args.push("-S", `${resPref},vcodec,acodec,ext`);
      args.push("-f", "bv*+ba/b");
    }
  }

  return args;
}

dlBtn.onclick = async () => {
  const url = document.getElementById("yt-url").value.trim();
  const fmt = document.getElementById("dl-format").value;
  const quality = document.getElementById("dl-quality").value;
  const outdir = document.getElementById("dl-outdir").value.trim();

  if (!url) {
    dlLog.textContent = "Please enter a URL";
    return;
  }

  dlLog.textContent = "";
  dlProg.value = 0;
  dlSpinner.style.display = 'block'; // Show spinner

  try {
    const args = buildYtDlpArgs(url, fmt, quality, outdir);
    dlLog.textContent += `yt-dlp ${args.join(" ")}\n\n`;

    const ytdlp = spawn(ytdlpPath, args, { windowsHide: true });

    ytdlp.stdout.on("data", (data) => {
      const output = data.toString();
      dlLog.textContent += output;

      // Parse progress from yt-dlp output
      const progressMatch = output.match(/(\d+(?:\.\d+)?)%/);
      if (progressMatch) {
        dlProg.value = parseFloat(progressMatch[1]);
      }
    });

    ytdlp.stderr.on("data", (data) => {
      dlLog.textContent += data.toString();
    });

    ytdlp.on("close", (code) => {
      dlSpinner.style.display = 'none'; // Hide spinner
      dlLog.textContent += `\nyt-dlp exited with code ${code}\n`;
      if (code === 0) {
        dlProg.value = 100;
        showToast('Download completed successfully! ✅');
      } else {
        showToast('Download failed ❌', 'error');
      }
    });

    ytdlp.on("error", (err) => {
      dlSpinner.style.display = 'none'; // Hide spinner on error
      dlLog.textContent += `\nERROR: ${err}\n`;
    });

  } catch (e) {
    dlSpinner.style.display = 'none'; // Hide spinner on exception
    dlLog.textContent += `\nException: ${e}\n`;
  }
};

// --- Toast notifications ---
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);

  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 100);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => container.removeChild(toast), 300);
  }, 4000);
}

// --- Folder browser (Converter) ---
const browseBtn = document.getElementById('btn-browse-folder');
const outdirInput = document.getElementById('cv-outdir');

browseBtn.onclick = async () => {
  try {
    const result = await ipcRenderer.invoke('show-folder-dialog');

    if (!result.canceled && result.filePaths.length > 0) {
      outdirInput.value = result.filePaths[0];
    }
  } catch (err) {
    showToast('Failed to open folder dialog', 'error');
  }
};

// --- Folder browser (Downloader) ---
const browseDlBtn = document.getElementById('btn-browse-dl-folder');
const dlOutdirInput = document.getElementById('dl-outdir');

browseDlBtn.onclick = async () => {
  try {
    const result = await ipcRenderer.invoke('show-folder-dialog');

    if (!result.canceled && result.filePaths.length > 0) {
      dlOutdirInput.value = result.filePaths[0];
    }
  } catch (err) {
    showToast('Failed to open folder dialog', 'error');
  }
};

// --- Dynamic quality options based on format ---
const dlFormatSelect = document.getElementById('dl-format');
const dlQualitySelect = document.getElementById('dl-quality');

function updateQualityOptions() {
  const format = dlFormatSelect.value;
  const isAudio = format === 'mp3';

  // Clear current options
  dlQualitySelect.innerHTML = '';

  if (isAudio) {
    // Audio quality options (bitrates)
    const audioOptions = [
      { value: 'best', text: 'Best (320kbps)' },
      { value: 'high', text: 'High (256kbps)' },
      { value: 'good', text: 'Good (192kbps)' },
      { value: 'standard', text: 'Standard (128kbps)' },
      { value: 'low', text: 'Low (96kbps)' }
    ];

    audioOptions.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.text;
      dlQualitySelect.appendChild(opt);
    });
  } else {
    // Video quality options (resolutions)
    const videoOptions = [
      { value: '2160', text: '4K (2160p)' },
      { value: '1440', text: '2K (1440p)' },
      { value: '1080', text: '1080p (Full HD)' },
      { value: '720', text: '720p (HD)' },
      { value: '480', text: '480p' },
      { value: '360', text: '360p' },
      { value: '240', text: '240p' },
      { value: '144', text: '144p' }
    ];

    videoOptions.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.text;
      dlQualitySelect.appendChild(opt);
    });
  }
}

// Initialize quality options and listen for format changes
dlFormatSelect.addEventListener('change', updateQualityOptions);
updateQualityOptions(); // Set initial options

// --- YouTube Thumbnail and Info Fetching ---
const btnFetchInfo = document.getElementById('btn-fetch-info');
const btnPaste = document.getElementById('btn-paste');
const btnClearUrl = document.getElementById('btn-clear-url');
const fetchSpinner = document.getElementById('fetch-spinner');
const dlPreview = document.getElementById('dl-preview');
const ytUrlInput = document.getElementById('yt-url');

btnFetchInfo.onclick = async () => {
  const url = document.getElementById("yt-url").value.trim();

  if (!url) {
    showToast('Please enter a YouTube URL first', 'error');
    return;
  }

  btnFetchInfo.disabled = true;
  btnFetchInfo.textContent = 'Fetching...';
  fetchSpinner.style.display = 'block'; // Show spinner

  try {
    // Ultra-minimal fast fetch - only the 3 fields we need, no format scanning
    // Use the fast fetch version (new yt-dlp) for info retrieval
    const fetchPath = ytdlpFetchPath || ytdlpPath;
    const ytdlp = spawn(fetchPath, [
      '--no-playlist',
      '--skip-download',
      '--simulate',
      '--print', '%(title)s|%(duration)s|%(thumbnail)s',
      '--no-warnings',
      url
    ], { windowsHide: true });

    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data) => {
      output += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      btnFetchInfo.disabled = false;
      btnFetchInfo.textContent = 'Fetch Info';
      fetchSpinner.style.display = 'none'; // Hide spinner

      if (code === 0) {
        try {
          // Parse pipe-separated output: title|duration|thumbnail
          const line = output.trim().split('\n')[0]; // Take first line
          const parts = line.split('|');

          if (parts.length >= 3) {
            const title = parts[0] || 'Unknown Title';
            const durationSeconds = parseFloat(parts[1]) || 0;
            const thumbnail = parts[2] || '';

            // Convert duration to readable format
            const duration = durationSeconds > 0 ?
              Math.floor(durationSeconds / 60) + ':' + String(Math.floor(durationSeconds % 60)).padStart(2, '0') :
              'Unknown';

            const titleElement = document.getElementById('dl-title');
            titleElement.textContent = title;
            titleElement.title = title; // Add tooltip for full title
            document.getElementById('dl-duration').textContent = `Duration: ${duration}`;
            document.getElementById('dl-thumbnail').src = thumbnail;

            dlPreview.style.display = 'flex';
            showToast('Video info fetched successfully! ✅');
          } else {
            showToast('Invalid video info format received', 'error');
          }
        } catch (parseError) {
          console.error('Parse error:', parseError, 'Output:', output);
          showToast('Failed to parse video info', 'error');
        }
      } else {
        console.error('yt-dlp error:', errorOutput);
        showToast('Failed to fetch video info - check URL', 'error');
      }
    });

  } catch (error) {
    btnFetchInfo.disabled = false;
    btnFetchInfo.textContent = 'Fetch Info';
    fetchSpinner.style.display = 'none'; // Hide spinner on error
    showToast('Error fetching video info', 'error');
  }
};

// --- Paste Button Functionality ---
btnPaste.onclick = async () => {
  try {
    const text = await navigator.clipboard.readText();
    ytUrlInput.value = text.trim();

    // Show clear button if text was pasted
    if (text.trim().length > 0) {
      btnClearUrl.style.display = 'flex';
    }

    showToast('URL pasted successfully! ✅');

    // Auto-focus the input field after pasting
    ytUrlInput.focus();
  } catch (error) {
    console.error('Failed to read clipboard:', error);
    showToast('Failed to paste from clipboard', 'error');

    // Fallback: focus the input so user can paste manually
    ytUrlInput.focus();
  }
};

// --- Clear URL Button Functionality ---
btnClearUrl.onclick = () => {
  ytUrlInput.value = '';
  btnClearUrl.style.display = 'none';
  dlPreview.style.display = 'none'; // Hide preview when clearing
  ytUrlInput.focus();
  showToast('URL cleared', 'success');
};

// Show/hide clear button based on input content
ytUrlInput.addEventListener('input', () => {
  if (ytUrlInput.value.trim().length > 0) {
    btnClearUrl.style.display = 'flex';
  } else {
    btnClearUrl.style.display = 'none';
  }
});

// --- Video File Preview ---
const cvFileInput = document.getElementById('cv-file');
const cvPreview = document.getElementById('cv-preview');

cvFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) {
    cvPreview.style.display = 'none';
    return;
  }

  generateVideoPreview(file, 'cv');
});

// --- Image File Preview ---
const imgFileInput = document.getElementById('img-file');
const imgPreview = document.getElementById('img-preview');

imgFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) {
    imgPreview.style.display = 'none';
    return;
  }

  generateImagePreview(file, 'img');
});

// --- Watermark File Previews ---
const wmFileInput = document.getElementById('wm-file');
const wmSourcePreview = document.getElementById('wm-source-preview');

wmFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) {
    wmSourcePreview.style.display = 'none';
    return;
  }

  if (file.type.startsWith('video/')) {
    generateVideoPreview(file, 'wm-source');
  } else if (file.type.startsWith('image/')) {
    generateImagePreview(file, 'wm-source');
  }
});

const wmImgFileInput = document.getElementById('wm-img-file');
const wmImgPreview = document.getElementById('wm-img-preview');

wmImgFileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) {
    wmImgPreview.style.display = 'none';
    return;
  }

  generateImagePreview(file, 'wm-img');
});

// --- Helper Functions for Preview Generation ---
function generateVideoPreview(file, prefix) {
  const tempThumbPath = path.join(process.cwd(), `temp_thumb_${Date.now()}.jpg`);

  // Extract first frame using FFmpeg
  const args = [
    '-i', file.path,
    '-ss', '00:00:01',
    '-vframes', '1',
    '-y', tempThumbPath
  ];

  const ffmpeg = spawn(ffmpegPath, args, { windowsHide: true });

  ffmpeg.on('close', (code) => {
    if (code === 0) {
      // Display the thumbnail
      document.getElementById(`${prefix}-thumbnail`).src = tempThumbPath;

      // Get file info
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
      const filenameElement = document.getElementById(`${prefix}-filename`);
      filenameElement.textContent = file.name;
      filenameElement.title = file.name; // Add tooltip for full filename
      document.getElementById(`${prefix}-filesize`).textContent = `${fileSizeMB} MB`;

      // Get video duration and resolution
      getVideoInfo(file.path, prefix);

      document.getElementById(`${prefix}-preview`).style.display = 'flex';

      // Clean up temp file after a delay
      setTimeout(() => {
        try {
          fs.unlinkSync(tempThumbPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 5000);
    }
  });
}

function generateImagePreview(file, prefix) {
  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
  const fileSizeKB = (file.size / 1024).toFixed(0);
  const displaySize = file.size > 1024 * 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;

  // Create file URL for preview
  const fileURL = URL.createObjectURL(file);

  const img = new Image();
  img.onload = () => {
    document.getElementById(`${prefix}-thumbnail`).src = fileURL;
    const filenameElement = document.getElementById(`${prefix}-filename`);
    filenameElement.textContent = file.name;
    filenameElement.title = file.name; // Add tooltip for full filename
    document.getElementById(`${prefix}-resolution`).textContent = `${img.width}×${img.height}`;
    document.getElementById(`${prefix}-filesize-display`).textContent = displaySize;

    document.getElementById(`${prefix}-preview`).style.display = 'flex';
  };

  img.src = fileURL;
}

function getVideoInfo(videoPath, prefix) {
  // Get video metadata using FFprobe (part of FFmpeg)
  const args = [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    videoPath
  ];

  // Try ffprobe first, fallback to ffmpeg if not available
  let ffprobePath = ffmpegPath.replace('ffmpeg', 'ffprobe');
  if (isWindows) {
    ffprobePath = ffmpegPath.replace('ffmpeg.exe', 'ffprobe.exe');
  }

  const ffprobe = spawn(ffprobePath, args, { windowsHide: true });

  let output = '';
  ffprobe.stdout.on('data', (data) => {
    output += data.toString();
  });

  ffprobe.on('close', (code) => {
    if (code === 0) {
      try {
        const info = JSON.parse(output);
        const videoStream = info.streams.find(s => s.codec_type === 'video');

        if (videoStream) {
          const duration = parseFloat(info.format.duration);
          const minutes = Math.floor(duration / 60);
          const seconds = Math.floor(duration % 60);
          const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

          document.getElementById(`${prefix}-duration`).textContent = `${durationStr}`;
          document.getElementById(`${prefix}-resolution`).textContent = `${videoStream.width}×${videoStream.height}`;
        }
      } catch (e) {
        // Fallback if JSON parsing fails
        document.getElementById(`${prefix}-duration`).textContent = 'Duration: N/A';
        document.getElementById(`${prefix}-resolution`).textContent = 'Resolution: N/A';
      }
    }
  });
}

// --- Helper function to build video effects filter chain ---
function buildVideoEffectsFilter() {
  const speed = document.getElementById("vid-speed").value;
  const reverse = document.getElementById("vid-reverse").checked;
  const mirror = document.getElementById("vid-mirror").value;
  const rotate = document.getElementById("vid-rotate").value;

  let filters = [];

  // Speed effect (affects timing)
  if (speed !== "1") {
    filters.push(`setpts=${1/parseFloat(speed)}*PTS`);
  }

  // Reverse effect
  if (reverse) {
    filters.push("reverse");
  }

  // Mirror effects
  if (mirror === "hflip") {
    filters.push("hflip");
  } else if (mirror === "vflip") {
    filters.push("vflip");
  }

  // Rotation effects
  if (rotate === "90") {
    filters.push("transpose=1"); // 90° clockwise
  } else if (rotate === "180") {
    filters.push("transpose=2,transpose=2"); // 180°
  } else if (rotate === "270") {
    filters.push("transpose=2"); // 90° counter-clockwise
  }

  return filters;
}

// --- Converter: HQ GIF (palette two-pass) or direct video ---
const cvBtn = document.getElementById("btn-convert");
const cvLog = document.getElementById("cv-log");

cvBtn.onclick = () => {
  cvLog.textContent = "";

  const file = document.getElementById("cv-file").files[0];
  if (!file) return (cvLog.textContent = "Select a video file first.");

  cvSpinner.style.display = 'block'; // Show spinner

  const inPath = file.path;                        // Electron exposes .path
  const outDir = document.getElementById('cv-outdir').value.trim();
  const outBase = document.getElementById("cv-out").value || "output";
  const outFmt = document.getElementById("cv-format").value;
  const ss = document.getElementById("cv-ss").value || "0";
  const to = document.getElementById("cv-to").value || "";
  const fps = Number(document.getElementById("cv-fps").value || "15");
  const width = Number(document.getElementById("cv-width").value || "480");

  // Build output path
  const outputPath = outDir ? path.join(outDir, outBase) : outBase;

  // Get video effects filter chain
  const effectFilters = buildVideoEffectsFilter();
  const baseFilters = [`fps=${fps}`, `scale=${width}:-1:flags=lanczos`];
  const allFilters = [...effectFilters, ...baseFilters];
  const filterString = allFilters.join(',');

  if (outFmt === "gif") {
    // Two-pass palette workflow for high-quality GIF
    const pal = path.join(process.cwd(), "pal.png");

    const genArgs = [
      "-ss", ss, ...(to ? ["-to", to] : []),
      "-i", inPath,
      "-vf", `${filterString},palettegen`,
      "-y", pal
    ];

    const useArgs = [
      "-ss", ss, ...(to ? ["-to", to] : []),
      "-i", inPath, "-i", pal,
      "-lavfi", `${filterString} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5`,
      "-y", `${outputPath}.gif`
    ];

    runFFmpeg(genArgs, () => runFFmpeg(useArgs));
  } else if (outFmt === "mp4") {
    const args = [
      "-ss", ss, ...(to ? ["-to", to] : []),
      "-i", inPath,
      "-vf", filterString,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
      "-y", `${outputPath}.mp4`
    ];
    runFFmpeg(args);
  } else {
    // webm
    const args = [
      "-ss", ss, ...(to ? ["-to", to] : []),
      "-i", inPath,
      "-vf", filterString,
      "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30",
      "-y", `${outputPath}.webm`
    ];
    runFFmpeg(args);
  }
};

function runFFmpeg(args, onClose) {
  cvLog.textContent += `ffmpeg ${args.join(" ")}\n\n`;
  const p = spawn(ffmpegPath, args, { windowsHide: true });

  p.stdout.on("data", d => {
    cvLog.textContent += d.toString();
    cvLog.scrollTop = cvLog.scrollHeight;
  });

  p.stderr.on("data", d => {
    cvLog.textContent += d.toString();
    cvLog.scrollTop = cvLog.scrollHeight;
  });

  p.on("close", code => {
    cvLog.textContent += `\nFFmpeg exited with code ${code}\n`;
    cvLog.scrollTop = cvLog.scrollHeight;

    if (code === 0 && !onClose) {
      // Final conversion completed
      cvSpinner.style.display = 'none'; // Hide spinner on completion
      showToast('Conversion completed successfully! 🎉');
    } else if (code !== 0) {
      cvSpinner.style.display = 'none'; // Hide spinner on failure
      showToast('Conversion failed ❌', 'error');
    }

    if (onClose) onClose();
  });

  p.on("error", (err) => {
    cvSpinner.style.display = 'none'; // Hide spinner on error
    cvLog.textContent += `\nFFmpeg ERROR: ${err}\n`;
    showToast('FFmpeg error occurred ❌', 'error');
  });
}

// --- Image Tools: Universal Image Conversion ---
const imgBtn = document.getElementById('btn-convert-img');
const imgLog = document.getElementById('img-log');
const browseImgBtn = document.getElementById('btn-browse-img-folder');
const imgOutdirInput = document.getElementById('img-outdir');
const imgFormatSelect = document.getElementById('img-format');
const imgSizeSelect = document.getElementById('img-size');
const imgFileSizeSelect = document.getElementById('img-filesize');

browseImgBtn.onclick = async () => {
  try {
    const result = await ipcRenderer.invoke('show-folder-dialog');
    if (!result.canceled && result.filePaths.length > 0) {
      imgOutdirInput.value = result.filePaths[0];
    }
  } catch (err) {
    showToast('Failed to open folder dialog', 'error');
  }
};

// Dynamic size options based on output format
function updateImageSizeOptions() {
  const format = imgFormatSelect.value;
  imgSizeSelect.innerHTML = '';

  let sizeOptions = [];

  if (format === 'ico') {
    // ICO specific sizes for Windows icons/favicons
    sizeOptions = [
      { value: '16', text: '16x16 (favicon)' },
      { value: '32', text: '32x32 (standard)' },
      { value: '48', text: '48x48 (Windows)' },
      { value: '64', text: '64x64 (high-res)' },
      { value: '128', text: '128x128 (retina)' },
      { value: '256', text: '256x256 (large)' }
    ];
  } else if (format === 'icns') {
    // ICNS specific sizes for macOS icons
    sizeOptions = [
      { value: '16', text: '16x16 (small)' },
      { value: '32', text: '32x32 (standard)' },
      { value: '64', text: '64x64 (medium)' },
      { value: '128', text: '128x128 (large)' },
      { value: '256', text: '256x256 (huge)' },
      { value: '512', text: '512x512 (retina)' },
      { value: '1024', text: '1024x1024 (ultra)' }
    ];
  } else {
    // General image sizes for JPEG, PNG, WebP, BMP
    sizeOptions = [
      { value: 'original', text: 'Original Size' },
      { value: '400', text: 'Small (400px)' },
      { value: '800', text: 'Medium (800px)' },
      { value: '1200', text: 'Large (1200px)' },
      { value: '1920', text: 'Full HD (1920px)' }
    ];
  }

  sizeOptions.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.text;
    if (format === 'ico' && option.value === '32') opt.selected = true; // Default ICO size
    if (format === 'icns' && option.value === '128') opt.selected = true; // Default ICNS size
    if (format !== 'ico' && format !== 'icns' && option.value === '800') opt.selected = true; // Default general size
    imgSizeSelect.appendChild(opt);
  });
}

// Dynamic file size options based on output format
function updateImageFileSizeOptions() {
  const format = imgFormatSelect.value;
  imgFileSizeSelect.innerHTML = '';

  let fileSizeOptions = [];

  if (format === 'jpeg' || format === 'webp') {
    // High compression formats
    fileSizeOptions = [
      { value: 'none', text: 'No Limit' },
      { value: '50', text: '50 KB (thumbnail)' },
      { value: '100', text: '100 KB (web)' },
      { value: '250', text: '250 KB (medium)' },
      { value: '500', text: '500 KB (large)' },
      { value: '1000', text: '1 MB (high quality)' },
      { value: '2000', text: '2 MB (very high)' }
    ];
  } else if (format === 'png') {
    // Medium compression
    fileSizeOptions = [
      { value: 'none', text: 'No Limit' },
      { value: '100', text: '100 KB (small)' },
      { value: '500', text: '500 KB (medium)' },
      { value: '1000', text: '1 MB (large)' },
      { value: '2000', text: '2 MB (very large)' },
      { value: '5000', text: '5 MB (maximum)' }
    ];
  } else if (format === 'ico') {
    // Small icon files (Windows)
    fileSizeOptions = [
      { value: 'none', text: 'No Limit' },
      { value: '10', text: '10 KB (tiny)' },
      { value: '25', text: '25 KB (standard)' },
      { value: '50', text: '50 KB (high-res)' },
      { value: '100', text: '100 KB (large)' }
    ];
  } else if (format === 'icns') {
    // macOS icon files (larger due to multiple sizes)
    fileSizeOptions = [
      { value: 'none', text: 'No Limit' },
      { value: '50', text: '50 KB (basic)' },
      { value: '100', text: '100 KB (standard)' },
      { value: '250', text: '250 KB (high-res)' },
      { value: '500', text: '500 KB (retina)' },
      { value: '1000', text: '1 MB (ultra)' }
    ];
  } else if (format === 'bmp') {
    // No compression
    fileSizeOptions = [
      { value: 'none', text: 'No Limit (BMP doesn\'t compress)' }
    ];
  }

  fileSizeOptions.forEach(option => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.text;
    if (option.value === 'none') opt.selected = true; // Default to no limit
    imgFileSizeSelect.appendChild(opt);
  });
}

// Combined update function for both size and file size
function updateImageOptions() {
  updateImageSizeOptions();
  updateImageFileSizeOptions();
}

// Initialize options and listen for format changes
imgFormatSelect.addEventListener('change', updateImageOptions);
// Ensure DOM is ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateImageOptions);
} else {
  updateImageOptions(); // Set initial options
}

// --- Helper function to build image effects filter chain ---
function buildImageEffectsFilter() {
  const mirror = document.getElementById("img-mirror").value;
  const rotate = document.getElementById("img-rotate").value;

  let filters = [];

  // Mirror effects
  if (mirror === "hflip") {
    filters.push("hflip");
  } else if (mirror === "vflip") {
    filters.push("vflip");
  }

  // Rotation effects
  if (rotate === "90") {
    filters.push("transpose=1"); // 90° clockwise
  } else if (rotate === "180") {
    filters.push("transpose=2,transpose=2"); // 180°
  } else if (rotate === "270") {
    filters.push("transpose=2"); // 90° counter-clockwise
  }

  return filters;
}

imgBtn.onclick = () => {
  imgLog.textContent = '';

  const file = document.getElementById('img-file').files[0];
  if (!file) return (imgLog.textContent = 'Select an image file first.');

  imgSpinner.style.display = 'block'; // Show spinner

  const inPath = file.path;
  const outDir = document.getElementById('img-outdir').value.trim();
  const outBase = document.getElementById('img-out').value || 'output';
  const outputFormat = document.getElementById('img-format').value;
  const outputSize = document.getElementById('img-size').value;
  const targetFileSize = document.getElementById('img-filesize').value;

  // Build output path
  const outputPath = outDir ? path.join(outDir, `${outBase}.${outputFormat}`) : `${outBase}.${outputFormat}`;

  let args = ["-i", inPath];

  // Get image effects filter chain
  const effectFilters = buildImageEffectsFilter();
  let allFilters = [...effectFilters];

  // Handle different formats and sizes
  if (outputFormat === 'ico' || outputFormat === 'icns') {
    // Icon formats - square scaling
    allFilters.push(`scale=${outputSize}:${outputSize}`);
  } else if (outputSize !== 'original') {
    // Scale to width, preserve aspect ratio (skip if original size)
    allFilters.push(`scale=${outputSize}:-1`);
  }

  // Apply video filter if we have any filters
  if (allFilters.length > 0) {
    args.push("-vf", allFilters.join(','));
  }

  // Format-specific parameters
  switch (outputFormat) {
    case 'jpeg':
      args.push("-q:v", "2"); // High quality JPEG
      break;
    case 'png':
      args.push("-pix_fmt", "rgba"); // Support transparency
      break;
    case 'webp':
      args.push("-quality", "90"); // High quality WebP
      break;
    case 'bmp':
      // BMP uses default settings
      break;
    case 'ico':
      // ICO uses default settings
      break;
    case 'icns':
      // ICNS for macOS icons - not all FFmpeg builds support ICNS
      // Convert to PNG first, then let the user know about conversion tools
      imgLog.textContent += 'Note: Converting to PNG format (ICNS not supported by this FFmpeg build)\n';
      imgLog.textContent += 'You can convert PNG to ICNS using online tools or iconutil on macOS\n\n';

      // Change output format to PNG for compatibility
      const pngPath = outputPath.replace('.icns', '.png');
      args[args.indexOf(outputPath)] = pngPath;
      break;
  }

  // Apply file size targeting if specified
  if (targetFileSize && targetFileSize !== 'none') {
    const fileSizeKB = parseInt(targetFileSize);
    args.push("-fs", `${fileSizeKB}K`);
  }

  args.push("-y", outputPath);

  imgLog.textContent += `Converting to ${outputFormat.toUpperCase()}...\n`;
  imgLog.textContent += `ffmpeg ${args.join(' ')}\n\n`;

  const p = spawn(ffmpegPath, args, { windowsHide: true });

  p.stdout.on("data", d => {
    imgLog.textContent += d.toString();
    imgLog.scrollTop = imgLog.scrollHeight;
  });

  p.stderr.on("data", d => {
    imgLog.textContent += d.toString();
    imgLog.scrollTop = imgLog.scrollHeight;
  });

  p.on("close", code => {
    imgSpinner.style.display = 'none'; // Hide spinner
    imgLog.textContent += `\nFFmpeg exited with code ${code}\n`;
    imgLog.scrollTop = imgLog.scrollHeight;

    if (code === 0) {
      showToast(`✅ Image converted to ${outputFormat.toUpperCase()} successfully!`);
    } else {
      showToast('❌ Image conversion failed', 'error');
    }
  });

  p.on("error", (err) => {
    imgSpinner.style.display = 'none'; // Hide spinner on error
    imgLog.textContent += `\nFFmpeg ERROR: ${err}\n`;
    showToast('FFmpeg error occurred ❌', 'error');
  });
};

// --- Watermark Tools ---
const wmBtn = document.getElementById('btn-apply-watermark');
const wmLog = document.getElementById('wm-log');
const browseWmBtn = document.getElementById('btn-browse-wm-folder');
const wmOutdirInput = document.getElementById('wm-outdir');
const opacitySlider = document.getElementById('wm-opacity');
const opacityValue = document.getElementById('wm-opacity-value');

// Browse folder for watermark
browseWmBtn.onclick = async () => {
  try {
    const result = await ipcRenderer.invoke('show-folder-dialog');
    if (!result.canceled && result.filePaths.length > 0) {
      wmOutdirInput.value = result.filePaths[0];
    }
  } catch (err) {
    showToast('Failed to open folder dialog', 'error');
  }
};

// Update opacity value display
opacitySlider.oninput = () => {
  opacityValue.textContent = opacitySlider.value + '%';
};

// Toggle watermark type controls
document.querySelectorAll('input[name="wm-type"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const imageControls = document.getElementById('wm-image-controls');
    const textControls = document.getElementById('wm-text-controls');

    if (radio.value === 'image') {
      imageControls.style.display = 'block';
      textControls.style.display = 'none';
    } else {
      imageControls.style.display = 'none';
      textControls.style.display = 'block';
    }
  });
});

wmBtn.onclick = () => {
  wmLog.textContent = '';

  const sourceFile = document.getElementById('wm-file').files[0];
  if (!sourceFile) return (wmLog.textContent = 'Select a source file first.');

  const wmType = document.querySelector('input[name="wm-type"]:checked').value;
  const outDir = document.getElementById('wm-outdir').value.trim();
  const position = document.getElementById('wm-position').value;
  const opacity = parseFloat(document.getElementById('wm-opacity').value) / 100;

  const inPath = sourceFile.path;
  const fileName = path.parse(inPath).name;
  const fileExt = path.parse(inPath).ext;
  const outputPath = outDir ? path.join(outDir, `${fileName}_watermarked${fileExt}`) : `${fileName}_watermarked${fileExt}`;

  wmSpinner.style.display = 'block'; // Show spinner

  let filterComplex = '';

  if (wmType === 'image') {
    const wmImgFile = document.getElementById('wm-img-file').files[0];
    if (!wmImgFile) {
      wmSpinner.style.display = 'none'; // Hide spinner on validation failure
      return (wmLog.textContent = 'Select a watermark image first.');
    }

    const wmImgPath = wmImgFile.path;

    // Position mapping for image watermark
    const positions = {
      'top-left': 'overlay=10:10',
      'top-center': 'overlay=(main_w-overlay_w)/2:10',
      'top-right': 'overlay=main_w-overlay_w-10:10',
      'center-left': 'overlay=10:(main_h-overlay_h)/2',
      'center': 'overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2',
      'center-right': 'overlay=main_w-overlay_w-10:(main_h-overlay_h)/2',
      'bottom-left': 'overlay=10:main_h-overlay_h-10',
      'bottom-center': 'overlay=(main_w-overlay_w)/2:main_h-overlay_h-10',
      'bottom-right': 'overlay=main_w-overlay_w-10:main_h-overlay_h-10'
    };

    // Check if source is GIF - needs special palette handling
    const isGifSource = fileExt.toLowerCase() === '.gif';

    if (isGifSource) {
      // GIF-specific pipeline: overlay + palette generation including watermark
      // Split into two passes to avoid using the same stream twice
      filterComplex = `[0:v]fps=15,scale=480:-1[base];[1:v]scale=iw*0.2:-1[wm];[wm]format=rgba,colorchannelmixer=aa=${opacity}[wmfinal];[base][wmfinal]${positions[position]}[overlaid];[overlaid]split[v1][v2];[v1]palettegen=max_colors=256:stats_mode=diff[p];[v2][p]paletteuse=dither=bayer:bayer_scale=5`;
    } else {
      // Video pipeline: simple overlay (no palette constraints)
      filterComplex = `[0:v][1:v]scale2ref=iw*0.2:-1[main][wm];[wm]format=rgba,colorchannelmixer=aa=${opacity}[wmfinal];[main][wmfinal]${positions[position]}`;
    }

    const args = [
      "-i", inPath,
      "-i", wmImgPath,
      "-filter_complex", filterComplex,
      "-y", outputPath
    ];

    runWatermarkFFmpeg(args);

  } else {
    // Text watermark
    const wmText = document.getElementById('wm-text').value.trim();
    const fontSize = document.getElementById('wm-fontsize').value;

    if (!wmText) {
      wmSpinner.style.display = 'none'; // Hide spinner on validation failure
      return (wmLog.textContent = 'Enter watermark text first.');
    }

    // Position mapping for text watermark
    const positions = {
      'top-left': 'x=10:y=30',
      'top-center': 'x=(w-text_w)/2:y=30',
      'top-right': 'x=w-text_w-10:y=30',
      'center-left': 'x=10:y=(h-text_h)/2',
      'center': 'x=(w-text_w)/2:y=(h-text_h)/2',
      'center-right': 'x=w-text_w-10:y=(h-text_h)/2',
      'bottom-left': 'x=10:y=h-text_h-10',
      'bottom-center': 'x=(w-text_w)/2:y=h-text_h-10',
      'bottom-right': 'x=w-text_w-10:y=h-text_h-10'
    };

    // Check if source is GIF - needs special palette handling
    const isGifSource = fileExt.toLowerCase() === '.gif';

    if (isGifSource) {
      // GIF-specific pipeline: text overlay + palette generation including text
      // Split into two passes to avoid using the same stream twice
      filterComplex = `[0:v]fps=15,scale=480:-1,drawtext=text='${wmText}':fontsize=${fontSize}:fontcolor=white@${opacity}:${positions[position]}[overlaid];[overlaid]split[v1][v2];[v1]palettegen=max_colors=256:stats_mode=diff[p];[v2][p]paletteuse=dither=bayer:bayer_scale=5`;
    } else {
      // Video pipeline: simple text overlay (no palette constraints)
      filterComplex = `drawtext=text='${wmText}':fontsize=${fontSize}:fontcolor=white@${opacity}:${positions[position]}`;
    }

    const args = [
      "-i", inPath,
      "-vf", filterComplex,
      "-y", outputPath
    ];

    runWatermarkFFmpeg(args);
  }
};

function runWatermarkFFmpeg(args) {
  wmLog.textContent += `ffmpeg ${args.join(' ')}\n\n`;
  const p = spawn(ffmpegPath, args, { windowsHide: true });

  p.stdout.on("data", d => {
    wmLog.textContent += d.toString();
    wmLog.scrollTop = wmLog.scrollHeight;
  });

  p.stderr.on("data", d => {
    wmLog.textContent += d.toString();
    wmLog.scrollTop = wmLog.scrollHeight;
  });

  p.on("close", code => {
    wmSpinner.style.display = 'none'; // Hide spinner
    wmLog.textContent += `\nFFmpeg exited with code ${code}\n`;
    wmLog.scrollTop = wmLog.scrollHeight;

    if (code === 0) {
      showToast('Watermark applied successfully! 🎉');
    } else {
      showToast('Watermark application failed ❌', 'error');
    }
  });

  p.on("error", (err) => {
    wmSpinner.style.display = 'none'; // Hide spinner on error
    wmLog.textContent += `\nFFmpeg ERROR: ${err}\n`;
    showToast('FFmpeg error occurred ❌', 'error');
  });
}

// --- Theme Toggle Functionality ---
const themeToggle = document.getElementById('theme-toggle');

// Load saved theme preference or default to dark mode
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
  document.body.classList.add('light-mode');
  themeToggle.checked = true;
}

themeToggle.addEventListener('change', () => {
  if (themeToggle.checked) {
    document.body.classList.add('light-mode');
    localStorage.setItem('theme', 'light');
  } else {
    document.body.classList.remove('light-mode');
    localStorage.setItem('theme', 'dark');
  }
});