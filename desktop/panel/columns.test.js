const { getProjectResultsFile } = require('../store');
const fs = require('fs/promises');
const { file: makeTmpFile } = require('tmp-promise');
const { evalColumns, evalLiteral, fetchResultsHandler } = require('./columns');

test('store and retrieve literal, specific columns', async () => {
  const tmp = await makeTmpFile();

  const testData = [
    { a: 1, b: 'hey' },
    { a: 19, b: 'no no' },
  ];

  const id = 'my-uuid';

  try {
    const result = await evalLiteral(tmp.path, {
      type: 'literal',
      id,
      content: JSON.stringify(testData),
      literal: {
        contentTypeInfo: {
          type: 'application/json',
        },
      },
    });
    expect(result.value).toStrictEqual(testData);
    expect(result.contentType).toBe('application/json');

    const { value: valueFromDisk } = await fetchResultsHandler(
      { id: tmp.path },
      {
        id,
      }
    );
    expect(valueFromDisk).toStrictEqual(testData);

    const { value: selectColumns } = await evalColumns(tmp.path, {
      type: 'table',
      id,
      table: {
        panelSource: id,
        columns: ['a'],
      },
    });
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
