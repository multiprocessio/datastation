// Copyright 2022 Multiprocess Labs LLC

import * as rpc_ce from '../../desktop/rpc';
import * as rpc_types_ce from '../../shared/rpc';
import { RPCPayload, Dispatch } from './rpc';
import { Store } from './store';
import { History as HistoryT } from '../shared/state';

export class History {
  store: Store;
  dispatch: Dispatch;
  constructor(store: Store, handlers: rpc_ce.RPCHandler<any, any>[]) {
    this.store = store;
    this.dispatch = rpc_ce.makeDispatch(handlers);
  }

  async auditGeneric(
    payload: RPCPayload,
    external: boolean,
    table: string,
    id: string,
    getter: (
      projectId: string,
      body: { id: string },
      dispatch: Dispatch,
      external: boolean
    ) => Promise<any>
  ) {
    const oldValue = JSON.stringify(
      await getter(payload.projectId, { id }, null, false)
    );
    let exception: Error;
    let res: any;
    try {
      res = await this.dispatch(payload);
    } catch (e) {
      exception = e;
    }

    const newValue = JSON.stringify(
      await getter(payload.projectId, { id }, null, false)
    );
    if (oldValue !== newValue) {
      const data = new HistoryT({
        table,
        pk: id,
        error: String(exception),
        oldValue,
        newValue,
        userId: '1',
      });
      await this.store.insertHistoryHandler.handler(
        payload.projectId,
        { data },
        null,
        true
      );
    }

    if (exception) {
      throw exception;
    }

    return res;
  }

  async auditPage(payload: RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdatePageRequest;
    return this.auditGeneric(
      payload,
      external,
      'ds_page',
      body.data.id,
      this.store.getPageHandler.handler
    );
  }

  async auditPanel(payload: RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdatePanelRequest;
    return this.auditGeneric(
      payload,
      external,
      'ds_panel',
      body.data.id,
      this.store.getPanelHandler.handler
    );
  }

  async auditConnector(payload: RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdateConnectorRequest;
    return this.auditGeneric(
      payload,
      external,
      'ds_connector',
      body.data.id,
      this.store.getConnectorHandler.handler
    );
  }

  async auditServer(payload: RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdateServerRequest;
    return this.auditGeneric(
      payload,
      external,
      'ds_server',
      body.data.id,
      this.store.getServerHandler.handler
    );
  }

  ensureUser(projectId: string) {
    const db = this.store.getConnection(projectId);
    db.exec(
      `INSERT OR REPLACE INTO ds_user (id, name) VALUES ('1', 'Default User')`
    );
  }

  audit = (payload: RPCPayload, external?: boolean) => {
    this.ensureUser(payload.projectId);

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
