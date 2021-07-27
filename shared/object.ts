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
  return JSON.parse(JSON.stringify(a));
}
