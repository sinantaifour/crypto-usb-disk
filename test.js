'use strict';
const { spawn } = require('child_process');
const { red, green, yellow } = require('chalk');
const { proxy } = require('./util');
const print = console.log;

// TODO: check exit codes too.
// TODO: check paths that use environment variables too (or maybe don't use them!)
// TODO: a test that a generate backup code actually can restore.
// TODO: make tests timeout.

var Test = function(name, inputs, asserts) {

  var buffer = [];
  var log = function(x) { buffer.push(x); };

  var cmd;
  var error;
  var waiter = proxy();
  var that = this;
  waiter.then(() => { that.printReport(); });

  var questions = [];
  var done = false;
  var res = proxy();
  res.then(() => {
    done = true; cmd.kill(9); waiter.resolve();
  }).catch((err) => {
    error = err;
    done = true; cmd.kill(9); waiter.resolve();
  });

  var start = function() {
    cmd = spawn('node', ['./main.js']);

    cmd.stdin.setEncoding('utf-8');

    cmd.stdout.on('data', (data) => {
      if (done) return;
      data.toString('utf-8').split("\n").forEach((l) => {
        if (l.startsWith("? ")) {
          var question = l.match(/^\?.*?(\?|:)/)[0];
          if (questions.indexOf(question) == -1) {
            if (inputs.length == 0) {
              res.reject(new Error("Too many questions"));
            }
            questions.push(question);
            var input = inputs.shift();
            log("que:" + question + " " + input);
            cmd.stdin.write(input + "\n");
          }
        } else if (l.startsWith("< ")) {
          var matches = asserts.filter((t) => {
            return !!l.match(t[0]);
          });
          log((matches.length == 1 ? "ass:" : "out:") + l);
          if (matches.length == 1) {
            var m = matches[0];
            if (!l.match(m[1])) {
              res.reject(new Error("Assertion does not match"));
            }
            asserts = asserts.slice(0, asserts.indexOf(m)).concat(asserts.slice(asserts.indexOf(m)+1, asserts.length));
          } else if (matches.length > 1) {
            res.reject(new Error("Multiple assertions matched an output line"));
          }
          if (asserts.length == 0) {
            res.resolve();
          }
        }
      });
    });

    cmd.on('exit', (code, signal) => {
      if (asserts.length == 0) {
        res.resolve();
      } else {
        res.reject(new Error("Subprocess died before all assertions were matched"));
      }
    });

    return this;
  };

  start();

  this.getName = function() { return name; };
  this.getWaiter = function() { return waiter; };
  this.getError = function() { return error; };
  this.getLog = function() { return buffer; };
  this.printReport = function() {
    print(yellow("=== " + this.getName() + " ==="));
    if (this.getError()) {
      print(red.bold("Failed! " + this.getError()));
      print(red.dim(this.getLog().join("\n")));
    } else {
      print(green("Passed!"))
      print(green.dim(this.getLog().join("\n")));
    }
    print("");
  };

};

Promise.resolve().then(() => {

  return new Test(
    "wallet creation from seed",
    ["c", "hellothere"],
    [
      [/seed that will be used is:/i, /: hellothere$/],
      [/checksum of seed that will be used is:/i, /: e9c4ec051d956791c7323a090a022d559c7dcf122ef9152b0e9171a04ccf800c$/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet creation from a different seed",
    ["c", "coolstuff"],
    [
      [/seed that will be used is:/i, /: coolstuff$/],
      [/checksum of seed that will be used is:/i, /: fc2d2f761f447d9e36438b133ea940b6ab31516effbbd25af3ec5c0087d19a9c$/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet retrieval from a seed without a checksum",
    ["r", "n", "s", "hellothere"],
    [
      [/seed that will be used is:/i, /: hellothere$/],
      [/checksum of seed that will be used is:/i, /: e9c4ec051d956791c7323a090a022d559c7dcf122ef9152b0e9171a04ccf800c$/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet retrieval from another seed without a checksum",
    ["r", "n", "s", "coolstuff"], [
      [/seed that will be used is:/i, /: coolstuff$/],
      [/checksum of seed that will be used is:/i, /: fc2d2f761f447d9e36438b133ea940b6ab31516effbbd25af3ec5c0087d19a9c$/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet retrieval from a seed with a checksum",
    ["r", "y", "e9c4ec051d956791c7323a090a022d559c7dcf122ef9152b0e9171a04ccf800c", "s", "hellothere"],
    [
      [/seed that will be used is:/i, /: hellothere$/],
      [/checksum of seed that will be used is:/i, /: e9c4ec051d956791c7323a090a022d559c7dcf122ef9152b0e9171a04ccf800c$/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet retrieval from a seed with an incorrect checksum",
    ["r", "y", "e9c4ec051d956791c7323a090a022d559c7dcf122ef9152b0e9171a04ccf800d", "s", "hellothere"],
    [
      [/error: seed does not match checksum!/i, /.+/],
      [/error: failed to setup/i, /.+/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet retrieval from a single-piece backup code without a checksum",
    ["r", "n", "b", "1", "115e9176cf1135659d9f793bfd1aa0655d00effa"],
    [
      [/seed that will be used is:/i, /: hellothere$/],
      [/checksum of seed that will be used is:/i, /: e9c4ec051d956791c7323a090a022d559c7dcf122ef9152b0e9171a04ccf800c$/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet retrieval from another single-piece backup code without a checksum",
    ["r", "n", "b", "1", "4eb5544bb17bf9ee682dda3b27c20f8c880e"],
    [
      [/seed that will be used is:/i, /: coolstuff$/],
      [/checksum of seed that will be used is:/i, /: fc2d2f761f447d9e36438b133ea940b6ab31516effbbd25af3ec5c0087d19a9c$/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet retrieval from a multi-piece backup with a checksum",
    ["r", "y", "e9c4ec051d956791c7323a090a022d559c7dcf122ef9152b0e9171a04ccf800c", "b", "4", "f1135659", "d9f793bfd1", "aa0655d00effa", "115e9176c"],
    [
      [/seed that will be used is:/i, /: hellothere$/],
      [/checksum of seed that will be used is:/i, /: e9c4ec051d956791c7323a090a022d559c7dcf122ef9152b0e9171a04ccf800c$/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet retrieval from a multi-piece backup with an incorrect checksum",
    ["r", "y", "e9c4ec051d956791c7323a090a022d559c7dcf122ef9152b0e9171a04ccf800d", "b", "4", "f1135659", "d9f793bfd1", "aa0655d00effa", "115e9176c"],
    [
      [/error: none of the potential seeds match the checksum/i, /.+/],
      [/error: failed to setup/i, /.+/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet retrieval from a multi-piece backup with incorrect number of digits",
    ["r", "n", "b", "4", "1135659", "d9f793bfd1", "aa0655d00effa", "115e9176c"],
    [
      [/error: the number of hexadecimal digits is not divisible by four./i, /.+/],
      [/error: failed to setup/i, /.+/],
    ]
  ).getWaiter();

}).then(() => {

  return new Test(
    "wallet retrieval from a multi-piece backup without a checksum",
    ["r", "n", "b", "4", "115e9176c", "f1135659", "d9f793bfd1", "aa0655d00effa", ""], // Empty string will select the first option.
    [
      [/seed that will be used is:/i, /: hellothere$/],
      [/checksum of seed that will be used is:/i, /: e9c4ec051d956791c7323a090a022d559c7dcf122ef9152b0e9171a04ccf800c$/],
    ]
  ).getWaiter();

});
