import fs from 'fs/promises';
import path from 'path';
import { Server } from 'net';

import getPort from 'get-port';
import tunnelSSH from 'tunnel-ssh';

import { DEBUG } from '../shared/constants';
import { ServerInfo } from '../shared/state';

export function resolvePath(name: string) {
  if (name.startsWith('~/')) {
    name = path.join(process.env.HOME, name.slice(2));
  }
  return path.resolve(name);
}

export async function getSSHConfig(
  server: ServerInfo
): Promise<tunnelSSH.Config> {
  const config: Partial<tunnelSSH.Config> = {
    host: server.address,
    port: server.port,
    readyTimeout: 20000,
    retries: 2,
    retry_factor: 2,
    retry_minTimeout: 2000,
    debug: DEBUG ? console.error : null,
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
      config.passphrase = server.passphrase;
    }
  }

  if (server.type === 'password') {
    config.username = server.username;
    config.password = server.password;
  }

  return config;
}

export async function getTunnelConfig(
  server: ServerInfo,
  destAddress: string,
  destPort: number
): Promise<[tunnelSSH.Config, string, number]> {
  const config = await getSSHConfig(server);
  const localhost = '127.0.0.1';
  const freeLocalPort = await getPort({ host: localhost });
  config.dstHost = destAddress;
  config.dstPort = destPort;
  config.localHost = localhost;
  config.localPort = freeLocalPort;
  config.keepAlive = true;
  return [config, localhost, freeLocalPort];
}

export async function tunnel<T>(
  server: ServerInfo | null,
  destAddress: string,
  destPort: number,
  callback: (host: string, port: number) => Promise<T>
) {
  if (!server) {
    return callback(destAddress, destPort);
  }

  const [config, localhost, localport] = await getTunnelConfig(
    server,
    destAddress,
    destPort
  );

  return new Promise((accept, reject) =>
    tunnelSSH(config, async (error: Error | null, tnl: Server) => {
      if (error) {
        reject(error);
      }

      try {
        const res = await callback(localhost, localport);
        accept(res);
      } catch (e) {
        reject(e);
      } finally {
        tnl.close();
      }
    })
  );
}
