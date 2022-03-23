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
	action: 'update'
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

  async auditUpdatePage(payload: RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdatePageRequest;
    return this.auditUpdateGeneric(
      payload,
      external,
      'ds_page',
      body.data.id,
      this.store.getPageHandler.handler
    );
  }

  async auditUpdatePanel(payload: RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdatePanelRequest;
    return this.auditUpdateGeneric(
      payload,
      external,
      'ds_panel',
      body.data.id,
      this.store.getPanelHandler.handler
    );
  }

  async auditUpdateConnector(payload: RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdateConnectorRequest;
    return this.auditUpdateGeneric(
      payload,
      external,
      'ds_connector',
      body.data.id,
      this.store.getConnectorHandler.handler
    );
  }

  async auditUpdateServer(payload: RPCPayload, external?: boolean) {
    const body = payload.body as rpc_types_ce.UpdateServerRequest;
    return this.auditUpdateGeneric(
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
    // Only need to audit external requests (i.e by the user)
    if (external) {
      switch (payload.resource) {
        case 'updatePage':
          return this.auditUpdatePage(payload, external);
        case 'updatePanel':
          return this.auditUpdatePanel(payload, external);
        case 'updateServer':
          return this.auditUpdateServer(payload, external);
        case 'updateConnector':
          return this.auditUpdateConnector(payload, external);

	  // TODO: implement these
	case 'deletePage':
          return this.auditDeletePage(payload, external);
        case 'deletePanel':
          return this.auditDeletePanel(payload, external);
        case 'deleteServer':
          return this.auditDeleteServer(payload, external);
        case 'deleteConnector':
          return this.auditDeleteConnector(payload, external);
      }
    }

    return this.dispatch(payload);
  };
}
