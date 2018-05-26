'use strict';
const chalk = require('chalk');

var merge = function(a, b) { return Object.assign({}, a, b); };
var progress = function (x) { process.stdout.write(Buffer.from(chalk.yellow(x))); };
var print = function(x) { progress(x + "\n"); };
var error = function(x) { print("Error: " + chalk.red.bold(x)); };
var when = function(question, f) {
  return merge(question, {
    when: f,
  });
};

module.exports = {
  merge: merge,
  progress: progress,
  print: print,
  error: error,
  when: when,
};