const fs = require('fs');
const path = require('path');

// Paths
const sourceDir = __dirname;
const distDir = path.join(__dirname, 'dist', 'JubaGif-win32-x64', 'JubaGif-win32-x64');

// Files to copy
const filesToCopy = [
  'yt-dlp-downloads.exe',
  'yt-dlp-fetch.exe'
];

console.log('📦 Copying yt-dlp binaries to dist folder...');

// Check if dist folder exists
if (!fs.existsSync(distDir)) {
  console.error('❌ Dist folder not found:', distDir);
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
    console.error(`❌ Source file not found: ${file}`);
    process.exit(1);
  }
});

console.log('🎉 All binaries copied successfully!');