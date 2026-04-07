/**
 * WeSplit Desktop — Electron Preload Script
 *
 * Safely exposes a minimal API to the renderer (web app) via contextBridge.
 * The web app can check window.electronAPI.isElectron to know it's running in Electron.
 */

const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  version: process.versions.electron,
});
