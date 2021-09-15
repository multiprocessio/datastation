import sodium from 'sodium';
import path from 'path';
import fs from 'fs/promises';

function getSigningKeyPath(diskRoot: string) {
  return path.join(diskRoot, '.signingkey');
}

export async function ensureSigningKey(diskRoot: string) {
  const signingKeyPath = getSigningKeyPath(diskRoot);
  const exists = await fs.exists(signingKeyPath);
  if (!exists) {
    const newKey = sodium.randombytes_buf(sodium.crypto_shorthash_KEYBYTES);
    await fs.writeFile(signingKeyPath, newKey);
  }
}

export async function encrypt(diskRoot: string, msg: string) {
  const signingKeyPath = getSigningKeyPath(diskRoot);
  const key = await fs.readFile(signingKeyPath);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  return nonce.concat(sodium.crypto_secretbox_easy(msg, nonce, key));
}

export async function decrypt(diskRoot: string, msg: string) {
  if (msg.length < sodium.crypto_secretbox_NONCEBYTES + sodium.crypto_secretbox_MACBYTES) {
    throw "Short message";
  }
  const signingKeyPath = getSigningKeyPath(diskRoot);
  const key = await fs.readFile(signingKeyPath);
  const nonce = msg.slice(0, sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = msg.slice(sodium.crypto_secretbox_NONCEBYTES);
  return sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
}
