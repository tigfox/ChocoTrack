import { useState } from "react";
import { notifyAlertsChanged } from "../lib/alertsChanged";
import { postInventory } from "../lib/postInventory";

/** Restarts the Inventory setup guide. Alerts pause until it is finished again; also how the guide is tested. */
export function RestartSetup({ initialConfirming = false }: { readonly initialConfirming?: boolean }) {
  const [confirming, setConfirming] = useState(initialConfirming);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | undefined>();

  const restart = async () => {
    setBusy(true);
    setMessage(undefined);
    const result = await postInventory({ intent: "setup", action: "restart" });
    setBusy(false);
    setConfirming(false);
    setMessage({ ok: result.ok, text: result.message });
    if (result.ok) notifyAlertsChanged();
  };

  return (
    <s-stack gap="base">
      <s-heading>Restart the setup guide</s-heading>
        <s-paragraph color="subdued">
          Run the Inventory setup guide again. Alerts stay off until you finish it and turn them on. Your products, targets and settings are kept.
        </s-paragraph>
        {message && (
          <s-banner tone={message.ok ? "success" : "critical"}>
            {message.text}
            {message.ok && <> <s-link href="/app/inventory">Open Inventory</s-link></>}
          </s-banner>
        )}
        {confirming ? (
          <s-stack direction="inline" gap="small-200">
            <s-button variant="primary" tone="critical" loading={busy} onClick={() => void restart()}>Pause alerts now</s-button>
            <s-button disabled={busy} onClick={() => setConfirming(false)}>Cancel</s-button>
          </s-stack>
        ) : (
          <div>
            <s-button onClick={() => setConfirming(true)}>Pause alerts and restart setup</s-button>
          </div>
        )}
    </s-stack>
  );
}
