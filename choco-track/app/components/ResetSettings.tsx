import { useCallback, useState } from "react";
import { useModal } from "../hooks/useModal";
import { notifyAlertsChanged } from "../lib/alertsChanged";
import { postInventory } from "../lib/postInventory";

interface Props {
  /** Called after a successful reset, so the page can load the cleared settings. */
  readonly onReset?: () => Promise<void> | void;
}

/**
 * The reset part of the combined setup card. Puts every ChocoTrack setting back to a first-time state (products, inventory counts and kits are untouched).
 * It is destructive and cannot be undone, so it asks first, in a modal that names the consequences.
 */
export function ResetSettings({ onReset }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [message, setMessage] = useState<string | undefined>();
  const close = useCallback(() => {
    setOpen(false);
    setError(undefined);
  }, []);
  const modal = useModal(open, close);

  const reset = async () => {
    setBusy(true);
    setError(undefined);
    const result = await postInventory({ intent: "resetSettings", confirm: true });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setOpen(false);
    setMessage(result.message);
    notifyAlertsChanged();
    await onReset?.();
  };

  return (
    <>
      <s-stack gap="base">
        <s-heading>Reset all settings</s-heading>
        <s-paragraph color="subdued">
          Start over as if ChocoTrack were just installed. This clears the tracked products, targets, transfer sources and pack sizes, and restarts the setup guide. Products, inventory counts and kits are not changed.
        </s-paragraph>
        {message && <s-banner tone="success">{message}</s-banner>}
        <div>
          <s-button tone="critical" onClick={() => setOpen(true)}>Reset all settings</s-button>
        </div>
      </s-stack>
      <s-modal ref={modal} heading="Reset all settings?">
        <s-stack gap="base">
          <s-text>This clears the list of tracked products, all minimum and maximum targets and the Untracked switches. It also clears transfer sources and pack sizes, and restarts the setup guide, so alerts stay off until it is finished again.</s-text>
          <s-text>Products, inventory counts, kits and collections are not changed.</s-text>
          <s-text tone="caution">This action cannot be undone.</s-text>
          {error && <s-text tone="critical">{error}</s-text>}
        </s-stack>
        <s-button slot="primary-action" variant="primary" tone="critical" loading={busy} onClick={() => void reset()}>Reset all settings</s-button>
        <s-button slot="secondary-actions" variant="secondary" disabled={busy} onClick={close}>Cancel</s-button>
      </s-modal>
    </>
  );
}
