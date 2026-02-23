#!/bin/sh
set -e

# Generate host keys if they don't exist (first boot or fresh container)
ssh-keygen -A

# Create the "hunter" user if it doesn't exist
if ! id -u hunter >/dev/null 2>&1; then
    adduser -D -s /bin/sh hunter
    # Set password for the hunter user
    echo "hunter:hunter-game" | chpasswd
fi

# Ensure game data directory exists and is writable
mkdir -p /app/data/players
chown -R hunter:hunter /app/data

echo "=== Hunter Game SSH Server ==="
echo "Connect with: ssh hunter@<host> (password: hunter-game)"
echo "=============================="

# Start sshd in the foreground
exec /usr/sbin/sshd -D -e
