import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * Mandatory privacy webhooks (customers/data_request, customers/redact, shop/redact).
 * ChocoTrack stores no customer data and no business records (only OAuth sessions), so there is
 * nothing to export or redact for customers; on shop/redact we remove any remaining sessions.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  if (topic === "SHOP_REDACT") {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
