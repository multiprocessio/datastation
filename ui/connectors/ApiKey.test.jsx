const React = require('react');
const enzyme = require('enzyme');
const { DatabaseConnectorInfo } = require('../../shared/state');
const { ApiKey } = require('./ApiKey');

test('ApiKey shows input and changes', async () => {
  const connector = new DatabaseConnectorInfo();

  const changeTo = 'my-great-password';
  let changed = '';
  const updateConnector = jest.fn((conn) => {
    changed = conn.database.apiKey_encrypt.value;
  });
  const component = enzyme.mount(
    <ApiKey connector={connector} updateConnector={updateConnector} />
  );

  expect(changed).toBe('');
  await component
    .find('input')
    .simulate('change', { target: { value: changeTo } });
  await component.find('input').simulate('blur');
  expect(changed).toBe(changeTo);
});
