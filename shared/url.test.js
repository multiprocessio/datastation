const { fullHttpURL } = require('./url');

test('fullHttpURL', () => {
  expect(fullHttpURL('')).toBe('http://localhost');
  expect(fullHttpURL('localhost')).toBe('http://localhost');
  expect(fullHttpURL('localhost', 443)).toBe('https://localhost');
  expect(fullHttpURL('localhost/foobar', 443)).toBe('https://localhost/foobar');
  expect(fullHttpURL('localhost/fluber')).toBe('http://localhost/fluber');
  expect(fullHttpURL('localhost/fluber', 20)).toBe(
    'http://localhost:20/fluber'
  );
});
