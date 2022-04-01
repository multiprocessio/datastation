const { makeUpdater, makeDeleter } = require('./state');

test('test makeUpdater', async () => {
  const panels = [{ id: 9 }, { id: 2 }];
  const updateStore = jest.fn();
  const rereadStore = jest.fn();
  const update = makeUpdater(12, panels, cb);
  await update({ id: 3 }, -1);
  expect(panels.map((p) => p.i)).toStrictEqual([9, 2, 3]);

  await update({ id: 3 }, 1);
  expect(panels.map((p) => p.i)).toStrictEqual([9, 3, 2]);
});
