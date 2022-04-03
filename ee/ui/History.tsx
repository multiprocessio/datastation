import React from 'react';
import { asyncRPC } from '../../ui/asyncRPC';
import { Loading } from '../../ui/components/Loading';
import { Button } from '../../ui/components/Button';
import { Endpoint, GetHistoryRequest, GetHistoryResponse } from '../shared/rpc';

export function History() {
  const [page, setPage] = React.useState<GetHistoryResponse['history']>([]);
  const [lastId, setLastId] = React.useState('');

  React.useEffect(() => {
    async function load() {
      const rsp = await asyncRPC<GetHistoryRequest, GetHistoryResponse, Endpoint>('getHistory', {
        lastId,
      });
      setPage(rsp.history);
    }

    load();
  }, [lastId]);

  if (!page || !page.length) {
    return <Loading />;
  }

  return (
    <div className="history-list">
      {page.map((entry) =>
        <div>{JSON.stringify(entry, null, 2)}</div>
      )}
      <Button onClick={() => setLastId(page[page.length - 1].id)}>Next page</Button>
    </div>
  )
}
