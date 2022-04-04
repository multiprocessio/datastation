const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const { History } = require('../shared/state');
const { newId } = require('../../shared/object');
const { ProgramPanelInfo, HTTPPanelInfo } = require('../../shared/state');
const { HistoryList } = require('./History');

test('shows program panel details', async () => {
  const entries = [
    new History({
      table: 'ds_page',
      pk: newId(),
      oldValue: 'null',
      newValue: 'null',
      userId: '1',
      action: 'delete',
    }),
    new History({
      table: 'ds_panel',
      pk: newId(),
      oldValue: JSON.stringify(new ProgramPanelInfo()),
      newValue: JSON.stringify(new ProgramPanelInfo(null, { content: 'DM_setPanel(1)' })),
      userId: '1',
      action: 'update',
    }),
    new History({
      table: 'ds_panel',
      pk: newId(),
      oldValue: 'null',
      newValue: JSON.stringify(new ProgramPanelInfo()),
      userId: '1',
      action: 'insert',
    }),
    new History({
      table: 'ds_panel',
      pk: newId(),
      oldValue: 'null',
      newValue: JSON.stringify(new HTTPPanelInfo()),
      userId: '1',
      action: 'insert',
    }),
  ];
  const component = enzyme.mount(<HistoryList page={entries} />);
  await componentLoad(component);
  const trows = component.find('tbody tr');
  expect(trows.length).toBe(4);

  const firstRowFirstCell = trows.at(0).find('td').at(0);
  expect(firstRowFirstCell.contains('Page')).toBe(true);
  expect(firstRowFirstCell.contains('Deleted')).toBe(true);
  expect(firstRowFirstCell.contains('less than a minute ago')).toBe(true);

  const secondRowFirstCell = trows.at(1).find('td').at(0);
  expect(secondRowFirstCell.contains('Program')).toBe(true);
  expect(secondRowFirstCell.contains('Panel')).toBe(true);
  expect(secondRowFirstCell.contains('Updated')).toBe(true);
  expect(secondRowFirstCell.contains('less than a minute ago')).toBe(true);

  // Test old value column
  const auditedOldValue = JSON.parse(entries[1].oldValue);
  delete auditedOldValue.id;
  delete auditedOldValue.defaultModified;
  delete auditedOldValue.type;
  expect(JSON.parse(trows.at(1).find('td').at(1).text())).toStrictEqual(auditedOldValue);

  // Test new value column
  const auditedNewValue = JSON.parse(entries[1].newValue);
  delete auditedNewValue.id;
  delete auditedNewValue.defaultModified;
  delete auditedNewValue.pageId;
  delete auditedNewValue.type;
  expect(JSON.parse(trows.at(1).find('td').at(2).text())).toStrictEqual(auditedNewValue);

  // Test diff column
  expect(trows.at(1).find('td').at(3).text().includes('Content became')).toBe(true);
  expect(trows.at(1).find('td').at(3).text().includes('DM_setPanel(1)')).toBe(true);

  const thirdRowFirstCell = trows.at(2).find('td').at(0);
  expect(thirdRowFirstCell.contains('Program')).toBe(true);
  expect(thirdRowFirstCell.contains('Panel')).toBe(true);
  expect(thirdRowFirstCell.contains('Created')).toBe(true);
  expect(thirdRowFirstCell.contains('less than a minute ago')).toBe(true);

  const fourthRowFirstCell = trows.at(2).find('td').at(0);
  expect(fourthRowFirstCell.contains('Program')).toBe(true);
  expect(fourthRowFirstCell.contains('Panel')).toBe(true);
  expect(fourthRowFirstCell.contains('Created')).toBe(true);
  expect(fourthRowFirstCell.contains('less than a minute ago')).toBe(true);
});
