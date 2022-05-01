const { shape } = require('shape');
const { allFields, orderedObjectFields } = require('./FieldPicker');

const sample1 = shape({
  a: '1',
  x: 1,
  z: '1',
  c: { t: 100, n: { b: 'Kevin' } },
  // Non-scalar anything
  d: {},
});

test('orderedObjectFields preferring string', () => {
  expect(orderedObjectFields(sample1)).toStrictEqual([
    {
      name: 'String',
      elements: [
        ['a', { kind: 'scalar', name: 'string' }],
        ['c.n.b', { kind: 'scalar', name: 'string' }],
        ['z', { kind: 'scalar', name: 'string' }],
      ],
    },
    {
      name: 'Number',
      elements: [
        ['c.t', { kind: 'scalar', name: 'number' }],
        ['x', { kind: 'scalar', name: 'number' }],
      ],
    },
  ]);
});

test('orderedObjectFields preferring number', () => {
  expect(orderedObjectFields(sample1, 'number')).toStrictEqual([
    {
      name: 'Number',
      elements: [
        ['c.t', { kind: 'scalar', name: 'number' }],
        ['x', { kind: 'scalar', name: 'number' }],
      ],
    },
    {
      name: 'String',
      elements: [
        ['a', { kind: 'scalar', name: 'string' }],
        ['c.n.b', { kind: 'scalar', name: 'string' }],
        ['z', { kind: 'scalar', name: 'string' }],
      ],
    },
  ]);
});

test('all fields', () => {
  const sample = shape([
    { a: 1, b: '2', c: { x: 9100 }, d: 'maybe' },
    { a: 10, b: '99', c: { x: 80 }, e: 90 },
  ]);

  expect(allFields(sample)).toStrictEqual([
    ['a', { kind: 'scalar', name: 'number' }],
    ['b', { kind: 'scalar', name: 'string' }],
    ['c.x', { kind: 'scalar', name: 'number' }],
    ['d', { kind: 'scalar', name: 'string' }],
    ['e', { kind: 'scalar', name: 'number' }],
  ]);
});
