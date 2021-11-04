const { shape } = require('@multiprocess/shape');
const { orderedObjectFields } = require('./FieldPicker');

const sample1 = shape({
  a: '1',
  x: 1,
  z: '1',
  // Non-scalar anything
  d: {},
});

test('orderedObjectFields preferring string', () => {
  expect(orderedObjectFields(sample1)).toStrictEqual([
    {
      name: 'String',
      elements: [
        ['a', { kind: 'scalar', name: 'string' }],
        ['z', { kind: 'scalar', name: 'string' }],
      ],
    },
    {
      name: 'Number',
      elements: [['x', { kind: 'scalar', name: 'number' }]],
    },
    {
      name: 'Other',
      elements: [['d', { kind: 'object', children: {} }]],
    },
  ]);
});

test('orderedObjectFields preferring number', () => {
  expect(orderedObjectFields(sample1, 'number')).toStrictEqual([
    {
      name: 'Number',
      elements: [['x', { kind: 'scalar', name: 'number' }]],
    },
    {
      name: 'String',
      elements: [
        ['a', { kind: 'scalar', name: 'string' }],
        ['z', { kind: 'scalar', name: 'string' }],
      ],
    },
    {
      name: 'Other',
      elements: [['d', { kind: 'object', children: {} }]],
    },
  ]);
});
