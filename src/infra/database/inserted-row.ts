export function insertedRow<T>(rows: readonly T[]): T {
  const [row] = rows;
  if (row === undefined) {
    throw new Error('The database returned no row for an insert that must return one.');
  }
  return row;
}
