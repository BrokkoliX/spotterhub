// SpotterSpace AWS Infrastructure — CDK v2
// Architecture: ECS Fargate (web + API) → ALB → RDS via VPC
import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
  aws_certificatemanager as acm,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_iam as iam,
  aws_route53 as route53,
  aws_secretsmanager as secretsmanager,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface SpotterSpaceStackProps extends StackProps {
  stage: 'dev' | 'prod';
  domainName?: string;
  hostedZoneId?: string;
  vpcId: string;
  albArn?: string;
  ecsSecurityGroupId?: string;
  ecsSubnetIds?: string[];
}

export class SpotterSpaceStack extends Stack {
  constructor(scope: Construct, id: string, props: SpotterSpaceStackProps) {
    super(scope, id, props);

    const {
      stage,
      domainName,
      hostedZoneId,
      vpcId,
      albArn,
      ecsSecurityGroupId,
      ecsSubnetIds,
    } = props;

    // ─── VPC ───────────────────────────────────────────────────────────────
    const vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', { vpcId });

    // Use only private subnets for ECS tasks (so they can reach Secrets Manager via interface endpoint)
    const subnetIds = ecsSubnetIds ?? [
      'subnet-082c94f0897298f6e',
      'subnet-096b774ed307c85ed',
    ];

    const ecsSgId = ecsSecurityGroupId ?? 'sg-08e5864c53710a095';
    const ecsSg = ec2.SecurityGroup.fromSecurityGroupId(this, 'EcsSecurityGroup', ecsSgId);

    // ─── Additional SG Rules (previously manual) ───────────────────────────
    // Secrets Manager endpoint SG — allow ECS to pull secrets
    const secretsEndpointSg = ec2.SecurityGroup.fromSecurityGroupId(
      this,
      'SecretsEndpointSG',
      'sg-0ddf2cd67fa1b09f0',
    );
    secretsEndpointSg.addIngressRule(ecsSg, ec2.Port.tcp(443), 'Allow ECS to reach Secrets Manager');

    // RDS SG — allow ECS to connect to database
    const rdsSg = ec2.SecurityGroup.fromSecurityGroupId(this, 'RdsSG', 'sg-0925439b428efdf13');
    rdsSg.addIngressRule(ecsSg, ec2.Port.tcp(5432), 'Allow ECS to reach RDS');

    // ECS/ALB SG — self-referencing so ALB can forward to ECS tasks
    ecsSg.addIngressRule(ecsSg, ec2.Port.allTraffic(), 'Allow ALB to ECS traffic');

    // ─── ALB ──────────────────────────────────────────────────────────────
    const albArnStr = albArn ?? 'arn:aws:elasticloadbalancing:us-east-1:654654553862:loadbalancer/app/spotterspace-alb/c1d7545a9ffd1121';
    const alb = elbv2.ApplicationLoadBalancer.fromLookup(this, 'ExistingALB', {
      loadBalancerArn: albArnStr,
    });

    // ─── S3 Bucket ─────────────────────────────────────────────────────────
    const photosBucket = s3.Bucket.fromBucketName(
      this,
      'PhotosBucket',
      process.env['S3_BUCKET_NAME'] ?? 'spotterspace-photos',
    );

    // ─── Secrets ───────────────────────────────────────────────────────────
    const dbUrlSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'DBUrlSecret',
      'arn:aws:secretsmanager:us-east-1:654654553862:secret:spotterhub/DATABASE_URL-fFpNor',
    );

    const jwtSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'JWTSecret',
      'arn:aws:secretsmanager:us-east-1:654654553862:secret:spotterhub/JWT_SECRET-V8C46k',
    );

    const resendSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this,
      'ResendSecret',
      'arn:aws:secretsmanager:us-east-1:654654553862:secret:spotterhub/RESEND_API_KEY-H26Fqt',
    );

    // ─── ECR Repos ─────────────────────────────────────────────────────────
    const webEcrRepo = ecr.Repository.fromRepositoryName(this, 'WebEcrRepo', `spotterspace-${stage}-web`);
    const apiEcrRepo = ecr.Repository.fromRepositoryName(this, 'ApiEcrRepo', `spotterspace-${stage}-api`);

    // ─── IAM Roles ─────────────────────────────────────────────────────────
    const taskExecutionRole = iam.Role.fromRoleArn(
      this,
      'TaskExecutionRole',
      'arn:aws:iam::654654553862:role/ecsTaskExecutionRole',
    );

    const taskRole = iam.Role.fromRoleArn(
      this,
      'TaskRole',
      'arn:aws:iam::654654553862:role/ecsSpotterSpaceTaskRole',
    );

    // ─── Log Groups ────────────────────────────────────────────────────────
    const apiLogGroup = new LogGroup(this, 'ApiLogGroup', {
      logGroupName: `/ecs/spotterspace-${stage}/api`,
      retention: RetentionDays.ONE_WEEK,
    });

    const webLogGroup = new LogGroup(this, 'WebLogGroup', {
      logGroupName: `/ecs/spotterspace-${stage}/web`,
      retention: RetentionDays.ONE_WEEK,
    });

    // ─── Target Groups (Cfn for dependency ordering) ─────────────────────
    const apiTG = new elbv2.CfnTargetGroup(this, 'ApiTargetGroup', {
      name: `spotterspace-${stage}-api-tg`,
      port: 4000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpcId,
      targetType: 'ip',
      healthCheckPath: '/health',
      healthCheckIntervalSeconds: 10,
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    const webTG = new elbv2.CfnTargetGroup(this, 'WebTargetGroup', {
      name: `spotterspace-${stage}-web-tg`,
      port: 3000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      vpcId,
      targetType: 'ip',
      healthCheckPath: '/api/health',
      healthCheckIntervalSeconds: 10,
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 3,
    });

    // ─── ALB Listener (HTTP :80) ───────────────────────────────────────────
    // Created BEFORE ECS services so target groups are registered
    const httpListener = new elbv2.CfnListener(this, 'HttpListener', {
      loadBalancerArn: alb.loadBalancerArn,
      protocol: elbv2.ApplicationProtocol.HTTP,
      port: 80,
      defaultActions: [
        {
          type: 'forward',
          targetGroupArn: webTG.ref,
        },
      ],
    });

    // Host-based rules on HTTP listener (created after listener)
    const apiListenerRule = new elbv2.CfnListenerRule(this, 'ApiListenerRule', {
      listenerArn: httpListener.ref,
      priority: 100,
      conditions: [
        {
          field: 'host-header',
          hostHeaderConfig: {
            values: [`api.${domainName ?? 'spotterspace.com'}`],
          },
        },
      ],
      actions: [
        {
          type: 'forward',
          targetGroupArn: apiTG.ref,
        },
      ],
    });

    const webListenerRule = new elbv2.CfnListenerRule(this, 'WebListenerRule', {
      listenerArn: httpListener.ref,
      priority: 200,
      conditions: [
        {
          field: 'host-header',
          hostHeaderConfig: {
            values: [`www.${domainName ?? 'spotterspace.com'}`],
          },
        },
      ],
      actions: [
        {
          type: 'forward',
          targetGroupArn: webTG.ref,
        },
      ],
    });

    // ─── HTTPS Listener (443) ──────────────────────────────────────────────
    // CDK will create the cert and add DNS validation records to Route53
    let httpsListener: elbv2.CfnListener | null = null;

    if (domainName && hostedZoneId) {
      const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HttpsHostedZone', {
        hostedZoneId,
        zoneName: domainName,
      });

      const certificate = new acm.Certificate(this, 'SiteCertificate', {
        domainName,
        subjectAlternativeNames: [`*.${domainName}`],
        validation: acm.CertificateValidation.fromDns(hostedZone),
      });

      httpsListener = new elbv2.CfnListener(this, 'HttpsListener', {
        loadBalancerArn: alb.loadBalancerArn,
        protocol: elbv2.ApplicationProtocol.HTTPS,
        port: 443,
        certificates: [{ certificateArn: certificate.certificateArn }],
        defaultActions: [
          {
            type: 'forward',
            targetGroupArn: webTG.ref,
          },
        ],
      });

      // Host-based HTTPS rule: api.spotterspace.com → apiTG (priority 100)
      new elbv2.CfnListenerRule(this, 'HttpsApiListenerRule', {
        listenerArn: httpsListener.ref,
        priority: 100,
        conditions: [
          {
            field: 'host-header',
            hostHeaderConfig: {
              values: [`api.${domainName}`],
            },
          },
        ],
        actions: [
          {
            type: 'forward',
            targetGroupArn: apiTG.ref,
          },
        ],
      });
    }

    // ─── Task Definitions (Cfn) ─────────────────────────────────────────────
    const apiTaskDef = new ecs.CfnTaskDefinition(this, 'ApiTaskDef', {
      family: `spotterspace-${stage}-api`,
      cpu: '1024',
      memory: '2048',
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      executionRoleArn: taskExecutionRole.roleArn,
      taskRoleArn: taskRole.roleArn,
      containerDefinitions: [
        {
          name: 'api',
           image: apiEcrRepo.repositoryUri + ':latest',          portMappings: [{ containerPort: 4000, protocol: 'tcp' }],
          secrets: [
            { name: 'DATABASE_URL', valueFrom: dbUrlSecret.secretArn + ':DATABASE_URL::' },
            { name: 'JWT_SECRET', valueFrom: jwtSecret.secretArn + ':JWT_SECRET::' },
          ],
          environment: [
            { name: 'NODE_ENV', value: 'production' },
            { name: 'STAGE', value: stage },
            { name: 'AWS_REGION', value: this.region },
            { name: 'API_PORT', value: '4000' },
            { name: 'PHOTOS_BUCKET_NAME', value: photosBucket.bucketName },
          ],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': apiLogGroup.logGroupName,
              'awslogs-stream-prefix': 'api',
              'awslogs-region': this.region,
            },
          },
          healthCheck: {
            command: ['CMD', 'wget', '-qO-', 'http://localhost:4000/health'],
            interval: 10,
            timeout: 5,
            retries: 3,
            startPeriod: 30,
          },
        },
      ],
    });

    const webTaskDef = new ecs.CfnTaskDefinition(this, 'WebTaskDef', {
      family: `spotterspace-${stage}-web`,
      cpu: '1024',
      memory: '2048',
      networkMode: 'awsvpc',
      requiresCompatibilities: ['FARGATE'],
      executionRoleArn: taskExecutionRole.roleArn,
      containerDefinitions: [
        {
          name: 'web',
           image: webEcrRepo.repositoryUri + ':latest',          portMappings: [{ containerPort: 3000, protocol: 'tcp' }],
          environment: [
            { name: 'NODE_ENV', value: 'production' },
            {
              name: 'NEXT_PUBLIC_API_URL',
              value: domainName
                ? `https://api.${domainName}/graphql`
                : 'https://api.spotterspace.com/graphql',
            },
            { name: 'HOSTNAME', value: '0.0.0.0' },
          ],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': webLogGroup.logGroupName,
              'awslogs-stream-prefix': 'web',
              'awslogs-region': this.region,
            },
          },
          healthCheck: {
            command: ['CMD', 'wget', '-qO-', 'http://localhost:3000/api/health'],
            interval: 10,
            timeout: 5,
            retries: 3,
            startPeriod: 30,
          },
        },
      ],
    });

    // ─── ECS Cluster ────────────────────────────────────────────────────────
    const cluster = ecs.Cluster.fromClusterArn(
      this,
      'EcsCluster',
      `arn:aws:ecs:${this.region}:654654553862:cluster/spotterspace-cluster`,
    );

    // ─── ECS Services — use CfnService (L2 FargateService has taskRole runtime requirement) ─
    // loadBalancers config auto-registers task IPs with ALB target groups
    const apiService = new ecs.CfnService(this, 'ApiService', {
      cluster: cluster.clusterName,
      serviceName: `spotterspace-${stage}-api`,
      taskDefinition: apiTaskDef.ref,
      desiredCount: 1,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: subnetIds,
          securityGroups: [ecsSgId],
          assignPublicIp: 'DISABLED',
        },
      },
      loadBalancers: [
        {
          containerName: 'api',
          containerPort: 4000,
          targetGroupArn: apiTG.ref,
        },
      ],
    });

    const webService = new ecs.CfnService(this, 'WebService', {
      cluster: cluster.clusterName,
      serviceName: `spotterspace-${stage}-web`,
      taskDefinition: webTaskDef.ref,
      desiredCount: 1,
      launchType: 'FARGATE',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: subnetIds,
          securityGroups: [ecsSgId],
          assignPublicIp: 'DISABLED',
        },
      },
      loadBalancers: [
        {
          containerName: 'web',
          containerPort: 3000,
          targetGroupArn: webTG.ref,
        },
      ],
    });

    // ─── Dependency ordering ───────────────────────────────────────────────
    // ECS services must wait for ALB listeners + target groups to exist
    apiService.addDependency(httpListener);
    apiService.addDependency(apiTG);
    webService.addDependency(httpListener);
    webService.addDependency(webTG);
    if (httpsListener) {
      apiService.addDependency(httpsListener);
      webService.addDependency(httpsListener);
    }

    // ─── Route 53 CNAMEs ───────────────────────────────────────────────────
    if (domainName && hostedZoneId) {
      const dnsHostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'DnsHostedZone', {
        hostedZoneId,
        zoneName: domainName,
      });

      new route53.CnameRecord(this, 'WwwCnameRecord', {
        zone: dnsHostedZone,
        recordName: `www.${domainName}`,
        domainName: alb.loadBalancerDnsName,
      });

      new route53.CnameRecord(this, 'ApiCnameRecord', {
        zone: dnsHostedZone,
        recordName: `api.${domainName}`,
        domainName: alb.loadBalancerDnsName,
      });
    }

    // ─── Outputs ───────────────────────────────────────────────────────────
    new CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new CfnOutput(this, 'ApiServiceArn', { value: apiService.attrServiceArn });
    new CfnOutput(this, 'WebServiceArn', { value: webService.attrServiceArn });
    new CfnOutput(this, 'ApiTaskDefinitionArn', { value: apiTaskDef.ref });
    new CfnOutput(this, 'WebTaskDefinitionArn', { value: webTaskDef.ref });
    new CfnOutput(this, 'AlbDnsName', { value: alb.loadBalancerDnsName });
    new CfnOutput(this, 'AlbArn', { value: alb.loadBalancerArn });
    new CfnOutput(this, 'Stage', { value: stage });
  }
}