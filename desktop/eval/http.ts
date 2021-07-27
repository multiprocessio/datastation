import fetch from 'node-fetch';
import { URL } from 'url';
import { request } from '../../shared/http';
import { HTTPConnectorInfo, HTTPPanelInfo, Proxy } from '../../shared/state';
import { rpcEvalHandler } from './eval';
import { parseParquet } from './parquet';
import { tunnel } from './tunnel';

export const additionalParsers = {
  parquet: parseParquet,
};

export const evalHTTPHandler = rpcEvalHandler<HTTPPanelInfo, HTTPConnectorInfo>(
  {
    resource: 'evalHTTP',
    handler: async function (
      _: string,
      body: string,
      hci: Proxy<HTTPPanelInfo, HTTPConnectorInfo>
    ) {
      const url = new URL(
        (hci.connector.http.url.startsWith('http') ? '' : 'http://') +
          hci.connector.http.url
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
            hci.connector.http.method,
            tunnelledUrl.toString(),
            { ...hci.connector.http.contentTypeInfo, additionalParsers },
            hci.connector.http.headers,
            body
          );
        }
      );
    },
  }
);
