const fs = require('fs/promises');
const { file: makeTmpFile } = require('tmp-promise');
const { evalFileHandler } = require('./file');

test('file handler', async () => {
  const tmp = await makeTmpFile();
  const readFromTmp = await makeTmpFile();

  const testData = { a: 12, b: 'very unique' };
  const testDataJSON = JSON.stringify(testData);

  try {
    await fs.writeFile(readFromTmp.path, testDataJSON);

    const { size, contentType } = await evalFileHandler.handler(
      tmp.path,
      null,
      {
        file: {
          name: readFromTmp.path,
          contentTypeInfo: {
            type: 'application/json',
          },
          id: 'any',
        },
      }
    );
    expect(size).toBe(testDataJSON.length);
    expect(contentType).toBe('application/json');
  } finally {
    await tmp.cleanup();
    await readFromTmp.cleanup();
  }
});
