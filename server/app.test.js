const { Config } = require('./config');
const { App, init } = require('./app');

const basicConfig = new Config();
basicConfig.auth.sessionSecret = 'a secret test secret';
// Not great but for now the tests need a working openid server, set up with garbage configuration.
basicConfig.auth.openId = {
  realm: 'https://accounts.google.com',
  clientId: '12',
  clientSecret: '89',
};
basicConfig.server.tlsKey = '';
basicConfig.server.tlsCert = '';

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

      const app = new App(basicConfig, pgPoolFactory);

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

      const app = new App(basicConfig, pgPoolFactory);

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
  let app = new App(basicConfig, () => {});
  app.http.createServer = jest.fn(() => server);
  app.https.createServer = jest.fn(() => server);

  beforeAll(async function () {
    await app.serve();
  });

  test('it creates server', () => {
    expect(app.http.createServer.mock.calls.length).toBe(1);
    expect(app.https.createServer.mock.calls.length).toBe(0);
  });

  test('it listens', () => {
    expect(server.listen.mock.calls.length).toBe(1);
  });
});

describe('init', function () {
  test('calls migrate', async function () {
    const app = { projectHandlers: [] };
    const { handlers } = await init(app);
    expect(handlers.length).toBe(6);
  });
});
