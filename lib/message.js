var trimResource = require('./router').trimResource,
    parseParams = require('./router').parseParams,
    parseQuerystring = require('./router').parseQuerystring;

var MessageType = {
  RESPONSE: {
    must: ['id', 'code', 'method', 'resource', 'sign'],
    prohibit: ['tunnel']
  },
  REQUEST: {
    must: ['id', 'method', 'resource'],
    prohibit: ['code', 'sign', 'tunnel']
  },
  DIRECT: {
    must: ['id', 'method', 'resource', 'tunnel'],
    prohibit: ['code', 'sign']
  },
  EVENT: {
    must: ['code', 'method', 'resource'],
    prohibit: ['id', 'sign', 'tunnel']
  },
  HOOK: {
    must: ['id', 'method', 'resource', 'sign'],
    prohibit: ['code', 'tunnel']
  }
};


var id = 0;
function getId() {
  return (function() {
    id = (id === 4294967295) ? 0 : id + 1;
    return id;
  })();
}

function isType(mtype, data) {
  for (var mustIdx in MessageType[mtype].must) {
    var must = MessageType[mtype].must[mustIdx];
    if (!data[must]) {
      return false;
    }
  }

  for (var prohibitIdx in MessageType[mtype].prohibit) {
    var prohibit = MessageType[mtype].prohibit[prohibitIdx];
    if (data[prohibit]) {
      return false;
    }
  }

  return true;
}

var getType = function(data) {
  for (var mtype in MessageType) {
    if(isType(mtype, data)) {
      return mtype;
    }
  }

  return 'UNKNOWN';
};

var Message = function(data, generatedId) {
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (e) {
      throw new Error('Invaild json string');
    }
  }

  for (var prop in data) {
    this[prop] = data[prop];
  }

  if (generatedId !== false) {
    this.id = getId();
  }

  this._type = getType(this);
};

Message.prototype.match = function(route) {
  var m = JSON.parse(JSON.stringify(this));  //  deep copy message obj
  delete m._type;

  var _resource = trimResource(this.resource);
  var match = route.resourceRegex.exec(_resource);

  if (!match) {
    return match;
  }

  m.method = m.method.toLowerCase();
  m.param = parseParams(match);
  m.query = {};

  // generate query
  if (match.querystring) {
    m.query = parseQuerystring(match.querystring);
  }

  return m;
};

Message.prototype.getType = getType;
Message.prototype.isType = isType;

module.exports = Message;
