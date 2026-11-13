import type { LoaderFunctionArgs } from "react-router";
import { logError } from "../lib/logError";
import { computeLowCount, readLowCount } from "../lib/lowCount";
import { fromAdmin } from "../shopify/client";
import { loadInventoryReport } from "../shopify/trackedCatalog";
import { authenticate } from "../shopify.server";

/** How many tracked variants are low, for the sidebar. Kept for a minute so every page view does not re-read Shopify. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const client = fromAdmin(admin);
  try {
    const count = await readLowCount(session.shop, async () => computeLowCount(await loadInventoryReport(client)));
    return Response.json({ ok: true as const, count });
  } catch (err) {
    logError("low-stock count failed", err);
    return Response.json({ ok: false as const });
  }
};
