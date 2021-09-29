const { shape } = require('shape');
const { MYSQL_QUOTE, ANSI_SQL_QUOTE } = require('../../shared/sql');
const {
  importAndRun,
  formatImportQueryAndRows,
  transformDM_getPanelCalls,
} = require('./database');

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
    ['panel0ID'],
    true
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

test('format import query and rows', () => {
  let [query, rows] = formatImportQueryAndRows(
    't1',
    [{ name: 'a' }, { name: 'x' }],
    panel0Data.map((d) => ({ value: d })),
    ANSI_SQL_QUOTE
  );
  expect(query).toBe(`INSERT INTO "t1" ("a", "x") VALUES (?,?), (?,?);`);
  expect(rows).toStrictEqual(['cara', 1, 'demi', 2]);

  [query, rows] = formatImportQueryAndRows(
    't1',
    [{ name: 'a' }, { name: 'x' }],
    panel0Data.map((d) => ({ value: d })),
    MYSQL_QUOTE
  );
  expect(query).toBe('INSERT INTO `t1` (`a`, `x`) VALUES (?,?), (?,?);');
});

test('importAndRun', () => {
  const t0Results = {
    value: [
      { a: 12, b: 'Mel', c: 9 },
      { a: 154, b: 'Karry', c: 10 },
    ],
  };
  const dispatch = () => t0Results;

  const db = {
    createTable: jest.fn(),
    insert: jest.fn(),
    query: jest.fn(() => [1, 2]),
  };

  const projectId = 'my new uuid';
  const query = 'SELECT * FROM t0';
  const panelsToImport = [
    {
      tableName: 't0',
      columns: [
        { name: 'a', type: 'int' },
        { name: 'b', type: 'text' },
      ],
    },
  ];

  const { value } = await importAndRun(
    dispatch,
    db,
    projectId,
    query,
    panelsToImport,
    ANSI_SQL_QUOTE
  );
  expect(value).toStrictEqual([1, 2]);
  expect(db.createTable.mock.calls.length).toBe(1);
  expect(db.createTable.mock.calls[0][0]).toBe(
    'CREATE TABLE "t0" ("a" int, "b" text);'
  );

  expect(db.insert.mock.calls.length).toBe(1);
  expect(db.insert.mock.calls[0]).toBe([
    'INSERT INTO "t0" VALUES ("a", "b") (?, ?), (?, ?);',
    12,
    154,
    'Mel',
    'Kerry',
  ]);

  expect(db.query.mock.calls.length).toBe(1);
  expect(db.query.mock.calls[0][0]).toBe(query);
});
