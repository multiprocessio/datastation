const { sqlRangeQuery } = require('./sql');

test('sqlRangeQuery formats correctly', () => {
  expect(sqlRangeQuery('SELECT 1', null, 'postgres')).toBe('SELECT 1');

  const begin = '2021-01-02 03:04:05';
  const end = '2021-03-04 05:06:07';
  const range = {
    field: 'createdAt',
    rangeType: 'absolute',
    begin_date: begin,
    end_date: end,
  };
  expect(sqlRangeQuery('SELECT 1', range, 'postgres')).toBe(
    `SELECT * FROM (SELECT 1) WHERE "createdAt" > TIMESTAMP '${begin}' AND "createdAt" < TIMESTAMP '${end}'`
  );

  expect(sqlRangeQuery('SELECT 1', range, 'mysql')).toBe(
    `SELECT * FROM (SELECT 1) WHERE \`createdAt\` > TIMESTAMP "${begin}" AND \`createdAt\` < TIMESTAMP "${end}"`
  );
});
