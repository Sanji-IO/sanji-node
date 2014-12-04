var Promise = require('bluebird'),
    moment = require('moment'),
    log = require('bunyan').log;

var Session = function() {
  this.list = {};
};

Session.prototype.create = function(message, age) {
  var self = this;
  age = (age === undefined) ? 60000 : age;

  return new Promise(function(resolve, reject) {
    // var deferred = Promise.pending();
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

Session.prototype.resolve = function(message) {

  var resp = this.list[+message.id];

  if (!resp) {
    log.debug('Nothing can be resolved message id: %s', message.id);
    return null;
  }

  if (message.code >= 200 && message.code < 300) {
    resp.resolve(message);
  } else {
    resp.reject(message);
  }

  delete this.list[message.id];

  return message.id;
};

module.exports = Session;
