/** Grid row layout for 1–5 items (max 3 per row) with centered partial rows. */
export function buildMediaRows<T>(items: T[], columns = 3): T[][] {
  const n = items.length;
  if (n === 0) return [];
  if (n === 1) return [[items[0]]];
  if (n === 2) return [[items[0], items[1]]];
  if (n === 3) return [[items[0], items[1], items[2]]];
  if (n === 4) return [[items[0], items[1], items[2]], [items[3]]];
  if (n === 5) return [[items[0], items[1], items[2]], [items[3], items[4]]];
  const rows: T[][] = [];
  for (let i = 0; i < n; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

export function isRowCentered(rowLength: number, totalCount: number): boolean {
  if (totalCount <= 3) return totalCount < 3;
  const remainder = totalCount % 3;
  if (remainder === 0) return false;
  return rowLength < 3;
}
