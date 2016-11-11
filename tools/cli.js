// Manage SSH keys we use to access machines we spin up in AWS

'use strict';

const fs = require('fs');
const prettyjson = require('prettyjson');

const keys = require('../lib/keys');
const instances = require('../lib/instances');
const s3 = require('../lib/s3');

function output() {
  return (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log(prettyjson.render(data, {}));
  };
}

function main(args) {
  if (!args.length) {
    console.log('show-key             show currently active private key\n' +
                'list-keys            list all SSH2 keys that were generated by this module (active and otherwise)\n' +
                'cleanup-keys         remove all currently active keys (remaining instances will have to be killed by hand!)\n' +
                'start-instances N S  start "N" instances and run shell script "S" on boot\n' +
                'list-instances       list all instances that were launched with the currently active private key\n' +
                'shell C              run a shell command on all running instances\n' +
                'cleanup-instances    shut down all instances that were generated by this module (will shut down other user\'s machines too!)\n' +
                'list-buckets         show all s3 buckets that were generated by this module\n' +
                'ensure-bucket B      make sure a bucket with the name "B" exists (a prefix will be added)\n' +
                'delete-bucket B      delete bucket "B" (only works if it was created by this module)\n' +
                'upload B K F         upload file "F" into bucket B named "K"');
    return -1;
  }

  let cmd = args[0];
  for (let i = 0; ((i = cmd.indexOf('-')) !== -1); ) {
    cmd = cmd.substr(0, i) + cmd[i+1].toUpperCase() + cmd.substr(i+2);
  }
  if (cmd === 'showKey')
    cmd = 'loadOrCreateKey';
  let obj;
  [keys, instances, s3].forEach(mod => {
    if (cmd in mod)
      obj = mod;
  });
  if (!obj) {
    console.log('unknown command: ' + args[0]);
    return -1;
  }
  if (cmd === 'ensureBucket' || cmd === 'deleteBucket' || cmd === 'shell') {
    obj[cmd](args[1], output());
  } else if (cmd === 'upload') {
    obj[cmd](args[1], args[2], fs.readFileSync(args[3], 'utf8'), output());
  } else if (cmd === 'startInstances') {
    obj[cmd](args[1], fs.readFileSync(args[2], 'utf8'), output());
  } else {
    obj[cmd](output());
  }
  return 0;
}

main(process.argv.slice(2));
