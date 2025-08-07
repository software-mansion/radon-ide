#!/bin/bash

set -e

echo "Setting up utmctl..."
sudo ln -sf /Applications/UTM.app/Contents/MacOS/utmctl /usr/local/bin/utmctl
echo "/Applications/UTM.app/Contents/MacOS" | sudo tee /etc/paths.d/10-utm > /dev/null
echo "utmctl configured."

echo "Installing sshpass..."
brew install hudochenkov/sshpass/sshpass
echo "sshpass installed."

echo "Installing gdown with pipx..."
if ! command -v pipx &> /dev/null; then
    brew install pipx
fi

pipx ensurepath
pipx install gdown
pipx ensurepath

echo "gdown installed. You may need to restart your terminal or run:"
echo "    exec \$SHELL"
