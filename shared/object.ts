import { preview } from 'preview';

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

export function columnsFromObject(value: any, columns: Array<string>) {
  if (value && !Array.isArray(value)) {
    throw new Error(
      `Expected array input to graph, got (${typeof value}): ` + preview(value)
    );
  }

  console.log(value, columns);
  return (value || []).map((row: any) => {
    // If none specified, select all
    if (!columns.length) {
      return row;
    }

    if (!row) {
      return null;
    }

    const cells: Record<string, any> = {};
    (columns || []).forEach((name) => {
      cells[name] = row[name];
    });
    return cells;
  });
}
