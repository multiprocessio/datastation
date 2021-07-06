import fs from 'fs/promises';
import { Server } from 'net';

import getPort from 'get-port';
import tunnelSSH from 'tunnel-ssh';

import { ServerInfo } from '../shared/state';

export async function getSSHConfig(
  server: ServerInfo
): Promise<tunnelSSH.Config> {
  let privateKey = '';
  if (server.privateKeyFile) {
    const buffer = await fs.readFile(server.privateKeyFile);
    privateKey = buffer.toString();
  }

  return {
    host: server.address,
    port: server.port,
    username: server.username,
    password: server.password,
    agent: process.env.SSH_AGENT,
    privateKey: privateKey,
    passphrase: server.passphrase,
  };
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
