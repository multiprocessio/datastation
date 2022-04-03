import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import React from 'react';
import { title } from '../../shared/text';
import { History as HistoryT } from '../shared/state';
import { asyncRPC } from '../../ui/asyncRPC';
import { Loading } from '../../ui/components/Loading';
import { Button } from '../../ui/components/Button';
import { diffJson } from 'diff';
import { Endpoint, GetHistoryRequest, GetHistoryResponse } from '../shared/rpc';

function diff(oldValue: string, newValue: string) {
  const o = JSON.parse(oldValue);
  const n = JSON.parse(newValue);
  return diffJson(o, n);
}

export function History() {
  const [page, setPage] = React.useState<GetHistoryResponse['history']>([]);
  const [lastId, setLastId] = React.useState('');

  React.useEffect(() => {
    async function load() {
      const rsp = await asyncRPC<GetHistoryRequest, GetHistoryResponse, Endpoint>('getHistory', {
        lastId,
      });
      setPage(rsp.history.map(HistoryT.fromJSON));
    }

    load();
  }, [lastId]);

  if (!page || !page.length) {
    return <Loading />;
  }

  return (
    <div className="card history">
      <h1>History</h1>
      <table className="table table--large">
        <thead>
          <th>Time</th>
          <th>Action</th>
          <th>Entity Type</th>
          <th>Entity ID</th>
          <th>Old Value</th>
          <th>New Value</th>
        </thead>
        <tbody>
          {page.map((entry) =>
            <tr>
              <td><span title={entry.dt.toISOString()}>{formatDistanceToNow(entry.dt)}</span></td>
              <td>{title(entry.action)}</td>
              <td>{title(entry.table.slice('ds_'.length))}</td>
              <td>{entry.pk}</td>
              <td><pre>{JSON.stringify(JSON.parse(entry.oldValue), null, 2)}</pre></td>
              <td><pre>{JSON.stringify(JSON.parse(entry.newValue), null, 2)}</pre></td>
            </tr>
          )}
        </tbody>
      </table>

      <Button onClick={() => setLastId(page[page.length - 1].id)}>Next page</Button>
    </div>
  )
}
