'use strict';

var RpcClient = require('../lib/amqp_rpc_client');
var amqplib = require('amqplib');
var expect = require('expect.js');
var Promise = require('bluebird');
var sinon = require('sinon');


describe('test', function(done) {

  // var client = new RpcClient(amqplib);

  // var message = {
  //  ClientKey: 'southeast',
  //  OrgKey: 'section1',
  //  Username: 'user2@southeast.com',
  //  Id: 'filters'
  // };

  // client.send('medseek.predict.services.filterTypes.get', message).then(function(reply) {
  //  console.log(JSON.stringify(reply));
  // }).finally(done);

});
