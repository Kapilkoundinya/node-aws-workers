# node-aws-workers

Tool to spawn EC2 instances that runs a specific user script.
Handles logging and key management.

# Configuration

This tool requires AWS and GitHub credentials, which can configured
in two ways:

1) From a `local.config.json` file in the local directory. If this file
exists, this takes precedence over other methods. The file format is as
follows:


```
{
  "git": {
    "userEmail": "your@email.com",
    "sshKey": "-----BEGIN RSA PRIVATE KEY-----\nYOUR_PRIVATE_SSH_KEY...\n-----END RSA PRIVATE KEY-----"
  },
  "aws": {
    "accessKeyId": "YOUR_AWS_ACCESS_KEY_ID",
    "secretAccessKey": "YOUR_AWS_SECRET_ACCESS_KEY"
  }
}

2) From your shell.

* Assumes these environment variables are set:
  * AWS_ACCESS_KEY_ID
  * AWS_SECRET_ACCESS_KEY

* Assumes GH git credentials are set globally
  (e.g. `git config --get user.email`)

* Assumes GH ssh keys are located in `~/.ssh/id_rsa`.
```

# Examples

To get help:
```
node tools/cli.js -h
```

To spawn a single instance:
```
node tools/cli.js start-instances 1 <name of script to run>
```

To print log of running instance:
```
node tools/cli.js log
```

To show log of finished instance:s
```
node tools/cli.js show-logs
```



