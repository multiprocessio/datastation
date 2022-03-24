const { Store } = require('./store');
const {
  ProjectState,
  ProjectPage,
  ProgramPanelInfo,
  PanelResult,
  Encrypt,
  DatabaseConnectorInfo,
  ServerInfo,
} = require('../shared/state');
const { withSavedPanels } = require('../../desktop/panel/testutil');

const store = new Store();

test('project changes are audited', async () => {
  let finished = false;
  const lp = new LiteralPanelInfo(null, {
    contentTypeInfo: { type: 'application/json' },
    content: '{"a": 1}',
  });
  await withSavedPanels(
    [lp],
    async (project, dispatch) => {
      let [history] = await dispatch({ resource: 'getHistory' });
      expect(history.length).toBe(4);

      // No change, no new history.
      await dispatch({
	resource: 'updatePanel',
	body: lp,
      });

      ([history] = await dispatch({ resource: 'getHistory' }));
      expect(history.length).toBe(4);

      // Make a change, new history entry
      lp.content = '{"b": 1}';
      await dispatch({
	resource: 'updatePanel',
	body: lp,
      });

      ([history] = await dispatch({ resource: 'getHistory' }));
      expect(history.length).toBe(5);
      finished = true;
    },
    { evalPanels: false, subprocessName: runner }
  );

  if (!finished) {
    throw new Error('Callback did not finish');
  }
});
