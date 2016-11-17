// Manage SSH keys we use to access machines we spin up in AWS

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const uuid = require('uuid');
const exec = require('child_process').exec;
const config = require('./config');
const AWS = require('./aws');
const ec2 = AWS.ec2;

const PREFIX = AWS.PREFIX;
const KEYFILE = path.resolve(os.homedir(), '.' + PREFIX);
const PEMFILE = path.resolve(os.homedir(), '.' + PREFIX + '-key.pem');
const UID = config.git.userEmail;

// create a new key
function createKey() {
  return ec2.createKeyPair({ KeyName: `${UID}-${uuid()}` });
}

// delete a specific key
function deleteKey(name) {
  return ec2.deleteKeyPair({ KeyName: name });
}

// list all of the user's keys
function listKeys() {
  return ec2.describeKeyPairs({})
    .then(data => data.KeyPairs.filter(key => key.KeyName.indexOf(UID) === 0));
}

// cleanup any keys we created in the past
function cleanupKeys() {
  return listKeys()
    .then(keys => keys.forEach(key => deleteKey(key.KeyName)))
    .then(() => {
      try {
        fs.unlinkSync(KEYFILE);
      } catch (e) { }
    });
}

// if we don't have a keyfile, create a new key
function loadOrCreateKey() {
  try {
    let storedKey = JSON.parse(fs.readFileSync(KEYFILE));
    return listKeys()
      .then(keys => {
        if (!keys.some(key => key.KeyName === storedKey.KeyName)) {
          fs.unlinkSync(KEYFILE);
          return loadOrCreateKey();
        }
        return storedKey;
      });
  } catch (e) {
    let key;
    return createKey()
      .then(data => {
        key = data;
        return fs.writeFileSync(KEYFILE, JSON.stringify(key), { flags: 'w+' });
      })
      .then(() => fs.unlinkSync(PEMFILE))
      .catch(err => {
        if (err.code !== 'ENOENT') {
          throw(err);
        }
      })
      .then(() => fs.writeFileSync(PEMFILE, key.KeyMaterial, { mode: '400' }))
      .then(() => loadOrCreateKey());
  }
}

function sshPemFilename() {
  return PEMFILE;
}

module.exports = {
  listKeys: listKeys,
  loadOrCreateKey: loadOrCreateKey,
  cleanupKeys: cleanupKeys,
  sshPemFilename: sshPemFilename,
};
