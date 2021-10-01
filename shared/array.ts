export function chunk<T>(a: Array<T>, n: number): Array<Array<T>> {
  if (n === 0) {
    return [a];
  }

  const chunks: Array<Array<T>> = [];

  let i = 0;
  while (i < a.length) {
    chunks.push(a.slice(i, (i += n)));
  }

  return chunks;
}
