import type { ActionFunctionArgs } from "react-router";
import { handleInventory } from "../lib/handleInventory";
import { forgetLowCount } from "../lib/lowCount";
import { readJsonBody } from "../lib/readJsonBody";
import { fromAdmin } from "../shopify/client";
import { authenticate } from "../shopify.server";

/** Flag a product, save targets, save source locations, or create draft transfers (JSON body). Always answers JSON. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const result = await handleInventory(fromAdmin(admin), await readJsonBody(request));
  if (result.ok) forgetLowCount(session.shop);
  return Response.json(result);
};
