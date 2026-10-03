import type { ControlCenterSnapshot } from "./index";

export type AttentionLevel = "critical" | "warning";

export interface AttentionItem {
  level: AttentionLevel;
  text: string;
}

const level = (l: AttentionLevel, text: string): AttentionItem => ({ level: l, text });

/**
 * Everything on the dashboard that's wrong right now, worst first. A tile
 * that is merely not connected is not an issue; one that is configured but
 * failed to load is, because a blind spot you can't see is the dangerous
 * kind.
 */
export function attentionItems(snapshot: ControlCenterSnapshot): AttentionItem[] {
  const items: AttentionItem[] = [];
  const { health, application, security, business, checklist } = snapshot;

  const failed = (name: string, tile: { state: string }) => {
    if (tile.state === "error") items.push(level("warning", `${name} couldn't be loaded.`));
  };

  if (health.endpoints.state === "ok") {
    for (const endpoint of health.endpoints.data) {
      if (endpoint.status === "down") items.push(level("critical", `${endpoint.name} is down.`));
      if (endpoint.status === "degraded") {
        items.push(level("warning", `${endpoint.name} is responding slowly.`));
      }
    }
  } else failed("Endpoint health", health.endpoints);

  if (health.database.state === "error") {
    items.push(level("critical", "The Console can't reach Postgres."));
  }

  if (health.backup.state === "ok" && health.backup.data.status !== "ok") {
    items.push(level("critical", `The nightly backup is ${health.backup.data.status}.`));
  } else failed("Backup status", health.backup);

  if (health.infra.state === "ok") {
    const m = health.infra.data;
    if (m.postgresUp === false)
      items.push(level("critical", "Postgres exporter reports Postgres down."));
    if (m.redisUp === false) items.push(level("critical", "Redis exporter reports Redis down."));
    for (const job of m.targetsDown) {
      items.push(level("warning", `Prometheus can't scrape ${job}.`));
    }
    if (m.diskFreePercent !== null && m.diskFreePercent < 10) {
      items.push(level("critical", `Root disk is ${(100 - m.diskFreePercent).toFixed(0)}% full.`));
    } else if (m.diskFreePercent !== null && m.diskFreePercent < 20) {
      items.push(level("warning", `Root disk is ${(100 - m.diskFreePercent).toFixed(0)}% full.`));
    }
    if (m.cpuPercent !== null && m.cpuPercent > 90)
      items.push(level("warning", "CPU is above 90%."));
    if (m.memoryPercent !== null && m.memoryPercent > 90) {
      items.push(level("warning", "Host memory is above 90%."));
    }
    if (m.redisMemoryPercent !== null && m.redisMemoryPercent > 90) {
      items.push(level("warning", "Redis is above 90% of its memory limit."));
    }
  } else failed("Infrastructure metrics", health.infra);

  if (security.certificates.state === "ok") {
    for (const cert of security.certificates.data) {
      if (cert.daysLeft === null)
        items.push(level("warning", `Couldn't check the certificate for ${cert.host}.`));
      else if (cert.daysLeft < 7)
        items.push(
          level(
            "critical",
            `${cert.host}'s certificate expires in ${Math.max(cert.daysLeft, 0)} days.`,
          ),
        );
      else if (cert.daysLeft < 21)
        items.push(
          level("warning", `${cert.host}'s certificate expires in ${cert.daysLeft} days.`),
        );
    }
  } else failed("Certificate expiry", security.certificates);

  if (security.codeSecurity.state === "ok") {
    const { totals, secrets } = security.codeSecurity.data;
    if (totals.critical > 0)
      items.push(level("critical", `${totals.critical} critical security alert(s) open.`));
    if (secrets > 0) items.push(level("critical", `${secrets} leaked-secret alert(s) open.`));
    if (totals.high > 0)
      items.push(level("warning", `${totals.high} high-severity security alert(s) open.`));
  } else failed("Security alerts", security.codeSecurity);

  if (application.ci.state === "ok") {
    for (const repo of application.ci.data) {
      for (const workflow of repo.workflows) {
        if (workflow.conclusion === "failure") {
          items.push(
            level("warning", `${repo.repo.split("/")[1]}: ${workflow.name} is failing on main.`),
          );
        }
      }
    }
  } else failed("CI status", application.ci);

  if (business.revenue.state === "ok" && business.revenue.data.pastDue > 0) {
    items.push(level("warning", `${business.revenue.data.pastDue} subscription(s) are past due.`));
  } else failed("Revenue", business.revenue);

  if (checklist.state === "ok") {
    const overdue = checklist.data.filter((task) => task.state === "overdue").length;
    if (overdue > 0) items.push(level("warning", `${overdue} owner review(s) are overdue.`));
  } else failed("The owner checklist", checklist);

  failed("Sentry", application.sentry);
  failed("Customer counts", business.clerk);

  return items.sort((a, b) => (a.level === b.level ? 0 : a.level === "critical" ? -1 : 1));
}
