import { boxSlots } from "../domain/box";
import type { UnitCounts, Variant } from "../domain/types";
import { BoxGrid } from "./BoxGrid";

interface Props {
  readonly kit: Variant | undefined;
  readonly perKit: UnitCounts;
  readonly variants: readonly Variant[];
}

export function BoxPreview({ kit, perKit, variants }: Props) {
  if (!kit?.kitSize) return null;
  const slots = boxSlots(kit, perKit, variants);
  const filled = slots.filter((s) => s !== null).length;
  return (
    <s-section heading="Box preview">
      <s-stack gap="small">
        <BoxGrid size={kit.kitSize} slots={slots} />
        <s-text color="subdued">{`${filled} of ${kit.kitSize} bars placed`}</s-text>
      </s-stack>
    </s-section>
  );
}
