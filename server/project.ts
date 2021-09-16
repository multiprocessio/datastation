import { Pool } from 'pg';
import { encryptProjectSecrets, nullProjectSecrets } from '../desktop/store';
import { ProjectState } from '../shared/state';
import { App } from './app';

export const getProjectHandlers = (app: App) => {
  const { host, port } = new URL(app.config.database.address);
  app.dbpool = new Pool({
    user: app.config.database.username || '',
    password: app.config.database.password || '',
    database: app.config.database.database,
    host,
    port: +port,
  });

  return [
    {
      resource: 'getProjects',
      handler: async (): Promise<
        Array<{ name: string; createdAt: string }>
      > => {
        const client = await app.dbpool.connect();
        try {
          const res = await app.dbpool.query(
            'SELECT project_name, project_created_at FROM projects;'
          );
          return res.rows.map((row: any) => ({
            name: row.project_name,
            createdAt: row.project_created_at,
          }));
        } finally {
          client.release();
        }
      },
    },
    {
      resource: 'getProjectState',
      handler: async (projectId: string): Promise<ProjectState> => {
        const client = await app.dbpool.connect();
        try {
          const res = await app.dbpool.query(
            'SELECT project_value FROM projects WHERE project_name = $1;',
            [projectId]
          );
          const ps = JSON.parse(res.rows[0].project_value);
          nullProjectSecrets(ps);
          return ps;
        } finally {
          client.release();
        }
      },
    },
    {
      resource: 'updateProjectState',
      handler: async (projectId: string, _: string, newState: ProjectState) => {
        const client = await app.dbpool.connect();
        await encryptProjectSecrets(newState);
        try {
          await app.dbpool.query(
            'INSERT INTO projects (project_name, project_value) VALUES ($1, $2) ON CONFLICT DO UPDATE',
            [projectId, JSON.stringify(newState)]
          );
          return newState;
        } finally {
          client.release();
        }
      },
    },
  ];
};
