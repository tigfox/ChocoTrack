import type { CSSProperties, ReactNode } from "react";

interface Props {
  readonly heading: string;
  readonly defaultOpen?: boolean;
  readonly children: ReactNode;
}

const SUMMARY: CSSProperties = { cursor: "pointer", fontWeight: 600, fontSize: "var(--p-font-size-400, 1rem)", padding: "4px 0" };
const BODY: CSSProperties = { paddingTop: "var(--p-space-400, 12px)" };

/**
 * A card that folds away behind a disclosure triangle. Polaris has no such element, so this uses the browser's own
 * details/summary. The content stays mounted while closed, so unsaved edits and messages survive a fold.
 */
export function CollapsibleSection({ heading, defaultOpen = false, children }: Props) {
  return (
    <s-section>
      <details open={defaultOpen}>
        <summary style={SUMMARY}>{heading}</summary>
        <div style={BODY}>{children}</div>
      </details>
    </s-section>
  );
}
