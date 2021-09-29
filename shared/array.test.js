const { chunk } = require('./array');

test('chunks an array', () => {
  expect(chunk([1], 0)).toStrictEqual([[1]]);
  expect(chunk([], 1)).toStrictEqual([]);
  expect(chunk([1, 2, 3, 4], 2)).toStrictEqual([
    [1, 2],
    [3, 4],
  ]);
});
