// Copyright 2022 Multiprocess Labs LLC

import * as rpc_ce from '../../desktop/rpc';
import * as rpc_types_ce from '../../shared/rpc';
import { History as HistoryT } from '../shared/state';
import { Dispatch, RPCPayload } from './rpc';
import { Store } from './store';

export class History {
  store: Store;
  dispatch: Dispatch;
  constructor(store: Store, handlers: rpc_ce.RPCHandler<any, any>[]) {
    this.store = store;
    this.dispatch = rpc_ce.makeDispatch(handlers);
  }

  async auditUpdateGeneric(
    payload: RPCPayload,
    table: string,
    id: string,
    getter: (
      projectId: string,
      body: { id: string },
      dispatch: Dispatch,
      external: boolean
    ) => Promise<any>
  ) {
    this.ensureUser(payload.projectId);
    const oldValue = await getter(payload.projectId, { id }, null, false);
    let exception: Error;
    let res: any;
    try {
      res = await this.dispatch(payload);
    } catch (e) {
      exception = e;
    }

    const newValue = await getter(payload.projectId, { id }, null, false);
    if (oldValue !== newValue) {
      const data = new HistoryT({
        table,
        pk: id,
        error: String(exception),
        oldValue,
        newValue,
        userId: '1',
        action: 'update',
      });
      await this.store.insertHistoryHandler.handler(
        payload.projectId,
        { data },
        null,
        false
      );
    }

    if (exception) {
      throw exception;
    }

    return res;
  }

  auditUpdatePage(payload: RPCPayload) {
    const body = payload.body as rpc_types_ce.UpdatePageRequest;
    return this.auditUpdateGeneric(
      payload,

      'ds_page',
      body.data.id,
      this.store.getPageHandler.handler
    );
  }

  auditUpdatePanel(payload: RPCPayload) {
    const body = payload.body as rpc_types_ce.UpdatePanelRequest;
    return this.auditUpdateGeneric(
      payload,
      'ds_panel',
      body.data.id,
      this.store.getPanelHandler.handler
    );
  }

  auditUpdateConnector(payload: RPCPayload) {
    const body = payload.body as rpc_types_ce.UpdateConnectorRequest;
    return this.auditUpdateGeneric(
      payload,
      'ds_connector',
      body.data.id,
      this.store.getConnectorHandler.handler
    );
  }

  auditUpdateServer(payload: RPCPayload) {
    const body = payload.body as rpc_types_ce.UpdateServerRequest;
    return this.auditUpdateGeneric(
      payload,
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

  async auditDeleteGeneric(payload: RPCPayload, table: string, id: string) {
    this.ensureUser(payload.projectId);
    let exception: Error;
    let res: any;
    try {
      res = await this.dispatch(payload);
    } catch (e) {
      exception = e;
    }

    const data = new HistoryT({
      table,
      pk: id,
      error: String(exception),
      oldValue: null,
      newValue: null,
      userId: '1',
      action: 'delete',
    });
    await this.store.insertHistoryHandler.handler(
      payload.projectId,
      { data },
      null,
      false
    );

    if (exception) {
      throw exception;
    }

    return res;
  }

  audit = (payload: RPCPayload, external?: boolean) => {
    switch (payload.resource) {
      case 'updatePage':
        return this.auditUpdatePage(payload);
      case 'updatePanel':
        return this.auditUpdatePanel(payload);
      case 'updateServer':
        return this.auditUpdateServer(payload);
      case 'updateConnector':
        return this.auditUpdateConnector(payload);

      case 'deletePage': {
        const body = payload.body as rpc_types_ce.DeletePageRequest;
        return this.auditDeleteGeneric(payload, 'ds_page', body.id);
      }
      case 'deletePanel': {
        const body = payload.body as rpc_types_ce.DeletePanelRequest;
        return this.auditDeleteGeneric(payload, 'ds_panel', body.id);
      }
      case 'deleteServer': {
        const body = payload.body as rpc_types_ce.DeleteServerRequest;
        return this.auditDeleteGeneric(payload, 'ds_server', body.id);
      }
      case 'deleteConnector': {
        const body = payload.body as rpc_types_ce.DeleteConnectorRequest;
        return this.auditDeleteGeneric(payload, 'ds_connector', body.id);
      }
    }

    return this.dispatch(payload, external);
  };
}
