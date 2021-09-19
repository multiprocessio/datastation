import fs from 'fs/promises';
import { randomBytes, secretbox } from 'tweetnacl';
import {
  decodeBase64,
  decodeUTF8,
  encodeBase64,
  encodeUTF8,
} from 'tweetnacl-util';
import { ensureFile } from './fs';

function getSigningKeyPath(signingKeyPath?: string) {
  return ensureFile(signingKeyPath || '.signingKey');
}

export async function ensureSigningKey(signingKeyPath?: string) {
  signingKeyPath = await getSigningKeyPath(signingKeyPath);

  try {
    const current = await fs.readFile(signingKeyPath);
    if (!current.length) {
      throw new Error();
    }
  } catch (e) {
    const newKey = encodeBase64(randomBytes(secretbox.keyLength));
    await fs.writeFile(signingKeyPath, newKey);
    await fs.chmod(signingKeyPath, 0o400);
  }
}

export async function encrypt(msg: string, signingKeyPath?: string) {
  signingKeyPath = await getSigningKeyPath(signingKeyPath);
  const key = await fs.readFile(signingKeyPath, { encoding: 'utf-8' });

  const keyUint8Array = decodeBase64(key);
  const nonce = randomBytes(secretbox.nonceLength);
  const messageUint8 = decodeUTF8(msg);
  const box = secretbox(messageUint8, nonce, keyUint8Array);

  const fullMessage = new Uint8Array(nonce.length + box.length);
  fullMessage.set(nonce);
  fullMessage.set(box, nonce.length);

  const base64FullMessage = encodeBase64(fullMessage);
  return base64FullMessage;
}

export async function decrypt(msgWithNonce: string, signingKeyPath?: string) {
  signingKeyPath = await getSigningKeyPath(signingKeyPath);
  const key = await fs.readFile(signingKeyPath, { encoding: 'utf-8' });

  const keyUint8Array = decodeBase64(key);
  const messageWithNonceAsUint8Array = decodeBase64(msgWithNonce);
  const nonce = messageWithNonceAsUint8Array.slice(0, secretbox.nonceLength);
  const message = messageWithNonceAsUint8Array.slice(
    secretbox.nonceLength,
    msgWithNonce.length
  );

  const decrypted = secretbox.open(message, nonce, keyUint8Array);

  if (!decrypted) {
    throw new Error('Could not decrypt message');
  }

  const base64DecryptedMessage = encodeUTF8(decrypted);
  return base64DecryptedMessage;
}
