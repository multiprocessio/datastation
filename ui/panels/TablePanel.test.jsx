const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResultMeta,
  ProjectPage,
  LiteralPanelInfo,
  TablePanelInfo,
} = require('../../shared/state');
const { TablePanel, TablePanelDetails } = require('./TablePanel');

const project = new ProjectState();
project.pages = [new ProjectPage()];
const lp = new LiteralPanelInfo();
const tp = new TablePanelInfo({ panelSource: lp.info });
project.pages[0].panels = [
  lp,
  tp,
];

test('shows table panel details', async () => {
  const component = enzyme.mount(
    <TablePanelDetails
    panel={tp}
    panels={project.pages[0].panels}
    updatePanel={() => {}}
    />);
  await componentLoad(component);
});

test('shows filled table panel', async () => {
  tp.table.columns = ['name', 'age'];
  tp.resultMeta = new PanelResultMeta({
    value: [
      { name: 'Nora', age: 33 },
      { name: 'Kay', age: 20 }
    ],
  });

  const component = enzyme.mount(
    <TablePanel
    panel={tp}
    panels={project.pages[0].panels}
    updatePanel={() => {}}
    />);
  await componentLoad(component);
});
