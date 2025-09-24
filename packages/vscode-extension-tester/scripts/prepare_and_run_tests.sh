#!/bin/bash

APP="$1"
if [ -z "$APP" ]; then
  APP="react-native-81"
else
  shift
fi

npm run clean && \
npm run get-test-app -- "$APP" && \
npm run build-vsix-package && \
npm run setup-run-tests -- "$@"
