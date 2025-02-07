#!/bin/bash

set -e

submodule="redux-devtools-expo-dev-plugin"

cd "$(dirname "$0")/.."

# Create dir for the bundled plugin
mkdir -p "lib/plugins/external"
# Create dir for Web UI
mkdir -p "plugins_dist/redux"

# Init submodules
echo "Init $submodule git submodule"

git submodule update --init -- ../$submodule

submodule_status=$(git submodule status ../$submodule)
if [[ $submodule_status == +* ]]; then # submodule is not up-to-date
    echo "$submodule submodule is not up to date"
    exit 1
fi

echo "Installing submodule dependencies"

cd ../$submodule
npm install # Install submodule

echo "Building webui"

npm run web:export 

rm -rf ../vscode-extension/plugins_dist/redux/* # Remove old files
mv -f dist/_expo/static/css/* ../vscode-extension/plugins_dist/redux/ # Copy newly generated files
mv -f dist/_expo/static/js/web/* ../vscode-extension/plugins_dist/redux/ # Copy newly generated files

echo "Building plugin"

./node_modules/.bin/esbuild src/index.ts --bundle --platform=node --outfile=redux-devtools-expo-dev-plugin.js

rm -f ../vscode-extension/lib/plugins/external/redux-devtools-expo-dev-plugin.js
mv -f ./redux-devtools-expo-dev-plugin.js ../vscode-extension/lib/plugins/external/redux-devtools-expo-dev-plugin.js
