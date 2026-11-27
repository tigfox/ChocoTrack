import type { LoaderFunctionArgs } from "react-router";
import { logError } from "../lib/logError";
import { lookupLowStatus, readLowStatus } from "../lib/lowCount";
import { fromAdmin } from "../shopify/client";
import { authenticate } from "../shopify.server";

/** How many tracked variants are low, or that setup is unfinished (no alerts), for the sidebar. Kept for a minute so every page view does not re-read Shopify. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const client = fromAdmin(admin);
  try {
    const { count, setupNeeded } = await readLowStatus(session.shop, () => lookupLowStatus(client));
    return Response.json({ ok: true as const, count, setupNeeded });
  } catch (err) {
    logError("low-stock count failed", err);
    return Response.json({ ok: false as const });
  }
};
