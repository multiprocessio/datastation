const fs = require('fs');
const { parsePartialJSONFile } = require('./partial');
import { file as makeTmpFile } from 'tmp-promise';

describe('parsePartialJSONFile', function parsePartialJSONFileTest() {
  test('correctly fills out partial file', async function fillsOutPartial() {
    const f = await makeTmpFile();
    try {
      const whole = '[{"foo": "bar"}, {"big": "bad"}]';
      fs.writeFileSync(f.path, whole);
      const { size, preview } = parsePartialJSONFile(f.path, 3);
      expect(size).toBe(whole.length);
      expect(preview).toStrictEqual(`[\n  { "foo": "bar" }\n]`);
    } finally {
      f.cleanup();
    }
  });

  test('handles open-close in string', async function handlesOpenCloseInString() {
    for (const c of ['{', '}', '[', ']']) {
      const f = await makeTmpFile();
      try {
        const whole = `[{"foo": "${c}bar"}, {"big": "bad"}]`;
        fs.writeFileSync(f.path, whole);
        const { preview, size } = parsePartialJSONFile(f.path, 3);
        expect(size).toBe(whole.length);
        expect(preview).toStrictEqual(`[\n  { "foo": "${c}bar" }\n]`);
      } finally {
        f.cleanup();
      }
    }
  });

  test('handles escaped quotes in string', async function handlesEscapedQuotesInString() {
    const f = await makeTmpFile();
    try {
      const whole = `[{"foo":"bar\\" { "},{"big":"bad"}]`;
      expect(JSON.stringify(JSON.parse(whole))).toEqual(whole);
      fs.writeFileSync(f.path, whole);
      const { preview, size } = parsePartialJSONFile(f.path, 3);
      expect(size).toBe(whole.length);
      expect(preview).toStrictEqual(`[\n  { "foo": "bar\\" { " }\n]`);
    } finally {
      f.cleanup();
    }
  });
});
