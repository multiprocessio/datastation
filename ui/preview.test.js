const { previewObject } = require('./preview');

test('previewObject', () => {
  expect(previewObject([{ foo: 1, bar: [2], "blub": null }])).toBe(
    '[\n  { "foo": 1, "bar": [ 2 ], "blub": null }\n]'
  );

  expect(previewObject('foo')).toBe('foo');
});
