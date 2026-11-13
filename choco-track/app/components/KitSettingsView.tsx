import { useCallback, useEffect, useState } from "react";
import { useSettingsAction } from "../hooks/useSettingsAction";
import type { Workspace } from "../shopify/workspace";
import { CreateKitModal } from "./CreateKitModal";
import { KitSettingsCard } from "./KitSettingsCard";
import { SourceLocationsCard } from "./SourceLocationsCard";

interface Props {
  readonly workspace: Workspace;
  readonly sourceIds: readonly string[];
}

export function KitSettingsView({ workspace, sourceIds }: Props) {
  const [creating, setCreating] = useState(false);
  const { busy, response, submit } = useSettingsAction();
  const closeModal = useCallback(() => setCreating(false), []);

  useEffect(() => {
    if (response?.ok) setCreating(false);
  }, [response]);

  return (
    <s-page heading="Kit settings" inlineSize="base">
      <s-button slot="primary-action" variant="primary" onClick={() => setCreating(true)}>
        Create a new kit
      </s-button>
      <s-stack gap="base">
        {response?.ok && <s-banner tone="success">{response.message}</s-banner>}
        {workspace.kits.length === 0 && (
          <s-banner tone="warning" heading="No kits yet">
            Create a kit to get started. A kit is an ordinary product with tracked inventory.
          </s-banner>
        )}
        {workspace.kits.map((kit) => (
          <KitSettingsCard key={kit.id} kit={kit} collections={workspace.collections} />
        ))}
        <SourceLocationsCard locations={workspace.locations} sourceIds={sourceIds} />
        <CreateKitModal
          open={creating}
          existing={workspace.kits}
          collections={workspace.collections}
          busy={busy}
          error={response && !response.ok ? response.message : undefined}
          onClose={closeModal}
          onCreate={(kit) => void submit({ intent: "create", ...kit })}
        />
      </s-stack>
    </s-page>
  );
}
