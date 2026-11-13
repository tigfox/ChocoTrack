export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What a staff member picked last time. Per-browser convenience only; never required. */
export interface Preferences {
  readonly locationId?: string;
  readonly kitId?: string;
  /** An empty string means "All items". */
  readonly collectionId?: string;
  /** Inventory report columns this browser has hidden. */
  readonly hiddenLocationIds?: readonly string[];
}

const KEY = "choco-track:prefs";
const FIELDS = ["locationId", "kitId", "collectionId"] as const;

export const readPreferences = (storage: StorageLike | undefined): Preferences => {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const record = parsed as Record<string, unknown>;
    const hidden = record.hiddenLocationIds;
    return {
      ...Object.fromEntries(FIELDS.flatMap((f) => (typeof record[f] === "string" ? [[f, record[f]]] : []))),
      ...(Array.isArray(hidden) ? { hiddenLocationIds: hidden.filter((id): id is string => typeof id === "string") } : {}),
    };
  } catch {
    return {};
  }
};

export const writePreferences = (storage: StorageLike | undefined, update: Preferences): void => {
  try {
    storage?.setItem(KEY, JSON.stringify({ ...readPreferences(storage), ...update }));
  } catch {
    // Storage can be blocked (private windows); the app works the same without it.
  }
};

export const pickInitialSelection = (
  locations: ReadonlyArray<{ readonly id: string }>,
  kits: ReadonlyArray<{ readonly id: string; readonly kitSize?: number }>,
  prefs: Preferences,
): { locationId: string; kitId: string } => {
  const location = locations.find((l) => l.id === prefs.locationId) ?? locations[0];
  const kit = kits.find((k) => k.id === prefs.kitId) ?? kits.find((k) => k.kitSize === 6) ?? kits[0];
  return { locationId: location?.id ?? "", kitId: kit?.id ?? "" };
};

/** The mini-bar collection by name, unless the user chose something else (including "All items") before. */
export const defaultCollectionId = (
  collections: ReadonlyArray<{ readonly id: string; readonly title: string }>,
  remembered?: string,
): string => {
  if (remembered === "" || (remembered !== undefined && collections.some((c) => c.id === remembered))) return remembered;
  return collections.find((c) => /mini/i.test(c.title))?.id ?? "";
};

/** A kit with a category starts the picker on it; otherwise the remembered or default collection stands. */
export const collectionForKit = (
  kit: { readonly categoryId?: string } | undefined,
  collections: ReadonlyArray<{ readonly id: string }>,
  fallback: string,
): string => (kit?.categoryId && collections.some((c) => c.id === kit.categoryId) ? kit.categoryId : fallback);
