#!/bin/bash
set -e

APP="$1"

if [ -z "$1" ]; then
  APP="react-native-81"
fi

FOLDER_NAME="$APP"
TARGET_SUBDIR="${2:-react-native-app}"
TARGET_DIR="./data/$TARGET_SUBDIR"
REPO_URL="https://github.com/software-mansion-labs/radon-ide-test-apps.git"
TMP_DIR="./tmp-radon-ide-test-apps"

rm -rf "$TARGET_DIR"

mkdir -p "$TMP_DIR"
cd "$TMP_DIR"

git init
git remote add origin "$REPO_URL"
git config core.sparseCheckout true

echo "$FOLDER_NAME" >> .git/info/sparse-checkout
echo "shared" >> .git/info/sparse-checkout

git pull --depth 1 origin main

mkdir -p ../data

mv "$FOLDER_NAME" "../$TARGET_DIR"
mv "shared" ../data/ || true  # move shared to app directory

cd ..
rm -rf "$TMP_DIR"

cd $TARGET_DIR
npm install
npm run copy-shared
cd ../..

echo "Directory $FOLDER_NAME (with shared) successfully fetched into $TARGET_DIR"
