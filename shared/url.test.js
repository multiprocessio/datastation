const { fullHttpURL, queryParameters } = require('./url');

test('fullHttpURL', () => {
  expect(fullHttpURL('')).toBe('http://localhost');
  expect(fullHttpURL('https://foo.com', null, 9090)).toBe('https://foo.com');
  expect(fullHttpURL('foo.com', null, 9090)).toBe('http://foo.com:9090');
  expect(fullHttpURL('https://foo.com:8080', null, 9090)).toBe(
    'https://foo.com:8080'
  );

  expect(fullHttpURL('foo.com:9090', null, 9090)).toBe('http://foo.com:9090');

  expect(fullHttpURL('https://foo.com', 8080, 9090)).toBe(
    'https://foo.com:8080'
  );
  expect(fullHttpURL('localhost')).toBe('http://localhost');
  expect(fullHttpURL('localhost', 443)).toBe('https://localhost');
  expect(fullHttpURL('localhost/foobar', 443)).toBe('https://localhost/foobar');
  expect(fullHttpURL('localhost/fluber')).toBe('http://localhost/fluber');
  expect(fullHttpURL('localhost/fluber', 20)).toBe(
    'http://localhost:20/fluber'
  );
});

test('queryParameters', () => {
  expect(queryParameters({ a: 1, b: 2 })).toBe('a=1&b=2');
});
