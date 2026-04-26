#!/bin/bash
set -euo pipefail
# Merge base-env into /opt/super-agent/.env, preserving existing values.
# Called by CI/CD pipeline after scp'ing /tmp/base-env to EC2.

mkdir -p /opt/super-agent || sudo mkdir -p /opt/super-agent
sudo chown ubuntu:ubuntu /opt/super-agent 2>/dev/null || true

echo "JWT_SECRET=$(openssl rand -hex 32)" >> /tmp/base-env

if [ -f /opt/super-agent/.env ]; then
  cp /opt/super-agent/.env "/opt/super-agent/.env.bak.$(date +%s)"
  cp /opt/super-agent/.env /tmp/new-env
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ ]] && continue
    [[ -z "$line" ]] && continue
    key=$(echo "$line" | cut -d= -f1)
    if ! grep -q "^${key}=" /tmp/new-env; then
      echo "$line" >> /tmp/new-env
    fi
  done < /tmp/base-env
else
  cp /tmp/base-env /tmp/new-env
fi

mv /tmp/new-env /opt/super-agent/.env
chmod 600 /opt/super-agent/.env
rm -f /tmp/base-env
echo ".env written."
