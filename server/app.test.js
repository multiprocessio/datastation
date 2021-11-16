const { App, init } = require('./app');

describe('app.migrate', function () {
  describe('zero existing', function () {
    const client = {
      query: jest.fn(function query(sql) {
        if (sql === 'SELECT migration_name FROM migrations') {
          return [];
        }
      }),
      release: jest.fn(),
    };

    beforeAll(async () => {
      function pgPoolFactory() {
        return {
          connect() {
            return client;
          },
        };
      }

      const app = new App(
        {
          database: {
            address: '',
            username: '',
            password: '',
            database: '',
          },
        },
        pgPoolFactory
      );

      app.fs = {
        readdirSync() {
          return ['2_some_change.sql', '1_init.sql'];
        },
        readFileSync(name) {
          return {
            '2_some_change.sql': 'SELECT 2',
            '1_init.sql': 'SELECT 1',
          }[name.split('/').pop()];
        },
      };

      await app.migrate();
    });

    test('all database queries', () => {
      expect([...client.query.mock.calls]).toMatchObject([
        ['SELECT migration_name FROM migrations'],
        ['BEGIN'],
        ['SELECT 1'],
        ['INSERT INTO migrations (migration_name) VALUES ($1)', ['1_init.sql']],
        ['COMMIT'],
        ['BEGIN'],
        ['SELECT 2'],
        [
          'INSERT INTO migrations (migration_name) VALUES ($1)',
          ['2_some_change.sql'],
        ],
        ['COMMIT'],
      ]);
    });

    test('release called', () => {
      expect(client.release.mock.calls.length).toBe(1);
    });
  });

  describe('one existing', function () {
    const client = {
      query: jest.fn(function query(sql) {
        if (sql === 'SELECT migration_name FROM migrations') {
          return { rows: [{ migration_name: '1_init.sql' }] };
        }
      }),
      release: jest.fn(),
    };

    beforeAll(async () => {
      function pgPoolFactory() {
        return {
          connect() {
            return client;
          },
        };
      }

      const app = new App(
        {
          database: {
            address: '',
            username: '',
            password: '',
            database: '',
          },
        },
        pgPoolFactory
      );

      app.fs = {
        readdirSync() {
          return ['2_some_change.sql', '1_init.sql'];
        },
        readFileSync(name) {
          return {
            '2_some_change.sql': 'SELECT 2',
            '1_init.sql': 'SELECT 1',
          }[name.split('/').pop()];
        },
      };

      await app.migrate();
    });

    test('all database queries', () => {
      expect([...client.query.mock.calls]).toMatchObject([
        ['SELECT migration_name FROM migrations'],
        ['BEGIN'],
        ['SELECT 2'],
        [
          'INSERT INTO migrations (migration_name) VALUES ($1)',
          ['2_some_change.sql'],
        ],
        ['COMMIT'],
      ]);
    });

    test('release called', () => {
      expect(client.release.mock.calls.length).toBe(1);
    });
  });
});

describe('app.serve', function () {
  const server = { listen: jest.fn() };
  let app;
  beforeAll(async function () {
    ({ app } = await init(App.make));

    app.http.createServer = jest.fn(() => server);
    app.https.createServer = jest.fn(() => server);

    await app.serve();
  });

  test('it creates server', () => {
    expect(app.http.createServer.mock.calls.length).toBe(0);
    expect(app.https.createServer.mock.calls.length).toBe(1);
  });

  test('it listens', () => {
    expect(server.listen.mock.calls.length).toBe(1);
  });
});

describe('init', function () {
  test('calls migrate', async function () {
    const factoryApp = { projectHandlers: [] };
    const appFactory = (c) => factoryApp;
    // TODO: test { handlers } in response
    const { app } = await init(appFactory);
    expect(app).toBe(factoryApp);
  });
});
