#!/bin/bash

# https://github.com/software-mansion-labs/react-native-ide/releases/download/sim-server-b3b2824f936fa12fd952033ff2874217eb5e3152/sim-server
current_sim_server_tag='sim-server-b3b2824f936fa12fd952033ff2874217eb5e3152'

# take output directory from first argument or default to out
output_dir="${1:-out}"

# take configuration from second argument or default to Debug
configuration=${2:-Debug}

# Get the directory where the script is located
script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Locate sim-server package
sim_server_package_dir="${script_dir}/../../simulator-server"

target_dir="${script_dir}/../${output_dir}"
target_location="${target_dir}/sim-server"

# Create the target directory if it doesn't exist
mkdir -p "$target_dir"

# simulation server submodule uninitialized?
if git submodule status | grep --quiet '^-'; then
    ./download-sim-server.sh "$target_location" "$current_sim_server_tag" "sim-server" # location, release tag, asset name
else
    # Make sure, the submodule is in the up-to-date state
    git -C $script_dir submodule update --init -- ${sim_server_package_dir}

    # execute the build from the simulator-server package
    # the build product location is printed by the build script as the very last line
    product_path=$("$sim_server_package_dir/build.sh" "$configuration" | tail -n 1)

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
fi
