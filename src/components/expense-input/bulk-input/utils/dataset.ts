export function normalizeRow(row: string[] = []): string[] {
  return row.map(cell => (cell ?? '').trim());
}

export function hasMeaningfulData(row: string[]): boolean {
  return row.some(cell => cell && cell.trim().length > 0);
}

export function getColumnLabel(index: number, headerRow?: string[] | null): string {
  const headerValue = headerRow?.[index]?.trim();
  if (headerValue) {
    return headerValue;
  }

  if (index >= 0 && index < 26) {
    return `Столбец ${String.fromCharCode(65 + index)}`;
  }

  return `Столбец ${index + 1}`;
}
