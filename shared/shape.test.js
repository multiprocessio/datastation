const { toString, shape } = require('./shape');

const shapeString = (a) => toString(shape(a));

test('shape', () => {
  expect(shapeString('foo')).toBe('string');

  expect(shapeString({ b: 'cat', c: true })).toBe(
    "object with 'b' of string, 'c' of boolean"
  );

  expect(shapeString(['foo'])).toBe('array of string');

  expect(shapeString(['foo', 1])).toBe('array of string or number');

  expect(
    shapeString([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ])
  ).toBe("array of object with 'a' of number, 'b' of number");

  expect(
    shapeString([
      { a: 1, b: 2 },
      { a: 3, b: null, c: 'hey' },
    ])
  ).toBe(
    "array of object with 'a' of number, 'b' of number or null, 'c' of string"
  );

  expect(
    shapeString([
      [1, 2],
      ['x', 'y'],
    ])
  ).toBe('array of array of unknown');

  expect(shapeString([(1)[('x', 'y')]])).toBe(
    'array of array of unknown or number'
  );
});
