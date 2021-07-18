const assert = require('assert');
const path = require('path');

const Application = require('spectron').Application;

async function run() {
  const app = new Application({
    path: path.join(process.cwd(), process.argv[2]),
  });
  console.log(process.argv[2], app.path);
  await app.start();
  const isVisible = await app.browserWindow.isVisible();
  assert.equal(isVisible, true);
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
