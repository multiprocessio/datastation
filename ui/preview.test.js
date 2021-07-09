const { previewObject } = require('./preview');

test('previewObject', () => {
  expect(previewObject([{ foo: 1, bar: [2] }])).toBe(
    '[\n{ "foo": 1, "bar": [ 2 ] }\n]'
  );
});
