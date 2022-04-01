const { makeUpdater, makeDeleter } = require('./state');

test('test makeUpdater', async () => {
  const panels = [{ id: 9 }, { id: 2 }];
  const updateStore = jest.fn();
  const rereadStore = jest.fn();
  const projectId = '12';
  const update = makeUpdater(projectId, panels, updateStore, rereadStore);

  // Insert new at end
  await update({ id: 3 }, -1);
  expect(panels.map((p) => p.id)).toStrictEqual([9, 2, 3]);
  expect([...updateStore.mock.calls[0]]).toStrictEqual([projectId, {id: 3}, 2]);

  // Modify existing
  await update({ id: 3 }, 1);
  expect(panels.map((p) => p.id)).toStrictEqual([9, 3, 2]);
  expect([...updateStore.mock.calls[0]]).toStrictEqual([projectId, {id: 3}, 1, [9, 3, 2]]);

  // Insert new not at end
  await update({ id: 4 }, 2);
  expect(panels.map((p) => p.id)).toStrictEqual([9, 3, 4, 2]);
  expect([...updateStore.mock.calls[0]]).toStrictEqual([projectId, {id: 4}, 2, [9, 3, 4, 2]]);
});
