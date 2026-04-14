// SpotterSpace AWS Infrastructure — CDK v2
// Architecture: Dual App Runner (web + API) → RDS PostgreSQL via VPC Connector
// Deployment: CDK bootstrap + cdk deploy (see .github/workflows/deploy.yml)
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import {
  aws_apprunner as apprunner,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_iam as iam,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_secretsmanager as secretsmanager,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface SpotterSpaceStackProps extends StackProps {
  stage: 'dev' | 'prod';
  /** Root domain name, e.g. "spotterspace.com". Enables CloudFront + ACM + Route 53. */
  domainName?: string;
  /** Route 53 hosted zone ID for the domain. Required when domainName is set. */
  hostedZoneId?: string;
  /** VPC ID where the RDS instance lives. App Runner VPC Connector will be created here. */
  vpcId: string;
}

export class SpotterSpaceStack extends Stack {
  constructor(scope: Construct, id: string, props: SpotterSpaceStackProps) {
    super(scope, id, props);

    const { stage, domainName, hostedZoneId, vpcId } = props;

    // ─── Import Existing VPC (contains the RDS instance) ──────────────────
    const vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', { vpcId });

    // ─── S3 Bucket for Photos ──────────────────────────────────────────────
    const photosBucket = s3.Bucket.fromBucketName(
      this,
      'PhotosBucket',
      process.env['S3_BUCKET_NAME'] ?? 'spotterspace-photos',
    );

    // ─── Secrets Manager ─────────────────────────────────────────────────
    // Import existing secrets (created manually, shared by API container).
    // Must use fromSecretCompleteArn with full ARN (including random suffix)
    // so CDK generates correct IAM policies.
    const dbUrlSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'DBUrlSecret',
      'arn:aws:secretsmanager:us-east-1:654654553862:secret:spotterspace/DATABASE_URL-fFpNor',
    );

    const jwtSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'JWTSecret',
      'arn:aws:secretsmanager:us-east-1:654654553862:secret:spotterspace/JWT_SECRET-V8C46k',
    );

    // ─── ECR Repositories (import existing) ──────────────────────────────
    const webEcrRepo = ecr.Repository.fromRepositoryName(
      this,
      'WebEcrRepo',
      `spotterspace-${stage}-web`,
    );

    const apiEcrRepo = ecr.Repository.fromRepositoryName(
      this,
      'ApiEcrRepo',
      `spotterspace-${stage}-api`,
    );

    // ─── Security Group for App Runner VPC Connector ─────────────────────
    const appRunnerSg = new ec2.SecurityGroup(this, 'AppRunnerVpcConnectorSG', {
      vpc,
      description: 'Security group for App Runner VPC Connector - allows egress to RDS',
      allowAllOutbound: true,
    });

    // Allow App Runner SG to reach the RDS security group on port 5432
    const rdsSecurityGroup = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'RdsSecurityGroup',
      'sg-0925439b428efdf13',
    );
    rdsSecurityGroup.addIngressRule(
      appRunnerSg,
      ec2.Port.tcp(5432),
      'Allow App Runner VPC Connector to reach RDS',
    );

    // Allow App Runner SG to reach the Secrets Manager VPC endpoint on port 443
    const secretsEndpointSg = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'SecretsEndpointSG',
      'sg-0ddf2cd67fa1b09f0',
    );
    secretsEndpointSg.addIngressRule(
      appRunnerSg,
      ec2.Port.tcp(443),
      'Allow App Runner VPC Connector to reach Secrets Manager VPC endpoint',
    );

    // ─── App Runner VPC Connector (shared by web + API) ──────────────────
    // Place in the private subnets (which have NAT egress for outbound internet).
    // For imported VPCs, CDK classifies subnets as "Private" (not PRIVATE_WITH_EGRESS),
    // so we select by group name which matches the CDK context cache.
    const privateSubnets = vpc.selectSubnets({ subnetGroupName: 'Private' });
    const vpcConnector = new apprunner.CfnVpcConnector(this, 'VpcConnector', {
      vpcConnectorName: `spotterspace-${stage}-vpc-connector`,
      subnets: privateSubnets.subnetIds,
      securityGroups: [appRunnerSg.securityGroupId],
    });

    // ─── App Runner Access Role (ECR pull — shared) ──────────────────────
    const appRunnerAccessRole = new iam.Role(this, 'AppRunnerAccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      roleName: `spotterspace-${stage}-apprunner-access`,
    });

    appRunnerAccessRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    );

    appRunnerAccessRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'ecr:BatchCheckLayerAvailability',
          'ecr:GetDownloadUrlForLayer',
          'ecr:BatchGetImage',
        ],
        resources: [webEcrRepo.repositoryArn, apiEcrRepo.repositoryArn],
      }),
    );

    // ─── App Runner Instance Role for API (Secrets Manager + S3) ─────────
    const apiInstanceRole = new iam.Role(this, 'ApiInstanceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      roleName: `spotterspace-${stage}-api-instance`,
    });

    apiInstanceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:GetSecretValue'],
        resources: [dbUrlSecret.secretArn, jwtSecret.secretArn],
      }),
    );

    apiInstanceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['s3:GetObject', 's3:PutObject', 's3:ListBucket', 's3:DeleteObject'],
        resources: [photosBucket.bucketArn, `${photosBucket.bucketArn}/*`],
      }),
    );

    // ─── API App Runner Service ──────────────────────────────────────────
    const apiService = new apprunner.CfnService(this, 'ApiService', {
      serviceName: `spotterspace-${stage}-api`,
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: appRunnerAccessRole.roleArn,
        },
        autoDeploymentsEnabled: false,
        imageRepository: {
          imageIdentifier: `${apiEcrRepo.repositoryUri}:latest`,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '4000',
            runtimeEnvironmentVariables: [
              { name: 'NODE_ENV', value: 'production' },
              { name: 'STAGE', value: stage },
              { name: 'AWS_REGION', value: this.region },
              { name: 'API_PORT', value: '4000' },
              { name: 'PHOTOS_BUCKET_NAME', value: photosBucket.bucketName },
            ],
          },
        },
      },
      instanceConfiguration: {
        cpu: '1 vCPU',
        memory: '2 GB',
        instanceRoleArn: apiInstanceRole.roleArn,
      },
      healthCheckConfiguration: {
        path: '/health',
        protocol: 'HTTP',
        interval: 10,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
      },
      networkConfiguration: {
        egressConfiguration: {
          egressType: 'VPC',
          vpcConnectorArn: vpcConnector.attrVpcConnectorArn,
        },
      },
    });

    // The API service URL (e.g. "abc123.us-east-1.awsapprunner.com")
    const apiServiceUrl = apiService.getAtt('ServiceUrl').toString();

    // ─── Web App Runner Service ──────────────────────────────────────────
    const webService = new apprunner.CfnService(this, 'WebService', {
      serviceName: `spotterspace-${stage}-web`,
      sourceConfiguration: {
        authenticationConfiguration: {
          accessRoleArn: appRunnerAccessRole.roleArn,
        },
        autoDeploymentsEnabled: false,
        imageRepository: {
          imageIdentifier: `${webEcrRepo.repositoryUri}:latest`,
          imageRepositoryType: 'ECR',
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              {
                name: 'NEXT_PUBLIC_API_URL',
                value: domainName
                  ? `https://api.${domainName}/graphql`
                  : `https://${apiServiceUrl}/graphql`,
              },
              { name: 'NODE_ENV', value: 'production' },
              { name: 'HOSTNAME', value: '0.0.0.0' },
            ],
          },
        },
      },
      instanceConfiguration: {
        cpu: '1 vCPU',
        memory: '2 GB',
      },
      healthCheckConfiguration: {
        path: '/api/health',
        protocol: 'HTTP',
        interval: 10,
        healthyThreshold: 2,
        unhealthyThreshold: 3,
      },
      networkConfiguration: {
        egressConfiguration: {
          egressType: 'DEFAULT',
        },
      },
    });

    const webServiceUrl = webService.getAtt('ServiceUrl').toString();

    // ─── Custom Domain: CloudFront + ACM + Route 53 ────────────────────────
    // Apex domain (spotterspace.com) → 301 redirect → www.spotterspace.com
    // www.spotterspace.com → CNAME → Web App Runner
    // api.spotterspace.com → CNAME → API App Runner
    if (domainName && hostedZoneId) {
      const wwwDomain = `www.${domainName}`;
      const apiDomain = `api.${domainName}`;

      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
        hostedZoneId,
        zoneName: domainName,
      });

      // ACM certificate for root + wildcard (must be in us-east-1 for CloudFront)
      const certificate = new acm.Certificate(this, 'SiteCertificate', {
        domainName,
        subjectAlternativeNames: [`*.${domainName}`],
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });

      // CloudFront Function: redirect apex → www
      const redirectFunction = new cloudfront.Function(this, 'ApexRedirectFunction', {
        functionName: `spotterspace-${stage}-apex-redirect`,
        code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var host = request.headers.host.value;
  if (host === "${domainName}") {
    return {
      statusCode: 301,
      statusDescription: "Moved Permanently",
      headers: {
        location: { value: "https://${wwwDomain}" + request.uri }
      }
    };
  }
  return request;
}
        `.trim()),
        comment: `Redirect ${domainName} to ${wwwDomain}`,
        runtime: cloudfront.FunctionRuntime.JS_2_0,
      });

      // CloudFront distribution — apex domain only (all requests are redirected)
      const distribution = new cloudfront.Distribution(this, 'ApexDistribution', {
        comment: `${domainName} apex redirect to ${wwwDomain}`,
        domainNames: [domainName],
        certificate,
        defaultBehavior: {
          origin: new origins.HttpOrigin(domainName, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          functionAssociations: [
            {
              function: redirectFunction,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        },
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      });

      // Route 53: apex → CloudFront (A record alias)
      new route53.ARecord(this, 'ApexAliasRecord', {
        zone: hostedZone,
        recordName: domainName,
        target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
      });

      // Route 53: www → Web App Runner (CNAME)
      new route53.CnameRecord(this, 'WwwCnameRecord', {
        zone: hostedZone,
        recordName: wwwDomain,
        domainName: webServiceUrl,
      });

      // Route 53: api → API App Runner (CNAME)
      new route53.CnameRecord(this, 'ApiCnameRecord', {
        zone: hostedZone,
        recordName: apiDomain,
        domainName: apiServiceUrl,
      });

      new CfnOutput(this, 'CertificateArn', { value: certificate.certificateArn });
      new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
      new CfnOutput(this, 'DistributionDomainName', { value: distribution.distributionDomainName });
    }

    // ─── CloudFormation Outputs ──────────────────────────────────────────
    new CfnOutput(this, 'ApiServiceUrl', {
      value: apiServiceUrl,
      description: 'API App Runner service URL',
    });

    new CfnOutput(this, 'WebServiceUrl', {
      value: webServiceUrl,
      description: 'Web App Runner service URL',
    });

    new CfnOutput(this, 'ApiServiceArn', { value: apiService.attrServiceArn });
    new CfnOutput(this, 'WebServiceArn', { value: webService.attrServiceArn });

    new CfnOutput(this, 'ApiEcrRepositoryUri', { value: apiEcrRepo.repositoryUri });
    new CfnOutput(this, 'WebEcrRepositoryUri', { value: webEcrRepo.repositoryUri });

    new CfnOutput(this, 'DBUrlSecretArn', { value: dbUrlSecret.secretArn });
    new CfnOutput(this, 'JWTSecretArn', { value: jwtSecret.secretArn });
    new CfnOutput(this, 'PhotosBucketName', { value: photosBucket.bucketName });
    new CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new CfnOutput(this, 'Stage', { value: stage });
    new CfnOutput(this, 'AWSRegion', { value: this.region });
  }
}
