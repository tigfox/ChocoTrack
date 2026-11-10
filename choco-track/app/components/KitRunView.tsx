import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { buildPickList } from "../domain/pickList";
import { sumUnits } from "../domain/stock";
import type { StockMap, UnitCounts } from "../domain/types";
import { useVariantSearch } from "../hooks/useVariantSearch";
import { PAGE_SIZE } from "../lib/searchParams";
import type { CatalogVariant } from "../shopify/catalog";
import type { SubmitResult } from "../shopify/submit";
import type { Workspace } from "../shopify/workspace";
import type { RunResponse } from "../lib/handleRun";
import { BoxPreview } from "./BoxPreview";
import { CreateKitModal } from "./CreateKitModal";
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

type KitResponse = { ok: true; kit: CatalogVariant } | { ok: false; message: string };

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
  const [locationId, setLocationId] = useState(workspace.locations[0]?.id ?? "");
  const [kits, setKits] = useState<readonly CatalogVariant[]>(workspace.kits);
  const [kitId, setKitId] = useState((workspace.kits.find((k) => k.kitSize === 6) ?? workspace.kits[0])?.id ?? "");
  const [kitCountRaw, setKitCountRaw] = useState("1");
  const [perKit, setPerKit] = useState<UnitCounts>({});
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [known, setKnown] = useState<Readonly<Record<string, CatalogVariant>>>(() => index(workspace.kits));
  const [stock, setStock] = useState<StockMap>(workspace.stock);
  const [shown, setShown] = useState<Shown | undefined>();
  const [creating, setCreating] = useState(false);
  const runId = useRef(crypto.randomUUID());

  const search = useVariantSearch(query, collectionId, limit);
  const submitFetcher = useFetcher<RunResponse>();
  const kitFetcher = useFetcher<KitResponse>();
  const submitting = submitFetcher.state !== "idle";

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

  const submittedLabel = useRef("");
  const submittedLocation = useRef("");

  const submit = () => {
    submittedLabel.current = config.doneLabel(kitCount, kit?.title ?? "kit");
    submittedLocation.current = locationName;
    const seenStock = Object.fromEntries(
      [kitId, ...Object.keys(perKit)].map((id) => [id, stock[id] ?? {}]),
    );
    submitFetcher.submit(
      { mode, kitId, kitCount, locationId, perKit, seenStock, runId: runId.current },
      { method: "post", encType: "application/json" },
    );
  };

  useEffect(() => {
    const data = submitFetcher.data;
    if (!data) return;
    setShown({ result: data.result, label: submittedLabel.current, locationName: submittedLocation.current });
    if (data.stock) setStock((prev) => mergeStock(prev, data.stock ?? {}));
    if (data.result.ok) {
      setPerKit({});
      runId.current = crypto.randomUUID();
    } else if (data.result.kind === "conflict") {
      runId.current = crypto.randomUUID();
    }
  }, [submitFetcher.data]);

  const createKit = (input: { title: string; size: number; sku: string; barcode: string }) =>
    kitFetcher.submit(input, { method: "post", action: "/app/api/kits", encType: "application/json" });

  useEffect(() => {
    const data = kitFetcher.data;
    if (!data?.ok) return;
    setKits((prev) => (prev.some((k) => k.id === data.kit.id) ? prev : [...prev, data.kit]));
    setKnown((prev) => ({ ...prev, [data.kit.id]: data.kit }));
    setKitId(data.kit.id);
    setCreating(false);
  }, [kitFetcher.data]);

  const closeModal = useCallback(() => setCreating(false), []);

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
            {config.canCreateKit
              ? "Create a kit to get started. A kit is an ordinary product with tracked inventory."
              : "There are no kits to break down. Kits are created on the Assemble page."}
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
              onLocation={setLocationId}
              kitId={kitId}
              onKit={setKitId}
              kitCount={kitCountRaw}
              onKitCount={setKitCountRaw}
              countLabel={config.countLabel}
              {...(config.canCreateKit ? { onCreateKit: () => setCreating(true) } : {})}
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
        {config.canCreateKit && (
          <CreateKitModal
            open={creating}
            existing={allVariants}
            busy={kitFetcher.state !== "idle"}
            error={kitFetcher.data && !kitFetcher.data.ok ? kitFetcher.data.message : undefined}
            onClose={closeModal}
            onCreate={createKit}
          />
        )}
      </s-stack>
    </s-page>
  );
}
