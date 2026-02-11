/**
 * Export utility functions for CSV generation.
 * Uses vanilla JavaScript - no external dependencies required.
 */

/**
 * Column configuration for export.
 */
export interface ExportColumn {
  /** Key to access in data row (supports nested via dot notation is not used here - flat keys only) */
  key: string;
  /** Display label for the column header */
  label: string;
  /** Optional formatter to transform value before export */
  formatter?: (value: any, row: any) => string;
}

/**
 * Format a date value as dd/mm/yyyy.
 */
function formatDateValue(value: any): string {
  if (!value) return '';
  const date = new Date(value);
  if (isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Escape a CSV cell value to handle special characters.
 * Wraps in quotes if the value contains commas, quotes, or newlines.
 */
function escapeCSVValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert a single value to a string suitable for CSV export.
 */
function valueToString(value: any): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return formatDateValue(value);
  return String(value);
}

/**
 * Trigger a file download in the browser.
 */
function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to CSV format and trigger download.
 *
 * @param data - Array of data objects to export
 * @param columns - Column configuration defining which fields to export and how
 * @param fileName - Base file name (without extension, date will be appended)
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  columns: ExportColumn[],
  fileName: string
): void {
  // BOM character for Excel UTF-8 support
  const BOM = '\uFEFF';

  // Build header row
  const header = columns.map((col) => escapeCSVValue(col.label)).join(',');

  // Build data rows
  const rows = data.map((row) => {
    return columns
      .map((col) => {
        const rawValue = row[col.key];
        let cellValue: string;

        if (col.formatter) {
          cellValue = col.formatter(rawValue, row);
        } else {
          cellValue = valueToString(rawValue);
        }

        return escapeCSVValue(cellValue);
      })
      .join(',');
  });

  const csvContent = BOM + [header, ...rows].join('\n');

  // Auto-append date to filename
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const fullFileName = `${fileName}_${dateStr}.csv`;

  downloadFile(csvContent, fullFileName, 'text/csv;charset=utf-8;');
}
