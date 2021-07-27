import { deepClone, deepEquals } from './object';

export type ScalarShape = {
  kind: 'scalar';
  name: 'null' | 'string' | 'number' | 'boolean' | 'bigint';
};

export type ObjectShape = {
  kind: 'object';
  children: Record<string, Shape>;
};

export type ArrayShape = {
  kind: 'array';
  children: Shape;
};

export type VariedShape = {
  kind: 'varied';
  children: Shape[];
};

export type Shape =
  | ArrayShape
  | ObjectShape
  | VariedShape
  | ScalarShape
  | {
      kind: 'unknown';
    };

export function levelPrefix(level: number) {
  return [...Array(level * 2).keys()].map((c) => ' ').join('');
}

export function toString(shape: Shape, level = 0): string {
  switch (shape.kind) {
    case 'scalar':
      return levelPrefix(level) + shape.name;
    case 'array':
      return (
        levelPrefix(level) + 'Array of\n' + toString(shape.children, level + 1)
      );
    case 'object':
      return (
        levelPrefix(level) +
        ('Object with\n' +
          Object.keys(shape.children)
            .map(
              (k) =>
                `${levelPrefix(level + 1)}'${k}' of\n${toString(
                  shape.children[k],
                  level + 2
                )}`
            )
            .join(',\n'))
      );
    case 'varied':
      return shape.children.map((c) => toString(c, level)).join(' or\n');
    case 'unknown':
      return levelPrefix(level) + 'Unknown';
  }
}

function objectMerge(a: ObjectShape, b: ObjectShape) {
  const aKeys = Object.keys(a.children);
  const bKeys = Object.keys(b.children);

  // First check all aKeys to see if they differ in b
  for (let i = 0; i < aKeys.length; i++) {
    const key = aKeys[i];
    if (bKeys.includes(key)) {
      if (!deepEquals(a.children[key], b.children[key])) {
        a.children[key] = {
          kind: 'varied',
          children: [a.children[key], b.children[key]],
        };
      }

      // If they're equal that's ok, do nothing.
    }
  }

  // Now check all bKeys to see if they are new to a
  for (let i = 0; i < bKeys.length; i++) {
    const key = bKeys[i];
    if (!aKeys.includes(key)) {
      a.children[key] = b.children[key];
    }
  }
}

function merge(shapes: Array<Shape>): Shape {
  const merged: Shape = { kind: 'array', children: { kind: 'unknown' } };
  if (!shapes.length) {
    return merged;
  }

  merged.children = shapes[0];
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];

    if (deepEquals(merged.children, shape)) {
      continue;
    }

    if (merged.children.kind === 'unknown') {
      merged.children = shape;
      continue;
    }

    if (merged.children.kind === shape.kind) {
      if (shape.kind === 'object') {
        objectMerge(merged.children as ObjectShape, shape as ObjectShape);
        continue;
      }

      if (shape.kind === 'array') {
        // TODO: support this
        continue;
      }
    }

    merged.children = {
      kind: 'varied',
      children: [deepClone(merged.children), shape],
    };
  }

  return merged;
}

function shapeOfArray(data: any[]) {
  const shapes = data.map(shape);
  return merge(shapes);
}

function shapeOfObject(data: Record<string, any>): Shape {
  const keys = Object.keys(data);
  return {
    kind: 'object',
    children: keys.reduce((agg, k) => ({ ...agg, [k]: shape(data[k]) }), {}),
  };
}

export function shape(data: any): Shape {
  try {
    if (Array.isArray(data)) {
      return shapeOfArray(data as any[]);
    }

    if (data === null) {
      return { kind: 'scalar', name: 'null' };
    }

    if (typeof data === 'object') {
      return shapeOfObject(data);
    }

    if (typeof data === 'number') {
      return { kind: 'scalar', name: 'number' };
    }

    if (typeof data === 'bigint') {
      return { kind: 'scalar', name: 'bigint' };
    }

    if (typeof data === 'undefined') {
      return { kind: 'scalar', name: 'null' };
    }

    if (typeof data === 'boolean') {
      return { kind: 'scalar', name: 'boolean' };
    }

    return { kind: 'scalar', name: 'string' };
  } catch (e) {
    console.error(e);
    return { kind: 'unknown' };
  }
}
