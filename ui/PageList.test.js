const { makeReevalPanel } = require('./PageList');

const LANGUAGES = [
  {
    type: 'javascript',
    content:
      'const prev = DM_getPanel(0); const next = prev.map((row) => ({ ...row, "age": +row.age + 10 })); DM_setPanel(next);',
  },
  {
    type: 'sql',
    content: 'SELECT name, age::INT + 10 AS age FROM DM_getPanel(0)',
  },
  {
    type: 'python',
    content:
      'prev = DM_getPanel(0)\nnext = [{ **row, "age": int(row["age"]) + 10 } for row in prev]\nDM_setPanel(next)',
  },
];

for (const language of LANGUAGES) {
  test(`eval ${language.type}`, async () => {
    const project = {
      ...new ProjectState(),
      projectName: tmp.path,
      pages: [
	{
          ...new ProjectPage(),
          panels: [
	    new LiteralPanelInfo({ contentTypeInfo: { type: 'text/csv' }, content: 'age,name\n40,Mel\n82,Quan' }),
	    new ProgramPanelInfo({ content: language.content, type: language.type }),
	  ],
	},
      ],
    };

    let finished = false;
    await makeReevalPanel(project.pages[0], project, (page) => {
      expect(page.panels[1].resultMeta.value).toStrictEqual([
	{age: 50, name: 'Mel'},
	{age: 92, name: 'Quan'},
      ]);
      finished = true;
    });

    if (!finished) {
      throw new Error('Test did not complete');
    }
  });
}
