#!/bin/sh
set -e

# Generate host keys if they don't exist (first boot or fresh container)
ssh-keygen -A

# Create the "hunter" user if it doesn't exist
if ! id -u hunter >/dev/null 2>&1; then
    adduser -D -s /bin/sh hunter
    # Set empty password (allows login with just username)
    passwd -d hunter
fi

# Ensure game data directory exists and is writable
mkdir -p /app/data/players
chown -R hunter:hunter /app/data

echo "=== Hunter Game SSH Server ==="
echo "Connect with: ssh hunter@<host>"
echo "=============================="

# Start sshd in the foreground
exec /usr/sbin/sshd -D -e
