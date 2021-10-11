import { Pool } from 'pg';
import {
  GetProjectHandler,
  MakeProjectHandler,
  RPCHandler,
  UpdateProjectHandler,
} from '../desktop/rpc';
import { encryptProjectSecrets } from '../desktop/store';
import { GetProjectsRequest, GetProjectsResponse } from '../shared/rpc';
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

  const getProjects: RPCHandler<GetProjectsRequest, GetProjectsResponse> = {
    resource: 'getProjects',
    handler: async function getProjectsHandler(): Promise<
      Array<{ name: string; createdAt: string }>
    > {
      const client = await app.dbpool.connect();
      try {
        const res = await client.query(
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
  };

  const getProject: GetProjectHandler = {
    resource: 'getProject',
    handler: async function getProjectHandler(
      _: string,
      { projectId }: { projectId: string },
      _1: unknown,
      external: boolean
    ): Promise<ProjectState> {
      const client = await app.dbpool.connect();
      try {
        const res = await client.query(
          'SELECT project_value FROM projects WHERE project_name = $1;',
          [projectId]
        );
        const ps = res.rows[0].project_value;
        return await ProjectState.fromJSON(ps, external);
      } finally {
        client.release();
      }
    },
  };

  const updateProject: UpdateProjectHandler = {
    resource: 'updateProject',
    handler: async function updateProjectHandler(
      projectId: string,
      newState: ProjectState
    ) {
      const client = await app.dbpool.connect();
      const res = await client.query(
        'SELECT project_value FROM projects WHERE project_name = $1;',
        [projectId]
      );
      const existingState = res.rows[0].project_value;
      await encryptProjectSecrets(newState, existingState);
      try {
        await client.query(
          'INSERT INTO projects (project_name, project_value) VALUES ($1, $2) ON CONFLICT (project_name) DO UPDATE SET project_value = EXCLUDED.project_value',
          [projectId, JSON.stringify(newState)]
        );
      } finally {
        client.release();
      }
    },
  };

  const makeProject: MakeProjectHandler = {
    resource: 'makeProject',
    handler: async function makeProjectHandler(
      _: string,
      { projectId }: { projectId: string }
    ) {
      const client = await app.dbpool.connect();
      try {
        await client.query(
          'INSERT INTO projects (project_name, project_value) VALUES ($1, $2)',
          [projectId, JSON.stringify(new ProjectState())]
        );
      } finally {
        client.release();
      }
    },
  };

  return [getProjects, getProject, updateProject, makeProject];
};
