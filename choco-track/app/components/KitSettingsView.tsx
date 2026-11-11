import { useCallback, useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type { SettingsResponse } from "../lib/handleKitSettings";
import type { Workspace } from "../shopify/workspace";
import { CreateKitModal } from "./CreateKitModal";
import { KitSettingsCard } from "./KitSettingsCard";

interface Props {
  readonly workspace: Workspace;
}

export function KitSettingsView({ workspace }: Props) {
  const [creating, setCreating] = useState(false);
  const fetcher = useFetcher<SettingsResponse>();
  const closeModal = useCallback(() => setCreating(false), []);

  useEffect(() => {
    if (fetcher.data?.ok) setCreating(false);
  }, [fetcher.data]);

  return (
    <s-page heading="Kit settings" inlineSize="base">
      <s-button slot="primary-action" variant="primary" onClick={() => setCreating(true)}>
        Create a new kit
      </s-button>
      <s-stack gap="base">
        {fetcher.data?.ok && <s-banner tone="success">{fetcher.data.message}</s-banner>}
        {workspace.kits.length === 0 && (
          <s-banner tone="warning" heading="No kits yet">
            Create a kit to get started. A kit is an ordinary product with tracked inventory.
          </s-banner>
        )}
        {workspace.kits.map((kit) => (
          <KitSettingsCard key={kit.id} kit={kit} collections={workspace.collections} />
        ))}
        <CreateKitModal
          open={creating}
          existing={workspace.kits}
          collections={workspace.collections}
          busy={fetcher.state !== "idle"}
          error={fetcher.data && !fetcher.data.ok ? fetcher.data.message : undefined}
          onClose={closeModal}
          onCreate={(kit) =>
            fetcher.submit({ intent: "create", ...kit }, { method: "post", encType: "application/json" })
          }
        />
      </s-stack>
    </s-page>
  );
}
