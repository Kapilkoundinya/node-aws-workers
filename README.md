# node-aws-workers

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

