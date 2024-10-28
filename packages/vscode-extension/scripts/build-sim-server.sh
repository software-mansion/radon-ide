#!/bin/bash

# execute this from the vscode-extension package directory
cd "$(dirname "$0")/.."

# take output directory from first argument or default to out - relative to the vscode-extension package location
output_dir="${1:-out}"

submodule_status=$(git submodule status ../simulator-server)


if [[ $submodule_status == -* ]]; then # submodule is not initialized

# get version of npm module
latest_tag=$(git describe --tags --abbrev=0)
download_base_url="https://github.com/software-mansion/radon-ide/releases/download/${latest_tag}/"

if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    product_path="$output_dir/simulator-server-${latest_tag}-windows.exe"
    download_url="${download_base_url}simulator-server-windows.exe"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    product_path="$output_dir/simulator-server-${latest_tag}-mac"
    download_url="${download_base_url}simulator-server-mac"
else
    product_path="$output_dir/simulator-server-${latest_tag}-linux"
    download_url="${download_base_url}simulator-server-linux"
fi

# if the binary is not present, download it from Radon IDE releases page
if [[ ! -f "$product_path" ]]; then
    echo "Simulator server binary not found: $product_path"
    echo ""
    echo "Downloading the binary from the Radon IDE releases page..."
    echo ""
    curl -L "$download_url" -o "$product_path" -f -# --create-dirs
fi

if [[ ! -f "$product_path" ]]; then
    echo "Failed to download the binary. Aborting."
    exit 1
fi

else # submodule is initialized

if [[ $submodule_status == +* ]]; then # submodule is not up-to-date
    echo "Submodule has changes. Continue? [y/n]"
    # read answer or abort if no input is provided in 5 seconds
    read -t 5 answer
    if [[ ! $answer =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# execute the build from the simulator-server package
# the build product location is printed by the build script as the very last line
product_path=$("../simulator-server/scripts/build.sh" "Debug" | tail -n 1)

# Check if the build was successful
if [[ $? -ne 0 ]]; then
    echo "Build failed."
    exit 1
fi

fi # submodule check


# Create the target directory if it doesn't exist
mkdir -p "$output_dir"
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    target_location="$output_dir/simulator-server-windows.exe"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    target_location="$output_dir/simulator-server-mac"
else
    target_location="$output_dir/simulator-server-linux"
fi

# Check if a file was found and copy it
if [[ -n $product_path ]]; then
    cp "$product_path" "$target_location"
    # add execution permissions
    chmod +x "$target_location"
else
    echo "No file found matching the pattern."
fi
