#!/bin/bash
set -e

APP="$1"

if [ -z "$1" ]; then
  APP="react-native-81"
fi


FOLDER_NAME="$APP"
TARGET_DIR="./data/react-native-app"
# temporary repo with react native apps (one app so far)
REPO_URL="https://github.com/KeyJayY/react-native-apps.git"
TMP_DIR="./tmp-radon-ide-test-apps"

rm -rf "$TARGET_DIR"

mkdir -p "$TMP_DIR"
cd "$TMP_DIR"

git init
git remote add origin "$REPO_URL"
git config core.sparseCheckout true

echo "$FOLDER_NAME" >> .git/info/sparse-checkout

git pull --depth 1 origin main

mkdir -p ../data

mv "$FOLDER_NAME" ../data/react-native-app

cd ..
rm -rf "$TMP_DIR"

cd ./data/react-native-app
npm install
cd ../..

echo "Directory $FOLDER_NAME successfully fetched into $TARGET_DIR"
