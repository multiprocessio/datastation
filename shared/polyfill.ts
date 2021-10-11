if (!(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
}

if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function (match, replace) {
    if (typeof replace === 'function') {
      throw new Error('Node.js does not support replaceAll with functions');
    }
    return this.split(match).join(replace);
  };
}
