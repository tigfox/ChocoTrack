import { useEffect, useMemo, useState } from "react";
import { useRevalidator } from "react-router";
import { hasTargets, lowSummary, productsWithoutTargets } from "../domain/tracking";
import type { Targets } from "../domain/targets";
import type { Collection } from "../domain/types";
import { browserStorage } from "../lib/browserStorage";
import type { CreatedTransfer, InventoryResponse } from "../lib/handleInventory";
import { planTransfers } from "../lib/planTransfers";
import { postInventory } from "../lib/postInventory";
import { readPreferences, writePreferences } from "../lib/preferences";
import { buildReportGroups, limitGroups } from "../lib/reportRows";
import { addPending, mergeLevels, reconcileProducts, removeProduct, upsertProduct, withVariantTargets } from "../lib/reportState";
import type { InventoryReport, ReportVariant } from "../shopify/trackedCatalog";
import { fieldChecked, fieldValue } from "../wc";
import { AddProductsModal } from "./AddProductsModal";
import { InventoryTable } from "./InventoryTable";
import { SuggestedTransfersModal } from "./SuggestedTransfersModal";

const ROW_PAGE = 100;

interface Props {
  readonly report: InventoryReport | undefined;
  readonly collections: readonly Collection[];
  readonly error: string | undefined;
}

export function InventoryView({ report, collections, error }: Props) {
  const { revalidate, state } = useRevalidator();
  if (!report) {
    return (
      <s-page heading="Inventory" inlineSize="large">
        <s-banner tone="critical" heading="Couldn't load inventory">
          {error ?? "Something went wrong. Please try again."}
          <s-button slot="secondary-actions" loading={state !== "idle"} onClick={() => void revalidate()}>Try again</s-button>
        </s-banner>
      </s-page>
    );
  }
  return <LoadedInventory report={report} collections={collections} refreshing={state !== "idle"} onRefresh={() => void revalidate()} />;
}

interface LoadedProps {
  readonly report: InventoryReport;
  readonly collections: readonly Collection[];
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
}

function LoadedInventory({ report, collections, refreshing, onRefresh }: LoadedProps) {
  const [products, setProducts] = useState(report.products);
  const [levels, setLevels] = useState(report.levels);
  const [pending, setPending] = useState(report.pending);
  const [flagChanges, setFlagChanges] = useState<Readonly<Record<string, boolean>>>({});
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [showUntargeted, setShowUntargeted] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<readonly string[]>([]);
  const [limit, setLimit] = useState(ROW_PAGE);
  const [notice, setNotice] = useState<{ tone: "success" | "critical"; text: string } | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);

  // A fresh read replaces the data, keeping what was flagged on or off a moment ago (Shopify's search lags).
  useEffect(() => {
    setProducts((prev) => reconcileProducts(report.products, prev, flagChanges));
    setLevels((prev) => mergeLevels(prev, report.levels));
    setPending(report.pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  useEffect(() => {
    setHiddenIds(readPreferences(browserStorage()).hiddenLocationIds ?? []);
  }, []);

  const variants = useMemo(() => products.flatMap((p) => p.variants), [products]);
  const visibleLocations = report.locations.filter((l) => !hiddenIds.includes(l.id));
  const { groups, rowCount, hiddenUntargeted } = buildReportGroups({
    products,
    levels,
    pending,
    locationIds: visibleLocations.map((l) => l.id),
    filters: { search, lowOnly, showUntargeted },
  });
  const summary = lowSummary(variants.filter(hasTargets), levels, pending);
  const needTargets = productsWithoutTargets(products);
  const plan = useMemo(
    () => planTransfers({ products, levels, pending, sourceIds: report.sourceIds, locations: report.locations }),
    [products, levels, pending, report.sourceIds, report.locations],
  );
  const truncated = products.filter((p) => p.truncated);
  const trackedIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);

  const setHidden = (ids: readonly string[]) => {
    setHiddenIds(ids);
    writePreferences(browserStorage(), { hiddenLocationIds: [...ids] });
  };

  const saveTargets = async (variant: ReportVariant, targets: Targets): Promise<InventoryResponse> => {
    const result = await postInventory({ intent: "saveTargets", variantId: variant.id, digest: variant.digest, targets });
    if (result.ok) {
      setProducts((prev) => withVariantTargets(prev, variant.id, targets, result.digest ?? null));
      setNotice({ tone: "success", text: `Saved targets for ${variant.productTitle}${variant.title === "Default Title" ? "" : ` - ${variant.title}`}.` });
    }
    return result;
  };

  const flag = async (productId: string, tracked: boolean): Promise<InventoryResponse> => {
    const result = await postInventory({ intent: "setFlag", productId, tracked });
    if (!result.ok) return result;
    setFlagChanges((prev) => ({ ...prev, [productId]: tracked }));
    if (tracked && result.product) {
      const product = result.product;
      setProducts((prev) => upsertProduct(prev, product));
      setLevels((prev) => mergeLevels(prev, result.levels ?? {}));
      // The new variants have no targets yet: show them and open the table for editing.
      setShowUntargeted(true);
      setEditing(true);
    } else {
      setProducts((prev) => removeProduct(prev, productId));
    }
    return result;
  };

  const createTransfers = (route: { originId: string; destinationId: string } | undefined): Promise<InventoryResponse> =>
    postInventory({ intent: "createTransfers", key: crypto.randomUUID(), ...(route ?? {}) });

  const created = (transfers: readonly CreatedTransfer[]) => {
    setPending((prev) => addPending(prev, transfers));
    setNotice({ tone: "success", text: `Created ${transfers.length} draft transfer${transfers.length === 1 ? "" : "s"} in Shopify.` });
  };

  return (
    <s-page heading="Inventory" inlineSize="large">
      <s-button slot="primary-action" variant="primary" disabled={Boolean(report.draftsError)} onClick={() => setTransfersOpen(true)}>
        {`Suggest transfers (${plan.transfers.length})`}
      </s-button>
      <s-button slot="secondary-actions" onClick={() => setAddOpen(true)}>Add products</s-button>
      <s-button slot="secondary-actions" onClick={() => setEditing((e) => !e)}>{editing ? "Done editing" : "Edit targets"}</s-button>
      <s-button slot="secondary-actions" loading={refreshing} onClick={onRefresh}>Refresh</s-button>

      <s-stack gap="base">
        {notice && (
          <s-banner tone={notice.tone} dismissible>{notice.text}</s-banner>
        )}
        {report.draftsError && <s-banner tone="warning" heading="Transfer suggestions are off">{report.draftsError}</s-banner>}
        {summary.variants > 0 && (
          <s-banner tone="critical" heading={`${summary.variants} item${summary.variants === 1 ? " is" : "s are"} below the minimum`}>
            {summary.uncoveredVariants < summary.variants
              ? `${summary.variants - summary.uncoveredVariants} of them already have stock on the way. `
              : ""}
            <s-button slot="secondary-actions" onClick={() => setLowOnly(true)}>Show only low</s-button>
          </s-banner>
        )}
        {report.sourceIds.length === 0 && summary.variants > 0 && (
          <s-banner tone="info" heading="No source locations set">
            Choose the locations that supply stock on the <s-link href="/app/settings">Settings page</s-link> to get transfer suggestions.
          </s-banner>
        )}
        {needTargets.length > 0 && (
          <s-banner tone="warning" heading={`${needTargets.length} tracked product${needTargets.length === 1 ? " has" : "s have"} no targets yet`}>
            {needTargets.map((p) => p.title).join(", ")}
            <s-button
              slot="secondary-actions"
              onClick={() => {
                setShowUntargeted(true);
                setEditing(true);
              }}
            >
              Set targets
            </s-button>
          </s-banner>
        )}
        {truncated.length > 0 && (
          <s-banner tone="warning" heading="Some products have more variants than the report reads">
            {truncated.map((p) => p.title).join(", ")}
          </s-banner>
        )}

        <s-section>
          <s-stack gap="base">
            <s-grid gridTemplateColumns="2fr 1fr" gap="base">
              <s-search-field label="Search" value={search} placeholder="Product, variant or SKU" onInput={(e) => { setSearch(fieldValue(e)); setLimit(ROW_PAGE); }} />
            </s-grid>
            <s-stack direction="inline" gap="large">
              <s-checkbox label="Low only" checked={lowOnly} onChange={(e) => setLowOnly(fieldChecked(e))} />
              <s-checkbox
                label={`Show variants without targets (${hiddenUntargeted})`}
                checked={showUntargeted}
                onChange={(e) => setShowUntargeted(fieldChecked(e))}
              />
            </s-stack>
            <s-stack direction="inline" gap="large" alignItems="center">
              <s-text color="subdued">Locations</s-text>
              {report.locations.map((l) => (
                <s-checkbox
                  key={l.id}
                  label={l.name}
                  checked={!hiddenIds.includes(l.id)}
                  onChange={(e) => setHidden(fieldChecked(e) ? hiddenIds.filter((id) => id !== l.id) : [...hiddenIds, l.id])}
                />
              ))}
            </s-stack>
          </s-stack>
        </s-section>

        {products.length === 0 ? (
          <s-section heading="Nothing is tracked yet">
            <s-stack gap="base">
              <s-paragraph>Pick the products to watch, then set a minimum and maximum for each location.</s-paragraph>
              <div>
                <s-button variant="primary" onClick={() => setAddOpen(true)}>Add products</s-button>
              </div>
            </s-stack>
          </s-section>
        ) : rowCount === 0 ? (
          <s-section>
            <s-text color="subdued">No variants match. Clear the filters, or turn on &quot;Show variants without targets&quot;.</s-text>
          </s-section>
        ) : (
          <s-section>
            <s-stack gap="base">
              <InventoryTable groups={limitGroups(groups, limit)} locations={visibleLocations} editing={editing} onSave={saveTargets} />
              {rowCount > limit && (
                <div>
                  <s-button onClick={() => setLimit((n) => n + ROW_PAGE)}>{`Show more (${rowCount - limit} left)`}</s-button>
                </div>
              )}
            </s-stack>
          </s-section>
        )}
      </s-stack>

      <AddProductsModal open={addOpen} collections={collections} trackedIds={trackedIds} onClose={() => setAddOpen(false)} onFlag={flag} />
      <SuggestedTransfersModal
        open={transfersOpen}
        plan={plan}
        locations={report.locations}
        variants={variants}
        hasSources={report.sourceIds.length > 0}
        onClose={() => setTransfersOpen(false)}
        onCreate={createTransfers}
        onCreated={created}
      />
    </s-page>
  );
}
