/** AWS Architecture Icons — using official AWS icon SVGs from /aws-icons/ */

interface IconProps {
  size?: number;
  className?: string;
}

function AwsIcon({ src, size = 40, className }: IconProps & { src: string }) {
  return <img src={src} width={size} height={size} className={className} alt="" style={{ borderRadius: 6 }} />;
}

// ── AWS Service Icons ──

export function IconBedrock(props: IconProps) {
  return <AwsIcon src="/aws-icons/bedrock.svg" {...props} />;
}
export function IconLambda(props: IconProps) {
  return <AwsIcon src="/aws-icons/lambda.svg" {...props} />;
}
export function IconDynamoDB(props: IconProps) {
  return <AwsIcon src="/aws-icons/dynamodb.svg" {...props} />;
}
export function IconAPIGateway(props: IconProps) {
  return <AwsIcon src="/aws-icons/api-gateway.svg" {...props} />;
}
export function IconCloudWatch(props: IconProps) {
  return <AwsIcon src="/aws-icons/cloudwatch.svg" {...props} />;
}
export function IconS3(props: IconProps) {
  return <AwsIcon src="/aws-icons/s3.svg" {...props} />;
}
export function IconEC2(props: IconProps) {
  return <AwsIcon src="/aws-icons/ec2.svg" {...props} />;
}
export function IconCognito(props: IconProps) {
  return <AwsIcon src="/aws-icons/cognito.svg" {...props} />;
}
export function IconIAM(props: IconProps) {
  return <AwsIcon src="/aws-icons/iam.svg" {...props} />;
}
export function IconSNS(props: IconProps) {
  return <AwsIcon src="/aws-icons/sns.svg" {...props} />;
}
export function IconEventBridge(props: IconProps) {
  return <AwsIcon src="/aws-icons/eventbridge.svg" {...props} />;
}
export function IconRDS(props: IconProps) {
  return <AwsIcon src="/aws-icons/rds.svg" {...props} />;
}
export function IconHealthLake(props: IconProps) {
  return <AwsIcon src="/aws-icons/healthlake.svg" {...props} />;
}
export function IconRekognition(props: IconProps) {
  return <AwsIcon src="/aws-icons/rekognition.svg" {...props} />;
}
export function IconAmplify(props: IconProps) {
  return <AwsIcon src="/aws-icons/amplify.svg" {...props} />;
}
export function IconCDK(props: IconProps) {
  return <AwsIcon src="/aws-icons/cdk.svg" {...props} />;
}
export function IconXRay(props: IconProps) {
  return <AwsIcon src="/aws-icons/x-ray.svg" {...props} />;
}
export function IconCostExplorer(props: IconProps) {
  return <AwsIcon src="/aws-icons/cost-explorer.svg" {...props} />;
}

// ── User / Client ──
export function IconUser({ size = 40, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className}>
      <rect width="40" height="40" rx="8" fill="#1B2A4A" stroke="#4FC3F7" strokeWidth="1" />
      <circle cx="20" cy="15" r="5.5" stroke="#4FC3F7" strokeWidth="1.5" />
      <path d="M10 32c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#4FC3F7" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Generic / Fallback ──
export function IconGeneric({ size = 40, className, label }: IconProps & { label: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={className}>
      <rect width="40" height="40" rx="8" fill="#1A2236" stroke="#5A6478" strokeWidth="1" />
      <text x="20" y="22" textAnchor="middle" fill="#8b95a8" fontSize="8" fontFamily="var(--font-display)" fontWeight="600">
        {label.slice(0, 3).toUpperCase()}
      </text>
    </svg>
  );
}

// ── AgentCore Service Icons (using AgentCore official icon as base) ──

function AgentCoreServiceIcon({ size = 28, className, label: _label }: IconProps & { label: string }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} className={className}>
      <img src="/aws-icons/bedrock-agentcore.svg" width={size} height={size} alt="" style={{ borderRadius: 4 }} />
    </div>
  );
}

export function IconACRuntime(props: IconProps) {
  return <AgentCoreServiceIcon label="RT" {...props} />;
}
export function IconACGateway(props: IconProps) {
  return <AgentCoreServiceIcon label="GW" {...props} />;
}
export function IconACIdentity(props: IconProps) {
  return <AgentCoreServiceIcon label="ID" {...props} />;
}
export function IconACMemory(props: IconProps) {
  return <AgentCoreServiceIcon label="MEM" {...props} />;
}
export function IconACTools(props: IconProps) {
  return <AgentCoreServiceIcon label="TL" {...props} />;
}
export function IconACObservability(props: IconProps) {
  return <AgentCoreServiceIcon label="OBS" {...props} />;
}
export function IconACEvaluations(props: IconProps) {
  return <AgentCoreServiceIcon label="EVL" {...props} />;
}
export function IconACPolicy(props: IconProps) {
  return <AgentCoreServiceIcon label="POL" {...props} />;
}

// ── Mapping helpers ──

export const awsServiceIconMap: Record<string, React.FC<IconProps>> = {
  'Amazon Bedrock': IconBedrock,
  'Lambda': IconLambda,
  'DynamoDB': IconDynamoDB,
  'API Gateway': IconAPIGateway,
  'CloudWatch': IconCloudWatch,
  'S3': IconS3,
  'EC2': IconEC2,
  'Cognito': IconCognito,
  'IAM': IconIAM,
  'SNS': IconSNS,
  'EventBridge': IconEventBridge,
  'RDS': IconRDS,
  'Aurora Serverless': IconRDS,
  'HealthLake': IconHealthLake,
  'Rekognition': IconRekognition,
  'Amplify': IconAmplify,
  'CDK': IconCDK,
  'X-Ray': IconXRay,
  'Cost Explorer': IconCostExplorer,
};

export const agentcoreServiceIconMap: Record<string, React.FC<IconProps>> = {
  'Runtime': IconACRuntime,
  'Gateway': IconACGateway,
  'Identity': IconACIdentity,
  'Memory': IconACMemory,
  'Tools': IconACTools,
  'Observability': IconACObservability,
  'Evaluations': IconACEvaluations,
  'Policy': IconACPolicy,
};
