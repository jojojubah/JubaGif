# JubaGif Custom App Icons Setup

## Step 1: Copy Your Icon Files

Please copy your custom icon files to the JubaGif project directory:

### Copy Commands (run these in Command Prompt):
```cmd
copy "C:\Users\jubah\Pictures\AppIcon.ico" "C:\Users\jubah\Documents\JubaGif\icon.ico"
copy "C:\Users\jubah\Pictures\AppIcon.icns" "C:\Users\jubah\Documents\JubaGif\icon.icns"
```

### Or manually:
1. Copy `C:\Users\jubah\Pictures\AppIcon.ico`
2. Paste to `C:\Users\jubah\Documents\JubaGif\icon.ico`
3. Copy `C:\Users\jubah\Pictures\AppIcon.icns`
4. Paste to `C:\Users\jubah\Documents\JubaGif\icon.icns`

## Step 2: Restart the App

After copying the files:
1. Close the current JubaGif app
2. Run `npm start` again
3. The app will now use your custom icons!

## What Changes:
- **Development Mode**: Custom icon in taskbar/window title
- **Windows Build**: `npm run build:win` will use icon.ico
- **macOS Build**: `npm run build:mac` will use icon.icns

The main.js file is already configured to use these icon files automatically.