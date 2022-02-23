const React = require('react');
const enzyme = require('enzyme');
const { shape } = require('shape');
const { ProjectPage, GraphPanelInfo, PanelResultMeta } = require('../shared/state');
const { ExternalDashboard } = require('./ExternalDashboard');
const { throwOnErrorBoundary } = require('./testutil');

describe('ExternalDashboard', function ExternalDashboardTests () {
    test(
	'loads dashboard',
	async function loadsDashboard() {
	    const gp = new GraphPanelInfo({
		name: 'Graph of ages'
		x: 'name',
		ys: [{field:'age', label: 'Age'}],
	    });
	    const res = [
		{age: 42, name: 'Maggie'},
		{age: 50, name: 'Terrence'},
	    ];
	    gp.resultMeta = PanelResultMeta.fromJSON({
		shape: shape(res),
		value: res,
	    });
	    global.fetch = async function() {
		return Promise.resolve({
		    status: 200,
		    json() {
			return Promise.resolve(ProjectPage.fromJSON({
			    panels: [
				gp,
			    ],
			}));
		    };
		});
	    }
	    const component = enzyme.mount(<ExternalDashboard />);

	    await componentLoad(component);

	    throwOnErrorBoundary(component);

	    let panels = component.find('.panel');
	    expect(panels.length).toBe(1);
	    expect(panels.at(0).find('.panel-name').text()).toBe('Graph of ages')
	    console.log(component.debug());
	},
    );
});
