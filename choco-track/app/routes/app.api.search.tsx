import type { LoaderFunctionArgs } from "react-router";
import { parseSearchParams } from "../lib/searchParams";
import { fromAdmin } from "../shopify/client";
import { friendlyMessage } from "../shopify/errors";
import { searchWithStock } from "../shopify/workspace";
import { authenticate } from "../shopify.server";

/** Variant search for the mix picker: `?q=<text>&collection=<gid>&limit=<n>`. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const options = parseSearchParams(new URL(request.url).searchParams);
  try {
    const result = await searchWithStock(fromAdmin(admin), options);
    return { ok: true as const, ...result, limit: options.first };
  } catch (err) {
    console.error("search failed", err);
    return { ok: false as const, message: friendlyMessage(err), variants: [], stock: {} };
  }
};
