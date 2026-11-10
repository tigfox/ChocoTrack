import type { ActionFunctionArgs } from "react-router";
import { parseNewKit } from "../lib/newKitInput";
import { fromAdmin } from "../shopify/client";
import { friendlyMessage } from "../shopify/errors";
import { createKit } from "../shopify/kits";
import { authenticate } from "../shopify.server";

/** Creates a kit product from the "Create a new kit" form (JSON body). */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const parsed = parseNewKit(await request.json().catch(() => null));
  if (!parsed.ok) return { ok: false as const, message: parsed.error };
  try {
    const kit = await createKit(fromAdmin(admin), parsed.value);
    return { ok: true as const, kit };
  } catch (err) {
    console.error("create kit failed", err);
    return { ok: false as const, message: friendlyMessage(err) };
  }
};
