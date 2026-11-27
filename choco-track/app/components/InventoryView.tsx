import { useCallback, useEffect, useMemo, useState } from "react";
import { useRevalidator } from "react-router";
import { resolveSetup, type SetupAction } from "../domain/setup";
import { isMonitored, lowSummary, productsWithoutTargets } from "../domain/tracking";
import type { Targets } from "../domain/targets";
import type { Collection } from "../domain/types";
import { browserStorage } from "../lib/browserStorage";
import type { CreatedTransfer, InventoryResponse } from "../lib/handleInventory";
import { planTransfers } from "../lib/planTransfers";
import { postInventory } from "../lib/postInventory";
import { readPreferences, writePreferences } from "../lib/preferences";
import { buildReportGroups, limitGroups } from "../lib/reportRows";
import { setupFacts } from "../lib/setupFacts";
import { addPending, mergeLevels, reconcileProducts, removeProduct, upsertProduct, withVariantTargets, withVariantUntracked } from "../lib/reportState";
import { unsavedMessage, withDirty } from "../lib/unsavedRows";
import type { InventoryReport, ReportVariant } from "../shopify/trackedCatalog";
import { fieldChecked, fieldValue } from "../wc";
import { AddProductsModal } from "./AddProductsModal";
import { SetupGuide } from "./SetupGuide";
import { InventoryTable } from "./InventoryTable";
import { SuggestedTransfersModal } from "./SuggestedTransfersModal";

const ROW_PAGE = 100;

interface Props {
  readonly report: InventoryReport | undefined;
  readonly collections: readonly Collection[];
  readonly error: string | undefined;
  /** The store name, for links to Shopify admin pages. */
  readonly shopHandle?: string;
}

export function InventoryView({ report, collections, error, shopHandle }: Props) {
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
  return <LoadedInventory report={report} collections={collections} shopHandle={shopHandle} refreshing={state !== "idle"} onRefresh={() => void revalidate()} />;
}

interface LoadedProps {
  readonly report: InventoryReport;
  readonly collections: readonly Collection[];
  readonly shopHandle?: string;
  readonly refreshing: boolean;
  readonly onRefresh: () => void;
}

function LoadedInventory({ report, collections, shopHandle, refreshing, onRefresh }: LoadedProps) {
  const [products, setProducts] = useState(report.products);
  const [levels, setLevels] = useState(report.levels);
  const [pending, setPending] = useState(report.pending);
  const [flagChanges, setFlagChanges] = useState<Readonly<Record<string, boolean>>>({});
  const [editing, setEditing] = useState(false);
  const [dirtyIds, setDirtyIds] = useState<readonly string[]>([]);
  const [confirmingDone, setConfirmingDone] = useState(false);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [showUntargeted, setShowUntargeted] = useState(false);
  const [showUntracked, setShowUntracked] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<readonly string[]>([]);
  const [limit, setLimit] = useState(ROW_PAGE);
  const [notice, setNotice] = useState<{ tone: "success" | "critical"; text: string } | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(false);
  const [storedSetup, setStoredSetup] = useState(report.setup);
  const [setupBusy, setSetupBusy] = useState<SetupAction | undefined>();
  const [setupError, setSetupError] = useState<string | undefined>();

  // A fresh read replaces the data, keeping what was flagged on or off a moment ago (Shopify's search lags).
  useEffect(() => {
    setProducts((prev) => reconcileProducts(report.products, prev, flagChanges));
    setLevels((prev) => mergeLevels(prev, report.levels));
    setPending(report.pending);
    setStoredSetup(report.setup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  useEffect(() => {
    setHiddenIds(readPreferences(browserStorage()).hiddenLocationIds ?? []);
  }, []);

  const variants = useMemo(() => products.flatMap((p) => p.variants), [products]);
  // One answer decides whether any alert shows: the sidebar, banners, low marks and Suggest transfers all follow it.
  const facts = useMemo(() => setupFacts({ products, levels, pending, sourceIds: report.sourceIds }), [products, levels, pending, report.sourceIds]);
  const setup = useMemo(() => resolveSetup(storedSetup, facts), [storedSetup, facts]);
  const alerts = setup.alertsEnabled;
  const visibleLocations = report.locations.filter((l) => !hiddenIds.includes(l.id));
  const { groups, rowCount, hiddenUntargeted, hiddenUntracked } = buildReportGroups({
    products,
    levels,
    pending,
    locationIds: visibleLocations.map((l) => l.id),
    filters: { search, lowOnly: lowOnly && alerts, showUntargeted, showUntracked },
  });
  const summary = lowSummary(variants.filter(isMonitored), levels, pending);
  const needTargets = productsWithoutTargets(products);
  const plan = useMemo(
    () => planTransfers({ products, levels, pending, sourceIds: report.sourceIds, locations: report.locations, packSizes: report.packSizes }),
    [products, levels, pending, report.sourceIds, report.locations, report.packSizes],
  );
  const truncated = products.filter((p) => p.truncated);
  const trackedIds = useMemo(() => new Set(products.map((p) => p.id)), [products]);

  const setDirty = useCallback((id: string, dirty: boolean) => setDirtyIds((prev) => withDirty(prev, id, dirty)), []);
  // Each row saves on its own. Finishing with unsaved rows asks first, so edits are not dropped by accident.
  const toggleEditing = () => {
    if (editing && dirtyIds.length > 0) return setConfirmingDone(true);
    setConfirmingDone(false);
    setEditing((e) => !e);
  };
  const discardAndFinish = () => {
    setConfirmingDone(false);
    setEditing(false);
  };

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

  const setUntracked = async (variant: ReportVariant, untracked: boolean): Promise<InventoryResponse> => {
    const result = await postInventory({ intent: "setVariantUntracked", variantId: variant.id, untracked });
    if (result.ok) setProducts((prev) => withVariantUntracked(prev, variant.id, untracked));
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

  const runSetup = async (action: SetupAction) => {
    setSetupBusy(action);
    setSetupError(undefined);
    const result = await postInventory({ intent: "setup", action });
    setSetupBusy(undefined);
    if (!result.ok) return setSetupError(result.message);
    if (result.setup) setStoredSetup(result.setup);
  };

  const openTargets = () => {
    setShowUntargeted(true);
    setEditing(true);
  };

  const createTransfers = (route: { originId: string; destinationId: string } | undefined): Promise<InventoryResponse> =>
    postInventory({ intent: "createTransfers", key: crypto.randomUUID(), ...(route ?? {}) });

  const created = (transfers: readonly CreatedTransfer[]) => {
    setPending((prev) => addPending(prev, transfers));
    setNotice({ tone: "success", text: `Created ${transfers.length} draft transfer${transfers.length === 1 ? "" : "s"} in Shopify.` });
  };

  return (
    <s-page heading="Inventory" inlineSize="large">
      {alerts && (
        <s-button slot="primary-action" variant="primary" disabled={Boolean(report.draftsError)} onClick={() => setTransfersOpen(true)}>
          {`Suggest transfers (${plan.transfers.length})`}
        </s-button>
      )}
      <s-button slot="secondary-actions" onClick={() => setAddOpen(true)}>Add products</s-button>
      {setup.showTable && <s-button slot="secondary-actions" onClick={toggleEditing}>{editing ? "Done editing" : "Edit targets"}</s-button>}
      <s-button slot="secondary-actions" loading={refreshing} onClick={onRefresh}>Refresh</s-button>

      <s-stack gap="base">
        {notice && (
          <s-banner tone={notice.tone} dismissible>{notice.text}</s-banner>
        )}
        {setup.showGuide && (
          <SetupGuide
            setup={setup}
            facts={facts}
            busy={setupBusy}
            {...(setupError ? { error: setupError } : {})}
            onAddProducts={() => setAddOpen(true)}
            onSetTargets={openTargets}
            onSkipTransfers={() => void runSetup("skipTransfers")}
            onTurnOn={() => void runSetup("complete")}
            onDismiss={() => void runSetup("dismissGuide")}
          />
        )}
        {alerts && report.draftsError && <s-banner tone="warning" heading="Transfer suggestions are off">{report.draftsError}</s-banner>}
        {alerts && summary.variants > 0 && (
          <s-banner tone="critical" heading={`${summary.variants} item${summary.variants === 1 ? " is" : "s are"} below the minimum`}>
            {summary.uncoveredVariants < summary.variants
              ? `${summary.variants - summary.uncoveredVariants} of them already have stock on the way. `
              : ""}
            <s-button slot="secondary-actions" onClick={() => setLowOnly(true)}>Show only low</s-button>
          </s-banner>
        )}
        {alerts && report.sourceIds.length === 0 && summary.variants > 0 && (
          <s-banner tone="info" heading="No source locations set">
            Choose the locations that supply stock on the <s-link href="/app/settings">Settings page</s-link> to get transfer suggestions.
          </s-banner>
        )}
        {alerts && needTargets.length > 0 && (
          <s-banner tone="warning" heading={`${needTargets.length} tracked product${needTargets.length === 1 ? " has" : "s have"} no targets yet`}>
            {needTargets.map((p) => p.title).join(", ")}
            <s-button
              slot="secondary-actions"
              onClick={openTargets}
            >
              Set targets
            </s-button>
          </s-banner>
        )}
        {alerts && truncated.length > 0 && (
          <s-banner tone="warning" heading="Some products have more variants than the report reads">
            {truncated.map((p) => p.title).join(", ")}
          </s-banner>
        )}

        {setup.showTable && (
        <s-section>
          <s-stack gap="base">
            <s-grid gridTemplateColumns="2fr 1fr" gap="base">
              <s-search-field label="Search" value={search} placeholder="Product, variant or SKU" onInput={(e) => { setSearch(fieldValue(e)); setLimit(ROW_PAGE); }} />
            </s-grid>
            <s-stack direction="inline" gap="large">
              {alerts && <s-checkbox label="Low only" checked={lowOnly} onChange={(e) => setLowOnly(fieldChecked(e))} />}
              <s-checkbox
                label={`Show variants without targets (${hiddenUntargeted})`}
                checked={showUntargeted}
                onChange={(e) => setShowUntargeted(fieldChecked(e))}
              />
              <s-checkbox
                label={`Show untracked variants (${hiddenUntracked})`}
                checked={showUntracked}
                onChange={(e) => setShowUntracked(fieldChecked(e))}
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
        )}

        {!setup.showTable ? null : products.length === 0 ? (
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
            <s-text color="subdued">No variants match. Clear the filters, or turn on &quot;Show variants without targets&quot; or &quot;Show untracked variants&quot;.</s-text>
          </s-section>
        ) : (
          <s-section>
            <s-stack gap="base">
              {editing && confirmingDone && dirtyIds.length > 0 && (
                <s-banner tone="warning" heading="Unsaved changes">
                  <s-stack gap="small-200">
                    <s-text>{`${unsavedMessage(dirtyIds.length)} Press Save on each row to keep them.`}</s-text>
                    <s-stack direction="inline" gap="small-200">
                      <s-button variant="primary" onClick={() => setConfirmingDone(false)}>Keep editing</s-button>
                      <s-button onClick={discardAndFinish}>Discard changes</s-button>
                    </s-stack>
                  </s-stack>
                </s-banner>
              )}
              {editing && !confirmingDone && <s-text color="subdued">Each row saves on its own: press Save on a row before you finish.</s-text>}
              <InventoryTable groups={limitGroups(groups, limit)} locations={visibleLocations} editing={editing} alerts={alerts} onSave={saveTargets} onDirty={setDirty} onUntracked={setUntracked} />
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
        shopHandle={shopHandle}
        onClose={() => setTransfersOpen(false)}
        onCreate={createTransfers}
        onCreated={created}
      />
    </s-page>
  );
}
