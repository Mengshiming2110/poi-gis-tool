const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'POI 数据采集工具',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL('http://localhost:3001');
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// IPC: save downloaded installer and open it
ipcMain.handle('save-and-open-installer', async (_event, bufferBase64, filename) => {
  const tmpDir = path.join(os.tmpdir(), 'poi-gis-tool-update');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, filename);

  const buffer = Buffer.from(bufferBase64, 'base64');
  fs.writeFileSync(filePath, buffer);

  shell.openPath(filePath);
  return { success: true, path: filePath };
});

app.whenReady().then(() => {
  // Start Express server in-process (avoids fork issues in packaged asar)
  require('../server/dist/index.js');

  // Wait for server then open window
  const check = setInterval(() => {
    require('http').get('http://localhost:3001/api/health', () => {
      clearInterval(check);
      createWindow();
    }).on('error', () => {});
  }, 300);
});

app.on('window-all-closed', () => {
  app.quit();
});
