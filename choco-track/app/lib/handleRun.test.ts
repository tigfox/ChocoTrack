import { fakeClient } from "../shopify/fakeClient";
import { handleRun } from "./handleRun";

const A = "gid://shopify/ProductVariant/1";
const KIT = "gid://shopify/ProductVariant/2";
const L = "gid://shopify/Location/3";

const variantNode = (id: string, sku: string, kitSize: string | null) => ({
  id,
  title: "Default Title",
  sku,
  barcode: null,
  image: null,
  inventoryItem: { id: `gid://shopify/InventoryItem/${id.slice(-1)}` },
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

  it("assembles with variants read from Shopify and returns fresh stock", async () => {
    const client = fakeClient(
      { nodes: [variantNode(KIT, "SMP-4", "4"), variantNode(A, "MINI-A", null)] },
      adjusted,
      { nodes: [stockNode(KIT, 1), stockNode(A, 6)] },
    );
    const r = await handleRun(client, { ...body(), kitId: KIT }, "assemble");
    expect(r.result).toMatchObject({ ok: true, adjustmentId: "g" });
    expect(r.stock).toEqual({ [KIT]: { [L]: 1 }, [A]: { [L]: 6 } });
  });

  it("disassembles on the disassemble page", async () => {
    const seenStock = { [A]: { [L]: 10 }, [KIT]: { [L]: 3 } };
    const client = fakeClient(
      { nodes: [variantNode(KIT, "SMP-4", "4"), variantNode(A, "MINI-A", null)] },
      adjusted,
      { nodes: [stockNode(KIT, 2), stockNode(A, 14)] },
    );
    const r = await handleRun(client, body({ mode: "disassemble", seenStock }), "disassemble");
    expect(r.result).toMatchObject({ ok: true });
    expect(r.stock?.[A]).toEqual({ [L]: 14 });
  });

  it("returns a validation failure without changing anything", async () => {
    const client = fakeClient({ nodes: [variantNode(KIT, "SMP-4", "4"), variantNode(A, "MINI-A", null)] });
    const r = await handleRun(client, body({ perKit: { [A]: 3 } }), "assemble");
    expect(r.result).toMatchObject({ ok: false, kind: "validation" });
    expect(r.stock).toBeUndefined();
    expect(client.calls).toHaveLength(1);
  });

  it("reports a missing kit as a validation failure", async () => {
    const client = fakeClient({ nodes: [variantNode(A, "MINI-A", null)] });
    const r = await handleRun(client, body(), "assemble");
    expect(r.result).toMatchObject({ ok: false, kind: "validation" });
  });

  it("returns refreshed stock on a stale-stock conflict", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const stale = { inventoryAdjustQuantities: { inventoryAdjustmentGroup: null, userErrors: [{ message: "s", code: "CHANGE_FROM_QUANTITY_STALE" }] } };
    const client = fakeClient(
      { nodes: [variantNode(KIT, "SMP-4", "4"), variantNode(A, "MINI-A", null)] },
      stale,
      { nodes: [stockNode(A, 2), stockNode(KIT, 0)] },
    );
    const r = await handleRun(client, body(), "assemble");
    expect(r.result).toMatchObject({ ok: false, kind: "conflict" });
    expect(r.stock?.[A]).toEqual({ [L]: 2 });
  });
});
