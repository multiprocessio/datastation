const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {History} = require('../shared/state');
const { HistoryList } = require('./History');

test('shows program panel details', async () => {
  const entries = [
    new History(),
    new History(),
  ];
  const component = enzyme.mount(
    <HistoryList page={entries} />
  );
  await componentLoad(component);
  const trows = component.find('tbody tr');
  expect(trows.length).toBe(2);
});
