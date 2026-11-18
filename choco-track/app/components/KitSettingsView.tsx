import { useCallback, useEffect, useState } from "react";
import { useSettingsAction } from "../hooks/useSettingsAction";
import type { Workspace } from "../shopify/workspace";
import { CreateKitModal } from "./CreateKitModal";
import { CollapsibleSection } from "./CollapsibleSection";
import { KitSettingsCard } from "./KitSettingsCard";
import type { Multiples } from "../domain/multiples";
import { MultiplesCard } from "./MultiplesCard";
import { SourceLocationsCard } from "./SourceLocationsCard";

interface Props {
  readonly workspace: Workspace;
  readonly sourceIds: readonly string[];
  readonly multiples: Multiples;
}

export function KitSettingsView({ workspace, sourceIds, multiples }: Props) {
  const [creating, setCreating] = useState(false);
  const { busy, response, submit } = useSettingsAction();
  const closeModal = useCallback(() => setCreating(false), []);

  useEffect(() => {
    if (response?.ok) setCreating(false);
  }, [response]);

  return (
    <s-page heading="ChocoTrack Settings" inlineSize="base">
      <s-stack gap="base">
        {response?.ok && <s-banner tone="success">{response.message}</s-banner>}
        <CollapsibleSection heading="Sampler Kits" defaultOpen={workspace.kits.length === 0}>
          <s-stack gap="base">
            {workspace.kits.length === 0 && (
              <s-banner tone="warning" heading="No kits yet">
                Create a kit to get started. A kit is an ordinary product with tracked inventory.
              </s-banner>
            )}
            {workspace.kits.map((kit) => (
              <KitSettingsCard key={kit.id} kit={kit} collections={workspace.collections} />
            ))}
            <div>
              <s-button variant="primary" onClick={() => setCreating(true)}>
                Create a new kit
              </s-button>
            </div>
          </s-stack>
        </CollapsibleSection>
        <SourceLocationsCard locations={workspace.locations} sourceIds={sourceIds} />
        <MultiplesCard multiples={multiples} />
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
