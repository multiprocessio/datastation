function unsafePreviewArray(
  obj: any,
  nKeys: number,
  nextNKeys: number,
  prefixChar: string,
  joinChar: string
) {
  const keys = obj.slice(0, nKeys);
  keys.sort();
  const suffix = obj.length > keys.length ? '...' : '';
  const childPreview = 
    keys
      .map((o: string) => prefixChar + unsafePreview(o, nextNKeys));
  childPreview.push(suffix);
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
  const firstKeys = keys.slice(0, nKeys);
  firstKeys.sort();
  const preview: Array<any> = [];
  keys.forEach((k) => {
    const formattedKey = `"${k.replaceAll('"', '\\"')}"`;
    preview.push(
      prefixChar + formattedKey + ': ' + unsafePreview(obj[k], nextNKeys)
    );
  });

  const suffix = keys.length > firstKeys.length ? '...' : '';
  preview.push(suffix);

  return ['{', preview.join(',' + joinChar), '}'].join(joinChar);
}

function unsafePreview(obj: any, nKeys: number, topLevel = false): string {
  if (!obj) {
    return String(obj);
  }

  // Decrease slightly slower than (nKeys / 2) each time
  const nextNKeys = nKeys < 1 ? 0 : Math.floor(nKeys * .6);
  const joinChar = topLevel ? '\n' : ' ';
  const prefixChar = topLevel ? '  ' : '';

  if (Array.isArray(obj)) {
    return unsafePreviewArray(obj, nKeys, nextNKeys, prefixChar, joinChar);
  }

  if (typeof obj === 'object') {
    return unsafePreviewObject(obj, nKeys, nextNKeys, prefixChar, joinChar);
  }

  const stringMax = 100;
  let res = String(obj).slice(0, stringMax);
  if (String(obj).length > stringMax) {
    res += '...';
  }

  if (typeof obj === 'string' && !topLevel) {
    res = `"${res.replace('"', '\\"')}"`;
  }

  return res;
}

export function previewObject(obj: any, nKeys = 10): string {
  try {
    return unsafePreview(obj, nKeys, true);
  } catch (e) {
    console.error(e);
    return String(obj).slice(nKeys * 10);
  }
}
