const React = require('react');
const enzyme = require('enzyme');
const { SQLConnectorInfo } = require('../../shared/state');
const { wait } = require('../../shared/promise');
const { Host } = require('./Host');
const { INPUT_SYNC_PERIOD } = require('../component-library/Input');

test('Host shows input and changes', async () => {
  const connector = new SQLConnectorInfo();

  const changeTo = 'localhost:9090';
  let changed = '';
  const updateConnector = jest.fn((conn) => {
    changed = conn.sql.address;
  });
  const component = enzyme.mount(
    <Host connector={connector} updateConnector={updateConnector} />
  );

  expect(changed).toBe('');
  await component
    .find('input')
    .simulate('change', { target: { value: changeTo } });
  await wait(INPUT_SYNC_PERIOD + 100); // Allow local state buffer to propagate
  expect(changed).toBe(changeTo);
});
