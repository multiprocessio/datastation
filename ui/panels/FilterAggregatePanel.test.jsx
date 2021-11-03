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
const { FilterAggregatePanel, FilterAggregatePanelDetails } = require('./FilterAggregatePanel');

const project = new ProjectState();
project.pages = [new ProjectPage()];
const lp = new LiteralPanelInfo();
const fp = new FilterAggregatePanelInfo({ panelSource: lp.info });
project.pages[0].panels = [
  lp,
  fp,
];

test('shows filagg panel details', async () => {
  const component = enzyme.mount(
    <FilterAggregatePanelDetails
    panel={fp}
    panels={project.pages[0].panels}
    updatePanel={() => {}}
    />);
  await componentLoad(component);
});

test('shows filled graph panel', async () => {
  fp.resultMeta = new PanelResultMeta({
    value: [
      { name: 'Nora', age: 33 },
      { name: 'Kay', age: 20 }
    ],
  });

  const component = enzyme.mount(
    <FilterAggregatePanel
    panel={fp}
    panels={project.pages[0].panels}
    updatePanel={() => {}}
    />);
  await componentLoad(component);
});
