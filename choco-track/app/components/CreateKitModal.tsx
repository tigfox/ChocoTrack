import { useEffect, useRef, useState } from "react";
import { kitSizeError } from "../domain/kitSize";
import type { Collection, KitSize, Variant } from "../domain/types";
import { fieldValue } from "../wc";
import { CategorySelect } from "./CategorySelect";

interface Props {
  readonly open: boolean;
  readonly existing: readonly Variant[];
  readonly collections: readonly Collection[];
  readonly busy: boolean;
  readonly error?: string | undefined;
  readonly onClose: () => void;
  readonly onCreate: (kit: { title: string; size: KitSize; sku: string; barcode: string; price: string; categoryId: string }) => void;
}

const PRICE = /^\d{1,6}(\.\d{1,2})?$/;

export function CreateKitModal({ open, existing, collections, busy, error: serverError, onClose, onCreate }: Props) {
  const ref = useRef<HTMLElementTagNameMap["s-modal"]>(null);
  const [title, setTitle] = useState("");
  const [size, setSize] = useState("6");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");

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
  const sizeProblem = kitSizeError(Number(size));
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
    if (error || sizeProblem) return;
    onCreate({ title: title.trim(), size: Number(size) as KitSize, sku: trimmedSku, barcode: barcode.trim(), price: price.trim(), categoryId });
  };

  useEffect(() => {
    if (!open) {
      setTitle("");
      setSku("");
      setBarcode("");
      setPrice("");
      setCategoryId("");
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
        <s-number-field label="Kit size (mini bars)" min={1} max={48} value={size} error={sizeProblem} onInput={(e) => setSize(fieldValue(e))} />
        <s-text-field label="SKU" value={sku} error={sku && error?.includes("SKU") ? error : undefined} onInput={(e) => setSku(fieldValue(e))} />
        <s-text-field
          label="Price (optional)"
          details="Defaults to 0.00. You can change it later in Shopify."
          value={price}
          error={price && error?.includes("price") ? error : undefined}
          onInput={(e) => setPrice(fieldValue(e))}
        />
        <CategorySelect collections={collections} value={categoryId} onChange={setCategoryId} />
        <s-text-field label="Barcode (optional)" value={barcode} onInput={(e) => setBarcode(fieldValue(e))} />
      </s-stack>
      <s-button slot="primary-action" variant="primary" disabled={Boolean(error) || Boolean(sizeProblem) || busy} onClick={create}>Create kit</s-button>
      <s-button slot="secondary-actions" onClick={onClose}>Cancel</s-button>
    </s-modal>
  );
}
