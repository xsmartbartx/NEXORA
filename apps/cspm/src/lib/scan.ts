/**
 * The real check engine behind CSPM today: rule-based evaluation of a
 * resource description you provide (§5.2's "description" field for this
 * product is explicit about the scope: "resource data you paste in").
 * Connecting a live cloud account — polling AWS/GCP/Azure APIs instead of
 * reading pasted JSON — is a later extension of this same rule set, not a
 * rewrite: each check function below takes a resource, not a live API
 * response, so swapping the source doesn't touch the rules.
 */

export type FindingSeverity = "info" | "warning" | "critical";

export interface Finding {
  resource: string;
  type: string;
  severity: FindingSeverity;
  rule: string;
  message: string;
}

export interface CloudResource {
  type: string;
  name: string;
  [key: string]: unknown;
}

export interface ScanResult {
  totalResources: number;
  findings: Finding[];
}

const SENSITIVE_PORTS = new Set([22, 3389, 3306, 5432, 6379, 27017]);

function checkS3Bucket(resource: CloudResource): Finding[] {
  const findings: Finding[] = [];
  if (resource.public_read === true || resource.public_access === true) {
    findings.push({
      resource: resource.name,
      type: "s3_bucket",
      severity: "critical",
      rule: "s3-public-read",
      message: "Bucket allows public read access.",
    });
  }
  if (resource.encrypted === false) {
    findings.push({
      resource: resource.name,
      type: "s3_bucket",
      severity: "warning",
      rule: "s3-unencrypted",
      message: "Bucket is not encrypted at rest.",
    });
  }
  return findings;
}

function checkSecurityGroup(resource: CloudResource): Finding[] {
  const findings: Finding[] = [];
  const ingress = Array.isArray(resource.ingress)
    ? (resource.ingress as { port?: number; cidr?: string }[])
    : [];

  for (const rule of ingress) {
    if (rule.cidr !== "0.0.0.0/0") continue;
    if (typeof rule.port === "number" && SENSITIVE_PORTS.has(rule.port)) {
      findings.push({
        resource: resource.name,
        type: "security_group",
        severity: "critical",
        rule: "sg-open-sensitive-port",
        message: `Port ${rule.port} open to 0.0.0.0/0.`,
      });
    } else {
      findings.push({
        resource: resource.name,
        type: "security_group",
        severity: "warning",
        rule: "sg-open-ingress",
        message: `Ingress open to 0.0.0.0/0${typeof rule.port === "number" ? ` on port ${rule.port}` : ""}.`,
      });
    }
  }
  return findings;
}

function checkIamPolicy(resource: CloudResource): Finding[] {
  const actions = Array.isArray(resource.actions) ? (resource.actions as string[]) : [];
  const resources = Array.isArray(resource.resources) ? (resource.resources as string[]) : [];

  if (actions.includes("*") && resources.includes("*")) {
    return [
      {
        resource: resource.name,
        type: "iam_policy",
        severity: "critical",
        rule: "iam-wildcard-admin",
        message: 'Policy grants "*" action on "*" resource — effectively admin.',
      },
    ];
  }
  if (actions.includes("*")) {
    return [
      {
        resource: resource.name,
        type: "iam_policy",
        severity: "warning",
        rule: "iam-wildcard-action",
        message: "Policy grants a wildcard action.",
      },
    ];
  }
  return [];
}

function checkDatabase(resource: CloudResource): Finding[] {
  const findings: Finding[] = [];
  if (resource.publicly_accessible === true) {
    findings.push({
      resource: resource.name,
      type: "database",
      severity: "critical",
      rule: "db-public",
      message: "Database is publicly accessible.",
    });
  }
  if (resource.encrypted === false) {
    findings.push({
      resource: resource.name,
      type: "database",
      severity: "warning",
      rule: "db-unencrypted",
      message: "Database is not encrypted at rest.",
    });
  }
  return findings;
}

const CHECKS: Record<string, (resource: CloudResource) => Finding[]> = {
  s3_bucket: checkS3Bucket,
  security_group: checkSecurityGroup,
  iam_policy: checkIamPolicy,
  database: checkDatabase,
};

export function scanResources(resources: CloudResource[]): ScanResult {
  const findings: Finding[] = [];
  for (const resource of resources) {
    const check = CHECKS[resource.type];
    if (check) findings.push(...check(resource));
  }
  return { totalResources: resources.length, findings };
}

export function parseResourcesInput(raw: string): CloudResource[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Not valid JSON.");
  }

  const list = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { resources?: unknown }).resources)
      ? (parsed as { resources: unknown[] }).resources
      : null;

  if (!list) {
    throw new Error('Expected a JSON array of resources, or { "resources": [...] }.');
  }

  return list.map((item, i) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).type !== "string" ||
      typeof (item as Record<string, unknown>).name !== "string"
    ) {
      throw new Error(`Resource at index ${i} must have "type" and "name" string fields.`);
    }
    return item as CloudResource;
  });
}
