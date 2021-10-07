const {
  ProjectState,
  ProjectPage,
  LiteralPanelInfo,
  ProgramPanelInfo,
} = require('../shared/state');
const { LANGUAGES } = require('../shared/languages');
const { makeReevalPanel } = require('./PageList');

const TESTS = [
  {
    type: 'javascript',
    content:
      'const prev = DM_getPanel(0); const next = prev.map((row) => ({ ...row, "age": +row.age + 10 })); DM_setPanel(next);',
  },
  {
    type: 'sql',
    content: 'SELECT name, age::INT + 10 AS age FROM DM_getPanel(0)',
  },
  // TODO: figure out how to load pyodide in tests
  /* {
   *   type: 'python',
   *   content:
   *     'prev = DM_getPanel(0)\nnext = [{ **row, "age": int(row["age"]) + 10 } for row in prev]\nDM_setPanel(next)',
   * }, */
];

for (const language of TESTS) {
  test(`eval ${language.type}`, async () => {
    const project = {
      ...new ProjectState(),
      pages: [
        {
          ...new ProjectPage(),
          panels: [
            new LiteralPanelInfo({
              contentTypeInfo: { type: 'text/csv' },
              content: 'age,name\n40,Mel\n82,Quan',
            }),
            new ProgramPanelInfo({
              content: language.content,
              type: language.type,
            }),
          ],
        },
      ],
    };

    const reevalPanel = makeReevalPanel(project.pages[0], project, (page) => {
      project.pages[0] = page;
    });
    for (const panel of project.pages[0].panels) {
      await reevalPanel(panel.id);
    }

    expect(project.pages[0].panels[1].resultMeta.value).toStrictEqual([
      { age: 50, name: 'Mel' },
      { age: 92, name: 'Quan' },
    ]);
  });
}
