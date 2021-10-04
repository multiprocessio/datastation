const webdriver = require('selenium-webdriver');
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

async function run() {
  const chrome = spawn('yarn', ['run', 'chromedriver']);
  await new Promise((resolve, reject) => {
    try {
      chrome.stderr.on('data', d => process.stderr.write(d));
      chrome.stdout.on('data', (data) => {
	try {
	  if (data.includes('ChromeDriver was started successfully.')) {
	    resolve();
	  }
	  process.stdout.write(data);
	} catch (e) {
	  reject(e);
	}
    });
    } catch (e) {
      reject(e);
    }
  });

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
    return true;
  }, 10_000);

  driver.quit();
  process.kill(chrome.pid);
  process.exit(0);
}

run();
