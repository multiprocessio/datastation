const { shape } = require('shape');
const { preview } = require('preview');
const {
  ProjectState,
  ProjectPage,
  LiteralPanelInfo,
  ProgramPanelInfo,
} = require('../shared/state');
const { LocalStorageStore } = require('./ProjectStore');
const { LANGUAGES } = require('../shared/languages');
const { makeReevalPanel } = require('./PageList');

const TESTS = [
  {
    type: 'javascript',
    content:
      'const prev = DM_getPanel(0); const next = prev.map((row) => ({ ...row, "age": +row.age + 10 })); DM_setPanel(next);',
  },
  // TODO: figure out how to load these dependencies
  // {
  //   type: 'sql',
  //   content: 'SELECT name, age::INT + 10 AS age FROM DM_getPanel(0)',
  // },
  // {
  //   type: 'python',
  //   content:
  //     'prev = DM_getPanel(0)\nnext = [{ **row, "age": int(row["age"]) + 10 } for row in prev]\nDM_setPanel(next)',
  // },
];

for (const language of TESTS) {
  test(`eval ${language.type}`, async () => {
    if (language.inMemoryInit) {
      await language.inMemoryInit();
    }

    const project = {
      ...new ProjectState(),
      pages: [
        {
          ...new ProjectPage(),
          panels: [
            new LiteralPanelInfo(null, {
              contentTypeInfo: { type: 'text/csv' },
              content: 'age,name\n40,Mel\n82,Quan',
            }),
            new ProgramPanelInfo(null, {
              content: language.content,
              type: language.type,
            }),
          ],
        },
      ],
    };

    const before = new Date();
    const store = new LocalStorageStore();
    store.update(project.projectName, project);
    const reevalPanel = makeReevalPanel(project, (panel) => {
      let i = 0;
      for (const p of project.pages[0].panels) {
        if (p.id === panel.id) {
          project.pages[0].panels[i] = panel;
          store.update(project.projectName, project);
          return;
        }
        i++;
      }
    });
    for (const panel of project.pages[0].panels) {
      await reevalPanel(panel.id);
    }

    const expectedResult = [
      { age: 50, name: 'Mel' },
      { age: 92, name: 'Quan' },
    ];
    const resultMetaCopy = { ...project.pages[0].panels[1].resultMeta };
    expect(resultMetaCopy.elapsed).toBeGreaterThanOrEqual(0);
    expect(resultMetaCopy.elapsed).toBeLessThanOrEqual(new Date() - before);
    delete resultMetaCopy.elapsed;
    delete resultMetaCopy.exception;
    expect(resultMetaCopy.lastRun.valueOf()).toBeGreaterThan(before.valueOf());
    expect(resultMetaCopy.lastRun.valueOf()).toBeLessThanOrEqual(
      new Date().valueOf()
    );
    delete resultMetaCopy.lastRun;
    expect(resultMetaCopy).toStrictEqual({
      loading: false,
      shape: shape(expectedResult),
      preview: preview(expectedResult),
      arrayCount: 2,
      value: expectedResult,
      contentType: 'application/json',
      size: 50,
      stdout: '',
    });
  });
}
