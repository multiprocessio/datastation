const React = require('react');
const enzyme = require('enzyme');
const { DatabaseConnectorInfo } = require('../../shared/state');
const { wait } = require('../../shared/promise');
const { Password } = require('./Password');
const { INPUT_SYNC_PERIOD } = require('../component-library/Input');

test('Password shows input and changes', async () => {
  const connector = new DatabaseConnectorInfo();

  const changeTo = 'my-great-password';
  let changed = '';
  const updateConnector = jest.fn((conn) => {
    changed = conn.database.password.value;
  });
  const component = enzyme.mount(
    <Password connector={connector} updateConnector={updateConnector} />
  );

  expect(changed).toBe('');
  await component
    .find('input')
    .simulate('change', { target: { value: changeTo } });
  await wait(INPUT_SYNC_PERIOD + 100); // Allow local state buffer to propagate
  expect(changed).toBe(changeTo);
});
