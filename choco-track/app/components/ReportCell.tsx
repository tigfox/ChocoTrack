import type { CellView } from "../domain/tracking";

/** One variant at one location: the count, its target, and what is on the way. */
export function ReportCell({ cell, alerts = true }: { readonly cell: CellView; readonly alerts?: boolean }) {
  // Until setup is finished nothing warns: a low or over cell looks like any other. Counts and targets still show.
  const status = alerts ? cell.status : cell.status === "untracked" ? "untracked" : "ok";
  if (status === "untracked") {
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
    <td className={`inv-cell inv-${status}`}>
      <s-stack gap="none">
        <s-text type="strong">{String(cell.available)}</s-text>
        <s-text color="subdued">{`min ${cell.min} / max ${cell.max}`}</s-text>
        {cell.incoming > 0 && <s-text color="subdued">{`+${cell.incoming} incoming`}</s-text>}
        {cell.pending > 0 && <s-text color="subdued">{`+${cell.pending} in draft`}</s-text>}
        {status === "low" && !cell.covered && <s-badge tone="critical">Low</s-badge>}
        {status === "low" && cell.covered && <s-badge tone="warning">Low, restock on the way</s-badge>}
        {status === "over" && <s-badge tone="info">Over max</s-badge>}
        {!cell.stocked && <s-text color="subdued">not stocked here</s-text>}
      </s-stack>
    </td>
  );
}
