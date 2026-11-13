import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { fetchJson } from "../lib/fetchJson";

/** Tracked variants below their minimum, for the sidebar. Looked up in the background so it never delays a page. */
export function useLowCount(): number | undefined {
  const [count, setCount] = useState<number | undefined>();
  const { pathname } = useLocation();

  useEffect(() => {
    let current = true;
    void fetchJson<{ ok: boolean; count?: number }>("/app/api/inventory-low").then((res) => {
      if (current && res.ok && res.data.ok && typeof res.data.count === "number") setCount(res.data.count);
    });
    return () => {
      current = false;
    };
  }, [pathname]);

  return count;
}
