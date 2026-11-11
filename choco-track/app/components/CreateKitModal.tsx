import { useEffect, useRef, useState } from "react";
import type { KitSize, Variant } from "../domain/types";
import { fieldValue } from "../wc";

interface Props {
  readonly open: boolean;
  readonly existing: readonly Variant[];
  readonly busy: boolean;
  readonly error?: string | undefined;
  readonly onClose: () => void;
  readonly onCreate: (kit: { title: string; size: KitSize; sku: string; barcode: string; price: string }) => void;
}

type SizeOption = "4" | "5" | "6" | "12";

const PRICE = /^\d{1,6}(\.\d{1,2})?$/;

const toSize = (v: string): SizeOption => (v === "4" || v === "5" || v === "12" ? v : "6");

export function CreateKitModal({ open, existing, busy, error: serverError, onClose, onCreate }: Props) {
  const ref = useRef<HTMLElementTagNameMap["s-modal"]>(null);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<SizeOption>("6");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    const modal = ref.current;
    if (!modal) return;
    if (open) modal.showOverlay();
    else modal.hideOverlay();
  }, [open]);

  useEffect(() => {
    const modal = ref.current;
    if (!modal) return undefined;
    modal.addEventListener("hide", onClose);
    return () => modal.removeEventListener("hide", onClose);
  }, [onClose]);

  const trimmedSku = sku.trim();
  const error = !title.trim()
    ? "Enter a title."
    : !trimmedSku
      ? "Enter a SKU."
      : existing.some((v) => v.sku.toLowerCase() === trimmedSku.toLowerCase())
        ? "That SKU is already in use."
        : price.trim() !== "" && !PRICE.test(price.trim())
          ? "Enter a price like 18.00."
          : undefined;

  const create = () => {
    if (error) return;
    onCreate({ title: title.trim(), size: Number(size) as KitSize, sku: trimmedSku, barcode: barcode.trim(), price: price.trim() });
  };

  useEffect(() => {
    if (!open) {
      setTitle("");
      setSku("");
      setBarcode("");
      setPrice("");
      setSize("6");
    }
  }, [open]);

  return (
    <s-modal ref={ref} heading="Create a new kit" id="create-kit-modal">
      <s-stack gap="base">
        <s-paragraph color="subdued">
          This creates a Shopify product with tracked inventory. The kit&apos;s contents are chosen each time you assemble.
        </s-paragraph>
        {serverError && <s-banner tone="critical">{serverError}</s-banner>}
        <s-text-field label="Title" value={title} onInput={(e) => setTitle(fieldValue(e))} />
        <s-select label="Kit size" value={size} onInput={(e) => setSize(toSize(fieldValue(e)))}>
          <s-option value="4">4 mini bars</s-option>
          <s-option value="5">5 mini bars</s-option>
          <s-option value="6">6 mini bars</s-option>
          <s-option value="12">12 mini bars</s-option>
        </s-select>
        <s-text-field label="SKU" value={sku} error={sku && error?.includes("SKU") ? error : undefined} onInput={(e) => setSku(fieldValue(e))} />
        <s-text-field
          label="Price (optional)"
          details="Defaults to 0.00. You can change it later in Shopify."
          value={price}
          error={price && error?.includes("price") ? error : undefined}
          onInput={(e) => setPrice(fieldValue(e))}
        />
        <s-text-field label="Barcode (optional)" value={barcode} onInput={(e) => setBarcode(fieldValue(e))} />
      </s-stack>
      <s-button slot="primary-action" variant="primary" disabled={Boolean(error) || busy} onClick={create}>Create kit</s-button>
      <s-button slot="secondary-actions" onClick={onClose}>Cancel</s-button>
    </s-modal>
  );
}
