'use strict';

const AWS = require('aws-sdk');

AWS.config.update({ region: 'us-west-2' });

module.exports = {
  ec2: new AWS.EC2(),
  s3: new AWS.S3(),
  PREFIX: 'node-aws-worker-',
};

