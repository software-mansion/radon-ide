#!/bin/bash

# This script downloads pre-built signed release versions of the simulator-server
# along with third party licenses and places them in the build location for packaging.

set -e

# execute this from the vscode-extension package directory
cd "$(dirname "$0")/.."

# take output directory from first argument or default to out - relative to the vscode-extension package location
output_dir="${1:-out}"

# second argument is the tag of the simulator-server release to download, set to latest if not provided
if [ -z "$2" ]; then
    sim_server_tag=$(gh release list --json name,isLatest --jq '.[] | select(.isLatest)|.name' -R software-mansion-labs/simulator-server-releases)
    echo "No tag provided, using latest release: $sim_server_tag"
else
    sim_server_tag="$2"
fi

# Create the target directory if it doesn't exist
mkdir -p "$output_dir"

echo "Downloading simulator-server assets for tag $sim_server_tag"

# Download simulator-server binaries using gh CLI and place them in the output directory with correct file mode
gh release download "$sim_server_tag" --clobber -R software-mansion-labs/simulator-server-releases -p "simulator-server*" -D "$output_dir"
chmod +x "$output_dir"/simulator-server*

# Download Third Party Notices file for simulator-server
gh release download "$sim_server_tag" --clobber -R software-mansion-labs/simulator-server-releases -p "THIRDPARTY.json" -O "$output_dir/simulator-server-NOTICES.json"

echo "Successfully downloaded simulator-server assets for tag $sim_server_tag"
