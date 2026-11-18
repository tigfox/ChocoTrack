import { useState } from "react";
import { nameKey, validateMultiple, type Multiples } from "../domain/multiples";
import { postInventory } from "../lib/postInventory";
import { fieldValue } from "../wc";
import { CollapsibleSection } from "./CollapsibleSection";

interface Props {
  readonly multiples: Multiples;
}

interface Row {
  readonly name: string;
  readonly multiple: string;
}

const toRows = (m: Multiples): readonly Row[] => Object.entries(m.byName).map(([name, n]) => ({ name, multiple: String(n) }));
const sameRows = (a: readonly Row[], b: readonly Row[]) => a.length === b.length && a.every((r, i) => r.name === b[i]?.name && r.multiple === b[i]?.multiple);

/** How many bars ship at once: a default, plus overrides by variant name (for example "Mini"). */
export function MultiplesCard({ multiples }: Props) {
  const [fallback, setFallback] = useState(String(multiples.fallback));
  const [rows, setRows] = useState<readonly Row[]>(() => toRows(multiples));
  const [saved, setSaved] = useState({ fallback: String(multiples.fallback), rows: toRows(multiples) });
  const [newName, setNewName] = useState("");
  const [newMultiple, setNewMultiple] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | undefined>();

  const key = nameKey(newName);
  const addProblem =
    key === "" ? "Enter a variant name." : rows.some((r) => r.name === key) ? "That name is already listed." : validateMultiple(Number(newMultiple));
  const changed = fallback !== saved.fallback || !sameRows(rows, saved.rows);
  const problem = validateMultiple(Number(fallback)) ?? rows.map((r) => validateMultiple(Number(r.multiple))).find((p) => p !== undefined);

  const add = () => {
    setRows((list) => [...list, { name: key, multiple: newMultiple }]);
    setNewName("");
    setNewMultiple("");
  };

  const save = async () => {
    setBusy(true);
    setMessage(undefined);
    const result = await postInventory({
      intent: "saveMultiples",
      fallback: Number(fallback),
      overrides: rows.map((r) => ({ name: r.name, multiple: Number(r.multiple) })),
    });
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) setSaved({ fallback, rows });
  };

  return (
    <CollapsibleSection heading="Send in multiples of">
      <s-stack gap="base">
        <s-paragraph color="subdued">
          Suggested transfers send whole multiples of these numbers, as close to the maximum as possible without going over. If that would leave a location
          below its minimum, they round up to the next full multiple instead. Overrides match the variant name, for example Mini.
        </s-paragraph>
        {message && <s-banner tone={message.ok ? "success" : "critical"}>{message.text}</s-banner>}
        <s-number-field label="Default" min={1} max={1000} value={fallback} onInput={(e) => setFallback(fieldValue(e))} />
        {rows.length === 0 && <s-text color="subdued">No overrides: every variant uses the default.</s-text>}
        {rows.map((r, i) => (
          <s-stack key={r.name} direction="inline" gap="small-200" alignItems="end">
            <s-text>{r.name}</s-text>
            <s-number-field
              label={`${r.name} multiple`}
              labelAccessibilityVisibility="exclusive"
              min={1}
              max={1000}
              value={r.multiple}
              onInput={(e) => setRows((list) => list.map((x, j) => (j === i ? { ...x, multiple: fieldValue(e) } : x)))}
            />
            <s-button tone="critical" accessibilityLabel={`Remove ${r.name}`} onClick={() => setRows((list) => list.filter((_, j) => j !== i))}>Remove</s-button>
          </s-stack>
        ))}
        <s-stack gap="small-200">
          <s-text color="subdued">Add an override</s-text>
          <s-stack direction="inline" gap="small-200" alignItems="end">
            <s-text-field label="Variant name" value={newName} placeholder="Mini" onInput={(e) => setNewName(fieldValue(e))} />
            <s-number-field label="Multiple" min={1} max={1000} value={newMultiple} onInput={(e) => setNewMultiple(fieldValue(e))} />
            <s-button disabled={addProblem !== undefined} onClick={add}>Add</s-button>
          </s-stack>
        </s-stack>
        {problem && <s-text tone="critical">{problem}</s-text>}
        <div>
          <s-button variant="primary" disabled={!changed || problem !== undefined || busy} loading={busy} onClick={() => void save()}>Save pack sizes</s-button>
        </div>
      </s-stack>
    </CollapsibleSection>
  );
}
