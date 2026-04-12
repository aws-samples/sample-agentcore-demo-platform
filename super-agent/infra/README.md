# Super Agent Infrastructure

One-click deployment of the full Super Agent platform on AWS.

## Architecture

```
User → CloudFront (HTTPS)
         ├── /           → S3 Frontend (OAC, no public access)
         ├── /api/*      → ALB → ECS Fargate (backend)
         └── /health     → ALB → ECS Fargate (backend)

Backend (ECS Fargate ARM64) connects to:
  ├── Aurora PostgreSQL Serverless v2
  ├── ElastiCache Redis 7.1
  ├── S3 (avatars, workspace)
  └── Bedrock AgentCore Runtime (VPC)
        ├── Browser Tool (Web Bot Auth, public)
        └── Code Interpreter (public, internet access)
```

## One-Click Deploy

```bash
cd super-agent/infra
./scripts/deploy.sh --region us-east-1
```

### What it does (8 steps, ~25 min fresh / ~5 min redeploy)

| Step | What |
|------|------|
| 1 | Create ECR repos, push backend image, CDK deploy (VPC, Aurora, Redis, ECS, ALB, CloudFront, S3, IAM) |
| 2 | Build & push backend Docker image (ARM64) |
| 3 | Build & push AgentCore container image (ARM64) |
| 4 | Create AgentCore Runtime (VPC) + Browser (Web Bot Auth) + Code Interpreter (public internet) |
| 5 | Update ECS task with DATABASE_URL, JWT_SECRET, AgentCore ARN, Browser/CI IDs, CORS |
| 6 | Run DB migration + seed as one-off ECS task (30+ migrations, demo data, admin user) |
| 7 | Build frontend (Vite), sync to S3, invalidate CloudFront |
| 8 | Wait for backend to stabilize, verify health check |

### Options

```bash
./scripts/deploy.sh                                        # default: us-east-1
./scripts/deploy.sh --region ap-southeast-1                 # Singapore
./scripts/deploy.sh --stack MyStack --region us-west-2      # custom stack + region
./scripts/deploy.sh --skip-infra                            # skip CDK, redeploy app only
./scripts/deploy.sh --skip-frontend                         # backend + AgentCore only
./scripts/deploy.sh --skip-backend                          # skip Docker builds
```

### Prerequisites

1. AWS CLI v2 configured (`aws configure`)
2. Node.js 22+
3. Docker with ARM64 build support (`docker buildx`)
4. CDK bootstrapped in target region:
   ```bash
   CDK_DEFAULT_REGION=us-east-1 npx cdk bootstrap aws://ACCOUNT_ID/us-east-1
   ```

### Post-Deploy

- App URL: `https://<cloudfront-domain>` (shown at end of deploy)
- Login: `admin@example.com` / `admin123`
- All AWS calls use IAM roles — no access keys

## One-Click Destroy

```bash
./scripts/destroy.sh --region us-east-1
```

Destroys everything: AgentCore Runtime, Browser, Code Interpreter, CDK stack (VPC, Aurora, Redis, ECS, ALB, CloudFront, S3), and ECR repos.

```bash
./scripts/destroy.sh --region ap-southeast-1 --stack SuperAgentSG
```

> **Important**: Both `deploy.sh` and `destroy.sh` set `CDK_DEFAULT_REGION` internally.
> Do NOT use `npx cdk destroy --region` directly — CDK ignores the `--region` flag
> and uses the region from `env` in `bin/app.ts` (which reads `CDK_DEFAULT_REGION`).
