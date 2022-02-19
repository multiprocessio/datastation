const { Config, mergeFromEnv } = require('./config');

test('mergeFromEnv', function testMergeFromEnv() {
  const c = new Config();
  expect(c.database.address).toBe('localhost:5432');

  mergeFromEnv(c, {
    DATASTATION_DATABASE_ADDRESS: 'pg.domain.com',
  });

  expect(c.database.address).toBe('pg.domain.com');

  mergeFromEnv(c, {
    DATASTATION_SERVER_ADDRESS: '0.0.0.0:8080',
  });

  expect(c.database.address).toBe('pg.domain.com');
  expect(c.server.address).toBe('0.0.0.0:8080');
});
