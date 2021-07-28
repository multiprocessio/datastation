const { shape } = require('shape');
const { orderedObjectFields } = require('./FieldPicker');

const sample1 = shape({
  a: '1',
  x: 1,
  z: '1',
});

test('orderedObjectFields without preferred type', () => {
  expect(orderedObjectFields(sample1)).toStrictEqual([
    ['a', { kind: 'scalar', name: 'string' }],
    ['x', { kind: 'scalar', name: 'number' }],
    ['z', { kind: 'scalar', name: 'string' }],
  ]);
});

test('orderedObjectFields preferring string', () => {
  expect(orderedObjectFields(sample1, 'string')).toStrictEqual([
    ['a', { kind: 'scalar', name: 'string' }],
    ['z', { kind: 'scalar', name: 'string' }],
    ['x', { kind: 'scalar', name: 'number' }],
  ]);
});

test('orderedObjectFields preferring number', () => {
  expect(orderedObjectFields(sample1, 'number')).toStrictEqual([
    ['x', { kind: 'scalar', name: 'number' }],
    ['a', { kind: 'scalar', name: 'string' }],
    ['z', { kind: 'scalar', name: 'string' }],
  ]);
});
