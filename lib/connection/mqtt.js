var debug = require('debug')('sanji:sdk:mqtt');
var crypto = require('crypto');
var mqtt = require('mqtt');
var Promise = require('bluebird');
var util = require('util');
var eventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var Connection;

/**
 * Creates an instance of Connection
 * @constructor
 * @this {Connection}
 * @example
 * var connection = new Connection();
 */
Connection = function Connection(options) {
  eventEmitter.call(this);

  options = options || {};
  // default connection settings
  this.name = 'MQTT Connection';
  this.port = options.port || process.env.BROKER_PORT_1883_TCP_PORT || 1883;
  this.host = options.host || process.env.BROKER_PORT_1883_TCP_ADDR || 'localhost';
  this.timeout = 180000;
  this.messageOptions = {qos: 2};
  this.tunnel = 'SanjiTempTunnel-' + crypto.randomBytes(8).toString('hex');
};

util.inherits(Connection, eventEmitter);

/**
 * Receive mqtt messages.
 * @param {string} topic mqtt topic
 * @param {string} message mqtt message
 */
Connection.prototype.onMessage = function(topic, message) {

    var parsedMessage;

    try {
      parsedMessage = JSON.parse(message);
    } catch (e) {
      debug('mqtt.onMessage parsed json failed: %s', message);
    }

    if ('object' === typeof parsedMessage) {
      message = parsedMessage;
    }

    this.emit('message', topic, message);
};

/**
 * Start listening to mqtt message.
 */
Connection.prototype.connect = function() {

  var self = this;

  this._mqtt = mqtt.connect({
    host: this.host,
    port: this.port,
    clean: true
  });

  this._mqtt.on('message', this.onMessage.bind(this));

  this._mqtt.on('disconnect', function() {
    debug('mqtt disconnected');
    self.emit('disconnect');
  });

  this._mqtt.on('connect', function() {
    debug('mqtt connected');
    self.subscribe(self.tunnel).then(function() {
      self.emit('connect');
    });
  });

};


/**
 * Subscribe a topic
 * @param {string} topic mqtt topic
 * @param {object} mqtt subscribe options
 * @return {promise} A promise object of bluebird
 */
Connection.prototype.subscribe = function(topic, options) {

  var subscribe = Promise.promisify(this._mqtt.subscribe, this._mqtt);
  options = _.merge(this.messageOptions, options);

  return subscribe(topic, options).timeout(this.timeout);
};

/**
 * Unsubscribe a topic.
 * @param {string} topic mqtt topic
 * @return {promise} A promise object of bluebird
 */
Connection.prototype.unsubscribe = function(topic) {

  var unsubscribe = Promise.promisify(this._mqtt.unsubscribe, this._mqtt);

  return unsubscribe(topic).timeout(this.timeout);
};

/**
 * Publish a mqtt message.
 * @param {string} topic mqtt topic
 * @param {string} message mqtt message
 * @return {promise} A promise object of bluebird
 */
Connection.prototype.publish = function(topic, message, options) {

  var jsonMessage = JSON.stringify(message),
      publish = Promise.promisify(this._mqtt.publish, this._mqtt);
  options = _.merge(this.messageOptions, options);

  return publish(topic, jsonMessage, options).timeout(this.timeout);
};

/**
 * Sets the tunnel of Connection
 * @return {promise} A promise object of bluebird;.
 */
Connection.prototype.setTunnel = function(newTunnel) {
  var self = this,
      tunnel = this.tunnel,
      promise,
      unsubscribePromise;

  // unsubscribe the old tunnel
  if (tunnel !== null && tunnel !== newTunnel) {
    unsubscribePromise = this.unsubscribe(tunnel)
      .tap(function() {
        debug('unsubscribe: %s', tunnel);
      })
      .timeout(5000)
      .catch(function(e) {
        debug('unsubscribe: %s failed!', tunnel);
        throw e;
      });
  }

  if (unsubscribePromise) {
    promise = unsubscribePromise.then(function() {
      return self.subscribe(newTunnel);
    });
  } else {
    promise = self.subscribe(newTunnel)
  }

  return promise
    .tap(function() {
      self.tunnel = newTunnel;
      debug('subscribe: %s', newTunnel);
    });
};

module.exports = Connection;
