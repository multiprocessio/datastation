type Shape =
  {
    kind: 'scalar';
    name: 'null' | 'string' | 'number' | 'boolean';
  }
  |
  {
    kind: 'array',
    children: Shape,
  }
  |
  {
    kind: 'object',
    children: Record<string, Shape>,
  }
  |
  {
    kind: 'varied',
    children: shape[],
  }
  |
  {
    kind: 'unknown',
  }

function toString(shape: Shape) {
  switch (shape.kind) {
    case 'scalar':
      return shape.name;
    case 'array':
      return 'array of ' + toString(shape.children);
    case 'object':
      return 'object with ' + shape.children.keys().map(k => `'${k}' of ${toString(shape.children[k])}`).join(', ');
    case 'varied':
      return shape.children.map(toString).join(' or ');
    case 'unknown':
      return 'unknown';
  }
}

function arrayMerge(shapes: Array<Shape>): { kind: 'array', children: Shape } {
  const merged = { kind: 'array', children: { kind: 'unknown' } };
  if (!shapes.length) {
    return merged;
  }

  merged.children = shapes[0].kind;
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];

    if (JSON.stringify(merged.children) === JSON.stringify(shape)) {
      continue;
    }

    if (merged.children.kind === 'unknown') {
      merged.children = shape.kind;
      continue;
    }

    if (merged.children.kind === shape.kind) {
      if (shape.kind === 'object') {
        const newKeys = shape.children.keys().filter(k => merged.children.keys().indexOf(k) < 0);
        newKeys.forEach(k => {
          merged.children.children[k] = shape.children[k];
        });
        continue;
      }

      if (shape.kind === 'array') {
        merged.children.children = arrayMerge(merged.children.children, shape.children);
        continue;
      }
    }

    merged.children = {
      'varied',
      children: [merged.children, shape.kind],
    };
  }

  return { kind: 'array', children };
}

function shapeOfArray(data: any[]) {
  const shapes = data.map(shape);
  return arrayMerge(shapes);
}

function shapeOfObject(data: object) {
  const keys = Object.keys(data);
  return { kind: 'object', keys.reduce((agg, k) => ({ ...agg, [k]: shape(data[k]) }), {}) };
}

export function shape(data: any) {
  if (Array.isArray(data)) {
    return shapeOfArray(data as any[]);
  }

  if (data === null) {
    return { kind: 'scalar', name: 'null' };
  }

  if (typeof data === 'object') {
    return shapeOfObject(data);
  }

  return { kind: 'scalar', name: typeof data };
}
