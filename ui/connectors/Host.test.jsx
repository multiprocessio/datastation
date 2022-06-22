const React = require('react');
const enzyme = require('enzyme');
const { DatabaseConnectorInfo } = require('../../shared/state');
const { wait } = require('../../shared/promise');
const { Host } = require('./Host');

test('Host shows input and changes', async () => {
  const connector = new DatabaseConnectorInfo();

  const changeTo = 'localhost:9090';
  let changed = '';
  const updateConnector = jest.fn((conn) => {
    changed = conn.database.address;
  });
  const component = enzyme.mount(
    <Host connector={connector} updateConnector={updateConnector} />
  );

  expect(changed).toBe('');
  await component
    .find('input')
    .simulate('change', { target: { value: changeTo } });
  await component.find('input').simulate('blur');
  expect(changed).toBe(changeTo);
});
