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
    return tunnel(hci.server, () =>
      request(
        fetch,
        hci.http.method,
        hci.http.url,
        hci.http.headers,
        body,
        additionalParsers
      )
    );
  },
};
