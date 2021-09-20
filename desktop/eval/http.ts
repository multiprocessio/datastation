import fetch from 'node-fetch';
import { URL } from 'url';
import { request } from '../../shared/http';
import { HTTPPanelInfo } from '../../shared/state';
import { Dispatch } from '../rpc';
import { rpcEvalHandler } from './eval';
import { parseParquet } from './parquet';
import { tunnel } from './tunnel';

export const additionalParsers = {
  parquet: parseParquet,
};

export const evalHTTPHandler = rpcEvalHandler<HTTPPanelInfo>({
  resource: 'evalHTTP',
  handler: async function (
    projectId: string,
    body: string,
    hci: HTTPPanelInfo,
    dispatch: Dispatch
  ) {
    const url = new URL(
      (hci.http.http.url.startsWith('http') ? '' : 'http://') +
        hci.http.http.url
    );
    return await tunnel(
      dispatch,
      projectId,
      hci.serverId,
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
          hci.http.http.method,
          tunnelledUrl.toString(),
          { ...hci.http.http.contentTypeInfo, additionalParsers },
          hci.http.http.headers,
          body
        );
      }
    );
  },
});
