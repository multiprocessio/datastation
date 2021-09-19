const { title, humanSize, parseArrayBuffer } = require('./text');

test('title', () => {
  expect(title('ac_bd')).toBe('Ac Bd');
  expect(title('ac bd')).toBe('Ac Bd');
  expect(title('ac-bd')).toBe('Ac Bd');
  expect(title('ac-bd efgII')).toBe('Ac Bd Efgii');
});

test('humanSize', () => {
  expect(humanSize(80)).toBe('80B');
  expect(humanSize(1080)).toBe('1.08KB');
  expect(humanSize(1080_000)).toBe('1.08MB');
  expect(humanSize(1080_000_000)).toBe('1.08GB');
  expect(humanSize(1080_000_000_000)).toBe('1.08TB');
});

test('parse csv', async () => {
  // Explicit type
  let res = await parseArrayBuffer(
    { type: 'text/csv' },
    '',
    'name,age\nkev,12'
  );

  expect(res.contentType).toBe('text/csv');
  expect(res.value).toStrictEqual([{ name: 'kev', age: '12' }]);

  // And with only filename to guess
  res = await parseArrayBuffer(
    { type: '' },
    'test.csv',
    new TextEncoder('utf-8').encode('name,age\nkev,12')
  );

  expect(res.contentType).toBe('text/csv');
  expect(res.value).toStrictEqual([{ name: 'kev', age: '12' }]);
});

test('nginx regex', async () => {
  const sampleLogs = `66.249.65.159 - - [06/Nov/2014:19:10:38 +0600] "GET /news/53f8d72920ba2744fe873ebc.html HTTP/1.1" 404 177 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5376e Safari/8536.25 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
66.249.65.62 - - [06/Nov/2014:19:12:14 +0600] "GET /?q=%E0%A6%A6%E0%A7%8B%E0%A7%9F%E0%A6%BE HTTP/1.1" 200 4356 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"`;

  const res = await parseArrayBuffer(
    { type: 'text/nginxaccess' },
    '',
    sampleLogs
  );

  expect(res.value.map((g) => ({ ...g }))).toStrictEqual([
    {
      remote: '66.249.65.159',
      host: '-',
      user: '-',
      time: '06/Nov/2014:19:10:38 +0600',
      method: 'GET',
      path: '/news/53f8d72920ba2744fe873ebc.html',
      code: '404',
      size: '177',
      referer: '-',
      agent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5376e Safari/8536.25 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      http_x_forwarded_for: undefined,
    },
    {
      remote: '66.249.65.62',
      host: '-',
      user: '-',
      time: '06/Nov/2014:19:12:14 +0600',
      method: 'GET',
      path: '/?q=%E0%A6%A6%E0%A7%8B%E0%A7%9F%E0%A6%BE',
      code: '200',
      size: '4356',
      referer: '-',
      agent:
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      http_x_forwarded_for: undefined,
    },
  ]);
  expect(res.contentType).toBe('text/nginxaccess');
});
