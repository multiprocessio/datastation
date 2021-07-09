import { URL } from 'url';

import fetch from 'node-fetch';

import { Proxy, HTTPConnectorInfo } from '../shared/state';
import { request } from '../shared/http';

import { tunnel } from './tunnel';
import { parseParquet } from './parquet';

export const additionalParsers = {
  parquet: parseParquet,
};

export const evalHTTPHandler = {
  resource: 'evalHTTP',
  handler: async function (body: string, hci: Proxy<HTTPConnectorInfo>) {
    const url = new URL(
      (hci.http.url.startsWith('http') ? '' : 'http://') + hci.http.url
    );
    return await tunnel(
      hci.server,
      url.hostname,
      +url.port,
      async (host, port) => {
        const tunnelledUrl = new URL(url.toString());
        tunnelledUrl.hostname = host || '127.0.0.1';
        if (port) {
          tunnelledUrl.port = String(port);
        }
        return await request(
          fetch,
          hci.http.method,
          tunnelledUrl.toString(),
          hci.http.headers,
          body,
          additionalParsers
        );
      }
    );
  },
};
