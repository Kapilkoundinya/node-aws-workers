// Manage SSH keys we use to access machines we spin up in AWS

'use strict';

const uuid = require('uuid');
const fs = require('fs');
const ec2 = require('./aws').ec2;

// The prefix we use for resources to make sure we don't delete something we don't own
const PREFIX = require('./aws').PREFIX;

const KEYFILE = __dirname + '/.' + PREFIX + 'keyfile';

// create a new key
function createKey(callback) {
  let keyName = PREFIX + uuid();
  ec2.createKeyPair({
    KeyName: keyName,
  }, callback);
}

// delete a specific key
function deleteKey(name, callback) {
  ec2.deleteKeyPair({
    KeyName: name,
  }, callback);
}

// list all keys taht have our PREFIX
function listKeys(callback) {
  ec2.describeKeyPairs({}, (err, data) => {
    if (err) {
      callback && callback(err);
      return;
    }
    callback && callback(null, data.KeyPairs.filter(key => key.KeyName.indexOf(PREFIX) === 0));
  });
}

// cleanup any keys we created in the past
function cleanupKeys(callback) {
  listKeys((err, keys) => {
    if (err) {
      callback && callback(err);
      return;
    }
    keys.forEach(key => {
      deleteKey(key.KeyName);
    });
    callback && callback(null);
  });
}

// if we don't have a keyfile, create a new key
function loadOrCreateKey(callback) {
  try {
    let storedKey = JSON.parse(fs.readFileSync(KEYFILE));
    listKeys((err, keys) => {
      if (err) {
        callback && callback(err);
        return;
      }
      if (!keys.some(key => key.KeyName === storedKey.KeyName)) {
        fs.unlinkSync(KEYFILE);
        loadOrCreateKey(callback);
        return;
      }
      callback && callback(null, storedKey);
    });
  } catch (e) {
    createKey((err, data) => {
      if (err) {
        callback && callback(err);
        return;
      }
      fs.writeFileSync(KEYFILE, JSON.stringify(data), { flags: 'w+' });
      loadOrCreateKey(callback);
    });
  }
}

module.exports = {
  listKeys: listKeys,
  loadOrCreateKey: loadOrCreateKey,
  cleanupKeys: cleanupKeys,
};
