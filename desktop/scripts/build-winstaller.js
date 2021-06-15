const electronInstaller = require('electron-winstaller');

(async function() {
  try {
    await electronInstaller.createWindowsInstaller({
      appDirectory: 'DataStation Community Edition-win32-x64',
      outputDirectory: 'release',
      authors: 'DataStation Authors',
      exe: 'DataStation Community Edition.exe',
    });
    console.log('It worked!');
  } catch (e) {
    console.log(`No dice: ${e.message}`);
  }
})()
