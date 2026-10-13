import type { Notification } from "./types";

export type Priority = "high" | "default" | "low";

export interface Rendered {
  title: string;
  message: string;
  priority: Priority;
  tags: string[];
  /** Where to look: the Control Center. */
  url?: string;
  kind: Notification["kind"];
  severity: Notification["severity"];
  source: string;
}

const SECRET_SHAPED =
  /\b(sk_live_[A-Za-z0-9]{8,}|rk_live_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|AKIA[0-9A-Z]{16})/g;

/** An alert text should never carry a secret, but if one ever slips in it must not leave the building. */
export function redact(text: string): string {
  return text.replace(SECRET_SHAPED, "[redacted]");
}

export function describeAge(since: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((now.getTime() - since.getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`;
}

const LABEL: Record<Notification["kind"], string> = {
  opened: "",
  escalated: "ESCALATED to critical: ",
  reminder: "STILL OPEN: ",
  resolved: "RESOLVED: ",
};

export function render(n: Notification, now: Date, consoleUrl?: string): Rendered {
  const severity = n.severity === "critical" ? "CRITICAL: " : "Warning: ";
  const prefix = n.kind === "opened" ? severity : LABEL[n.kind];
  const lines = [n.detail ? redact(n.detail) : null];
  lines.push(
    n.kind === "resolved"
      ? `It lasted ${describeAge(n.since, now)}.`
      : `Open for ${describeAge(n.since, now)}.`,
  );
  const tags =
    n.kind === "resolved"
      ? ["white_check_mark"]
      : n.severity === "critical"
        ? ["rotating_light"]
        : ["warning"];
  return {
    title: redact(`${prefix}${n.title}`),
    message: lines.filter(Boolean).join("\n"),
    priority: n.kind === "resolved" ? "low" : n.severity === "critical" ? "high" : "default",
    tags,
    url: consoleUrl ? `${consoleUrl.replace(/\/$/, "")}/admin/control-center` : undefined,
    kind: n.kind,
    severity: n.severity,
    source: n.source,
  };
}
