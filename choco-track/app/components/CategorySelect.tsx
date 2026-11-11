import type { Collection } from "../domain/types";
import { fromOptionValue, NO_OPTION, toOptionValue } from "../lib/emptyOption";
import { fieldValue } from "../wc";

interface Props {
  readonly collections: readonly Collection[];
  /** Empty string means no category. */
  readonly value: string;
  readonly onChange: (id: string) => void;
}

/** s-select does not refresh options, so remount it when the collection list changes. */
export function CategorySelect({ collections, value, onChange }: Props) {
  return (
    <s-select
      key={collections.map((c) => c.id).join("|")}
      label="Category"
      details="Assembling this kit starts the mini-bar list on this collection."
      value={toOptionValue(value)}
      onInput={(e) => onChange(fromOptionValue(fieldValue(e)))}
    >
      <s-option value={NO_OPTION}>No category</s-option>
      {collections.map((c) => (
        <s-option key={c.id} value={c.id}>{c.title}</s-option>
      ))}
    </s-select>
  );
}
