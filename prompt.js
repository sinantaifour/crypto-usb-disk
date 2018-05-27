'use strict';
const { prompt } = require('inquirer');

module.exports = new (function() {

  const QUESTION = 'question';

  var returnAnswer_ = function(answers) {
    return answers[QUESTION];
  }

  var confirm = function(message, def) {
    return prompt({
      type: 'confirm',
      name: QUESTION,
      message: message,
      default: def === undefined ? true : def,
    }).then(returnAnswer_);
  };

  var inputQuestion_ = function(message, validate, filter, index) {
    return {
      type: 'input',
      name: QUESTION + (index !== undefined ? `[${index}]` : ""),
      message: message,
      validate: validate,
      filter: filter,
    }
  };

  var input = function(message, validate, filter) {
    if (message instanceof Array) {
      var questions = message.map((m, i) => {
        return inputQuestion_(m, validate, filter, i);
      });
    } else {
      var questions = inputQuestion_(message, validate, filter);
    }
    return prompt(questions).then(returnAnswer_);
  };

  var options = function(message, choices) {
    return prompt({
      type: 'expand',
      name: QUESTION,
      message: "What would you like to setup the wallet?",
      choices: Object.entries(choices).map((kv) => {
        return {
          key: kv[0][0],
          name: kv[1],
          value: kv[0],
        }
      }),
    }).then(returnAnswer_);
  };

  var select = function(message, choices) {
    return prompt({
      type: 'list',
      name: QUESTION,
      message: message,
      choices: choices.map((x, i) => { return (i + 1) + ": " + x; }),
      filter: function(val) {
        return parseInt(val.split(":")) - 1;
      }
    }).then(returnAnswer_);
  };

  this.confirm = confirm;
  this.input = input;
  this.options = options;
  this.select = select;

})();
