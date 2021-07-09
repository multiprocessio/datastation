function unsafePreviewArray(
  obj: any,
  nKeys: number,
  nextNKeys: number,
  joinChar: string
) {
  const keys = obj.slice(0, nKeys);
  keys.sort();
  const suffix = obj.length > keys.length ? '...' : '';
  const childPreview =
    keys.map((o: string) => unsafePreview(o, nextNKeys)).join(',' + joinChar) +
    suffix;
  return ['[', childPreview, ']'].join(joinChar);
}

function unsafePreviewObject(
  obj: any,
  nKeys: number,
  nextNKeys: number,
  joinChar: string
) {
  const keys = Object.keys(obj);
  const firstKeys = keys.slice(0, nKeys);
  firstKeys.sort();
  const preview: Array<any> = [];
  keys.forEach((k) => {
    const formattedKey = `"${k.replace('"', '\\"')}"`;
    preview.push(formattedKey + ': ' + unsafePreview(obj[k], nextNKeys));
  });

  const suffix = keys.length > firstKeys.length ? '...' : '';

  return ['{', preview.join(',' + joinChar) + suffix, '}'].join(joinChar);
}

function unsafePreview(obj: any, nKeys: number, topLevel = false): string {
  if (!obj) {
    return String(obj);
  }

  const nextNKeys = nKeys < 1 ? 0 : nKeys / 2;
  const joinChar = topLevel ? '\n' : ' ';

  if (Array.isArray(obj)) {
    return unsafePreviewArray(obj, nKeys, nextNKeys, joinChar);
  }

  if (typeof obj === 'object') {
    return unsafePreviewObject(obj, nKeys, nextNKeys, joinChar);
  }

  const stringMax = nKeys * 10;
  let res = String(obj).slice(0, stringMax);
  if (String(obj).length > stringMax) {
    res += '...';
  }

  if (typeof obj === 'string') {
    res = `"${res.replace('"', '\\"')}"`;
  }

  return res;
}

export function previewObject(obj: any, nKeys = 100): string {
  try {
    return unsafePreview(obj, nKeys, true);
  } catch (e) {
    console.error(e);
    return String(obj).slice(nKeys * 10);
  }
}
