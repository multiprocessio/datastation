const fs = require('fs');
const assert = require('assert');
const path = require('path');

const Application = require('spectron').Application;

const applicationPath = {
  darwin:
    'DataStation Community Edition.app/Contents/MacOS/DataStation Community Edition',
  win32: 'DataStation Community Edition.exe',
  linux: 'DataStation Community Edition',
}[process.platform];

const directory = path.join(
  'releases',
  `DataStation Community Edition-${process.platform}-${process.arch}`
);

async function run() {
  const app = new Application({
    path: path.join(process.cwd(), directory, applicationPath),
  });
  await app.start();
  const title = await app.client.getTitle();
  assert.equal(title, 'DataStation Community Edition');
  await app.stop();
}

run()
  .then(function () {
    process.exit(0);
  })
  .catch(function (error) {
    console.error('Failed: ', error);
    process.exit(1);
  });
