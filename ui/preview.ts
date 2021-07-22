function unsafePreviewArray(
  obj: any,
  nKeys: number,
  nextNKeys: number,
  prefixChar: string,
  joinChar: string
) {
  const keys = obj.slice(0, nKeys);
  const childPreview = keys.map(
    (o: string) => prefixChar + unsafePreview(o, nextNKeys)
  );
  if (obj.length > nKeys) {
    childPreview.push(prefixChar + '...');
  }
  return ['[', childPreview.join(',' + joinChar), ']'].join(joinChar);
}

function unsafePreviewObject(
  obj: any,
  nKeys: number,
  nextNKeys: number,
  prefixChar: string,
  joinChar: string
) {
  const keys = Object.keys(obj);
  keys.sort();
  const firstKeys = keys.slice(0, nKeys);
  const preview: Array<any> = [];
  firstKeys.forEach((k) => {
    const formattedKey = `"${k.replaceAll('"', '\\"')}"`;
    preview.push(
      prefixChar + formattedKey + ': ' + unsafePreview(obj[k], nextNKeys)
    );
  });

  if (keys.length > nKeys) {
    preview.push(prefixChar + '...');
  }

  return ['{', preview.join(',' + joinChar), '}'].join(joinChar);
}

function unsafePreview(obj: any, nKeys: number, topLevel = false): string {
  if (!obj) {
    return String(obj);
  }

  // Decrease slightly slower than (nKeys / 2) each time
  const nextNKeys = nKeys < 1 ? 0 : Math.floor(nKeys * 0.6);
  const joinChar = topLevel ? '\n' : ' ';
  const prefixChar = topLevel ? '  ' : '';

  if (Array.isArray(obj)) {
    return unsafePreviewArray(obj, nKeys, nextNKeys, prefixChar, joinChar);
  }

  if (typeof obj === 'object') {
    return unsafePreviewObject(obj, nKeys, nextNKeys, prefixChar, joinChar);
  }

  let stringMax = 200;
  if (typeof obj === 'string' && topLevel) {
    stringMax = 5000;
  }

  // Truncate before quoting
  let res = String(obj).slice(0, stringMax);
  if (String(obj).length > stringMax) {
    res += '...';
  }

  if (typeof obj === 'string' && !topLevel) {
    return `"${res.replaceAll('"', '\\"')}"`;
  }

  return res;
}

export function previewObject(obj: any, nKeys = 20): string {
  try {
    return unsafePreview(obj, nKeys, true);
  } catch (e) {
    console.error(e);
    return String(obj).slice(0, 200);
  }
}
