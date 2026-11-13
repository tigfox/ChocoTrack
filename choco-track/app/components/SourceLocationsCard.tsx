import { useState } from "react";
import type { Location } from "../domain/types";
import { moveItem } from "../lib/listOps";
import { postInventory } from "../lib/postInventory";

interface Props {
  readonly locations: readonly Location[];
  readonly sourceIds: readonly string[];
}

/** Which locations supply stock for suggested transfers, and in what order they are tried. */
export function SourceLocationsCard({ locations, sourceIds }: Props) {
  const [ids, setIds] = useState<readonly string[]>(() => sourceIds.filter((id) => locations.some((l) => l.id === id)));
  const [saved, setSaved] = useState<readonly string[]>(ids);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | undefined>();
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? id;
  const others = locations.filter((l) => !ids.includes(l.id));
  const changed = ids.length !== saved.length || ids.some((id, i) => id !== saved[i]);

  const save = async () => {
    setBusy(true);
    setMessage(undefined);
    const result = await postInventory({ intent: "saveSources", sourceIds: ids });
    setBusy(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) setSaved(ids);
  };

  return (
    <s-section heading="Transfer sources">
      <s-stack gap="base">
        <s-paragraph color="subdued">
          Suggested transfers take stock from these locations, in this order, and never below their own minimum. Every other location is a destination.
        </s-paragraph>
        {message && <s-banner tone={message.ok ? "success" : "critical"}>{message.text}</s-banner>}
        {ids.length === 0 && <s-text color="subdued">No source locations yet.</s-text>}
        {ids.map((id, i) => (
          <s-stack key={id} direction="inline" gap="small-200" alignItems="center">
            <s-text>{`${i + 1}. ${nameOf(id)}`}</s-text>
            <s-button accessibilityLabel={`Move ${nameOf(id)} up`} disabled={i === 0} onClick={() => setIds((l) => moveItem(l, i, -1))}>Up</s-button>
            <s-button accessibilityLabel={`Move ${nameOf(id)} down`} disabled={i === ids.length - 1} onClick={() => setIds((l) => moveItem(l, i, 1))}>Down</s-button>
            <s-button tone="critical" accessibilityLabel={`Remove ${nameOf(id)}`} onClick={() => setIds((l) => l.filter((x) => x !== id))}>Remove</s-button>
          </s-stack>
        ))}
        {others.length > 0 && (
          <s-stack gap="small-200">
            <s-text color="subdued">Add a source</s-text>
            <s-stack direction="inline" gap="small-200">
              {others.map((l) => (
                <s-button key={l.id} onClick={() => setIds((list) => [...list, l.id])}>{l.name}</s-button>
              ))}
            </s-stack>
          </s-stack>
        )}
        <div>
          <s-button variant="primary" disabled={!changed || busy} loading={busy} onClick={() => void save()}>Save sources</s-button>
        </div>
      </s-stack>
    </s-section>
  );
}
