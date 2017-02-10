/**
 * Copyright (c) 2017 Silk Labs, Inc.
 * All Rights Reserved.
 * Confidential and Proprietary - Silk Labs, Inc.
 *
 * @noflow
 */

'use strict';

const baseScript =
`#!/bin/bash -ex

#
# Start of EC2 init script
#

function exit-handler() {
  sudo shutdown -H now
  exit
}

# Force shutdown when the EC2 script finishes for any reason
trap exit-handler EXIT

# Disable command echo to not print keys
set +x

# __INSERT_KEYS__    <-- tool looks for this token to insert GH keys

# Renable command echo (done with setting keys)
set -x

export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY

# Switch to docker container
IMAGENAME=silk-train-env
AWS_REPO_NAME=silklabs/$IMAGENAME
AWS_REPO_URI=950350541789.dkr.ecr.us-east-1.amazonaws.com/$AWS_REPO_NAME
eval $(aws ecr get-login --region us-east-1)
#docker pull $AWS_REPO_URI
#docker run -i $AWS_REPO_URI bash <<"DOCKER_ENV_EOFEOFEOF"

docker pull knidum2/silk-train-env
docker run -i knidum2/silk-train-env bash <<"DOCKER_ENV_EOFEOFEOF"

#
# Start of docker init script
#

OUTPUT_LOG_FILE=~/log.txt
export OUTPUT_LOG_FILE

bash <<"DOCKER_SCRIPT_EOFEOFEOF" 2>&1 | tee $OUTPUT_LOG_FILE

#
# Start of single tee'd command in docker env
#

set -ex

function docker-upload-log() {
  node $BASE_DIR/node-aws-workers/tools/cli.js upload $UPLOAD_BUCKET $OUTPUT_NAME.log $OUTPUT_LOG_FILE
}

function docker-exit-handler() {
  echo "Script finished with $LOG_TYPE"
  docker-upload-log || true
  exit
}

# Trap when docker init script finishes to upload logs
trap docker-exit-handler EXIT

LOG_TYPE=error

BASE_DIR=/opt
UPLOAD_BUCKET=logs

mkdir -p ~/.ssh/

SSH_CONFIG="Host github.com
  StrictHostKeyChecking no
  IdentityFile ~/.ssh/id_rsa
"

echo  "$SSH_CONFIG" >> ~/.ssh/config
chmod 600 ~/.ssh/config

# Disable command echo to not print keys
set +x

# __INSERT_KEYS__    <-- tool looks for this token to insert GH keys

echo "$GITHUB_SSH_KEY" > ~/.ssh/id_rsa
chmod 600 ~/.ssh/id_rsa

# Renable command echo (done with setting keys)
set -x

export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY

INSTANCE_NAME="\`wget -q -O - http://instance-data/latest/meta-data/instance-id\`"
PUBLIC_KEYS="\`wget -q -O - http://instance-data/latest/meta-data/public-keys\`"
PUBLIC_KEY=\${PUBLIC_KEYS:2}  # remove 0=
PUBLIC_KEY=\${PUBLIC_KEY::-37} # remove guid suffix
OUTPUT_NAME="$PUBLIC_KEY-$INSTANCE_NAME-\`cat /proc/sys/kernel/random/uuid\`"

echo Setting up instance $INSTANCE_NAME
date

# NVM path is not added for non-login shells, not sure why. Manually add here
export NVM_DIR="/root/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm

# Dump the installed packages for logging
apt list --installed

function clone-and-install() {
  time git clone --progress git@github.com:silklabs/$1.git
  pushd $1
  time npm install --no-optional
  popd
}

cd $BASE_DIR

clone-and-install node-aws-workers

echo "Starting user script"
# __INSERT_USER_SCRIPT__   <-- tool looks for this token to insert user script

DOCKER_SCRIPT_EOFEOFEOF

#
# End of single tee'd command in docker env
#

LOG_TYPE=success;

echo Done
date

DOCKER_ENV_EOFEOFEOF

#
# End of docker init script
#
`;

module.exports = baseScript;
