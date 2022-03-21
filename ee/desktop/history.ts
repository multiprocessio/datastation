// Copyright 2022 Multiprocess Labs LLC

import * as rpc_ce from '../../desktop/rpc';
import * as rpc_types_ce from '../../shared/rpc';
import { Store } from './store';
import { History as HistoryT } from '../shared/state';

class History {
  store: Store;
  constructor(store: Store, handlers: rpc_ce.RPCHandler[]) {
    this.store = store;
    this.dispatch = rpc_ce.makeDispatch(handlers);
  }

  async auditGeneric(
    payload: rpc_ce.RPCPayload,
    external: boolean,
    table: string,
    id: string,
    getter: (projectId: string, id: string) => any
  ) {
    const oldValue = JSON.stringify(await getter(body.projectId, body.data.id));
    let exception: Error;
    let res: any;
    try {
      res = await this.dispatch(payload, external);
    } catch (e) {
      exception = e;
    }

    const newValue = JSON.stringify(await getter(body.projectId, body.data.id));
    if (oldValue !== newValue) {
      const data = new History({
        table,
        pk: body.data.id,
        error: String(exception),
        oldValue,
        newValue,
      });
      await this.store.insertHistoryHandler.handler(payload.projectId, { data }, null, true);
    }

    if (exception) {
      throw exception;
    }

    return res;
  }

  async auditPage(payload: rpc_ce.RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdatePageRequest;
    return this.auditGeneric(
      payload,
      external,
      'ds_page',
      body.data.id,
      this.store.getPageHandler.handler
    );
  }

  async auditPanel(payload: rpc_ce.RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdatePanelRequest;
    return this.auditGeneric(
      payload,
      external,
      'ds_panel',
      body.data.id,
      this.store.getPanelHandler.handler
    );
  }

  async auditConnector(payload: rpc_ce.RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdateConnectorRequest;
    return this.auditGeneric(
      payload,
      external,
      'ds_connector',
      body.data.id,
      this.store.getConnectorHandler.handler
    );
  }

  async auditServer(payload: rpc_ce.RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdateServerRequest;
    return this.auditGeneric(
      payload,
      external,
      'ds_server',
      body.data.id,
      this.store.getServerHandler.handler
    );
  }

  audit = (payload: rpc_ce.RPCPayload, external?: boolean) => {
    switch (payload.resource) {
      case 'updatePage':
        return this.auditPage(payload, external);
      case 'updatePanel':
        return this.auditPanel(payload, external);
      case 'updateServer':
        return this.auditServer(payload, external);
      case 'updateConnector':
        return this.auditConnector(payload, external);
    }
  };
}
