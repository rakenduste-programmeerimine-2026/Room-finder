/**
 * A copy of `list` with the item at `from` moved to `to`. An index outside
 * the list leaves the order unchanged.
 */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return copy;
  }
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
