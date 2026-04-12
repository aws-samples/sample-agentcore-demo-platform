import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecs_patterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

/**
 * SuperAgentStack — production-ready serverless deployment.
 *
 * Architecture:
 *   Frontend:  S3 + CloudFront (OAC, BLOCK_ALL public access)
 *   Backend:   ECS Fargate (ARM64) behind ALB
 *   Database:  Aurora PostgreSQL Serverless v2
 *   Cache:     ElastiCache Redis 7.1
 *   Agents:    Bedrock AgentCore Runtime (VPC mode)
 *   Browser:   Custom Browser Tool (Web Bot Auth, public network)
 *   Code:      Custom Code Interpreter (public network)
 *
 * ECS starts with desiredCount=0 — the deploy script pushes images then scales up.
 */
export class SuperAgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =========================================================================
    // VPC
    // =========================================================================
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    // =========================================================================
    // Security Groups
    // =========================================================================
    const albSg = new ec2.SecurityGroup(this, 'ALBSG', { vpc, description: 'ALB', allowAllOutbound: true });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');

    const ecsSg = new ec2.SecurityGroup(this, 'ECSSG', { vpc, description: 'ECS Fargate', allowAllOutbound: true });
    ecsSg.addIngressRule(albSg, ec2.Port.tcp(3000), 'From ALB');

    const dbSg = new ec2.SecurityGroup(this, 'DBSG', { vpc, description: 'Aurora', allowAllOutbound: false });
    dbSg.addIngressRule(ecsSg, ec2.Port.tcp(5432), 'From ECS');

    const redisSg = new ec2.SecurityGroup(this, 'RedisSG', { vpc, description: 'Redis', allowAllOutbound: false });
    redisSg.addIngressRule(ecsSg, ec2.Port.tcp(6379), 'From ECS');

    const agentcoreSg = new ec2.SecurityGroup(this, 'AgentCoreSG', { vpc, description: 'AgentCore', allowAllOutbound: false });
    agentcoreSg.addEgressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');
    dbSg.addIngressRule(agentcoreSg, ec2.Port.tcp(5432), 'From AgentCore');
    redisSg.addIngressRule(agentcoreSg, ec2.Port.tcp(6379), 'From AgentCore');

    // =========================================================================
    // Aurora PostgreSQL Serverless v2
    // =========================================================================
    const dbCluster = new rds.DatabaseCluster(this, 'AuroraDB', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({ version: rds.AuroraPostgresEngineVersion.VER_16_6 }),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 4,
      writer: rds.ClusterInstance.serverlessV2('Writer', { publiclyAccessible: false }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      defaultDatabaseName: 'super_agent',
      credentials: rds.Credentials.fromGeneratedSecret('superagent', { secretName: `${id}/db-credentials` }),
      storageEncrypted: true,
      backup: { retention: cdk.Duration.days(7) },
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // =========================================================================
    // ElastiCache Redis
    // =========================================================================
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnets', {
      description: 'Redis subnets',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }).subnetIds,
    });

    const redis = new elasticache.CfnReplicationGroup(this, 'Redis', {
      replicationGroupDescription: `${id} Redis`,
      engine: 'redis', engineVersion: '7.1',
      cacheNodeType: 'cache.t4g.micro', numCacheClusters: 1,
      automaticFailoverEnabled: false,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [redisSg.securityGroupId],
      atRestEncryptionEnabled: true, transitEncryptionEnabled: false,
    });

    // =========================================================================
    // S3 Buckets (all BLOCK_ALL)
    // =========================================================================
    const bucketDefaults = { blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, encryption: s3.BucketEncryption.S3_MANAGED };
    const avatarBucket = new s3.Bucket(this, 'AvatarBucket', { ...bucketDefaults, removalPolicy: cdk.RemovalPolicy.RETAIN });
    const workspaceBucket = new s3.Bucket(this, 'WorkspaceBucket', {
      ...bucketDefaults, removalPolicy: cdk.RemovalPolicy.DESTROY, autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(30) }],
    });
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      ...bucketDefaults, removalPolicy: cdk.RemovalPolicy.DESTROY, autoDeleteObjects: true,
    });

    // =========================================================================
    // ECR Repositories (created externally by deploy script, referenced here)
    // =========================================================================
    const backendRepo = ecr.Repository.fromRepositoryName(this, 'BackendRepo', `${id.toLowerCase()}-backend`);
    const agentcoreRepo = ecr.Repository.fromRepositoryName(this, 'AgentCoreRepo', `${id.toLowerCase()}-agentcore`);

    // =========================================================================
    // IAM — ECS Task Role
    // =========================================================================
    const ecsTaskRole = new iam.Role(this, 'ECSTaskRole', { assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com') });
    ecsTaskRole.addToPolicy(new iam.PolicyStatement({ actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'], resources: ['*'] }));
    ecsTaskRole.addToPolicy(new iam.PolicyStatement({ actions: ['bedrock-agentcore:InvokeAgentRuntime'], resources: [`arn:aws:bedrock-agentcore:${this.region}:${this.account}:runtime/*`] }));
    ecsTaskRole.addToPolicy(new iam.PolicyStatement({ actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'], resources: [dbCluster.secret!.secretArn, `${dbCluster.secret!.secretArn}*`] }));
    ecsTaskRole.addToPolicy(new iam.PolicyStatement({ actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'], resources: ['*'] }));
    avatarBucket.grantReadWrite(ecsTaskRole);
    workspaceBucket.grantReadWrite(ecsTaskRole);

    // =========================================================================
    // IAM — AgentCore Execution Role (Browser, Code Interpreter, Bedrock)
    // =========================================================================
    const agentcoreRole = new iam.Role(this, 'AgentCoreRole', {
      // No roleName — let CDK auto-generate a unique name to avoid cross-region collisions
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal('bedrock-agentcore.amazonaws.com'),
        new iam.ServicePrincipal('bedrock.amazonaws.com'),
      ),
    });
    agentcoreRole.addToPolicy(new iam.PolicyStatement({ actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'], resources: ['*'] }));
    agentcoreRole.addToPolicy(new iam.PolicyStatement({ actions: ['ecr:GetDownloadUrlForLayer', 'ecr:BatchGetImage', 'ecr:GetAuthorizationToken'], resources: ['*'] }));
    workspaceBucket.grantReadWrite(agentcoreRole);
    agentcoreRole.addToPolicy(new iam.PolicyStatement({ actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'logs:DescribeLogStreams', 'logs:DescribeLogGroups'], resources: ['*'] }));
    agentcoreRole.addToPolicy(new iam.PolicyStatement({ actions: ['secretsmanager:GetSecretValue'], resources: [dbCluster.secret!.secretArn, `${dbCluster.secret!.secretArn}*`] }));
    // Workload Identity
    agentcoreRole.addToPolicy(new iam.PolicyStatement({ actions: ['bedrock-agentcore:GetWorkloadAccessToken', 'bedrock-agentcore:GetWorkloadAccessTokenForJWT', 'bedrock-agentcore:GetWorkloadAccessTokenForUserId'], resources: [`arn:aws:bedrock-agentcore:${this.region}:${this.account}:workload-identity-directory/*`] }));
    // Browser (full)
    agentcoreRole.addToPolicy(new iam.PolicyStatement({ actions: ['bedrock-agentcore:CreateBrowser', 'bedrock-agentcore:ListBrowsers', 'bedrock-agentcore:GetBrowser', 'bedrock-agentcore:DeleteBrowser', 'bedrock-agentcore:StartBrowserSession', 'bedrock-agentcore:ListBrowserSessions', 'bedrock-agentcore:GetBrowserSession', 'bedrock-agentcore:StopBrowserSession', 'bedrock-agentcore:UpdateBrowserStream', 'bedrock-agentcore:ConnectBrowserAutomationStream', 'bedrock-agentcore:ConnectBrowserLiveViewStream'], resources: ['*'] }));
    // Code Interpreter (full)
    agentcoreRole.addToPolicy(new iam.PolicyStatement({ actions: ['bedrock-agentcore:CreateCodeInterpreter', 'bedrock-agentcore:ListCodeInterpreters', 'bedrock-agentcore:GetCodeInterpreter', 'bedrock-agentcore:DeleteCodeInterpreter', 'bedrock-agentcore:StartCodeInterpreterSession', 'bedrock-agentcore:InvokeCodeInterpreter', 'bedrock-agentcore:StopCodeInterpreterSession', 'bedrock-agentcore:GetCodeInterpreterSession', 'bedrock-agentcore:ListCodeInterpreterSessions'], resources: ['*'] }));
    // X-Ray + CloudWatch metrics
    agentcoreRole.addToPolicy(new iam.PolicyStatement({ actions: ['xray:PutTraceSegments', 'xray:PutTelemetryRecords', 'xray:GetSamplingRules', 'xray:GetSamplingTargets'], resources: ['*'] }));
    agentcoreRole.addToPolicy(new iam.PolicyStatement({ actions: ['cloudwatch:PutMetricData'], resources: ['*'], conditions: { StringEquals: { 'cloudwatch:namespace': 'bedrock-agentcore' } } }));

    // =========================================================================
    // ECS Cluster + Fargate Service (starts at 0, scaled up after image push)
    // =========================================================================
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc });

    const backendLogs = new logs.LogGroup(this, 'BackendLogs', {
      logGroupName: `/super-agent/${id}/backend`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const taskDef = new ecs.FargateTaskDefinition(this, 'BackendTask', {
      memoryLimitMiB: 2048, cpu: 1024,
      runtimePlatform: { cpuArchitecture: ecs.CpuArchitecture.ARM64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX },
      taskRole: ecsTaskRole,
    });

    taskDef.addContainer('backend', {
      image: ecs.ContainerImage.fromEcrRepository(backendRepo, 'latest'),
      logging: ecs.LogDrivers.awsLogs({ logGroup: backendLogs, streamPrefix: 'ecs' }),
      environment: {
        PORT: '3000', HOST: '0.0.0.0', NODE_ENV: 'production',
        AWS_REGION: this.region,
        REDIS_HOST: redis.attrPrimaryEndPointAddress,
        REDIS_PORT: redis.attrPrimaryEndPointPort,
        REDIS_PASSWORD: '',
        AUTH_MODE: 'local',
        S3_BUCKET_NAME: avatarBucket.bucketName,
        S3_PRESIGNED_URL_EXPIRES: '3600',
        CLAUDE_CODE_USE_BEDROCK: '1',
        CLAUDE_MODEL: 'claude-sonnet-4-6',
        AGENT_RUNTIME: 'agentcore',
        AGENTCORE_WORKSPACE_S3_BUCKET: workspaceBucket.bucketName,
        LOG_LEVEL: 'info',
        // DATABASE_URL is injected by deploy script after CDK creates the DB
        DATABASE_URL: 'placeholder://will-be-set-by-deploy-script',
      },
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
        interval: cdk.Duration.seconds(30), timeout: cdk.Duration.seconds(10),
        retries: 3, startPeriod: cdk.Duration.seconds(120),
      },
      portMappings: [{ containerPort: 3000 }],
    });

    const fargateService = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'BackendService', {
      cluster, taskDefinition: taskDef,
      desiredCount: 1,
      publicLoadBalancer: true, assignPublicIp: false,
      taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [ecsSg],
      healthCheckGracePeriod: cdk.Duration.seconds(600),
      // No circuit breaker — deploy script will fix the task def with real DATABASE_URL
    });

    fargateService.targetGroup.configureHealthCheck({
      path: '/health', interval: cdk.Duration.seconds(30),
      healthyThresholdCount: 2, unhealthyThresholdCount: 3,
    });

    // =========================================================================
    // CloudFront — S3 frontend (OAC) + ALB backend (/api/*, /health)
    // OAC created explicitly with region in name to avoid global name collisions
    // =========================================================================
    const albOrigin = new origins.LoadBalancerV2Origin(fargateService.loadBalancer, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(frontendBucket);

    const distribution = new cloudfront.Distribution(this, 'CDN', {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
        '/health': {
          origin: albOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      ],
    });

    // Override the auto-generated OAC name to include region — prevents
    // global name collisions when deploying the same stack name in multiple regions.
    const cfnDist = distribution.node.defaultChild as cloudfront.CfnDistribution;
    const oacNodes = distribution.node.findAll().filter(
      c => (c as any).cfnResourceType === 'AWS::CloudFront::OriginAccessControl'
    );
    for (const node of oacNodes) {
      (node as cloudfront.CfnOriginAccessControl).addPropertyOverride(
        'OriginAccessControlConfig.Name',
        `${id}-${this.region}-s3-oac`,
      );
    }

    // =========================================================================
    // Outputs — everything the deploy script needs
    // =========================================================================
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new cdk.CfnOutput(this, 'PrivateSubnet1', { value: vpc.privateSubnets[0].subnetId });
    new cdk.CfnOutput(this, 'PrivateSubnet2', { value: vpc.privateSubnets[1].subnetId });
    new cdk.CfnOutput(this, 'AgentCoreSGId', { value: agentcoreSg.securityGroupId });
    new cdk.CfnOutput(this, 'EcsSGId', { value: ecsSg.securityGroupId });
    new cdk.CfnOutput(this, 'BackendRepoUri', { value: backendRepo.repositoryUri });
    new cdk.CfnOutput(this, 'AgentCoreRepoUri', { value: agentcoreRepo.repositoryUri });
    new cdk.CfnOutput(this, 'AgentCoreRoleArn', { value: agentcoreRole.roleArn });
    new cdk.CfnOutput(this, 'EcsClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'EcsServiceName', { value: fargateService.service.serviceName });
    new cdk.CfnOutput(this, 'TaskDefFamily', { value: taskDef.family });
    new cdk.CfnOutput(this, 'ALBDnsName', { value: fargateService.loadBalancer.loadBalancerDnsName });
    new cdk.CfnOutput(this, 'DBSecretArn', { value: dbCluster.secret!.secretArn });
    new cdk.CfnOutput(this, 'DBEndpoint', { value: dbCluster.clusterEndpoint.hostname });
    new cdk.CfnOutput(this, 'RedisEndpoint', { value: redis.attrPrimaryEndPointAddress });
    new cdk.CfnOutput(this, 'RedisPort', { value: redis.attrPrimaryEndPointPort });
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
    new cdk.CfnOutput(this, 'AvatarBucketName', { value: avatarBucket.bucketName });
    new cdk.CfnOutput(this, 'WorkspaceBucketName', { value: workspaceBucket.bucketName });
    new cdk.CfnOutput(this, 'CloudFrontDistId', { value: distribution.distributionId });
    new cdk.CfnOutput(this, 'CloudFrontDomain', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'CloudFrontUrl', { value: `https://${distribution.distributionDomainName}` });
  }
}
