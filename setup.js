'use strict';
const inquirer = require('inquirer');
const crypto = require('crypto');
const chalk = require('chalk');
const sha1 = require('sha1');
const sha256 = require('sha256');
const md5 = require('md5');
const { format } = require('util');
const { merge, progress, print, error, when, fill } = require('./util');

const xor = function(a, b) {
  var res = Buffer.alloc(a.length);
  for (var i = 0; i < a.length; i++) {
    res[i] = a[i] ^ b[i];
  }
  return res;
};

const permute = function(a) {
  if (a.length == 1) { return [a]; }
  var res = [];
  for (var i = 0; i < a.length; i++) {
    var sub = permute(a.slice(0, i).concat(a.slice(i+1, a.length)));
    for (var j = 0; j < sub.length; j++) {
      res.push([a[i]].concat(sub[j]));
    }
  }
  return res;
};

const calcChecksum = function(x, c) {
  return sha256(md5(sha1(c == 1 ? x : calcChecksum(x, (c || 3500) - 1))));
};

const ACTION = 'action', CREATE = 'create', RETRIEVE = 'retrieve';
const FORMAT = 'format', SEED = 'seed', BACKUP = 'backup';
const CHECKSUM = 'checksum';

var inputs = function() {

  const CHECKSUM_CONFIRM = 'checksumConfirm', NUMBER_OF_BACKUP_PIECES = 'numberOfBackupPieces';

  var resolver, rejector;
  var res = {};
  var promise = new Promise((resolve, reject) => {
    resolver = resolve;
    rejector = reject;
  });

  var mergeAndRun = function(f) {
    return function(answers) {
      res = merge(res, answers);
      return f(res);
    }
  };

  var newProxyPromise = function() {
    var f;
    var promise = new Promise((r, _) => { f = r; });
    promise.proceed = function() { f(); };
    return promise;
  };

  const questionAction = {
    type: 'expand',
    name: ACTION,
    message: "What action are you interested in performing?",
    choices: [
      {
        key: 'c',
        name: "Create a new wallet",
        value: CREATE
      },
      {
        key: 'r',
        name: "Retrieve a wallet that already exists",
        value: RETRIEVE
      },
    ],
  };

  const questionChecksumConfirm = {
    type: 'confirm',
    name: CHECKSUM_CONFIRM,
    message: "Do you have access to a checksum?",
  };

  const questionChecksum = {
    type: 'input',
    name: CHECKSUM,
    message: "Enter the checksum:",
    validate: function(value) {
      var valid = value.match(/^[0-9a-fA-F]+$/) != null && value.length == 64;
      return valid || "Must be a valid hexadecimal number of 64 digits";
    },
  };

  const questionFormat = {
    type: 'expand',
    name: FORMAT,
    message: "What is the source of secrets that you have access to?",
    choices: [
      {
        key: 's',
        name: "A seed (a memorized string)",
        value: SEED,
      },
      {
        key: 'b',
        name: "A set of backup code pieces in hexadecimal format",
        value: BACKUP,
      },
    ],
  };

  const questionSeed = {
    type: 'input',
    name: SEED,
    message: "Enter the seed (a memorized string):",
  };

  const questionNumberOfBackupPieces = {
    type: 'input',
    name: NUMBER_OF_BACKUP_PIECES,
    message: "How many backup code pieces do you have?",
    validate: function(value) {
      var number = parseInt(value);
      var valid = !isNaN(number) && number > 0;
      return valid || "Must be a positive integer";
    },
    filter: Number,
  };

  const questionBackup = function(i, j) {
    return {
      type: 'input',
      name: format(BACKUP + '[%i]', i),
      message: format("Enter the backup code piece %i of %i:", i + 1, j),
      validate: function(value) {
        var valid = value.match(/^[0-9a-fA-F]+$/) != null;
        return valid || "Must be a valid hexadecimal number";
      },
    };
  };

  var afterCreate = newProxyPromise();
  var afterRetrieve = newProxyPromise();

  inquirer.prompt(questionAction).then(mergeAndRun(() => {
    if (res[ACTION] == CREATE) {
      afterCreate.proceed();
    } else if (res[ACTION] == RETRIEVE) {
      afterRetrieve.proceed();
    }
  }));

  afterCreate.then(() => {
    var h = {}; h[FORMAT] = SEED;
    res = merge(res, h);
    return inquirer.prompt(questionSeed);
  }).then(mergeAndRun(resolver));

  afterRetrieve.then(() => {
    var questions = [];
    if (process.env.CHECKSUM) {
      print("Found checksum in the $CHECKSUM environment variable: " + chalk.bold(process.env.CHECKSUM));
      var h = {}; h[CHECKSUM] = process.env.CHECKSUM;
      res = merge(res, h);
    } else {
      questions = questions.concat([
        questionChecksumConfirm,
        when(questionChecksum, (answers) => {
          return answers[CHECKSUM_CONFIRM];
        }),
      ]);
    }
    questions = questions.concat([
      questionFormat,
      when(questionSeed, (answers) => {
        return answers[FORMAT] == SEED;
      }),
      when(questionNumberOfBackupPieces, (answers) => {
        return answers[FORMAT] == BACKUP;
      }),
    ]);
    return inquirer.prompt(questions);
  }).then(mergeAndRun(() => {
    var n = res[NUMBER_OF_BACKUP_PIECES];
    delete res[CHECKSUM_CONFIRM];
    delete res[NUMBER_OF_BACKUP_PIECES];
    if (n) {
      var questions = [];
      for (var i = 0; i < n; i++) {
        questions.push(questionBackup(i, n));
      };
      return inquirer.prompt(questions);
    } else {
      resolver(res);
    }
  })).then(mergeAndRun(resolver));

  return promise;

};


var setup = function() { // TODO: use the consts.

  var resolver, rejector;

  print(chalk.bold("Welcome to the Crypto USB Disk! ") + "Make sure you only run this on an offline computer.");
  inputs().then(function(answers) {
    var seed;
    if (answers.action == 'create') {
      seed = Buffer.from(answers.seed);
      progress("Collecting entropy to generate backup codes, this might take a while ... ");
      var rand = crypto.randomBytes(seed.length);
      print(chalk.dim("Done!"));
      progress("Calculating checksum, this might take a while ... ");
      var checksum = calcChecksum(seed);
      print(chalk.dim("Done!"));
      var backup = xor(seed, rand).toString('hex') + rand.toString('hex');
      print("Backup code, which can be divided: " + chalk.bold(backup));
      print("Checksum is: " + chalk.bold(checksum));
    } else if (answers.action == 'retrieve') {
      if (answers.format == 'seed') {
        seed = Buffer.from(answers.seed);
        if (answers.checksum) {
          progress("Comparing seed to checksum, this might take a while ... ");
          var checksum = calcChecksum(seed);
          print(chalk.dim("Done!"));
          if (checksum != process.env.CHECKSUM) {
            error("Seed does not match checksum!");
            seed = null;
          }
        } else {
          print("No checksum was provided, continuing without checking against checksum.");
        }
      } else if (answers.format == 'backup') {
        var n = answers.backup.join("").length;
        if (n % 4 != 0) {
          error("The number of hexadecimal digits is not divisible by four.");
        } else {
          var permutations = permute(answers.backup);
          var potentialSeeds = []
          for (var i = 0; i < permutations.length; i++) {
            var permutation = permutations[i].join("");
            var potentialCipher = permutation.slice(0, n/2);
            var potentialRand = permutation.slice(n/2, n);
            potentialSeeds.push(xor(Buffer.from(potentialCipher, 'hex'), Buffer.from(potentialRand, 'hex')));
          }
          potentialSeeds = [...new Set(potentialSeeds.map((x) => { return x.toString('hex') }))].map((x) => { return Buffer.from(x, 'hex') }); // A stupid unique.
          if (answers.checksum) {
            progress("Comparing potential seeds to checksum, this might take a while ... ");
            for (var i = 0; i < potentialSeeds.length; i++) {
              if (calcChecksum(potentialSeeds[i]) == answers.checksum) {
                seed = potentialSeeds[i];
                break;
              }
            }
            print(chalk.dim("Done!"));
          } else if (potentialSeeds.length == 1) {
            print("There is only one potential seed, will continue with it eventhough there is no checksum to compare it against.");
            seed = potentialSeeds[0];
          } else {
            // TODO: Allow the user to select.
            error("There is more than one potential seed. A checksum is needed to find the right one, you must set the $CHECKSUM environment variable.");
          }
        }
      }
    }
    if (seed) {
      if (seed.toString().match(/^[\x20-\x7E]*$/)) {
        print("Seed is: " + chalk.bold(seed));
      } else {
        print("Seed contains non-printable characters, it is roughly: " + chalk.bold(seed.toString().replace(/[^\x20-\x7E]/g, "?")));
      }
      resolver(seed);
    } else {
      error("Failed to retrieve seed.");
      rejector();
    }
  });

  return new Promise(function(resolve, reject) {
    resolver = resolve;
    rejector = reject;
  });

};

module.exports = setup;
