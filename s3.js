'use strict';

const uuid = require('uuid');
const s3 = require('./aws').s3;

// The prefix we use for resources to make sure we don't delete something we don't own
const PREFIX = require('./aws').PREFIX;

// list buckets
function listBuckets(callback) {
  s3.listBuckets({}, (err, data) => {
    if (err)
      throw err;
    callback && callback(data.Buckets.filter(bucket => bucket.Name.indexOf(PREFIX) === 0));
  });
}

function createBucket(name, callback) {
  s3.createBucket({
    Bucket: PREFIX + name,
  }, (err, data) => {
    if (err)
      throw err;
    callback && callback(data);
  });
}

function deleteBucket(name, callback) {
  s3.deleteBucket({
    Bucket: PREFIX + name,
  }, (err, data) => {
    if (err)
      throw err;
    callback && callback(data);
  });
}

function exitsBucket(name, callback) {
  s3.headBucket({
    Bucket: PREFIX + name,
  }, (err, data) => {
    callback && callback(!err);
  });
}

// ensure that a bucket exists
function ensureBucket(name, callback) {
  exitsBucket(name, exits => {
    if (exits) {
      callback && callback();
      return;
    }
    createBucket(name, callback);
  });
}

// upload data (string or buffer) as file 'key' in 'bucket'
function upload(bucket, key, data, callback) {
  s3.upload({
    Bucket: PREFIX + bucket,
    Key: key,
    Body: data,
  }, function (err, data) {
    if (err)
      throw err;
    callback && callback(data);
  });
}

module.exports = {
  ensureBucket: ensureBucket,
  upload: upload,
};