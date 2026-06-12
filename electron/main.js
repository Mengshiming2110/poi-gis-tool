const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'POI 数据采集工具',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL('http://localhost:3001');
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

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
