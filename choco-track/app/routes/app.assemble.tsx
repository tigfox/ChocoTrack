import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AssembleView } from "../components/AssembleView";
import { parseSubmitInput } from "../lib/submitInput";
import { getVariants } from "../shopify/catalog";
import { fromAdmin } from "../shopify/client";
import { loadStock } from "../shopify/inventory";
import { submitRun } from "../shopify/submit";
import { loadWorkspace } from "../shopify/workspace";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  return loadWorkspace(fromAdmin(admin));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const parsed = parseSubmitInput(await request.json().catch(() => null));
  if (!parsed.ok) return { result: { ok: false as const, kind: "error" as const, message: parsed.error } };
  const { mode, kitId, kitCount, locationId, perKit, seenStock, runId } = parsed.value;
  const client = fromAdmin(admin);

  // Kit sizes and inventory item ids come from Shopify, never from the browser.
  const variants = await getVariants(client, [kitId, ...Object.keys(perKit)]);
  const result = await submitRun(client, {
    mode,
    kit: variants.find((v) => v.id === kitId),
    kitCount,
    perKit,
    locationId,
    variants,
    stock: seenStock,
    runId,
  });
  if (result.ok) {
    const stock = await loadStock(client, variants.map((v) => v.id));
    return { result, stock };
  }
  return { result, stock: result.kind === "conflict" ? result.stock : undefined };
};

export default function Assemble() {
  const workspace = useLoaderData<typeof loader>();
  return <AssembleView workspace={workspace} />;
}

export const headers: HeadersFunction = (headersArgs) => boundary.headers(headersArgs);
