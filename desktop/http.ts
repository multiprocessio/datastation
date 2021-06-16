import fetch from 'node-fetch';

import { parseArrayBuffer } from '../shared/text';
import { HTTPConnectorInfo } from '../shared/state';

import { parseParquet } from './parquet';

export const additionalParsers = {
  parquet: parseParquet,
};

export const evalHTTPHandler = {
  resource: 'evalHTTP',
  handler: async function (body: string, { http }: HTTPConnectorInfo) {
    const headers: { [v: string]: string } = {};
    http.headers.forEach((h: { value: string; name: string }) => {
      headers[h.name] = h.value;
    });
    const method = http.method.toUpperCase();
    const rsp = await fetch(http.url, {
      headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : body,
      method,
    });
    const rspBody = await rsp.arrayBuffer();
    const type = rsp.headers.get('content-type');
    return await parseArrayBuffer(type, http.url, rspBody, additionalParsers);
  },
};
