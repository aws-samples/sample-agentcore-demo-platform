#!/bin/bash
set -euo pipefail

# =============================================================================
# Super Agent — One-Click Deploy (no interaction required)
#
# Usage:
#   ./deploy.sh                              # default: us-east-1
#   ./deploy.sh --region us-west-2           # specify region
#   ./deploy.sh --stack MyStack              # custom stack name
#   ./deploy.sh --skip-infra                 # skip CDK, redeploy app only
#   ./deploy.sh --skip-frontend              # skip frontend build
#   ./deploy.sh --skip-backend               # skip Docker builds
# =============================================================================

STACK_NAME="SuperAgent"
REGION="us-east-1"
SKIP_INFRA=false
SKIP_FRONTEND=false
SKIP_BACKEND=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region)         REGION="$2"; shift 2 ;;
    --stack)          STACK_NAME="$2"; shift 2 ;;
    --skip-infra)     SKIP_INFRA=true; shift ;;
    --skip-frontend)  SKIP_FRONTEND=true; shift ;;
    --skip-backend)   SKIP_BACKEND=true; shift ;;
    *) shift ;;
  esac
done

export AWS_DEFAULT_REGION="$REGION"
export CDK_DEFAULT_REGION="$REGION"
export CDK_DEFAULT_ACCOUNT="${CDK_DEFAULT_ACCOUNT:-$(aws sts get-caller-identity --query Account --output text)}"
ACCOUNT_ID="$CDK_DEFAULT_ACCOUNT"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_ROOT="$(cd "$INFRA_DIR/.." && pwd)"
ECR_REGISTRY="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
SL="${STACK_NAME,,}"

echo "============================================="
echo "  Super Agent — One-Click Deploy"
echo "  Stack:   $STACK_NAME  Region: $REGION  Account: $ACCOUNT_ID"
echo "============================================="

# Helper: parse JSON field, empty string on failure (always returns 0)
json_field() { python3 -c "import sys,json;print(json.load(sys.stdin).get('$1',''))" 2>/dev/null <<< "$2" || echo ""; }

# Bedrock model ID: use us. prefix for US regions, global. for everywhere else
case "$REGION" in
  us-east-1|us-east-2|us-west-2) BEDROCK_MODEL="us.anthropic.claude-sonnet-4-6" ;;
  *) BEDROCK_MODEL="global.anthropic.claude-sonnet-4-6" ;;
esac
echo "  Model: $BEDROCK_MODEL"

# ---- Step 1: ECR + backend image + CDK ----
if [ "$SKIP_INFRA" = false ]; then
  echo -e "\n=== Step 1/8: ECR + Backend Image + CDK Deploy ==="
  npm install --silent --prefix "$INFRA_DIR" 2>/dev/null
  aws ecr describe-repositories --repository-names "${SL}-backend" >/dev/null 2>&1 || aws ecr create-repository --repository-name "${SL}-backend" --no-cli-pager >/dev/null
  aws ecr describe-repositories --repository-names "${SL}-agentcore" >/dev/null 2>&1 || aws ecr create-repository --repository-name "${SL}-agentcore" --no-cli-pager >/dev/null
  aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY" 2>/dev/null
  echo "  Building backend..."
  docker buildx build --platform linux/arm64 -t "$ECR_REGISTRY/${SL}-backend:latest" --load "$PROJECT_ROOT/backend" 2>&1 | tail -3
  docker push "$ECR_REGISTRY/${SL}-backend:latest" 2>&1 | tail -3
  echo "  ✓ Backend image pushed"
  echo "  CDK deploying (~15 min fresh)..."
  (cd "$INFRA_DIR" && npx cdk deploy -c stackName="$STACK_NAME" --require-approval never 2>&1) | tail -5
  echo "  ✓ CDK complete"
fi

# ---- Read stack outputs ----
echo -e "\n=== Reading stack outputs ==="
OUTPUTS=$(aws cloudformation describe-stacks --stack-name "$STACK_NAME" --query "Stacks[0].Outputs" --output json)
get() { echo "$OUTPUTS" | python3 -c "import sys,json;[print(o['OutputValue']) for o in json.load(sys.stdin) if o['OutputKey']=='$1']" 2>/dev/null; }
BACKEND_REPO=$(get BackendRepoUri); AGENTCORE_REPO=$(get AgentCoreRepoUri)
AGENTCORE_ROLE=$(get AgentCoreRoleArn); ECS_CLUSTER=$(get EcsClusterName)
ECS_SERVICE=$(get EcsServiceName); TASK_FAMILY=$(get TaskDefFamily)
DB_SECRET=$(get DBSecretArn); DB_ENDPOINT=$(get DBEndpoint)
REDIS_EP=$(get RedisEndpoint); REDIS_PORT=$(get RedisPort)
FRONTEND_BUCKET=$(get FrontendBucketName); AVATAR_BUCKET=$(get AvatarBucketName)
WORKSPACE_BUCKET=$(get WorkspaceBucketName); CF_DIST_ID=$(get CloudFrontDistId)
CF_DOMAIN=$(get CloudFrontDomain); PRIV1=$(get PrivateSubnet1)
PRIV2=$(get PrivateSubnet2); AC_SG=$(get AgentCoreSGId)
ECS_SG=$(get EcsSGId); ALB_DNS=$(get ALBDnsName)
echo "  CloudFront: https://$CF_DOMAIN"

# ---- Step 2+3: Docker images ----
if [ "$SKIP_BACKEND" = false ]; then
  echo -e "\n=== Step 2/8: Build & push backend ==="
  aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY" 2>/dev/null
  docker buildx build --platform linux/arm64 -t "$BACKEND_REPO:latest" --load "$PROJECT_ROOT/backend" 2>&1 | tail -3
  docker push "$BACKEND_REPO:latest" 2>&1 | tail -3
  echo "  ✓ Done"
  echo -e "\n=== Step 3/8: Build & push AgentCore ==="
  docker buildx build --platform linux/arm64 -t "$AGENTCORE_REPO:latest" --load "$PROJECT_ROOT/agentcore" 2>&1 | tail -3
  docker push "$AGENTCORE_REPO:latest" 2>&1 | tail -3
  echo "  ✓ Done"
fi

# ---- Step 4: AgentCore Runtime + Browser + Code Interpreter ----
# Strategy: try create. On conflict (already exists), use --max-items list.
echo -e "\n=== Step 4/8: AgentCore Runtime + Browser + Code Interpreter ==="

RT_NAME="${STACK_NAME}Runtime"; RT_ID=""; RT_ARN=""
OUT=$(aws bedrock-agentcore-control create-agent-runtime \
  --agent-runtime-name "$RT_NAME" \
  --agent-runtime-artifact '{"containerConfiguration":{"containerUri":"'"${AGENTCORE_REPO}:latest"'"}}' \
  --role-arn "$AGENTCORE_ROLE" \
  --network-configuration '{"networkMode":"VPC","networkModeConfig":{"securityGroups":["'"$AC_SG"'"],"subnets":["'"$PRIV1"'","'"$PRIV2"'"]}}' \
  --environment-variables '{"CLAUDE_CODE_USE_BEDROCK":"1","ANTHROPIC_MODEL":"'"$BEDROCK_MODEL"'","ANTHROPIC_DEFAULT_SONNET_MODEL":"'"$BEDROCK_MODEL"'","WORKSPACE_S3_REGION":"'"$REGION"'","AWS_REGION":"'"$REGION"'","AWS_DEFAULT_REGION":"'"$REGION"'"}' \
  --description "Super Agent Runtime" --no-cli-pager 2>&1) || true
RT_ID=$(json_field agentRuntimeId "$OUT")
RT_ARN=$(json_field agentRuntimeArn "$OUT")
if [ -z "$RT_ID" ]; then
  echo "  Runtime exists, finding..."
  RT_ID=$(aws bedrock-agentcore-control list-agent-runtimes --max-items 200 --output json 2>/dev/null | \
    python3 -c "import sys,json;rts=json.load(sys.stdin).get('agentRuntimes',[]);m=[r for r in rts if r['agentRuntimeName']=='$RT_NAME'];print(m[0]['agentRuntimeId'] if m else '')" 2>/dev/null || echo "")
  [ -n "$RT_ID" ] && RT_ARN=$(aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id "$RT_ID" --query agentRuntimeArn --output text 2>/dev/null || echo "")
fi
echo "  Runtime: ${RT_ID:-SKIP}"
if [ -n "$RT_ID" ]; then
  for i in $(seq 1 30); do
    S=$(aws bedrock-agentcore-control get-agent-runtime --agent-runtime-id "$RT_ID" --query status --output text 2>/dev/null || echo "?")
    [ "$S" = "READY" ] && break; [ "$i" -eq 1 ] && echo "  Waiting for READY..."; sleep 10
  done; echo "  Status: $S"
fi

BROWSER_NAME="${STACK_NAME}Browser"; BROWSER_ID=""
OUT=$(aws bedrock-agentcore-control create-browser --name "$BROWSER_NAME" --description "Web Bot Auth" \
  --execution-role-arn "$AGENTCORE_ROLE" --network-configuration '{"networkMode":"PUBLIC"}' \
  --browser-signing '{"enabled":true}' --no-cli-pager 2>&1) || true
BROWSER_ID=$(json_field browserId "$OUT")
if [ -z "$BROWSER_ID" ]; then
  BROWSER_ID=$(aws bedrock-agentcore-control list-browsers --max-items 50 --output json 2>/dev/null | \
    python3 -c "import sys,json;bs=json.load(sys.stdin).get('browserSummaries',[]);m=[b for b in bs if b['name']=='$BROWSER_NAME'];print(m[0]['browserId'] if m else '')" 2>/dev/null || echo "")
fi
echo "  Browser: ${BROWSER_ID:-SKIP}"

CI_NAME="${STACK_NAME}CodeInterpreter"; CI_ID=""
OUT=$(aws bedrock-agentcore-control create-code-interpreter --name "$CI_NAME" --description "Public internet" \
  --execution-role-arn "$AGENTCORE_ROLE" --network-configuration '{"networkMode":"PUBLIC"}' --no-cli-pager 2>&1) || true
CI_ID=$(json_field codeInterpreterId "$OUT")
if [ -z "$CI_ID" ]; then
  CI_ID=$(aws bedrock-agentcore-control list-code-interpreters --max-items 50 --output json 2>/dev/null | \
    python3 -c "import sys,json;cs=json.load(sys.stdin).get('codeInterpreterSummaries',[]);m=[c for c in cs if c['name']=='$CI_NAME'];print(m[0]['codeInterpreterId'] if m else '')" 2>/dev/null || echo "")
fi
echo "  Code Interpreter: ${CI_ID:-SKIP}"

# ---- Step 5: Update ECS task with real env vars ----
echo -e "\n=== Step 5/8: Update ECS task ==="
DB_JSON=$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET" --query SecretString --output text)
DB_USER=$(python3 -c "import json;print(json.loads('$DB_JSON')['username'])")
DB_PASS=$(python3 -c "import json;print(json.loads('$DB_JSON')['password'])")
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_ENDPOINT}:5432/super_agent"
JWT_SECRET=$(openssl rand -hex 32)
EXEC_ROLE=$(aws ecs describe-task-definition --task-definition "$TASK_FAMILY" --query taskDefinition.executionRoleArn --output text)
TASK_ROLE=$(aws ecs describe-task-definition --task-definition "$TASK_FAMILY" --query taskDefinition.taskRoleArn --output text)

cat > /tmp/sa-task.json << EOF
{"family":"$TASK_FAMILY","networkMode":"awsvpc","requiresCompatibilities":["FARGATE"],"cpu":"1024","memory":"2048",
"runtimePlatform":{"cpuArchitecture":"ARM64","operatingSystemFamily":"LINUX"},
"executionRoleArn":"$EXEC_ROLE","taskRoleArn":"$TASK_ROLE",
"containerDefinitions":[{"name":"backend","image":"$BACKEND_REPO:latest","essential":true,
"portMappings":[{"containerPort":3000}],
"environment":[
{"name":"PORT","value":"3000"},{"name":"HOST","value":"0.0.0.0"},{"name":"NODE_ENV","value":"production"},
{"name":"AWS_REGION","value":"$REGION"},{"name":"DATABASE_URL","value":"$DATABASE_URL"},
{"name":"REDIS_HOST","value":"$REDIS_EP"},{"name":"REDIS_PORT","value":"$REDIS_PORT"},
{"name":"REDIS_PASSWORD","value":""},{"name":"AUTH_MODE","value":"local"},
{"name":"JWT_SECRET","value":"$JWT_SECRET"},{"name":"S3_BUCKET_NAME","value":"$AVATAR_BUCKET"},
{"name":"S3_PRESIGNED_URL_EXPIRES","value":"3600"},{"name":"CLAUDE_CODE_USE_BEDROCK","value":"1"},
{"name":"CLAUDE_MODEL","value":"claude-sonnet-4-6"},{"name":"AGENT_RUNTIME","value":"agentcore"},
{"name":"AGENTCORE_WORKSPACE_S3_BUCKET","value":"$WORKSPACE_BUCKET"},
{"name":"AGENTCORE_RUNTIME_ARN","value":"${RT_ARN:-}"},
{"name":"AGENTCORE_EXECUTION_ROLE_ARN","value":"$AGENTCORE_ROLE"},
{"name":"AGENTCORE_BROWSER_ID","value":"${BROWSER_ID:-}"},
{"name":"AGENTCORE_CODE_INTERPRETER_ID","value":"${CI_ID:-}"},
{"name":"CORS_ORIGIN","value":"https://$CF_DOMAIN"},{"name":"APP_URL","value":"https://$CF_DOMAIN"},
{"name":"LOG_LEVEL","value":"info"}],
"logConfiguration":{"logDriver":"awslogs","options":{"awslogs-group":"/super-agent/$STACK_NAME/backend","awslogs-region":"$REGION","awslogs-stream-prefix":"ecs"}},
"healthCheck":{"command":["CMD-SHELL","curl -f http://localhost:3000/health || exit 1"],"interval":30,"timeout":10,"retries":3,"startPeriod":120}}]}
EOF
NEW_TASK=$(aws ecs register-task-definition --cli-input-json file:///tmp/sa-task.json --query taskDefinition.taskDefinitionArn --output text --no-cli-pager)
aws ecs update-service --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --task-definition "$NEW_TASK" --desired-count 1 --force-new-deployment --no-cli-pager >/dev/null
echo "  ✓ ECS updated"

# ---- Step 6: DB migration + seed ----
echo -e "\n=== Step 6/8: DB migration + seed ==="
cat > /tmp/sa-seed.json << EOF
{"family":"${TASK_FAMILY}-seed","networkMode":"awsvpc","requiresCompatibilities":["FARGATE"],"cpu":"512","memory":"1024",
"runtimePlatform":{"cpuArchitecture":"ARM64","operatingSystemFamily":"LINUX"},
"executionRoleArn":"$EXEC_ROLE","taskRoleArn":"$TASK_ROLE",
"containerDefinitions":[{"name":"seed","image":"$BACKEND_REPO:latest","essential":true,
"command":["sh","-c","npx prisma migrate deploy && npx tsx prisma/seed.ts && npx tsx prisma/seed-local-auth.ts"],
"environment":[{"name":"DATABASE_URL","value":"$DATABASE_URL"},{"name":"NODE_ENV","value":"production"}],
"logConfiguration":{"logDriver":"awslogs","options":{"awslogs-group":"/super-agent/$STACK_NAME/backend","awslogs-region":"$REGION","awslogs-stream-prefix":"seed"}}}]}
EOF
SEED_DEF=$(aws ecs register-task-definition --cli-input-json file:///tmp/sa-seed.json --query taskDefinition.taskDefinitionArn --output text --no-cli-pager)
SEED_ARN=$(aws ecs run-task --cluster "$ECS_CLUSTER" --task-definition "$SEED_DEF" --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIV1,$PRIV2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --no-cli-pager | python3 -c "import sys,json;print(json.load(sys.stdin)['tasks'][0]['taskArn'])")
echo "  Seed running..."
aws ecs wait tasks-stopped --cluster "$ECS_CLUSTER" --tasks "$SEED_ARN"
EXIT=$(aws ecs describe-tasks --cluster "$ECS_CLUSTER" --tasks "$SEED_ARN" --query "tasks[0].containers[0].exitCode" --output text)
[ "$EXIT" = "0" ] && echo "  ✓ Migration + seed OK" || echo "  ⚠ Seed exit: $EXIT"

# ---- Step 7: Frontend ----
if [ "$SKIP_FRONTEND" = false ]; then
  echo -e "\n=== Step 7/8: Frontend ==="
  FD=""; [ -d "$PROJECT_ROOT/frontend" ] && FD="$PROJECT_ROOT/frontend"; [ -d "$PROJECT_ROOT/super-agent-platform" ] && FD="$PROJECT_ROOT/super-agent-platform"
  if [ -n "$FD" ]; then
    printf "VITE_API_BASE_URL=\nVITE_AUTH_MODE=local\n" > "$FD/.env.production"
    (cd "$FD" && npm install --silent 2>/dev/null && npx vite build 2>&1 | tail -3)
    aws s3 sync "$FD/dist/" "s3://$FRONTEND_BUCKET/" --delete --quiet
    aws cloudfront create-invalidation --distribution-id "$CF_DIST_ID" --paths "/*" --no-cli-pager >/dev/null 2>&1
    echo "  ✓ Frontend deployed"
  else echo "  ⚠ No frontend dir found"; fi
fi

# ---- Step 8: Wait + verify ----
echo -e "\n=== Step 8/8: Stabilize ==="
aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" 2>/dev/null && echo "  ✓ Backend stable" || echo "  ⚠ Still starting"
sleep 5
curl -sf "http://$ALB_DNS/health" >/dev/null 2>&1 && echo "  ✓ Health OK" || echo "  ⚠ Health pending"

echo -e "\n============================================="
echo "  ✅ Deployment Complete!"
echo "  App:              https://$CF_DOMAIN"
echo "  Login:            admin@example.com / admin123"
echo "  AgentCore:        ${RT_ID:-n/a}"
echo "  Browser:          ${BROWSER_ID:-n/a}"
echo "  Code Interpreter: ${CI_ID:-n/a}"
echo "  Region:           $REGION"
echo "============================================="
