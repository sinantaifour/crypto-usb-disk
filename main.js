'use strict';
const { bold } = require('chalk');
const { merge, progress, print, error, when, fill, proxy } = require('./util');
const setup = require('./setup');

print(          "+-----------------------------------------------------+");
print("|" + bold("          Welcome to the Crypto USB Disk!            ") + "|");
print(          "| Make sure you only run this on an offline computer. |");
print(          "+-----------------------------------------------------+");

// TODO: test if online or not.

setup().then((seed) => {
  // TODO: Continue.
});
