const { getProjectResultsFile } = require('@datastation/desktop/store');
const { shape } = require('shape');
const { preview } = require('preview');
const fs = require('fs');
const { file: makeTmpFile } = require('tmp-promise');
const {
  ProjectState,
  ProjectPage,
  LiteralPanelInfo,
  TablePanelInfo,
} = require('@datastation/shared/state');
const { makeEvalHandler } = require('./eval');
const { fetchResultsHandler } = require('./columns');

test('store and retrieve literal, specific columns', async () => {
  const tmp = await makeTmpFile({ prefix: 'columns-project-' });

  const testData = [
    { a: 1, b: 'hey' },
    { a: 19, b: 'no no' },
  ];

  const id = 'my-uuid';

  try {
    const projectState = {
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
              // For the fetchResults call
              resultMeta: {
                contentType: 'application/json',
              },
            },
          ],
        },
      ],
    };
    const result = await makeEvalHandler().handler(
      tmp.path,
      { panelId: id },
      () => projectState
    );
    expect(result.size).toStrictEqual(JSON.stringify(testData).length);
    expect(result.shape).toStrictEqual(shape(testData));
    expect(result.preview).toStrictEqual(preview(testData));
    expect(result.contentType).toBe('application/json');

    const { value: valueFromDisk } = await fetchResultsHandler.handler(
      tmp.path,
      {
        panelId: id,
      },
      () => projectState
    );
    expect(valueFromDisk).toStrictEqual(testData);

    const { value: selectColumns } = await makeEvalHandler().handler(
      tmp.path,
      { panelId: id },
      ({ resource }) =>
        resource === 'fetchResults'
          ? { ...result, value: valueFromDisk }
          : {
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
                        columns: [{ field: 'a' }],
                      },
                    },
                  ],
                },
              ],
            }
    );
    expect(selectColumns).toStrictEqual([{ a: 1 }, { a: 19 }]);
  } finally {
    try {
      // Results file
      await tmp.cleanup();
      fs.unlinkSync(getProjectResultsFile(tmp.path) + id);
    } catch (e) {
      console.error(e); // don't fail on failure to cleanup, means an earlier step is going to fail after finally block
    }
  }
});
