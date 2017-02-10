/**
 * Copyright (c) 2017 Silk Labs, Inc.
 * All Rights Reserved.
 * Confidential and Proprietary - Silk Labs, Inc.
 *
 * @noflow
 */

'use strict';

const uuid = require('uuid');
const fs = require('mz/fs');
const EventEmitter = require('events').EventEmitter;
const ec2 = require('./aws').ec2;
const keys = require('./keys');
const config = require('./config');
const SSHClient = require('ssh2').Client;

const UID = config.git.userEmail;

const instanceTypes = {
  cpu: 'm4.large',
  gpu: 'p2.xlarge',
  gpu8x: 'p2.8xlarge',
  gpu16x: 'p2.16xlarge',
};

// Returns list of instances: all from user or only from current key.
function _listInstances(onlyCurrentKey) {
  let storedKey;
  return keys.loadOrCreateKey()
    .then(result => {
      storedKey = result;
      return ec2.describeInstances({});
    })
    .then(data => {
      let instances = Array.prototype.concat.apply([], data.Reservations.map(reservation => reservation.Instances));
      return instances.filter(instance =>
          instance.State.Name !== 'terminated' &&
          instance.State.Name !== 'shutting-down' &&
          instance.KeyName && instance.KeyName.indexOf(UID) === 0 &&
          (!onlyCurrentKey || instance.KeyName === storedKey.KeyName));
    });
}

// List all instances created by the user
function listUserInstances() {
  return _listInstances(false);
}

// List all instances created by the user with the current key
function listCurrentInstances() {
  return _listInstances(true);
}

// Kill instances: all from user or only from current key.
function _cleanupInstances(onlyCurrentKey) {
  return _listInstances(onlyCurrentKey)
    .then(instances => {
      if (!instances.length) {
        return null
      }
      return ec2.terminateInstances({
        InstanceIds: instances.map(instance => instance.InstanceId),
      })
    });
}

// Kill all instances created by the user
function cleanupUserInstances() {
  return _cleanupInstances(false);
}

// Kill all instances created by the user with the current key
function cleanupCurrentInstances() {
  return _cleanupInstances(true);
}

// Convert whatever is passed as script to a Buffer.
function scriptToBuffer(script) {
  if (Buffer.isBuffer(script)) {
    return script;
  }

  if (script.startsWith('#')) {
    script = new Buffer(script, 'utf8');
    return script;
  }

  return fs.readFile(script);
}

function startInstances(max, script, instanceTypeName) {
  if (!(instanceTypeName in instanceTypes)) {
    instanceTypeName = 'cpu';
  }
  let instanceType = instanceTypes[instanceTypeName];
  let storedKey;
  return keys.loadOrCreateKey()
    .then(result => {
      storedKey = result;
      return scriptToBuffer(script);
    })
    .then(script => ec2.runInstances({
        ImageId: 'ami-765db660',
        InstanceType: instanceType,
        KeyName: storedKey.KeyName,
        MinCount: 1,
        MaxCount: max | 0,
        UserData: script.toString('base64'),
        InstanceInitiatedShutdownBehavior: 'terminate',
        SecurityGroupIds: ['sg-2de13a51'],
        BlockDeviceMappings: [{
          DeviceName: '/dev/sda1',
          Ebs: {
            DeleteOnTermination: true,
            VolumeSize: 500,
          }
        }],
      })
    );
}

function shell(instance, cmd) {
  let conn = new SSHClient();
  let stdout = '';
  let stderr = '';

  return keys.loadOrCreateKey()
    .then(storedKey => {
      return new Promise((resolve, reject) => {
        conn.on('ready', () => {
          conn.exec(cmd, (err, stream) => {
            if (err) {
              throw reject(err);
            }
            let shellStream = new EventEmitter();

            stream.on('close', (code, signal) => {
              conn.end();
              shellStream.emit('close');
            }).on('data', data => {
              shellStream.emit('stdout', data.toString('ascii'));
            }).stderr.on('data', data => {
              shellStream.emit('stderr', data.toString('ascii'));
            });

            resolve(shellStream);
          });
        }).connect({
          host: instance.PublicDnsName,
          username: 'ubuntu',
          privateKey: storedKey.KeyMaterial,
        });
      });
    });
}

module.exports = {
  listCurrentInstances: listCurrentInstances,
  listUserInstances: listUserInstances,
  startInstances: startInstances,
  cleanupCurrentInstances: cleanupCurrentInstances,
  cleanupUserInstances: cleanupUserInstances,
  shell: shell,
};
