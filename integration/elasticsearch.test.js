const fs = require('fs');

const fetch = require('node-fetch');

const { getProjectResultsFile } = require('../desktop/store');
const { DatabasePanelInfo, DatabaseConnectorInfo } = require('../shared/state');
const { withSavedPanels, RUNNERS } = require('../desktop/panel/testutil');
const { withDocker } = require('./testutil');

describe('elasticsearch testdata/documents tests', () => {
  const tests = [
    {
      query: '',
      range: null,
      results: 4,
    },
    {
      query: 'pageCount:>0',
      range: null,
      results: 3,
    },
    {
      query: 'pageCount:<0',
      range: null,
      results: 0,
    },
    {
      query: 'pageCount:>0',
      range: {
        field: 'publishedDate.$date',
        rangeType: 'absolute',
        begin_date: new Date('2008-01-01'),
        end_date: new Date('2010-01-01'),
      },
      results: 2,
    },
  ];

  let first = true;
  for (const testcase of tests) {
    test(
      testcase.query,
      async () => {
        // It seems to take elasticsearch a while to shut down
        if (!first) {
          await new Promise((r) => setTimeout(r, 5000));
        }
        first = false;

        await withDocker(
          {
            port: 9200,
            env: {
              'discovery.type': 'single-node',
            },
            image: 'docker.elastic.co/elasticsearch/elasticsearch:7.16.3',
            cmdsExternal: true,
            cmds: Array.from(new Array(4)).map(
              (_el, i) =>
                `curl -X POST -H 'Content-Type: application/json' -d @testdata/documents/${
                  i + 1
                }.json http://localhost:9200/test/_doc`
            ),
          },
          async () => {
            const connectors = [
              new DatabaseConnectorInfo({
                type: 'elasticsearch',
              }),
            ];
            const dp = new DatabasePanelInfo();
            dp.database.connectorId = connectors[0].id;
            dp.database.table = 'test';
            dp.database.range = testcase.range;
            dp.content = testcase.query;

            let finished = false;
            const panels = [dp];
            await withSavedPanels(
              panels,
              async (project) => {
                const panelValueBuffer = fs.readFileSync(
                  getProjectResultsFile(project.projectName) + dp.id
                );

                const v = JSON.parse(panelValueBuffer.toString());
                expect(v.length).toBe(testcase.results);

                finished = true;
              },
              {
                evalPanels: true,
                connectors,
                subprocessName: RUNNERS.find((r) => r?.go),
              }
            );

            if (!finished) {
              throw new Error('Callback did not finish');
            }
          }
        );
      },
      30_000
    );
  }
});
