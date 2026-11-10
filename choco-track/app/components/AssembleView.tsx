import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFetcher } from "react-router";
import { buildPickList } from "../domain/pickList";
import { maxBuildable, sumUnits } from "../domain/stock";
import type { StockMap, UnitCounts } from "../domain/types";
import { validateAssembly } from "../domain/validate";
import { useVariantSearch } from "../hooks/useVariantSearch";
import type { CatalogVariant } from "../shopify/catalog";
import type { SubmitResult } from "../shopify/submit";
import type { Workspace } from "../shopify/workspace";
import { BoxPreview } from "./BoxPreview";
import { CreateKitModal } from "./CreateKitModal";
import { FlavorPicker } from "./FlavorPicker";
import { KitFields } from "./KitFields";
import { MixSummary } from "./MixSummary";
import { PickListSheet } from "./PickListSheet";
import { ResultBanner } from "./ResultBanner";

interface Props {
  readonly workspace: Workspace;
}

interface SubmitResponse {
  readonly result: SubmitResult;
  readonly stock?: StockMap | undefined;
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

export function AssembleView({ workspace }: Props) {
  const [locationId, setLocationId] = useState(workspace.locations[0]?.id ?? "");
  const [kits, setKits] = useState<readonly CatalogVariant[]>(workspace.kits);
  const [kitId, setKitId] = useState((workspace.kits.find((k) => k.kitSize === 6) ?? workspace.kits[0])?.id ?? "");
  const [kitCountRaw, setKitCountRaw] = useState("1");
  const [perKit, setPerKit] = useState<UnitCounts>({});
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [known, setKnown] = useState<Readonly<Record<string, CatalogVariant>>>(() => index(workspace.kits));
  const [stock, setStock] = useState<StockMap>(workspace.stock);
  const [shown, setShown] = useState<Shown | undefined>();
  const [creating, setCreating] = useState(false);
  const runId = useRef(crypto.randomUUID());

  const search = useVariantSearch(query, collectionId);
  const submitFetcher = useFetcher<SubmitResponse>();
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
  const issues = validateAssembly({ stock, variantsById: known, locationId, kit, kitCount, perKit });
  const pickList = buildPickList({ stock, variantsById: known, mode: "assemble", kit, kitCount, perKit, locationId });
  const allVariants = useMemo(() => Object.values(known), [known]);

  const submittedLabel = useRef("");
  const submittedLocation = useRef("");

  const submit = () => {
    submittedLabel.current = `Assembled ${kitCount} x ${kit?.title ?? "kit"}`;
    submittedLocation.current = locationName;
    const seenStock = Object.fromEntries(
      [kitId, ...Object.keys(perKit)].map((id) => [id, stock[id] ?? {}]),
    );
    submitFetcher.submit(
      { mode: "assemble", kitId, kitCount, locationId, perKit, seenStock, runId: runId.current },
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
    <s-page heading="Assemble kits" inlineSize="large">
      <s-stack gap="base">
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
              countLabel="Kits to assemble"
              onCreateKit={() => setCreating(true)}
            />
            <FlavorPicker
              heading={`Choose the mini bars in each ${kit?.title ?? "kit"}`}
              variants={search.data?.variants ?? []}
              collections={workspace.collections}
              stock={stock}
              locationId={locationId}
              counts={perKit}
              onChange={setPerKit}
              query={query}
              onQuery={setQuery}
              collectionId={collectionId}
              onCollection={setCollectionId}
              loading={search.loading}
              error={search.error}
              demandMultiplier={validCount ? kitCount : 1}
            />
          </s-stack>
          <s-stack gap="base">
            <MixSummary
              heading="Mix per kit"
              progressLabel={`mini bars in each kit (needs exactly ${kit?.kitSize ?? 0})`}
              units={sumUnits(perKit)}
              target={kit?.kitSize ?? 0}
              chosen={Object.entries(perKit).map(([id, n]) => [known[id]?.title ?? id, n] as const)}
              extra={
                <s-text color="subdued">
                  {`Max buildable with this mix at ${locationName}: ${maxBuildable(stock, perKit, locationId)}`}
                </s-text>
              }
              issues={issues}
              busy={submitting}
              actionLabel={`Assemble ${validCount ? kitCount : ""} kit${kitCount === 1 ? "" : "s"}`.replace("  ", " ")}
              onAction={submit}
              secondaryLabel="Print pick list"
              secondaryDisabled={!kit || pickList.rows.length === 0}
              onSecondary={() => window.print()}
            />
            <BoxPreview kit={kit} perKit={perKit} variants={allVariants} />
          </s-stack>
        </s-grid>
        <PickListSheet list={pickList} locationName={locationName} perKit={perKit} variants={allVariants} />
        <CreateKitModal
          open={creating}
          existing={allVariants}
          busy={kitFetcher.state !== "idle"}
          error={kitFetcher.data && !kitFetcher.data.ok ? kitFetcher.data.message : undefined}
          onClose={closeModal}
          onCreate={createKit}
        />
      </s-stack>
    </s-page>
  );
}
