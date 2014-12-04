var Qs = require('qs'),
    XRegExp = require('xregexp'),
    namePattern = '(?<$1>\\w+)',
    queryPattern = '(\\?+(?<querystring>.*))?$';

XRegExp.install('natives');

var parseQuerystring = function(qstring) {
  return Qs.parse(qstring);
};

var parseParams = function(match) {
  var params = {};

  for (var key in match) {
    //  omit numbers, index and input
    if (!isNaN(parseInt(key, 10))) {
      continue;
    }

    if (key === 'index' || key === 'input' || key === 'querystring') {
      continue;
    }

    params[key] = match[key];
  }

  return params;
};

var trimResource = function(resource) {
  var arr = [];
  resource.split('/').forEach(function(segment) {
    var str = segment.trim(segment);
    if (str.length > 0) {
      arr.push(str);
    }
  });

  return arr.join('/');
};

var Route = function(resource) {
  var self = this;
  this.handlers = {};
  this.resource = trimResource(resource);
  this.resourceRegex = XRegExp(
    '^' + this.resource.replace(/:(\w+)/g, namePattern) + queryPattern
  );

  ['get', 'post', 'put', 'delete', 'all'].forEach(function(method) {
    self[method] = function(callback, schema) {
      var stack = self.handlers[method] = self.handlers[method] || [];
      stack.push({
        callback: callback,
        schema: schema
      });

      return self;
    };
  });
};

Route.prototype.dispatch = function(message) {
  return this.handlers[message.method] || [];
};

var Router = function() {
  var self = this;
  this.routes = {};

  ['get', 'post', 'put', 'delete'].forEach(function(method) {
    self[method] = function(resource, callback, schema) {
      var route = self.routes[resource] || new Route(resource);
      self.routes[resource] = route[method](callback, schema);

      return self;
    };
  });
};

Router.prototype.dispatch = function(message) {
  var self = this;
  var results = [];
  for (var resource in this.routes) {
    var route = self.routes[resource];
    var __message = message.match(route);

    if (!__message) {
      return;
    }

    var routeResults = route.dispatch(__message);
    if (routeResults.length === 0) {
      return;
    }

    results.push({
      callbacks: routeResults,
      message: __message
    });
  }

  return results;
};

module.exports = {
  Router: Router,
  Route: Route,
  parseQuerystring: parseQuerystring,
  parseParams: parseParams,
  trimResource: trimResource
};
