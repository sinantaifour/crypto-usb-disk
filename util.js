'use strict';
const { yellow, red, green, dim, bold } = require('chalk');

const PROMPT = green(">") + " ";

var merge = function(a, b) { return Object.assign({}, a, b); };
var p = function (x, p, c) { process.stdout.write(Buffer.from((p ? "" : PROMPT) + (c ? x : yellow(x)))); };
var error = function(x) { p(red.underline.bold("Error:") + " " + red.bold(x), false, true); };
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
  p(dim("Done!") + "\n", true);
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
