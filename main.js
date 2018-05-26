'use strict';
const util = require('util');
const inquirer = require('inquirer');
const crypto = require('crypto');
const chalk = require('chalk');
const sha1 = require('sha1');
const sha256 = require('sha256');
const md5 = require('md5');

const merge = function(a, b) { return Object.assign({}, a, b); };
const printProgress = function (x) { process.stdout.write(Buffer.from(chalk.yellow(x))); };
const print = function(x) { printProgress(x + "\n"); };
const error = function(x) { print("Error: " + chalk.red.bold(x)); }
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

var promptsForSetup = function() {

  var resolver, rejector;
  var res = {};

  var when = function(question, f) {
    return merge(question, {
      when: f,
    });
  };

  var fill = function(question, atts) {
    var question = JSON.parse(JSON.stringify(question));
    Object.getOwnPropertyNames(atts).forEach((att) => {
      question[att] = util.format(question[att], ...atts[att]);
    });
    return question;
  };

  var questionAction = {
    type: 'expand',
    name: 'action',
    message: "What action are you interested in performing?",
    choices: [
      {
        key: 'c',
        name: "Create a new wallet",
        value: 'create'
      },
      {
        key: 'r',
        name: "Retrieve a wallet that already exists",
        value: 'retrieve'
      },
    ],
  };

  var questionChecksumConfirm = {
    type: 'confirm',
    name: 'checksumConfirm',
    message: "Do you have access to a checksum?",
  };

  var questionChecksum = {
    type: 'input',
    name: 'checksum',
    message: "Enter the checksum:",
    validate: function(value) {
      var valid = value.match(/^[0-9a-fA-F]+$/) != null && value.length == 64;
      return valid || "Must be a valid hexadecimal number of 64 digits";
    },
  };

  var questionFormat = {
    type: 'expand',
    name: 'format',
    message: "What is the source of secrets that you have access to?",
    choices: [
      {
        key: 's',
        name: "A seed (a memorized string)",
        value: 'seed'
      },
      {
        key: 'b',
        name: "A set of backup code pieces in hexadecimal format",
        value: 'backup'
      },
    ],
  };

  var questionSeed = {
    type: 'input',
    name: 'seed',
    message: "Enter the seed (a memorized string):",
  };

  var questionNumberOfBackupPieces = {
    type: 'input',
    name: 'numberOfBackupPieces',
    message: "How many backup code pieces do you have?",
    validate: function(value) {
      var number = parseInt(value);
      var valid = !isNaN(number) && number > 0;
      return valid || "Must be a positive integer";
    },
    filter: Number,
  };

  var questionBackup = {
    type: 'input',
    name: 'backup[%i]',
    message: "Enter the backup code piece %i of %i:",
    validate: function(value) {
      var valid = value.match(/^[0-9a-fA-F]+$/) != null;
      return valid || "Must be a valid hexadecimal number";
    },
  };

  inquirer.prompt(questionAction).then((answers) => {
    res = merge(res, answers);
    if (res.action == 'create') {
      return inquirer.prompt(questionSeed);
    } else if (res.action == 'retrieve') {
      if (process.env.CHECKSUM) {
        print("Found checksum in the $CHECKSUM environment variable: " + chalk.bold(process.env.CHECKSUM));
        return Promise.resolve({checksum: process.env.CHECKSUM});
      } else {
        return inquirer.prompt([
          questionChecksumConfirm,
          when(questionChecksum, (answers) => {
            return answers['checksumConfirm'];
          }),
        ]);
      }
    }
  }).then((answers) => {
    res = merge(res, answers);
    if (res.action == 'retrieve') {
      return inquirer.prompt([
        questionFormat,
        when(questionSeed, (answers) => {
          return answers['format'] == 'seed';
        }),
        when(questionNumberOfBackupPieces, (answers) => {
          return answers['format'] == 'backup';
        }),
      ]);
    }
    return Promise.resolve({});
  }).then((answers) => {
    res = merge(res, answers);
    if (res['numberOfBackupPieces']) {
      var questions = [];
      for (var i = 0; i < res['numberOfBackupPieces']; i++) {
        questions.push(fill(questionBackup, {
          'name': [i],
          'message': [i+1, res['numberOfBackupPieces']],
        }));
      };
      return inquirer.prompt(questions);
    }
    return Promise.resolve({});
  }).then((answers) => {
    res = merge(res, answers);
    resolver(res);
  });

  return new Promise((resolve, reject) => {
    resolver = resolve;
    rejector = reject;
  });

};


var setup = function() {

  var resolver, rejector;

  print(chalk.bold("Welcome to the Crypto USB Disk! ") + "Make sure you only run this on an offline computer.");
  promptsForSetup().then(function(answers) {
    var seed;
    if (answers.action == 'create') {
      seed = Buffer.from(answers.seed);
      printProgress("Collecting entropy to generate backup codes, this might take a while ... ");
      var rand = crypto.randomBytes(seed.length);
      print(chalk.dim("Done!"));
      printProgress("Calculating checksum, this might take a while ... ");
      var checksum = calcChecksum(seed);
      print(chalk.dim("Done!"));
      var backup = xor(seed, rand).toString('hex') + rand.toString('hex');
      print("Backup code, which can be divided: " + chalk.bold(backup));
      print("Checksum is: " + chalk.bold(checksum));
    } else if (answers.action == 'retrieve') {
      if (answers.format == 'seed') {
        seed = Buffer.from(answers.seed);
        if (answers.checksum) {
          printProgress("Comparing seed to checksum, this might take a while ... ");
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
            printProgress("Comparing potential seeds to checksum, this might take a while ... ");
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

setup();
