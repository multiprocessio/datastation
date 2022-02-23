const React = require('react');
const enzyme = require('enzyme');
const { shape } = require('shape');
const {
  ProjectPage,
  GraphPanelInfo,
  PanelResultMeta,
} = require('../../shared/state');
const { Dashboard } = require('./');

describe('Dashboard', function DashboardTests() {
  test('loads dashboard', async function loadsDashboard() {
    const gp = new GraphPanelInfo({
      name: 'Graph of ages',
      x: 'name',
      ys: [{ field: 'age', label: 'Age' }],
    });
    const res = [
      { age: 42, name: 'Maggie' },
      { age: 50, name: 'Terrence' },
    ];
    gp.resultMeta = PanelResultMeta.fromJSON({
      shape: shape(res),
      value: res,
    });
    global.fetch = async function (url) {
      expect(url).toBe('/a/dashboard/foo/blubber');
      return Promise.resolve({
        status: 200,
        json() {
          return Promise.resolve(
            ProjectPage.fromJSON({
              panels: [gp],
            })
          );
        },
      });
    };
    const component = enzyme.mount(
      <Dashboard
        projectId="foo"
        page={{ id: 'blubber' }}
        modeFeatures={{ dashboard: true }}
      />
    );

    while (component.find('.panel').length === 0) {
      await componentLoad(component);

      throwOnErrorBoundary(component);
    }

    let panels = component.find('.panel');
    expect(panels.length).toBe(1);
    expect(panels.at(0).find('.panel-name').text()).toBe('Graph of ages');
  });
});
