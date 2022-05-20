const React = require('react');
const enzyme = require('enzyme');
const { DatabaseConnectorInfo } = require('../../shared/state');
const { wait } = require('../../shared/promise');
const { Database } = require('./Database');

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
  await component.find('input').simulate('blur');
  expect(changed).toBe(changeTo);
});
