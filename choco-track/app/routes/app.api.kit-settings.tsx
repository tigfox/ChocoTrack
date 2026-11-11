import type { ActionFunctionArgs } from "react-router";
import { handleKitSettings } from "../lib/handleKitSettings";
import { readJsonBody } from "../lib/readJsonBody";
import { fromAdmin } from "../shopify/client";
import { authenticate } from "../shopify.server";

/** Create or edit a kit from the Settings page (JSON body). Always answers JSON. */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return Response.json(await handleKitSettings(fromAdmin(admin), await readJsonBody(request)));
};
