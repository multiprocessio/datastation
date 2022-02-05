const { shape } = require('shape');
const { orderedObjectFields } = require('./FieldPicker');

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
