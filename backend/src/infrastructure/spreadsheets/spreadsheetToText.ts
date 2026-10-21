// ============================================
// INFRASTRUCTURE: Spreadsheet -> text
// ============================================
// Claude reads PDFs and images but not Excel files. Device exports in
// .xlsx / .csv are converted here into tab-separated text, one block per
// sheet, so the AI autocomplete can read them like any other report.
// Size limits keep a large export from flooding the AI request.
// ============================================

import ExcelJS from 'exceljs'

export const SPREADSHEET_EXTENSIONS = ['.xlsx', '.csv'] as const

const MAX_ROWS_PER_SHEET = 500
const MAX_COLUMNS = 60
const MAX_TOTAL_CHARS = 120_000

export interface SpreadsheetText {
    filename: string
    text: string
    /** True when rows, columns or characters were cut to the limits above */
    truncated: boolean
}

export class SpreadsheetReadError extends Error {}

export function isSpreadsheetFilename(filename: string): boolean {
    const lower = filename.toLowerCase()
    return SPREADSHEET_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function clean(text: string): string {
    // Tabs and line breaks inside a cell would break the table layout
    return text.replace(/[\t\r\n]+/g, ' ').trim()
}

function cellText(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) return ''
    if (value instanceof Date) {
        const iso = value.toISOString()
        return iso.endsWith('T00:00:00.000Z') ? iso.slice(0, 10) : iso.slice(0, 16).replace('T', ' ')
    }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (typeof value === 'string') return clean(value)
    if (typeof value === 'object') {
        if ('result' in value) return cellText((value as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue) // formula: its computed value
        if ('richText' in value) return clean((value as ExcelJS.CellRichTextValue).richText.map((part) => part.text).join(''))
        if ('text' in value) return clean(String((value as ExcelJS.CellHyperlinkValue).text))
        if ('error' in value) return String((value as ExcelJS.CellErrorValue).error)
    }
    return ''
}

function capTotal(text: string): { text: string; truncated: boolean } {
    if (text.length <= MAX_TOTAL_CHARS) return { text, truncated: false }
    return { text: `${text.slice(0, MAX_TOTAL_CHARS)}\n[... truncated]`, truncated: true }
}

function csvToText(buffer: Buffer): { text: string; truncated: boolean } {
    const lines = buffer.toString('utf8').replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim() !== '')
    const truncatedRows = lines.length > MAX_ROWS_PER_SHEET
    const capped = capTotal(lines.slice(0, MAX_ROWS_PER_SHEET).join('\n'))
    return { text: capped.text, truncated: truncatedRows || capped.truncated }
}

async function xlsxToText(buffer: Buffer): Promise<{ text: string; truncated: boolean }> {
    const workbook = new ExcelJS.Workbook()
    try {
        await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    } catch {
        throw new SpreadsheetReadError('is not a readable .xlsx file')
    }

    let truncated = false
    const sheets: string[] = []
    workbook.eachSheet((sheet) => {
        const rows: string[] = []
        const columnCount = Math.min(sheet.actualColumnCount || sheet.columnCount, MAX_COLUMNS)
        if ((sheet.actualColumnCount || 0) > MAX_COLUMNS) truncated = true

        sheet.eachRow({ includeEmpty: false }, (row) => {
            if (rows.length >= MAX_ROWS_PER_SHEET) {
                truncated = true
                return
            }
            const cells = Array.from({ length: columnCount }, (_, i) => cellText(row.getCell(i + 1).value))
            if (cells.some((cell) => cell !== '')) rows.push(cells.join('\t').replace(/\t+$/, ''))
        })

        if (rows.length > 0) sheets.push(`### Sheet: ${sheet.name}\n${rows.join('\n')}`)
    })

    if (sheets.length === 0) throw new SpreadsheetReadError('has no data')
    const capped = capTotal(sheets.join('\n\n'))
    return { text: capped.text, truncated: truncated || capped.truncated }
}

/** Converts an .xlsx or .csv file into tab-separated text (one block per sheet). */
export async function spreadsheetToText(buffer: Buffer, filename: string): Promise<SpreadsheetText> {
    const result = filename.toLowerCase().endsWith('.csv') ? csvToText(buffer) : await xlsxToText(buffer)
    if (result.text.trim() === '') throw new SpreadsheetReadError('has no data')
    return { filename, ...result }
}
