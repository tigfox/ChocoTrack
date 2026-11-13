import { fetchJson } from "./fetchJson";
import type { InventoryResponse } from "./handleInventory";

/** Sends an Inventory change; a dropped connection comes back as a normal failed response. */
export const postInventory = async (body: Record<string, unknown>): Promise<InventoryResponse> => {
  const res = await fetchJson<InventoryResponse>("/app/api/inventory", body);
  return res.ok ? res.data : { ok: false, message: res.message };
};
