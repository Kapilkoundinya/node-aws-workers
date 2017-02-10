/**
 * Copyright (c) 2017 Silk Labs, Inc.
 * All Rights Reserved.
 * Confidential and Proprietary - Silk Labs, Inc.
 *
 * @noflow
 */

'use strict'

const path = require('path');
const merge = require('lodash.merge');

const LOCAL_CONFIG = 'local.config';

let config;

function getConfig() {
  if (config) {
    return config;
  }

  let cwd = process.cwd(); //__dirname;

  let defaultConfig = require(path.resolve('config', 'default'));
  let localConfig;
  try {
    localConfig = require(path.resolve(process.cwd(), LOCAL_CONFIG));
  } catch (e) {
    // If there is a syntax error or something we want to raise it.
    if (e.code !== 'MODULE_NOT_FOUND') {
      throw e;
    }
    localConfig = {};
  }
  config = merge(defaultConfig, localConfig);

  // Make sure config includes all necessary keys
  if (!config.git || !config.git.userEmail || !config.git.sshKey ||
      !config.aws || !config.aws.accessKeyId || !config.aws.secretAccessKey) {
    console.log(config);
    console.log('missing config');
    process.exit(-1);
  }

  return config;
}

module.exports = getConfig();
