import { useRef, useState } from 'react'
import { IoCloudUploadOutline, IoDocumentTextOutline, IoImageOutline, IoGridOutline, IoClose } from 'react-icons/io5'
import './AnalysisFileUpload.css'

const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
// Excel exports: checked by extension (browsers report varied MIME types for .csv).
// The backend converts them to text so the AI can read them.
const SPREADSHEET_EXTENSIONS = ['.xlsx', '.csv']
const ACCEPTED_EXTENSIONS = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.csv'

function isSpreadsheet(file: File): boolean {
    const name = file.name.toLowerCase()
    return SPREADSHEET_EXTENSIONS.some((ext) => name.endsWith(ext))
}
const MAX_FILE_SIZE_MB = 10
const MAX_FILES = 5

interface AnalysisFileUploadProps {
    files: File[]
    onChange: (files: File[]) => void
    disabled?: boolean
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AnalysisFileUpload({ files, onChange, disabled = false }: AnalysisFileUploadProps) {
    const [error, setError] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    const addFiles = (incoming: FileList | File[]) => {
        setError(null)
        const incomingArray = Array.from(incoming)

        for (const file of incomingArray) {
            if (file.name.toLowerCase().endsWith('.xls')) {
                setError(`"${file.name}" uses the old .xls format. Save it as .xlsx and try again.`)
                return
            }
            if (!isSpreadsheet(file) && !ACCEPTED_MIME_TYPES.includes(file.type)) {
                setError(`"${file.name}" is not a supported type. Use PDF, images (JPG, PNG, WEBP, GIF) or Excel (.xlsx, .csv).`)
                return
            }
            if (file.size === 0) {
                setError(`"${file.name}" is empty.`)
                return
            }
            if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                setError(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB}MB limit.`)
                return
            }
        }

        if (files.length + incomingArray.length > MAX_FILES) {
            setError(`You can attach up to ${MAX_FILES} files.`)
            return
        }

        onChange([...files, ...incomingArray])
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            addFiles(e.target.files)
        }
        e.target.value = ''
    }

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        setIsDragging(false)
        if (disabled) return
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files)
        }
    }

    const handleRemove = (index: number) => {
        onChange(files.filter((_, i) => i !== index))
        setError(null)
    }

    return (
        <div className="analysis-file-upload">
            <div
                className={`analysis-file-dropzone ${isDragging ? 'dragging' : ''} ${disabled ? 'disabled' : ''}`}
                onClick={() => !disabled && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_EXTENSIONS}
                    multiple
                    disabled={disabled}
                    onChange={handleInputChange}
                    style={{ display: 'none' }}
                />
                <IoCloudUploadOutline />
                <span>Drag files here or click to select</span>
                <p>PDF, images or Excel (.xlsx, .csv) &middot; max {MAX_FILE_SIZE_MB}MB each &middot; up to {MAX_FILES} files</p>
            </div>

            {error && <p className="analysis-file-error">{error}</p>}

            {files.length > 0 && (
                <ul className="analysis-file-list">
                    {files.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="analysis-file-chip">
                            {isSpreadsheet(file) ? <IoGridOutline /> : file.type === 'application/pdf' ? <IoDocumentTextOutline /> : <IoImageOutline />}
                            <span className="analysis-file-chip-name">{file.name}</span>
                            <span className="analysis-file-chip-size">{formatFileSize(file.size)}</span>
                            {!disabled && (
                                <button
                                    type="button"
                                    className="analysis-file-chip-remove"
                                    onClick={() => handleRemove(index)}
                                    aria-label={`Remove ${file.name}`}
                                >
                                    <IoClose />
                                </button>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default AnalysisFileUpload
