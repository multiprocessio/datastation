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
    type: 'cockroach',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
  {
    type: 'clickhouse',
    query: `SELECT 1 AS "1", 2.2 AS "2", true AS "true", 'string' AS "string", parseDateTimeBestEffortOrNull('2021-01-01') AS "date"`,
  },
  {
    type: 'sqlserver',
    // SQL Server doesn't have true/false literals
    query: `SELECT 1 AS "1", 2.2 AS "2", 1 AS "true", 'string' AS "string", CAST('2021-01-01' AS DATE) AS "date"`,
  },
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
    type: 'oracle',
    query:
      // Oracle does not have true/false literals
      // Oracle doesn't support no-FROM. But the dual table is a dummy table.
      `SELECT 1 AS "1", 2.2 AS "2", 1 AS "true", 'string' AS "string", TO_DATE('2021-01-01','YYYY-MM-DD') AS "date" FROM dual`,
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
  clickhouse: {
    database: 'default',
  },
  oracle: {
    database: 'XEPDB1',
  },
  sqlserver: {
    address: 'localhost',
    username: 'sa',
    password: '1StrongPwd!!',
    database: 'master',
  },
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
      test(`runs ${JSON.stringify(testcase)} query`, async () => {
        if (process.platform !== 'linux') {
          return;
        }

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
          { evalPanels: true, connectors, subprocessName: subprocess }
        );

        if (!finished) {
          throw new Error('Callback did not finish');
        }
      });
    }
  });

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

  describe('basic cassandra/scylladb tests', () => {
    test(`runs basic cql query`, async () => {
      if (process.platform !== 'linux') {
        return;
      }

      const connectors = [
        new DatabaseConnectorInfo({
          type: 'scylla',
          database: 'test',
          username: 'cassandra',
          password_encrypt: new Encrypt('cassandra'),
        }),
      ];
      const dp = new DatabasePanelInfo();
      dp.database.connectorId = connectors[0].id;
      dp.content = 'select broadcast_address from system.local;';

      let finished = false;
      const panels = [dp];
      await withSavedPanels(
        panels,
        async (project) => {
          const panelValueBuffer = fs.readFileSync(
            getProjectResultsFile(project.projectName) + dp.id
          );

          const v = JSON.parse(panelValueBuffer.toString());
          expect(v).toStrictEqual([{ broadcast_address: '127.0.0.1' }]);

          finished = true;
        },
        { evalPanels: true, connectors, subprocessName: subprocess }
      );

      if (!finished) {
        throw new Error('Callback did not finish');
      }
    });
  });

  describe('basic mongodb testdata/documents tests', () => {
    test('basic test', async () => {
      if (process.platform !== 'linux') {
        return;
      }

      const connectors = [
        new DatabaseConnectorInfo({
          type: 'mongo',
          database: 'test',
          username: 'test',
          password_encrypt: new Encrypt('test'),
          extra: { authenticationDatabase: 'admin' },
        }),
      ];

      const dp = new DatabasePanelInfo();
      dp.database.connectorId = connectors[0].id;
      dp.content = 'db.test.find({ pageCount: { $gt: 0 } }).toArray()';

      let finished = false;
      const panels = [dp];
      await withSavedPanels(
        panels,
        async (project) => {
          const panelValueBuffer = fs.readFileSync(
            getProjectResultsFile(project.projectName) + dp.id
          );

          const v = Array.from(JSON.parse(panelValueBuffer.toString())).map(
            (el) => {
              delete el._id;
              return el;
            }
          );

          expect(v).toStrictEqual(
            JSON.parse(
              fs.readFileSync('testdata/mongo/documents.json').toString()
            )
          );

          finished = true;
        },
        { evalPanels: true, connectors, subprocessName: subprocess }
      );

      if (!finished) {
        throw new Error('Callback did not finish');
      }
    }, 15_000);

    test('errors with invalid authenticationDatabase', async () => {
      if (process.platform !== 'linux') {
        return;
      }

      const connectors = [
        new DatabaseConnectorInfo({
          type: 'mongo',
          database: 'test',
          username: 'test',
          password_encrypt: new Encrypt('test'),
          extra: { authenticationDatabase: 'invalid' },
        }),
      ];

      const dp = new DatabasePanelInfo();
      dp.database.connectorId = connectors[0].id;
      dp.content = 'db.test.find({})';

      const panels = [dp];
      try {
        await withSavedPanels(panels, () => {}, {
          evalPanels: true,
          connectors,
          subprocessName: subprocess,
        });
      } catch (e) {
        expect(e.name).toBe('UserError');
        expect(e.message).toBe('MongoServerError: Authentication failed.\n');
      }
    }, 15_000);

    test('errors when not using .toArray() on queries returning multiple objects', async () => {
      if (process.platform !== 'linux') {
        return;
      }

      const connectors = [
        new DatabaseConnectorInfo({
          type: 'mongo',
          database: 'test',
          username: 'test',
          password_encrypt: new Encrypt('test'),
        }),
      ];

      const dp = new DatabasePanelInfo();
      dp.database.connectorId = connectors[0].id;
      dp.content = 'db.test.find({ pageCount: { $gt: 0 } })';

      const panels = [dp];
      try {
        await withSavedPanels(panels, () => {}, {
          evalPanels: true,
          connectors,
          subprocessName: subprocess,
        });
      } catch (e) {
        expect(e.name).toBe('UserError');
        expect(
          e.message.startsWith(
            'BSONTypeError: Converting circular structure to EJSON:'
          )
        ).toBe(true);
      }
    }, 15_000);
  });

  describe('basic neo4j tests', () => {
    test('basic test', async () => {
      if (process.platform !== 'linux') {
        return;
      }

      const connectors = [
        new DatabaseConnectorInfo({
          type: 'neo4j',
          database: '',
          username: 'neo4j',
          password_encrypt: new Encrypt('password'),
        }),
      ];
      const dp = new DatabasePanelInfo();
      dp.database.connectorId = connectors[0].id;
      dp.content = 'MATCH (n) RETURN count(n) AS count';

      let finished = false;
      const panels = [dp];
      await withSavedPanels(
        panels,
        async (project) => {
          const panelValueBuffer = fs.readFileSync(
            getProjectResultsFile(project.projectName) + dp.id
          );

          const v = JSON.parse(panelValueBuffer.toString());
          expect(v).toStrictEqual([{ count: 1 }]);

          finished = true;
        },
        { evalPanels: true, connectors, subprocessName: subprocess }
      );

      if (!finished) {
        throw new Error('Callback did not finish');
      }
    });
  });
}
