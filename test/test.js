var path = require('path');
var chai = require('chai');
var should = chai.should();
var expect = chai.expect;
var sinon = require('sinon');
var Sanji = require('../index');
var Bundle = require('../lib/bundle');
var Publish = require('../lib/publish');
var Session = require('../lib/session');
var Message = require('../lib/message');
var Router = require('../lib/router').Router;
var Route = require('../lib/router').Route;
var trimResource = require('../lib/router').trimResource;
var parseQuerystring = require('../lib/router').parseQuerystring;
var Promise = require('bluebird');

describe('Bundle', function() {
  var b = new Bundle(path.join(__dirname, 'mock'));

  describe('create a Bundle instance', function() {
    it('should return a Bundle instance', function() {
      b.should.be.an.instanceOf(Bundle);
    });

    it('should be able to load bunlde.json', function() {
      var profile = b.profile;
      profile.should.hasOwnProperty('name');
      profile.should.hasOwnProperty('version');
      profile.should.hasOwnProperty('author');
      profile.should.hasOwnProperty('email');
      profile.should.hasOwnProperty('description');
      profile.should.hasOwnProperty('license');
      profile.should.hasOwnProperty('main');
      profile.should.hasOwnProperty('argument');
      profile.should.hasOwnProperty('priority');
      profile.should.hasOwnProperty('hook');
      profile.should.hasOwnProperty('dependencies');
      profile.should.hasOwnProperty('repository');
      profile.should.hasOwnProperty('resources');
    });
  });
});

describe('Sanji', function() {

  var b, s, p, retry, mockP;

  beforeEach(function() {
    p = new Publish();
    p.direct = {
      post: mockP,
      delete: mockP,
      get: mockP,
      put: mockP
    };
    b = new Bundle(path.join(__dirname, 'mock'));
    s = new Sanji({
      bundle: b,
      publish: p
    });

    retry = 5;
    mockP = function mockP() {
      return new Promise(function (resolve, reject) {
        resolve({
          code: 200,
          data: {
            test: 'ok'
          }
        });
        // if (retry-- === 0) {
        //   retry = 5;
        //   return resolve();
        // }
        // return reject('fail');
      });
    };


  });

  describe('create a Sanji instance', function() {
    it('should return a Sanji instance', function() {
      s.should.be.an.instanceOf(Sanji);
    });
  });

  describe('deregister to controller', function() {
    it('should deregister to controller', function() {
      return s.deregister(retry, 3, 10)
        .catch(function(e) {
          throw e;
        });
    });
  });

  describe('register to controller', function() {
    it('should subscribe to tunnel by controller assigned', function() {
      s.connection.setTunnel = function() {
        return new Promise(function (resolve) {
          return resolve('success');
        });
      };

      return s.register(retry, 0, 0)
        .catch(function(e) {
          throw e;
        });
    });
  });

  describe('get registration information', function() {
    it('should return registration message', function() {
      var info = s.getRegistrationInfo();
      info.resources.forEach(function(endpoint) {
        endpoint.indexOf(':').should.be.equal(-1);
      });
    });
  });

  describe('dispatch request', function() {
    var spies, spyFunc, spyCount = 5;
    var msg = new Message({
      id: 1,
      method: 'get',
      resource: '/test'
    });

    beforeEach(function() {
      spies = [];
      spyFunc = function(message, response, next) {
        next();
      };

      for (var i = 0; i < spyCount; i++) {
        spies.push(sinon.spy(spyFunc));
      }

      s.router.dispatch = function() {
        return [{
          callbacks: spies,
          message: new Message({})
        }];
      };
    });

    it('should be executed in sequence', function() {
      s.dispatchRequest(msg);

      // check they are as expect execution sequence
      for (var i = spyCount - 1; i > 0; i--) {
        spies[i].calledAfter(spies[i - 1]).should.be.true;
      }
    });

    it('should be interrupt if next() not be called', function() {
      spies[0] = sinon.spy();
      s.dispatchRequest(msg);
      // check they are as expect execution sequence
      spies[0].calledOnce.should.be.true;
      for (var i = 1; i < spyCount; i++) {
        spies[i].called.should.be.false;
      }
    });
  });
});

describe('Publish', function() {
  var publish;

  beforeEach(function() {

    publish = new Publish({
      connection: {
        tunnel: 'mock_tunnel'
      },
      session: new Session()
    });

    publish.session.create = function() {
      return new Promise(function (resolve) {
        return resolve();
      });
    };
  });

  describe('create a Publish instance', function() {
    it('should create CRUD methods', function() {
      ['get', 'post', 'put', 'delete'].forEach(function(method) {
        publish[method].should.be.a.function;
        publish.direct[method].should.be.a.function;
        publish.event[method].should.be.a.function;
      });
    });
  });

  describe('should be able to send requests', function() {
    describe('Normal', function() {
      ['get', 'post', 'put', 'delete'].forEach(function(method) {
        it('should be able to send [' + method + '] request', function() {
          publish.connection = {
            publish: function(topic, message) {
              topic.should.be.equal('/controller');
              return new Promise(function (resolve) {
                return resolve();
              });
            }
          };

          return publish[method]('/test/resource', {});
        });
      });
    });

    describe('Direct', function() {
      ['get', 'post', 'put', 'delete'].forEach(function(method) {
        it('should be able to send [' + method + '] request', function() {
          publish.connection = {
            tunnel: 'test_tunnel',
            publish: function(topic, message) {

              // check message payload
              topic.should.be.equal('/controller');
              message.id.should.be.integer;
              message.tunnel.should.be.equal(publish.connection.tunnel);
              message.resource.should.be.equal('/test/resource');
              message.method.should.be.equal(method);
              message.data.should.be.eql({test: 'test'});

              return new Promise(function (resolve) {
                return resolve();
              });
            }
          };

          return publish.direct[method]('/test/resource', {test: 'test'});
        });
      });
    });

    describe('Event', function() {
      ['get', 'post', 'put', 'delete'].forEach(function(method) {
        it('should be able to send [' + method + '] request', function() {
          publish.connection = {
            tunnel: 'test_tunnel',
            publish: function(topic, message) {

              // check message payload
              topic.should.be.equal('/controller');
              message.id.should.be.integer;
              message.tunnel.should.be.equal(publish.connection.tunnel);
              message.resource.should.be.equal('/test/resource');
              message.method.should.be.equal(method);
              message.data.should.be.eql({test: 'test'});

              return new Promise(function (resolve) {
                return resolve();
              });
            }
          };

          return publish.event[method]('/test/resource', {test: 'test'});
        });
      });
    });
  });

  describe('create response function', function() {
    var msg, respMsg, p;

    beforeEach(function() {
      msg = new Message({
        id: 1,
        method: 'get',
        resource: '/test',
        data: {}
      }, false);
      p = sinon.spy();
      publish.connection.publish = p;
      respMsg = {
        id: 1,
        code: 200,
        method: 'get',
        resource: '/test',
        sign: ['test_name']
      };
    });

    it('should be inherit from message', function() {
      var resp = publish.createResponse(msg, 'test_name');
      respMsg.data = {
        key: 'value'
      };
      resp({
        data: {key: 'value'}
      });
      p.calledOnce.should.be.true;
      p.args[0][0].should.be.equal('/controller');
      p.args[0][1].id.should.be.equal(respMsg.id);
      p.args[0][1].code.should.be.equal(respMsg.code);
      p.args[0][1].method.should.be.equal(respMsg.method);
      p.args[0][1].resource.should.be.equal(respMsg.resource);
      p.args[0][1].sign.should.be.deep.equal(respMsg.sign);
    });

    it('should not have data if null is assigned', function() {
      var resp = publish.createResponse(msg, 'test_name');
      resp({
        data: null
      });
      p.calledOnce.should.be.true;
      p.args[0][0].should.be.equal('/controller');
      p.args[0][1].id.should.be.equal(respMsg.id);
      p.args[0][1].code.should.be.equal(respMsg.code);
      p.args[0][1].method.should.be.equal(respMsg.method);
      p.args[0][1].resource.should.be.equal(respMsg.resource);
      p.args[0][1].sign.should.be.deep.equal(respMsg.sign);
    });

    it('should push sign into exist sign array', function() {
      msg.sign = ['before_sign'];
      var resp = publish.createResponse(msg, 'test_name');
      resp();
      p.calledOnce.should.be.true;
      p.args[0][0].should.be.equal('/controller');
      respMsg.sign = ['before_sign', 'test_name'];
      p.args[0][1].id.should.be.equal(respMsg.id);
      p.args[0][1].code.should.be.equal(respMsg.code);
      p.args[0][1].method.should.be.equal(respMsg.method);
      p.args[0][1].resource.should.be.equal(respMsg.resource);
      p.args[0][1].sign.should.be.deep.equal(respMsg.sign);
    });
  });
});

describe('Session', function() {

  var session;
  beforeEach(function() {
    session = new Session();
  });

  afterEach(function() {
    session = null;
  });

  describe('create a Session instance', function() {
    it('should return a Sanji Session', function() {
      session.should.be.instanceOf(Session);
    });
  });

  describe('create a new session', function() {
    var m, s;

    beforeEach(function() {
      session = new Session();
      m = new Message({
        id: 1,
        resource: '/test/message',
        method: 'get'
      }, false);
    });

    afterEach(function() {
      m = null;
      s = null;
    });

    it('should be able to create', function() {
      var age = 200000,
          promise;

      promise = session.create(m, age);
      promise.should.be.instanceOf(Promise);

      s = session.list[1];
      s.status.should.be.equal('CREATED');
      s.message.should.be.eql(m);
      s.age.should.be.equal(age);
    });

    it('should not be able to create with exist id', function() {
      m.id = 1;
      session.create(m);
      session.create(m).catch(function(e) {
        e.message.should.be.eql('Message id is exist!');
      });
    });

    it('should be able to be resolved', function(done) {
      s = session.create(m);
      var respMsg = new Message({id: m.id, code: 200, data: 'test'}, false);

      s.then(function(msg) {
        msg.should.be.eql(respMsg);
        done();
      });

      session.resolve(respMsg);
    });

    var TimeoutError = Promise.TimeoutError;

    it('should be able to be timeout', function(done) {
      s = session.create(m, 0.5);
      s.then(function() {
          done(new Error('Not fire timeout.'));
        })
        .catch(function(e) {
          e.should.be.instanceOf(TimeoutError);
          done();
        });
    });
  });

  describe('resolve a session', function() {
    it('should be resolve nothing if list is empty', function() {
      var r = session.resolve(new Message());
      expect(r).be.equal(null);
    });

    it('should just delete session if it\'s already been resolved', function() {
      var spy = sinon.spy();
      session.list[0] = {
        deferred: {
          promise: {
            isFulfilled: function() {return true;},
            fulfill: spy
          }
        }
      };

      session.resolve(new Message({
        id: 1
      }, false));

      spy.calledOnce.should.be.equal(false);
    });
  });
});

describe('Message', function() {

  describe('create a Message instance', function() {

    it('should return a Message instance', function() {
      var m = new Message('{"id": 1, "resource": "/resource/test",' +
                          '"method": "get", "data": {} }');
      m.should.be.an.instanceOf(Message);
    });

    it('should detect right type', function() {
      // RESPONSE
      var resM = new Message({
        id: 1,
        code: 200,
        method: 'post',
        sign: ['test'],
        resource: '/test/resource',
        data: {}
      });
      resM._type.should.be.equal('RESPONSE');

      // REQUEST
      var reqM = new Message({
        id: 1,
        method: 'post',
        resource: '/test/resource',
        data: {}
      });
      reqM._type.should.be.equal('REQUEST');

      // DIRECT
      var dirM = new Message({
        id: 1,
        method: 'post',
        resource: '/test/resource',
        tunnel: 'asdf',
        data: {}
      });
      dirM._type.should.be.equal('DIRECT');

      // EVENT
      var eventM = new Message({
        code: 200,
        method: 'post',
        resource: '/test/resource',
        data: {}
      }, false);
      eventM._type.should.be.equal('EVENT');

      // HOOK
      var hookM = new Message({
        id: 1,
        method: 'post',
        resource: '/test/resource',
        sign: ['test'],
        data: {}
      });
      hookM._type.should.be.equal('HOOK');
    });

    it('should generate id', function() {
      var gM = new Message({}, true);
      gM.should.hasOwnProperty('id');
      gM.id.should.be.a.Number;
    });

    it('should throw an error (non-vaild) json string', function() {
      (function () {
        new Message('You can\'t reslove');
      }).should.throw('Invaild json string');
    });

  });

  describe('Match with pass route', function() {
    var reqM = new Message({
      id: 1,
      method: 'post',
      resource: '/test/resource/123?abc=1&def=2',
      data: {}
    }, false);

    it('should be return match result', function() {
      var m = reqM.match(new Route('/test/resource/:id'));
      m.query.should.be.eql({abc: '1', def: '2'});
      m.param.should.be.eql({id: '123'});
    });

    it('should be return match non results', function() {
      var m = reqM.match(new Route('/noroute/resource/:id'));
      expect(m).be.null;
    });
  });
});

describe('trimResource', function() {
  it('should trim / in resource', function() {
    trimResource('/').should.be.equal('');
    trimResource('test/url/abcd').should.be.equal('test/url/abcd');
    trimResource('   ///test/url/abcd/ ').should.be.equal('test/url/abcd');
  });
});

describe('parseQuerystring', function() {
  var r = new Route('  /test/hello/:id/world/:haha   ');
  it('should build query params from querystring', function() {
    var matched = r.resourceRegex.exec('test/hello/5566/world/1234' +
      '?abc=123&&def=456');
    var result = parseQuerystring(matched.querystring);
    result.abc.should.be.equal('123');
    result.def.should.be.equal('456');
  });
});

describe('Route', function() {
  describe('create a Route instance', function() {
    var r = new Route('  /test/hello/:id/world/:haha   ');

    it('should be an instance of Route', function() {
      r.should.be.an.instanceOf(Route);
    });

    it('should trim resource (spaces)', function() {
      r.resource.should.be.equal('test/hello/:id/world/:haha');
    });

    it('should have correct resourceRegex', function() {
      //  case 1: param without querystring
      var matched = r.resourceRegex.exec('test/hello/5566/world/1234');
      matched.id.should.be.equal('5566');
      matched.haha.should.be.equal('1234');
      should.not.exist(matched.querystring);

      // case 2: param with querystring
      matched = r.resourceRegex.exec('test/hello/5566/world/1234' +
        '?abc=123&&def=456');
      matched.id.should.be.equal('5566');
      matched.haha.should.be.equal('1234');
      matched.querystring.should.be.equal('abc=123&&def=456');

      // case 3: param with char ['-', '_']
      matched = r.resourceRegex.exec('test/hello/1_2-3_4-5/world/1234' +
        '?abc=1_2-3&&def=456');
      matched.id.should.be.equal('1_2-3_4-5');
      matched.haha.should.be.equal('1234');
      matched.querystring.should.be.equal('abc=1_2-3&&def=456');
    });
  });

  describe('route a resource in methods', function() {
    var r = new Route('/test/hello/:id/');
    it('should be dispatch correctly', function() {
      var cb = function() {};
      r.get(cb).post(cb);  // chainable api

      // case 1: found
      r.dispatch({method: 'get'})[0].callback.should.be.equal(cb);
      r.dispatch({method: 'post'})[0].callback.should.be.equal(cb);

      // case 2: not found
      r.dispatch({method: 'put'}).length.should.be.equal(0);
    });
  });
});

describe('Router', function() {
  describe('create a Router instance', function() {
    var r = new Router();
    it('should have correct properties', function() {
      r.routes.should.be.eql({});
      should.exist(r.get);
      should.exist(r.post);
      should.exist(r.put);
      should.exist(r.delete);
    });
  });

  describe('route a message in routes', function() {
    var r, msg;
    var cb = function() {};

    beforeEach(function() {
      r = new Router();
      msg = new Message({
        resource: '/test/hello/1/name/myname?q=1',
        method: 'get'
      });
    });

    it('should be able to dispatch correctly', function() {
      r.get('/test/hello/:id/name/:name', cb);
      var result = r.dispatch(msg);
      result.length.should.be.equal(1);
      result[0].message.param.id.should.be.equal('1');
      result[0].message.param.name.should.be.equal('myname');
      result[0].message.query.q.should.be.equal('1');
      result[0].callbacks.length.should.be.equal(1);
      result[0].callbacks[0].callback.should.be.equal(cb);
    });

    it('should return if no routes been matched', function() {
      // var mock = sinon.mock(null);
      r.get('/123', cb);
      expect(r.dispatch(msg)).be.equal(undefined);
    });

    it('should return if no method in matched route', function() {
      r.get('/test/hello/:id/name/:name', cb);
      msg.method = 'post';
      expect(r.dispatch(msg)).be.equal(undefined);
    });
  });
});
