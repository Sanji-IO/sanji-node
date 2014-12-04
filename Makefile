test:
	mocha --reporter spec --bail --check-leaks

watch-coverage:
	mocha -w --require blanket --reporter mocha-text-cov

watch:
	mocha -w

coverage:
	mocha --require blanket -R html-cov > coverage.html

travis-test:
	NODE_ENV=test YOURPACKAGE_COVERAGE=1 ./node_modules/.bin/mocha \
	  --require blanket \
	  --reporter mocha-lcov-reporter | ./node_modules/coveralls/bin/coveralls.js

.PHONY: test watch-coverage watch coverage travis-test
