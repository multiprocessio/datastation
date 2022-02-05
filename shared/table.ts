import { NotAnArrayOfObjectsError } from './errors';
import { getPath } from './object';

export function columnsFromObject(
  value: any,
  columns: Array<string>,
  panelSource: number | string
) {
  if (!value || !Array.isArray(value)) {
    throw new NotAnArrayOfObjectsError(panelSource);
  }

  return (value || []).map((row: any) => {
    // If none specified, select all
    if (!columns.length) {
      return row;
    }

    if (!row) {
      return null;
    }

    const cells: Record<string, any> = {};
    (columns || []).forEach((name) => {
      cells[name] = getPath(row, name);
    });
    return cells;
  });
}
