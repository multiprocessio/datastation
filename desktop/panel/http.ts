import fetch from 'node-fetch';
import { URL } from 'url';
import { request } from '../../shared/http';
import { ProjectState, HTTPPanelInfo, PanelInfo } from '../../shared/state';
import { parseParquet } from './parquet';
import { tunnel } from './tunnel';
import { EvalHandlerExtra, EvalHandlerResponse, guardPanel } from './types';

export const additionalParsers = {
  parquet: parseParquet,
};

export async function evalHTTP(
  project: ProjectState,
  panel: PanelInfo,
): Promise<EvalHandlerResponse> {
  const hci = guardPanel<HTTPPanelInfo>(panel, 'http');

  const url = new URL(
    (hci.http.http.url.startsWith('http') ? '' : 'http://') + hci.http.http.url
  );
  return await tunnel(
    project,
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
        hci.content
      );
    }
  );
}
