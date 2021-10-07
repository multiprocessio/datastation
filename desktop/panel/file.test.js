const fs = require('fs');
const { file: makeTmpFile } = require('tmp-promise');
const { evalFile } = require('./file');

test('file handler', async () => {
  const tmp = await makeTmpFile();
  const readFromTmp = await makeTmpFile();

  const testData = { a: 12, b: 'very unique' };
  const testDataJSON = JSON.stringify(testData);

  try {
    fs.writeFileSync(readFromTmp.path, testDataJSON);

    const { contentType, value } = await evalFile(tmp.path, {
      type: 'file',
      file: {
        name: readFromTmp.path,
        contentTypeInfo: {
          type: 'application/json',
        },
        id: 'any',
      },
    });
    expect(contentType).toBe('application/json');
    expect(value).toStrictEqual(testData);
  } finally {
    await tmp.cleanup();
    await readFromTmp.cleanup();
  }
});
