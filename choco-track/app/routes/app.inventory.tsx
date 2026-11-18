import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { InventoryView } from "../components/InventoryView";
import { shopHandle } from "../lib/transferLinks";
import { logError } from "../lib/logError";
import { fromAdmin } from "../shopify/client";
import { listCollections } from "../shopify/catalog";
import { friendlyMessage } from "../shopify/errors";
import { loadInventoryReport } from "../shopify/trackedCatalog";
import { authenticate } from "../shopify.server";

/** A failed read becomes a message on the page (with a Refresh button), not an error screen. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const handle = shopHandle(session.shop);
  const client = fromAdmin(admin);
  try {
    const [report, collections] = await Promise.all([loadInventoryReport(client), listCollections(client)]);
    return { report, collections, error: undefined, shopHandle: handle };
  } catch (err) {
    logError("inventory report failed", err);
    return { report: undefined, collections: [], error: friendlyMessage(err), shopHandle: handle };
  }
};

export default function Inventory() {
  const { report, collections, error, shopHandle: handle } = useLoaderData<typeof loader>();
  return <InventoryView report={report} collections={collections} error={error} shopHandle={handle} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
