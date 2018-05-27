'use strict';
const crypto = require('crypto');
const sha1 = require('sha1');
const sha256 = require('sha256');
const md5 = require('md5');
const { format } = require('util');
const { italic } = require('chalk');
const { error, print, progress, proxy } = require('./util');
const prompt = require('./prompt');

var setup = function() {

  const SKIP = new Error("Skip the chain");
  const SKIPPABLE = function(err) { if(err != SKIP) { throw err; } };

  var seed, checksum, potentialSeeds;

  var unique_ = function(a) { // A stupid unique for Buffers.
    return [...new Set(a.map((x) => {
      return x.toString('hex')
    }))].map((x) => {
      return Buffer.from(x, 'hex')
    });
  };

  var printSeed_ = function() {
    if (isPrintable_(seed)) {
      print("Seed that will be used is", seed);
    } else {
      print("Seed that will be used contains non-printable characters, it is roughly", toPrintable_(seed));
    }
    var checksum = progress("Calculating checksum of seed that will be used", () => {
      return calcChecksum_(seed);
    });
    print("Checksum of seed that will be used is", checksum);
  };

  var xor_ = function(a, b) {
    var res = Buffer.alloc(a.length);
    for (var i = 0; i < a.length; i++) {
      res[i] = a[i] ^ b[i];
    }
    return res;
  };

  var calcChecksum_ = function(x, c) {
    return sha256(md5(sha1(c == 1 ? x : calcChecksum_(x, (c || 3500) - 1))));
  };

  var validateChecksum_ = function(value) {
    var valid = value.match(/^[0-9a-fA-F]+$/) != null && value.length == 64;
    return valid || "Must be a valid hexadecimal number of 64 digits";
  };

  var permute_ = function(a) {
    if (a.length == 1) { return [a]; }
    var res = [];
    for (var i = 0; i < a.length; i++) {
      var sub = permute_(a.slice(0, i).concat(a.slice(i+1, a.length)));
      for (var j = 0; j < sub.length; j++) {
        res.push([a[i]].concat(sub[j]));
      }
    }
    return res;
  };

  var isPrintable_ = function(x) {
    return !!x.toString().match(/^[\x20-\x7E]*$/);
  };

  var toPrintable_ = function(x) {
    return x.toString().replace(/[^\x20-\x7E]/g, "?");
  };

  var run = function() {

    var promise = proxy();
    var done = function() {
      printSeed_();
      promise.resolve(seed);
    };

    var selectedCreate = proxy();
    var selectedRetrieve = proxy();

    prompt.options("What would you like to setup the wallet?", {
      'create': "Create a brand new empty wallet",
      'retrieve': "Retrieve a wallet that was previously created",
    }).then((res) => {
      if (res == 'create') {
        selectedCreate.proceed();
      } else if (res == 'retrieve') {
        selectedRetrieve.proceed();
      }
    });

    selectedCreate.then(() => {
      return prompt.input("Enter the seed (a memorized string):");
    }).then((res) => {
      seed = Buffer.from(res);
      var rand = progress("Collecting entropy to generate backup codes", () => {
        return crypto.randomBytes(seed.length);
      });
      var backup = xor_(seed, rand).toString('hex') + rand.toString('hex');
      print("Backup code, which can be divided", backup);
      done();
    });

    var askForChecksum = proxy();
    var askForFormat = proxy();

    selectedRetrieve.then(() => {
      if (process.env.CHECKSUM) {
        if (validateChecksum_(process.env.CHECKSUM) === true) {
          checksum = process.env.CHECKSUM;
          print("Found checksum in the $CHECKSUM environment variable", checksum);
        } else {
          print("Environment variable $CHECKSUM was set, but it contained an invalid value. Ignoring it.");
        }
      }
      if (checksum) {
        askForFormat.proceed();
      } else {
        askForChecksum.proceed();
      }
    });

    askForChecksum.then(() => {
      return prompt.confirm("Do you have the checksum of the seed you will use?");
    }).then((res) => {
      if (res) {
        return prompt.input("Enter the checksum:", validateChecksum_);
      } else {
        askForFormat.proceed();
        throw SKIP;
      }
    }).then((res) => {
      checksum = res;
      askForFormat.proceed();
    }).catch(SKIPPABLE);

    var selectedSeed = proxy();
    var selectedBackup = proxy();

    askForFormat.then(() => {
      return prompt.options("What is the source of secrets that you have access to?", {
        'seed': "A seed (a memorized string)",
        'backup': "A set of backup code pieces in hexadecimal format",
      });
    }).then((res) => {
      if (res == 'seed') {
        selectedSeed.proceed();
      } else if (res == 'backup') {
        selectedBackup.proceed();
      }
    });

    selectedSeed.then(() => {
      return prompt.input("Enter the seed (a memorized string):");
    }).then((res) => {
      seed = Buffer.from(res);
      if (checksum) {
        var calculatedChecksum = progress("Matching seed to checksum", () => {
          return calcChecksum_(seed);
        });
        if (calculatedChecksum != checksum) {
          error("Seed does not match checksum!");
          promise.reject();
          return;
        }
      } else {
        print("No checksum was provided, continuing without checking against checksum.");
      }
      done();
    });

    selectedBackup.then(() => {
      return prompt.input("How many backup code pieces do you have?", function(value) {
        var number = parseInt(value);
        var valid = !isNaN(number) && number > 0;
        return valid || "Must be a positive integer";
      }, Number);
    }).then((res) => {
      var messages = [];
      for (var i = 0; i < res; i++) {
        messages.push(format("Enter the backup code piece %i of %i:", i + 1, res));
      }
      return prompt.input(messages, function(value) {
        var valid = value.match(/^[0-9a-fA-F]+$/) != null;
        return valid || "Must be a valid hexadecimal number";
      });
    }).then((res) => {
      var n = res.join("").length;
      if (n % 4 != 0) {
        error("The number of hexadecimal digits is not divisible by four.");
        promise.reject();
        throw SKIP;
      }
      potentialSeeds = [];
      permute_(res).forEach((permutation) => {
        permutation = permutation.join("");
        var potentialCipher = permutation.slice(0, n/2);
        var potentialRand = permutation.slice(n/2, n);
        var potentialSeed = xor_(Buffer.from(potentialCipher, 'hex'), Buffer.from(potentialRand, 'hex'));
        potentialSeeds.push(potentialSeed);
      });
      potentialSeeds = unique_(potentialSeeds);
      if (checksum) {
        seed = progress("Matching potential seeds against checksum", function() {
          for (var i = 0; i < potentialSeeds.length; i++) {
            if (calcChecksum_(potentialSeeds[i]) == checksum) {
              return potentialSeeds[i];
            }
          }
        });
        if (seed) {
          done();
          throw SKIP;
        } else {
          error("None of the potential seeds match the checksum.");
          promise.reject();
          throw SKIP;
        }
      } else if (potentialSeeds.length == 1) {
        print("There is only one potential seed, will continue with it eventhough there is no checksum to match it against.");
        seed = potentialSeeds[0];
        done();
        throw SKIP;
      } else {
        print("There is more than one potential seed. A checksum would help to find the correct one automatically.");
        var printable = potentialSeeds.map((x) => toPrintable_(x));
        return prompt.select("Select a seed (non-printable characters have been replaced):", printable)
      }
    }).then((res) => {
      seed = potentialSeeds[res];
      done();
    }).catch(SKIPPABLE);

    return promise;

  };

  return run();

};

module.exports = setup;
