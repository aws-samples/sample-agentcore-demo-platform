#!/usr/bin/env bash
# publish-app.sh — Publish or preview an app from the workspace via the platform API.
#
# Usage:
#   bash publish-app.sh \
#     --session-id <uuid> \
#     --folder <relative/path> \
#     --name "My App" \
#     [--description "..."] \
#     [--icon "🚀"] \
#     [--category "tool"] \
#     [--entry "index.html"] \
#     [--status "published"|"preview"]
#
# Environment (auto-injected by the platform):
#   API_BASE_URL  — backend API base URL
#   AUTH_TOKEN    — JWT bearer token

set -euo pipefail

SESSION_ID=""
FOLDER=""
NAME=""
DESCRIPTION=""
ICON="🚀"
CATEGORY="tool"
ENTRY=""
STATUS="published"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --session-id)  SESSION_ID="$2";  shift 2 ;;
    --folder)      FOLDER="$2";      shift 2 ;;
    --name)        NAME="$2";        shift 2 ;;
    --description) DESCRIPTION="$2"; shift 2 ;;
    --icon)        ICON="$2";        shift 2 ;;
    --category)    CATEGORY="$2";    shift 2 ;;
    --entry)       ENTRY="$2";       shift 2 ;;
    --status)      STATUS="$2";      shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$SESSION_ID" || -z "$FOLDER" || -z "$NAME" ]]; then
  echo "Error: --session-id, --folder, and --name are required" >&2
  exit 1
fi

API_BASE_URL="${API_BASE_URL:?API_BASE_URL is required}"
AUTH_TOKEN="${AUTH_TOKEN:?AUTH_TOKEN is required}"

# Build JSON payload using python for safe escaping
PAYLOAD=$(python3 -c "
import json, sys
d = {
    'session_id': '$SESSION_ID',
    'folder_path': '$FOLDER',
    'name': '''$NAME''',
    'description': '''$DESCRIPTION''',
    'icon': '$ICON',
    'category': '$CATEGORY',
    'status': '$STATUS',
}
entry = '$ENTRY'
if entry:
    d['entry_point'] = entry
print(json.dumps(d))
")

RESPONSE=$(curl -s -w "\n%{http_code}" \
  -X POST "${API_BASE_URL}/api/apps/publish-from-workspace" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AUTH_TOKEN}" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
  if [[ "$STATUS" == "preview" ]]; then
    echo "👁️ Preview ready!"
  else
    echo "✅ Published successfully!"
  fi
  echo "$BODY" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"  App ID:  {data.get('id', 'unknown')}\")
print(f\"  Name:    {data.get('name', 'unknown')}\")
print(f\"  Version: {data.get('version', '1.0.0')}\")
print(f\"  URL:     {data.get('access_url', 'unknown')}\")
if data.get('upgraded'):
    print(f\"  (Upgraded from v{data.get('previous_version', '?')})\")
"
else
  echo "❌ Publish failed (HTTP $HTTP_CODE):" >&2
  echo "$BODY" >&2
  exit 1
fi
