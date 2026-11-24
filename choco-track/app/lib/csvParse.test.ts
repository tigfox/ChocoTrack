import { csvToRecords, parseCsv } from './csvParse';

describe('parseCsv', () => {
  it('splits rows and fields', () => {
    expect(parseCsv('a,b\n1,2\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('keeps commas, quotes and newlines inside quoted fields', () => {
    expect(parseCsv('a,b\n"x, ""y""","line1\nline2"\n')).toEqual([['a', 'b'], ['x, "y"', 'line1\nline2']]);
  });
  it('handles CRLF, a missing final newline, empty fields and a BOM', () => {
    expect(parseCsv('﻿a,b\r\n,2')).toEqual([['a', 'b'], ['', '2']]);
  });
  it('returns no rows for empty input', () => {
    expect(parseCsv('')).toEqual([]);
  });
  it('rejects an unterminated quote', () => {
    expect(() => parseCsv('a\n"oops')).toThrow(/unterminated/i);
  });
});

describe('csvToRecords', () => {
  it('keys each row by the header and skips fully blank rows', () => {
    expect(csvToRecords([['a', 'b'], ['1', '2'], ['', ''], ['3']])).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '' },
    ]);
  });
});
