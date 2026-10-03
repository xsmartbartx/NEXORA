export type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved";

export interface IncidentUpdate {
  at: string;
  status: IncidentStatus;
  message: string;
}

export interface Incident {
  id: string;
  title: string;
  startedAt: string;
  updates: IncidentUpdate[];
}

export interface Maintenance {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
}

/**
 * Hand-published, newest first. Deliberately empty until a real incident
 * happens: fabricating history would be the opposite of a status page.
 * Add a record here (and deploy) to publish an incident or maintenance window.
 */
export const incidents: Incident[] = [];

export const maintenanceWindows: Maintenance[] = [];
