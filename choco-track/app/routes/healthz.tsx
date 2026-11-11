import db from "../db.server";
import { checkHealth } from "../lib/health";

/** Unauthenticated on purpose: used by Docker and uptime checks. Reveals nothing but ok / unavailable. */
export const loader = async () => {
  const report = await checkHealth(() => db.$queryRaw`SELECT 1`);
  return new Response(report.body, { status: report.status, headers: { "Cache-Control": "no-store" } });
};
