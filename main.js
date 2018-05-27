'use strict';
const { bold } = require('chalk');
const { error, print, progress, proxy } = require('./util');
const setup = require('./setup');

print(          "+-----------------------------------------------------+");
print("|" + bold("          Welcome to the Crypto USB Disk!            ") + "|");
print(          "| Make sure you only run this on an offline computer. |");
print(          "+-----------------------------------------------------+");

// TODO: test if online or not.

setup().then((seed) => {
  // TODO: Continue.
  console.log(seed);
}).catch((err) => {
  error("Failed to setup, quiting ...");
  // TODO: exit with non-zero exit code.
});
