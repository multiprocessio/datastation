const { file: makeTmpFile } = require('tmp-promise');
const { Settings, loadSettings } = require('./settings');

test('loadSettings with and without existing settings', async () => {
  const tmp = await makeTmpFile();

  const testSettings = new Settings();
  testSettings.file = tmp.path;

  try {
    const loaded = await loadSettings(tmp.path);
    testSettings.id = loaded.id;
    expect(loaded).toStrictEqual(testSettings);

    loaded.lastProject = 'my new project';
    // Save
    await loaded.getUpdateHandler().handler(null, loaded);
    // And recheck from disk that save happened
    const reloaded = await loadSettings(tmp.path);
    expect(reloaded.lastProject).toBe('my new project');
  } finally {
    await tmp.cleanup();
  }
});
