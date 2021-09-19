const { shape } = require('shape');
const { transformDM_getPanelCalls } = require('./sql');

const panel0Data = [
  {
    a: 'cara',
    x: 1,
    z: '1',
    b: true,
    c: 2,
  },
  {
    a: 'demi',
    x: 2,
    z: '90',
    b: null,
    c: '2',
  },
];

const panel0Shape = shape(panel0Data);

const query1 = 'SELECT * FROM DM_getPanel(0) WHERE x >= 2';

test('transform DM_getPanel calls', () => {
  const { query, panelsToImport } = transformDM_getPanelCalls(
    query1,
    [panel0Shape],
    ['panel0ID']
  );
  expect(query).toBe('SELECT * FROM t0 WHERE x >= 2');
  expect(panelsToImport).toStrictEqual([
    {
      panelId: 'panel0ID',
      tableName: 't0',
      columns: [
        { name: 'a', type: 'TEXT' },
        { name: 'x', type: 'REAL' },
        { name: 'z', type: 'TEXT' },
        { name: 'b', type: 'BOOLEAN' },
        { name: 'c', type: 'TEXT' },
      ],
    },
  ]);
});
