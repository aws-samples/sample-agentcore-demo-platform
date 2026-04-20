#!/bin/bash
set -euo pipefail

# =============================================================================
# LiteLLM Model Service Gateway — Setup Script
#
# Installs and configures LiteLLM as a unified model routing gateway.
# Run on EC2 via SSM or SSH. Idempotent — safe to re-run.
#
# What it does:
#   1. Creates Python venv + installs litellm[proxy] and prisma
#   2. Writes config.yaml (model definitions)
#   3. Creates .env (API keys, DB URL — preserves existing)
#   4. Sets up systemd service with SERVER_ROOT_PATH=/modelservice
#   5. Adds Nginx reverse proxy for /modelservice/
#   6. Initializes Prisma database schema (for UI auth/usage tracking)
#
# Prerequisites:
#   - python3, python3-venv installed
#   - /opt/super-agent/.env exists with DATABASE_URL (for deriving litellm DB)
#   - Nginx installed with /etc/nginx/sites-available/super-agent
#
# Usage:
#   bash setup-litellm.sh
#   LITELLM_MASTER_KEY=sk-xxx bash setup-litellm.sh
# =============================================================================

MASTER_KEY="${LITELLM_MASTER_KEY:-sk-CHANGE-ME-GENERATE-A-REAL-KEY}"

echo ">>> [1/7] Installing LiteLLM..."
mkdir -p /opt/litellm

if [ ! -d /opt/litellm-env ]; then
  python3 -m venv /opt/litellm-env
fi

/opt/litellm-env/bin/pip install -q "litellm[proxy]" prisma
echo ">>> LiteLLM and prisma installed"

# =========================================================================
# [2/7] LiteLLM config.yaml
# =========================================================================
echo ">>> [2/7] Writing config.yaml..."

cat > /opt/litellm/config.yaml << 'EOF'
model_list:
  # -----------------------------------------------------------------------
  # Kimi K2.5 (Moonshot) — native Anthropic Messages API
  # -----------------------------------------------------------------------
  - model_name: kimi-k2.5
    litellm_params:
      model: anthropic/kimi-k2.5
      api_key: os.environ/KIMI_API_KEY
      api_base: https://api.kimi.com/coding

  # -----------------------------------------------------------------------
  # GLM 5.1 (Zhipu Z.ai) — native Anthropic Messages API
  # -----------------------------------------------------------------------
  - model_name: glm-5.1
    litellm_params:
      model: anthropic/glm-5.1
      api_key: os.environ/ZAI_API_KEY
      api_base: https://api.z.ai/api/anthropic

  - model_name: glm-5-turbo
    litellm_params:
      model: anthropic/glm-5-turbo
      api_key: os.environ/ZAI_API_KEY
      api_base: https://api.z.ai/api/anthropic

  # -----------------------------------------------------------------------
  # Claude via AWS Bedrock (uses EC2 instance role credentials)
  # -----------------------------------------------------------------------
  - model_name: claude-sonnet
    litellm_params:
      model: bedrock/us.anthropic.claude-sonnet-4-20250514-v1:0

  - model_name: claude-opus
    litellm_params:
      model: bedrock/us.anthropic.claude-opus-4-6-v1

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY

litellm_settings:
  request_timeout: 600
  drop_params: true
EOF

# =========================================================================
# [3/7] Environment file (preserves existing keys on re-run)
# =========================================================================
echo ">>> [3/7] Configuring .env..."

# Derive LiteLLM DATABASE_URL from super-agent's DATABASE_URL
LITELLM_DB_URL=""
if [ -f /opt/super-agent/.env ]; then
  SA_DB_URL=$(grep ^DATABASE_URL /opt/super-agent/.env | cut -d= -f2- || true)
  if [ -n "$SA_DB_URL" ]; then
    # Replace database name: /super_agent → /litellm, strip query params, add sslmode
    PSQL_BASE=$(echo "$SA_DB_URL" | cut -d'?' -f1)
    HOST_PART=$(echo "$PSQL_BASE" | sed 's|/[^/]*$||')
    LITELLM_DB_URL="${HOST_PART}/litellm?sslmode=no-verify"

    # Create litellm database if it doesn't exist
    echo ">>> Creating litellm database (if not exists)..."
    psql "$PSQL_BASE" -c "CREATE DATABASE litellm;" 2>/dev/null || echo "    (database already exists)"
  fi
fi

if [ ! -f /opt/litellm/.env ]; then
  cat > /opt/litellm/.env << ENVEOF
LITELLM_MASTER_KEY=${MASTER_KEY}
KIMI_API_KEY=CHANGE_ME
ZAI_API_KEY=CHANGE_ME
AWS_REGION=us-west-2
SERVER_ROOT_PATH=/modelservice
DATABASE_URL=${LITELLM_DB_URL}
ENVEOF
  chmod 600 /opt/litellm/.env
  echo ">>> .env created (edit KIMI_API_KEY and ZAI_API_KEY!)"
else
  # Ensure SERVER_ROOT_PATH and DATABASE_URL are present
  grep -q '^SERVER_ROOT_PATH=' /opt/litellm/.env || echo "SERVER_ROOT_PATH=/modelservice" >> /opt/litellm/.env
  if [ -n "$LITELLM_DB_URL" ]; then
    if grep -q '^DATABASE_URL=' /opt/litellm/.env; then
      sed -i "s|^DATABASE_URL=.*|DATABASE_URL=${LITELLM_DB_URL}|" /opt/litellm/.env
    else
      echo "DATABASE_URL=${LITELLM_DB_URL}" >> /opt/litellm/.env
    fi
  fi
  echo ">>> .env already exists, preserved existing keys"
fi

# =========================================================================
# [4/7] Prisma schema push (initialize DB tables)
# =========================================================================
echo ">>> [4/7] Initializing database schema..."

if [ -n "$LITELLM_DB_URL" ]; then
  SCHEMA_PATH=$(/opt/litellm-env/bin/python3 -c "
import litellm, os
print(os.path.join(os.path.dirname(litellm.__file__), 'proxy', 'schema.prisma'))
" 2>/dev/null || echo "")

  if [ -n "$SCHEMA_PATH" ] && [ -f "$SCHEMA_PATH" ]; then
    export DATABASE_URL="$LITELLM_DB_URL"
    export PATH="/opt/litellm-env/bin:$PATH"
    cd /opt/litellm-env
    /opt/litellm-env/bin/prisma db push --schema="$SCHEMA_PATH" --accept-data-loss --skip-generate 2>/dev/null || echo "    (schema push failed, will retry on next run)"
    /opt/litellm-env/bin/prisma generate --schema="$SCHEMA_PATH" 2>/dev/null || echo "    (prisma generate failed, non-critical)"
    echo ">>> Database schema initialized"
  else
    echo ">>> WARNING: Could not find LiteLLM prisma schema, skipping DB init"
  fi
else
  echo ">>> WARNING: No DATABASE_URL available, skipping DB init (UI login will not work)"
fi

# =========================================================================
# [5/7] Systemd service
# =========================================================================
echo ">>> [5/7] Configuring systemd service..."

cat > /etc/systemd/system/litellm.service << 'EOF'
[Unit]
Description=LiteLLM Proxy - Model Service Gateway
After=network.target

[Service]
Type=simple
User=root
EnvironmentFile=/opt/litellm/.env
ExecStart=/opt/litellm-env/bin/litellm --config /opt/litellm/config.yaml --host 127.0.0.1 --port 4000
Restart=always
RestartSec=5
StandardOutput=append:/opt/super-agent/logs/litellm.log
StandardError=append:/opt/super-agent/logs/litellm-error.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable litellm
systemctl restart litellm
echo ">>> LiteLLM service started on 127.0.0.1:4000"

# =========================================================================
# [6/7] Nginx — add /modelservice/ location block
#
# SERVER_ROOT_PATH=/modelservice makes LiteLLM serve everything under
# /modelservice/ natively (API, UI, static assets). No rewrite needed.
# =========================================================================
echo ">>> [6/7] Configuring Nginx..."

NGINX_CONF="/etc/nginx/sites-available/super-agent"

if grep -q 'location /modelservice/' "$NGINX_CONF"; then
  echo ">>> Nginx /modelservice/ already configured, skipping"
else
  echo ">>> Adding /modelservice/ to Nginx config..."

  # Use Python for reliable config insertion
  python3 << 'PYEOF'
with open("/etc/nginx/sites-available/super-agent") as f:
    content = f.read()

block = """
    # LiteLLM Model Service Gateway
    location /modelservice/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        client_max_body_size 50M;
    }

"""

# Insert before each "location / {" line (covers both port 80 and 443 blocks)
content = content.replace(
    "    location / {\n        return 301",
    block + "    location / {\n        return 301"
)
content = content.replace(
    "    location / {\n        try_files",
    block + "    location / {\n        try_files"
)

with open("/etc/nginx/sites-available/super-agent", "w") as f:
    f.write(content)

print("Nginx config updated")
PYEOF

  nginx -t && systemctl reload nginx
  echo ">>> Nginx reloaded with /modelservice/ proxy"
fi

# =========================================================================
# [7/7] Verify
# =========================================================================
echo ">>> [7/7] Verifying..."
sleep 5

HEALTH=$(curl -s http://127.0.0.1:4000/modelservice/health \
  -H "Authorization: Bearer ${MASTER_KEY}" 2>/dev/null || echo "STARTUP_PENDING")

if echo "$HEALTH" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    h = d.get('healthy_count', 0)
    u = d.get('unhealthy_count', 0)
    print('healthy=' + str(h) + ' unhealthy=' + str(u))
except:
    print('still starting up')
" 2>/dev/null; then
  true
else
  echo "(LiteLLM still starting up, check logs: /opt/super-agent/logs/litellm.log)"
fi

echo ""
echo "============================================="
echo "  LiteLLM Model Service Gateway deployed!"
echo "============================================="
echo "  Internal:  http://127.0.0.1:4000/modelservice/"
echo "  External:  https://<your-domain>/modelservice/"
echo "  UI:        https://<your-domain>/modelservice/ui/"
echo "  Master Key: ${MASTER_KEY}"
echo "  Config:    /opt/litellm/config.yaml"
echo "  Env:       /opt/litellm/.env"
echo "  Logs:      /opt/super-agent/logs/litellm.log"
echo ""
echo "  NEXT STEPS:"
echo "  1. Edit /opt/litellm/.env — set KIMI_API_KEY and ZAI_API_KEY"
echo "  2. sudo systemctl restart litellm"
echo "  3. Add CloudFront behavior: /modelservice/* → EC2 origin"
echo "============================================="
