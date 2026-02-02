#!/bin/bash
set -e

# Install aMule daemon
echo "Installing aMule daemon..."
sudo apt-get update
sudo apt-get install -y amule-daemon amule-utils

# Create configuration directory if not exists
mkdir -p ~/.aMule

# Define the password hash for 'secret'
# echo -n 'secret' | md5sum -> 5ebe2294ecd0e0f08eab7690d2a6ee69
EC_PASSWORD_HASH="5ebe2294ecd0e0f08eab7690d2a6ee69"
# Define the port for External Connections
PORT=4712

CONFIG_FILE=~/.aMule/amule.conf

# Ensure config exists for robust editing
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Config file not found. Running amuled briefly to generate defaults..."
    
    # Start amuled in background
    amuled &
    AMULE_PID=$!
    
    # Wait for config file creation
    TIMEOUT=30
    COUNTER=0
    while [ ! -f "$CONFIG_FILE" ]; do
        sleep 1
        COUNTER=$((COUNTER+1))
        if [ $COUNTER -ge $TIMEOUT ]; then
            echo "Timed out waiting for amule.conf creation."
            kill $AMULE_PID
            exit 1
        fi
    done
    
    echo "Config file detected."
    # Wait a bit more for it to finish writing
    sleep 2
    
    echo "Stopping initial amuled process..."
    kill $AMULE_PID 2>/dev/null || true
    # Also ensure any amuled instance is killed (it might have forked)
    pkill -x amuled || true
    wait $AMULE_PID 2>/dev/null || true
fi

echo "Configuring EC in amule.conf..."

# Helper function to set or replace config value
set_config() {
    local key=$1
    local value=$2
    local file=$3
    
    if grep -q "^$key=" "$file"; then
        sed -i "s|^$key=.*|$key=$value|" "$file"
    else
        # If key doesn't exist, we should add it.
        # Ideally into [ExternalConnect] section.
        if grep -q "\[ExternalConnect\]" "$file"; then
            sed -i "/\[ExternalConnect\]/a $key=$value" "$file"
        else
            echo "Warning: [ExternalConnect] section not found. Appending to end."
            echo "$key=$value" >> "$file"
        fi
    fi
}

# 1. Enable External Connections
set_config "AcceptExternalConnections" "1" "$CONFIG_FILE"

# 2. Set EC Password
set_config "ECPassword" "$EC_PASSWORD_HASH" "$CONFIG_FILE"

# 3. Set EC Port (optional, default is 4712)
set_config "ECPort" "$PORT" "$CONFIG_FILE"

echo "Configuration updated."
echo "EC Password set to: secret"

# Check if amuled is already running
if pgrep amuled > /dev/null; then
    echo "Stopping running amuled..."
    pkill amuled
    sleep 2
fi

echo "Starting amuled in the background..."
amuled -f

echo "Waiting for amuled to initialize..."
sleep 5

echo "Checking if aMule EC is listening on port $PORT..."
if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
    echo "SUCCESS: aMule daemon is listening on port $PORT."
    echo "You can now run the test script."
    echo "Example: npx ts-node test/examples/async-search.ts"
else
    echo "WARNING: Port $PORT not detected immediately."
    echo "Checking process status:"
    ps aux | grep amuled || true
    echo "Check logs at ~/.aMule/logfile"
fi
