# Super Agent infra — 端到端部署指南

本文档覆盖从零开始到系统可用的完整流程，包括核心基础设施、可选 CloudFront CDN、可选 AgentCore Runtime。

## 前置条件

- AWS CLI v2 + SSM Session Manager 插件
- Node.js 22+
- Docker（如需 AgentCore）
- 一个 AWS 账号，已配置好 `aws configure`
- 一个 EC2 Key Pair（在目标 region 创建好）

## 第一部分：核心基础设施部署

### 步骤 1：CDK 部署

```bash
cd infra
npm install

# 最简部署（local auth，无 CDN）
npx cdk deploy -c stackName=SuperAgentTest \
  --parameters KeyPairName=<your-key-pair-name> \
  --region us-west-2

# 如需 Cognito 认证
npx cdk deploy -c stackName=SuperAgentTest -c authMode=cognito \
  --parameters KeyPairName=<your-key-pair-name> \
  --parameters CognitoDomainPrefix=<globally-unique-prefix> \
  --parameters AdminEmail=admin@example.com \
  --region us-west-2

# 如需 CloudFront CDN + 自定义域名
npx cdk deploy -c stackName=SuperAgentTest \
  -c enableCdn=true \
  -c domainName=app.example.com \
  -c hostedZoneId=Z0123456789ABCDEF \
  --parameters KeyPairName=<your-key-pair-name> \
  --region us-west-2
```

CDK 完成后会输出 InstanceId、PublicIP、DBSecretArn 等值。不需要手动记录，deploy.sh 会自动读取。

### 步骤 2：等待 EC2 初始化

CDK 创建的 EC2 实例需要 3-5 分钟完成 user-data 脚本（安装 Node.js、Redis、Nginx 等）。

验证 SSM 是否就绪：

```bash
aws ssm describe-instance-information \
  --filters "Key=InstanceIds,Values=<InstanceId>" \
  --region us-west-2 \
  --query "InstanceInformationList[0].PingStatus"
```

等到输出 `"Online"` 再继续。

### 步骤 3：运行部署脚本

```bash
cd infra

# 基础部署
./scripts/deploy.sh ~/Downloads/my-key.pem --stack SuperAgentTest

# 带 Cognito 密码（首次部署需要）
./scripts/deploy.sh ~/Downloads/my-key.pem --stack SuperAgentTest \
  --cognito-password 'YourSecurePass1'

# 只部署前端（后端没改）
./scripts/deploy.sh ~/Downloads/my-key.pem --stack SuperAgentTest --skip-backend

# 只部署后端（前端没改）
./scripts/deploy.sh ~/Downloads/my-key.pem --stack SuperAgentTest --skip-frontend

# 带额外 .env 覆盖
./scripts/deploy.sh ~/Downloads/my-key.pem --stack SuperAgentTest \
  --env-file ./my-overrides.env
```

deploy.sh 会自动完成：
1. 从 CloudFormation 读取所有资源 ID
2. 开 SSM 隧道
3. 生成 .env（从 Secrets Manager 拉 DATABASE_URL，合并 stack outputs）
4. 如果 EC2 上已有 .env，保留用户手动添加的变量（BEDROCK_*、AGENTCORE_* 等）
5. 构建前端 → rsync 到 EC2（如有 CloudFront 还会 S3 sync + invalidation）
6. rsync 后端 → npm ci → prisma generate → tsc → prisma migrate deploy → seed → restart

### 步骤 4：验证

浏览器访问 deploy.sh 最后输出的 App URL。

---

## 第二部分：AgentCore Runtime 部署（可选）

如果需要让 Agent 在隔离容器中运行（而非 EC2 子进程），按以下步骤操作。
这部分只需要执行一次，后续代码部署不需要重复。

### 步骤 A：创建 ECR 仓库

```bash
aws ecr create-repository \
  --repository-name super-agent-agentcore \
  --region us-west-2
```

### 步骤 B：构建并推送 Docker 镜像

```bash
# ECR 登录
aws ecr get-login-password --region us-west-2 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.us-west-2.amazonaws.com

# 构建 ARM64 镜像（AgentCore 要求 ARM64）
cd agentcore
docker buildx build --platform linux/arm64 \
  -t super-agent-agentcore:latest \
  -t <ACCOUNT_ID>.dkr.ecr.us-west-2.amazonaws.com/super-agent-agentcore:latest \
  --load .

# 推送
docker push <ACCOUNT_ID>.dkr.ecr.us-west-2.amazonaws.com/super-agent-agentcore:latest
```

> 注意：必须是 `linux/arm64`，不是 amd64。在 Apple Silicon Mac 上原生构建，秒级完成。

### 步骤 C：创建 IAM Execution Role

```bash
# Trust policy
cat << 'EOF' > /tmp/agentcore-trust-policy.json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "bedrock-agentcore.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name super-agent-agentcore-execution-role \
  --assume-role-policy-document file:///tmp/agentcore-trust-policy.json

# Permissions policy
cat << 'EOF' > /tmp/agentcore-permissions.json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "BedrockInvoke",
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
      "Resource": "*"
    },
    {
      "Sid": "ECRPull",
      "Effect": "Allow",
      "Action": ["ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage", "ecr:GetAuthorizationToken"],
      "Resource": "*"
    },
    {
      "Sid": "WorkspaceS3",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::super-agent-workspaces-<ACCOUNT_ID>",
        "arn:aws:s3:::super-agent-workspaces-<ACCOUNT_ID>/*"
      ]
    },
    {
      "Sid": "BrowserTool",
      "Effect": "Allow",
      "Action": [
        "bedrock-agentcore:CreateBrowser",
        "bedrock-agentcore:ListBrowsers",
        "bedrock-agentcore:GetBrowser",
        "bedrock-agentcore:DeleteBrowser",
        "bedrock-agentcore:StartBrowserSession",
        "bedrock-agentcore:StopBrowserSession",
        "bedrock-agentcore:GetBrowserSession",
        "bedrock-agentcore:ListBrowserSessions",
        "bedrock-agentcore:ConnectBrowserAutomationStream",
        "bedrock-agentcore:ConnectBrowserLiveViewStream",
        "bedrock-agentcore:UpdateBrowserStream"
      ],
      "Resource": "arn:aws:bedrock-agentcore:*:*:browser/*"
    },
    {
      "Sid": "CodeInterpreter",
      "Effect": "Allow",
      "Action": [
        "bedrock-agentcore:StartCodeInterpreterSession",
        "bedrock-agentcore:InvokeCodeInterpreter",
        "bedrock-agentcore:StopCodeInterpreterSession",
        "bedrock-agentcore:GetCodeInterpreterSession",
        "bedrock-agentcore:ListCodeInterpreterSessions"
      ],
      "Resource": "arn:aws:bedrock-agentcore:*:*:code-interpreter/*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name super-agent-agentcore-execution-role \
  --policy-name agentcore-permissions \
  --policy-document file:///tmp/agentcore-permissions.json
```

> S3 workspace 权限已加到 execution role 上，容器内 `restoreWorkspaceFromS3` 和 `syncWorkspaceToS3` 需要读写 workspace bucket。
> Browser Tool 和 Code Interpreter 是 AWS 托管资源，ARN 中 region 和 account 不固定（如 `us-east-1:aws:browser/aws.browser.v1`），因此 Resource 必须用 `*:*` 通配。

### 步骤 D：创建 AgentCore Runtime

```bash
aws bedrock-agentcore-control create-agent-runtime \
  --agent-runtime-name superAgentRuntime \
  --agent-runtime-artifact '{"containerConfiguration":{"containerUri":"<ACCOUNT_ID>.dkr.ecr.us-west-2.amazonaws.com/super-agent-agentcore:latest"}}' \
  --role-arn "arn:aws:iam::<ACCOUNT_ID>:role/super-agent-agentcore-execution-role" \
  --network-configuration '{"networkMode":"PUBLIC"}' \
  --environment-variables '{
    "CLAUDE_CODE_USE_BEDROCK":"1",
    "ANTHROPIC_MODEL":"us.anthropic.claude-opus-4-6-v1",
    "AWS_ACCESS_KEY_ID":"<your-bedrock-access-key>",
    "AWS_SECRET_ACCESS_KEY":"<your-bedrock-secret-key>",
    "AWS_REGION":"us-west-2",
    "WORKSPACE_S3_REGION":"us-east-1"
  }' \
  --description "Super Agent AgentCore Runtime" \
  --region us-west-2
```

> 踩坑提醒：
> - Runtime 名称只允许 `[a-zA-Z][a-zA-Z0-9_]{0,47}`，不能有连字符
> - 如果 Bedrock 模型在另一个账号，通过 `--environment-variables` 注入那个账号的 AK/SK
> - 如果 Bedrock 在同一个账号，可以不传 AK/SK，让 Execution Role 直接调用

记下输出中的 `agentRuntimeArn`，下一步要用。

等待 Runtime 就绪：

```bash
aws bedrock-agentcore-control get-agent-runtime \
  --agent-runtime-id <runtime-id> \
  --region us-west-2 \
  --query 'status' --output text
# 等到输出 READY
```

### 步骤 E：更新 EC2 .env 启用 AgentCore

准备一个 override 文件：

```bash
cat > agentcore-overrides.env << EOF
AGENT_RUNTIME=agentcore
AGENTCORE_RUNTIME_ARN=<步骤 D 输出的 agentRuntimeArn>
AGENTCORE_EXECUTION_ROLE_ARN=arn:aws:iam::<ACCOUNT_ID>:role/super-agent-agentcore-execution-role
AGENTCORE_WORKSPACE_S3_BUCKET=super-agent-workspaces-<ACCOUNT_ID>
EOF
```

然后重新部署（只更新 .env，跳过前端）：

```bash
./scripts/deploy.sh ~/Downloads/my-key.pem --stack SuperAgentTest \
  --env-file ./agentcore-overrides.env --skip-frontend
```

或者直接 SSH 上去改 `.env` 然后重启：

```bash
# 通过 SSM
aws ssm start-session --target <InstanceId> --region us-west-2

# 在 EC2 上
sudo -u ubuntu vi /opt/super-agent/.env
# 添加上面四行
sudo systemctl restart backend
```

> 注意：systemd service 的 `EnvironmentFile` 指向 `/opt/super-agent/.env`，不是 `/opt/super-agent/backend/.env`。
> 后端代码也会通过 dotenv 加载 `backend/.env`，但 dotenv 不覆盖已存在的环境变量，
> 所以 systemd 注入的值优先。手动修改时务必改 `/opt/super-agent/.env`。

### 步骤 F：验证

在网页上发一条消息，检查：
- 聊天正常回复
- 右侧 Workspace 面板显示文件（不是空的）

如果 Workspace 面板空，检查 `/opt/super-agent/logs/backend-error.log`，
常见原因是 EC2 instance role 缺少 workspace S3 bucket 的 `s3:ListBucket` 权限
（infra CDK stack 已自动授权，不应出现此问题）。

---

## 第三部分：回退

### AgentCore → Claude 模式

```bash
# SSH 到 EC2
sed -i 's/^AGENT_RUNTIME=agentcore/AGENT_RUNTIME=claude/' /opt/super-agent/.env
sudo systemctl restart backend
```

### 更新 AgentCore 容器代码

```bash
cd agentcore
docker buildx build --platform linux/arm64 \
  -t <ACCOUNT_ID>.dkr.ecr.us-west-2.amazonaws.com/super-agent-agentcore:latest \
  --load .
docker push <ACCOUNT_ID>.dkr.ecr.us-west-2.amazonaws.com/super-agent-agentcore:latest

# 通知 AgentCore 拉取新镜像
# ⚠️ 必须传完整的 --environment-variables，否则 AWS 会清空已有环境变量
aws bedrock-agentcore-control update-agent-runtime \
  --agent-runtime-id <runtime-id> \
  --agent-runtime-artifact '{"containerConfiguration":{"containerUri":"<ACCOUNT_ID>.dkr.ecr.us-west-2.amazonaws.com/super-agent-agentcore:latest"}}' \
  --role-arn "arn:aws:iam::<ACCOUNT_ID>:role/super-agent-agentcore-execution-role" \
  --network-configuration '{"networkMode":"PUBLIC"}' \
  --environment-variables '{
    "CLAUDE_CODE_USE_BEDROCK":"1",
    "ANTHROPIC_MODEL":"us.anthropic.claude-opus-4-6-v1",
    "AWS_REGION":"us-west-2",
    "WORKSPACE_S3_REGION":"us-east-1"
  }' \
  --region us-west-2
```

> ⚠️ `--environment-variables` 是全量替换，不是增量更新。每次 update 都必须传完整的环境变量集合，漏传的变量会被清空。如果 Bedrock 使用跨账号 AK/SK，也要一并传入。

### 更换 Bedrock 模型或轮换 AK/SK

同上 `update-agent-runtime`，修改 `--environment-variables` 中的值。

### 销毁整个环境

```bash
cd infra
npx cdk destroy -c stackName=SuperAgentTest --region us-west-2
```

> AgentCore Runtime、ECR 仓库、IAM execution role 不在 CDK 管理范围内，需要手动删除：
> ```bash
> aws bedrock-agentcore-control delete-agent-runtime --agent-runtime-id <id> --region us-west-2
> aws ecr delete-repository --repository-name super-agent-agentcore --force --region us-west-2
> aws iam delete-role-policy --role-name super-agent-agentcore-execution-role --policy-name agentcore-permissions
> aws iam delete-role --role-name super-agent-agentcore-execution-role
> ```
