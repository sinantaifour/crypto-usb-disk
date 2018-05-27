'use strict';
const inquirer = require('inquirer');
const crypto = require('crypto');
const { bold, italic } = require('chalk');
const sha1 = require('sha1');
const sha256 = require('sha256');
const md5 = require('md5');
const { format } = require('util');
const { merge, error, print, progress, proxy } = require('./util');

// TODO: turn this file into an object. No need to pass answers around, set
// on the object directly. Also no need to split into collection of inputs
// then running, can be done an interlaced fashion (and share some decision
// logic therefore).

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

var mask = function(x) { return x; } // Overwritten if masking is needed.

const ACTION = 'action', CREATE = 'create', RETRIEVE = 'retrieve';
const FORMAT = 'format', SEED = 'seed', BACKUP = 'backup';
const CHECKSUM = 'checksum', MASK = 'mask';

var inputs = function() {

  const CHECKSUM_CONFIRM = 'checksumConfirm', NUMBER_OF_BACKUP_PIECES = 'numberOfBackupPieces';

  var resolver, rejector;
  var res = {};
  var promise = new Promise((resolve, reject) => {
    resolver = function() {
      delete res[CHECKSUM_CONFIRM];
      delete res[NUMBER_OF_BACKUP_PIECES];
      resolve(res);
    };
    rejector = reject;
  });

  var mergeAndRun = function(f) {
    return function(answers) {
      if (answers) {
        res = merge(res, answers);
      }
      return f();
    }
  };

  var when = function(question, f) {
    return merge(question, {
      when: f,
    });
  };


  const questionAction = {
    type: 'expand',
    name: ACTION,
    message: "What would you like to setup the wallet?",
    choices: [
      {
        key: 'c',
        name: "Create a brand new empty wallet",
        value: CREATE
      },
      {
        key: 'r',
        name: "Retrieve a wallet that was previously created",
        value: RETRIEVE
      },
    ],
  };

  const questionMask = {
    type: 'confirm',
    name: MASK,
    message: "Should secrets be masked from the screen?",
    default: false,
  };

  const questionChecksumConfirm = {
    type: 'confirm',
    name: CHECKSUM_CONFIRM,
    message: "Do you have the checksum of the seed you will use?",
  };

  const validateChecksum = function(value) {
    var valid = value.match(/^[0-9a-fA-F]+$/) != null && value.length == 64;
    return valid || "Must be a valid hexadecimal number of 64 digits";
  };

  const questionChecksum = {
    type: 'input',
    name: CHECKSUM,
    message: "Enter the checksum:",
    validate: validateChecksum,
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

  const questionSeed = function(mask) {
    return {
      type: mask ? 'password' : 'input',
      name: SEED,
      message: "Enter the seed (a memorized string):",
    }
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

  const questionBackup = function(i, j, mask) {
    return {
      type: mask ? 'password' : 'input',
      name: format(BACKUP + '[%i]', i),
      message: format("Enter the backup code piece %i of %i:", i + 1, j),
      validate: function(value) {
        var valid = value.match(/^[0-9a-fA-F]+$/) != null;
        return valid || "Must be a valid hexadecimal number";
      },
    };
  };

  var afterCreate = proxy();
  var afterRetrieve = proxy();

  inquirer.prompt([questionMask, questionAction]).then(mergeAndRun(() => {
    if (res[ACTION] == CREATE) {
      afterCreate.proceed();
    } else if (res[ACTION] == RETRIEVE) {
      afterRetrieve.proceed();
    }
  }));

  afterCreate.then(() => {
    var h = {}; h[FORMAT] = SEED;
    res = merge(res, h);
    return inquirer.prompt(questionSeed(res[MASK]));
  }).then(mergeAndRun(resolver));

  afterRetrieve.then(() => {
    var questions = [];
    if (process.env.CHECKSUM) {
      if (validateChecksum(process.env.CHECKSUM) === true) {
        var h = {}; h[CHECKSUM] = process.env.CHECKSUM;
        res = merge(res, h);
        print("Found checksum in the $CHECKSUM environment variable", res[CHECKSUM]);
      } else {
        print("Environment variable $CHECKSUM was set, but it contained an invalid value. Ignoring it.");
      }
    }
    if (!res[CHECKSUM]) {
      questions = questions.concat([
        questionChecksumConfirm,
        when(questionChecksum, (answers) => {
          return answers[CHECKSUM_CONFIRM];
        }),
      ]);
    }
    questions = questions.concat([
      questionFormat,
      when(questionSeed(res[MASK]), (answers) => {
        return answers[FORMAT] == SEED;
      }),
      when(questionNumberOfBackupPieces, (answers) => {
        return answers[FORMAT] == BACKUP;
      }),
    ]);
    return inquirer.prompt(questions);
  }).then(mergeAndRun(() => {
    var n = res[NUMBER_OF_BACKUP_PIECES];
    if (n) {
      var questions = [];
      for (var i = 0; i < n; i++) {
        questions.push(questionBackup(i, n, res[MASK]));
      };
      return inquirer.prompt(questions);
    } else {
      // Continue to resolver.
    }
  })).then(mergeAndRun(resolver));

  return promise;

};

var select = function(message, options) {
  return inquirer.prompt({
    type: 'list',
    name: 'question',
    message: message,
    choices: options.map((x, i) => { return (i + 1) + ": " + x; }),
    filter: function(val) {
      return parseInt(val.split(":")) - 1;
    }
  }).then((answers) => {
    return answers['question'];
  });
};

var create = function(seed) {
  var rand = progress("Collecting entropy to generate backup codes", () => {
    return crypto.randomBytes(seed.length);
  });
  var backup = xor(seed, rand).toString('hex') + rand.toString('hex');
  print("Backup code, which can be divided", mask(backup));
  return Promise.resolve(seed);
};

var retrieveFromSeed = function(seed, checksum) {
  if (checksum) {
    var actualChecksum = progress("Matching seed to checksum", () => {
      return calcChecksum(seed);
    });
    if (checksum != actualChecksum) {
      error("Seed does not match checksum!");
      return Promise.reject();
    }
  } else {
    print("No checksum was provided, continuing without checking against checksum.");
  }
  return Promise.resolve(seed);
};

var retrieveFromBackup = function(backup, checksum) {

  var unique = function(a) { // A stupid unique for Buffers.
    return [...new Set(a.map((x) => {
      return x.toString('hex')
    }))].map((x) => {
      return Buffer.from(x, 'hex')
    });
  };

  var n = backup.join("").length;
  if (n % 4 != 0) {
    error("The number of hexadecimal digits is not divisible by four.");
    return Promise.reject();
  }
  var permutations = permute(backup);
  var potentialSeeds = [];
  for (var i = 0; i < permutations.length; i++) {
    var permutation = permutations[i].join("");
    var potentialCipher = permutation.slice(0, n/2);
    var potentialRand = permutation.slice(n/2, n);
    potentialSeeds.push(xor(Buffer.from(potentialCipher, 'hex'), Buffer.from(potentialRand, 'hex')));
  }
  potentialSeeds = unique(potentialSeeds);
  if (checksum) {
    var seed = progress("Matching potential seeds against checksum", function() {
      for (var i = 0; i < potentialSeeds.length; i++) {
        if (calcChecksum(potentialSeeds[i]) == checksum) {
          return potentialSeeds[i];
        }
      }
    });
    if (seed) {
      return Promise.resolve(seed);
    } else {
      error("None of the potential seeds match the checksum.");
      return Promise.reject();
    }
  } else if (potentialSeeds.length == 1) {
    print("There is only one potential seed, will continue with it eventhough there is no checksum to match it against.");
    return Promise.resolve(potentialSeeds[0]);
  } else {
    print("There is more than one potential seed. A checksum would help to find the correct one automatically.");
    var printable = potentialSeeds.map((x) => mask(x.toString().replace(/[^\x20-\x7E]/g, "?")));
    return select("Select a seed (non-printable characters have been replaced):", printable).then((i) => {
      return potentialSeeds[i];
    });
  }
};

var setup = function() {

  var promise = proxy();

  inputs().then((answers) => {
    if (answers[MASK]) { mask = function() { return italic("[hidden]"); }; }
    if (answers[ACTION] == CREATE) {
      return create(Buffer.from(answers[SEED]));
    } else if (answers[ACTION] == RETRIEVE) {
      if (answers[FORMAT] == SEED) {
        return retrieveFromSeed(Buffer.from(answers[SEED]), answers[CHECKSUM]);
      } else if (answers[FORMAT] == BACKUP) {
        return retrieveFromBackup(answers[BACKUP], answers[CHECKSUM]);
      }
    }
  }).then((seed) => {
    if (seed.toString().match(/^[\x20-\x7E]*$/)) {
      print("Seed that will be used is", mask(seed));
    } else {
      print("Seed that will be used contains non-printable characters, it is roughly", mask(seed.toString().replace(/[^\x20-\x7E]/g, "?")));
    }
    var checksum = progress("Calculating checksum of seed that will be used", () => {
      return calcChecksum(seed);
    });
    print("Checksum of seed that will be used is", checksum);
    promise.proceed(seed);
  });

  return promise;

};

module.exports = setup;
