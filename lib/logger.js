var bunyan = require('bunyan'),
    instance = null;

var Logger = function(options) {
    var level = 'debug';
    var src = true;
    options = options || {};
    options.NODE_ENV = options.NODE_ENV || process.env.NODE_ENV || 'development';
    options.name = options.name || 'NoName';

    if (options.NODE_ENV === 'production') {
      level = 'info';
      src = false;
    } else if (options.NODE_ENV === 'debug') {
      level = 'trace';
    }

    if (!instance) {
      instance = bunyan.createLogger({
        name: options.name,
        level: level,
        src: src
      });
    }

    return instance;
};

module.exports = Logger();
