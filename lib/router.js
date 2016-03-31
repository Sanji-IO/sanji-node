var Qs = require('qs'),
    XRegExp = require('xregexp'),
    namePattern = '(?<$1>[\\w\\-_]+)',
    queryPattern = '(\\?+(?<querystring>.*))?$',
    parseQuerystring,
    parseParams,
    trimResource,
    Route,
    Router;

parseQuerystring = function parseQuerystring(qstring) {
  return Qs.parse(qstring);
};

parseParams = function parseParams(match) {
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

trimResource = function trimResource(resource) {
  var arr = [];
  resource.split('/').forEach(function(segment) {
    var str = segment.trim(segment);
    if (str.length) {
      arr.push(str);
    }
  });

  return arr.join('/');
};

Route = function Route(resource) {
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

Route.prototype.dispatch = function dispatch(message) {
  return this.handlers[message.method] || [];
};

Router = function Router() {
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

Router.prototype.dispatch = function dispatch(message) {

  var self = this,
      results = [];

  for (var resource in this.routes) {
    var route = self.routes[resource],
        __message = message.match(route);

    if (!__message) {
      return;
    }

    var routeResults = route.dispatch(__message);
    if (!routeResults.length) {
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
