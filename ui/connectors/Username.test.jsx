const React = require('react');
const enzyme = require('enzyme');
const { DatabaseConnectorInfo } = require('../../shared/state');
const { wait } = require('../../shared/promise');
const { Username } = require('./Username');
const { INPUT_SYNC_PERIOD } = require('../components/Input');

test('Username shows input and changes', async () => {
  const connector = new DatabaseConnectorInfo();

  const changeTo = 'admin';
  let changed = '';
  const updateConnector = jest.fn((conn) => {
    changed = conn.database.username;
  });
  const component = enzyme.mount(
    <Username connector={connector} updateConnector={updateConnector} />
  );

  expect(changed).toBe('');
  await component
    .find('input')
    .simulate('change', { target: { value: changeTo } });
  await wait(INPUT_SYNC_PERIOD + 100); // Allow local state buffer to propagate
  expect(changed).toBe(changeTo);
});
