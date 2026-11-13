import type { CellView } from "../domain/tracking";

/** One variant at one location: the count, its target, and what is on the way. */
export function ReportCell({ cell }: { readonly cell: CellView }) {
  if (cell.status === "untracked") {
    return (
      <td className="inv-cell">
        <s-stack gap="none">
          <s-text>{cell.stocked ? String(cell.available) : "-"}</s-text>
          <s-text color="subdued">no target</s-text>
        </s-stack>
      </td>
    );
  }
  return (
    <td className={`inv-cell inv-${cell.status}`}>
      <s-stack gap="none">
        <s-text type="strong">{String(cell.available)}</s-text>
        <s-text color="subdued">{`min ${cell.min} / max ${cell.max}`}</s-text>
        {cell.incoming > 0 && <s-text color="subdued">{`+${cell.incoming} incoming`}</s-text>}
        {cell.pending > 0 && <s-text color="subdued">{`+${cell.pending} in draft`}</s-text>}
        {cell.status === "low" && !cell.covered && <s-badge tone="critical">Low</s-badge>}
        {cell.status === "low" && cell.covered && <s-badge tone="warning">Low, restock on the way</s-badge>}
        {cell.status === "over" && <s-badge tone="info">Over max</s-badge>}
        {!cell.stocked && <s-text color="subdued">not stocked here</s-text>}
      </s-stack>
    </td>
  );
}
