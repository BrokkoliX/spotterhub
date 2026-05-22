#!/usr/bin/env node
// Diagnose AWS costs for SpotterSpace.
//
// Pulls the last 30 days of spend from Cost Explorer (grouped by service),
// checks NAT Gateway data-processing volume, ECS Fargate task utilization,
// and CloudWatch Logs ingestion to identify the real cost drivers before
// making infrastructure changes.
//
// Requires AWS credentials in the environment (AWS_PROFILE or
// AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY). Cost Explorer must be enabled
// on the account (it is on by default for the payer account).
//
// Usage:
//   AWS_PROFILE=spotterspace node scripts/diagnose-aws-costs.mjs
//   AWS_PROFILE=spotterspace node scripts/diagnose-aws-costs.mjs --days 7

import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  EC2Client,
  DescribeNatGatewaysCommand,
} from "@aws-sdk/client-ec2";
import {
  ECSClient,
  ListClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from "@aws-sdk/client-ecs";
import {
  CloudWatchLogsClient,
  DescribeLogGroupsCommand,
} from "@aws-sdk/client-cloudwatch-logs";

const REGION = process.env.AWS_REGION ?? "us-east-1";

const args = process.argv.slice(2);
const daysFlagIdx = args.indexOf("--days");
const DAYS = daysFlagIdx >= 0 ? Number(args[daysFlagIdx + 1]) : 30;

// Cost Explorer is global but billed via us-east-1
const ce = new CostExplorerClient({ region: "us-east-1" });
const cw = new CloudWatchClient({ region: REGION });
const ec2 = new EC2Client({ region: REGION });
const ecs = new ECSClient({ region: REGION });
const logs = new CloudWatchLogsClient({ region: REGION });

const fmtUsd = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const fmtBytes = (n) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n < 1024 ** 4) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  return `${(n / 1024 ** 4).toFixed(2)} TB`;
};

const today = new Date();
const start = new Date(today);
start.setDate(start.getDate() - DAYS);
const startStr = start.toISOString().slice(0, 10);
const endStr = today.toISOString().slice(0, 10);

const NL = String.fromCharCode(10);
const BAR = "─".repeat(72);

function header(title) {
  console.log(`${NL}${BAR}${NL}  ${title}${NL}${BAR}`);
}

async function topServicesByCost() {
  header(`Top spend by service (${startStr} -> ${endStr}, ${DAYS} days)`);
  const res = await ce.send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: startStr, End: endStr },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
      GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
    }),
  );
  const groups = res.ResultsByTime?.flatMap((r) => r.Groups ?? []) ?? [];
  const rows = groups
    .map((g) => ({
      service: g.Keys?.[0] ?? "?",
      cost: Number(g.Metrics?.UnblendedCost?.Amount ?? 0),
    }))
    .filter((r) => r.cost > 0.01)
    .sort((a, b) => b.cost - a.cost);

  const total = rows.reduce((s, r) => s + r.cost, 0);
  for (const r of rows.slice(0, 15)) {
    const pct = ((r.cost / total) * 100).toFixed(1).padStart(5);
    console.log(`  ${pct}%  ${fmtUsd(r.cost).padStart(10)}  ${r.service}`);
  }
  console.log(`  ${"".padStart(5)}  ${"─".repeat(10)}`);
  console.log(`  Total : ${fmtUsd(total)}`);
}

async function ecsAndFargateBreakdown() {
  header("ECS / Fargate / EC2-Other usage-type breakdown");
  const res = await ce.send(
    new GetCostAndUsageCommand({
      TimePeriod: { Start: startStr, End: endStr },
      Granularity: "MONTHLY",
      Metrics: ["UnblendedCost"],
      GroupBy: [{ Type: "DIMENSION", Key: "USAGE_TYPE" }],
      Filter: {
        Dimensions: {
          Key: "SERVICE",
          Values: [
            "Amazon Elastic Container Service",
            "AWS Fargate",
            "Amazon Elastic Compute Cloud - Compute",
            "EC2 - Other",
          ],
        },
      },
    }),
  );
  const groups = res.ResultsByTime?.flatMap((r) => r.Groups ?? []) ?? [];
  const rows = groups
    .map((g) => ({
      usage: g.Keys?.[0] ?? "?",
      cost: Number(g.Metrics?.UnblendedCost?.Amount ?? 0),
    }))
    .filter((r) => r.cost > 0.01)
    .sort((a, b) => b.cost - a.cost);

  for (const r of rows) {
    console.log(`  ${fmtUsd(r.cost).padStart(10)}  ${r.usage}`);
  }
}

async function natGatewayUsage() {
  header("NAT Gateway data processing (last 14 days)");
  const { NatGateways = [] } = await ec2.send(
    new DescribeNatGatewaysCommand({}),
  );
  if (NatGateways.length === 0) {
    console.log("  No NAT Gateways found.");
    return;
  }

  const end = new Date();
  const begin = new Date(end);
  begin.setDate(begin.getDate() - 14);

  for (const ng of NatGateways) {
    const id = ng.NatGatewayId;
    const state = ng.State;
    const stats = await cw.send(
      new GetMetricStatisticsCommand({
        Namespace: "AWS/NATGateway",
        MetricName: "BytesOutToDestination",
        Dimensions: [{ Name: "NatGatewayId", Value: id }],
        StartTime: begin,
        EndTime: end,
        Period: 86400,
        Statistics: ["Sum"],
      }),
    );
    const totalBytes =
      stats.Datapoints?.reduce((s, p) => s + (p.Sum ?? 0), 0) ?? 0;
    const gb = totalBytes / 1024 ** 3;
    const dataCost = gb * 0.045; // USD/GB processed
    const hourlyCost = 14 * 24 * 0.045; // approx fixed cost for 14 days
    console.log(
      `  ${id} (${state}) : ${fmtBytes(totalBytes)} out -> ~${fmtUsd(dataCost)} data + ~${fmtUsd(hourlyCost)} hourly`,
    );
  }
}

async function ecsServiceUtilization() {
  header("ECS service CPU / memory utilization (last 7 days avg)");
  const { clusterArns = [] } = await ecs.send(new ListClustersCommand({}));
  if (clusterArns.length === 0) {
    console.log("  No ECS clusters found.");
    return;
  }

  const end = new Date();
  const begin = new Date(end);
  begin.setDate(begin.getDate() - 7);

  for (const clusterArn of clusterArns) {
    const clusterName = clusterArn.split("/").pop();
    const { serviceArns = [] } = await ecs.send(
      new ListServicesCommand({ cluster: clusterArn }),
    );
    if (serviceArns.length === 0) continue;

    const { services = [] } = await ecs.send(
      new DescribeServicesCommand({
        cluster: clusterArn,
        services: serviceArns,
      }),
    );

    console.log(`${NL}  Cluster: ${clusterName}`);
    for (const svc of services) {
      const dims = [
        { Name: "ClusterName", Value: clusterName },
        { Name: "ServiceName", Value: svc.serviceName },
      ];
      const cpu = await cw.send(
        new GetMetricStatisticsCommand({
          Namespace: "AWS/ECS",
          MetricName: "CPUUtilization",
          Dimensions: dims,
          StartTime: begin,
          EndTime: end,
          Period: 86400,
          Statistics: ["Average", "Maximum"],
        }),
      );
      const mem = await cw.send(
        new GetMetricStatisticsCommand({
          Namespace: "AWS/ECS",
          MetricName: "MemoryUtilization",
          Dimensions: dims,
          StartTime: begin,
          EndTime: end,
          Period: 86400,
          Statistics: ["Average", "Maximum"],
        }),
      );
      const avg = (pts = []) =>
        pts.length
          ? pts.reduce((s, p) => s + (p.Average ?? 0), 0) / pts.length
          : 0;
      const max = (pts = []) =>
        pts.length ? Math.max(...pts.map((p) => p.Maximum ?? 0)) : 0;
      console.log(
        `    ${svc.serviceName.padEnd(32)} desired=${svc.desiredCount} running=${svc.runningCount}  ` +
          `CPU avg=${avg(cpu.Datapoints).toFixed(1)}% max=${max(cpu.Datapoints).toFixed(1)}%  ` +
          `MEM avg=${avg(mem.Datapoints).toFixed(1)}% max=${max(mem.Datapoints).toFixed(1)}%`,
      );
    }
  }
}

async function logIngestion() {
  header("CloudWatch Logs - top log groups by stored bytes");
  const all = [];
  let token;
  do {
    const res = await logs.send(
      new DescribeLogGroupsCommand({ nextToken: token, limit: 50 }),
    );
    all.push(...(res.logGroups ?? []));
    token = res.nextToken;
  } while (token);

  const sorted = all
    .map((g) => ({
      name: g.logGroupName ?? "?",
      stored: g.storedBytes ?? 0,
      retention: g.retentionInDays ?? null,
    }))
    .sort((a, b) => b.stored - a.stored)
    .slice(0, 10);

  for (const g of sorted) {
    const ret = g.retention ? `${g.retention}d` : "never";
    console.log(
      `  ${fmtBytes(g.stored).padStart(10)}  retention=${ret.padStart(5)}  ${g.name}`,
    );
  }
}

async function main() {
  console.log(`Region: ${REGION}`);
  console.log(`Window: ${DAYS} days (${startStr} -> ${endStr})`);
  try {
    await topServicesByCost();
    await ecsAndFargateBreakdown();
    await natGatewayUsage();
    await ecsServiceUtilization();
    await logIngestion();
    console.log(`${NL}Done.`);
  } catch (err) {
    console.error(`${NL}Error:`, err.message);
    if (err.name === "AccessDeniedException") {
      console.error(
        "Hint: ensure your IAM principal has ce:GetCostAndUsage, cloudwatch:GetMetricStatistics, ecs:List/Describe*, ec2:DescribeNatGateways, logs:DescribeLogGroups.",
      );
    }
    process.exit(1);
  }
}

main();
