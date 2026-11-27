import { CollapsibleSection } from "./CollapsibleSection";
import { ResetSettings } from "./ResetSettings";
import { RestartSetup } from "./RestartSetup";

interface Props {
  /** Called after a reset, so the page can load the cleared settings. */
  readonly onReset?: () => Promise<void> | void;
}

/** One Settings card for starting over: restart the Inventory setup guide, or reset every ChocoTrack setting. */
export function SetupSettingsCard({ onReset }: Props) {
  return (
    <CollapsibleSection heading="Setup guide and reset">
      <s-stack gap="large">
        <RestartSetup />
        <s-divider />
        <ResetSettings {...(onReset ? { onReset } : {})} />
      </s-stack>
    </CollapsibleSection>
  );
}
