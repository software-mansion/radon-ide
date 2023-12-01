#!/bin/bash

# take configuration from first argument or default to Release
configuration=${1:-Release}

# Get the directory where the script is located
script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# build
xcodebuild -project "$script_dir/../../SimulatorStreamServer/SimulatorStreamServer.xcodeproj" -scheme SimulatorStreamServer -sdk macosx -configuration $configuration build

target_dir="${script_dir}/../out/bin"
target_location="${target_dir}/sim-controller"

# Create the target directory if it doesn't exist
mkdir -p "$target_dir"

# Find the newest file matching the pattern
newest_file=$(find ~/Library/Developer/Xcode/DerivedData -name SimulatorStreamServer -type f -path "*/$configuration/SimulatorStreamServer" -print0 | xargs -0 ls -t | head -n 1)

# Check if a file was found and copy it
if [[ -n $newest_file ]]; then
    echo "Found binary at $newest_file"
    cp "$newest_file" "$target_location"
else
    echo "No file found matching the pattern."
fi
