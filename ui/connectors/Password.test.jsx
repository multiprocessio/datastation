const React = require('react');
const enzyme = require('enzyme');
const { DatabaseConnectorInfo } = require('../../shared/state');
const { wait } = require('../../shared/promise');
const { Password } = require('./Password');

test('Password shows input and changes', async () => {
  const connector = new DatabaseConnectorInfo();

  const changeTo = 'my-great-password';
  let changed = '';
  const updateConnector = jest.fn((conn) => {
    changed = conn.database.password_encrypt.value;
  });
  const component = enzyme.mount(
    <Password connector={connector} updateConnector={updateConnector} />
  );

  expect(changed).toBe('');
  await component
    .find('input')
    .simulate('change', { target: { value: changeTo } });
  await component.find('input').simulate('blur');
  expect(changed).toBe(changeTo);
});
