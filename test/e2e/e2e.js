var Sanji = require('../../index');

var bundle = new Sanji({
  bundlePath: './../mock'
});

bundle.start();

bundle.run = function() {
  console.log('runrunrunrunrunrunrunrunrun');
  bundle.publish.get('/system/time').then(function(data) {
    console.log(data);
  });
};
