var debug = require('debug')('sanji:sdk:session');
var Promise = require('bluebird');
var moment = require('moment');
var Session;

Session = function Session() {
  this.list = {};
};

Session.prototype.create = function create(message, age) {

  var self = this;
  age = (age === undefined) ? 60000 : age;

  return new Promise(function(resolve, reject) {

    var session = {
      status: 'CREATED',
      message: message,
      age: age,
      createdAt: moment().toISOString(),
      resolve: resolve,
      reject: reject
    };

    if (self.list[message.id]) {
      throw new Error('Message id is exist!');
    }

    self.list[message.id] = session;
  })
  .timeout(age);
};

Session.prototype.resolve = function resolve(message) {

  var resp = this.list[Number(message.id)];

  if (!resp) {
    debug('Nothing can be resolved message id: %s', message.id);
    return null;
  }

  resp.resolve(message);

  delete this.list[message.id];

  return message.id;
};

module.exports = Session;
