import { HTTPConnectorInfo } from './state';
import { parseArrayBuffer, Parsers } from './text';

export type FetchFunction = (
  url: string,
  args: {
    headers: { [key: string]: string };
    method: string;
    body?: string;
  }
) => any;

export async function request(
  fetchFunction: FetchFunction,
  { http }: HTTPConnectorInfo,
  content: string,
  additionalParsers?: Parsers
) {
  const headers: { [v: string]: string } = {};
  http.headers.forEach((h: { value: string; name: string }) => {
    if (h.name.length && h.value.length) {
      headers[h.name] = h.value;
    }
  });
  const method = http.method;
  const res = await fetchFunction(http.url, {
    headers,
    method,
    body: method !== 'GET' && method !== 'HEAD' ? content : undefined,
  });
  const body = await res.arrayBuffer();
  const type = res.headers.get('content-type');
  return await parseArrayBuffer(type, http.url, body, additionalParsers);
}
