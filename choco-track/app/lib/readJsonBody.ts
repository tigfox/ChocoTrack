export const MAX_BODY_BYTES = 64 * 1024;

/** Parses a JSON request body, returning null if it is too large, malformed or empty. */
export const readJsonBody = async (request: Request, maxBytes: number = MAX_BODY_BYTES): Promise<unknown> => {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  const text = await request.text().catch(() => "");
  if (text.length === 0 || text.length > maxBytes) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};
