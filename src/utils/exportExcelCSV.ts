import * as XLSX from 'xlsx'

/**
 * Export data as a real Excel (.xlsx) file using SheetJS.
 * Produces a proper spreadsheet with auto-sized columns.
 */
export function exportToExcelCSV(
    rows: Record<string, unknown>[],
    filename: string,
) {
    if (!rows.length) return

    // Create worksheet from JSON data
    const ws = XLSX.utils.json_to_sheet(rows)

    // Auto-size columns based on content width
    const headers = Object.keys(rows[0])
    ws['!cols'] = headers.map(key => {
        const maxLen = Math.max(
            key.length,
            ...rows.map(row => String(row[key] ?? '').length)
        )
        return { wch: Math.min(maxLen + 2, 40) }
    })

    // Create workbook and append the sheet
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Report')

    // Generate and download .xlsx file
    XLSX.writeFile(wb, `${filename}.xlsx`)
}
