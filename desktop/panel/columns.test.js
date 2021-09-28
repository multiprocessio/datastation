const { getProjectResultsFile } = require('../store');
const { shape } = require('shape');
const { preview } = require('preview');
const fs = require('fs/promises');
const { file: makeTmpFile } = require('tmp-promise');
const {
  ProjectState,
  ProjectPage,
  LiteralPanelInfo,
  TablePanelInfo,
} = require('../../shared/state');
const { evalHandler } = require('./eval');
const { fetchResultsHandler } = require('./columns');

test('store and retrieve literal, specific columns', async () => {
  const tmp = await makeTmpFile();

  const testData = [
    { a: 1, b: 'hey' },
    { a: 19, b: 'no no' },
  ];

  const id = 'my-uuid';
  const resultsFile = getProjectResultsFile(tmp.path) + id;

  try {
    const result = await evalHandler.handler(tmp.path, { panelId: id }, () => ({
      ...new ProjectState(),
      id: tmp.path,
      pages: [
        {
          ...new ProjectPage(),
          panels: [
            {
              ...new LiteralPanelInfo(),
              id,
              content: JSON.stringify(testData),
              literal: {
                contentTypeInfo: {
                  type: 'application/json',
                },
              },
            },
          ],
        },
      ],
    }));
    expect(result.size).toStrictEqual(JSON.stringify(testData).length);
    expect(result.shape).toStrictEqual(shape(testData));
    expect(result.preview).toStrictEqual(preview(testData));
    expect(result.contentType).toBe('application/json');

    const { value: valueFromDisk } = await fetchResultsHandler(
      { id: tmp.path },
      {
        id,
      }
    );
    expect(valueFromDisk).toStrictEqual(testData);

    const { value: selectColumns } = await evalHandler.handler(
      tmp.path,
      { panelId: id },
      () => ({
        ...new ProjectState(),
        id: tmp.path,
        pages: [
          {
            ...new ProjectPage(),
            panels: [
              {
                ...new TablePanelInfo(),
                id,
                resultMeta: result,
                table: {
                  columns: ['a'],
                },
              },
            ],
          },
        ],
      })
    );
    expect(selectColumns).toStrictEqual([{ a: 1 }, { a: 19 }]);
  } finally {
    try {
      // Results file
      await tmp.cleanup();
      await fs.unlink(resultFile);
    } catch (e) {
      console.error(e); // don't fail on failure to cleanup, means an earlier step is going to fail after finally block
    }
  }
});
