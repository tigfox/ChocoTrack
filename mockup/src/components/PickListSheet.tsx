import { createPortal } from 'react-dom';
import { boxSlots } from '../domain/box';
import type { PickList } from '../domain/pickList';
import type { UnitCounts, Variant } from '../domain/types';
import { BoxGrid } from './BoxGrid';

interface Props {
  readonly list: PickList;
  readonly locationName: string;
  readonly perKit: UnitCounts;
  readonly variants: readonly Variant[];
}

/** Print-only sheet, rendered into #print-root (hidden on screen, shown by the print stylesheet). */
export function PickListSheet({ list, locationName, perKit, variants }: Props) {
  const root = document.getElementById('print-root');
  if (!root || !list.kit) return null;
  const assemble = list.mode === 'assemble';
  const slots = boxSlots(list.kit, perKit, variants);
  return createPortal(
    <div data-testid="pick-list" className="pick-sheet">
      <h1>{assemble ? 'Pick list - assemble kits' : 'Return list - break down kits'}</h1>
      <p>
        <strong>{list.kit.title}</strong> ({list.kit.sku}) x {list.kitCount} &nbsp;|&nbsp; Location: {locationName} &nbsp;|&nbsp;{' '}
        {new Date().toLocaleDateString(undefined, { dateStyle: 'medium' })}
      </p>
      <table>
        <thead>
          <tr>
            <th>Done</th>
            <th>Flavor</th>
            <th>SKU</th>
            <th>Barcode</th>
            <th>Per kit</th>
            <th>{assemble ? 'Total to pick' : 'Total to return'}</th>
            <th>In stock</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {list.rows.map((r) => (
            <tr key={r.variantId}>
              <td className="box-cell">&#9744;</td>
              <td>{r.title}</td>
              <td>{r.sku}</td>
              <td>{r.barcode}</td>
              <td>{r.perKit}</td>
              <td><strong>{r.total}</strong></td>
              <td>{r.available === null ? 'not stocked' : r.available}</td>
              <td>{r.short > 0 ? `SHORT by ${r.short}` : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>Total mini bars</td>
            <td colSpan={3}><strong>{list.totalUnits}</strong></td>
          </tr>
        </tfoot>
      </table>
      <h2>Box layout</h2>
      <BoxGrid size={list.kit.kitSize ?? 6} slots={slots} tile={72} />
      <p className="sign-line">Packed by: ______________________ &nbsp;&nbsp; Checked by: ______________________</p>
    </div>,
    root,
  );
}
