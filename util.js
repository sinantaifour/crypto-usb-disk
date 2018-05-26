'use strict';
const { yellow, red, dim, bold } = require('chalk');

var merge = function(a, b) { return Object.assign({}, a, b); };
var p = function (x, k) { process.stdout.write(Buffer.from(k ? x : yellow(x))); };
var error = function(x) { p(red.underline.bold("Error:") + " " + red.bold(x), true); };
var print = function(x, y) {
  if (y) {
    p(x + ": " + bold(y) + "\n");
  } else {
    p(x + "\n");
  }
};
var progress = function(x, f) {
  p(x + ", this might take a while... ");
  var res = f();
  print(dim("Done!"));
  return res;
};
var proxy = function() {
  var f;
  var promise = new Promise((r, _) => { f = r; });
  promise.proceed = function(x) { f(x); };
  return promise;
};

module.exports = {
  merge: merge,
  error: error,
  print: print,
  progress: progress,
  proxy, proxy,
};
