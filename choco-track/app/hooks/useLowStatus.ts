import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { fetchJson } from "../lib/fetchJson";
import { onAlertsChanged } from "../lib/alertsChanged";
import type { LowStatus } from "../lib/lowCount";

interface LowResponse {
  readonly ok: boolean;
  readonly count?: number;
  readonly setupNeeded?: boolean;
}

/** Low-stock count, or "setup needed", for the sidebar. Looked up in the background so it never delays a page. */
export function useLowStatus(): LowStatus | undefined {
  const [status, setStatus] = useState<LowStatus | undefined>();
  const { pathname } = useLocation();
  // Bumped when alerts are turned on or paused, so the sidebar looks again without a page change.
  const [version, setVersion] = useState(0);

  useEffect(() => onAlertsChanged(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let current = true;
    void fetchJson<LowResponse>("/app/api/inventory-low").then((res) => {
      if (!current) return;
      if (res.ok && res.data.ok && typeof res.data.count === "number") {
        setStatus({ count: res.data.count, setupNeeded: res.data.setupNeeded === true });
      } else if (version > 0) {
        setStatus(undefined); // after a change, an old number would be wrong; plain "Inventory" is not
      }
    });
    return () => {
      current = false;
    };
  }, [pathname, version]);

  return status;
}
