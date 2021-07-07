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
  method: string,
  url: string,
  headers: Array<{ name: string; value: string }> = [],
  content = '',
  additionalParsers: Parsers = undefined,
  require200 = false
) {
  if (!(url.startsWith('https://') || url.startsWith('http://'))) {
    url = 'http://' + url;
  }
  const headersDict: { [v: string]: string } = {};
  headers.forEach((h: { value: string; name: string }) => {
    if (h.name.length && h.value.length) {
      headersDict[h.name] = h.value;
    }
  });
  const res = await fetchFunction(url, {
    headers: headersDict,
    method,
    body: method !== 'GET' && method !== 'HEAD' ? content : undefined,
  });

  const body = await res.arrayBuffer();
  const type = res.headers.get('content-type');
  const data = await parseArrayBuffer(type, url, body, additionalParsers);
  if (require200 && res.status !== 200) {
    throw data;
  }

  return data;
}
