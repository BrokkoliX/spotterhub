// SpotterSpace AWS Infrastructure — CDK v2
// Deployment: CDK bootstrap + cdk deploy (see .github/workflows/deploy.yml)
import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import {
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_lambda as lambda_,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import path from 'path';

export interface SpotterHubStackProps extends StackProps {
  stage: 'dev' | 'prod';
  jwtSecretInitialValue: string;
}

export class SpotterHubStack extends Stack {
  constructor(scope: Construct, id: string, props: SpotterHubStackProps) {
    super(scope, id, props);

    const { stage, jwtSecretInitialValue } = props;

    // ─── S3 Bucket for Photos ──────────────────────────────────────────────
    const photosBucket = s3.Bucket.fromBucketName(
      this,
      'PhotosBucket',
      process.env['S3_BUCKET_NAME'] ?? 'spotterspace-photos',
    );

    // ─── VPC ──────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'SpotterSpaceVPC', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // ─── Security Group for Lambda ───────────────────────────────────────
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });

    // ─── Security Group for RDS ──────────────────────────────────────────
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });
    dbSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'PostgreSQL from Lambda',
    );

    // ─── RDS PostgreSQL 16 ───────────────────────────────────────────────
    const dbInstanceType =
      stage === 'prod'
        ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL)
        : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO);

    const db = new rds.DatabaseInstance(this, 'SpotterSpaceDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: dbInstanceType,
      credentials: rds.Credentials.fromGeneratedSecret('spotterspace_admin', {
        secretName: `spotterspace/${stage}/db-admin`,
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [dbSecurityGroup],
      publiclyAccessible: true,
      multiAz: false,
      allocatedStorage: 20,
      storageEncrypted: true,
      backupRetention: Duration.days(stage === 'prod' ? 7 : 1),
      removalPolicy:
        stage === 'prod' ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
    });

    // ─── Secrets Manager ─────────────────────────────────────────────────
    // DATABASE_URL — constructed from RDS instance endpoint
    const dbUrlSecret = new secretsmanager.Secret(this, 'DBUrlSecret', {
      secretName: `spotterspace/${stage}/DATABASE_URL`,
      secretStringValue: SecretValue.unsafePlainText(
        `postgresql://${db.instanceEndpoint.hostname}:${db.instanceEndpoint.port}/spotterspace?schema=public`,
      ),
    });

    // JWT_SECRET — user-provided initial value
    const jwtSecret = new secretsmanager.Secret(this, 'JWTSecret', {
      secretName: `spotterspace/${stage}/JWT_SECRET`,
      secretStringValue: SecretValue.unsafePlainText(jwtSecretInitialValue),
    });

    // ─── Lambda Execution Role ───────────────────────────────────────────
    const lambdaExecutionRole = new Role(this, 'LambdaExecutionRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      roleName: `spotterspace-${stage}-lambdaexec`,
    });

    // Secrets access
    lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [dbUrlSecret.secretArn, jwtSecret.secretArn],
      }),
    );

    // VPC ENI creation (needed when Lambda is in a VPC)
    lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'ec2:CreateNetworkInterface',
          'ec2:DescribeNetworkInterfaces',
          'ec2:DeleteNetworkInterface',
        ],
        resources: ['*'],
      }),
    );

    // S3 access for photo uploads
    lambdaExecutionRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [photosBucket.bucketArn, `${photosBucket.bucketArn}/*`],
      }),
    );

    // ─── Lambda Function (in VPC private subnets) ─────────────────────────
    const apiLambda = new NodejsFunction(this, 'ApiLambda', {
      functionName: `spotterspace-${stage}-api`,
      entry: path.join(__dirname, '../../../apps/api/src/lambda.ts'),
      runtime: Runtime.NODEJS_20_X,
      handler: 'handler',
      role: lambdaExecutionRole,
      timeout: Duration.seconds(30),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        NODE_ENV: 'production',
        STAGE: stage,
        AWS_REGION_NAME: this.region,
        PHOTOS_BUCKET_NAME: photosBucket.bucketName,
        DB_SECRET_ARN: dbUrlSecret.secretArn,
        JWT_SECRET_ARN: jwtSecret.secretArn,
      },
      bundling: {
        // sharp is a native module that can't run in Lambda — it's only needed
        // for the web app's Next.js image optimization (deployed separately via Amplify)
        externalModules: ['sharp'],
      },
    });

    // Add function URL for HTTP access (no auth for GraphQL)
    const fnUrl = apiLambda.addFunctionUrl({
      authType: lambda_.FunctionUrlAuthType.NONE,
    });

    // ─── VPC Endpoints ────────────────────────────────────────────────────
    // S3 gateway endpoint (allows Lambda in private subnets to access S3)
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    // Secrets Manager interface endpoint (private DNS for Secrets Manager)
    vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      securityGroups: [lambdaSecurityGroup],
    });

    // ─── Amplify Service Role (for web app CI/CD) ─────────────────────────
    const amplifyServiceRole = new Role(this, 'AmplifyServiceRole', {
      assumedBy: new ServicePrincipal('amplify.us-east-1.amazonaws.com'),
      roleName: `spotterspace-${stage}-amplify-service`,
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify'),
      ],
    });

    // ─── CloudFormation Outputs ──────────────────────────────────────────
    new CfnOutput(this, 'DBInstanceEndpoint', {
      value: db.instanceEndpoint.hostname,
    });

    new CfnOutput(this, 'DBUrlSecretArn', {
      value: dbUrlSecret.secretArn,
    });

    new CfnOutput(this, 'JWTSecretArn', {
      value: jwtSecret.secretArn,
    });

    new CfnOutput(this, 'LambdaExecutionRoleArn', {
      value: lambdaExecutionRole.roleArn,
    });

    new CfnOutput(this, 'LambdaFunctionArn', {
      value: apiLambda.functionArn,
    });

    new CfnOutput(this, 'AmplifyServiceRoleArn', {
      value: amplifyServiceRole.roleArn,
    });

    new CfnOutput(this, 'ApiFunctionUrl', {
      value: fnUrl.url,
    });

    new CfnOutput(this, 'AWSRegion', {
      value: this.region,
    });

    new CfnOutput(this, 'PhotosBucketName', {
      value: photosBucket.bucketName,
    });

    new CfnOutput(this, 'Stage', {
      value: stage,
    });
  }
}
