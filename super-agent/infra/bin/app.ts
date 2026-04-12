#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SuperAgentStack } from '../lib/super-agent-stack';

const app = new cdk.App();
const stackName = app.node.tryGetContext('stackName') || 'SuperAgent';

new SuperAgentStack(app, stackName, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  description: `Super Agent Platform - ${stackName}`,
});
