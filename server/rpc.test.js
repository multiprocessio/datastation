const { handleRPC } = require('./rpc');

test('dispatching works', async () => {
  let done = false;

  const req = {
    query: {
      resource: 'test',
      projectId: 'my project',
      body: { abody: 'a thing' },
    },
    body: {},
  };

  const rsp = {
    json(msg) {
      expect(msg).toStrictEqual({ aresponse: true });
      done = true;
    },
  };

  const handlers = [
    {
      resource: 'test',
      handler: (projectId, body, dispatch, external) => {
        // TODO: test internal dispatch

        expect(projectId).toBe('my project');
        expect(body).toStrictEqual({ abody: 'a thing' });
        expect(typeof dispatch).toStrictEqual('function');
        expect(external).toStrictEqual(true);
        return { aresponse: true };
      },
    },
  ];

  await handleRPC(req, rsp, handlers);

  expect(done).toBe(true);
});
