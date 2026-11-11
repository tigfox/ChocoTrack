import { parseNewKit } from './newKitInput';

describe('parseNewKit', () => {
  it('accepts and trims a valid kit', () => {
    expect(parseNewKit({ title: ' Holiday 5 ', size: 5, sku: ' HOL-5 ', barcode: ' 123 ' })).toEqual({
      ok: true,
      value: { title: 'Holiday 5', size: 5, sku: 'HOL-5', barcode: '123' },
    });
  });
  it('treats a blank barcode as absent', () => {
    expect(parseNewKit({ title: 'T', size: 4, sku: 'S', barcode: '' })).toEqual({ ok: true, value: { title: 'T', size: 4, sku: 'S' } });
    expect(parseNewKit({ title: 'T', size: 4, sku: 'S' }).ok).toBe(true);
  });
  it.each([
    ['not an object', 'x', 'Invalid request.'],
    ['null', null, 'Invalid request.'],
    ['array', [], 'Invalid request.'],
    ['missing title', { size: 4, sku: 'S' }, 'Enter a title.'],
    ['blank title', { title: '  ', size: 4, sku: 'S' }, 'Enter a title.'],
    ['long title', { title: 'x'.repeat(256), size: 4, sku: 'S' }, 'Enter a title.'],
    ['missing sku', { title: 'T', size: 4 }, 'Enter a SKU.'],
    ['bad size', { title: 'T', size: 7, sku: 'S' }, 'Choose a kit size.'],
    ['string size', { title: 'T', size: '6', sku: 'S' }, 'Choose a kit size.'],
    ['bad barcode', { title: 'T', size: 4, sku: 'S', barcode: 5 }, 'That barcode is not valid.'],
  ])('rejects %s', (_n, raw, error) => {
    expect(parseNewKit(raw)).toEqual({ ok: false, error });
  });

  it.each([["17", "17"], [" 17.5 ", "17.5"], ["0.99", "0.99"], ["1234.56", "1234.56"]])("accepts price %s", (price, expected) => {
    expect(parseNewKit({ title: "T", size: 4, sku: "S", price })).toEqual({
      ok: true,
      value: { title: "T", size: 4, sku: "S", price: expected },
    });
  });
  it("treats a blank price as absent (defaults to 0.00)", () => {
    expect(parseNewKit({ title: "T", size: 4, sku: "S", price: "" })).toEqual({ ok: true, value: { title: "T", size: 4, sku: "S" } });
  });
  it.each(["-1", "abc", "1.234", "1,5", "1e3", "9999999", 5])("rejects price %s", (price) => {
    expect(parseNewKit({ title: "T", size: 4, sku: "S", price })).toEqual({ ok: false, error: "Enter a price like 18.00." });
  });
});
