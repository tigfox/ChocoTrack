import { useCallback, useState } from "react";
import { useRevalidator } from "react-router";
import { fetchJson } from "../lib/fetchJson";
import type { SettingsResponse } from "../lib/handleKitSettings";

/** Posts a kit create/edit, keeps the outcome for display, and reloads the kit list after a success. */
export function useSettingsAction() {
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<SettingsResponse | undefined>();
  const { revalidate } = useRevalidator();

  const submit = useCallback(
    async (body: Record<string, unknown>): Promise<SettingsResponse> => {
      setBusy(true);
      setResponse(undefined);
      const res = await fetchJson<SettingsResponse>("/app/api/kit-settings", body);
      const outcome: SettingsResponse = res.ok ? res.data : { ok: false, message: res.message };
      setResponse(outcome);
      setBusy(false);
      if (outcome.ok) await revalidate();
      return outcome;
    },
    [revalidate],
  );

  /** Forget the last outcome, so a reopened modal does not show an old error. */
  const reset = useCallback(() => setResponse(undefined), []);

  return { busy, response, submit, reset };
}
