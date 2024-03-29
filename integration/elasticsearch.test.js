const cp = require('child_process');
const fs = require('fs');

const fetch = require('node-fetch');

const { getProjectResultsFile } = require('../desktop/store');
const { DatabasePanelInfo, DatabaseConnectorInfo } = require('../shared/state');
const { withSavedPanels, RUNNERS } = require('../desktop/panel/testutil');
const { withDocker } = require('./docker');

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

  for (const testcase of tests) {
    test(
      'query: "' + testcase.query + '"',
      async () => {
        // GA tries to run a Windows container for ES which doesn't
        // exist so while the client should work on Windows there's not
        // an easy way in GA to test on Windows against a Linux
        // container.
        if (process.platform === 'win32') {
          return;
        }

        await withDocker(
          {
            port: 9200,
            env: {
              'discovery.type': 'single-node',
            },
            image: 'docker.elastic.co/elasticsearch/elasticsearch:7.16.3',
            wait: async () => {
              console.log('Awaiting container');
              while (true) {
                try {
                  const r = await fetch('http://localhost:9200');
                  break;
                } catch (e) {
                  await new Promise((r) => setTimeout(r, 2000));
                }
              }

              // Setting up test docs
              const nDocs = 4;
              for (let i = 0; i < nDocs; i++) {
                cp.execSync(
                  `curl --fail -X POST -H 'Content-Type: application/json' -d @testdata/documents/${
                    i + 1
                  }.json http://localhost:9200/test/_doc`,
                  { stdio: 'inherit' }
                );
              }

              // Wait until all docs have been ingested
              while (true) {
                console.log('Waiting for all docs to be ready');
                try {
                  const r = await fetch('http://localhost:9200/test/_search');
                  const j = await r.json();
                  console.log(j);
                  if (j.hits.hits.length === nDocs) {
                    break;
                  }
                } catch (e) {
                  /* pass */
                }

                await new Promise((r) => setTimeout(r, 2000));
              }
            },
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
      360_000
    );
  }
});
