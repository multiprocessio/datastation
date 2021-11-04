const React = require('react');
const { act } = require('react-dom/test-utils');
const enzyme = require('enzyme');
const {
  ProjectState,
  PanelResultMeta,
  ProjectPage,
  LiteralPanelInfo,
  GraphPanelInfo,
} = require('@datastation/shared/state');
const { GraphPanel, GraphPanelDetails } = require('./GraphPanel');

const project = new ProjectState();
project.pages = [new ProjectPage()];
const lp = new LiteralPanelInfo();
const gp = new GraphPanelInfo({
  panelSource: lp.info,
  x: 'name',
  ys: [{ field: 'age', label: 'Age' }],
});
project.pages[0].panels = [lp, gp];

test('shows graph panel details', async () => {
  const component = enzyme.mount(
    <GraphPanelDetails
      panel={gp}
      panels={project.pages[0].panels}
      updatePanel={() => {}}
    />
  );
  await componentLoad(component);
});

test('shows filled graph panel', async () => {
  gp.resultMeta = new PanelResultMeta({
    value: [
      { name: 'Nora', age: 33 },
      { name: 'Kay', age: 20 },
    ],
  });

  const component = enzyme.mount(
    <GraphPanel
      panel={gp}
      panels={project.pages[0].panels}
      updatePanel={() => {}}
    />
  );
  await componentLoad(component);
});
