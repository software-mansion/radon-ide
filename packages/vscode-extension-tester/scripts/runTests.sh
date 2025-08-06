#!/bin/bash

# Settings
VM_NAME="macOS"
VM_USER="test"
VM_PASSWORD="123456"
LOCAL_PROJECT_PATH="../../vscode-extension-tester"
REMOTE_PATH="./vscode-extension-tester"
CONFIG_PATH="$HOME/Library/Containers/com.utmapp.UTM/Data/Documents/${VM_NAME}.utm/Config.plist"

open -a "UTM" && sleep 3 && utmctl start "$VM_NAME" || {
    echo "Failed to start VM '$VM_NAME'."
    exit 1
}

# finding the VM's ip address using Mac address and arp
normalize_mac() {
    echo "$1" | awk -F: '{for(i=1;i<=NF;i++){printf "%x%s", "0x"$i, (i==NF ? "\n" : ":")}}'
}

VM_MAC=$(xmllint --xpath 'string(/plist/dict/key[.="Network"]/following-sibling::array[1]/dict[1]/key[.="MacAddress"]/following-sibling::string[1])' "$CONFIG_PATH" 2>/dev/null)

if [[ -z "$VM_MAC" ]]; then
    echo "Could not find MAC address in config. Exiting."
    exit 1
fi

VM_MAC_NORMALIZED=$(normalize_mac "$VM_MAC")

echo "VM MAC address (original): $VM_MAC"
echo "VM MAC address (normalized for arp): $VM_MAC_NORMALIZED"


echo "Waiting for VM to appear in ARP table..."
for i in {1..15}; do
    VM_IP=$(arp -a | grep -i "$VM_MAC_NORMALIZED" | awk '{print $2}' | tr -d '()')
    if [[ -n "$VM_IP" ]]; then
        echo "Found VM IP: $VM_IP"
        break
    fi
    sleep 2
done

if [[ -z "$VM_IP" ]]; then
    echo "Could not determine VM IP from ARP."
    exit 1
fi

echo "Waiting for SSH on $VM_IP..."
until nc -z "$VM_IP" 22 &>/dev/null; do
    sleep 1
done

echo "VM is ready at $VM_IP"

echo "Copying '$LOCAL_PROJECT_PATH' to VM..."
sshpass -p "$VM_PASSWORD" scp -r "$LOCAL_PROJECT_PATH" "$VM_USER@$VM_IP:/Users/$VM_USER/" || {
    echo "Failed to copy project files."
    exit 1
}

echo "Running test commands on VM..."
sshpass -p "$VM_PASSWORD" ssh "$VM_USER@$VM_IP" <<EOF
cd "$REMOTE_PATH"
npm install
npm run setup-run-tests
cd ..
rm -rf "$REMOTE_PATH"
EOF

echo "Tests completed."
