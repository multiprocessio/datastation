const React = require('react');
const { act } = require('react-dom/test-utils');
const { wait } = require('../../shared/promise');
const { INPUT_SYNC_PERIOD } = require('../components/Input');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResult,
  ProjectPage,
  LiteralPanelInfo,
  FilterAggregatePanelInfo,
} = require('../../shared/state');
const { FilterAggregatePanelDetails } = require('./FilterAggregatePanel');

const project = new ProjectState();
project.pages = [new ProjectPage()];
const lp = new LiteralPanelInfo();
const fp = new FilterAggregatePanelInfo(null, {
  panelSource: lp.info,
  aggregateType: 'sum',
});
project.pages[0].panels = [lp, fp];

test('shows filagg panel details', async () => {
  const component = enzyme.mount(
    <FilterAggregatePanelDetails
      panel={project.pages[0].panels[1]}
      panels={project.pages[0].panels}
      updatePanel={(p) => {
        Object.assign(project.pages[0].panels[1], p);
      }}
    />
  );

  await componentLoad(component);

  expect(fp.filagg.sortAsc).toBe(false);
  const sortDirection = () =>
    component.find('[data-test-id="sort-direction"] select');
  await sortDirection().simulate('change', { target: { value: 'asc' } });
  expect(fp.filagg.sortAsc).toBe(true);
  component.setProps();
  expect(sortDirection().props().value).toBe('asc');

  const sortField = () => component.find('[data-test-id="sort-field"] input');
  await sortField().simulate('change', { target: { value: 'flubberty' } });
  await wait();
  expect(fp.filagg.sortOn).toBe('flubberty');
});
