/** Parses RFC 4180 CSV text into rows of fields. Quoted fields may hold commas, quotes ("") and newlines. */
export const parseCsv = (input: string): readonly (readonly string[])[] => {
  const text = input.startsWith('﻿') ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;
  const endField = () => {
    row = [...row, field];
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i] as string;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === ',') endField();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      endRow();
    } else field += c;
    i += 1;
  }
  if (quoted) throw new Error('CSV has an unterminated quoted field');
  if (field !== '' || row.length > 0) endRow();
  return rows;
};

/** Rows keyed by the header row. Fully blank rows are skipped and short rows are padded with ''. */
export const csvToRecords = (rows: readonly (readonly string[])[]): readonly Record<string, string>[] => {
  const [header = [], ...body] = rows;
  return body
    .filter((r) => r.some((f) => f !== ''))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
};
