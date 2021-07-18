const assert = require('assert');
const path = require('path');

const Application = require('spectron').Application;

async function run() {
  console.log('here');
  const app = new Application({
    path: path.join(process.cwd(), process.argv[2]),
  });
  console.log('here2');
  await app.start();
  console.log('here3');
  const isVisible = await app.browserWindow.isVisible();
  console.log('here4');
  assert.equal(isVisible, true);
  console.log('here5');
  const title = await app.client.getTitle();
  console.log('here6');
  console.log(title);
  assert.equal(title, 'Blubberty');
  console.log('here7');
  await app.stop();
}

run()
  .then(function () {
    process.exit(0);
  })
  .catch(function (error) {
    console.error('Failed', error.message);
    process.exit(1);
  });
