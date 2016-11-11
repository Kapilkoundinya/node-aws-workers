'use strict';

const s3 = require('./aws').s3;

// The prefix we use for resources to make sure we don't delete something we don't own
const PREFIX = require('./aws').PREFIX;

// list buckets
function listBuckets(callback) {
  s3.listBuckets({}, (err, data) => {
    if (err) {
      callback && callback(err);
      return;
    }
    callback && callback(null, data.Buckets.filter(bucket => bucket.Name.indexOf(PREFIX) === 0));
  });
}

function createBucket(name, callback) {
  s3.createBucket({
    Bucket: PREFIX + name,
  }, callback);
}

function deleteBucket(name, callback) {
  s3.deleteBucket({
    Bucket: PREFIX + name,
  }, callback);
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
      callback && callback(null);
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
    if (err) {
      callback && callback(err);
      return;
    }
    callback && callback(null, data);
  });
}

module.exports = {
  listBuckets: listBuckets,
  ensureBucket: ensureBucket,
  deleteBucket: deleteBucket,
  upload: upload,
};
