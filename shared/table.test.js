const { columnsFromObject } = require('./table');

test('invalid table', () => {
  let error;
  try {
    columnsFromObject(null, [], 1);
  } catch (e) {
    error = e;
  }

  expect(error.message).toBe(
    'This panel requires an array of objects as input. Make sure panel [1] returns an array of objects.'
  );
});

test('* columns, skip missing rows', () => {
  const testData = [{ a: 1, b: 2 }, null, { a: 10, b: 187 }];

  const result = columnsFromObject(testData, [], 1);
  expect(result).toStrictEqual(testData);
});
