import { useState } from "react";
import type { SuggestResult } from "../domain/suggest";
import type { Location } from "../domain/types";
import { useModal } from "../hooks/useModal";
import type { CreatedTransfer, InventoryResponse } from "../lib/handleInventory";
import { variantLabel } from "../lib/reportRows";
import type { ReportVariant } from "../shopify/trackedCatalog";
import { CreatedTransferLinks } from "./CreatedTransferLinks";

interface Props {
  readonly open: boolean;
  readonly plan: SuggestResult;
  readonly locations: readonly Location[];
  readonly variants: readonly ReportVariant[];
  readonly hasSources: boolean;
  /** The store name, for links to the created drafts. */
  readonly shopHandle?: string;
  readonly onClose: () => void;
  readonly onCreate: (route: { originId: string; destinationId: string } | undefined) => Promise<InventoryResponse>;
  readonly onCreated: (created: readonly CreatedTransfer[]) => void;
}

export function SuggestedTransfersModal({ open, plan, locations, variants, hasSources, shopHandle, onClose, onCreate, onCreated }: Props) {
  const ref = useModal(open, onClose);
  const [busy, setBusy] = useState<string | undefined>();
  const [createdDrafts, setCreatedDrafts] = useState<readonly CreatedTransfer[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | undefined>();
  const locationName = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
  const labelOf = (variantId: string) => {
    const v = variants.find((x) => x.id === variantId);
    return v ? variantLabel(v) : variantId;
  };

  const run = async (key: string, route: { originId: string; destinationId: string } | undefined) => {
    setBusy(key);
    setNotice(undefined);
    const result = await onCreate(route);
    setBusy(undefined);
    setNotice({ ok: result.ok, text: result.message });
    if (result.ok && result.created) {
      const made = result.created;
      setCreatedDrafts((prev) => [...prev, ...made]);
      onCreated(made);
    }
  };

  return (
    <s-modal ref={ref} heading="Suggested transfers" id="suggested-transfers-modal">
      <s-stack gap="base">
        {notice && <s-banner tone={notice.ok ? "success" : "critical"}>{notice.text}</s-banner>}
        <s-paragraph color="subdued">
          Each button creates a draft transfer in Shopify. Nothing moves until someone reviews the draft there and marks it ready. Quantities follow the pack
          sizes on the Settings page.
        </s-paragraph>
        <CreatedTransferLinks created={createdDrafts} locations={locations} shopHandle={shopHandle} />
        {!hasSources && (
          <s-banner tone="warning" heading="No source locations set">
            Choose the locations that supply stock on the Settings page to get transfer suggestions.
          </s-banner>
        )}
        {plan.transfers.length === 0 && plan.shortfalls.length === 0 && hasSources && (
          <s-text>Everything tracked is at or above its minimum, or already covered by incoming transfers.</s-text>
        )}
        {plan.transfers.map((t) => {
          const key = `${t.originId}:${t.destinationId}`;
          return (
            <s-section key={key} heading={`${locationName(t.originId)} to ${locationName(t.destinationId)}`}>
              <s-stack gap="small-200">
                {t.lines.map((l) => (
                  <s-text key={l.variantId}>
                    {`${l.quantity} x ${labelOf(l.variantId)}`}
                    {l.overMax ? ` (rounded up to a full box so ${locationName(t.destinationId)} stays at its minimum)` : ""}
                  </s-text>
                ))}
                <div>
                  <s-button
                    disabled={busy !== undefined}
                    loading={busy === key}
                    onClick={() => void run(key, { originId: t.originId, destinationId: t.destinationId })}
                  >
                    Create draft in Shopify
                  </s-button>
                </div>
              </s-stack>
            </s-section>
          );
        })}
        {plan.shortfalls.length > 0 && (
          <s-banner tone="warning" heading="Not enough stock at the source locations to fully cover">
            <s-stack gap="small-200">
              {plan.shortfalls.map((s) => (
                <s-text key={`${s.variantId}:${s.destinationId}`}>
                  {`${labelOf(s.variantId)} at ${locationName(s.destinationId)}: ${s.quantity} short of the maximum${s.stillLow ? ", still below the minimum" : ""}`}
                </s-text>
              ))}
            </s-stack>
          </s-banner>
        )}
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={plan.transfers.length === 0 || busy !== undefined}
        loading={busy === "all"}
        onClick={() => void run("all", undefined)}
      >
        {`Create all (${plan.transfers.length})`}
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>Close</s-button>
    </s-modal>
  );
}
