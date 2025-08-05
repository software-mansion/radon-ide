#!/bin/bash

# settings
VM_NAME="macOS"
VM_IP="192.168.64.3"
VM_USER="test"
LOCAL_PROJECT_PATH="../../vscode-extension-tester"
REMOTE_PATH="./vscode-extension-tester"

open -a "UTM" && sleep 3 && utmctl start macOS || {
    echo "Failed to start VM '$VM_NAME'."
    exit 1
}

echo "Waiting for VM ($VM_IP)..."
until ping -c1 "$VM_IP" &>/dev/null; do
    sleep 2
done

echo "VM is up!"

echo "copying '$LOCAL_PROJECT_PATH' to VM..."
sshpass -p '123456' scp -r "$LOCAL_PROJECT_PATH" "$VM_USER@$VM_IP:/Users/$VM_USER/"

sshpass -p '123456' ssh "$VM_USER@$VM_IP" <<EOF
cd "$REMOTE_PATH"
npm install
npm run setup-run-tests
cd ..
rm -rf $REMOTE_PATH
EOF

echo "Tests completed."