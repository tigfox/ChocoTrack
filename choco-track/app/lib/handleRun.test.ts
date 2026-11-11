import { ShopifyApiError } from "../shopify/errors";
import { fakeClient } from "../shopify/fakeClient";
import { handleRun } from "./handleRun";

const A = "gid://shopify/ProductVariant/1";
const KIT = "gid://shopify/ProductVariant/2";
const L = "gid://shopify/Location/3";

/** A variant as returned by Shopify, with its live stock at L (omit `qty` for "not stocked here"). */
const variantNode = (id: string, sku: string, kitSize: string | null, qty?: number) => ({
  id,
  title: "Default Title",
  sku,
  barcode: null,
  image: null,
  inventoryItem: {
    id: `gid://shopify/InventoryItem/${id.slice(-1)}`,
    inventoryLevels: { nodes: qty === undefined ? [] : [{ location: { id: L }, quantities: [{ quantity: qty }] }] },
  },
  product: { title: sku, featuredMedia: null, collections: { nodes: [] }, kitSize: kitSize ? { value: kitSize } : null },
});
const stockNode = (id: string, qty: number) => ({
  id,
  inventoryItem: { inventoryLevels: { nodes: [{ location: { id: L }, quantities: [{ quantity: qty }] }] } },
});

const body = (over: Record<string, unknown> = {}) => ({
  mode: "assemble",
  kitId: KIT,
  kitCount: 1,
  locationId: L,
  perKit: { [A]: 4 },
  seenStock: { [A]: { [L]: 10 }, [KIT]: { [L]: 0 } },
  runId: "run-12345678",
  ...over,
});
const adjusted = { inventoryAdjustQuantities: { inventoryAdjustmentGroup: { id: "g" }, userErrors: [] } };
const stale = {
  inventoryAdjustQuantities: { inventoryAdjustmentGroup: null, userErrors: [{ message: "s", code: "CHANGE_FROM_QUANTITY_STALE" }] },
};

describe("handleRun", () => {
  it("rejects malformed input before calling Shopify", async () => {
    const client = fakeClient();
    await expect(handleRun(client, { nope: 1 }, "assemble")).resolves.toMatchObject({ result: { ok: false, kind: "error" } });
    expect(client.calls).toHaveLength(0);
  });

  it("rejects a request meant for the other page", async () => {
    const client = fakeClient();
    const r = await handleRun(client, body({ mode: "disassemble" }), "assemble");
    expect(r.result).toMatchObject({ ok: false, kind: "error", message: "This request does not belong on this page." });
    expect(client.calls).toHaveLength(0);
  });

  it("assembles with one variants-and-stock read, one change and one fresh stock read", async () => {
    const client = fakeClient(
      { nodes: [variantNode(KIT, "SMP-4", "4", 0), variantNode(A, "MINI-A", null, 10)] },
      adjusted,
      { nodes: [stockNode(KIT, 1), stockNode(A, 6)] },
    );
    const r = await handleRun(client, body(), "assemble");
    expect(r.result).toMatchObject({ ok: true, adjustmentId: "g" });
    expect(r.stock).toEqual({ [KIT]: { [L]: 1 }, [A]: { [L]: 6 } });
    expect(client.calls).toHaveLength(3);
  });

  it("disassembles on the disassemble page", async () => {
    const seenStock = { [A]: { [L]: 10 }, [KIT]: { [L]: 3 } };
    const client = fakeClient(
      { nodes: [variantNode(KIT, "SMP-4", "4", 3), variantNode(A, "MINI-A", null, 10)] },
      adjusted,
      { nodes: [stockNode(KIT, 2), stockNode(A, 14)] },
    );
    const r = await handleRun(client, body({ mode: "disassemble", seenStock }), "disassemble");
    expect(r.result).toMatchObject({ ok: true });
    expect(r.stock?.[A]).toEqual({ [L]: 14 });
  });

  it("returns a validation failure without changing anything", async () => {
    const client = fakeClient({ nodes: [variantNode(KIT, "SMP-4", "4", 0), variantNode(A, "MINI-A", null, 10)] });
    const r = await handleRun(client, body({ perKit: { [A]: 3 } }), "assemble");
    expect(r.result).toMatchObject({ ok: false, kind: "validation" });
    expect(r.stock).toBeUndefined();
    expect(client.calls).toHaveLength(1);
  });

  it("reports a missing kit as a validation failure", async () => {
    const client = fakeClient({ nodes: [variantNode(A, "MINI-A", null, 10)] });
    const r = await handleRun(client, body(), "assemble");
    expect(r.result).toMatchObject({ ok: false, kind: "validation" });
  });

  it("returns refreshed stock on a stale-stock conflict", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = fakeClient(
      { nodes: [variantNode(KIT, "SMP-4", "4", 0), variantNode(A, "MINI-A", null, 10)] },
      stale,
      { nodes: [stockNode(A, 2), stockNode(KIT, 0)] },
    );
    const r = await handleRun(client, body(), "assemble");
    expect(r.result).toMatchObject({ ok: false, kind: "conflict" });
    expect(r.stock?.[A]).toEqual({ [L]: 2 });
  });

  it("refuses an ordinary product posted as the kit", async () => {
    const client = fakeClient({ nodes: [variantNode(KIT, "MINI-X", null, 9), variantNode(A, "MINI-A", null, 50)] });
    const r = await handleRun(client, body({ perKit: { [A]: 40 }, seenStock: { [A]: { [L]: 50 }, [KIT]: { [L]: 9 } } }), "assemble");
    expect(r.result).toMatchObject({ ok: false, kind: "validation" });
    expect(client.calls).toHaveLength(1);
  });

  it("activates from live stock, not from a forged snapshot that hides a level", async () => {
    // The browser claims the kit has no level here; Shopify says it has 4, so nothing is activated
    // and the guard falls back to the live quantity.
    const seenStock = { [A]: { [L]: 10 } };
    const client = fakeClient(
      { nodes: [variantNode(KIT, "SMP-4", "4", 4), variantNode(A, "MINI-A", null, 10)] },
      adjusted,
      { nodes: [stockNode(KIT, 5), stockNode(A, 6)] },
    );
    const r = await handleRun(client, body({ seenStock }), "assemble");
    expect(r.result).toMatchObject({ ok: true });
    expect(client.calls.some((c) => c.query.includes("inventoryActivate"))).toBe(false);
    const sent = (client.calls[1]?.variables as { input: { changes: { changeFromQuantity: number }[] } }).input.changes;
    expect(sent.map((c) => c.changeFromQuantity)).toEqual([10, 4]);
  });

  describe("when Shopify fails outside the inventory change", () => {
    beforeEach(() => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => vi.restoreAllMocks());

    it("reports an unreachable Shopify before the run as an error result, not an exception", async () => {
      const client = fakeClient(new ShopifyApiError("down"));
      const r = await handleRun(client, body(), "assemble");
      expect(r.result).toEqual({
        ok: false,
        kind: "error",
        message: "Shopify could not be reached or rejected the request. Please try again.",
      });
      expect(client.calls).toHaveLength(1);
      expect(console.error).toHaveBeenCalled();
    });

    it("still reports success when only the stock refresh afterwards fails", async () => {
      const client = fakeClient(
        { nodes: [variantNode(KIT, "SMP-4", "4", 0), variantNode(A, "MINI-A", null, 10)] },
        adjusted,
        new ShopifyApiError("blip"),
      );
      const r = await handleRun(client, body(), "assemble");
      expect(r.result).toMatchObject({ ok: true, adjustmentId: "g" });
      expect(r.stock).toBeUndefined();
    });
  });
});
