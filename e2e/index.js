const assert = require('assert');
const path = require('path');

const Application = require('spectron').Application;

const app = new Application({
  path: path.join(process.cwd(), process.argv[2]),
});

app
  .start()
  .then(function () {
    // Check if the window is visible
    return app.browserWindow.isVisible();
  })
  .then(function (isVisible) {
    // Verify the window is visible
    assert.equal(isVisible, true);
  })
  .then(function () {
    // Get the window's title
    return app.client.getTitle();
  })
  .then(function (title) {
    // Verify the window's title
    assert.equal(title, 'DataStation Community Edition');
  })
  .then(function () {
    // Stop the application
    return app.stop();
  })
  .catch(function (error) {
    console.error('Test failed', error.message);
  });
