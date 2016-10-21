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
      if (err)
        throw err;
      let instances = Array.prototype.concat.apply([], data.Reservations.map(reservation => reservation.Instances));
      callback && callback(instances.filter(instance => instance.KeyName === storedKey.KeyName && instance.State.Name !== 'terminated'));
    });
  });
}

// kill all instances running with our key
function cleanupInstances() {
  listInstances(instances => {
    if (!instances.length)
      return;
    ec2.terminateInstances({
      InstanceIds: instances.map(instance => instance.InstanceId),
    }, (err, data) => {
      if (err)
        throw err;
      console.log(JSON.stringify(data));
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
    }, (err, data) => {
      if (err)
        throw err;
      callback && callback(data);
    });
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
            if (err)
              throw err;
            stream.on('close', function(code, signal) {
              conn.end();
              callback(stdout, stderr);
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

//let script = fs.readFileSync('boot.sh', 'utf8');
//startInstances(script, data => console.log(data));
//cleanupInstances();

runAll('sudo cat /var/log/cloud-init-output.log', (stdout, stderr) => console.log(stdout, stderr));
