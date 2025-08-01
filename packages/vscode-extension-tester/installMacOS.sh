#!/bin/bash

LINK="https://drive.google.com/file/d/1jL1MDcGv1UrN7xppVO6bGabl6b0VTZKu/view?usp=share_link"
DEST_DIR="$HOME/Library/Containers/com.utmapp.UTM/Data/Documents"

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

echo "Done!"
