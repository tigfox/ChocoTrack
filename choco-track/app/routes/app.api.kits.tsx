import type { ActionFunctionArgs } from "react-router";
import { logError } from "../lib/logError";
import { parseNewKit } from "../lib/newKitInput";
import { readJsonBody } from "../lib/readJsonBody";
import { fromAdmin } from "../shopify/client";
import { friendlyMessage } from "../shopify/errors";
import { createKit } from "../shopify/kits";
import { authenticate } from "../shopify.server";

/** Creates a kit product from the "Create a new kit" form (JSON body). */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const parsed = parseNewKit(await readJsonBody(request));
  if (!parsed.ok) return { ok: false as const, message: parsed.error };
  try {
    const kit = await createKit(fromAdmin(admin), parsed.value);
    return { ok: true as const, kit };
  } catch (err) {
    logError("create kit failed", err, { sku: parsed.value.sku });
    return { ok: false as const, message: friendlyMessage(err) };
  }
};
