export function fullHttpURL(address: string, port: number | string) {
  address = address || 'localhost';
  port = port || '80';

  let [domain, ...path] = address.split('/');

  // Compare _address_ not domain here since protocol contains '/'
  if (!address.startsWith('http://') && !address.startsWith('https://')) {
    if (String(port) === '443') {
      // Return full address with path
      return 'https://' + address;
    }

    // Only append to _domain_ so we can add port optionally later
    domain = 'http://' + domain;
    if (String(port) === '80') {
      return [domain, ...path].join('/');
    }
  }

  if (!port) {
    return [domain, ...path].join('/');
  }

  return [domain + ':' + String(port), ...path].join('/');
}
