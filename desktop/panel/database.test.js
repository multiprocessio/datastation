const path = require('path');
const fs = require('fs');

const { CODE_ROOT } = require('../constants');
const { getProjectResultsFile } = require('../store');
const { ensureSigningKey } = require('../secret');
const {
  LiteralPanelInfo,
  Encrypt,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
} = require('../../shared/state');
const { basicDatabaseTest, withSavedPanels, RUNNERS } = require('./testutil');

const DATABASES = [
  {
    type: 'odbc',
    // SQL Server doesn't have true/false literals
    query: `SELECT 1 AS "1", 2.2 AS "2", 1 AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
  {
    type: 'sqlite',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", DATE('2021-01-01') AS "date"`,
  },
  {
    type: 'sqlite',
    query:
      'SELECT name, CAST(age AS INT) - 10 AS age, "location.city" AS city FROM DM_getPanel(0)',
  },
  {
    type: 'odbc',
    query: `INSERT INTO test (id, name) VALUES (1, 'name')`,
  },
];

ensureSigningKey();

const vendorOverride = {
  odbc: {
    address: 'localhost',
    username: 'sa',
    password: '1StrongPwd!!',
    database: 'master',
    extra: {
      driver: 'ODBC Driver 18 for SQL Server',
      allow_untrusted: true,
    },
  },
};

for (const subprocess of RUNNERS) {
  // Most databases now only work with the Go runner.
  if (!subprocess?.go) {
    continue;
  }

  for (const t of DATABASES) {
    describe(
      t.type +
        ' running via ' +
        (subprocess ? subprocess.node || subprocess.go : 'process') +
        ': ' +
        t.query,
      () => {
        test(`runs ${t.type} query`, async () => {
          if (process.platform !== 'linux') {
            return;
          }

          await basicDatabaseTest(t, vendorOverride, subprocess);
          // sqlserver takes a while
        }, 30_000);
      }
    );
  }

  describe('influx testdata/influx tests', () => {
    const tests = [
      {
        address: 'localhost:8087',
        query: 'SELECT MEAN(avg_wave_period_sec) FROM ndbc',
        version: 'influx',
      },
      {
        address: 'localhost:8086',
        query: `
	 from(bucket: "test")
	 |> range(start: -1000000h)
	 |> filter(fn: (r) =>
           (r._measurement == "ndbc" and r._field == "avg_wave_period_sec"))
	 |> group(columns: ["_measurement", "_start", "_stop", "_field"], mode: "by")
	 |> keep(columns: ["_measurement", "_start", "_stop", "_field", "_time", "_value"])
	 |> mean()
	 |> map(fn: (r) =>
           ({r with _time: 1970-01-01T00:00:00Z}))
	 |> rename(columns: {_value: "mean", "_time": "time"})
         |> drop(columns: ["result", "table"])
	 |> yield(name: "0")`,
        version: 'influx-flux',
      },
    ];

    for (const testcase of tests) {
      test(`runs ${JSON.stringify(testcase)} query`, async () => {
        if (process.platform !== 'linux') {
          return;
        }

        const connectors = [
          new DatabaseConnectorInfo({
            type: testcase.version,
            address: testcase.address,
            database: 'test',
            username: 'test',
            password_encrypt: new Encrypt('testtest'),
            apiKey_encrypt: new Encrypt('test'),
          }),
        ];
        const dp = new DatabasePanelInfo();
        dp.database.connectorId = connectors[0].id;
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
            expect(v.length).toEqual(1);
            expect(v[0].time).toStrictEqual('1970-01-01T00:00:00Z');
            expect(v[0].mean).toStrictEqual(6.6);

            finished = true;
          },
          { evalPanels: true, connectors, subprocessName: subprocess }
        );

        if (!finished) {
          throw new Error('Callback did not finish');
        }
      });
    }
  });
}
