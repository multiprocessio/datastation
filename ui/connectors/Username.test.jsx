const React = require('react');
const enzyme = require('enzyme');
const { DatabaseConnectorInfo } = require('../../shared/state');
const { wait } = require('../../shared/promise');
const { Username } = require('./Username');

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
  await component.find('input').simulate('blur');
  expect(changed).toBe(changeTo);
});
