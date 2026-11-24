import { useCallback, useEffect, useState } from "react";
import { useSettingsAction } from "../hooks/useSettingsAction";
import type { Workspace } from "../shopify/workspace";
import { CreateKitModal } from "./CreateKitModal";
import { CollapsibleSection } from "./CollapsibleSection";
import { KitSettingsCard } from "./KitSettingsCard";
import { LinkKitModal } from "./LinkKitModal";
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
  const [linking, setLinking] = useState(false);
  const { busy, response, submit } = useSettingsAction();
  const closeModal = useCallback(() => setCreating(false), []);
  const closeLink = useCallback(() => setLinking(false), []);

  useEffect(() => {
    if (response?.ok) {
      setCreating(false);
      setLinking(false);
    }
  }, [response]);

  return (
    <s-page heading="ChocoTrack Settings" inlineSize="base">
      <s-stack gap="base">
        {response?.ok && <s-banner tone="success">{response.message}</s-banner>}
        <CollapsibleSection heading="Sampler Kits" defaultOpen={workspace.kits.length === 0}>
          <s-stack gap="base">
            {workspace.kits.length === 0 && (
              <s-banner tone="warning" heading="No kits yet">
                Use a product the store already sells as a kit, or create a new one. A kit is an ordinary product with tracked inventory.
              </s-banner>
            )}
            {workspace.kits.map((kit) => (
              <KitSettingsCard key={kit.id} kit={kit} collections={workspace.collections} />
            ))}
            <s-stack direction="inline" gap="base">
              <s-button variant="primary" onClick={() => setLinking(true)}>
                Use an existing product as a kit
              </s-button>
              <s-button onClick={() => setCreating(true)}>Create a new kit</s-button>
            </s-stack>
          </s-stack>
        </CollapsibleSection>
        <SourceLocationsCard locations={workspace.locations} sourceIds={sourceIds} />
        <MultiplesCard multiples={multiples} />
        <LinkKitModal
          open={linking}
          existing={workspace.kits}
          collections={workspace.collections}
          busy={busy}
          error={response && !response.ok ? response.message : undefined}
          onClose={closeLink}
          onLink={(link) => void submit({ intent: "link", ...link })}
        />
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
