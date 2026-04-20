import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * SuperAgentStack — unified deployment with optional CloudFront CDN.
 *
 * Core resources (always created):
 *   VPC (default), Security Groups, EC2 (t4g.small), EIP, RDS PostgreSQL,
 *   S3 avatar bucket, IAM role, Nginx, Redis, systemd service.
 *
 * Optional Cognito (authMode=cognito):
 *   User Pool + App Client + initial admin user.
 *
 * Optional CDN layer (enableCdn=true):
 *   S3 frontend bucket, CloudFront distribution, ACM certificate,
 *   Route53 ALIAS record, OAC.
 *
 * Context parameters:
 *   enableCdn     - "true" to deploy CloudFront (default: "false")
 *   domainName    - custom domain, e.g. "app.example.com" (required if enableCdn)
 *   hostedZoneId  - Route53 hosted zone ID (required if enableCdn)
 *   authMode      - "cognito" | "local" (default: "local")
 */
export class SuperAgentStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const enableCdn = this.node.tryGetContext('enableCdn') === 'true';
    const domainName = this.node.tryGetContext('domainName') as string | undefined;
    const hostedZoneId = this.node.tryGetContext('hostedZoneId') as string | undefined;
    const authMode = (this.node.tryGetContext('authMode') as string) || 'local';

    if (enableCdn && (!domainName || !hostedZoneId)) {
      throw new Error('enableCdn=true requires domainName and hostedZoneId context values');
    }

    // =========================================================================
    // Parameters
    // =========================================================================
    const keyPairName = new cdk.CfnParameter(this, 'KeyPairName', {
      type: 'String',
      description: 'EC2 Key Pair name for SSH via SSM port-forward',
    });

    const allowedCidr = new cdk.CfnParameter(this, 'AllowedCidr', {
      type: 'String',
      default: '0.0.0.0/0',
      description: 'CIDR allowed to access HTTP/HTTPS',
    });

    // Cognito parameters (only used when authMode=cognito)
    const adminEmail = new cdk.CfnParameter(this, 'AdminEmail', {
      type: 'String',
      default: 'admin@example.com',
      description: 'Initial admin email (Cognito mode only)',
    });

    const cognitoDomainPrefix = new cdk.CfnParameter(this, 'CognitoDomainPrefix', {
      type: 'String',
      default: 'super-agent-unused',
      description: 'Cognito domain prefix (Cognito mode only)',
    });

    // =========================================================================
    // VPC
    // =========================================================================
    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // =========================================================================
    // Security Groups
    // =========================================================================
    const ec2Sg = new ec2.SecurityGroup(this, 'EC2SG', {
      vpc,
      description: 'Super Agent V2 EC2 - hardened',
      allowAllOutbound: true,
    });
    ec2Sg.addIngressRule(
      ec2.Peer.ipv4(allowedCidr.valueAsString),
      ec2.Port.tcp(80), 'HTTP (redirects to HTTPS)',
    );
    ec2Sg.addIngressRule(
      ec2.Peer.ipv4(allowedCidr.valueAsString),
      ec2.Port.tcp(443), 'HTTPS',
    );

    const dbSg = new ec2.SecurityGroup(this, 'DBSG', {
      vpc,
      description: 'RDS PostgreSQL',
      allowAllOutbound: false,
    });
    dbSg.addIngressRule(ec2Sg, ec2.Port.tcp(5432), 'PostgreSQL from EC2');

    const redisSg = new ec2.SecurityGroup(this, 'RedisSG', {
      vpc,
      description: 'ElastiCache Redis',
      allowAllOutbound: false,
    });
    redisSg.addIngressRule(ec2Sg, ec2.Port.tcp(6379), 'Redis from EC2');

    // =========================================================================
    // RDS PostgreSQL
    // =========================================================================
    const dbInstance = new rds.DatabaseInstance(this, 'SuperAgentDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_6,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [dbSg],
      databaseName: 'super_agent',
      credentials: rds.Credentials.fromGeneratedSecret('superagent', {
        secretName: 'super-agent/db-credentials',
      }),
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      backupRetention: cdk.Duration.days(7),
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    // =========================================================================
    // ElastiCache Redis (replaces EC2-local Redis for BullMQ + distributed locks)
    // =========================================================================
    const redisSubnetGroup = new cdk.aws_elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnets for ElastiCache Redis',
      subnetIds: vpc.publicSubnets.map(s => s.subnetId),
      cacheSubnetGroupName: `${id}-redis-subnets`.toLowerCase(),
    });

    const redisCluster = new cdk.aws_elasticache.CfnCacheCluster(this, 'RedisCluster', {
      engine: 'redis',
      cacheNodeType: 'cache.t4g.micro',
      numCacheNodes: 1,
      clusterName: `${id}-redis`.toLowerCase(),
      vpcSecurityGroupIds: [redisSg.securityGroupId],
      cacheSubnetGroupName: redisSubnetGroup.cacheSubnetGroupName,
      engineVersion: '7.1',
      port: 6379,
    });
    redisCluster.addDependency(redisSubnetGroup);

    // =========================================================================
    // IAM Role for EC2
    // =========================================================================
    const role = new iam.Role(this, 'SuperAgentEC2Role', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
      ],
    });

    role.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: ['*'],
    }));

    role.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
      resources: [dbInstance.secret!.secretArn, `${dbInstance.secret!.secretArn}*`],
    }));

    role.addToPolicy(new iam.PolicyStatement({
      actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents', 'logs:DescribeLogStreams'],
      resources: [`arn:aws:logs:${this.region}:${this.account}:log-group:/super-agent/*`],
    }));

    // AgentCore invoke permission (wildcard — covers any runtime created later)
    role.addToPolicy(new iam.PolicyStatement({
      actions: ['bedrock-agentcore:InvokeAgentRuntime'],
      resources: [`arn:aws:bedrock-agentcore:${this.region}:${this.account}:runtime/*`],
    }));

    // =========================================================================
    // S3 Buckets
    // =========================================================================
    const avatarBucket = new s3.Bucket(this, 'AvatarBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    avatarBucket.grantReadWrite(role);

    // Skills bucket (for agent skill definitions)
    const skillsBucket = new s3.Bucket(this, 'SkillsBucket', {
      bucketName: `super-agent-skills-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });
    skillsBucket.grantReadWrite(role);

    // Workspace bucket (for AgentCore S3 sync)
    const workspaceBucket = new s3.Bucket(this, 'WorkspaceBucket', {
      bucketName: `super-agent-workspace-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      lifecycleRules: [{ expiration: cdk.Duration.days(30) }],
    });
    workspaceBucket.grantReadWrite(role);

    // =========================================================================
    // Optional: Cognito (authMode=cognito)
    // =========================================================================
    let userPool: cognito.UserPool | undefined;
    let appClient: cognito.UserPoolClient | undefined;
    let cognitoDomainFull: string | undefined;

    if (authMode === 'cognito') {
      userPool = new cognito.UserPool(this, 'SuperAgentUserPool', {
        userPoolName: 'super-agent-users',
        selfSignUpEnabled: false,
        signInAliases: { email: true },
        autoVerify: { email: true },
        standardAttributes: {
          email: { required: true, mutable: true },
          fullname: { required: false, mutable: true },
        },
        customAttributes: {
          orgId: new cognito.StringAttribute({ mutable: true }),
          role: new cognito.StringAttribute({ mutable: true }),
        },
        passwordPolicy: {
          minLength: 8, requireLowercase: true, requireUppercase: true,
          requireDigits: true, requireSymbols: false,
        },
        accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });

      userPool.addDomain('CognitoDomain', {
        cognitoDomain: { domainPrefix: cognitoDomainPrefix.valueAsString },
      });

      appClient = userPool.addClient('SuperAgentAppClient', {
        userPoolClientName: 'super-agent-web',
        generateSecret: false,
        authFlows: { userSrp: true },
        oAuth: {
          flows: { authorizationCodeGrant: true },
          scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
          callbackUrls: ['http://localhost:5173/auth/callback'],
          logoutUrls: ['http://localhost:5173/login'],
        },
        preventUserExistenceErrors: true,
      });

      new cognito.CfnUserPoolUser(this, 'AdminUser', {
        userPoolId: userPool.userPoolId,
        username: adminEmail.valueAsString,
        userAttributes: [
          { name: 'email', value: adminEmail.valueAsString },
          { name: 'email_verified', value: 'true' },
        ],
        desiredDeliveryMediums: ['EMAIL'],
      });

      cognitoDomainFull = `${cognitoDomainPrefix.valueAsString}.auth.${this.region}.amazoncognito.com`;

      role.addToPolicy(new iam.PolicyStatement({
        actions: ['cognito-idp:UpdateUserPoolClient', 'cognito-idp:DescribeUserPoolClient'],
        resources: [userPool.userPoolArn],
      }));
    }

    // =========================================================================
    // Optional: CloudFront CDN (enableCdn=true)
    // =========================================================================
    let frontendBucket: s3.Bucket | undefined;
    let distribution: cloudfront.Distribution | undefined;

    if (enableCdn) {
      // S3 bucket for frontend static files
      frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        encryption: s3.BucketEncryption.S3_MANAGED,
      });
      frontendBucket.grantReadWrite(role); // for deploy script S3 sync

      // ACM certificate (must be us-east-1 for CloudFront)
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId: hostedZoneId!,
        zoneName: domainName!.split('.').slice(1).join('.'), // extract parent domain
      });

      const certificate = new acm.DnsValidatedCertificate(this, 'Certificate', {
        domainName: domainName!,
        hostedZone,
        region: 'us-east-1', // CloudFront requires us-east-1
      });

      // OAC for S3
      const oac = new cloudfront.CfnOriginAccessControl(this, 'OAC', {
        originAccessControlConfig: {
          name: `${id}-oac`,
          originAccessControlOriginType: 's3',
          signingBehavior: 'always',
          signingProtocol: 'sigv4',
        },
      });

      // CloudFront distribution
      distribution = new cloudfront.Distribution(this, 'CDN', {
        defaultBehavior: {
          origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        domainNames: [domainName!],
        certificate,
        defaultRootObject: 'index.html',
        errorResponses: [
          { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
          { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
        ],
      });

      // Add API/WS behavior → EC2 origin
      const ec2Origin = new origins.HttpOrigin(`ec2-origin.${domainName}`, {
        // This will be overridden by post-deploy to use the actual EIP
        // For now, use a placeholder — the deploy script patches it
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        httpPort: 80,
      });

      // Route53 ALIAS → CloudFront
      new route53.ARecord(this, 'DnsAlias', {
        zone: hostedZone,
        recordName: domainName!,
        target: route53.RecordTarget.fromAlias(new route53targets.CloudFrontTarget(distribution)),
      });
    }

    // =========================================================================
    // EC2 Instance
    // =========================================================================
    const userData = ec2.UserData.forLinux();
    const userDataScript = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'user-data.sh'), 'utf-8',
    );
    userData.addCommands(userDataScript);

    const instance = new ec2.Instance(this, 'SuperAgentInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.fromSsmParameter(
        '/aws/service/canonical/ubuntu/server/22.04/stable/current/arm64/hvm/ebs-gp2/ami-id',
      ),
      securityGroup: ec2Sg,
      role,
      keyPair: ec2.KeyPair.fromKeyPairName(this, 'KeyPair', keyPairName.valueAsString),
      blockDevices: [{
        deviceName: '/dev/sda1',
        volume: ec2.BlockDeviceVolume.ebs(30, {
          volumeType: ec2.EbsDeviceVolumeType.GP3, iops: 3000, encrypted: true,
        }),
      }],
      userData,
    });

    const eip = new ec2.CfnEIP(this, 'SuperAgentEIP');
    new ec2.CfnEIPAssociation(this, 'EIPAssoc', {
      allocationId: eip.attrAllocationId,
      instanceId: instance.instanceId,
    });

    // =========================================================================
    // Outputs — always
    // =========================================================================
    new cdk.CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new cdk.CfnOutput(this, 'PublicIP', { value: eip.attrPublicIp });
    new cdk.CfnOutput(this, 'DBEndpoint', { value: dbInstance.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, 'DBSecretArn', { value: dbInstance.secret!.secretArn });
    new cdk.CfnOutput(this, 'AvatarBucketName', { value: avatarBucket.bucketName });
    new cdk.CfnOutput(this, 'SkillsBucketName', { value: skillsBucket.bucketName });
    new cdk.CfnOutput(this, 'WorkspaceBucketName', { value: workspaceBucket.bucketName });
    new cdk.CfnOutput(this, 'RedisEndpoint', { value: redisCluster.attrRedisEndpointAddress });
    new cdk.CfnOutput(this, 'RedisPort', { value: redisCluster.attrRedisEndpointPort });
    new cdk.CfnOutput(this, 'AuthMode', { value: authMode });
    new cdk.CfnOutput(this, 'EnableCdn', { value: enableCdn ? 'true' : 'false' });

    // Outputs — Cognito (only when authMode=cognito)
    if (userPool && appClient && cognitoDomainFull) {
      new cdk.CfnOutput(this, 'CognitoUserPoolId', { value: userPool.userPoolId });
      new cdk.CfnOutput(this, 'CognitoClientId', { value: appClient.userPoolClientId });
      new cdk.CfnOutput(this, 'CognitoDomainUrl', { value: cognitoDomainFull });
    }

    // Outputs — CDN (only when enableCdn=true)
    if (frontendBucket) {
      new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
    }
    if (distribution) {
      new cdk.CfnOutput(this, 'CloudFrontDistributionId', { value: distribution.distributionId });
      new cdk.CfnOutput(this, 'CloudFrontDomainName', { value: distribution.distributionDomainName });
    }
    if (domainName) {
      new cdk.CfnOutput(this, 'DomainName', { value: domainName });
    }
  }
}
