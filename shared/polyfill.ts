if (!String.prototype.replaceAll) {
  String.prototype.replaceAll = function (match, replace) {
    return this.split(match).join(replace);
  };
}
