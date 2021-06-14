import fs from 'fs/promises';

import fetch from 'node-fetch';

import { parseArrayBuffer } from '../shared/text';

import { additionalParsers } from './http';

export const evalFileHandler = {
  resource: 'evalFile',
  handler: async function (
    _: string,
    { name, type }: { name: string; type: string }
  ) {
    const body = await fs.readFile(name);
    return await parseArrayBuffer(type, body, additionalParsers);
  },
};
