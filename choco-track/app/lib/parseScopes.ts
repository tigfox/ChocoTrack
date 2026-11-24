/** Reads `current` from an app/scopes_update webhook payload. Returns null when it is not a list of strings. */
export function parseScopes(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const current = (payload as { current?: unknown }).current;
  if (!Array.isArray(current) || !current.every((s) => typeof s === "string")) return null;
  return current.join(",");
}
