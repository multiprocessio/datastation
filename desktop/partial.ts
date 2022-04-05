import fs from 'fs';
import { preview } from 'preview';
import { shape } from 'shape';
import { NoResultError } from '../shared/errors';
import log from '../shared/log';

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

  try {
    const { size } = fs.statSync(file);

    if (size < maxBytesToRead) {
      const f = fs.readFileSync(file).toString();
      let value: any = null;
      try {
        value = JSON.parse(f);
      } catch (e) {
        log.info('Could not parse JSON: ', e, { json: f });
        value = {};
      }

      return {
        size,
        arrayCount: Array.isArray(value) ? value.length : null,
        shape: shape(value),
        preview: preview(value),
        skipWrite: true,
        contentType: 'application/json',
      };
    }

    let done = false;
    let f = '';
    const incomplete = [];
    let inString = false;

    while (!done) {
      const bufferSize = 1024;
      const b = Buffer.alloc(bufferSize);
      const bytesRead = fs.readSync(fd, b);

      // To be able to iterate over code points
      let bs = Array.from(b.slice(0, bytesRead).toString());
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

      arrayCount = Math.ceil(size / (averageRowSize / n));
    }

    return {
      size,
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
