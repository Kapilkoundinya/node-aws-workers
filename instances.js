'use strict';

const uuid = require('uuid');
const fs = require('fs');
const ec2 = require('./aws').ec2;
const keys = require('./keys');
const SSHClient = require('ssh2').Client;

// list all instances that were launched by our current key
function listInstances(callback) {
  keys.loadOrCreateKey(storedKey => {
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

function startInstances(script, callback) {
  keys.loadOrCreateKey(storedKey => {
    ec2.runInstances({
      ImageId: 'ami-746aba14',
      InstanceType: 't2.micro',
      KeyName: storedKey.KeyName,
      MinCount: 1,
      MaxCount: 1,
      UserData: (new Buffer(script)).toString('base64'),
    }, callback);
  });
}

function runAll(cmd, callback) {
  listInstances(instances => {
    keys.loadOrCreateKey(key => {
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
              callback && callback(null, stdout, stderr);
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
  runAll: runAll,
};

//listInstances((err, data) => console.log(data));

//let script = fs.readFileSync('boot.sh', 'utf8');
//startInstances(script, data => console.log(data));
//cleanupInstances();

//runAll('sudo cat /var/log/cloud-init-output.log', (stdout, stderr) => console.log(stdout, stderr));
