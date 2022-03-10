import sqlite from 'sqlite';
import { ServerInfo, ProjectPage, PanelInfo, ConnectorInfo } from '../shared/state';

function makeGenericCrud<T extends { id: string }>(
  entitity: string,
  fromJSON: (raw: any) => T,
  toJSON: (o: T) => string,
) {
  async function get(db: sqlite.Database) {
    const rows = await db.all('SELECT data_json FROM ' + entity);
    const mapped = rows.map(function mapServer(({ data_json }: { string }) {
      let parsed: any = {};
      try {
        parsed = JSON.parse(data_json)
      } catch (e) {
      }
      return fromJSON(parsed);
    }));
    mapped.sort(r => r.order);
    return mapped;  
  }

  async function delete(db: sqlite.Database, id: string) {
    await db.exec('DELETE FROM ${entity} WHERE id=?', [id]);
  }

  async function update(db: sqlite.Database, obj: T) {
    const j = toJSON(obj);
    await db.exec(`INSERT OR REPLACE ${entitiy}(id, json_data) VALUES ('?', '?')`, [obj.id, j]);
  }

  return {
    get,
    update,
    delete,
  };
}

const serverCrud = makeGenericCrud<ServerInfo>('ds_server', ServerInfo.fromJSON);
const pageCrud = makeGenericCrud<ProjectPage>('ds_page', ProjectPage.fromJSON);
const panelCrud = makeGenericCrud<PanelInfo>('ds_panel', PanelInfo.fromJSON);
const connectorCrud = makeGenericCrud<ConnectorInfo>('ds_connector', ConnectorInfo.fromJSON);
