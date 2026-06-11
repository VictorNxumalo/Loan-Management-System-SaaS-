export function escapeCsv(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvLine(cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCsv).join(',');
}
