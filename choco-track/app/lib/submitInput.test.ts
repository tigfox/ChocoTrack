import { parseSubmitInput } from './submitInput';

const V = 'gid://shopify/ProductVariant/1';
const K = 'gid://shopify/ProductVariant/2';
const L = 'gid://shopify/Location/3';
const valid = () => ({
  mode: 'assemble',
  kitId: K,
  kitCount: 2,
  locationId: L,
  perKit: { [V]: 6 },
  seenStock: { [V]: { [L]: 20 }, [K]: { [L]: 0 } },
  runId: '0f8fad5b-d9cb-469f-a165-70867728950e',
});

describe('parseSubmitInput', () => {
  it('accepts a valid request', () => {
    const r = parseSubmitInput(valid());
    expect(r).toMatchObject({ ok: true, value: { mode: 'assemble', kitCount: 2 } });
  });
  it('accepts disassemble', () => {
    expect(parseSubmitInput({ ...valid(), mode: 'disassemble' }).ok).toBe(true);
  });
  it.each([
    ['non-object', 'x'],
    ['array', []],
    ['null', null],
  ])('rejects %s', (_n, raw) => {
    expect(parseSubmitInput(raw)).toEqual({ ok: false, error: 'Invalid request.' });
  });
  it.each([
    ['mode', { mode: 'sell' }],
    ['kit id', { kitId: 'nope' }],
    ['kit id of the wrong type', { kitId: L }],
    ['location', { locationId: V }],
    ['fractional kit count', { kitCount: 1.5 }],
    ['zero kit count', { kitCount: 0 }],
    ['huge kit count', { kitCount: 1e9 }],
    ['run id', { runId: 'x' }],
    ['empty mix', { perKit: {} }],
    ['array mix', { perKit: [] }],
    ['bad mix id', { perKit: { nope: 1 } }],
    ['zero in mix', { perKit: { [V]: 0 } }],
    ['string in mix', { perKit: { [V]: '6' } }],
    ['too many per kit', { perKit: { [V]: 101 } }],
    ['non-object stock', { seenStock: 5 }],
    ['negative stock', { seenStock: { [V]: { [L]: -1 } } }],
    ['bad stock location', { seenStock: { [V]: { nope: 1 } } }],
    ['bad stock variant', { seenStock: { nope: { [L]: 1 } } }],
    ['non-object levels', { seenStock: { [V]: 3 } }],
  ])('rejects invalid %s', (_n, patch) => {
    expect(parseSubmitInput({ ...valid(), ...patch }).ok).toBe(false);
  });
  it('rejects oversized snapshots', () => {
    const many = Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`gid://shopify/ProductVariant/${i + 10}`, 1]));
    expect(parseSubmitInput({ ...valid(), perKit: many }).ok).toBe(false);
    const stock = Object.fromEntries(Array.from({ length: 52 }, (_, i) => [`gid://shopify/ProductVariant/${i + 10}`, {}]));
    expect(parseSubmitInput({ ...valid(), seenStock: stock }).ok).toBe(false);
  });
});
