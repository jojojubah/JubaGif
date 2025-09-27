const fs = require('fs');
const path = require('path');

// Detect platform and set appropriate paths
const isWindows = process.platform === 'win32';
const isDarwin = process.platform === 'darwin';

// Paths
const sourceDir = __dirname;
let distDir, filesToCopy;

if (isWindows) {
  distDir = path.join(__dirname, 'dist', 'JubaGif-win32-x64', 'JubaGif-win32-x64');
  filesToCopy = ['yt-dlp-downloads.exe', 'yt-dlp-fetch.exe'];
} else if (isDarwin) {
  // Try both possible Mac build outputs
  const arm64Dir = path.join(__dirname, 'dist', 'JubaGif-darwin-arm64', 'JubaGif.app', 'Contents', 'Resources', 'app');
  const x64Dir = path.join(__dirname, 'dist', 'JubaGif-darwin-x64', 'JubaGif.app', 'Contents', 'Resources', 'app');
  const universalDir = path.join(__dirname, 'dist', 'JubaGif-darwin-x64,arm64', 'JubaGif.app', 'Contents', 'Resources', 'app');

  // Find which one exists
  if (fs.existsSync(arm64Dir)) {
    distDir = arm64Dir;
  } else if (fs.existsSync(x64Dir)) {
    distDir = x64Dir;
  } else if (fs.existsSync(universalDir)) {
    distDir = universalDir;
  }

  filesToCopy = ['yt-dlp-downloads', 'yt-dlp-fetch'];
} else {
  console.error('❌ Unsupported platform:', process.platform);
  process.exit(1);
}

console.log('📦 Copying yt-dlp binaries to dist folder...');
console.log('Platform:', process.platform);
console.log('Target directory:', distDir);

// Check if dist folder exists
if (!distDir || !fs.existsSync(distDir)) {
  console.error('❌ Dist folder not found:', distDir);
  console.log('Available directories in dist:');
  const distParent = path.join(__dirname, 'dist');
  if (fs.existsSync(distParent)) {
    fs.readdirSync(distParent).forEach(dir => {
      console.log('  -', dir);
    });
  }
  process.exit(1);
}

// Copy each file
filesToCopy.forEach(file => {
  const sourcePath = path.join(sourceDir, file);
  const destPath = path.join(distDir, file);

  if (fs.existsSync(sourcePath)) {
    try {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Copied ${file}`);
    } catch (error) {
      console.error(`❌ Failed to copy ${file}:`, error.message);
      process.exit(1);
    }
  } else {
    console.warn(`⚠️  Source file not found: ${file}`);
    console.warn(`   Please download the appropriate yt-dlp binary for ${process.platform}`);
    if (isDarwin) {
      console.warn(`   Run: curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o ${file}`);
      console.warn(`   Then: chmod +x ${file}`);
    }
  }
});

console.log('🎉 All binaries copied successfully!');