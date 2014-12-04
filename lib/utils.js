'use strict';

var eventEmitter = require('events').EventEmitter,
    util = require('util');

/**
 * Creates an instance of MxUtils
 * @constructor
 */
function MxUtils() {

  this.settings = {};
  eventEmitter.call(this);
}

util.inherits(MxUtils, eventEmitter);

/**
 * Set the settings' value.
 * @return {this}
 */
MxUtils.prototype.set = function(setting, value) {
  this.settings[setting] = value;
  return this;
};

/**
 * Enable `settings`.
 * @param {string} setting Setting property
 * @return {mixin}
 */
MxUtils.prototype.enable = function(setting) {
  return this.set(setting, true);
};

/**
 * Disable `settings`.
 * @param {string} setting Setting property
 * @return {boolean}
 */
MxUtils.prototype.disable = function(setting) {
  return this.set(setting, false);
};

/**
 * Check if `settings` is enabled.
 * @param {string} setting Setting property
 * @return {boolean}
 */
MxUtils.prototype.enabled = function(setting) {
  return !!this.get(setting);
};

/**
 * Check if `settings` is disabled.
 * @param {string} setting Setting property
 * @return {boolean}
 */
MxUtils.prototype.disabled = function(setting) {
  return !this.get(setting);
};

exports = module.exports = MxUtils;
