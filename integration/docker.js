const cp = require('child_process');

function runCmd(opts, containerId, cmd) {
  console.log('[DEBUG withDocker] docker exec ' + containerId + ' ' + cmd);
  cp.execSync('docker exec ' + containerId + ' ' + cmd, {
    stdio: 'inherit',
  });
  process.stdout.write('\n');
}

const CONTAINERS = {};

function getContainers() {
  console.log('Waiting for container to come up...');
  const res = cp.execSync('docker ps');
  return res.toString().split('\n').slice(1);
}

module.exports.withDocker = async function (opts, cb) {
  outer: while (true) {
    for (const container of getContainers()) {
      const id = container.split(' ')[0];
      if (CONTAINERS[opts.image] && CONTAINERS[opts.image].includes(id)) {
        console.log('Waiting for existing container from this image to die.');
        await new Promise((r) => setTimeout(r, 3000));
        continue outer;
      }
    }

    break;
  }

  const cmd = 'docker';
  const args = ['run', '-d'];
  if (opts.port) {
    let port = String(opts.port);
    if (!port.includes(':')) {
      port = `${port}:${port}`;
    }

    args.push('-p', port);
  }

  if (opts.env) {
    for (const [key, value] of Object.entries(opts.env)) {
      args.push('-e', `${key}=${value}`);
    }
  }

  if (opts.args) {
    args.push(...opts.args);
  }

  args.push(opts.image);

  if (opts.program) {
    if (Array.isArray(opts.program)) {
      args.push(...opts.program);
    } else {
      args.push(opts.program);
    }
  }

  console.log(`[DEBUG withDocker] ${cmd} ${args.join(' ')}`);

  const proc = cp.spawn(cmd, args);
  let stdout = '';
  proc.stdout.on('data', (m) => {
    stdout += m.toString();
  });
  let stderr = '';
  proc.stderr.on('data', (m) => {
    stderr += m.toString();
  });
  proc.on('exit', (s) => {
    if (s == '0') {
      return;
    }

    console.log({ stdout, stderr });
    process.exit(s);
  });

  let running = false;
  while (!running) {
    const containerId = stdout.slice(0, 12);
    const containers = getContainers();
    for (const container of containers) {
      const id = container.split(' ')[0];
      if (id && id == containerId) {
        running = true;
      }
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  const containerId = stdout.slice(0, 12);
  if (!CONTAINERS[opts.image]) {
    CONTAINERS[opts.image] = [];
  }
  CONTAINERS[opts.image].push(containerId);

  try {
    if (opts.wait) {
      await opts.wait(containerId);
    } else if (opts.cmds) {
      let first = true;
      while (true) {
        if (!first) {
          await new Promise((r) => setTimeout(r, 1500));
        }
        first = false;

        try {
          runCmd(opts, containerId, opts.cmds[0]);
          break;
        } catch (e) {
          /* pass */
        }
      }

      opts.cmds = opts.cmds.slice(1);
    }

    if (opts.cmds) {
      for (const c of opts.cmds) {
        runCmd(opts, containerId, c);
      }
    }

    await cb();
  } finally {
    console.log('Killing container');
    cp.execSync('docker kill ' + containerId, { stdio: 'inherit' });
    console.log('Killed container');

    CONTAINERS[opts.image] = CONTAINERS[opts.image].filter(
      (c) => c === containerId
    );

    if (process.env.CI == 'true') {
      // Clear up disk space if possible since Github Actions doesn't
      // have a massive disk.
      cp.execSync('docker image prune -a', { stdio: 'inherit' });
    }
  }
};

module.exports.DEFAULT_TIMEOUT = 360_000;
