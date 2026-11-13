import { useEffect, useMemo, useRef, useState } from "react";
import { buildPickList } from "../domain/pickList";
import { sumUnits } from "../domain/stock";
import type { StockMap, UnitCounts } from "../domain/types";
import { useVariantSearch } from "../hooks/useVariantSearch";
import { collectionForKit, defaultCollectionId, pickInitialSelection, readPreferences, writePreferences, type Preferences } from "../lib/preferences";
import { browserStorage } from "../lib/browserStorage";
import { fetchJson } from "../lib/fetchJson";
import { PAGE_SIZE } from "../lib/searchParams";
import type { CatalogVariant } from "../shopify/catalog";
import type { SubmitResult } from "../shopify/submit";
import type { Workspace } from "../shopify/workspace";
import type { RunResponse } from "../lib/handleRun";
import { BoxPreview } from "./BoxPreview";
import { FlavorPicker } from "./FlavorPicker";
import { KitFields } from "./KitFields";
import { MixSummary } from "./MixSummary";
import { PickListSheet } from "./PickListSheet";
import { ResultBanner } from "./ResultBanner";
import { RUN_MODES, type RunMode } from "./runModes";

interface Props {
  readonly workspace: Workspace;
  readonly mode: RunMode;
}

interface Shown {
  readonly result: SubmitResult;
  readonly label: string;
  readonly locationName: string;
}

const index = (variants: readonly CatalogVariant[]): Readonly<Record<string, CatalogVariant>> =>
  Object.fromEntries(variants.map((v) => [v.id, v]));

const mergeStock = (a: StockMap, b: StockMap): StockMap => {
  const merged: Record<string, Readonly<Record<string, number>>> = { ...a };
  for (const [id, levels] of Object.entries(b)) merged[id] = { ...a[id], ...levels };
  return merged;
};

export function KitRunView({ workspace, mode }: Props) {
  const config = RUN_MODES[mode];
  const initial = pickInitialSelection(workspace.locations, workspace.kits, {});
  const [locationId, setLocationId] = useState(initial.locationId);
  const kits = workspace.kits;
  const [kitId, setKitId] = useState(initial.kitId);
  const [kitCountRaw, setKitCountRaw] = useState("1");
  const [perKit, setPerKit] = useState<UnitCounts>({});
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState(() => defaultCollectionId(workspace.collections));
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [known, setKnown] = useState<Readonly<Record<string, CatalogVariant>>>(() => index(workspace.kits));
  const [stock, setStock] = useState<StockMap>(workspace.stock);
  const [shown, setShown] = useState<Shown | undefined>();
  const runId = useRef(crypto.randomUUID());

  // Apply what this browser remembered (after mount, so server and client render the same first paint).
  useEffect(() => {
    const prefs = readPreferences(browserStorage());
    const chosen = pickInitialSelection(workspace.locations, workspace.kits, prefs);
    setLocationId(chosen.locationId);
    setKitId(chosen.kitId);
    const remembered = defaultCollectionId(workspace.collections, prefs.collectionId);
    setCollectionId(collectionForKit(workspace.kits.find((k) => k.id === chosen.kitId), workspace.collections, remembered));
  }, [workspace.locations, workspace.kits, workspace.collections]);

  const remember = (update: Preferences) => writePreferences(browserStorage(), update);

  // A kit with a category starts the picker on it. The staff member can still change the filter afterwards.
  const chooseKit = (id: string) => {
    setKitId(id);
    remember({ kitId: id });
    setCollectionId((current) => collectionForKit(kits.find((k) => k.id === id), workspace.collections, current));
    setLimit(PAGE_SIZE);
  };

  const search = useVariantSearch(query, collectionId, limit);
  const [submitting, setSubmitting] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState<string | undefined>();

  // Keep every variant we have seen (titles for the summary, ids for the box preview) and its stock.
  useEffect(() => {
    if (!search.data) return;
    setKnown((prev) => ({ ...prev, ...index(search.data?.variants ?? []) }));
    setStock((prev) => mergeStock(prev, search.data?.stock ?? {}));
  }, [search.data]);

  const kit = known[kitId];
  const kitCount = Number(kitCountRaw);
  const validCount = Number.isInteger(kitCount) && kitCount >= 1;
  const locationName = workspace.locations.find((l) => l.id === locationId)?.name ?? "";
  const issues = config.validate({ stock, variantsById: known, locationId, kit, kitCount, perKit });
  const pickList = buildPickList({ stock, variantsById: known, mode, kit, kitCount, perKit, locationId });
  const allVariants = useMemo(() => Object.values(known), [known]);

  const applyResponse = (data: RunResponse, label: string, locationLabel: string) => {
    setShown({ result: data.result, label, locationName: locationLabel });
    if (data.stock) setStock((prev) => mergeStock(prev, data.stock ?? {}));
    if (data.result.ok) {
      setPerKit({});
      runId.current = crypto.randomUUID();
    } else if (data.result.kind === "conflict") {
      runId.current = crypto.randomUUID();
    }
  };

  const submit = async () => {
    const label = config.doneLabel(kitCount, kit?.title ?? "kit");
    const seenStock = Object.fromEntries([kitId, ...Object.keys(perKit)].map((id) => [id, stock[id] ?? {}]));
    setSubmitting(true);
    setUnconfirmed(undefined);
    const res = await fetchJson<RunResponse>(`/app/api/run?mode=${mode}`, {
      mode,
      kitId,
      kitCount,
      locationId,
      perKit,
      seenStock,
      runId: runId.current,
    });
    setSubmitting(false);
    if (res.ok) {
      setShown(undefined);
      applyResponse(res.data, label, locationName);
    } else {
      // The change may or may not have reached Shopify. The run id is kept, so trying again cannot apply it twice.
      setShown(undefined);
      setUnconfirmed(res.message);
    }
  };

  return (
    <s-page heading={config.pageHeading} inlineSize="large">
      <s-stack gap="base">
        {workspace.locations.length === 0 && (
          <s-banner tone="critical" heading="No locations found">
            Add an active location in Shopify (Settings, Locations) to use this page.
          </s-banner>
        )}
        {kits.length === 0 && (
          <s-banner tone="warning" heading="No kits yet">
            Add a kit on the Settings page to get started. A kit is an ordinary product with tracked inventory.
          </s-banner>
        )}
        {unconfirmed && (
          <s-banner tone="warning" heading="We couldn't confirm that went through" dismissible>
            {`${unconfirmed} Your mix is still here. Trying again is safe: the same request will not be applied twice. If it keeps failing, check the stock in Shopify first.`}
          </s-banner>
        )}
        {shown && (
          <ResultBanner {...shown} variantsById={known} onDismiss={() => setShown(undefined)} />
        )}
        <s-grid gridTemplateColumns="3fr 2fr" gap="base" alignItems="start">
          <s-stack gap="base">
            <KitFields
              heading="Where and what"
              stock={stock}
              locations={workspace.locations}
              kits={kits}
              locationId={locationId}
              onLocation={(id) => {
                setLocationId(id);
                remember({ locationId: id });
              }}
              kitId={kitId}
              onKit={chooseKit}
              kitCount={kitCountRaw}
              onKitCount={setKitCountRaw}
              countLabel={config.countLabel}
            />
            <FlavorPicker
              heading={config.pickerHeading(kit?.title ?? "kit")}
              variants={search.data?.variants ?? []}
              collections={workspace.collections}
              stock={stock}
              locationId={locationId}
              counts={perKit}
              onChange={setPerKit}
              query={query}
              onQuery={(q) => {
                setQuery(q);
                setLimit(PAGE_SIZE);
              }}
              collectionId={collectionId}
              onCollection={(id) => {
                setCollectionId(id);
                remember({ collectionId: id });
                setLimit(PAGE_SIZE);
              }}
              canShowMore={(search.data?.variants.length ?? 0) >= limit}
              onShowMore={() => setLimit((n) => n + PAGE_SIZE)}
              loading={search.loading}
              error={search.error}
              {...(config.flagShortages ? { demandMultiplier: validCount ? kitCount : 1 } : {})}
            />
          </s-stack>
          <s-stack gap="base">
            <MixSummary
              heading="Mix per kit"
              progressLabel={`mini bars in each kit (needs exactly ${kit?.kitSize ?? 0})`}
              units={sumUnits(perKit)}
              target={kit?.kitSize ?? 0}
              chosen={Object.entries(perKit).map(([id, n]) => [known[id]?.title ?? id, n] as const)}
              extra={<s-text color="subdued">{config.note({ stock, perKit, kitCount, locationId, locationName })}</s-text>}
              issues={issues}
              busy={submitting}
              actionLabel={config.actionLabel(kitCount)}
              onAction={submit}
              secondaryLabel="Print pick list"
              secondaryDisabled={!kit || pickList.rows.length === 0}
              onSecondary={() => window.print()}
            />
            <BoxPreview kit={kit} perKit={perKit} variants={allVariants} />
          </s-stack>
        </s-grid>
        <PickListSheet list={pickList} locationName={locationName} perKit={perKit} variants={allVariants} />
      </s-stack>
    </s-page>
  );
}
