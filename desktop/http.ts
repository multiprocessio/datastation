import fetch from 'node-fetch';

import { parseText } from '../shared/text';
import { HTTPConnectorInfo } from '../shared/state';

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
    const rspBody = await rsp.text();
    const type = rsp.headers.get('content-type');
    return parseText(type, rspBody);
  },
};
