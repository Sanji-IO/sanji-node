var Message = require('./message'),
    Publish;

Publish = function Publish(options) {
  options = options || {};
  this.connection = options.connection;
  this.session = options.session;

  this.event = {};
  this.direct = {};
  this.createCrudFunc(this, 'NORMAL');
  this.createCrudFunc(this.event, 'EVENT');
  this.createCrudFunc(this.direct, 'DIRECT');
};

Publish.prototype.purge = function(message) {
  ['query', 'param', '_type'].forEach(function(attr) {
    if (message[attr]) {
      delete message[attr];
    }
  });

  return message;
};

Publish.prototype.createCrudFunc = function(proto, requestType) {

  var self = this;

  ['get', 'post', 'put', 'delete'].forEach(function(method) {

    proto[method] = function(resource, data, dest) {

      var payload = {
            resource: resource,
            method: method,
            data: data
          },
          message;

      // if dest is not been assigned, set topic to /controller as usual
      // else send to remote controller use `/00:0c:29:1c:e8:01/controller`
      if (!dest) {
        dest = '/controller';
      } else {
        dest = '/' + dest + '/controller';
      }

      if (requestType === 'DIRECT' || requestType === 'EVENT') {
        payload.tunnel = self.connection.tunnel;
      }

      message = new Message(payload);
      self.purge(message);

      // event no need to wait response
      if (requestType === 'EVENT') {
        return self.connection.publish('/controller', message);
      }

      return self.connection.publish('/controller', message)
        .then(function() {
          return self.session.create(message);
        });
    };
  });
};

Publish.prototype.createResponse = function(message, sign) {

  var self = this,
      responseFunc;

  responseFunc = function(resp) {
    resp = resp || {};
    resp.code = resp.code || 200;
    resp.data = resp.data || null;
    message.code = resp.code;

    if (resp.data === null && message.data) {
      delete message.data;
    } else {
      message.data = resp.data;
    }

    self.purge(message);

    if (message.sign && Array.isArray(message.sign)) {
      message.sign.push(sign);
    } else {
      message.sign = [sign];
    }

    return self.connection.publish('/controller', message);
  };

  return responseFunc;
};

module.exports = Publish;
