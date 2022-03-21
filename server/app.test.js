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
