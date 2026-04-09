# Super Agent Backend

## AWS Bedrock Configuration

The backend uses AWS Bedrock (Claude) for AI-powered agent generation. You need to configure AWS credentials to use this feature.

### Option 1: Environment Variables (Recommended for Development)

Add to your `.env` file:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

### Option 2: AWS Credentials File

Configure your AWS credentials in `~/.aws/credentials`:

```ini
[default]
aws_access_key_id = your_access_key_here
aws_secret_access_key = your_secret_key_here
```

### Required AWS Permissions

Your AWS IAM user/role needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/amazon.nova-*"
    }
  ]
}
```

### Bedrock Model Access

Ensure you have access to the Nova model in your AWS account:
1. Go to AWS Bedrock console
2. Navigate to "Model access"
3. Request access to "Amazon Nova" models (specifically Nova 2 Lite)

### Troubleshooting

If you see a 500 error when creating business scopes:
- Check that AWS credentials are properly configured
- Verify you have Bedrock model access in your AWS account
- Check the backend logs for detailed error messages
