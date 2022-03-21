import fs from 'fs';
import path from 'path';
import { DISK_ROOT } from './constants';
export function ensureFile(f: string) {
  let root = path.isAbsolute(f) ? path.dirname(f) : DISK_ROOT.value;
  fs.mkdirSync(root, { recursive: true });
  return path.isAbsolute(f) ? f : path.join(DISK_ROOT.value, f);
}
