const log = require('./log');

test('it logs', () => {
  log.logger.INFO = jest.fn();
  log.logger.ERROR = jest.fn();

  log.info('a', 'b', 'c');
  expect(log.logger.INFO.mock.calls[0][0]).toMatch('[INFO] [0-9:.Z]+ a b c');

  const e = new Error('my message');
  log.error('a', e, 'c');
  const words = log.logger.INFO.mock.calls[0][0].split(' ');
  expect(words.filter((f) => f.length)).toStrictEqual([
    '[ERROR]',
    words[1], // Already tested it looks like a date,
    'a',
    'my',
    'message',
    'c',
    '\n',
    ...e.stack.split('\n').slice(1).join('\n').split(' '),
  ]);
});
