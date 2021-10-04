const webdriver = require('selenium-webdriver');
const fs = require('fs');
const assert = require('assert');
const path = require('path');

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

const driver = new webdriver.Builder()
  // The "9515" is the port opened by chrome driver.
  .usingServer('http://localhost:9515')
  .withCapabilities({
    'goog:chromeOptions': {
      binary: path.join(process.cwd(), directory, applicationPath),
    },
  })
  .forBrowser('chrome')
  .build();

driver.wait(async () => {
  const title = await driver.getTitle();
  assert.equal(title, 'DataStation Community Edition');
}, 1000);

driver.quit();
