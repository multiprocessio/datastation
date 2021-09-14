const { getPath, validate } = require('./object');

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
