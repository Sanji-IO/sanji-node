'use strict';

var log = require('bunyan').log.child({module: 'Sanji'}),
    Connection = require('./connection/mqtt'),
    Message = require('./message'),
    Router = require('./router').Router,
    Session = require('./session'),
    Publish = require('./publish'),
    Bundle = require('./bundle'),
    Promise = require('bluebird'),
    _ = require('lodash');

// add retry method
// ref: https://gist.github.com/marshall007/325a805983414f2c8e72
Promise.retry = function(func, options) {

  return new Promise(function (resolve, reject) {
    options = options || {};
    options.retry = options.retry || true;
    options.interval = options.interval || 2000;

    var execFunc = function(attempt, err) {

      if (options.retry !== true && attempt > options.retry) {
        log.error('error');
        return reject(err);
      }

      var promise;
      if (attempt !== 0) {
        promise = Promise.delay(options.interval).then(func);
      } else {
        promise = func();
      }

      promise
      .then(function(data) {
        resolve(data);
      })
      .catch(function(err) {
        log.warn(err);
        execFunc(attempt + 1, err);
      });
    };

    process.nextTick(function() {
      execFunc(0);
    });
  });
};

/**
 * Creates an instance of Sanji
 * @constructor
 * @this {Sanji}
 * @param {object} options common settings go here.
 * @example
 * var sanji = new Sanji();
 */
function Sanji(options) {

  options = options || {};

  var self = this;
  this.router = new Router();
  this.registered = false;
  this.reregister = true;
  this.bundlePath = options.bundlePath || './';
  this.bundle = options.bundle || new Bundle(this.bundlePath);
  this.connection = options.connection || new Connection(options.connectionOptions);
  this.session = options.session || new Session();
  this.publish = options.publish || new Publish({
    session: this.session,
    connection: this.connection});

  ['get', 'post', 'put', 'delete'].forEach(function(method) {
    Sanji.prototype[method] = self.router[method];
  });
}

/**
 * Deregister a name from MxController
 * @return {promise} A promise object of q.
 */
Sanji.prototype.deregister = function(retry, timeout, interval) {
  log.debug('deregister');
  var self = this;
  var req = function() {
    return self.publish.direct.delete(
      '/controller/registration/' + self.bundle.profile.name);
  };

  return Promise.retry(req, {
    retry: retry, timeout: timeout, interval: interval});
};

/**
 * To register Sanji's name from MxController
 * @return {promise} Promise object of q
 */
Sanji.prototype.register = function(retry, timeout, interval) {
  log.debug('register');
  var self = this;

  var req = function() {
    return self.publish.direct.post(
      '/controller/registration', self.getRegistrationInfo());
  };

  return self
    .deregister(true, timeout, interval)
    .then(function() {
      return Promise.retry(req, {
        retry: retry, timeout: timeout, interval: interval});
    })
    .then(function(resp) {
      return self.connection.setTunnel(resp.data.tunnel);
    })
    .catch(function(e) {
      log.error(e);
    });
};


/**
 * Get the registration info from Sanji's settings
 * @return {object} Registration info
 */
Sanji.prototype.getRegistrationInfo = function() {

  var profile = _.cloneDeep(this.bundle.profile);
  var resources = [];

  profile.resources.forEach(function(endpoint) {
    resources.push(endpoint.resource.replace(/:(\w+)/, '+'));
  });

  profile.resources = resources;

  return profile;
};


/**
 * Start to mqtt instance
 */
Sanji.prototype.start = function() {
  log.debug('start connecting to broker...');
  this.connection.connect();
  this.connection.on('connect', this.onConnect.bind(this));
  this.connection.on('message', this.onMessage.bind(this));
};

/**
 * onConnect
 */
Sanji.prototype.onConnect = function() {
  var self = this;
  self.registered = false;
  log.debug('connected');

  if (!self.reregister) {
    return;
  }

  log.debug('start registering bundle...');
  Promise.retry(self.register.bind(self), {
    retry: true, timeout: 1000, interval: 3000})
  .then(function() {
    log.debug('registered');
    self.registered = true;
    if (typeof(self.run) === 'function') {
      log.debug('triggering run()');
      self.run();
    }
  })
  .catch(function(e) {
    log.error('register failed');
    log.debug(e);
  });
};

/**
 * To receive messages by mqtt's on message event
 * and dispatch to each stored callback
 * @param {string} topic Mqtt topic
 * @param {string} payload Mqtt payload
 */
Sanji.prototype.onMessage = function(topic, payload) {

  var message;

  try {
    message = new Message(payload, false);
    log.trace('onMessage', message);
  } catch (e) {
    console.log(e);
    return;
  }

  if (message._type === 'RESPONSE') {
    this.session.resolve(message);
  } else if (message._type === 'REQUEST') {
    this.dispatchRequest(message);
  } else if (message._type === 'EVENT') {

  }
};

Sanji.prototype.dispatchRequest = function(message) {

  var resp, results;
  var self = this;

  var handleCallbacks = function(req, res, callbacks) {

    var index, next, callback;

    if (! callbacks) {
      return true;
    }

    index = 0;
    next = function() {
      if (index >= callbacks.length) {
        return;
      }
      var cb = callbacks[++index];
      if ('function' === typeof cb) {
        cb(req, res, next);
      }
    };

    callback = callbacks[0];
    if ('function' === typeof callback) {
      callback(req, res, next);
      return true;
    }

    return false;
  };

  results = self.router.dispatch(message);
  resp = self.publish.createResponse(message, self.bundle.name);

  if (results.length === 0) {
    resp({
      code: 404,
      data: 'Route Not Found'
    });
    return;
  }

  for (var rIndex = 0; rIndex < results.length; rIndex++) {
    var result = results[rIndex];
    var isExit = handleCallbacks(result.message, resp, result.callbacks);

    if (isExit) {
      break;
    }
  }
};

exports = module.exports = Sanji;
