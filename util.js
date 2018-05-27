'use strict';
const { yellow, red, green, dim, bold } = require('chalk');

const PROMPT = green("<") + " ";

var p = function (x, p, c) { process.stdout.write(Buffer.from((p ? "" : PROMPT) + (c ? x : yellow(x)))); };
var error = function(x) { p(red.underline.bold("Error:") + " " + red.bold(x) + "\n", false, true); };
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
  var x, y;
  var promise = new Promise((a, b) => { x = a; y = b; });
  promise.proceed = x; promise.resolve = x; promise.reject = y;
  return promise;
};

module.exports = {
  error: error,
  print: print,
  progress: progress,
  proxy, proxy,
};
