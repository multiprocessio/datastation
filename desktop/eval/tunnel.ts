import fs from 'fs/promises';
import path from 'path';
import SSH2Promise from 'ssh2-promise';
import SSH2Config from 'ssh2-promise/lib/sshConfig';
import { DEBUG } from '../../shared/constants';
import log from '../../shared/log';
import { ProjectState } from '../../shared/state';
import { HOME } from '../constants';
import { Dispatch } from '../rpc';
import { decrypt } from '../secret';

interface SSHConfig extends SSH2Config {
  retries: number;
  retry_factor: number;
  retry_minTimeout: number;
}

export function resolvePath(name: string) {
  if (name.startsWith('~/')) {
    name = path.join(HOME, name.slice(2));
  }
  return path.resolve(name);
}

export async function getSSHConfig(
  dispatch: Dispatch,
  projectId: string,
  serverId: string
): Promise<SSHConfig> {
  const project = (await dispatch({
    resource: 'getProjectState',
    projectId,
    args: projectId,
  })) as ProjectState;
  const servers = (project.servers || []).filter((s) => s.id === serverId);
  if (!servers.length) {
    throw new Error('No such server.');
  }
  const server = servers[0];

  const config: SSHConfig = {
    host: server.address,
    port: server.port,
    readyTimeout: 20000,
    retries: 2,
    retry_factor: 2,
    retry_minTimeout: 2000,
    debug: DEBUG ? log.info : null,
  };

  if (server.type === 'ssh-agent') {
    config.agent = process.env.SSH_AGENT;
  }

  if (server.type === 'private-key') {
    config.username = server.username;
    if (server.privateKeyFile) {
      const buffer = await fs.readFile(resolvePath(server.privateKeyFile));
      config.privateKey = buffer.toString();
    }
    if (server.passphrase) {
      config.passphrase = await decrypt(server.passphrase.value);
    }
  }

  if (server.type === 'password') {
    config.username = server.username;
    config.password = await decrypt(server.password.value);
  }

  return config;
}

export async function tunnel<T>(
  dispatch: Dispatch,
  projectId: string,
  serverId: string,
  destAddress: string,
  destPort: number,
  callback: (host: string, port: number) => Promise<T>
) {
  if (!serverId) {
    return callback(destAddress, destPort);
  }

  const config = await getSSHConfig(dispatch, projectId, serverId);

  const ssh = new SSH2Promise(config);
  const tunnel = await ssh.addTunnel({
    remoteAddr: destAddress,
    remotePort: destPort,
  });
  try {
    return await callback(tunnel.localAddress, tunnel.localPort);
  } finally {
    ssh.close();
  }
}
