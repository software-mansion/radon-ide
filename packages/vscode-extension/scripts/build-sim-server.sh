#!/bin/bash

# take output directory from first argument or default to out
output_dir="${1:-out}"

# take configuration from second argument or default to Debug
configuration=${2:-Debug}

# Get the directory where the script is located
script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

target_dir="${script_dir}/../${output_dir}"
target_location="${target_dir}/sim-server"

# Create the target directory if it doesn't exist
mkdir -p "$target_dir"

# execute the build from the simulator-server package
build_script_location="$script_dir/../../simulator-server/build.sh"
# the build product location is printed by the build script as the very last line, we capture this line to a variable to parse it:
product_path=$("$build_script_location" "$configuration" | tail -n 1)

# Check if the build was successful
if [[ $? -ne 0 ]]; then
    echo "Build failed."
    exit 1
fi

# Check if a file was found and copy it
if [[ -n $product_path ]]; then
    echo "Found binary at $product_path"
    cp "$product_path" "$target_location"
else
    echo "No file found matching the pattern."
fi
