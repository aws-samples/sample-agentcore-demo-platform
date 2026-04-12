#!/bin/bash
set -euo pipefail

# =============================================================================
# Super Agent — Full Teardown (all resources including AgentCore + ECR)
#
# Usage:
#   ./destroy.sh                              # default: us-east-1, stack SuperAgent
#   ./destroy.sh --region ap-southeast-1 --stack SuperAgentSG
# =============================================================================

STACK_NAME="SuperAgent"
REGION="us-east-1"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region) REGION="$2"; shift 2 ;;
    --stack)  STACK_NAME="$2"; shift 2 ;;
    *) shift ;;
  esac
done

export AWS_DEFAULT_REGION="$REGION"
export CDK_DEFAULT_REGION="$REGION"
SL="${STACK_NAME,,}"

echo "============================================="
echo "  Destroying: $STACK_NAME in $REGION"
echo "============================================="

# Helper
json_field() { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))" 2>/dev/null <<< "$2" || echo ""; }

# 1. Delete AgentCore Runtime
echo -e "\n=== AgentCore Runtime ==="
RT_ID=$(aws bedrock-agentcore-control list-agent-runtimes --max-items 200 --output json 2>/dev/null | \
  python3 -c "import sys,json;rts=json.load(sys.stdin).get('agentRuntimes',[]);m=[r for r in rts if r['agentRuntimeName']=='${STACK_NAME}Runtime'];print(m[0]['agentRuntimeId'] if m else '')" 2>/dev/null || echo "")
if [ -n "$RT_ID" ]; then
  aws bedrock-agentcore-control delete-agent-runtime --agent-runtime-id "$RT_ID" --no-cli-pager 2>/dev/null || true
  echo "  Deleted runtime: $RT_ID"
else
  echo "  No runtime found"
fi

# 2. Delete Browser
echo -e "\n=== Browser ==="
BR_ID=$(aws bedrock-agentcore-control list-browsers --max-items 50 --output json 2>/dev/null | \
  python3 -c "import sys,json;bs=json.load(sys.stdin).get('browserSummaries',[]);m=[b for b in bs if b['name']=='${STACK_NAME}Browser'];print(m[0]['browserId'] if m else '')" 2>/dev/null || echo "")
if [ -n "$BR_ID" ]; then
  aws bedrock-agentcore-control delete-browser --browser-id "$BR_ID" --no-cli-pager 2>/dev/null || true
  echo "  Deleted browser: $BR_ID"
else
  echo "  No browser found"
fi

# 3. Delete Code Interpreter
echo -e "\n=== Code Interpreter ==="
CI_ID=$(aws bedrock-agentcore-control list-code-interpreters --max-items 50 --output json 2>/dev/null | \
  python3 -c "import sys,json;cs=json.load(sys.stdin).get('codeInterpreterSummaries',[]);m=[c for c in cs if c['name']=='${STACK_NAME}CodeInterpreter'];print(m[0]['codeInterpreterId'] if m else '')" 2>/dev/null || echo "")
if [ -n "$CI_ID" ]; then
  aws bedrock-agentcore-control delete-code-interpreter --code-interpreter-id "$CI_ID" --no-cli-pager 2>/dev/null || true
  echo "  Deleted code interpreter: $CI_ID"
else
  echo "  No code interpreter found"
fi

# 4. CDK destroy
echo -e "\n=== CDK Stack ==="
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
(cd "$INFRA_DIR" && npx cdk destroy -c stackName="$STACK_NAME" --force 2>&1) || true
echo "  ✓ CDK stack destroyed"

# 5. Delete ECR repos
echo -e "\n=== ECR Repos ==="
aws ecr delete-repository --repository-name "${SL}-backend" --force --no-cli-pager 2>/dev/null && echo "  Deleted ${SL}-backend" || echo "  ${SL}-backend not found"
aws ecr delete-repository --repository-name "${SL}-agentcore" --force --no-cli-pager 2>/dev/null && echo "  Deleted ${SL}-agentcore" || echo "  ${SL}-agentcore not found"

echo -e "\n============================================="
echo "  ✅ All resources destroyed"
echo "============================================="
