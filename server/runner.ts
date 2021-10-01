import { initialize as initializeBase, main } from '../desktop/runner';
import { App } from './app';
import { readConfig } from './config';
import { getProjectHandlers } from './project';

export function initialize(app: App, args: { subprocess: string }) {
  return initializeBase({
    ...args,
    additionalHandlers: getProjectHandlers(app),
  });
}

async function run() {
  const config = await readConfig();
  const app = new App(config);
  await main(getProjectHandlers(app));
}

if (process.argv[1].includes('server_runner.js')) {
  run();
}
