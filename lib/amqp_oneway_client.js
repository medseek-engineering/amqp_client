'use strict';

var Promise = require('bluebird');
var uuid = require('uuid');
var _ = require('lodash');

module.exports = Client;

function Client(amqplib, url, exchangeName, exchangeType) {

  return Object.create({

    send: function send(routingKey, message, publishOpts) {
      publishOpts = publishOpts || {};
      _.extend(publishOpts, {
        contentType: 'application/json',
        correlationId: uuid()
      });
      return new Promise(function (resolve, reject) {
        amqplib.connect(url).then(function (conn) {
          console.log('[AMQP 1W CLIENT] connected');
          return conn.createChannel().then(function (channel) {
            console.log('[AMQP 1W CLIENT] got channel');
            var ok = channel.assertExchange(exchangeName, exchangeType, {durable: false});
            return ok.then(function () {
              console.log('[AMQP 1W CLIENT] publishing', exchangeName, routingKey);
              channel.publish(exchangeName, routingKey, new Buffer(JSON.stringify(message)), publishOpts);
              return channel.close().then(function(){
                resolve();
              });
            });
          })
          .then(function () {
            console.log('[AMQP 1W CLIENT] closing connection');
            conn.close();
          });
        })
        .catch(function (err) {
          console.error('[AMQP 1W CLIENT] caught error', err);
          reject(err);
        });
      });
    }
  });
}
