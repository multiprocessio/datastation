import fs from 'fs/promises';
import { Server  } from 'net';

import tunnelSSH from 'tunnel-ssh';

import { ServerInfo } from '../shared/state';

export async function getSSHConfig(server: ServerInfo): Promise<tunnelSSH.Config> {
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

export async function tunnel<T>(server: ServerInfo | null, callback: () => Promise<T>) {
  if (!server) {
    return callback();
  }

  const config = await getSSHConfig(server);

  config.keepAlive = true;
  return new Promise((accept, reject) =>
    tunnelSSH(config, async (error: Error | null, tnl: Server) => {
      if (error) {
        reject(error);
      }

      try {
        const res = await callback();
        accept(res);
      } catch (e) {
        reject(e);
      } finally {
        tnl.close();
      }
    }));
}
