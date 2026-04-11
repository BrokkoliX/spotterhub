import { CfnOutput, Duration, RemovalPolicy, SecretValue, Stack, StackProps } from 'aws-cdk-lib';
import {
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_iam as iam,
  aws_rds as rds,
  aws_secretsmanager as secretsmanager,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { CfnService } from 'aws-cdk-lib/aws-apprunner';
import { Construct } from 'constructs';

export interface SpotterHubStackProps extends StackProps {
  stage: 'dev' | 'prod';
  jwtSecretInitialValue: string;
}

export class SpotterHubStack extends Stack {
  constructor(scope: Construct, id: string, props: SpotterHubStackProps) {
    super(scope, id, props);

    const { stage, jwtSecretInitialValue } = props;

    // ─── S3 Bucket for Photos ──────────────────────────────────────────────
    // Referenced from env var; bucket is created at runtime by the API
    const photosBucket = s3.Bucket.fromBucketName(
      this,
      'PhotosBucket',
      process.env['S3_BUCKET_NAME'] ?? 'spotterhub-photos',
    );

    // ─── VPC ──────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'SpotterHubVPC', {
      maxAzs: 1,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    // ─── Security Group for RDS ──────────────────────────────────────────
    const dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc,
      allowAllOutbound: true,
    });
    dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4('0.0.0.0/0'),
      ec2.Port.tcp(5432),
      'PostgreSQL from App Runner',
    );

    // ─── RDS PostgreSQL 16 ───────────────────────────────────────────────
    const dbInstanceType =
      stage === 'prod'
        ? ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL)
        : ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO);

    const db = new rds.DatabaseInstance(this, 'SpotterHubDB', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: dbInstanceType,
      credentials: rds.Credentials.fromGeneratedSecret('spotterhub_admin', {
        secretName: `spotterhub/${stage}/db-admin`,
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
      secretName: `spotterhub/${stage}/DATABASE_URL`,
      secretStringValue: SecretValue.unsafePlainText(
        `postgresql://${db.instanceEndpoint.hostname}:${db.instanceEndpoint.port}/spotterhub?schema=public`,
      ),
    });

    // JWT_SECRET — user-provided initial value
    new secretsmanager.Secret(this, 'JWTSecret', {
      secretName: `spotterhub/${stage}/JWT_SECRET`,
      secretStringValue: SecretValue.unsafePlainText(jwtSecretInitialValue),
    });

    // ─── ECR Repositories ─────────────────────────────────────────────────
    const apiRepo = new ecr.Repository(this, 'SpotterHubApiRepo', {
      repositoryName: `spotterhub-${stage}-api`,
      removalPolicy:
        stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    const webRepo = new ecr.Repository(this, 'SpotterHubWebRepo', {
      repositoryName: `spotterhub-${stage}-web`,
      removalPolicy:
        stage === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // ─── IAM Execution Role for App Runner ───────────────────────────────
    const appRunnerExecutionRole = new iam.Role(
      this,
      'AppRunnerExecutionRole',
      {
        assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AppRunnerServiceRolePolicy',
          ),
        ],
      },
    );

    // Inline policy: read secrets
    appRunnerExecutionRole.attachInlinePolicy(
      new iam.Policy(this, 'SecretsReadPolicy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['secretsmanager:GetSecretValue'],
            resources: [
              dbUrlSecret.secretArn,
              `arn:aws:secretsmanager:${this.region}:${this.account}:secret:spotterhub/${stage}/JWT_SECRET*`,
            ],
          }),
        ],
      }),
    );

    // Inline policy: S3 access
    appRunnerExecutionRole.attachInlinePolicy(
      new iam.Policy(this, 'S3Policy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket'],
            resources: [photosBucket.bucketArn, `${photosBucket.bucketArn}/*`],
          }),
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['s3:CreateBucket'],
            resources: ['*'],
          }),
        ],
      }),
    );

    // ─── App Runner: API ─────────────────────────────────────────────────
    // Note: executionRole is handled by App Runner's service-linked role (auto-created).
    // The instanceRoleArn in InstanceConfiguration grants permissions to container code.
    const apiService = new CfnService(this, 'SpotterHubApiService', {
      serviceName: `spotterhub-${stage}-api`,
      healthCheckConfiguration: {
        protocol: 'HTTP',
        path: '/health',
        interval: 30,
        timeout: 5,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
      },
      instanceConfiguration: {
        cpu: '1024',
        memory: '2048',
        instanceRoleArn: appRunnerExecutionRole.roleArn,
      },
      sourceConfiguration: {
        imageRepository: {
          imageIdentifier: `${apiRepo.repositoryUri}:latest`,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '4000',
            runtimeEnvironmentVariables: [
              { name: 'NODE_ENV', value: 'production' },
              { name: 'API_PORT', value: '4000' },
              { name: 'AWS_REGION', value: this.region },
              { name: 'S3_BUCKET', value: photosBucket.bucketName },
              { name: 'S3_REGION', value: this.region },
              { name: 'STAGE', value: stage },
            ],
          },
        },
        autoDeploymentsEnabled: true,
      },
    });

    // ─── App Runner: Web ─────────────────────────────────────────────────
    const webService = new CfnService(this, 'SpotterHubWebService', {
      serviceName: `spotterhub-${stage}-web`,
      healthCheckConfiguration: {
        protocol: 'HTTP',
        path: '/',
        interval: 30,
        timeout: 5,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
      },
      instanceConfiguration: {
        cpu: '1024',
        memory: '2048',
        instanceRoleArn: appRunnerExecutionRole.roleArn,
      },
      sourceConfiguration: {
        imageRepository: {
          imageIdentifier: `${webRepo.repositoryUri}:latest`,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              { name: 'NODE_ENV', value: 'production' },
              { name: 'PORT', value: '3000' },
              { name: 'NEXT_PUBLIC_API_URL', value: `https://${apiService.attrServiceUrl}` },
              { name: 'NEXT_PUBLIC_MAPBOX_TOKEN', value: process.env['NEXT_PUBLIC_MAPBOX_TOKEN'] ?? '' },
            ],
          },
        },
        autoDeploymentsEnabled: true,
      },
    });

    // ─── CloudFormation Outputs ──────────────────────────────────────────
    new CfnOutput(this, 'ApiServiceUrl', {
      value: `https://${apiService.attrServiceUrl}`,
      exportName: `SpotterHub-${stage}-ApiUrl`,
    });

    new CfnOutput(this, 'WebServiceUrl', {
      value: `https://${webService.attrServiceUrl}`,
      exportName: `SpotterHub-${stage}-WebUrl`,
    });

    new CfnOutput(this, 'ECRApiRepoUri', {
      value: apiRepo.repositoryUri,
    });

    new CfnOutput(this, 'ECRWebRepoUri', {
      value: webRepo.repositoryUri,
    });

    new CfnOutput(this, 'DBInstanceEndpoint', {
      value: db.instanceEndpoint.hostname,
    });

    new CfnOutput(this, 'DBUrlSecretArn', {
      value: dbUrlSecret.secretArn,
    });
  }
}
