import type { LoaderFunctionArgs } from "react-router";
import { fromAdmin } from "../shopify/client";
import { friendlyMessage } from "../shopify/errors";
import { searchWithStock } from "../shopify/workspace";
import { authenticate } from "../shopify.server";

const MAX_QUERY = 100;
const COLLECTION_GID = /^gid:\/\/shopify\/Collection\/\d+$/;

/** Variant search for the mix picker: `?q=<text>&collection=<gid>`. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const params = new URL(request.url).searchParams;
  const text = (params.get("q") ?? "").slice(0, MAX_QUERY);
  const collection = params.get("collection") ?? "";
  try {
    const result = await searchWithStock(fromAdmin(admin), {
      text,
      ...(COLLECTION_GID.test(collection) ? { collectionId: collection } : {}),
    });
    return { ok: true as const, ...result };
  } catch (err) {
    console.error("search failed", err);
    return { ok: false as const, message: friendlyMessage(err), variants: [], stock: {} };
  }
};
