'use strict';

var _ = require('lodash');
var Promise = require('bluebird');

module.exports = Listener;

function Listener(amqplib) {
  return Object.create({
    listen: function listen(url, queueName, exchangeName, callback, prefetchValue) {
      if (!url || !queueName || !exchangeName || url.length < 1 || queueName.length < 1 || exchangeName.length < 1) {
        console.warn('not listening due to configuration; url: %s queueName %s exchangeName %s', url, queueName, exchangeName);
        return;
      }

      prefetchValue = prefetchValue || 0;
      return amqplib.connect(url)
        .then(function (conn) {
          return conn.createChannel();
        })
        .then(Listener.createConsumer(queueName, exchangeName, callback, prefetchValue));
    }
  });
}

Listener.createConsumer = createConsumer;
function createConsumer(queueName, exchangeName, callback, prefetchValue) {
  prefetchValue = prefetchValue || 0;
  return function (channel) {
    return channel.prefetch(prefetchValue)
      .then(function () {
        return channel.assertQueue(queueName)
          .then(function () {
            return channel.bindQueue(queueName, exchangeName, queueName);
          });
      })
      .then(function () {
        console.info('[AmqpListener] asserted queue %s with a prefetch value of %d', queueName, prefetchValue);
        channel.consume(queueName, reply(channel, callback));
        console.info('[AmqpListener] attached callback as consumer on %s', queueName);
      });
  };
}

function reply(channel, callback) {
  return function (msg) {
    console.info('received msg', _.omit(msg, 'content'));

    var countReq, replyTo;

    try {
      replyTo = getReplyTo(msg).replace('direct:///', '');
    } catch (err) {
      console.error('[AmqpListener] no reply to address found %s %s', err, JSON.stringify(msg.properties));

      channel.ack(msg);
      return;
    }

    try {
      countReq = JSON.parse(msg.content.toString());
    } catch (err) {
      console.error('[AmqpListener] failed to parse json %s %s', err, msg.content.toString());

      channel.sendToQueue(replyTo, errorRes('Invalid JSON', err.stack));

      channel.ack(msg);

      return;
    }

    var result;
    try {
      result = callback(countReq);
    } catch (err) {
      console.error('count error', err.message, err.stack);
      channel.sendToQueue(replyTo, errorRes('Error during count', err.stack), msg.properties);
      channel.ack(msg);
      return msg;
    }

    return result
      .then(function (result) {
        var strResult = JSON.stringify(result);
        console.debug('[AmqpListener] sending reply to %s. size is %s.', replyTo, strResult ? strResult.length : 0);
        if (strResult && replyTo.length > 0) {
          if (strResult.length > 2048)
            console.info('[AmqpListener] first 2k of results is %s', strResult.substring(1, 2048));
          else
            console.info('[AmqpListener] result is %s', strResult);

          channel.sendToQueue(replyTo, new Buffer(strResult), msg.properties);
        }
        return msg;
      })
      .catch(function (err) {
        console.error('[AmqpListener] list count failure %s %s', err.message, err.stack);
        channel.sendToQueue(replyTo, errorRes('Error during count', err.stack), msg.properties);
      })
      .finally(function () {
        channel.ack(msg);
      });
  };

  function errorRes(reason, stack) {
    return new Buffer(JSON.stringify({
      Message: reason,
      StackTrace: stack
    }));
  }

  function getReplyTo(msg) {
    if (msg.properties.headers && msg.properties.headers.reply_to) {
      return msg.properties.headers.reply_to || '';
    }

    return msg.properties.reply_to || msg.properties.replyTo || '';
  }
}
