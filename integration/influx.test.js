const fs = require('fs');

const fetch = require('node-fetch');

const { getProjectResultsFile } = require('../desktop/store');
const {
  DatabasePanelInfo,
  Encrypt,
  DatabaseConnectorInfo,
} = require('../shared/state');
const { withSavedPanels, RUNNERS } = require('../desktop/panel/testutil');
const { withDocker, DEFAULT_TIMEOUT } = require('./testutil');

async function testBasicInflux(testcase) {
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

describe('influx 1 tests', () => {
  const basicTest = {
    address: 'localhost:8086',
    query: 'SELECT MEAN(avg_wave_period_sec) FROM ndbc',
    version: 'influx',
  };

  test(
    'basic test',
    async () => {
      if (process.platform !== 'linux') {
        return;
      }

      return withDocker(
        {
          image: 'docker.io/library/influxdb:1.7',
          port: '8086',
          env: {
            INFLUXDB_DB: 'test',
            INFLUXDB_HTTP_AUTH_ENABLED: 'true',
            INFLUXDB_ADMIN_USER: 'test',
            INFLUXDB_ADMIN_PASSWORD: 'testtest',
          },
          args: ['-v', __dirname + '/../testdata/influx:/testdata'],
          cmds: [
            `curl --fail -XPOST 'http://localhost:8086/write?db=test&u=test&p=testtest' --data-binary @/testdata/noaa-ndbc-data-sample.lp`,
          ],
        },
        () => testBasicInflux(basicTest)
      );
    },
    DEFAULT_TIMEOUT
  );
});

describe('influx 2 tests', () => {
  const basicTest = {
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
  };

  test(
    'basic test',
    async () => {
      if (process.platform !== 'linux') {
        return;
      }

      return withDocker(
        {
          image: 'docker.io/library/influxdb:2.0',
          port: 8086,
          env: {
            DOCKER_INFLUXDB_INIT_MODE: 'setup',
            DOCKER_INFLUXDB_INIT_USERNAME: 'test',
            DOCKER_INFLUXDB_INIT_PASSWORD: 'testtest',
            DOCKER_INFLUXDB_INIT_ORG: 'test',
            DOCKER_INFLUXDB_INIT_BUCKET: 'test',
            DOCKER_INFLUXDB_INIT_ADMIN_TOKEN: 'test',
          },
          args: ['-v', __dirname + '/../testdata/influx:/testdata'],
          cmds: [
            `curl -XPOST 'http://localhost:8086/api/v2/write?org=test&bucket=test&precision=ns' --header 'Authorization: Token test' --data-binary @/testdata/noaa-ndbc-data-sample.lp`,
          ],
        },
        () => testBasicInflux(basicTest)
      );
    },
    DEFAULT_TIMEOUT
  );
});
