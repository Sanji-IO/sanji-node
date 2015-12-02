var debug = require('debug')('sanji:sdk:core');
var Connection = require('./connection/mqtt');
var Message = require('./message');
var Router = require('./router').Router;
var Session = require('./session');
var Publish = require('./publish');
var Bundle = require('./bundle');
var Promise = require('bluebird');
var Sanji;

// add retry method
// ref: https://gist.github.com/marshall007/325a805983414f2c8e72
Promise.retry = function retry(func, options) {

  return new Promise(function (resolve, reject) {
    options = options || {};
    options.retry = options.retry || true;
    options.interval = options.interval || 2000;

    var execFunc = function execFunc(attempt, err) {

      if (options.retry !== true && attempt > options.retry) {
        debug(err);
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
          debug(err);
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
Sanji = function Sanji(options) {

  var self = this;

  options = options || {};
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
};

/**
 * Deregister a name from MxController
 * @return {promise} A promise object of q.
 */
Sanji.prototype.deregister = function deregister(retry, timeout, interval) {
  var self = this,
      req;

  req = function req() {
    return self.publish.direct.delete(
      '/controller/registration/' + self.bundle.profile.name)
      .then(function(resp) {
        if (resp.code !== 200) {
          return Promise.reject(new Error("Deregister failed."));
        }

        return Promise.resolve(resp);
      });
  };

  return Promise.retry(req, {
    retry: retry, timeout: timeout, interval: interval});
};

/**
 * To register Sanji's name from MxController
 * @return {promise} Promise object of q
 */
Sanji.prototype.register = function register(retry, timeout, interval) {
  var self = this,
      req;

  req = function req() {
    return self.deregister(true, timeout, interval)
      .then(function() {
        return self.publish.direct.post(
          '/controller/registration', self.getRegistrationInfo())
      })
      .then(function(resp) {
        if (resp.code !== 200) {
          return Promise.reject(new Error("Register failed."));
        }

        return Promise.resolve(resp);
      });
  };

  return Promise.retry(
      req, {retry: retry, timeout: timeout, interval: interval})
    .then(function(resp) {
      return self.connection.setTunnel(resp.data.tunnel);
    })
    .catch(function(e) {
      debug(e);
    });
};


/**
 * Get the registration info from Sanji's settings
 * @return {object} Registration info
 */
Sanji.prototype.getRegistrationInfo = function getRegistrationInfo() {

  var profile = JSON.parse(JSON.stringify(this.bundle.profile)),
      resources = [];

  profile.resources.forEach(function(endpoint) {
    resources.push(endpoint.resource.replace(/:(\w+)/, '+'));
  });

  profile.resources = resources;

  return profile;
};


/**
 * Start to mqtt instance
 */
Sanji.prototype.start = function start() {
  debug('start connecting to broker...');
  this.connection.connect();
  this.connection.on('connect', this.onConnect.bind(this));
  this.connection.on('message', this.onMessage.bind(this));
};

/**
 * onConnect
 */
Sanji.prototype.onConnect = function onConnect() {

  var self = this;
  self.registered = false;
  debug('connected');

  if (!self.reregister) {
    return;
  }

  debug('start registering bundle...');
  Promise.retry(self.register.bind(self), {
    retry: true, timeout: 1000, interval: 3000})
  .then(function() {

    debug('registered');
    self.registered = true;

    if (typeof(self.run) === 'function') {
      debug('triggering run()');
      self.run();
    }
  })
  .catch(function(e) {
    debug('register failed', e);
  });
};

/**
 * To receive messages by mqtt's on message event
 * and dispatch to each stored callback
 * @param {string} topic Mqtt topic
 * @param {string} payload Mqtt payload
 */
Sanji.prototype.onMessage = function onMessage(topic, payload) {

  var message;

  try {
    message = new Message(payload, false);
    debug('onMessage', message);
  } catch (e) {
    debug(e);
    return;
  }

  if (message._type === 'RESPONSE') {
    this.session.resolve(message);
  } else if (message._type === 'REQUEST') {
    this.dispatchRequest(message);
  } else if (message._type === 'EVENT') {
    // TODO: EVENT Message
  }
  // TODO: Log others?
};

Sanji.prototype.dispatchRequest = function dispatchRequest(message) {

  var self = this,
      resp, results, handleCallbacks;

  handleCallbacks = function handleCallbacks(req, res, callbacks) {

    var index, next, callback;

    if (! callbacks) {
      return true;
    }

    index = 0;
    next = function next() {

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

  if (!results.length) {
    resp({
      code: 404,
      data: 'Route Not Found'
    });
    return;
  }

  for (var rIndex = 0; rIndex < results.length; rIndex++) {
    var result = results[rIndex],
        isExit = handleCallbacks(result.message, resp, result.callbacks);

    if (isExit) {
      break;
    }
  }
};

exports = module.exports = Sanji;
