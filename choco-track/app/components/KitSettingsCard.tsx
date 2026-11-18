import { useEffect, useState } from "react";
import { kitSizeError } from "../domain/kitSize";
import type { Collection } from "../domain/types";
import { useSettingsAction } from "../hooks/useSettingsAction";
import type { CatalogVariant } from "../shopify/catalog";
import { fieldValue } from "../wc";
import { CategorySelect } from "./CategorySelect";

interface Props {
  readonly kit: CatalogVariant;
  readonly collections: readonly Collection[];
}

export function KitSettingsCard({ kit, collections }: Props) {
  const { busy, response, submit } = useSettingsAction();
  const [title, setTitle] = useState(kit.title);
  const [size, setSize] = useState(String(kit.kitSize ?? 6));
  const [categoryId, setCategoryId] = useState(kit.categoryId ?? "");

  // After a save the loader reloads; show what Shopify now holds.
  useEffect(() => {
    setTitle(kit.title);
    setSize(String(kit.kitSize ?? 6));
    setCategoryId(kit.categoryId ?? "");
  }, [kit.title, kit.kitSize, kit.categoryId]);

  const sizeProblem = kitSizeError(Number(size));
  const changed = title.trim() !== kit.title || Number(size) !== kit.kitSize || categoryId !== (kit.categoryId ?? "");
  const save = () =>
    submit({ intent: "update", kitId: kit.id, title: title.trim(), size: Number(size), categoryId });

  return (
    <s-section heading={kit.title}>
      <s-stack gap="base">
        <s-text color="subdued">{`SKU ${kit.sku}`}</s-text>
        {response && <s-banner tone={response.ok ? "success" : "critical"}>{response.message}</s-banner>}
        <s-grid gridTemplateColumns="2fr 1fr" gap="base">
          <s-text-field label="Name" value={title} onInput={(e) => setTitle(fieldValue(e))} />
          <s-number-field label="Kit size" min={1} max={48} value={size} error={sizeProblem} onInput={(e) => setSize(fieldValue(e))} />
        </s-grid>
        <CategorySelect collections={collections} value={categoryId} onChange={setCategoryId} />
        <div>
          <s-button variant="primary" disabled={!changed || !title.trim() || sizeProblem !== undefined || busy} loading={busy} onClick={save}>
            Save changes
          </s-button>
        </div>
      </s-stack>
    </s-section>
  );
}
