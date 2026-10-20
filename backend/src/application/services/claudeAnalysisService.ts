import Anthropic from '@anthropic-ai/sdk'
import {
    EXTRACTION_ENUM_FIELDS,
    EXTRACTION_NUMBER_FIELDS,
    EXTRACTION_SOURCE_SECTIONS,
    EXTRACTION_SYSTEM_PROMPT,
    EXTRACTION_TOOL_NAME,
    buildExtractionTool
} from './claude/prompts/extraction/clinicalResults'

interface ImageFile {
    buffer: Buffer
    mimeType: string
}

interface PdfFile {
    buffer: Buffer
    filename: string
}

interface ExtractClinicalResultsInput {
    imageFiles: ImageFile[]
    pdfFiles: PdfFile[]
}

export interface ExtractedMuscle {
    muscle: string
    predominance: 'RIGHT' | 'LEFT' | 'BALANCED' | null
    rightValue: number | null
    leftValue: number | null
    unit: string | null
}

export interface ExtractClinicalResultsResult {
    /** Flat dotted path -> value, only for fields explicitly found in the documents */
    values: Record<string, number | string>
    sources: Record<string, string>
    muscles: ExtractedMuscle[]
    warnings: string[]
    tokensUsed: number
}

const NUMBER_FIELD_PATHS = new Set(EXTRACTION_NUMBER_FIELDS.map((f) => f.path))
const ENUM_FIELDS = new Map(EXTRACTION_ENUM_FIELDS.map((f) => [f.path, f.values]))
const PREDOMINANCE = ['RIGHT', 'LEFT', 'BALANCED']

function finiteNonNegative(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function shortString(value: unknown, maxLength: number): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed.slice(0, maxLength) : null
}

/**
 * Keeps only whitelisted fields with valid values from the model's tool
 * call, so a malformed or over-eager response can never write anything the
 * form doesn't expect.
 */
function sanitizeExtraction(raw: Record<string, unknown>): Omit<ExtractClinicalResultsResult, 'tokensUsed'> {
    const values: Record<string, number | string> = {}

    for (const [path, value] of Object.entries(raw)) {
        if (NUMBER_FIELD_PATHS.has(path)) {
            const parsed = finiteNonNegative(value)
            if (parsed !== null) values[path] = parsed
        } else if (ENUM_FIELDS.has(path)) {
            if (typeof value === 'string' && ENUM_FIELDS.get(path)!.includes(value)) values[path] = value
        }
    }

    const sources: Record<string, string> = {}
    if (raw.sources && typeof raw.sources === 'object' && !Array.isArray(raw.sources)) {
        for (const key of EXTRACTION_SOURCE_SECTIONS) {
            const source = shortString((raw.sources as Record<string, unknown>)[key], 200)
            if (source) sources[key] = source
        }
    }

    const muscles: ExtractedMuscle[] = Array.isArray(raw.muscles)
        ? raw.muscles.slice(0, 30).flatMap((entry): ExtractedMuscle[] => {
            if (!entry || typeof entry !== 'object') return []
            const m = entry as Record<string, unknown>
            const muscle = shortString(m.muscle, 200)
            if (!muscle) return []
            return [{
                muscle,
                predominance: typeof m.predominance === 'string' && PREDOMINANCE.includes(m.predominance)
                    ? m.predominance as ExtractedMuscle['predominance']
                    : null,
                rightValue: finiteNonNegative(m.rightValue),
                leftValue: finiteNonNegative(m.leftValue),
                unit: shortString(m.unit, 40)
            }]
        })
        : []

    const warnings = Array.isArray(raw.warnings)
        ? raw.warnings.flatMap((w) => {
            const warning = shortString(w, 500)
            return warning ? [warning] : []
        }).slice(0, 20)
        : []

    return { values, sources, muscles, warnings }
}

class ClaudeAnalysisService {
    private client: Anthropic
    private modelName: string

    constructor() {
        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            throw new Error('ANTHROPIC_API_KEY is not configured in the environment variables')
        }

        this.modelName = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'
        this.client = new Anthropic({ apiKey })
        console.log(`[Claude] Service initialized (${this.modelName})`)
    }

    /**
     * Transcribes explicitly printed values from device reports into the
     * clinical results form fields. Forced tool call + server-side whitelist,
     * so the response can only contain known fields with valid values.
     */
    async extractClinicalResults(input: ExtractClinicalResultsInput): Promise<ExtractClinicalResultsResult> {
        const content = this.buildFileBlocks(input.pdfFiles, input.imageFiles)
        content.push({
            type: 'text',
            text: 'Transcribe the values explicitly printed in the attached report(s). Omit every field that is not printed.'
        })

        console.log(`[Claude] Extracting clinical results — ${input.imageFiles.length} image(s), ${input.pdfFiles.length} PDF(s)`)

        try {
            const tool = buildExtractionTool()
            const response = await this.client.messages.create({
                model: this.modelName,
                max_tokens: 4096,
                system: EXTRACTION_SYSTEM_PROMPT,
                tools: [tool as Anthropic.Tool],
                tool_choice: { type: 'tool', name: EXTRACTION_TOOL_NAME },
                messages: [{ role: 'user', content }]
            })

            if (response.stop_reason === 'refusal') {
                throw new Error('The AI declined to read the provided files.')
            }

            const toolUse = response.content.find(
                (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use' && block.name === EXTRACTION_TOOL_NAME
            )
            if (!toolUse || !toolUse.input || typeof toolUse.input !== 'object') {
                throw new Error('The AI did not return any structured values. Please try again.')
            }

            const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
            return { ...sanitizeExtraction(toolUse.input as Record<string, unknown>), tokensUsed }
        } catch (error: any) {
            console.error('[Claude] Error extracting clinical results:', error)
            throw this.toFriendlyError(error)
        }
    }

    private toFriendlyError(error: any): Error {
        if (error instanceof Anthropic.APIError) {
            if (error.status === 401) {
                return new Error('Invalid Anthropic API key. Please check ANTHROPIC_API_KEY in the server configuration.')
            }
            if (error.status === 429) {
                return new Error('Anthropic API rate limit reached. Please try again in a moment.')
            }
            if (error.status === 413 || error.message?.includes('too large')) {
                return new Error('The attached files are too large for the AI request. Please reduce file size or count.')
            }
            return new Error(`AI analysis failed: ${error.message}`)
        }
        return error instanceof Error ? error : new Error('AI analysis failed')
    }

    private buildFileBlocks(pdfFiles: PdfFile[], imageFiles: ImageFile[]): Anthropic.ContentBlockParam[] {
        const blocks: Anthropic.ContentBlockParam[] = []

        for (const pdf of pdfFiles) {
            blocks.push({
                type: 'document',
                source: {
                    type: 'base64',
                    media_type: 'application/pdf',
                    data: pdf.buffer.toString('base64')
                }
            } as Anthropic.DocumentBlockParam)
        }

        for (const image of imageFiles) {
            blocks.push({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: image.mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
                    data: image.buffer.toString('base64')
                }
            } as Anthropic.ImageBlockParam)
        }

        return blocks
    }

}

export default new ClaudeAnalysisService()
