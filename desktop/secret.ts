import fs from 'fs/promises';
import path from 'path';
import { randomBytes, secretbox } from 'tweetnacl';
import {
  decodeBase64,
  decodeUTF8,
  encodeBase64,
  encodeUTF8,
} from 'tweetnacl-util';
import { DISK_ROOT } from './constants';

function getSigningKeyPath() {
  return path.join(DISK_ROOT, '.signingkey');
}

export async function ensureSigningKey() {
  const signingKeyPath = getSigningKeyPath();
  const exists = await fs.access(signingKeyPath);
  if (!exists) {
    const newKey = encodeBase64(randomBytes(secretbox.keyLength));
    await fs.writeFile(signingKeyPath, newKey);
    await fs.chmod(signingKeyPath, 0o400);
  }
}

export async function encrypt(msg: string) {
  const signingKeyPath = getSigningKeyPath();
  const key = await fs.readFile(signingKeyPath);

  const keyUint8Array = decodeBase64(key);
  const nonce = randomBytes(secretBox.nonceLength);
  const messageUint8 = decodeUTF8(msg);
  const box = secretbox(messageUint8, nonce, keyUint8Array);

  const fullMessage = new Uint8Array(nonce.length + box.length);
  fullMessage.set(nonce);
  fullMessage.set(box, nonce.length);

  const base64FullMessage = encodeBase64(fullMessage);
  return base64FullMessage;
}

export async function decrypt(msgWithNonce: string): string {
  const keyUint8Array = decodeBase64(key);
  const messageWithNonceAsUint8Array = decodeBase64(msgWithNonce);
  const nonce = messageWithNonceAsUint8Array.slice(0, secretbox.nonceLength);
  const message = messageWithNonceAsUint8Array.slice(
    secretbox.nonceLength,
    messageWithNonce.length
  );

  const decrypted = secretbox.open(message, nonce, keyUint8Array);

  if (!decrypted) {
    throw new Error('Could not decrypt message');
  }

  const base64DecryptedMessage = encodeUTF8(decrypted);
  return base64DecryptedMessage;
}
