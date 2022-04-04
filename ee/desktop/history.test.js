// Copyright 2022 Multiprocess Labs LLC

const { History } = require('./history');
const { Store } = require('./store');
const {
  LiteralPanelInfo,
  ServerInfo,
  Encrypt,
  DatabaseConnectorInfo,
} = require('../../shared/state');
const { withSavedPanels } = require('../../desktop/panel/testutil');

const store = new Store();

test('project changes are audited', async () => {
  let finished = false;
  const lp = new LiteralPanelInfo(null, {
    contentTypeInfo: { type: 'application/json' },
    content: '{"a": 1}',
  });
  const dispatch = new History(store, store.getHandlers()).audit;
  await withSavedPanels(
    [lp],
    async (project, dispatch) => {
      let { history } = await dispatch({
        resource: 'getHistory',
        body: {},
        projectId: project.projectName,
      });
      expect(history.length).toBe(2);
      expect(history[0].table).toBe('ds_panel');

      // No change, no new history.
      await dispatch(
        {
          resource: 'updatePanel',
          projectId: project.projectName,
          body: { data: lp, position: 0, insert: false },
        },
        true
      );

      ({ history } = await dispatch({
        resource: 'getHistory',
        body: {},
        projectId: project.projectName,
      }));
      console.log('here', history);
      expect(history.length).toBe(2);

      // Make a panel change, new history entry
      lp.content = '{"b": 1}';
      await dispatch(
        {
          resource: 'updatePanel',
          projectId: project.projectName,
          body: { data: lp, position: 0, insert: false },
        },
        true
      );

      ({ history } = await dispatch({
        resource: 'getHistory',
        body: {},
        projectId: project.projectName,
      }));
      expect(history.length).toBe(3);
      expect(JSON.parse(history[0].newValue).content).toBe('{"b": 1}');

      // Make a page change, new history entry
      project.pages[0].name = 'One fancy new name';
      await dispatch(
        {
          resource: 'updatePage',
          projectId: project.projectName,
          body: { data: project.pages[0], position: 0 },
        },
        true
      );

      ({ history } = await dispatch({
        resource: 'getHistory',
        body: {},
        projectId: project.projectName,
      }));
      expect(history.length).toBe(4);
      expect(JSON.parse(history[0].newValue).name).toBe('One fancy new name');
      expect(history[0].action).toBe('update');
      expect(history[0].table).toBe('ds_page');

      // Delete the panel
      await dispatch(
        {
          resource: 'deletePanel',
          projectId: project.projectName,
          body: { id: lp.id },
        },
        true
      );

      ({ history } = await dispatch({
        resource: 'getHistory',
        body: {},
        projectId: project.projectName,
      }));
      expect(history.length).toBe(5);
      expect(history[0].table).toBe('ds_panel');
      expect(history[0].action).toBe('delete');

      // Delete the page
      await dispatch(
        {
          resource: 'deletePage',
          projectId: project.projectName,
          body: { id: project.pages[0].id },
        },
        true
      );

      ({ history } = await dispatch({
        resource: 'getHistory',
        body: {},
        projectId: project.projectName,
      }));
      expect(history.length).toBe(6);
      expect(history[0].action).toBe('delete');
      expect(history[0].table).toBe('ds_page');

      // Add a server
      const server = new ServerInfo({
        password_encrypt: new Encrypt('bubbly'),
      });
      await dispatch(
        {
          resource: 'updateServer',
          projectId: project.projectName,
          body: { position: 0, data: server, insert: true },
        },
        true
      );

      ({ history } = await dispatch({
        resource: 'getHistory',
        body: {},
        projectId: project.projectName,
      }));
      console.log(history);
      expect(history.length).toBe(7);
      expect(history[0].action).toBe('insert');
      expect(history[0].table).toBe('ds_server');
      // Encrypted during save
      expect(server.password_encrypt.encrypted).toBe(true);
      expect(JSON.parse(history[0].newValue).password_encrypt).toBe(undefined);

      // Add a connector
      const connector = new DatabaseConnectorInfo({
        password_encrypt: new Encrypt('bubbly'),
      });
      await dispatch(
        {
          resource: 'updateConnector',
          projectId: project.projectName,
          body: { position: 0, data: connector, insert: true },
        },
        true
      );

      ({ history } = await dispatch({
        resource: 'getHistory',
        body: {},
        projectId: project.projectName,
      }));
      expect(history.length).toBe(8);
      expect(history[0].action).toBe('insert');
      expect(history[0].table).toBe('ds_connector');
      // Encrypted during save
      expect(connector.database.password_encrypt.encrypted).toBe(true);
      expect(JSON.parse(history[0].newValue).database.password_encrypt).toBe(
        undefined
      );

      // Delete server
      await dispatch(
        {
          resource: 'deleteServer',
          projectId: project.projectName,
          body: server,
        },
        true
      );

      ({ history } = await dispatch({
        resource: 'getHistory',
        body: {},
        projectId: project.projectName,
      }));
      expect(history.length).toBe(9);
      expect(history[0].action).toBe('delete');
      expect(history[0].table).toBe('ds_server');

      // Delete connector
      await dispatch(
        {
          resource: 'deleteConnector',
          projectId: project.projectName,
          body: connector,
        },
        true
      );

      ({ history } = await dispatch({
        resource: 'getHistory',
        body: {},
        projectId: project.projectName,
      }));
      expect(history.length).toBe(10);
      expect(history[0].action).toBe('delete');
      expect(history[0].table).toBe('ds_connector');
      finished = true;
    },
    { store, dispatch }
  );

  if (!finished) {
    throw new Error('Callback did not finish');
  }
});
