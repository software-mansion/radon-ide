#!/usr/bin/env bash

# Script to download simulation server asset file from tag release using GitHub API v3
# See: http://stackoverflow.com/a/35688093/55075    
# Source .env and validate token is present
[ -f .env ] && set -o allexport && source .env && set +o allexport
[ "$GITHUB_API_TOKEN" ] || { echo "Error: Please define GITHUB_API_TOKEN variable." >&2; exit 1; }

# Define variables
TARGET_LOCATION="$1"
TAG="$2"
ASSET_NAME="$3"

GH_API='https://api.github.com'
GH_REPO="$GH_API/repos/software-mansion-labs/react-native-ide"
GH_TAGS="$GH_REPO/releases/tags/$TAG"
AUTH="Authorization: Bearer $GITHUB_API_TOKEN"
CURL_ARGS='-LJO#'

# Validate token
curl -f -o /dev/null -sH "$AUTH" $GH_REPO || { echo "Error: Invalid repo, token or network issue!" >&2; exit 1; }
# Read asset tags
response=$(curl -sH "$AUTH" $GH_TAGS)
# Get ID of the asset based on given name
eval $(echo "$response" | grep -C3 "name.:.\+$ASSET_NAME" | grep -w id | tr : = | tr -cd '[[:alnum:]]=')
[ "$id" ] || { echo "Error: Failed to get asset id, response: $response" | awk 'length($0)<100' >&2; exit 1; }
GH_ASSET="$GH_REPO/releases/assets/$id"

# Download asset file
curl $CURL_ARGS -H "$AUTH" -H 'Accept: application/octet-stream' --output "$TARGET_LOCATION" "$GH_ASSET"
