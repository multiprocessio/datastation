require('../../shared/polyfill');

const { CODE_ROOT } = require('../constants');
const path = require('path');
const fs = require('fs');
const { FilePanelInfo } = require('../../shared/state');
const { file: makeTmpFile } = require('tmp-promise');
const { evalFile } = require('./file');

const USERDATA_FILES = ['json', 'xlsx', 'csv', 'parquet'];

const testPath = path.join(CODE_ROOT, 'testdata');
const baseline = JSON.parse(
  fs.readFileSync(path.join(testPath, 'userdata.json').toString())
);

function replaceBigInt(rows) {
  for (const row of rows) {
    for (const [key, val] of Object.entries(row)) {
      if (val instanceof BigInt) {
        row[key] = val.toString();
      }
    }
  }
}

function translateBaselineForType(baseline, fileType) {
  if (fileType === 'json') {
    return baseline;
  }

  const data = [];
  for (const row of baseline) {
    const translatedRow = {};
    Object.keys(row).forEach((k) => {
      // All non-json, non-parquet get the column header trimmed
      const columnHeader = ['json', 'parquet'].includes(fileType)
        ? k
        : k.trim();
      translatedRow[columnHeader] = row[k];

      // CSVs are just strings
      if (fileType === 'csv') {
        translatedRow[columnHeader] = String(row[k]);
      }

      // Parquet dates are in integer format
      if (
        fileType === 'parquet' &&
        String(new Date(row[k])) !== 'Invalid Date'
      ) {
        translatedRow[columnHeader] = new Date(row[k]).valueOf();
      }
    });
    data.push(translatedRow);
  }

  return data;
}

for (const userdataFileType of USERDATA_FILES) {
  const dynamicF = {
    // Do this so that its name shows up in stack traces
    [userdataFileType + 'Test']: async () => {
      const tmp = await makeTmpFile({
        prefix: userDataFileType + '-file-project-',
      });

      try {
        const { value } = await evalFile(
          tmp.path,
          new FilePanelInfo({
            name: path.join(testPath, 'userdata.' + userdataFileType),
          })
        );
        const typeBaseline = translateBaselineForType(
          baseline,
          userdataFileType
        );
        // Parquet results seem to come out unsorted
        if (userdataFileType === 'parquet') {
          value.sort((r) => r.Street);
          typeBaseline.sort((r) => r.Street);
        }
        expect(replaceBigInt(value)).toStrictEqual(replaceBigInt(typeBaseline));
      } finally {
        await tmp.cleanup();
      }
    },
  };
  test(
    `load ${userdataFileType} userdata file`,
    dynamicF[userdataFileType + 'Test'],
    10_000
  );
}
