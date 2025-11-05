#!/bin/bash

LINK="https://drive.google.com/file/d/1Je1nPkgUAE44T_gsBPgJ71baE38i6Ezj/view?usp=sharing"
DEST_DIR="$HOME/Library/Containers/com.utmapp.UTM/Data/Documents"

pkill -f "UTM"

if [ -d "$DEST_DIR/macOS.utm" ]; then
    read -p "'macOS.utm' directory already exists. Do you want to delete old version and continue the download? (y/n): " CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo "Download canceled."
        exit 0
    else
        echo "Removing existing 'macOS.utm' directory..."
        rm -rf "$DEST_DIR/macOS.utm"
    fi
fi

cd "$DEST_DIR" || { echo "cannot open directory"; exit 1; }

echo "Downloading file from Google Drive..."
gdown --fuzzy "$LINK"

sleep 5
ZIP_FILE=$(ls -t *.zip 2>/dev/null | head -n 1)

if [ -z "$ZIP_FILE" ]; then
    echo "No .zip file found after download."
    exit 1
fi


echo "Unpacking $ZIP_FILE..."
unzip "$ZIP_FILE" -d .

echo "Removing ZIP file..."
rm "$ZIP_FILE"

open -a "UTM"
sleep 5
pkill -f "UTM"

echo "Done!"
