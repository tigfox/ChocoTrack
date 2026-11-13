/** A copy of the list with the item at `index` moved by `by` places (-1 up, 1 down); unchanged at the ends. */
export const moveItem = <T>(list: readonly T[], index: number, by: -1 | 1): readonly T[] => {
  const target = index + by;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  return list.map((item, i) => (i === index ? (list[target] as T) : i === target ? (list[index] as T) : item));
};
