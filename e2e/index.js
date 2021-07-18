const assert = require('assert');
const path = require('path');

const Application = require('spectron').Application;

async function run() {
  const app = new Application({
    path: path.join(process.cwd(), process.argv[2]),
  });

  await app.start();
  const isVisible = await app.browserWindow.isVisible();
  assert.equal(isVisible, true);
  const title = await app.client.getTitle();
  assert.equal(title, 'Blubberty');
  await app.stop();
}

run().catch(function (error) {
  console.error('Failed', error.message);
  process.exit(1);
});
