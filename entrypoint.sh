#!/bin/bash
set -e

# Generate host keys if they don't exist (first boot or fresh container)
if [ ! -f /etc/ssh/ssh_host_ed25519_key ]; then
    ssh-keygen -t ed25519 -f /etc/ssh/ssh_host_ed25519_key -N ""
fi
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
    ssh-keygen -t rsa -b 4096 -f /etc/ssh/ssh_host_rsa_key -N ""
fi

# Create the "hunter" user if it doesn't exist
if ! id -u hunter >/dev/null 2>&1; then
    useradd -m -s /bin/bash hunter
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
