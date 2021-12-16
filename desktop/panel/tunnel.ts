import fs from 'fs';
import os from 'os';
import path from 'path';
import SSH2Promise from 'ssh2-promise';
import SSH2Config from 'ssh2-promise/lib/sshConfig';
import log from '../../shared/log';
import { ProjectState, ServerInfo } from '../../shared/state';
import { HOME } from '../constants';
import { decryptFields } from '../secret';

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

export function getServer(project: ProjectState, serverId: string): ServerInfo {
  const servers = (project.servers || []).filter((s) => s.id === serverId);
  if (!servers.length) {
    throw new Error('No such server.');
  }

  const server = servers[0];
  if (!server.username) {
    server.username = os.userInfo().username;
  }

  // If private key file is not set, guess the first common name that exists.
  if (server.type === 'private-key' && !server.privateKeyFile) {
    const defaultPaths = [
      '~/.ssh/id_ed25519',
      '~/.ssh/id_dsa',
      '~/.ssh/id_rsa',
    ];

    for (const path of defaultPaths) {
      const resolved = resolvePath(path);
      if (fs.existsSync(resolved)) {
        server.privateKeyFile = resolved;
        break;
      }
    }
  }

  return server;
}

export async function getSSHConfig(
  project: ProjectState,
  serverId: string
): Promise<SSHConfig> {
  const server = getServer(project, serverId);
  decryptFields(server);

  const config: SSHConfig = {
    host: server.address,
    port: server.port,
    readyTimeout: 20000,
    retries: 2,
    retry_factor: 2,
    retry_minTimeout: 2000,
  };

  if (server.type === 'ssh-agent') {
    config.agent = process.env.SSH_AGENT;
  }

  if (server.type === 'private-key') {
    config.username = server.username;
    if (server.privateKeyFile) {
      const buffer = fs.readFileSync(resolvePath(server.privateKeyFile));
      config.privateKey = buffer.toString();
      config.passphrase = server.passphrase_encrypt.value;
    }
  }

  if (server.type === 'password') {
    config.username = server.username;
    config.password = server.password_encrypt.value;
  }

  return config;
}

export async function tunnel<T>(
  project: ProjectState,
  serverId: string,
  destAddress: string,
  destPort: number,
  callback: (host: string, port: number) => Promise<T>
) {
  if (destAddress.includes('://')) {
    throw new Error('Tunnel address must not contain protocol.');
  }

  if (!serverId) {
    return callback(destAddress, destPort);
  }

  const config = await getSSHConfig(project, serverId);

  const ssh = new SSH2Promise(config);
  const tunnel = await ssh.addTunnel({
    remoteAddr: destAddress,
    remotePort: destPort,
  });
  try {
    log.info(
      `Connected to tunnel, proxying ${destAddress}:${destPort} via server to localhost:${tunnel.localPort}`
    );
    return await callback(tunnel.localAddress, tunnel.localPort);
  } finally {
    log.info('Closing tunnel');
    ssh.close();
  }
}
