import fs from 'fs';
import { preview } from 'preview';
import { shape } from 'shape';
import { NoResultError } from '../shared/errors';

export function parsePartialJSONFile(
  file: string,
  maxBytesToRead: number = 100_000
) {
  let fd: number;
  try {
    fd = fs.openSync(file, 'r');
  } catch (e) {
    throw new NoResultError();
  }

  const { size } = fs.statSync(file);

  if (size < maxBytesToRead) {
    const f = fs.readFileSync(file).toString();
    console.log(f);
    const value = JSON.parse(f);
    return {
      size,
      value,
      arrayCount: Array.isArray(value) ? value.length : null,
      shape: shape(value),
      preview: preview(value),
      skipWrite: true,
      contentType: 'application/json',
    };
  }

  try {
    let done = false;
    let f = '';
    const incomplete = [];
    let inString = false;

    while (!done) {
      const bufferSize = 1024;
      const b = Buffer.alloc(bufferSize);
      const bytesRead = fs.readSync(fd, b);

      // To be able to iterate over code points
      let bs = Array.from(b.toString());
      outer: for (let i = 0; i < bs.length; i++) {
        const c = bs[i];
        if (c !== '"' && inString) {
          continue;
        }

        switch (c) {
          case '"':
            const previous =
              i + bs.length === 0
                ? ''
                : i > 0
                ? bs[i - 1]
                : f.charAt(f.length - 1);
            const isEscaped = previous === '\\';
            if (!isEscaped) {
              inString = !inString;
            }
            break;
          case '{':
          case '[':
            incomplete.push(c);
            break;
          case ']':
          case '}':
            if (f.length + bufferSize >= maxBytesToRead) {
              bs = bs.slice(0, i);
              // Need to not count additional openings after this
              done = true;
              break outer;
            }

            // Otherwise, pop it
            incomplete.pop();
            break;
        }
      }

      f += bs.join('');
      if (bytesRead < bufferSize) {
        break;
      }
    }

    while (incomplete.length) {
      if (incomplete.pop() === '{') {
        f += '}';
      } else {
        f += ']';
      }
    }

    const value = JSON.parse(f);

    let arrayCount = null;
    if (Array.isArray(value)) {
      let averageRowSize = 0;
      const n = 100;
      for (const row of value.slice(0, n)) {
        averageRowSize += JSON.stringify(row).length;
      }

      arrayCount = size / (averageRowSize / n);
    }

    return {
      size,
      value,
      shape: shape(value),
      preview: preview(value),
      arrayCount,
      skipWrite: true,
      contentType: 'application/json',
    };
  } finally {
    fs.closeSync(fd);
  }
}
