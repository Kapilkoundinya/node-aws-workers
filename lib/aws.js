/**
 * Copyright (c) 2017 Silk Labs, Inc.
 * All Rights Reserved.
 * Confidential and Proprietary - Silk Labs, Inc.
 *
 * @noflow
 */

'use strict';

const AWS = require('aws-sdk');

AWS.config.update({region: 'us-east-1'});

// wrap all functions on an object such that they return a promise instead of
// taking an event handler
function promisify(obj) {
  let wrapped = {unwrapped: obj};
  for (let fn in obj) {
    let fun = obj[fn];
    if (fun instanceof Function) {
      wrapped[fn] = function () {
        let args = [];
        for (let i = 0; i < arguments.length; ++i) {
          args[i] = arguments[i];
        }
        let promise = new Promise((fulfill, reject) => {
          args.push((err, data) => {
            if (err) {
              reject(err);
              return;
            }
            fulfill(data);
          });
        });
        fun.apply(obj, args);
        return promise;
      };
    }
  }
  return wrapped;
}

module.exports = {
  ec2: promisify(new AWS.EC2()),
  s3: promisify(new AWS.S3()),
  iam: promisify(new AWS.IAM()),
  PREFIX: 'node-aws-worker',
};
