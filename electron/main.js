const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { fork } = require('child_process');

let mainWindow = null;
let serverProcess = null;

function startServer() {
  const serverEntry = path.join(__dirname, '../server/dist/index.js');
  serverProcess = fork(serverEntry, [], {
    env: { ...process.env, PORT: '3001' },
    silent: true,
  });
  serverProcess.stdout.on('data', (d) => console.log('[server]', d.toString().trim()));
  serverProcess.stderr.on('data', (d) => console.error('[server]', d.toString().trim()));

  return new Promise((resolve) => {
    const check = setInterval(() => {
      const http = require('http');
      http.get('http://localhost:3001/api/health', (res) => {
        clearInterval(check);
        resolve();
      }).on('error', () => {});
    }, 300);
  });
}

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

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(async () => {
  console.log('Starting server...');
  await startServer();
  console.log('Server ready, opening window...');
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) serverProcess.kill();
  app.quit();
});

app.on('before-quit', () => {
  if (serverProcess) serverProcess.kill();
});
