import 'core-js/actual/structured-clone';

// SOURCE: https://stackoverflow.com/a/34749873/1507139
function isObject(item: any) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export function mergeDeep(target: any, source: any) {
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return target;
}

export function deepEquals(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function deepClone(a: any) {
  if ((globalThis as any).structuredClone) {
    return (globalThis as any).structuredClone(a);
  }

  return JSON.parse(JSON.stringify(a));
}

export function getPath(obj: any, path: string): any {
  if (!path) {
    return obj;
  }

  const pieces = path.split('.');

  let current = obj;
  for (let i = 0; i < pieces.length; i++) {
    let piece = pieces[i];
    const optional = piece.endsWith('?');
    if (optional) {
      piece = piece.slice(0, piece.length - 1);

      if (current && !current[piece]) {
        return {};
      }
    }

    if (!current || !current[piece]) {
      return undefined;
    }

    current = current[piece];
  }

  return current;
}

export function setPath(obj: any, path: string, v: any) {
  const parentPath = path.split('.');
  const lastPath = parentPath.pop();
  const parent = getPath(obj, parentPath.join('.'));
  if (!parent) {
    throw new Error('Invalid set path: ' + path);
  }

  parent[lastPath] = v;
}

export function validate(
  obj: any,
  requiredFields: string[],
  handler: (arg0: string) => void
) {
  requiredFields.forEach((field) => {
    if (!getPath(obj, field)) {
      handler(field.replaceAll('?', ''));
    }
  });
}

export const windowOrGlobal = (() => {
  try {
    return global;
  } catch (e) {
    return window;
  }
})();
