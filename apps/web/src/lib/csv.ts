/**
 * CSV export/import utilities for admin reference data.
 */

/** Convert an array of objects to a CSV string. */
export function toCSV<T extends Record<string, unknown>>(
  rows: T[],
  columns: { key: keyof T; header: string }[],
): string {
  const header = columns.map((c) => c.header).join(',');
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const val = row[c.key];
        if (val == null) return '';
        const str = String(val);
        // Escape fields that contain commas, quotes, or newlines
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(','),
  );
  return [header, ...body].join('\n');
}

/** Parse a CSV string into an array of objects. Returns the rows and the header line. */
export function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  return { headers, rows };
}

function parseRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Build a map from a CSV rows array given a header index for the key column. */
export function rowsToMap<T extends Record<string, string | number | null>>(
  rows: string[][],
  headers: string[],
  keyIndex: number,
  mapper: (row: string[] | undefined) => T,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = row[keyIndex];
    if (key != null && key !== '') {
      map.set(key, mapper(row));
    }
  }
  return map;
}

/** Trigger a CSV file download in the browser. */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
