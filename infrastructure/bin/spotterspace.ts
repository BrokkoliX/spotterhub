#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { SpotterSpaceStack } from '../lib/spotterspace-stack';

const app = new App();

const stage = process.env['STAGE'] ?? 'dev';

new SpotterSpaceStack(app, `SpotterSpace-${stage}-Stack`, {
  stage: stage as 'dev' | 'prod',
  domainName: process.env['DOMAIN_NAME'],
  hostedZoneId: process.env['HOSTED_ZONE_ID'],
  vpcId: process.env['VPC_ID'] ?? 'vpc-09a6870488b73260e',
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'] ?? 'us-east-1',
  },
});
