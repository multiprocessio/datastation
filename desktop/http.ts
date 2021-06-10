import * as fetch from 'node-fetch';

import { HTTPConnectorInfo } from '../shared/state';

export const evalHTTPHandler = {
  name: 'evalHTTP',
  handler: async function (body: string, { http }: HTTPConnectorInfo) {
    const headers: { [v: string]: string } = {};
    http.headers.forEach((h: { value: string; name: string }) => {
      headers[h.name] = h.value;
    });
    return fetch(http.url, { headers, body });
  },
};
