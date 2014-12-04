var path = require('path'),
    fs = require('fs'),
    Bundle;

Bundle = function Bundle(bundlePath) {

  if (typeof(bundlePath) === 'string') {
    this.path = path.join(bundlePath, 'bundle.json');
    this.profile = JSON.parse(fs.readFileSync(this.path, 'utf8'));
  } else if (typeof(bundlePath) === 'object') {
    this.profile = bundlePath;
    this.path = null;
  }
};

module.exports = Bundle;
