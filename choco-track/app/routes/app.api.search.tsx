import type { LoaderFunctionArgs } from "react-router";
import { logError } from "../lib/logError";
import { parseSearchParams } from "../lib/searchParams";
import { fromAdmin } from "../shopify/client";
import { friendlyMessage } from "../shopify/errors";
import { searchVariants } from "../shopify/catalog";
import { authenticate } from "../shopify.server";

/** Variant search for the mix picker: `?q=<text>&collection=<gid>&limit=<n>`. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const options = parseSearchParams(new URL(request.url).searchParams);
  try {
    const result = await searchVariants(fromAdmin(admin), options);
    return { ok: true as const, ...result, limit: options.first };
  } catch (err) {
    logError("search failed", err);
    return { ok: false as const, message: friendlyMessage(err), variants: [], stock: {} };
  }
};
