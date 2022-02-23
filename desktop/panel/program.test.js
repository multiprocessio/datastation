const path = require('path');
const { LANGUAGES } = require('../../shared/languages');
const {
  InvalidDependentPanelError,
  NotAnArrayOfObjectsError,
} = require('../../shared/errors');
const { getProjectResultsFile } = require('../store');
const fs = require('fs');
const { LiteralPanelInfo, ProgramPanelInfo } = require('../../shared/state');
const { updateProjectHandler } = require('../store');
const { CODE_ROOT } = require('../constants');
const { makeEvalHandler } = require('./eval');
const { inPath, withSavedPanels, RUNNERS, VERBOSE } = require('./testutil');

const TESTS = [
  {
    type: 'deno',
    content:
      'const prev = DM_getPanel(0); const next = prev.map((row) => ({ ...row, "age": +row.age + 10 })); DM_setPanel(next);',
    condition: true,
  },
  {
    type: 'javascript',
    content:
      'const prev = DM_getPanel(0); const next = prev.map((row) => ({ ...row, "age": +row.age + 10 })); DM_setPanel(next);',
    condition: true,
  },
  {
    type: 'javascript',
    content: `const prev = DM_getPanel('Raw Data'); const next = prev.map((row) => ({ ...row, "age": +row.age + 10 })); DM_setPanel(next);`,
    condition: true,
  },
  {
    type: 'javascript',
    // Explicitly testing no quotes here
    content: `const prev = DM_getPanel(1000)`,
    condition: true,
    exception: InvalidDependentPanelError,
  },
  {
    type: 'javascript',
    // Explicitly test both single and double quotes here
    // Explicitly testing that all calls to DM_getPanel are checked (the first one is valid, the second one is not)
    content: `const prev = DM_getPanel("0"); const next = DM_getPanel('flubberydeedoodad');`,
    condition: true,
    exception: InvalidDependentPanelError,
  },
  {
    type: 'sql',
    content: 'SELECT name, CAST(age AS INT) + 10 AS age FROM DM_getPanel(0)',
    condition: true,
  },
  {
    type: 'sql',
    content: 'SELECT name FROM DM_getPanel("Not Array Data")',
    condition: true,
    exception: NotAnArrayOfObjectsError,
  },
  {
    type: 'sql',
    content: `SELECT name, CAST(age AS INT) + 10 AS age FROM DM_getPanel('Raw Data')`,
    condition: true,
  },
  // Rest are only mandatory-tested on Linux to make CI easier for now
  {
    type: 'python',
    content:
      'prev = DM_getPanel(0)\nnext = [{ **row, "age": int(row["age"]) + 10 } for row in prev]\nDM_setPanel(next)',
    condition: process.platform === 'linux' || inPath('python3'),
  },
  {
    type: 'python',
    content: `prev = DM_getPanel('Raw Data')\nnext = [{ **row, "age": int(row["age"]) + 10 } for row in prev]\nDM_setPanel(next)`,
    condition: process.platform === 'linux' || inPath('python3'),
  },
  {
    type: 'php',
    content: `
$prev = DM_getPanel(0);
$next = [];
foreach ($prev as $row) {
  $row['age'] = intval($row['age'] + 10);
  array_push($next, $row);
}

DM_setPanel($next);`,
    condition: process.platform === 'linux' || inPath('php'),
  },
  {
    type: 'php',
    content: `
$prev = DM_getPanel('Raw Data');
$next = [];
foreach ($prev as $row) {
  $row['age'] = intval($row['age'] + 10);
  array_push($next, $row);
}

DM_setPanel($next);`,
    condition: process.platform === 'linux' || inPath('php'),
  },
  {
    type: 'ruby',
    content:
      'prev = DM_getPanel(0)\npanel = prev.map { |row| { name: row["name"], age: row["age"].to_i + 10 } }\nDM_setPanel(panel)',
    condition: process.platform === 'linux' || inPath('ruby'),
  },
  {
    type: 'ruby',
    content: `prev = DM_getPanel('Raw Data')\npanel = prev.map { |row| { name: row["name"], age: row["age"].to_i + 10 } }\nDM_setPanel(panel)`,
    condition: process.platform === 'linux' || inPath('ruby'),
  },
  {
    type: 'julia',
    content:
      'prev = DM_getPanel(0)\nfor row in prev\n  row["age"] = parse(Int64, row["age"]) + 10\nend\nDM_setPanel(prev)',
    condition: process.platform === 'linux' || inPath('julia'),
  },
  {
    type: 'julia',
    content: `prev = DM_getPanel("Raw Data")\nfor row in prev\n  row["age"] = parse(Int64, row["age"]) + 10\nend\nDM_setPanel(prev)`,
    condition: process.platform === 'linux' || inPath('julia'),
  },
  {
    type: 'r',
    content:
      'prev = DM_getPanel(0)\nfor (i in 1:length(prev)) {\n  prev[[i]]$age = strtoi(prev[[i]]$age) + 10\n}\nDM_setPanel(prev)',
    condition: process.platform === 'linux' || inPath('Rscript'),
  },
  {
    type: 'r',
    content: `prev = DM_getPanel('Raw Data')\nfor (i in 1:length(prev)) {\n  prev[[i]]$age = strtoi(prev[[i]]$age) + 10\n}\nDM_setPanel(prev)`,
    condition: process.platform === 'linux' || inPath('Rscript'),
  },
];

for (const t of TESTS) {
  if (!t.condition) {
    continue;
  }

  describe(t.type + (t.describe ? ': ' + t.describe : ''), () => {
    // First pass runs in process, second pass runs in subprocess
    for (const subprocessName of RUNNERS) {
      if (!subprocessName?.go) {
        continue; // Otherwise not implemented
      }

      test(
        `runs ${t.type} program to perform addition via ${subprocessName.go}` +
          (VERBOSE ? ', program: `' + t.content + '`' : ''),
        async () => {
          try {
            const lp = new LiteralPanelInfo({
              contentTypeInfo: { type: 'text/csv' },
              content: 'age,name\n12,Kev\n18,Nyra',
              name: 'Raw Data',
            });

            // Not valid array data
            const lp2 = new LiteralPanelInfo({
              contentTypeInfo: {},
              content: '',
              name: 'Not Array Data',
            });

            const pp = new ProgramPanelInfo({
              type: t.type,
              content: t.content,
            });

            let finished = false;
            const panels = [lp, lp2, pp];
            await withSavedPanels(
              panels,
              async (project) => {
                const panelValueBuffer = fs.readFileSync(
                  getProjectResultsFile(project.projectName) + pp.id
                );
                expect(JSON.parse(panelValueBuffer.toString())).toStrictEqual([
                  { name: 'Kev', age: 22 },
                  { name: 'Nyra', age: 28 },
                ]);

                finished = true;
              },
              { evalPanels: true, subprocessName, settings: t.settings }
            );

            if (!finished) {
              throw new Error('Callback did not finish');
            }
          } catch (e) {
            if (!t.exception || !(e instanceof t.exception)) {
              throw e;
            }
          }
        },
        300_000
      );

      for (const n of [0, 1]) {
        test(`${t.type} default content ${
          n === 0 ? 'first' : 'second'
        } panel`, async () => {
          const lp = new LiteralPanelInfo();
          lp.literal.contentTypeInfo = { type: 'text/csv' };
          lp.content = 'age,name\n12,Kev\n18,Nyra';

          const pp = new ProgramPanelInfo();
          pp.program.type = t.type;
          pp.content = LANGUAGES[t.type].defaultContent(n);

          let finished = false;
          const panels = [lp, pp];
          await withSavedPanels(
            panels,
            async (project) => {
              const panelValueBuffer = fs.readFileSync(
                getProjectResultsFile(project.projectName) + pp.id
              );
              // defaultContent(0) returns [] and defaultContent(!0) returns the previous panel
              expect(JSON.parse(panelValueBuffer.toString())).toStrictEqual(
                n === 0
                  ? t.type === 'r'
                    ? null
                    : t.type === 'sql'
                    ? [{ NULL: null }]
                    : []
                  : [
                      { name: 'Kev', age: '12' },
                      { name: 'Nyra', age: '18' },
                    ]
              );

              finished = true;
            },
            { evalPanels: true, subprocessName, settings: t.settings }
          );

          if (!finished) {
            throw new Error('Callback did not finish');
          }
          // Otherwise is an expected error.
        }, 300_000);
      }
    }
  });
}

for (const subprocessName of RUNNERS) {
  if (!subprocessName?.go) {
    continue; // Otherwise not implemented
  }

  for (const language of Object.keys(LANGUAGES).filter((f) => f !== 'sql')) {
    describe(`runs ${language} program to fetch panel file name via ${subprocessName.go}`, function () {
      test('it returns its own file name', async () => {
        const pp = new ProgramPanelInfo({
          type: language,
          content: 'DM_setPanel(DM_getPanelFile(0));',
        });

        let finished = false;
        const panels = [pp];
        await withSavedPanels(
          panels,
          async (project) => {
            const fileName = getProjectResultsFile(project.projectName) + pp.id;
            const result = JSON.parse(fs.readFileSync(fileName).toString());
            expect(result).toEqual(fileName.replaceAll('\\', '/'));
            finished = true;
          },
          { evalPanels: true, subprocessName }
        );

        if (!finished) {
          throw new Error('Callback did not finish');
        }
      }, 15_000);
    });
  }

  describe('runs python program with macros', function () {
    test('it handles macros correctly', async () => {
      const lp = new LiteralPanelInfo({
        contentTypeInfo: { type: 'text/csv' },
        content: 'age,name\n12,Kev\n18,Nyra',
        name: 'Raw Data',
      });

      const pp = new ProgramPanelInfo({
        type: 'python',
        content:
          'DM_setPanel("{% for row in DM_getPanel("0") %}{{ row.name }}: {{ row.age }}, {% endfor %}");',
      });

      let finished = false;
      const panels = [lp, pp];
      await withSavedPanels(
        panels,
        async (project) => {
          const fileName = getProjectResultsFile(project.projectName) + pp.id;
          const result = JSON.parse(fs.readFileSync(fileName).toString());
          expect(result).toEqual('Kev: 12, Nyra: 18, ');
          finished = true;
        },
        { evalPanels: true, subprocessName }
      );

      if (!finished) {
        throw new Error('Callback did not finish');
      }
    });
  });

  describe('basic sql tests', function () {
    const lp = new LiteralPanelInfo({
      contentTypeInfo: { type: 'text/csv' },
      content: 'age,name\n12,Kev\n18,Nyra',
      name: 'Raw Data',
    });

    test('it handles table aliases correctly', async () => {
      const pp = new ProgramPanelInfo({
        type: 'sql',
        content:
          'select testt.age from DM_getPanel(0) testt order by testt.age desc',
      });

      let finished = false;
      const panels = [lp, pp];
      await withSavedPanels(
        panels,
        async (project) => {
          const fileName = getProjectResultsFile(project.projectName) + pp.id;
          const result = JSON.parse(fs.readFileSync(fileName).toString());
          expect(result).toStrictEqual([{ age: '18' }, { age: '12' }]);
          finished = true;
        },
        { evalPanels: true, subprocessName }
      );

      if (!finished) {
        throw new Error('Callback did not finish');
      }
    });

    test('it handles regex correctly', async () => {
      const pp = new ProgramPanelInfo({
        type: 'sql',
        content: `select * from DM_getPanel(0) where name regexp 'K[a-zA-Z]*'`,
      });

      let finished = false;
      const panels = [lp, pp];
      await withSavedPanels(
        panels,
        async (project) => {
          const fileName = getProjectResultsFile(project.projectName) + pp.id;
          const result = JSON.parse(fs.readFileSync(fileName).toString());
          expect(result).toStrictEqual([{ name: 'Kev', age: '12' }]);
          finished = true;
        },
        { evalPanels: true, subprocessName }
      );

      if (!finished) {
        throw new Error('Callback did not finish');
      }
    });
  });
}
