/**
 * WeSplit Desktop — Electron Main Process
 *
 * Architecture: URL-based (Option A) for MVP.
 * In production: loads https://app.wesplit.xyz so users always get the latest version.
 * In development: loads http://localhost:3000 (Next.js dev server must be running).
 *
 * To run in dev: npm run electron:dev
 * To build:      npm run electron:build
 */

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const isDev = process.env.NODE_ENV === 'development';
const APP_URL = isDev ? 'http://localhost:3000' : 'https://app.wesplit.xyz';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset', // macOS native title bar with traffic lights
    backgroundColor: '#061113',   // WeSplit dark theme background
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '..', 'public', 'icon-app-wesplit.png'),
  });

  win.loadURL(APP_URL);

  if (isDev) {
    win.webContents.openDevTools({ mode: 'detach' });
  }

  // Open external links (Solscan, etc.) in default browser — deny all by default
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Intercept navigations away from our app domain (strict hostname check)
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const parsed = new URL(url);
      const allowedHosts = isDev ? ['localhost'] : ['app.wesplit.xyz'];
      if (!allowedHosts.includes(parsed.hostname)) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  return win;
}

app.whenReady().then(() => {
  createWindow();

  // Re-create window on macOS dock click when no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows closed (except macOS — stays in dock)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
