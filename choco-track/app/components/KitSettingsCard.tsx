import { useEffect, useState } from "react";
import type { Collection, KitSize } from "../domain/types";
import { useSettingsAction } from "../hooks/useSettingsAction";
import type { CatalogVariant } from "../shopify/catalog";
import { fieldValue } from "../wc";
import { CategorySelect } from "./CategorySelect";

interface Props {
  readonly kit: CatalogVariant;
  readonly collections: readonly Collection[];
}

type SizeOption = "4" | "5" | "6" | "12";

const toSize = (v: string): SizeOption => (v === "4" || v === "5" || v === "12" ? v : "6");

export function KitSettingsCard({ kit, collections }: Props) {
  const { busy, response, submit } = useSettingsAction();
  const [title, setTitle] = useState(kit.title);
  const [size, setSize] = useState<SizeOption>(String(kit.kitSize ?? 6) as SizeOption);
  const [categoryId, setCategoryId] = useState(kit.categoryId ?? "");

  // After a save the loader reloads; show what Shopify now holds.
  useEffect(() => {
    setTitle(kit.title);
    setSize(String(kit.kitSize ?? 6) as SizeOption);
    setCategoryId(kit.categoryId ?? "");
  }, [kit.title, kit.kitSize, kit.categoryId]);

  const changed = title.trim() !== kit.title || Number(size) !== kit.kitSize || categoryId !== (kit.categoryId ?? "");
  const save = () =>
    submit({ intent: "update", kitId: kit.id, title: title.trim(), size: Number(size) as KitSize, categoryId });

  return (
    <s-section heading={kit.title}>
      <s-stack gap="base">
        <s-text color="subdued">{`SKU ${kit.sku}`}</s-text>
        {response && <s-banner tone={response.ok ? "success" : "critical"}>{response.message}</s-banner>}
        <s-grid gridTemplateColumns="2fr 1fr" gap="base">
          <s-text-field label="Name" value={title} onInput={(e) => setTitle(fieldValue(e))} />
          <s-select label="Kit size" value={size} onInput={(e) => setSize(toSize(fieldValue(e)))}>
            <s-option value="4">4 mini bars</s-option>
            <s-option value="5">5 mini bars</s-option>
            <s-option value="6">6 mini bars</s-option>
            <s-option value="12">12 mini bars</s-option>
          </s-select>
        </s-grid>
        <CategorySelect collections={collections} value={categoryId} onChange={setCategoryId} />
        <div>
          <s-button variant="primary" disabled={!changed || !title.trim() || busy} loading={busy} onClick={save}>
            Save changes
          </s-button>
        </div>
      </s-stack>
    </s-section>
  );
}
