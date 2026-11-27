import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { fetchJson } from "../lib/fetchJson";
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

  useEffect(() => {
    let current = true;
    void fetchJson<LowResponse>("/app/api/inventory-low").then((res) => {
      if (current && res.ok && res.data.ok && typeof res.data.count === "number") {
        setStatus({ count: res.data.count, setupNeeded: res.data.setupNeeded === true });
      }
    });
    return () => {
      current = false;
    };
  }, [pathname]);

  return status;
}
