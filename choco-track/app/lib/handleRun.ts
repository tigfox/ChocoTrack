import { getVariants } from "../shopify/catalog";
import type { GraphqlClient } from "../shopify/client";
import { loadStock } from "../shopify/inventory";
import { submitRun, type SubmitResult } from "../shopify/submit";
import type { StockMap } from "../domain/types";
import { parseSubmitInput, type SubmitInput } from "./submitInput";

export interface RunResponse {
  readonly result: SubmitResult;
  /** Fresh quantities to show after a change or a stale-stock conflict. */
  readonly stock?: StockMap | undefined;
}

const reject = (message: string): RunResponse => ({ result: { ok: false, kind: "error", message } });

/** Validates the browser's JSON, re-reads variants from Shopify, runs the change, and returns fresh stock. */
export const handleRun = async (
  client: GraphqlClient,
  raw: unknown,
  expectedMode: SubmitInput["mode"],
): Promise<RunResponse> => {
  const parsed = parseSubmitInput(raw);
  if (!parsed.ok) return reject(parsed.error);
  const { mode, kitId, kitCount, locationId, perKit, seenStock, runId } = parsed.value;
  if (mode !== expectedMode) return reject("This request does not belong on this page.");

  // Kit sizes and inventory item ids come from Shopify, never from the browser.
  const { variants, stock: liveStock } = await getVariants(client, [kitId, ...Object.keys(perKit)]);
  const result = await submitRun(client, {
    mode,
    kit: variants.find((v) => v.id === kitId),
    kitCount,
    perKit,
    locationId,
    variants,
    stock: seenStock,
    liveStock,
    runId,
  });
  if (result.ok) return { result, stock: await loadStock(client, variants.map((v) => v.id)) };
  return { result, stock: result.kind === "conflict" ? result.stock : undefined };
};
