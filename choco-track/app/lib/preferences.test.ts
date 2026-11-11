import { collectionForKit, defaultCollectionId, pickInitialSelection, readPreferences, writePreferences, type StorageLike } from "./preferences";

const memory = (initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } => {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
};

describe("readPreferences / writePreferences", () => {
  it("round-trips", () => {
    const storage = memory();
    writePreferences(storage, { locationId: "L1", kitId: "K1", collectionId: "C1" });
    expect(readPreferences(storage)).toEqual({ locationId: "L1", kitId: "K1", collectionId: "C1" });
  });
  it("returns empty preferences when nothing is stored, storage is missing, or the data is junk", () => {
    expect(readPreferences(memory())).toEqual({});
    expect(readPreferences(undefined)).toEqual({});
    expect(readPreferences(memory({ "choco-track:prefs": "{nope" }))).toEqual({});
    expect(readPreferences(memory({ "choco-track:prefs": '{"locationId":5,"kitId":"K"}' }))).toEqual({ kitId: "K" });
    expect(readPreferences(memory({ "choco-track:prefs": "[]" }))).toEqual({});
  });
  it("survives storage that throws (private mode, blocked cookies)", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    expect(readPreferences(broken)).toEqual({});
    expect(() => writePreferences(broken, { locationId: "L1" })).not.toThrow();
  });
  it("merges with what is already stored", () => {
    const storage = memory();
    writePreferences(storage, { locationId: "L1", kitId: "K1" });
    writePreferences(storage, { kitId: "K2" });
    expect(readPreferences(storage)).toEqual({ locationId: "L1", kitId: "K2" });
  });
});

describe("pickInitialSelection", () => {
  const locations = [{ id: "L1" }, { id: "L2" }];
  const kits = [{ id: "K4", kitSize: 4 }, { id: "K6", kitSize: 6 }];
  it("falls back to the first location and the 6-pack", () => {
    expect(pickInitialSelection(locations, kits, {})).toEqual({ locationId: "L1", kitId: "K6" });
  });
  it("uses remembered choices that still exist", () => {
    expect(pickInitialSelection(locations, kits, { locationId: "L2", kitId: "K4" })).toEqual({ locationId: "L2", kitId: "K4" });
  });
  it("ignores remembered choices that no longer exist", () => {
    expect(pickInitialSelection(locations, kits, { locationId: "gone", kitId: "gone" })).toEqual({ locationId: "L1", kitId: "K6" });
  });
  it("copes with no kits or locations", () => {
    expect(pickInitialSelection([], [], {})).toEqual({ locationId: "", kitId: "" });
    expect(pickInitialSelection(locations, [{ id: "K4", kitSize: 4 }], {}).kitId).toBe("K4");
  });
});

describe("defaultCollectionId", () => {
  it("prefers a collection whose title mentions mini", () => {
    expect(defaultCollectionId([{ id: "a", title: "Home page" }, { id: "b", title: "Mini bars (not sold individually)" }])).toBe("b");
  });
  it("is empty (all items) when there is no such collection", () => {
    expect(defaultCollectionId([{ id: "a", title: "Dark chocolate" }])).toBe("");
    expect(defaultCollectionId([])).toBe("");
  });
  it("only trusts a remembered collection that still exists", () => {
    const collections = [{ id: "a", title: "Mini" }, { id: "b", title: "Dark" }];
    expect(defaultCollectionId(collections, "b")).toBe("b");
    expect(defaultCollectionId(collections, "gone")).toBe("a");
    expect(defaultCollectionId(collections, "")).toBe("");
  });
});

describe('collectionForKit', () => {
  const collections = [{ id: 'c1', title: 'Milk' }, { id: 'c2', title: 'Dark' }];
  it('starts on the kit category when the collection exists', () => {
    expect(collectionForKit({ categoryId: 'c2' }, collections, 'c1')).toBe('c2');
  });
  it('falls back when the kit has no category or it no longer exists', () => {
    expect(collectionForKit({}, collections, 'c1')).toBe('c1');
    expect(collectionForKit(undefined, collections, 'c1')).toBe('c1');
    expect(collectionForKit({ categoryId: 'gone' }, collections, 'c1')).toBe('c1');
  });
});
