#!/usr/bin/env bash

if [[ $# -ne 2 || ("$1" != "bare" && "$1" != "expo-router") ]]; then
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
