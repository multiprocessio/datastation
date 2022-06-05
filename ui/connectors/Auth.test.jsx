const React = require('react');
const enzyme = require('enzyme');
const { DatabaseConnectorInfo } = require('../../shared/state');
const { Auth } = require('./Auth');

test('Auth mounts', async () => {
  const connector = new DatabaseConnectorInfo();
  const component = enzyme.mount(
    <Auth connector={connector} updateConnector={jest.fn()} />
  );
});
