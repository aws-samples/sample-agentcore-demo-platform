#!/bin/bash
set -euo pipefail
# Backend deploy script — runs on EC2 via CI/CD pipeline.
# Expects /opt/super-agent/.env and /opt/super-agent/backend/ to be ready.

cd /opt/super-agent/backend
ln -sf /opt/super-agent/.env .env

echo "npm ci..."
npm ci --production=false

echo "prisma generate..."
npx prisma generate

echo "DB grants..."
# Ensure psql is available
if ! command -v psql &>/dev/null; then
  echo "psql not found, installing postgresql-client..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq postgresql-client || true
fi
# Extract DATABASE_URL safely (avoid sourcing .env which can fail with special chars)
DATABASE_URL=$(grep '^DATABASE_URL=' /opt/super-agent/.env | head -1 | cut -d= -f2-)
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not found in /opt/super-agent/.env"
  exit 1
fi
PSQL_URL=$(echo "$DATABASE_URL" | sed 's/?.*//')
PSQL_URL="${PSQL_URL}?sslmode=require"
psql "$PSQL_URL" -c "GRANT ALL PRIVILEGES ON DATABASE super_agent TO superagent;"
psql "$PSQL_URL" -c "GRANT ALL ON SCHEMA public TO superagent;"
psql "$PSQL_URL" -c "ALTER SCHEMA public OWNER TO superagent;"
psql "$PSQL_URL" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO superagent;"
psql "$PSQL_URL" -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO superagent;"
psql "$PSQL_URL" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO superagent;"
psql "$PSQL_URL" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO superagent;"

echo "prisma migrate deploy..."
npx prisma migrate deploy

echo "Seeding..."
AGENT_COUNT=$(psql "$PSQL_URL" -t -A -c "SELECT count(*) FROM agents;" 2>/dev/null || echo "0")
if [ "$AGENT_COUNT" -gt "0" ] 2>/dev/null; then
  echo "(Seed skipped: $AGENT_COUNT agents exist)"
else
  npx tsx prisma/seed.ts 2>/dev/null || echo "(Seed failed or already seeded)"

  # Set default password for seed admin user
  echo "Setting admin password..."
  ADMIN_HASH=$(node -e 'require("bcryptjs").hash("Admin1234!", 10).then(h => process.stdout.write(h))')
  psql "$PSQL_URL" -c "UPDATE profiles SET password_hash = '${ADMIN_HASH}' WHERE username = 'admin@example.com' AND password_hash IS NULL;"
  echo "Admin login: admin@example.com / Admin1234!"
fi

# ── Ensure Nginx is installed and configured ──
if ! command -v nginx &>/dev/null; then
  echo "Nginx not found, installing..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq nginx
fi

if [ ! -f /etc/nginx/sites-available/super-agent ]; then
  echo "Configuring Nginx..."
  sudo mkdir -p /etc/nginx/ssl
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/selfsigned.key \
    -out /etc/nginx/ssl/selfsigned.crt \
    -subj "/CN=super-agent" 2>/dev/null

  sudo tee /etc/nginx/sites-available/super-agent > /dev/null <<'NGINX_CONF'
server {
    listen 80 default_server;
    server_name _;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 50M;
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        client_max_body_size 50M;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl default_server;
    server_name _;

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1000;

    root /opt/super-agent/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
        client_max_body_size 50M;
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        client_max_body_size 50M;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX_CONF

  sudo ln -sf /etc/nginx/sites-available/super-agent /etc/nginx/sites-enabled/super-agent
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo nginx -t
fi
sudo systemctl restart nginx
sudo systemctl enable nginx

# ── Ensure backend systemd service exists ──
echo "Restarting backend..."
if ! systemctl cat backend.service &>/dev/null 2>&1; then
  echo "Creating backend.service..."
  sudo mkdir -p /opt/super-agent/logs
  sudo chown ubuntu:ubuntu /opt/super-agent/logs
  sudo tee /etc/systemd/system/backend.service > /dev/null <<'SERVICE'
[Unit]
Description=Super Agent Backend
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/super-agent/backend
EnvironmentFile=/opt/super-agent/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=append:/opt/super-agent/logs/backend.log
StandardError=append:/opt/super-agent/logs/backend-error.log

[Install]
WantedBy=multi-user.target
SERVICE
  sudo systemctl daemon-reload
fi
sudo systemctl restart backend
sudo systemctl enable backend
sleep 3
sudo systemctl status backend --no-pager || true
sudo systemctl status nginx --no-pager || true
echo "Deploy complete."
