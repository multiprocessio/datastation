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
    const url = new URL(hci.http.url);
    return await tunnel(hci.server, url.host, +url.port, async (host, port) => {
      url.host = host || '127.0.0.1';
      url.port = String(port);
      return await request(
        fetch,
        hci.http.method,
        url.toString(),
        hci.http.headers,
        body,
        additionalParsers
      );
    });
  },
};
