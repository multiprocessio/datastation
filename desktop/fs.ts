import fs from 'fs/promises';
import path from 'path';
import { DISK_ROOT } from './constants';
export async function ensureFile(f: string) {
  let root = path.isAbsolute(f) ? path.dirname(f) : DISK_ROOT;
  await fs.mkdir(root, { recursive: true });
  return path.isAbsolute(f) ? f : path.join(DISK_ROOT, f);
}
