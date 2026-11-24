import { useEffect, useMemo, useState } from "react";
import { kitSizeError } from "../domain/kitSize";
import type { Collection, KitSize, Variant } from "../domain/types";
import { useModal } from "../hooks/useModal";
import { useVariantSearch } from "../hooks/useVariantSearch";
import { guessKitSize } from "../lib/guessKitSize";
import { fieldValue } from "../wc";
import { CategorySelect } from "./CategorySelect";

interface Props {
  readonly open: boolean;
  readonly collections: readonly Collection[];
  /** Kits already set up, so they are not offered again. */
  readonly existing: readonly Variant[];
  readonly busy: boolean;
  readonly error?: string | undefined;
  readonly onClose: () => void;
  readonly onLink: (link: { variantId: string; size: KitSize; categoryId: string }) => void;
}

const RESULT_LIMIT = 25;

/** Picks a product the store already sells (a sampler box, a gift pack) and marks it as a kit. */
export function LinkKitModal({ open, collections, existing, busy, error: serverError, onClose, onLink }: Props) {
  const ref = useModal(open, onClose);
  return (
    <s-modal ref={ref} heading="Use an existing product as a kit" id="link-kit-modal">
      {open && <LinkKitForm collections={collections} existing={existing} busy={busy} serverError={serverError} onClose={onClose} onLink={onLink} />}
    </s-modal>
  );
}

interface FormProps extends Pick<Props, "collections" | "existing" | "busy" | "onClose" | "onLink"> {
  readonly serverError: string | undefined;
}

function LinkKitForm({ collections, existing, busy, serverError, onClose, onLink }: FormProps) {
  const [query, setQuery] = useState("");
  const [variantId, setVariantId] = useState("");
  const [size, setSize] = useState("6");
  const [sizeEdited, setSizeEdited] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const { data, loading, error: searchError } = useVariantSearch(query, "", RESULT_LIMIT);

  const taken = useMemo(() => new Set(existing.map((k) => k.id)), [existing]);
  const choices = (data?.variants ?? []).filter((v) => !taken.has(v.id));
  const chosen = choices.find((v) => v.id === variantId);
  const sizeProblem = kitSizeError(Number(size));

  // Suggest the size from the chosen product's name, until the user types one of their own.
  useEffect(() => {
    if (chosen && !sizeEdited) setSize(String(guessKitSize(chosen.title) ?? 6));
  }, [chosen?.id, sizeEdited]); // eslint-disable-line react-hooks/exhaustive-deps -- only a new choice should suggest a size

  const link = () => {
    if (!chosen || sizeProblem) return;
    onLink({ variantId: chosen.id, size: Number(size) as KitSize, categoryId });
  };

  return (
    <>
      <s-stack gap="base">
        <s-paragraph color="subdued">
          Search for a product the store already sells, such as a sampler box. Its inventory must be tracked. The mini bars that go in it are chosen each time you assemble.
        </s-paragraph>
        {(serverError || searchError) && <s-banner tone="critical">{serverError ?? searchError}</s-banner>}
        <s-text-field label="Search by name, SKU or barcode" value={query} onInput={(e) => setQuery(fieldValue(e))} />
        {/* s-select does not refresh its options, so remount it when the results change. */}
        <s-select key={choices.map((v) => v.id).join("|")} label="Product" value={chosen?.id ?? ""} onInput={(e) => setVariantId(fieldValue(e))}>
          <s-option value="">{loading ? "Searching..." : choices.length === 0 ? "No matching products" : "Choose a product"}</s-option>
          {choices.map((v) => (
            <s-option key={v.id} value={v.id}>{v.sku ? `${v.title} (${v.sku})` : v.title}</s-option>
          ))}
        </s-select>
        <s-number-field label="Kit size (mini bars)" min={1} max={48} value={size} error={sizeProblem} onInput={(e) => {
            setSizeEdited(true);
            setSize(fieldValue(e));
          }} />
        <CategorySelect collections={collections} value={categoryId} onChange={setCategoryId} />
      </s-stack>
      <s-button slot="primary-action" variant="primary" disabled={!chosen || Boolean(sizeProblem) || busy} onClick={link}>Use as kit</s-button>
      <s-button slot="secondary-actions" onClick={onClose}>Cancel</s-button>
    </>
  );
}
