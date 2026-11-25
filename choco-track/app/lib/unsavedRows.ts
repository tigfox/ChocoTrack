/** The ids of Inventory rows with edits that were not saved, kept as an immutable list. Returns the same list when nothing changes. */
export const withDirty = (ids: readonly string[], id: string, dirty: boolean): readonly string[] => {
  const has = ids.includes(id);
  if (dirty === has) return ids;
  return dirty ? [...ids, id] : ids.filter((x) => x !== id);
};

export const unsavedMessage = (count: number): string =>
  count === 1 ? "1 row has changes you haven't saved." : `${count} rows have changes you haven't saved.`;
