import fetch from 'node-fetch';

import { HTTPConnectorInfo } from '../shared/state';
import { request } from '../shared/http';

import { parseParquet } from './parquet';

export const additionalParsers = {
  parquet: parseParquet,
};

export const evalHTTPHandler = {
  resource: 'evalHTTP',
  handler: async function (body: string, hci: HTTPConnectorInfo) {
    return await request(fetch, hci, body, additionalParsers);
  },
};
