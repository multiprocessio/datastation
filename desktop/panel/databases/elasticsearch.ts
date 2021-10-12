import { Client, ClientOptions } from '@elastic/elasticsearch';
import log from '../../../shared/log';
import { timestampsFromRange } from '../../../shared/sql';
import {
  DatabaseConnectorInfo,
  DatabasePanelInfo,
  TimeSeriesRange,
} from '../../../shared/state';
import { fullHttpURL } from '../../../shared/url';
import { EvalHandlerResponse } from '../types';

export async function evalElasticsearch(
  query: string,
  range: TimeSeriesRange,
  host: string,
  port: number,
  connector: DatabaseConnectorInfo,
  panel: DatabasePanelInfo
): Promise<EvalHandlerResponse> {
  const config: ClientOptions = {
    node: fullHttpURL(host, port),
  };
  if (connector.database.apiKey_encrypt.value) {
    config.auth = {
      apiKey: connector.database.apiKey_encrypt.value,
    };
    // Maybe bearer is only supported in es7?
    // } else if (connector.database.bearer_encrypt.value) {
    //   config.auth = {
    //     bearer: connector.database.bearer_encrypt.value,
    //   };
  } else if (connector.database.password_encrypt.value) {
    config.auth = {
      username: connector.database.username,
      password: connector.database.password_encrypt.value,
    };
  }

  if (range.field) {
    const { begin, end } = timestampsFromRange(range);
    query =
      (query ? `(${query}) AND ` : '') +
      `${range.field}:[${begin.toISOString()} TO ${end.toISOString()}]`;
  }

  const client = new Client(config);

  let results: Array<{ [k: string]: any }> = [];
  const pageSize = 1000;
  while (true) {
    const req = {
      size: pageSize,
      index: panel.database.table.split(','),
      q: query,
      // TODO: support tiebreaker sorting as recommended: https://www.elastic.co/guide/en/elasticsearch/reference/6.8/search-request-search-after.html
      sort: range.field ? `${range.field}:desc` : undefined,
      body: {
        search_after: results.length
          ? [results[results.length - 1][range.field]]
          : undefined,
      },
    };
    log.info('Elasticsearch request: ' + JSON.stringify(req));
    const res = await client.search(req);

    results = results.concat(res.body.hits.hits);

    if (res.body.hits.hits.length < pageSize) {
      break;
    }
  }

  return { value: results };
}
