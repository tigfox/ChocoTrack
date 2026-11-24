import type { LoaderFunctionArgs } from "react-router";
import { logError } from "../lib/logError";
import { parseSearchParams } from "../lib/searchParams";
import { fromAdmin } from "../shopify/client";
import { friendlyMessage } from "../shopify/errors";
import { searchProductsForFlag } from "../shopify/inventoryWrites";
import { authenticate } from "../shopify.server";

/** Products to flag for the report, sorted by title: `?q=<text>&collection=<gid>&limit=<n>`. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { text, collectionId, first } = parseSearchParams(new URL(request.url).searchParams);
  try {
    const products = await searchProductsForFlag(fromAdmin(admin), { text, first, ...(collectionId ? { collectionId } : {}) });
    return Response.json({ ok: true as const, products });
  } catch (err) {
    logError("product search for flagging failed", err);
    return Response.json({ ok: false as const, message: friendlyMessage(err) });
  }
};
