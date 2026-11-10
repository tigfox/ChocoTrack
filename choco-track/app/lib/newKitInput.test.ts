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
});
