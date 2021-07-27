const { toString, shape } = require('./shape');

const shapeString = (a) => toString(shape(a));

test('shape', () => {
  expect(shapeString('foo')).toBe('string');

  expect(shapeString({ b: 'cat', c: true })).toBe(
    "Object with\n  'b' of\n    string,\n  'c' of\n    boolean"
  );

  expect(shapeString(['foo'])).toBe('Array of\n  string');

  expect(shapeString(['foo', 1])).toBe('Array of\n  string or\n  number');

  expect(
    shapeString([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ])
  ).toBe("Array of\n  Object with\n    'a' of\n      number,\n    'b' of\n      number");

  expect(
    shapeString([
      { a: 1, b: 2 },
      { a: 3, b: null, c: 'hey' },
    ])
  ).toBe(
    "Array of\n  Object with\n    'a' of\n      number,\n    'b' of\n      number or\n      null,\n    'c' of\n      string"
  );

  expect(
    shapeString([
      [1, 2],
      ['x', 'y'],
    ])
  ).toBe('Array of\n  Array of\n    number');

  expect(shapeString([1, ['x', 'y']])).toBe(
    'Array of\n  number or\n  Array of\n    string'
  );
});
