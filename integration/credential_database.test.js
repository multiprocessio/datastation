//
// NOTICE!
// This file is only for tests that require credentials stored in Github Secrets to succeed.
// For example tests that connect to a live Snowflake instance. Tests that run against a
// database in Docker should not be put into this file.
//

const fs = require('fs');
const path = require('path');

const { CODE_ROOT } = require('../desktop/constants');
const { getProjectResultsFile } = require('../desktop/store');
const { ensureSigningKey } = require('../desktop/secret');
const {
  LiteralPanelInfo,
  Encrypt,
  DatabasePanelInfo,
  DatabaseConnectorInfo,
} = require('../shared/state');
const { withSavedPanels, RUNNERS } = require('../desktop/panel/testutil');

// File only runs when SKIP_CREDENTIALED=true is not set. This is
// because these tests will always fail when an outside contributor pull
// request runs.
if (process.env.RUN_CREDENTIAL_TESTS == 'true') {
  for (const subprocess of RUNNERS) {
    // Most databases now only work with the Go runner.
    if (!subprocess?.go) {
      continue;
    }

    describe('basic bigquery tests', () => {
      test(`runs query against public dataset`, async () => {
        const connectors = [
          new DatabaseConnectorInfo({
            type: 'bigquery',
            database: 'multiprocess-325723',
            apiKey_encrypt: new Encrypt(process.env.BIGQUERY_TOKEN),
          }),
        ];
        const dp = new DatabasePanelInfo();
        dp.database.connectorId = connectors[0].id;
        dp.content =
          'SELECT * FROM `bigquery-public-data`.census_bureau_usa.population_by_zip_2010 ORDER BY population DESC LIMIT 10';

        let finished = false;
        const panels = [dp];
        await withSavedPanels(
          panels,
          async (project) => {
            const panelValueBuffer = fs.readFileSync(
              getProjectResultsFile(project.projectName) + dp.id
            );

            const v = JSON.parse(panelValueBuffer.toString());
            expect(v).toStrictEqual(
              JSON.parse(
                fs
                  .readFileSync('testdata/bigquery/population_result.json')
                  .toString()
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
    });

    describe('basic athena tests', () => {
      test(`runs query against s3://datastation-tests/basic/`, async () => {
        const connectors = [
          new DatabaseConnectorInfo({
            type: 'athena',
            database: 'testdata',
            extra: {
              aws_region: 'us-east-1',
            },
            address: 's3://datastation-test-results/',
            username: process.env.AWS_ACCESS_KEY_ID,
            password_encrypt: new Encrypt(process.env.AWS_SECRET_ACCESS_KEY),
          }),
        ];
        const dp = new DatabasePanelInfo();
        dp.database.connectorId = connectors[0].id;
        dp.content = 'SELECT * FROM basic_users ORDER BY age desc';

        let finished = false;
        const panels = [dp];
        await withSavedPanels(
          panels,
          async (project) => {
            const panelValueBuffer = fs.readFileSync(
              getProjectResultsFile(project.projectName) + dp.id
            );

            const v = JSON.parse(panelValueBuffer.toString());
            expect(v).toStrictEqual([
              { age: 52, name: 'Emma' },
              { age: 50, name: 'Karl' },
              { age: 43, name: 'Garry' },
              { age: 41, name: 'Nile' },
              { age: 39, name: 'Mina' },
            ]);

            finished = true;
          },
          { evalPanels: true, connectors, subprocessName: subprocess }
        );

        if (!finished) {
          throw new Error('Callback did not finish');
        }
      }, 15_000);
    });

    describe('basic google sheets tests', () => {
      test(`returns all results`, async () => {
        const connectors = [
          new DatabaseConnectorInfo({
            type: 'google-sheets',
            apiKey_encrypt: new Encrypt(process.env.BIGQUERY_TOKEN),
          }),
        ];
        const dp = new DatabasePanelInfo(null, {
          table: '1osiz0yumwHxfovIAIYTpf5ozDapQzIHv_2jk4P2AvZg',
        });
        dp.database.connectorId = connectors[0].id;
        dp.content = '';

        let finished = false;
        const panels = [dp];
        await withSavedPanels(
          panels,
          async (project) => {
            const panelValueBuffer = fs.readFileSync(
              getProjectResultsFile(project.projectName) + dp.id
            );

            const v = JSON.parse(panelValueBuffer.toString());
            expect(v).toStrictEqual([
              { age: '43', name: 'Garry' },
              { age: '39', name: 'Mina' },
              { age: '50', name: 'Karl' },
              { age: '41', name: 'Nile' },
              { age: '52', name: 'Emma' },
            ]);

            finished = true;
          },
          { evalPanels: true, connectors, subprocessName: subprocess }
        );

        if (!finished) {
          throw new Error('Callback did not finish');
        }
      }, 15_000);
    });

    describe('basic airtable tests', () => {
      const terrenceSample = {
        ' Name ': 'Dr. Terrence Metz',
        'Phone Number ': '1-233-954-4550',
        Email: 'Dell_Herman17@yahoo.com',
        Street: '5635 Kuvalis Shores',
        '    City ': 'Haagton',
        State: 'New Mexico',
        'Zip Code ': '18960',
        'Routing Number   ': 616515073,
        Department: 'Automotive',
        'Company	': 'Smitham Inc',
        'Created At ': '2021-06-25T01:06:47.125Z',
        'Profile Photo': 'http://placeimg.com/640/480',
        '  Description':
          'Omnis ut ut voluptatem provident eaque necessitatibus quia. Et molestiae molestiae magni repudiandae aut sed. Deleniti maiores voluptas placeat cumque occaecati odit.',
        Activated: true,
      };

      test(`returns all results`, async () => {
        const connectors = [
          new DatabaseConnectorInfo({
            type: 'airtable',
            database: '',
            apiKey_encrypt: new Encrypt(process.env.AIRTABLE_TOKEN),
          }),
        ];
        const dp = new DatabasePanelInfo(null, {
          table: 'tblaafwMIxhqwdHkj',
          extra: {
            airtable_view: 'viwk6vMHsOT3NRn63',
            airtable_app: 'app9SNPHq4m8BGwgD',
          },
        });
        dp.database.connectorId = connectors[0].id;
        dp.content = '';

        let finished = false;
        const panels = [dp];
        await withSavedPanels(
          panels,
          async (project) => {
            const panelValueBuffer = fs.readFileSync(
              getProjectResultsFile(project.projectName) + dp.id
            );

            const v = JSON.parse(panelValueBuffer.toString());
            expect(v.length).toBe(1_000);
            expect(
              v.find((row) => row[' Name '] === 'Dr. Terrence Metz')
            ).toStrictEqual(terrenceSample);

            finished = true;
          },
          { evalPanels: true, connectors, subprocessName: subprocess }
        );

        if (!finished) {
          throw new Error('Callback did not finish');
        }
      }, 15_000);

      test(`returns filtered results`, async () => {
        const connectors = [
          new DatabaseConnectorInfo({
            type: 'airtable',
            database: '',
            apiKey_encrypt: new Encrypt(process.env.AIRTABLE_TOKEN),
          }),
        ];
        const dp = new DatabasePanelInfo(null, {
          table: 'tblaafwMIxhqwdHkj',
          extra: {
            airtable_view: 'viwk6vMHsOT3NRn63',
            airtable_app: 'app9SNPHq4m8BGwgD',
          },
        });
        dp.database.connectorId = connectors[0].id;
        dp.content = '{ Name } = "Dr. Terrence Metz"';

        let finished = false;
        const panels = [dp];
        await withSavedPanels(
          panels,
          async (project) => {
            const panelValueBuffer = fs.readFileSync(
              getProjectResultsFile(project.projectName) + dp.id
            );

            const v = JSON.parse(panelValueBuffer.toString());
            expect(v.length).toBe(1);
            const sample = v.find(
              (row) => row[' Name '] === 'Dr. Terrence Metz'
            );
            expect(sample).toStrictEqual(terrenceSample);

            finished = true;
          },
          { evalPanels: true, connectors, subprocessName: subprocess }
        );

        if (!finished) {
          throw new Error('Callback did not finish');
        }
      }, 15_000);
    });

    describe('basic snowflake tests', () => {
      test('basic test', async () => {
        const connectors = [
          new DatabaseConnectorInfo({
            type: 'snowflake',
            database: '',
            username: process.env.SNOWFLAKE_USER,
            password_encrypt: new Encrypt(process.env.SNOWFLAKE_PASSWORD),
            extra: {
              account: process.env.SNOWFLAKE_ACCOUNT,
            },
          }),
        ];
        const dp = new DatabasePanelInfo();
        dp.database.connectorId = connectors[0].id;
        dp.content =
          'select count(*) from "SNOWFLAKE_SAMPLE_DATA".tpch_sf1.lineitem;';

        let finished = false;
        const panels = [dp];
        await withSavedPanels(
          panels,
          async (project) => {
            const panelValueBuffer = fs.readFileSync(
              getProjectResultsFile(project.projectName) + dp.id
            );

            const v = JSON.parse(panelValueBuffer.toString());
            expect(v).toStrictEqual([{ 'COUNT(*)': '6001215' }]);

            finished = true;
          },
          { evalPanels: true, connectors, subprocessName: subprocess }
        );

        if (!finished) {
          throw new Error('Callback did not finish');
        }
      }, 360_000);
    });
  }
} else {
  test('stub', () => {});
}
