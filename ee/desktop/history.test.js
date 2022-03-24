// Copyright 2022 Multiprocess Labs LLC

const { Store } = require('./store');
const { LiteralPanelInfo } = require('../../shared/state');
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
      dispatch = new History(store, store.getHandlers()).audit;
      let res = await dispatch({ resource: 'getHistory', body: {}, projectId: project.projectName });
      expect(history.length).toBe(4);

      // No change, no new history.
      await dispatch({
        resource: 'updatePanel',
        body: lp,
      });

      ({history}= await dispatch({ resource: 'getHistory', body: {}, projectId: project.projectName }));
      expect(history.length).toBe(4);

      // Make a change, new history entry
      lp.content = '{"b": 1}';
      await dispatch({
        resource: 'updatePanel',
        body: lp,
      });

      ({history}= await dispatch({ resource: 'getHistory', body: {}, projectId: project.projectName}));
      expect(history.length).toBe(5);
      finished = true;
    },
    { store },
  );

  if (!finished) {
    throw new Error('Callback did not finish');
  }
});
