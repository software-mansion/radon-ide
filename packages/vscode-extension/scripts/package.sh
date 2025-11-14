#!/bin/bash
set -e

rm -rf dist/*
cp ../vscode-js-debug/dist/src/chromehash_bg.wasm dist/
npm run build:dist

if [ -n "$SIM_SERVER_WITH_DEBUG_TOKEN" ]; then
  npm run build:sim-server-debug
fi
