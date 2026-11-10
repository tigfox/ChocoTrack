import { boxLayout, type BoxSlot } from "../domain/box";
import type { KitSize } from "../domain/types";

interface Props {
  readonly size: KitSize;
  readonly slots: readonly (BoxSlot | null)[];
  /** Fixed tile size in px (print sheet); fluid when omitted. */
  readonly tile?: number;
}

/** The box laid out as it is packed: 1x4, 1x6 or 2x6, one tile per bar. */
export function BoxGrid({ size, slots, tile }: Props) {
  const { rows, cols } = boxLayout(size);
  return (
    <div
      data-testid="box-grid"
      data-layout={`${rows}x${cols}`}
      style={{
        display: 'grid',
        gridTemplateColumns: tile ? `repeat(${cols}, ${tile}px)` : `repeat(${cols}, 1fr)`,
        gap: 6,
        padding: 8,
        background: '#efe6dc',
        borderRadius: 10,
        width: tile ? 'fit-content' : undefined,
      }}
    >
      {slots.map((slot, i) => (
        <div
          key={`${i}-${slot?.variantId ?? 'empty'}`}
          data-testid="box-slot"
          style={{
            aspectRatio: '1',
            borderRadius: 8,
            overflow: 'hidden',
            border: slot ? 'none' : '1.5px dashed #b9a896',
            background: slot ? undefined : 'rgba(255,255,255,0.5)',
          }}
        >
          {slot?.imageUrl ? (
            <img src={slot.imageUrl} alt={slot.title} style={{ width: '100%', height: '100%', display: 'block' }} />
          ) : slot ? (
            <div style={{ fontSize: 10, padding: 4 }}>{slot.title}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
