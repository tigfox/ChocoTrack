import { Fragment } from "react";
import type { Targets } from "../domain/targets";
import type { Location } from "../domain/types";
import type { InventoryResponse } from "../lib/handleInventory";
import type { ReportGroup } from "../lib/reportRows";
import type { ReportVariant } from "../shopify/trackedCatalog";
import { VariantRow } from "./VariantRow";

const CSS = `
  .inv-scroll { overflow-x: auto; }
  .inv-table { border-collapse: separate; border-spacing: 0; min-width: 100%; font-size: 13px; }
  .inv-table th, .inv-table td { padding: 8px 12px; border-bottom: 1px solid #e1e3e5; text-align: left; vertical-align: top; }
  .inv-table thead th { position: sticky; top: 0; background: Canvas; z-index: 2; white-space: nowrap; }
  .inv-table .inv-cell { min-width: 120px; white-space: nowrap; }
  .inv-table .inv-edit { min-width: 130px; }
  .inv-table .inv-sticky { position: sticky; left: 0; background: Canvas; z-index: 1; min-width: 200px; max-width: 260px; border-right: 1px solid #e1e3e5; font-weight: normal; }
  .inv-table thead .inv-sticky { z-index: 3; font-weight: 600; }
  .inv-table .inv-group td { background: #f6f6f7; font-weight: 600; }
  .inv-table .inv-low { box-shadow: inset 3px 0 0 #d82c0d; }
  .inv-table .inv-over { box-shadow: inset 3px 0 0 #2c6ecb; }
`;

interface Props {
  readonly groups: readonly ReportGroup[];
  /** The columns: visible locations only. */
  readonly locations: readonly Location[];
  readonly editing: boolean;
  readonly onSave: (variant: ReportVariant, targets: Targets) => Promise<InventoryResponse>;
}

/** Tracked variants down the left, one column per stock location. The left column stays put while scrolling across. */
export function InventoryTable({ groups, locations, editing, onSave }: Props) {
  return (
    <div className="inv-scroll">
      <style>{CSS}</style>
      <table className="inv-table">
        <thead>
          <tr>
            <th scope="col" className="inv-sticky">Product</th>
            {locations.map((l) => (
              <th key={l.id} scope="col">{l.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const grouped = g.rows.length > 1 || g.rows.some((r) => r.label !== "");
            return (
              <Fragment key={g.productId}>
                {grouped && (
                  <tr className="inv-group">
                    <td colSpan={locations.length + 1}>{g.truncated ? `${g.productTitle} (more variants than shown)` : g.productTitle}</td>
                  </tr>
                )}
                {g.rows.map((row) => (
                  <VariantRow
                    key={row.variant.id}
                    row={row}
                    productTitle={g.productTitle}
                    showProduct={!grouped}
                    locations={locations}
                    editing={editing}
                    onSave={(targets) => onSave(row.variant, targets)}
                  />
                ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
