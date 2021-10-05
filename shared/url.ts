export function fullHttpURL(
  address: string,
  port: number | string,
  defaultPort?: number
) {
  address = address || 'localhost';
  let guessedPort = port || defaultPort || '80';

  let [domain, ...path] = address.split('/');
  let protocol = '';

  if (address.startsWith('http://') || address.startsWith('https://')) {
    protocol =
      domain +
      address.slice(address.indexOf(':') + 1, address.indexOf('//') + 2);
    [domain, ...path] = address.slice(protocol.length).split('/');
    domain = protocol + domain;
    // When protocol is specified, don't let defaultPort override the given port.
    // But users can still explicitly override the port, just not the defaultPort.
    if (!port) {
      guessedPort = '';
    }
  } else {
    if (String(guessedPort) === '443') {
      // Return full address with path
      return 'https://' + address;
    }

    // Only append to _domain_ so we can add port optionally later
    protocol = 'http://';
    domain = protocol + domain;
    if (String(guessedPort) === '80') {
      return [domain, ...path].join('/');
    }
  }

  if (!guessedPort || domain.slice(protocol.length).includes(':')) {
    return [domain, ...path].join('/');
  }

  return [domain + ':' + String(guessedPort), ...path].join('/');
}

export function queryParameters(d: Record<string, string | undefined>) {
  let q = '';
  for (const [key, value] of Object.entries(d)) {
    if (q) {
      q += '&';
    }

    q += `${key}=${encodeURIComponent(value)}`;
  }

  return q;
}
