const { App } = require('./app');

describe('app.migrate', async function () {
  function expressFactory() {}

  function pgPoolFactory() {
    return {
      query: jest.fn(function query(sql) {
	if (sql === 'SELECT migration_name FROM migrations') {
	  return [];
	}
      }),
    };
  }

  const app = new App({
    database: {
      address: '',
      username: '',
      password: '',
      database: '',
    },
  }, expressFactory, pgPoolFactory);

  app.fs = {
    readdirSync() {
      return ['1_migrate.sql'],
    },
    readFileSync() {
      return "SELECT 1";
    },
  };

  await app.migrate();
});

describe('app.serve', async function() {
  const expressFactory = () => {
    use() {

    }
  };
});

describe('init', function () {
  const appFactory = (c) => {
    migrate() {
    }
  };
  const { handlers, app } = init(appFactory);
});
