const { deepEquals, mergeDeep, getPath, validate } = require('./object');

test('getPath gets the path in the object', () => {
  const obj = { a: { 1: { b: '12' } } };
  expect(getPath(obj, 'a.1.b')).toBe('12');
  expect(getPath(obj, 'a.12.c')).toBe(undefined);
  expect(getPath(obj, 'a.1.c')).toBe(undefined);
});

test('validate rejects missing fields', () => {
  const mock = jest.fn();
  const obj = { a: { 1: { b: '12' } } };
  validate(obj, ['a.1.b'], mock);
  expect(mock.mock.calls.length).toBe(0);

  mock.mockReset();

  validate(obj, ['a.1.b', 'a.2'], mock);
  expect(mock.mock.calls.length).toBe(1);
  expect(mock.mock.calls[0][0]).toBe('a.2');

  mock.mockReset();

  validate(obj, ['a?.1.b', 'a.2?.b', 'a?.3'], mock);
  expect(mock.mock.calls.length).toBe(1);
  expect(mock.mock.calls[0][0]).toBe('a.3');
});

test('mergeDeep', () => {
  expect(
    mergeDeep(
      { a: 1, c: { b: 3 }, e: { f: 9 } },
      { d: 12, c: { g: 22 }, e: { f: 10 } }
    )
  ).toStrictEqual({
    a: 1,
    d: 12,
    c: { b: 3, g: 22 },
    e: { f: 10 },
  });
});

test('deepEquals', () => {
  expect(deepEquals({}, {})).toBe(true);
  expect(deepEquals(1, {})).toBe(false);
  expect(deepEquals({ a: 2, b: { c: 3 } }, { a: 2, b: { c: 3 } })).toBe(true);
  expect(deepEquals({ a: 2, b: { c: 3 } }, { a: 2, b: { c: 4 } })).toBe(false);
});
