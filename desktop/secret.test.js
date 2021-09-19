const fs = require('fs');
const { file: makeTmpFile } = require('tmp-promise');
const { encrypt, decrypt, ensureSigningKey } = require('./secret');

async function withTmpSigningKey(cb) {
  const tmp = await makeTmpFile();
  try {
    await ensureSigningKey(tmp.path);
    expect(fs.readFileSync(tmp.path).length).toBe(44);
    await cb(tmp);
  } finally {
    await tmp.cleanup();
  }
}

test('encrypt, decrypt same key', () =>
  withTmpSigningKey(async (tmp) => {
    const original = 'my great string';
    const encrypted = await encrypt(original, tmp.path);
    const decrypted = await decrypt(encrypted, tmp.path);
    expect(decrypted).toBe(original);
  }));

test('encrypt, decrypt different key', () =>
  withTmpSigningKey(async (tmp) => {
    const original = 'my great string';
    const encrypted = await encrypt(original, tmp.path);

    return withTmpSigningKey(async (newKeyTmp) => {
      let error;
      try {
        await decrypt(encrypted, newKeyTmp.path);
      } catch (e) {
        error = e;
      }

      expect(error.message).toBe('Could not decrypt message');
    });
  }));
