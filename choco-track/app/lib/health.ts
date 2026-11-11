export interface HealthReport {
  readonly ok: boolean;
  readonly status: 200 | 503;
  readonly body: string;
}

/** Liveness plus a cheap database check, for the load balancer / Docker healthcheck. */
export const checkHealth = async (pingDatabase: () => Promise<unknown>): Promise<HealthReport> => {
  try {
    await pingDatabase();
    return { ok: true, status: 200, body: "ok" };
  } catch {
    return { ok: false, status: 503, body: "database unavailable" };
  }
};
