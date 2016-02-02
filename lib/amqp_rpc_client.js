'use strict';

var Promise = require('bluebird');
var uuid = require('uuid');

module.exports = Client;

function Client(amqplib, url, exchange, exchangeType) {
  return Object.create({

    send: function send(routingKey, message) {

      function exclusiveQueue(channel) {
        var replyQueueName = 'list_count.' + routingKey + '.' + uuid();
        return channel.assertQueue(replyQueueName, {
          exclusive: true
        })
        .then(function(ok) {
          return ok.queue;
        });
      }

      function consumeOnce(channel, queue, correlationId) {
        return new Promise(function(resolve, reject) {
          console.log('[AMQP RCP CLIENT] consume inside promise', queue, correlationId);
          try {
            channel.consume(queue, function(msg) {
              console.log('[AMQP RCP CLIENT] received reply');
              if (msg.properties.correlationId !== correlationId) {
                reject(new Error('correlationId does not match'));
              }
              resolve(msg);
            });
          } catch (err) {
            console.error('[AMQP RCP CLIENT] caught error', err);
            reject(err);
          }
        });
      }

      return new Promise(function(resolve, reject) {
        amqplib.connect(url).then(function(conn) {
          console.log('[AMQP RCP CLIENT] connected');
          var corrId = uuid();
          return conn.createChannel()
            .then(function(channel) {
              console.log('[AMQP RCP CLIENT] got channel');
              return channel.assertExchange(exchange, exchangeType, {
                durable: false
              })
                .then(function() {
                  console.log('[AMQP RCP CLIENT] creating exclusive queue');
                  return exclusiveQueue(channel).then(function(queue) {
                    return queue;
                  });
                })
                .then(function(queue) {
                  console.log('[AMQP RCP CLIENT] setting up consumer');
                  consumeOnce(channel, queue, corrId)
                    .then(function(reply) {
                      resolve(JSON.parse(reply.content.toString()));
                    }).
                  finally(function() {
                    console.log('[AMQP RCP CLIENT] closing connection');
                    conn.close();
                  });
                  return queue;
                })
                .then(function(queue) {
                  console.log('[AMQP RCP CLIENT] publishing', exchange, routingKey);
                  channel.publish(exchange, routingKey, new Buffer(JSON.stringify(message)), {
                    contentType: 'application/json',
                    correlationId: corrId,
                    replyTo: queue
                  });
                  return channel;
                });
            });
        }).
        catch (function(err) {
          console.error('[AMQP RCP CLIENT] caught error', err);
          reject(err);
        });
      });
    }
  });
}
