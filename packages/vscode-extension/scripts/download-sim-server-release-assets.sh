#!/bin/bash

# This script downloads pre-built signed release versions of the simulator-server
# binaries and places them in the build location for packaging.

set -e

# execute this from the vscode-extension package directory
cd "$(dirname "$0")/.."

# take output directory from first argument or default to out - relative to the vscode-extension package location
output_dir="${1:-out}"

# second argument is the tag of the simulator-server release to download, defaults to latest
sim_server_tag="${2:-latest}"

# Create the target directory if it doesn't exist
mkdir -p "$output_dir"

echo "Downloading simulator-server assets for tag $sim_server_tag"

# List release assets using GitHub API
release_info=$(curl -s "https://api.github.com/repos/software-mansion-labs/simulator-server-releases/releases/$sim_server_tag")

# Download simulator-server assets and place them in the output directory
echo "$release_info" |
    grep "browser_download_url.*simulator-server" |
    cut -d '"' -f 4 |
    while read -r url; do
        filename=$(basename "$url")
        echo "Downloading $filename..."
        curl -L "$url" -o "$output_dir/$filename"
    done

# Make binaries executable
chmod +x "$output_dir"/simulator-server*

mv "$output_dir"/THIRDPARTY.json "$output_dir"/simulator-server-NOTICES.json

echo "Successfully downloaded simulator-server assets for tag $sim_server_tag"
