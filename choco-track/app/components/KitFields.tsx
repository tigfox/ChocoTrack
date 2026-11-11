import { availableAt } from "../domain/stock";
import type { Location, StockMap, Variant } from "../domain/types";
import { fieldValue } from "../wc";

interface Props {
  readonly heading: string;
  readonly stock: StockMap;
  readonly locations: readonly Location[];
  readonly kits: readonly Variant[];
  readonly locationId: string;
  readonly onLocation: (id: string) => void;
  readonly kitId: string;
  readonly onKit: (id: string) => void;
  readonly kitCount: string;
  readonly onKitCount: (v: string) => void;
  readonly countLabel: string;
}

export function KitFields(p: Props) {
  const kitLabel = (k: Variant) => {
    const n = availableAt(p.stock, k.id, p.locationId);
    return `${k.title} (${k.sku}) - ${n === null ? "not stocked here" : `${n} in stock`}`;
  };
  // s-select does not refresh option labels when they change, so remount it when any label changes.
  const kitSelectKey = p.kits.map(kitLabel).join("|");
  const locationSelectKey = p.locations.map((l) => l.id).join("|");
  return (
    <s-section heading={p.heading}>
      <s-stack gap="base">
        <s-select key={locationSelectKey} label="Location" value={p.locationId} onInput={(e) => p.onLocation(fieldValue(e))}>
          {p.locations.map((l) => (
            <s-option key={l.id} value={l.id}>{l.name}</s-option>
          ))}
        </s-select>
        <s-grid gridTemplateColumns="3fr 1fr" gap="base">
          <s-select key={kitSelectKey} label="Kit" value={p.kitId} onInput={(e) => p.onKit(fieldValue(e))}>
            {p.kits.map((k) => (
              <s-option key={k.id} value={k.id}>{kitLabel(k)}</s-option>
            ))}
          </s-select>
          <s-number-field label={p.countLabel} min={1} value={p.kitCount} onInput={(e) => p.onKitCount(fieldValue(e))} />
        </s-grid>
      </s-stack>
    </s-section>
  );
}
