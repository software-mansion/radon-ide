#!/bin/bash

set -e

URL="https://github.com/utmapp/UTM/releases/latest/download/UTM.dmg"
DMG_NAME="UTM.dmg"
MOUNT_POINT="/Volumes/UTM"
APP_PATH="/Applications/UTM.app"

echo "Downloading UTM..."
curl -L "$URL" -o "$DMG_NAME"

echo "Mounting DMG image..."
hdiutil attach "$DMG_NAME" -nobrowse -quiet

echo "Copying to /Applications..."
cp -R "$MOUNT_POINT/UTM.app" "$APP_PATH"

echo "Unmounting DMG..."
hdiutil detach "$MOUNT_POINT" -quiet

echo "Removing DMG file..."
rm "$DMG_NAME"

echo "Done. UTM installed in $APP_PATH."

echo "Running UTM..."
open "$APP_PATH"
