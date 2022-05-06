const webdriver = require('selenium-webdriver');
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const { spawn } = require('child_process');

async function run() {
  const chrome = spawn('yarn', ['run', 'chromedriver'], {
    shell: process.platform === 'win32',
  });
  await new Promise((resolve, reject) => {
    try {
      chrome.stderr.on('data', (d) =>
        process.stderr.write('[CHROME] ' + d + '\n')
      );
      chrome.stdout.on('data', (data) => {
        try {
          if (data.includes('ChromeDriver was started successfully.')) {
            resolve();
          }
          process.stdout.write('[CHROME] ' + data + '\n');
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
      'DataStation Desktop CE.app/Contents/MacOS/DataStation Desktop CE',
    win32: 'DataStation Desktop CE.exe',
    linux: 'DataStation Desktop CE',
  }[process.platform];

  const directory = path.join(
    'releases',
    `DataStation Desktop CE-${process.platform}-${process.arch}`
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

  let reached = false;
  try {
    await driver.wait(async () => {
      const title = await driver.getTitle();
      assert.equal(title, 'DataStation Desktop CE');
      reached = true;
      return true;
    }, 10_000);
  } finally {
    await driver.quit();
    process.kill(chrome.pid); // This doesn't do anything on Windows. Need to manually `ps | grep chromedriver` and kill it. TODO: script.
  }

  assert.equal(reached, true);
  process.exit(0);
}

run();
