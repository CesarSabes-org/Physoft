// ============================================
// UTILS: Report PDF export
// ============================================
// Renders the printable report (.report-doc) to an image and lays it out
// on A4 pages, cutting only between blocks (cards, rows, list items) so
// nothing is split across two pages. Downloads the file directly — no
// print dialog. Libraries are loaded on demand to keep the app bundle small.
// ============================================

/** Blocks that must never be split across two pages. */
const UNBREAKABLE_SELECTORS = [
    '.report-doc-header',
    '.report-patient',
    '.executive-summary-coverage',
    '.executive-summary-list li',
    '.capacity-card',
    '.chart-card',
    '.chart-card-subsection',
    '.detailed-analysis-column',
    '.report-doc-ai-item',
    '.rom-table tr',
    '.report-doc-footer'
].join(',')

/** Cut this far above a block so no sliver of its border shows at the bottom of the page. */
const CUT_CLEARANCE_PX = 6

/** A leftover this short at the end is only the document's bottom padding: no page for it. */
const MIN_LAST_PAGE_PX = 40

/** A section title keeps at least this much of its content on the same page. */
const HEADING_KEEP_WITH_NEXT_PX = 140

const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const MARGIN_TOP_MM = 10
const MARGIN_BOTTOM_MM = 14
const FOOTER_BASELINE_MM = 290
const SIDE_MARGIN_MM = 11
const PIXEL_RATIO = 2
/**
 * Root font size while capturing. The report is sized in rem and the app
 * shrinks the root font on phones, so a fixed value keeps the PDF identical
 * on any device.
 */
const EXPORT_ROOT_FONT_SIZE = '14px'

/** 1×1 transparent PNG used when an external image (e.g. patient photo) can't be fetched. */
const TRANSPARENT_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const waitForLayout = (ms: number) =>
    new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, ms))))

/** Page cut positions (CSS px from the top of the document), avoiding the middle of any block. */
function computePageCuts(doc: HTMLElement, totalHeight: number, pageHeight: number): [number, number][] {
    const docTop = doc.getBoundingClientRect().top
    const blocks: [number, number][] = Array.from(doc.querySelectorAll(UNBREAKABLE_SELECTORS)).map((el) => {
        const rect = el.getBoundingClientRect()
        return [rect.top - docTop, rect.bottom - docTop]
    })
    doc.querySelectorAll('.analysis-section > h2').forEach((heading) => {
        const rect = heading.getBoundingClientRect()
        blocks.push([rect.top - docTop, rect.bottom - docTop + HEADING_KEEP_WITH_NEXT_PX])
    })

    const pages: [number, number][] = []
    let start = 0
    while (totalHeight - start > (pages.length > 0 ? MIN_LAST_PAGE_PX : 1)) {
        let cut = Math.min(start + pageHeight, totalHeight)
        if (cut < totalHeight) {
            // Move the cut up to the top of any block it would split
            let moved = true
            while (moved) {
                moved = false
                for (const [top, bottom] of blocks) {
                    const safeTop = top - CUT_CLEARANCE_PX
                    if (safeTop < cut && bottom > cut && safeTop > start + 1) {
                        cut = safeTop
                        moved = true
                    }
                }
            }
            // A block taller than a page can't be kept whole
            if (cut <= start + 1) cut = Math.min(start + pageHeight, totalHeight)
        }
        pages.push([start, cut])
        start = cut
    }
    return pages
}

/**
 * Generates and downloads the PDF of a rendered `.report-doc` element.
 * The element gets the `is-exporting` class while it's captured, which
 * forces the fixed A4 layout regardless of the screen size.
 */
export async function exportReportPdf(doc: HTMLElement, fileName: string, footerText: string): Promise<void> {
    const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])

    const root = document.documentElement
    const previousRootFontSize = root.style.fontSize
    root.style.fontSize = EXPORT_ROOT_FONT_SIZE
    doc.classList.add('is-exporting')
    try {
        // Let charts re-measure at the A4 width before capturing
        await waitForLayout(400)

        const cssWidth = doc.offsetWidth
        const cssHeight = doc.offsetHeight
        const mmPerPx = PAGE_WIDTH_MM / cssWidth
        const pageHeightPx = (PAGE_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM) / mmPerPx
        const pages = computePageCuts(doc, cssHeight, pageHeightPx)

        const canvas = await toCanvas(doc, {
            pixelRatio: PIXEL_RATIO,
            backgroundColor: '#ffffff',
            skipFonts: true,
            cacheBust: true,
            imagePlaceholder: TRANSPARENT_PIXEL,
            style: { margin: '0', borderRadius: '0', boxShadow: 'none' }
        })

        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
        pdf.setProperties({ title: fileName, creator: 'Physoft DataSoftware' })

        const scale = canvas.width / cssWidth
        pages.forEach(([start, end], index) => {
            const slice = document.createElement('canvas')
            slice.width = canvas.width
            slice.height = Math.max(1, Math.round((end - start) * scale))
            const ctx = slice.getContext('2d')
            if (!ctx) throw new Error('Canvas not available')
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, slice.width, slice.height)
            ctx.drawImage(canvas, 0, Math.round(start * scale), canvas.width, slice.height, 0, 0, slice.width, slice.height)

            if (index > 0) pdf.addPage()
            pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, MARGIN_TOP_MM, PAGE_WIDTH_MM, (end - start) * mmPerPx)

            pdf.setFontSize(8)
            pdf.setTextColor(100, 116, 139)
            pdf.text(footerText, SIDE_MARGIN_MM, FOOTER_BASELINE_MM)
            pdf.text(`Page ${index + 1} of ${pages.length}`, PAGE_WIDTH_MM - SIDE_MARGIN_MM, FOOTER_BASELINE_MM, { align: 'right' })
        })

        pdf.save(`${fileName}.pdf`)
    } finally {
        doc.classList.remove('is-exporting')
        root.style.fontSize = previousRootFontSize
    }
}
