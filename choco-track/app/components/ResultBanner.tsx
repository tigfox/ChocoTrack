import { useRef } from "react";
import type { Variant } from "../domain/types";
import type { SubmitResult } from "../shopify/submit";
import { useWcEvent } from "../wc";

interface Props {
  readonly result: SubmitResult;
  readonly label: string;
  readonly variantsById: Readonly<Record<string, Variant>>;
  readonly locationName: string;
  readonly onDismiss: () => void;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

export function ResultBanner({ result, label, variantsById, locationName, onDismiss }: Props) {
  const ref = useRef<HTMLElementTagNameMap["s-banner"]>(null);
  useWcEvent(ref, "dismiss", onDismiss);

  if (result.ok) {
    return (
      <s-banner ref={ref} tone="success" heading={`${label} complete`} dismissible>
        <s-stack gap="small">
          <s-paragraph>{`Inventory adjusted at ${locationName} in a single all-or-nothing update:`}</s-paragraph>
          <s-unordered-list>
            {result.changes.map((c) => (
              <s-list-item key={c.variantId}>{`${signed(c.delta)}  ${variantsById[c.variantId]?.title ?? c.variantId}`}</s-list-item>
            ))}
          </s-unordered-list>
        </s-stack>
      </s-banner>
    );
  }
  if (result.kind === "conflict") {
    return (
      <s-banner ref={ref} tone="warning" heading="Nothing was changed" dismissible>
        <s-paragraph>{result.message}</s-paragraph>
      </s-banner>
    );
  }
  if (result.kind === "error") {
    return (
      <s-banner ref={ref} tone="critical" heading="Nothing was changed" dismissible>
        <s-paragraph>{result.message}</s-paragraph>
      </s-banner>
    );
  }
  return (
    <s-banner ref={ref} tone="critical" heading="Can't complete this yet" dismissible>
      <s-unordered-list>
        {result.issues.map((i) => (
          <s-list-item key={`${i.code}-${i.variantId ?? ""}`}>{i.message}</s-list-item>
        ))}
      </s-unordered-list>
    </s-banner>
  );
}
