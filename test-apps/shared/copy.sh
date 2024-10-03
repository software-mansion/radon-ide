#!/usr/bin/env bash

# See the docs in development.md for more information.
if [[ $# -ne 2 || ("$1" != "bare" && "$1" != "expo-router") ]]; then
    echo "Copies shared code to a destination directory. Shared code has navigation directory, integrating with expo-router. To copy it, use 'expo-router' as the first argument. Otherwise, use 'bare'."
    echo "Example: ./copy.sh expo-router /src/shared"
    echo ""
    echo "Usage: $0 {bare | expo-router} <destination>"
    exit 1
fi

mode="$1"
destination="$2"
script_dir=$(dirname "$0")

rm -rf "$destination"
mkdir "$destination"

cp -R "${script_dir}/src/" "$destination"

if [ "$mode" == "bare" ]; then
    rm -rf "${destination}/navigation"
fi
