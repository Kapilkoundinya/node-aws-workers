'use strict';

const uuid = require('uuid');
const fs = require('fs');
const ec2 = require('./aws').ec2;
const keys = require('./keys');

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

function startInstances(callback) {
  keys.loadOrCreateKey(storedKey => {
    ec2.runInstances({
      ImageId: 'ami-746aba14',
      InstanceType: 't2.micro',
      KeyName: storedKey.KeyName,
      MinCount: 1,
      MaxCount: 1,
    }, (err, data) => {
      if (err)
        throw err;
      callback && callback(data);
    });
  });
}

//listInstances(instances => console.log(instances[0].BlockDeviceMappings));
//cleanupInstances();
//startInstances(data => console.log(data));
