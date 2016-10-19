'use strict';

const ec2 = require('./ec2');
const uuid = require('uuid');

const PREFIX = 'node-aws-worker-';

// create a new key
function createKey(callback) {
  let keyName = PREFIX + uuid();
  ec2.createKeyPair({
    KeyName: keyName,
  }, (err, data) => {
    if (err)
      throw err;
    callback && callback(data.KeyName, data.KeyFingerprint, data.KeyMaterial);
  });
}

// delete a specific key
function deleteKey(name, callback) {
  ec2.deleteKeyPair({
    KeyName: name,
  }, (err, data) => {
    if (err)
      throw err;
    console.log('done deleteKey!');
    callback && callback(data);
  });
}

// cleanup any keys we created in the past
function cleanupKeys() {
  ec2.describeKeyPairs({}, (err, data) => {
    if (err)
      throw err;
    data.KeyPairs.filter(key => key.KeyName.indexOf(PREFIX) === 0).forEach(key => {
      deleteKey(key.KeyName);
    });
  });
}

module.exports = {
  createKey: createKey,
  deleteKey: deleteKey,
  cleanupKeys: cleanupKeys,
};
