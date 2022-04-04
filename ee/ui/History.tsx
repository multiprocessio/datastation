import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import React from 'react';
import { title } from '../../shared/text';
import { asyncRPC } from '../../ui/asyncRPC';
import { Button } from '../../ui/components/Button';
import { Loading } from '../../ui/components/Loading';
import { Endpoint, GetHistoryRequest, GetHistoryResponse } from '../shared/rpc';
import { History as HistoryT } from '../shared/state';

function diffable(jsonString: string) {
  let o: any = JSON.parse(jsonString);
  if (!o) {
    return '';
  }

  if (o.http) {
    const http = o.http;
    delete o.http;
    o = {
      ...o,
      ...http,
    };
  }

  if (typeof o.id !== 'undefined') {
    delete o.id;
  }
  if (typeof o.type !== 'undefined') {
    delete o.type;
  }
  if (typeof o.pageId !== 'undefined') {
    delete o.pageId;
  }
  if (typeof o.defaultModified !== 'undefined') {
    delete o.defaultModified;
  }

  return o;
}

function formatObject(jsonString: string) {
  const o = diffable(jsonString);
  if (!o) {
    return null;
  }

  return <pre>{JSON.stringify(o, null, 2)}</pre>;
}

function formatDiff(oldString: string, newString: string) {
  const oldVal = diffable(oldString) || {};
  const newVal = diffable(newString) || {};

  const entries: { key: string; value: string }[] = [];
  const allKeys = Array.from(
    new Set([...Object.keys(oldVal), ...Object.keys(newVal)])
  );
  for (const key of allKeys.sort()) {
    if (JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key])) {
      entries.push({ key, value: newVal[key] });
    }
  }

  if (!entries.length) {
    return <span className="text-muted">Internal-only changes.</span>;
  }

  return (
    <div className="value">
      {entries.map(({ key, value }) => (
        <div className="value-part" key={key}>
          {title(key)} became
          <pre className="ml-1">
            {typeof value === 'object' ? JSON.stringify(value, null, 2) : value}
          </pre>
        </div>
      ))}
    </div>
  );
}

function formatTable(entry: HistoryT) {
  const type = entry.table.slice('ds_'.length);
  if (type === 'panel') {
    const panelType = JSON.parse(entry.newValue)?.type;
    if (!panelType) {
      return title(type);
    }

    return (
      <>
        {panelType === 'http' ? 'HTTP' : title(panelType)} {title(type)}
      </>
    );
  }

  return title(type);
}

function formatAction(action: HistoryT['action']) {
  if (action === 'insert') {
    return 'Inserted';
  }

  if (action === 'delete') {
    return 'Deleted';
  }

  return 'Updated';
}

export function History() {
  const [page, setPage] = React.useState<GetHistoryResponse['history']>([]);
  const [lastId, setLastId] = React.useState('');

  React.useEffect(() => {
    async function load() {
      const rsp = await asyncRPC<
        GetHistoryRequest,
        GetHistoryResponse,
        Endpoint
      >('getHistory', {
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
    <div className="card history card--full">
      <h1>History</h1>
      <table className="table table--large">
        <thead>
          <tr>
            <th>Entity</th>
            <th>Old Value</th>
            <th>New Value</th>
            <th>Changes</th>
          </tr>
        </thead>
        <tbody>
          {page.map((entry) => (
            <tr key={entry.id}>
              <td>
                <div className="mb-1 text-muted">
                  {formatTable(entry)} {entry.pk}
                </div>
                <div className="mb-1">
                  {formatAction(entry.action)}{' '}
                  <span title={entry.dt.toISOString()}>
                    {formatDistanceToNow(entry.dt, { addSuffix: true })}
                  </span>
                </div>
              </td>
              <td>{formatObject(entry.oldValue)}</td>
              <td>{formatObject(entry.newValue)}</td>
              <td>
                {entry.action === 'update'
                  ? formatDiff(entry.oldValue, entry.newValue)
                  : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Button onClick={() => setLastId(page[page.length - 1].id)}>
        Next page
      </Button>
    </div>
  );
}
