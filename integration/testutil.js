const cp = require('child_process');

module.exports.withDocker = async function (opts, cb) {
  const cmd = 'docker';
  const args = ['run', '-d'];
  if (opts.port) {
    if (!opts.port.includes(':')) {
      const port = `${opts.port}:${opts.port}`;
      args.push('-p', port);
    }
  }

  if (opts.env) {
    for (const [key, value] of Object.entries(opts.env)) {
      args.push('-e', `${key}=${value}`);
    }
  }

  args.push(opts.image);

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
    console.log('Waiting for container to come up...');
    const res = cp.execSync('docker ps');
    const containers = res.toString().split('\n').slice(1);
    for (const container of containers) {
      const id = container.split(' ')[0];
      if (id && id == containerId) {
        running = true;
      }
    }

    await new Promise((r) => setTimeout(r, 1500));
  }

  const containerId = stdout.slice(0, 12);

  try {
    if (opts.wait) {
      await opts.wait(containerId);
    }

    if (opts.cmds) {
      for (const cmd of opts.cmds) {
        cp.execSync('docker exec ' + containerId + ' ' + cmd, {
          stdio: 'inherit',
        });
      }
    }

    await cb();
  } finally {
    cp.execSync('docker kill ' + containerId);
  }
};
