import { useState } from "react";
import type { Collection, Variant } from "../domain/types";
import { useModal } from "../hooks/useModal";
import { useVariantSearch } from "../hooks/useVariantSearch";
import { fromOptionValue, NO_OPTION, toOptionValue } from "../lib/emptyOption";
import { MAX_RESULTS, PAGE_SIZE } from "../lib/searchParams";
import { fieldValue } from "../wc";

interface Props {
  readonly open: boolean;
  readonly heading: string;
  readonly collections: readonly Collection[];
  /** Variants already in this group, shown as added. */
  readonly inGroup: ReadonlySet<string>;
  readonly onAdd: (variants: readonly Variant[]) => void;
  readonly onClose: () => void;
}

/** Search the store's variants (name, SKU or barcode, optionally within a collection) and add them to a pack size group. */
export function PackGroupPicker({ open, heading, collections, inGroup, onAdd, onClose }: Props) {
  const ref = useModal(open, onClose);
  return (
    <s-modal ref={ref} heading={heading} id="pack-group-picker">
      {open && <PickerBody collections={collections} inGroup={inGroup} onAdd={onAdd} onClose={onClose} />}
    </s-modal>
  );
}

function PickerBody({ collections, inGroup, onAdd, onClose }: Pick<Props, "collections" | "inGroup" | "onAdd" | "onClose">) {
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { data, loading, error } = useVariantSearch(query, collectionId, limit);
  const rows = data?.variants ?? [];
  const addable = rows.filter((v) => !inGroup.has(v.id));

  return (
    <>
      <s-stack gap="base">
        <s-paragraph color="subdued">Variants can be in only one group: adding one here moves it out of any other group.</s-paragraph>
        {error && <s-banner tone="critical">{error}</s-banner>}
        <s-grid gridTemplateColumns="2fr 1fr" gap="base">
          <s-search-field
            label="Search"
            value={query}
            placeholder="Name, SKU or barcode"
            onInput={(e) => {
              setLimit(PAGE_SIZE);
              setQuery(fieldValue(e));
            }}
          />
          <s-select
            label="Collection"
            value={toOptionValue(collectionId)}
            onInput={(e) => {
              setLimit(PAGE_SIZE);
              setCollectionId(fromOptionValue(fieldValue(e)));
            }}
          >
            <s-option value={NO_OPTION}>All items</s-option>
            {collections.map((c) => (
              <s-option key={c.id} value={c.id}>{c.title}</s-option>
            ))}
          </s-select>
        </s-grid>
        <div>
          <s-button disabled={addable.length === 0} onClick={() => onAdd(addable)}>{`Add all ${addable.length} shown`}</s-button>
        </div>
        {loading && rows.length === 0 && <s-text color="subdued">Searching...</s-text>}
        {!loading && rows.length === 0 && <s-text color="subdued">No items match.</s-text>}
        <div style={{ maxHeight: 360, overflowY: "auto" }} aria-busy={loading}>
          <s-stack gap="small">
            {rows.map((v) => {
              const added = inGroup.has(v.id);
              return (
                <s-stack key={v.id} direction="inline" justifyContent="space-between" alignItems="center" gap="base" data-testid={`pick-${v.sku || v.id}`}>
                  <s-stack gap="none">
                    <s-text>{v.title}</s-text>
                    <s-text color="subdued">{[v.group, v.sku].filter(Boolean).join(" - ")}</s-text>
                  </s-stack>
                  <s-button disabled={added} accessibilityLabel={`Add ${v.title}`} onClick={() => onAdd([v])}>{added ? "Added" : "Add"}</s-button>
                </s-stack>
              );
            })}
          </s-stack>
        </div>
        {!loading && data && rows.length >= limit && limit < MAX_RESULTS && (
          <div>
            <s-button variant="tertiary" onClick={() => setLimit((n) => Math.min(n + PAGE_SIZE, MAX_RESULTS))}>Show more</s-button>
          </div>
        )}
      </s-stack>
      <s-button slot="primary-action" variant="primary" onClick={onClose}>Done</s-button>
    </>
  );
}
