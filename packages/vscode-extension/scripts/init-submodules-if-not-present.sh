#!/bin/bash

# Accepts multiple submodules, initializing them if they are empty.

for dir in "$@"; do
    if [ -z "$(ls -A "$dir")" ]; then
        echo "Submodule $(basename "$dir") is empty. Initializing..."
        git submodule update --init "$dir"
    else
        echo "Submodule $(basename "$dir") is not empty. Skipping initialization."
    fi
done
