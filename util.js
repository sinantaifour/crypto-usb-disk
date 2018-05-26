'use strict';
const { yellow, red, dim, bold } = require('chalk');

var merge = function(a, b) { return Object.assign({}, a, b); };
var p = function (x) { process.stdout.write(Buffer.from(yellow(x))); };
var print = function(x, y) {
  if (y) {
    p(x + ": " + bold(y) + "\n");
  } else {
    p(x + "\n");
  }
};
var error = function(x) { p(red.underline.bold("Error:") + " " + red.bold(x)); };
var progress = function(x, f) {
  p(x + ", this might take a while... ");
  var res = f();
  print(dim("Done!"));
  return res;
};
var when = function(question, f) {
  return merge(question, {
    when: f,
  });
};
var proxy = function() {
  var f;
  var promise = new Promise((r, _) => { f = r; });
  promise.proceed = function(x) { f(x); };
  return promise;
};

module.exports = {
  merge: merge,
  progress: progress,
  print: print,
  error: error,
  when: when,
  proxy, proxy,
};
