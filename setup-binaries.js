const fs = require('fs');
const path = require('path');
const https = require('https');

const isDarwin = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

console.log('🔧 Setting up yt-dlp binaries for cross-platform support...');

// Define what we need for each platform
const binaries = {
  darwin: [
    { name: 'yt-dlp-downloads', url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos' },
    { name: 'yt-dlp-fetch', url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos' }
  ],
  win32: [
    { name: 'yt-dlp-downloads.exe', url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' },
    { name: 'yt-dlp-fetch.exe', url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' }
  ]
};

function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading ${filename}...`);

    const file = fs.createWriteStream(filename);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        file.close();
        fs.unlinkSync(filename);
        return downloadFile(response.headers.location, filename).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(filename);
        return reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();

        // Make executable on Unix systems
        if (!isWindows) {
          fs.chmodSync(filename, 0o755);
        }

        console.log(`✅ Downloaded ${filename}`);
        resolve();
      });

      file.on('error', (err) => {
        file.close();
        fs.unlinkSync(filename);
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
      }
      reject(err);
    });
  });
}

async function setupBinaries() {
  try {
    const platformBinaries = binaries[process.platform];

    if (!platformBinaries) {
      console.log(`⚠️  No binaries defined for platform: ${process.platform}`);
      return;
    }

    console.log(`🎯 Setting up binaries for ${process.platform}...`);

    for (const binary of platformBinaries) {
      if (fs.existsSync(binary.name)) {
        console.log(`⏭️  ${binary.name} already exists, skipping...`);
        continue;
      }

      await downloadFile(binary.url, binary.name);
    }

    console.log('🎉 All binaries setup complete!');
    console.log('💡 You can now commit these binaries to your repo for others to use.');
    console.log('   Run: git add yt-dlp* && git commit -m "Add platform binaries"');

  } catch (error) {
    console.error('❌ Error setting up binaries:', error.message);
    process.exit(1);
  }
}

setupBinaries();