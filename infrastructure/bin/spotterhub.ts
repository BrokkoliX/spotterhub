#!/usr/bin/env node
import 'source-map-support/register';
import { App } from 'aws-cdk-lib';
import { SpotterHubStack } from '../lib/spotterhub-stack';

const app = new App();

const stage = process.env['STAGE'] ?? 'dev';

new SpotterHubStack(app, `SpotterHub-${stage}-Stack`, {
  stage: stage as 'dev' | 'prod',
  jwtSecretInitialValue: process.env['JWT_SECRET_INITIAL_VALUE'] ?? 'change-me-in-aws-console',
  env: {
    account: process.env['CDK_DEFAULT_ACCOUNT'],
    region: process.env['CDK_DEFAULT_REGION'] ?? 'us-east-1',
  },
});
