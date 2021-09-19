const {title, humanSize, parseArrayBuffer} =require('./text');

test('title', () => {
  expect(title('ac_bd')).toBe('Ac Bd');
  expect(title('ac bd')).toBe('Ac Bd');
  expect(title('ac-bd')).toBe('Ac Bd');
  expect(title('ac-bd efgII')).toBe('Ac Bd EfgII');
});

test('humanSize', () => {
  expect(humanSize(80)).toBe('80B');
  expect(humanSize(1080)).toBe('10.80KB');
  expect(humanSize(108000)).toBe('10.80MB');
  expect(humanSize(1080000000)).toBe('10.80GB');
  expect(humanSize(1080000000000)).toBe('10.80TB');
});

test('parse csv', async () => {
  // Explicit type
  let res = await parseArrayBuffer({
    type: 'text/csv',
    fileName: '',
    body: 'name,age\nkev,12',
  });

  expect(res.contentType).toBe('text/csv');
  expect(res.value).toStrictEqual([{ name: 'kev', age: 12 }]);

  // And with only filename to guess
  let res = await parseArrayBuffer({
    type: '',
    fileName: 'test.csv',
    body: 'name,age\nkev,12',
  });

  expect(res.contentType).toBe('text/csv');
  expect(res.value).toStrictEqual([{ name: 'kev', age: 12 }]);
});
