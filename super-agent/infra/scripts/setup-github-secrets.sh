#!/bin/bash
set -euo pipefail

# =============================================================================
# Super Agent — GitHub Secrets 配置助手
#
# 将本地 AWS Profile 中的凭证和 EC2 Key Pair 配置到 GitHub Secrets，
# 供 CI/CD Pipeline 使用。
#
# 前置条件：
#   - gh CLI 已安装并登录（gh auth login）
#   - AWS CLI 已配置好 Profile
#   - EC2 Key Pair 的私钥文件在本地
#
# Usage:
#   ./setup-github-secrets.sh <SSH_KEY_PATH> [options]
#
# Options:
#   --profile <name>    AWS CLI profile (default: default)
#   --repo <owner/repo> GitHub repo (default: auto-detect from git remote)
# =============================================================================

SSH_KEY="${1:?Usage: ./setup-github-secrets.sh <SSH_KEY_PATH> [--profile <name>] [--repo <owner/repo>]}"
shift

AWS_PROFILE="default"
GITHUB_REPO="vorale/super-agent"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --profile) AWS_PROFILE="$2"; shift 2 ;;
    --repo)    GITHUB_REPO="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# Auto-detect GitHub repo from git remote
if [ -z "$GITHUB_REPO" ]; then
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
  if [ -z "$REMOTE_URL" ]; then
    echo "ERROR: Cannot detect GitHub repo. Use --repo owner/repo"
    exit 1
  fi
  # Extract owner/repo from SSH or HTTPS URL
  GITHUB_REPO=$(echo "$REMOTE_URL" | sed -E 's|.*github\.com[:/](.+/.+?)(\.git)?$|\1|')
  echo "Detected repo: $GITHUB_REPO"
fi

# Validate SSH key exists
if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: SSH key not found: $SSH_KEY"
  exit 1
fi

# Extract Key Pair name from filename (e.g., my-key.pem → my-key)
KEY_PAIR_NAME=$(basename "$SSH_KEY" .pem)

echo "============================================="
echo "  GitHub Secrets Setup"
echo "  Repo:     $GITHUB_REPO"
echo "  Profile:  $AWS_PROFILE"
echo "  Key Pair: $KEY_PAIR_NAME"
echo "============================================="
echo ""

# Read AWS credentials from profile
AWS_ACCESS_KEY_ID=$(aws configure get aws_access_key_id --profile "$AWS_PROFILE" 2>/dev/null || echo "")
AWS_SECRET_ACCESS_KEY=$(aws configure get aws_secret_access_key --profile "$AWS_PROFILE" 2>/dev/null || echo "")

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "ERROR: Cannot read AWS credentials from profile '$AWS_PROFILE'"
  echo "Run: aws configure --profile $AWS_PROFILE"
  exit 1
fi

echo "Setting GitHub Secrets..."

# Set secrets using gh CLI
gh secret set AWS_ACCESS_KEY_ID \
  --repo "$GITHUB_REPO" \
  --body "$AWS_ACCESS_KEY_ID"
echo "  ✅ AWS_ACCESS_KEY_ID"

gh secret set AWS_SECRET_ACCESS_KEY \
  --repo "$GITHUB_REPO" \
  --body "$AWS_SECRET_ACCESS_KEY"
echo "  ✅ AWS_SECRET_ACCESS_KEY"

gh secret set EC2_KEY_PAIR_NAME \
  --repo "$GITHUB_REPO" \
  --body "$KEY_PAIR_NAME"
echo "  ✅ EC2_KEY_PAIR_NAME"

gh secret set EC2_SSH_PRIVATE_KEY \
  --repo "$GITHUB_REPO" \
  < "$SSH_KEY"
echo "  ✅ EC2_SSH_PRIVATE_KEY"

echo ""
echo "============================================="
echo "  Done! Secrets configured:"
echo "    - AWS_ACCESS_KEY_ID"
echo "    - AWS_SECRET_ACCESS_KEY"
echo "    - EC2_KEY_PAIR_NAME"
echo "    - EC2_SSH_PRIVATE_KEY"
echo ""
echo "  Pipeline 使用独立的 Stack 名称 'SuperAgentTest'，"
echo "  所有资源（RDS、Redis、S3、EC2）与生产环境完全隔离。"
echo ""
echo "  触发方式："
echo "    - push 到 main 分支自动触发"
echo "    - GitHub Actions 页面手动触发（可选择跳过某些阶段）"
echo "============================================="
