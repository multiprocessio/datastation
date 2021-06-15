const electronInstaller = require('electron-winstaller');

(async function() {
  try {
    await electronInstaller.createWindowsInstaller({
      appDirectory: 'build',
      outputDirectory: 'release',
      authors: 'DataStation Authors',
      exe: 'DataStationCommunityEdition.exe'
    });
    console.log('It worked!');
  } catch (e) {
    console.log(`No dice: ${e.message}`);
  }
})()
