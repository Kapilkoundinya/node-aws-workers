'use strict';

const uuid = require('uuid');
const fs = require('fs');
const ec2 = require('./aws').ec2;
const keys = require('./keys');
const SSHClient = require('ssh2').Client;

// list all instances that were launched by our current key
function listInstances(callback) {
  keys.loadOrCreateKey((err, storedKey) => {
    if (err) {
      callback && callback(err);
      return;
    }
    ec2.describeInstances({}, (err, data) => {
      if (err) {
        callback && callback(err);
        return;
      }
      let instances = Array.prototype.concat.apply([], data.Reservations.map(reservation => reservation.Instances));
      callback && callback(null, instances.filter(instance => instance.KeyName === storedKey.KeyName && instance.State.Name !== 'terminated'));
    });
  });
}

// kill all instances running with our key
function cleanupInstances(callback) {
  listInstances((err, instances) => {
    if (err) {
      callback && callback(err);
      return;
    }
    if (!instances.length) {
      callback && callback(null);
      return;
    }
    ec2.terminateInstances({
      InstanceIds: instances.map(instance => instance.InstanceId),
    }, (err, data) => {
      if (err) {
        callback && callback(err);
        return;
      }
      callback && callback(null, data);
    });
  });
}

function startInstances(max, script, callback) {
  keys.loadOrCreateKey((err, storedKey) => {
    if (err) {
      callback && callback(err);
      return;
    }
    ec2.runInstances({
      ImageId: 'ami-746aba14',
      InstanceType: 't2.micro',
      KeyName: storedKey.KeyName,
      MinCount: 1,
      MaxCount: max | 0,
      UserData: (new Buffer(script)).toString('base64'),
    }, callback);
  });
}

function shell(cmd, callback) {
  listInstances((err, instances) => {
    if (err) {
      callback && callback(err);
      return;
    }
    keys.loadOrCreateKey((err, key) => {
      if (err) {
        callback && callback(err);
        return;
      }
      instances.forEach(instance => {
        let conn = new SSHClient();
        let stdout = '';
        let stderr = '';
        conn.on('ready', () => {
          conn.exec(cmd, (err, stream) => {
            if (err) {
              callback && callback(err);
              return;
            }
            stream.on('close', function(code, signal) {
              conn.end();
              callback && callback(null, stdout + stderr);
            }).on('data', function(data) {
              stdout += data.toString('ascii');
            }).stderr.on('data', function(data) {
              stderr += data.toString('ascii');
            });
          });
        }).connect({
          host: instance.PublicDnsName,
          username: 'ubuntu',
          privateKey: key.KeyMaterial,
        });
      });
    });
  });
}

module.exports = {
  listInstances: listInstances,
  startInstances: startInstances,
  cleanupInstances: cleanupInstances,
  shell: shell,
};
