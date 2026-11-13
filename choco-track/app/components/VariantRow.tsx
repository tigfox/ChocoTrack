import { useEffect, useState } from "react";
import type { Location } from "../domain/types";
import type { Targets } from "../domain/targets";
import type { InventoryResponse } from "../lib/handleInventory";
import type { ReportRow } from "../lib/reportRows";
import { draftsToTargets, sameTargets, targetsToDrafts, type Drafts } from "../lib/targetDrafts";
import { fieldValue } from "../wc";
import { ReportCell } from "./ReportCell";

interface Props {
  readonly row: ReportRow;
  readonly productTitle: string;
  /** Show the product name on this row (single-variant products have no group heading). */
  readonly showProduct: boolean;
  readonly locations: readonly Location[];
  readonly editing: boolean;
  readonly onSave: (targets: Targets) => Promise<InventoryResponse>;
}

/** Hidden locations keep their targets: drafts cover every location the variant has a target at, visible or not. */
const draftIds = (row: ReportRow, locations: readonly Location[]): readonly string[] => [
  ...new Set([...locations.map((l) => l.id), ...Object.keys(row.variant.targets)]),
];

export function VariantRow({ row, productTitle, showProduct, locations, editing, onSave }: Props) {
  const { variant } = row;
  const ids = draftIds(row, locations);
  const [drafts, setDrafts] = useState<Drafts>(() => targetsToDrafts(variant.targets, ids));
  const [problem, setProblem] = useState<{ locationId?: string; message: string } | undefined>();
  const [saving, setSaving] = useState(false);

  // Start again from what Shopify holds when editing begins or after a save.
  useEffect(() => {
    setDrafts(targetsToDrafts(variant.targets, draftIds(row, locations)));
    setProblem(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant.targets, variant.digest, editing]);

  const parsed = draftsToTargets(drafts);
  const dirty = !parsed.ok || !sameTargets(parsed.targets, variant.targets);

  const setField = (locationId: string, field: "min" | "max", value: string) =>
    setDrafts((prev) => ({ ...prev, [locationId]: { ...(prev[locationId] ?? { min: "", max: "" }), [field]: value } }));

  const save = async () => {
    if (!parsed.ok) {
      setProblem({ locationId: parsed.locationId, message: parsed.message });
      return;
    }
    setSaving(true);
    setProblem(undefined);
    const result = await onSave(parsed.targets);
    setSaving(false);
    if (!result.ok) setProblem({ message: result.message });
  };

  const name = showProduct || row.label === "" ? productTitle : row.label;
  const detail = showProduct && row.label !== "" ? row.label : "";

  return (
    <tr>
      <th scope="row" className="inv-sticky">
        <s-stack gap="none">
          <s-text type="strong">{name}</s-text>
          {detail !== "" && <s-text color="subdued">{detail}</s-text>}
          <s-text color="subdued">{variant.sku}</s-text>
          {editing && (
            <s-stack direction="inline" gap="small-200">
              <s-button variant="primary" disabled={!dirty || saving} loading={saving} onClick={() => void save()}>Save</s-button>
              <s-button disabled={!dirty || saving} onClick={() => setDrafts(targetsToDrafts(variant.targets, ids))}>Reset</s-button>
            </s-stack>
          )}
          {problem && !problem.locationId && <s-text tone="critical">{problem.message}</s-text>}
        </s-stack>
      </th>
      {locations.map((l) => {
        const cell = row.cells[l.id];
        if (!editing || !cell) return cell ? <ReportCell key={l.id} cell={cell} /> : <td key={l.id} />;
        const draft = drafts[l.id] ?? { min: "", max: "" };
        const error = problem?.locationId === l.id ? problem.message : undefined;
        return (
          <td key={l.id} className="inv-cell inv-edit">
            <s-stack gap="small-200">
              <s-text color="subdued">{`${cell.available} available`}</s-text>
              <s-number-field label={`${l.name} minimum`} labelAccessibilityVisibility="exclusive" placeholder="Min" min={0} value={draft.min} error={error} onInput={(e) => setField(l.id, "min", fieldValue(e))} />
              <s-number-field label={`${l.name} maximum`} labelAccessibilityVisibility="exclusive" placeholder="Max" min={0} value={draft.max} onInput={(e) => setField(l.id, "max", fieldValue(e))} />
            </s-stack>
          </td>
        );
      })}
    </tr>
  );
}
