const React = require('react');
const enzyme = require('enzyme');
const { DatabaseConnectorInfo } = require('../../shared/state');
const { wait } = require('../../shared/promise');
const { Database } = require('./Database');
const { INPUT_SYNC_PERIOD } = require('../component-library/Input');

test('Database shows input and changes', async () => {
  const connector = new DatabaseConnectorInfo();

  const changeTo = 'localhost:9090';
  let changed = '';
  const updateConnector = jest.fn((conn) => {
    changed = conn.database.database;
  });
  const component = enzyme.mount(
    <Database connector={connector} updateConnector={updateConnector} />
  );

  expect(changed).toBe('');
  await component
    .find('input')
    .simulate('change', { target: { value: changeTo } });
  await wait(INPUT_SYNC_PERIOD + 100); // Allow local state buffer to propagate
  expect(changed).toBe(changeTo);
});
