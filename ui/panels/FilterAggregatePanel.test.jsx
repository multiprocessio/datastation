const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResultMeta,
  ProjectPage,
  LiteralPanelInfo,
  FilterAggregatePanelInfo,
} = require('../../shared/state');
const { FilterAggregatePanelDetails } = require('./FilterAggregatePanel');

const project = new ProjectState();
project.pages = [new ProjectPage()];
const lp = new LiteralPanelInfo();
const fp = new FilterAggregatePanelInfo({
  panelSource: lp.info,
  aggregateType: 'sum',
});
project.pages[0].panels = [lp, fp];

test('shows filagg panel details', async () => {
  const component = enzyme.mount(
    <FilterAggregatePanelDetails
      panel={fp}
      panels={project.pages[0].panels}
      updatePanel={() => {}}
    />
  );
  await componentLoad(component);
});
