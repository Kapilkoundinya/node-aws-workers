// Manage SSH keys we use to access machines we spin up in AWS

'use strict';

const fs = require('mz/fs');
const ArgumentParser = require('argparse').ArgumentParser;
const prettyjson = require('prettyjson');
const moment = require('moment');
const readline = require('readline');

const keys = require('../lib/keys');
const ec2Instances = require('../lib/instances');
const s3 = require('../lib/s3');

const config = require('../lib/config');

const baseScript = require('./baseScript.js');
const insertScriptToken = '# __INSERT_USER_SCRIPT__';
const insertKeysToken = '# __INSERT_KEYS__';

const LOGS_BUCKET = 'logs';

function prettyprint(data) {
  console.log(prettyjson.render(data, {}));
}

function output() {
  return (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
    prettyprint(data);
  };
}

let subcommands = {};

let parser = new ArgumentParser({
  addHelp: true,
  description: 'Tool to interact with AWS',
});

let sub = parser.addSubparsers({ title: 'Commands', dest: 'subcommand' });

function addSubcommand(subcommandName, help, args, main) {
  subcommands[subcommandName] = { main };
  let subcommandParser = sub.addParser(subcommandName, {
    addHelp: help ? true : false,
    help: help,
  });

  for (let arg of args) {
    subcommandParser.addArgument(...arg);
  }
}

function defaultCmd(func) {
  return (args) => {
    func(args)
    .then(data => prettyprint(data))
    .catch(err => console.error(err));
  };
}

// Returns instance by instanceName (instanceId or index into instances),
// or if instanceName not specified, return the single instance if
// exactly one exist, else error.
function getInstance(instances, instanceName) {
  if (instanceName) {
    if (!isNaN(instanceName)) {
      if (instanceName >= instances.length) {
        throw `Instance index '${instanceName}' does not exist`;
      }
      return instances[instanceName];
    }
    let some =
        instances.filter(instance => instance.InstanceId === instanceName);
    if (!some.length) {
      throw `InstanceId '${instanceName}' not found`;
    }
    return some[0];
  } else {
    if (instances.length === 0) {
      throw 'No instances';
    }
    if (instances.length > 1) {
      throw 'Too many instances, use -i to disambiguate';
    }
    return instances[0];
  }
}

// run shell command
function runShellCmd(instance, cmd) {
  return ec2Instances.shell(instance, cmd)
    .then(stream => {
      return new Promise(resolve => {
        stream.on('close', () => resolve());
        stream.on('stdout', data => process.stdout.write(data));
        stream.on('stderr', data => process.stdout.write(data));
      });
    });
}

// Supported CLI commands

addSubcommand(
  'show-key',
  `Show user's key`,
  [],
  defaultCmd(() => keys.loadOrCreateKey())
);

addSubcommand(
  'list-keys',
  `List all user's keys (generated by this module)`,
  [],
  defaultCmd(() => keys.listKeys())
);

addSubcommand(
  'cleanup-keys',
  `Remove all of the user's keys (generated by this module). ` +
  '(Note: remaining instances will have to be killed by hand!',
  [],
  defaultCmd(() => keys.cleanupKeys())
);

addSubcommand(
  'start-instances',
  'Start N instances using a specific script',
  [
    [['numInstances'], { help: 'number of instances to start' }],
    [['script'], { help: 'use this script when starting instances' }],
    [['-t'], {
      help: `Specify instance type: cpu (m4.large; default), gpu (p2.xlarge), gpu8x (p2.8xlarge), gpu16x: (p2.16xlarge)`,
      type: 'string',
      dest: 'instanceTypeName',
    }],
  ],
  defaultCmd(args => {
    return fs.readFile(args.script)
      .then(data => {
        let buf = Buffer.from(baseScript);

        // Insert user script ...
        let index = buf.indexOf(insertScriptToken);
        if (index === -1) {
          console.log('bad base script - missing script token');
          process.exit(-1);
        }
        buf = Buffer.concat([buf.slice(0, index), data,
            buf.slice(index)]);

        // Insert keys ...
        let keyStr = `AWS_ACCESS_KEY_ID=${config.aws.accessKeyId}\n`;
        keyStr += `AWS_SECRET_ACCESS_KEY=${config.aws.secretAccessKey}\n`;
        keyStr += `GITHUB_SSH_KEY="${config.git.sshKey}"\n`;
        data = Buffer.from(keyStr);

        let startIdx = 0;
        while ((index = buf.indexOf(insertKeysToken, startIdx)) !== -1) {
          buf = Buffer.concat([buf.slice(0, index), data, buf.slice(index)]);
          startIdx = index + data.length + insertKeysToken.length;
        }

        return ec2Instances.startInstances(
            args.numInstances, buf, args.instanceTypeName);
      });
  })
);

addSubcommand(
  'list-instances',
  'List running instances (with current private key)',
  [
    [['-v'], {
      help: `list instance details`,
      action: 'storeTrue',
      dest: 'verbose',
    }],
    [['-i'], {
      help: `show instance specified by instance id or instance index from list-instances`,
      dest: 'instanceName',
    }],
    [['-a'], {
      help: `show all instances created by the user`,
      action: 'storeTrue',
      dest: 'all',
    }],
  ],
  args => {
    let listInstances = args.all ? ec2Instances.listUserInstances :
        ec2Instances.listCurrentInstances;
    return listInstances()
      .then(instances => {
        if (args.instanceName) { // filter to specified instance
          instances = [getInstance(instances, args.instanceName)];
        }
        for (let idx in instances) {
          let instance = instances[idx];
          console.log(`[${idx}]: ${instance.InstanceId} (${instance.State.Name}) - ${instance.LaunchTime}`);
          if (args.verbose) {
            prettyprint(instance);
          }
        }
      })
      .catch(err => console.error(err));
  }
);

addSubcommand(
  'show-ssh',
  'show cmd to ssh into an instance (started with current private key)',
  [
    [['-i'], {
      help: `instance id or instance index from list-instances`,
      dest: 'instanceName',
    }],
  ],
  args => {
    return ec2Instances.listCurrentInstances()
      .then(instances => getInstance(instances, args.instanceName))
      .then(instance =>
        console.log(`ssh -i ${keys.sshPemFilename()} ubuntu@${instance.PublicDnsName}`)
      )
      .catch(err => console.error(err));
  }
);

addSubcommand(
  'shell',
  'Run shell command on single/all instances that was created using current private keys',
  [
    [['cmd'], { help: 'command to execute' }],
    [['-i'], {
      help: `Specify instance by instance id or instance index from list-instances`,
      dest: 'instanceName',
    }],
    [['-a'], {
      help: `Run on all instances. (Results are not streamed, but shown after completing)`,
      action: 'storeTrue',
      dest: 'all',
    }],
  ],
  args => {
    return ec2Instances.listCurrentInstances()
      .then(instances => {
        if (args.all) {
          let promises = [];
          let instanceIds = [];
          for (let instance of instances) {
            let promise = ec2Instances.shell(instance, args.cmd)
              .then(stream => {
                let output = '';
                return new Promise(resolve => {
                  stream.on('close', () => resolve(output));
                  stream.on('stdout', data => output += data);
                  stream.on('stderr', data => output += data);
                });
              });
            promises.push(promise);
            instanceIds.push(instance.InstanceId);
          }
          return Promise.all(promises)
            .then(results => {
              for (let idx in results) {
                console.log(`Instance '${instanceIds[idx]}':`);
                console.log(results[idx]);
              }
            });
        } else {
          let instance = getInstance(instances, args.instanceName);
          return runShellCmd(instance, args.cmd);
        }
      })
      .catch(err => console.error(err));
  }
);

addSubcommand(
  'log',
  'Show logs of an instance (started with current private key)',
  [
    [['-i'], {
      help: `instance id or instance index from list-instances`,
      dest: 'instanceName',
    }],
  ],
  args => {
    let cmd = 'tail -f -n +1 /var/log/cloud-init-output.log';
    return ec2Instances.listCurrentInstances()
      .then(instances => getInstance(instances, args.instanceName))
      .then(instance => runShellCmd(instance, cmd))
      .catch(err => {
        console.error(err)
        console.error('Instance may have finished. Check S3 logs at https://console.aws.amazon.com/s3/home?region=us-west-2#&bucket=node-aws-worker-logs');
      });
  }
);

addSubcommand(
  'show-logs',
  `Show logs from the user's completed instances`,
  [
    [['-i'], {
      help: `index of logs to view`,
      dest: 'logIndex',
    }],
  ],
  args => {
    return s3.listObjects(LOGS_BUCKET)
      .then(objects => {
        objects = objects.sort((a,b) => a.LastModified < b.LastModified);
        let showLog = key => {
          s3.getObject(LOGS_BUCKET, key)
            .then(data => console.log(data.toString()))
            .catch(err => console.error(err));
        }

        if (args.logIndex !== null) {
          if (!isNaN(args.logIndex) && args.logIndex >= 0 &&
              args.logIndex < objects.length) {
            showLog(objects[args.logIndex].Key);
          } else {
            console.log(`Log index ${args.logIndex} is invalid`);
          }
        } else {
          if (!objects.length) {
            console.error('No logs found for this user');
            return;
          }
          console.log('Logs:');
          let objIdx = 0;
          objects.forEach(object => {
            console.log(`  ${objIdx++}: ${object.Key.slice(0, -31)}... ${moment(object.LastModified).format('ddd MMM D HH:mm:ss')}`);
          });

          const rl = readline.createInterface(
              { input: process.stdin, output: process.stdout }
          );
          rl.question('Select log: ', logIndex => {
            showLog(objects[logIndex].Key);
            rl.close();
          });
        }
      })
      .catch(err => console.error(err));
  }
);

addSubcommand(
  'cleanup-logs',
  `Remove all of the user's logs`,
  [],
  defaultCmd(() => s3.listObjects(LOGS_BUCKET)
    .then(objects => objects.filter(object => object.Key.indexOf(config.git.userEmail) === 0))
    .then(objects => objects.map(object => s3.deleteObject(LOGS_BUCKET, object.Key)))
    .catch(err => console.error(err))
  )
);

addSubcommand(
  'cleanup-instances',
  'Shut down all instances (with current private key)',
  [
    [['-a'], {
      help: `show all instances created by the user`,
      action: 'storeTrue',
      dest: 'all',
    }],
  ],
  args => {
    return args.all ? ec2Instances.cleanupUserInstances() :
        ec2Instances.cleanupCurrentInstances();
  }
);

addSubcommand(
  'list-buckets',
  'Show all s3 buckets that were generated by this module',
  [],
  defaultCmd(() => s3.listBuckets())
);

addSubcommand(
  'ensure-bucket',
  'Make sure a bucket with specified name exists (a prefix will be added)',
  [
    [['bucket'], { help: 'Bucket name (a prefix will be added)' }],
  ],
  defaultCmd(args => s3.ensureBucket(args.bucket))
);

addSubcommand(
  'delete-bucket',
  'Delete specific bucket (only works if it was created by this module)',
  [
    [['bucket'], { help: 'Bucket to delete' }],
  ],
  defaultCmd(args => s3.deleteBucket(args.bucket))
);

addSubcommand(
  'upload',
  'Upload file into a bucket',
  [
    [['bucket'], { help: 'Bucket to upload to' }],
    [['key'], { help: 'Keyname of uploaded content' }],
    [['file'], { help: 'File to upload' }],
  ],
  defaultCmd(args => s3.upload(args.bucket, args.key,
      fs.createReadStream(args.file)))
);

// Parse args and execute command
var args = parser.parseArgs();
if (args.subcommand) {
  subcommands[args.subcommand].main(args);
}
