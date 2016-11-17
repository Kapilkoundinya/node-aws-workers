'use strict';

const s3 = require('./aws').s3;
const config = require('./config');

// The prefix we use for resources to make sure we don't delete something we don't own
const PREFIX = require('./aws').PREFIX;
const UID = config.git.userEmail;

// list buckets
function listBuckets() {
  return s3.listBuckets({})
    .then(data => data.Buckets.filter(bucket => bucket.Name.indexOf(PREFIX) === 0));
}

function createBucket(name) {
  return s3.createBucket({ Bucket: `${PREFIX}-${name}` });
}

function deleteBucket(name) {
  return s3.deleteBucket({ Bucket: `${PREFIX}-${name}` });
}


function existsBucket(name) {
  return s3.headBucket({ Bucket: `${PREFIX}-${name}` })
    .then(result => true)
    .catch(err => false);
}

// ensure that a bucket exists
function ensureBucket(name) {
  return existsBucket(name)
    .then(exists => {
      if (exists) {
        return null;
      }
      return createBucket(name);
  });
}

// upload data (string or buffer) as file 'key' in 'bucket'
function upload(bucket, key, data) {
  return s3.upload({
    Bucket: `${PREFIX}-${bucket}`,
    Key: key,
    Body: data,
  });
}

function listObjects(bucket) {
  return s3.listObjects({ Bucket: `${PREFIX}-${bucket}` })
    .then(data => data.Contents.filter(
        content => content.Key.indexOf(UID) === 0));
}

function getObject(bucket, key) {
  return s3.getObject({ Bucket: `${PREFIX}-${bucket}`, Key: key })
    .then(data => data.Body);
}

function deleteObject(bucket, key) {
  return s3.deleteObject({ Bucket: `${PREFIX}-${bucket}`, Key: key });
}

module.exports = {
  listBuckets: listBuckets,
  ensureBucket: ensureBucket,
  deleteBucket: deleteBucket,
  upload: upload,
  listObjects: listObjects,
  getObject: getObject,
  deleteObject: deleteObject,
};
