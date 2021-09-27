const { preview } = require('preview');
const { getProjectResultsFile } = require('../store');
const { shape } = require('shape');
const fs = require('fs/promises');
const { file: makeTmpFile } = require('tmp-promise');
const {
  evalColumnsHandler,
  storeLiteralHandler,
  fetchResultsHandler,
} = require('./columns');

test('store and retrieve literal, specific columns', async () => {
  const tmp = await makeTmpFile();

  const testData = [
    { a: 1, b: 'hey' },
    { a: 19, b: 'no no' },
  ];

  const id = 'my-uuid';

  try {
    const result = await storeLiteralHandler.handler(tmp.path, null, {
      id,
      value: testData,
    });
    expect(result.size).toBe(JSON.stringify(testData).length);
    expect(result.preview).toStrictEqual(preview(testData));
    expect(result.shape).toStrictEqual(shape(testData));
    expect(result.value).toBe(null);
    expect(result.stdout).toBe('');
    expect(result.contentType).toBe('application/json');

    const { value: valueFromDisk } = await fetchResultsHandler.handler(
      tmp.path,
      null,
      {
        id,
      }
    );
    expect(valueFromDisk).toStrictEqual(testData);

    const { value: selectColumns } = await evalColumnsHandler.handler(
      tmp.path,
      null,
      {
        id,
        panelSource: id,
        columns: ['a'],
      }
    );
    expect(selectColumns).toStrictEqual([{ a: 1 }, { a: 19 }]);
  } finally {
    await tmp.cleanup();
    try {
      // Results file
      await fs.unlink(getProjectResultsFile(tmp.path) + id);
    } catch (e) {
      console.error(e); // don't fail on failure to cleanup, means an earlier step is going to fail after finally block
    }
  }
});
