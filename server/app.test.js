const { App, init } = require('./app');

describe('app.migrate', function () {
  test('no existing migrations', async function () {
    const client = {
      query: jest.fn(function query(sql) {
        if (sql === 'SELECT migration_name FROM migrations') {
          return [];
        }
      }),
      release: jest.fn(),
    };
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
        }[name];
      },
    };

    await app.migrate();

    expect(client.query.mock.calls).toStrictEqual([
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

    expect(client.release.mock.calls.length).toBe(1);
  });

  test('one existing migration', async function () {
    function expressFactory() {}

    const client = {
      query: jest.fn(function query(sql) {
        if (sql === 'SELECT migration_name FROM migrations') {
          return ['1_init.sql'];
        }
      }),
      release: jest.fn(),
    };
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
      expressFactory,
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

    expect(client.query.mock.calls).toStrictEqual([
      ['SELECT migration_name FROM migrations'],
      ['BEGIN'],
      ['SELECT 2'],
      [
        'INSERT INTO migrations (migration_name) VALUES ($1)',
        ['2_some_change.sql'],
      ],
      ['COMMIT'],
    ]);

    expect(client.release.mock.calls.length).toBe(1);
  });
});

describe('app.serve', function () {
  test('it listens', async function () {
    const { app } = await init(App.make);

    const server = { listen: jest.fn };
    app.http.createServer = jest.fn(server);
    app.https.createServer = jest.fn(server);

    await app.serve();

    expect(app.http.createServer.mock.calls.length).toBe(1);
    expect(app.https.createServer.mock.calls.length).toBe(0);

    expect(server.listen.mock.calls.length).toBe(1);
  });
});

describe('init', function () {
  const factoryApp = { migrate: jest.fn() };
  const appFactory = (c) => factoryApp;
  // TODO: test { handlers } in response
  const { app } = init(appFactory);
  expect(app).toBe(factoryApp);
  expect(app.migrate.mock.calls.length).toBe(1);
});
