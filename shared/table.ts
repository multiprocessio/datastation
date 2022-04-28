import { NotAnArrayOfObjectsError } from './errors';
import { getPath } from './object';

export function columnsFromObject(
  value: any,
  columns: Array<string>,
  panelSource: number | string,
  page: number,
  pageSize: number
) {
  if (!value || !Array.isArray(value)) {
    throw new NotAnArrayOfObjectsError(panelSource);
  }

  if (isNaN(page)) {
    page = 0;
  }

  if (isNaN(pageSize)) {
    pageSize = 15;
  }

  return (value || [])
    .slice(page * pageSize, (page + 1) * pageSize)
    .map((row: any) => {
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
