const {
  RPC_ASYNC_REQUEST,
  RPC_ASYNC_RESPONSE,
} = require('../shared/constants');
const { registerRPCHandlers } = require('./rpc');

test('registers handlers', async () => {
  let handle;
  const ipcMain = {
    on(msg, h) {
      expect(msg).toBe(RPC_ASYNC_REQUEST);
      handle = h;
    },
  };

  let finished1 = false;
  const handlers = [
    {
      resource: 'test',
      handler: (projectId, body, dispatch, external) => {
        expect(projectId).toBe('test id');
        expect(body).toStrictEqual({ something: 1 });
        expect(external).toStrictEqual(true);
        expect(typeof dispatch).toBe('function');
        finished1 = true;
        return { aresponse: true };
      },
    },
  ];

  let finished2 = false;
  registerRPCHandlers(ipcMain, handlers);
  const event = {
    sender: {
      send(channel, body) {
        expect(channel).toBe(`${RPC_ASYNC_RESPONSE}:88`);
        expect(body.kind).toBe('response');
        expect(body.body).toStrictEqual({ aresponse: true });
        finished2 = true;
      },
    },
  };
  await handle(event, {
    resource: 'test',
    messageNumber: 88,
    projectId: 'test id',
    body: { something: 1 },
  });

  if (!finished1 || !finished2) {
    throw new Error('Test did not finish.');
  }
});
