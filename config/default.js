/**
 * Copyright (c) 2017 Silk Labs, Inc.
 * All Rights Reserved.
 * Confidential and Proprietary - Silk Labs, Inc.
 *
 * @noflow
 */

'use strict'

const fs = require('fs');
const os = require('os');
const path = require('path');
const execSync = require('child_process').execSync

const sshKeyPath = path.resolve(os.homedir(), '.ssh', 'id_rsa');

function getGitEmail() {
  let stdout = execSync('git config --get user.email', { encoding: 'utf8' });
  if (!stdout) {
    return undefined;
  }
  return stdout.replace(/(\r\n|\n|\r)$/, ''); // remove newline
}

function getGitSshKey() {
  if (!fs.existsSync(sshKeyPath)) {
    return undefined;
  }
  return fs.readFileSync(sshKeyPath, 'utf8');
}

module.exports = {
  git: {
    userEmail: getGitEmail(),
    sshKey: getGitSshKey(),
  },
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
};
