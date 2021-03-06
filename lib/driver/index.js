var internals = {};

internals.mod = internals.mod || {};
internals.mod.log = require('../log');
internals.mod.type = require('../data_type');
internals.mod.Class = require('../class');
var Shadow = require('./shadow');
var log = internals.mod.log;
var tunnel = require('tunnel-ssh'),
    Promise = require('bluebird');

var ShadowProto = {

  createTable: function() { return Promise.resolve(); },
  addForeignKey: function() { return Promise.resolve(); },
  createCollection: function() { return Promise.resolve(); }
};

exports.connect = function (config, intern, callback) {
  var driver, req;

  var mod = internals.mod;
  internals = intern;
  internals.mod = mod;

  if ( !config.user && config.username )
    config.user = config.username;

  if (config.driver === undefined) {
    throw new Error(
      'config must include a driver key specifing which driver to use');
  }

  if (config.driver && typeof (config.driver) === 'object') {

    log.verbose('require:', config.driver.require);
    driver = require(config.driver.require);

  }
  else {
    try {

      req = 'db-migrate-' + config.driver;
      log.verbose('require:', req);

      try {

        driver = require(req);
      }
      catch (Exception) {

        driver = require('../../../' + req);
      }
    }
    catch (Exception) {

      //Fallback to internal drivers, while moving drivers to new repos
      req = './' + config.driver;
      log.verbose('require:', req);
      driver = require(req);
    }
  }

  log.verbose('connecting');

  var connect = function(config) {
    driver.connect(config, intern, function (err, db) {

      if (err) {

        callback(err);
        return;
      }
      log.verbose('connected');

      if (!global.immunity)
        db = Shadow.infect(db, internals, ShadowProto);

      callback(null, db);
    });
  };

  if (config.tunnel) {
    var tunnelConfig = JSON.parse(JSON.stringify(config.tunnel));
    tunnelConfig.dstHost = config.host;
    tunnelConfig.dstPort = config.port;

    if (tunnelConfig.privateKeyPath) {
      tunnelConfig.privateKey = require('fs').readFileSync(tunnelConfig.privateKeyPath);
    }

    // Reassign the db host/port to point to our local ssh tunnel
    config.host = '127.0.0.1';
    config.port = tunnelConfig.localPort;

    tunnel(tunnelConfig, function (err) {

      if (err) {
        callback(err);
        return;
      }
      log.verbose('SSH tunnel connected on port ', tunnelConfig.localPort);

      connect(config);
    });
  }
  else {
    connect(config);
  }
};