#!/bin/bash
set -e

TARGET_DIR="./data/react-native-77"
REPO_URL="https://github.com/software-mansion-labs/radon-ide-test-apps.git"
TMP_DIR="./tmp-radon-ide-test-apps"

if [ -d "$TARGET_DIR" ]; then
    echo "Directory $TARGET_DIR already exists. Skipping fetch."
    exit 0
fi

mkdir -p "$TMP_DIR"
cd "$TMP_DIR"

git init
git remote add origin "$REPO_URL"
git config core.sparseCheckout true

echo "react-native-77" >> .git/info/sparse-checkout

git pull --depth 1 origin main

mkdir -p ../data

mv react-native-77 ../data/react-native-77

cd ..
rm -rf "$TMP_DIR"

echo "Directory react-native-77 successfully fetched into $TARGET_DIR"
