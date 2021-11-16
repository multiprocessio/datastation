const { getProjectHandlers } = require('./project');
const { ProjectState } = require('../shared/state');

test('getProjects', async () => {
  const app = {
    config: {
      database: {
        address: 'localhost:5432',
        username: '',
        password: '',
        database: '',
      },
    },
    dbpool: {},
  };

  let done = false;
  app.dbpool.connect = () => {
    return {
      release() {
        done = true;
      },
      query(q) {
        expect(q).toBe(
          'SELECT project_name, project_created_at FROM projects;'
        );
        return {
          rows: [
            { project_name: 'x', project_created_at: '2021' },
            { project_name: 'y', project_created_at: '2020' },
          ],
        };
      },
    };
  };

  const handlers = getProjectHandlers(app.dbpool);
  const handler = handlers.find((h) => h.resource === 'getProjects');

  const projects = await handler.handler();
  expect(projects).toStrictEqual([
    { name: 'x', createdAt: '2021' },
    { name: 'y', createdAt: '2020' },
  ]);

  expect(done).toBe(true);
});

test('getProject', async () => {
  const app = {
    config: {
      database: {
        address: 'localhost:5432',
        username: '',
        password: '',
        database: '',
      },
    },
    dbpool: {},
  };

  let done = false;
  app.dbpool.connect = () => {
    return {
      release() {
        done = true;
      },
      query(q, [name]) {
        expect(q).toBe(
          'SELECT project_value FROM projects WHERE project_name = $1;'
        );
        expect(name).toBe('this project id');
        const project_value = new ProjectState();
        project_value.projectName = name;
        return { rows: [{ project_value }] };
      },
    };
  };

  const handlers = getProjectHandlers(app.dbpool);
  const handler = handlers.find((h) => h.resource === 'getProject');

  const project = await handler.handler(
    null,
    { projectId: 'this project id' },
    null,
    true
  );
  expect(project.projectName).toStrictEqual('this project id');

  expect(done).toBe(true);
});

test('makeProject', async () => {
  const app = {
    config: {
      database: {
        address: 'localhost:5432',
        username: '',
        password: '',
        database: '',
      },
    },
    dbpool: {},
  };

  let done = false;
  app.dbpool.connect = () => {
    return {
      release() {
        done = true;
      },
      query(q, [projectId, projectState]) {
        expect(q).toBe(
          'INSERT INTO projects (project_name, project_value) VALUES ($1, $2)'
        );
        expect(projectId).toBe('my great project');
        return { rows: [] };
      },
    };
  };

  const handlers = getProjectHandlers(app.dbpool);
  const handler = handlers.find((h) => h.resource === 'makeProject');
  await handler.handler(null, { projectId: 'my great project' });

  expect(done).toBe(true);
});
