/** Logs an error's name and message with context, never the raw error object (it can carry request details). */
export const logError = (label: string, err: unknown, context: Readonly<Record<string, unknown>> = {}): void => {
  console.error(label, { ...context, error: err instanceof Error ? `${err.name}: ${err.message}` : "unknown" });
};
