import { app, BrowserWindow, ipcMain } from 'electron';

import { APP_NAME, DEBUG } from './constants';
import { DesktopStore } from './DesktopStore';

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: APP_NAME,
  });

  if (!DEBUG) {
    // In addition to removing the menu on Windows/Linux this also disables Chrome devtools.
    win.removeMenu();
  }
  win.loadFile('index.html');

  const store = new DesktopStore();
  store.register();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
