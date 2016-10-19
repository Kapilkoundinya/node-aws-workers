'use strict';

const uuid = require('uuid');
const fs = require('fs');
const ec2 = require('./ec2');

const PREFIX = 'node-aws-worker-';
const KEYFILE = __dirname + '/.' + PREFIX + 'keyfile';

// create a new key
function createKey(callback) {
  let keyName = PREFIX + uuid();
  ec2.createKeyPair({
    KeyName: keyName,
  }, (err, data) => {
    if (err)
      throw err;
    callback && callback(data);
  });
}

// delete a specific key
function deleteKey(name, callback) {
  ec2.deleteKeyPair({
    KeyName: name,
  }, (err, data) => {
    if (err)
      throw err;
    callback && callback(data);
  });
}

// list all keys taht have our PREFIX
function listKeys(callback) {
  ec2.describeKeyPairs({}, (err, data) => {
    if (err)
      throw err;
    callback(data.KeyPairs.filter(key => key.KeyName.indexOf(PREFIX) === 0));
  });
}

// cleanup any keys we created in the past
function cleanupKeys() {
  listKeys(keys => keys.forEach(key => {
    console.log('delete leftover key ' + key.KeyName);
    deleteKey(key.KeyName);
  }));
}

// if we don't have a keyfile, create a new key
function loadOrCreateKey(callback) {
  try {
    let storedKey = JSON.parse(fs.readFileSync(KEYFILE));
    listKeys(keys => {
      if (!keys.some(key => key.KeyName === storedKey.KeyName)) {
        console.log('SSH key ' + storedKey.KeyName + ' vanished, recreating a new key');
        fs.unlinkSync(KEYFILE);
        loadOrCreateKey(callback);
        return;
      }
      callback(storedKey);
    });
  } catch (e) {
    createKey(data => {
      console.log('created new SSH key ' + data.KeyName + ', storing in ' + KEYFILE);
      fs.writeFileSync(KEYFILE, JSON.stringify(data), { flags: 'w+' });
      loadOrCreateKey(callback);
    });
  }
}

module.exports = {
  loadOrCreateKey: loadOrCreateKey,
  cleanupKeys: cleanupKeys,
};
