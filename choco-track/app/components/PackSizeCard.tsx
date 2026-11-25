import { useState } from "react";
import { moveToGroup, removeFromGroup, type PackSizes } from "../domain/packSizes";
import type { Collection, Variant } from "../domain/types";
import { postInventory } from "../lib/postInventory";
import { addGroup, draftError, fromDraft, removeGroup, sameDraft, setGroupSize, toDraft, type PackSizeDraft } from "../lib/packSizeDraft";
import type { VariantLabel } from "../shopify/variantLabels";
import { fieldValue } from "../wc";
import { CollapsibleSection } from "./CollapsibleSection";
import { PackGroupPicker } from "./PackGroupPicker";

interface Props {
  readonly packSizes: PackSizes;
  /** Names for the variants already in groups; ones added during this visit are remembered here too. */
  readonly labels: Readonly<Record<string, VariantLabel>>;
  readonly collections: readonly Collection[];
}

const labelOf = (labels: Props["labels"], id: string): VariantLabel => labels[id] ?? { title: "A variant that was deleted", sku: "" };

/** How many ship at once: a default, plus groups of variants that ship in other sizes (for example 100 for the minis). */
export function PackSizeCard({ packSizes, labels: initialLabels, collections }: Props) {
  const [draft, setDraft] = useState<PackSizeDraft>(() => toDraft(packSizes));
  const [saved, setSaved] = useState<PackSizeDraft>(() => toDraft(packSizes));
  const [labels, setLabels] = useState(initialLabels);
  const [picking, setPicking] = useState<number | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | undefined>();

  const problem = draftError(draft);
  const changed = !sameDraft(draft, saved);
  const pickingGroup = picking === undefined ? undefined : draft.groups[picking];

  const addVariants = (variants: readonly Variant[]) => {
    if (picking === undefined) return;
    setLabels((prev) => ({ ...prev, ...Object.fromEntries(variants.map((v) => [v.id, { title: v.title, sku: v.sku, ...(v.group ? { group: v.group } : {}) }])) }));
    setDraft((d) => ({ ...d, groups: moveToGroup(d.groups, picking, variants.map((v) => v.id)) }));
  };

  const save = async () => {
    if (problem) return;
    setBusy(true);
    setMessage(undefined);
    const result = await postInventory({ intent: "savePackSizes", ...fromDraft(draft) });
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) setSaved(draft);
  };

  return (
    <CollapsibleSection heading="Pack Size">
      <s-stack gap="base">
        <s-paragraph color="subdued">
          Suggested transfers send whole packs, as close to the maximum as possible without going over. If that would leave a location below its
          minimum, they round up to the next full pack instead. Every variant ships in the default size unless you put it in a group below.
        </s-paragraph>
        {message && <s-banner tone={message.ok ? "success" : "critical"}>{message.text}</s-banner>}
        <s-number-field
          label="Default pack size"
          details="Used by every variant that is not in a group."
          min={1}
          max={1000}
          value={draft.defaultSize}
          onInput={(e) => {
            const defaultSize = fieldValue(e); // read now: the event is gone by the time React runs the updater below
            setDraft((d) => ({ ...d, defaultSize }));
          }}
        />
        {draft.groups.length === 0 && <s-text color="subdued">No groups: every variant uses the default.</s-text>}
        {draft.groups.map((g, i) => (
          <div key={g.key} style={{ border: "1px solid var(--p-color-border, #e1e3e5)", borderRadius: 8, padding: 12 }}>
            <s-stack gap="small">
              <s-stack direction="inline" gap="small-200" alignItems="end" justifyContent="space-between">
                <s-stack direction="inline" gap="small-200" alignItems="end">
                  <s-number-field
                    label={`Pack size, group ${i + 1}`}
                    min={1}
                    max={1000}
                    value={g.size}
                    onInput={(e) => {
                      const size = fieldValue(e);
                      setDraft((d) => setGroupSize(d, i, size));
                    }}
                  />
                  <s-text color="subdued">{`${g.variantIds.length} variant${g.variantIds.length === 1 ? "" : "s"}`}</s-text>
                </s-stack>
                <s-stack direction="inline" gap="small-200">
                  <s-button onClick={() => setPicking(i)}>Add products</s-button>
                  <s-button tone="critical" accessibilityLabel={`Remove group ${i + 1}`} onClick={() => setDraft((d) => removeGroup(d, i))}>Remove group</s-button>
                </s-stack>
              </s-stack>
              {g.variantIds.length === 0 ? (
                <s-text color="subdued">No variants yet. Use Add products.</s-text>
              ) : (
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  <s-stack gap="small-200">
                    {g.variantIds.map((id) => {
                      const label = labelOf(labels, id);
                      return (
                        <s-stack key={id} direction="inline" justifyContent="space-between" alignItems="center" gap="base">
                          <s-stack gap="none">
                            <s-text>{label.title}</s-text>
                            <s-text color="subdued">{[label.group, label.sku].filter(Boolean).join(" - ")}</s-text>
                          </s-stack>
                          <s-button accessibilityLabel={`Remove ${label.title}`} onClick={() => setDraft((d) => ({ ...d, groups: removeFromGroup(d.groups, i, id) }))}>Remove</s-button>
                        </s-stack>
                      );
                    })}
                  </s-stack>
                </div>
              )}
            </s-stack>
          </div>
        ))}
        <div>
          <s-button onClick={() => setDraft((d) => addGroup(d))}>Add a pack size group</s-button>
        </div>
        {problem && <s-text tone="critical">{problem}</s-text>}
        <div>
          <s-button variant="primary" disabled={!changed || problem !== undefined || busy} loading={busy} onClick={() => void save()}>Save pack sizes</s-button>
        </div>
      </s-stack>
      <PackGroupPicker
        open={picking !== undefined}
        heading={pickingGroup ? `Add products to the pack of ${pickingGroup.size || "?"}` : "Add products"}
        collections={collections}
        inGroup={new Set(pickingGroup?.variantIds ?? [])}
        onAdd={addVariants}
        onClose={() => setPicking(undefined)}
      />
    </CollapsibleSection>
  );
}
