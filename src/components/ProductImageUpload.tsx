import { useState, useRef, useCallback } from 'react'
import { Upload, X, ImageIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

interface ProductImageUploadProps {
    imageFile: File | null
    previewUrl: string | null
    onImageChange: (file: File | null, preview: string | null) => void
}

type CompressionState = 'idle' | 'compressing' | 'done' | 'error'

export default function ProductImageUpload({ imageFile, previewUrl, onImageChange }: ProductImageUploadProps) {
    const fileRef = useRef<HTMLInputElement>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    const [compressionState, setCompressionState] = useState<CompressionState>('idle')
    const [compressionProgress, setCompressionProgress] = useState(0)
    const [originalSize, setOriginalSize] = useState(0)
    const [compressedSize, setCompressedSize] = useState(0)
    const [error, setError] = useState('')

    const compressImage = useCallback(async (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            setCompressionState('compressing')
            setCompressionProgress(10)
            setOriginalSize(file.size)
            setError('')

            const img = new Image()
            const url = URL.createObjectURL(file)

            img.onload = async () => {
                URL.revokeObjectURL(url)
                setCompressionProgress(30)

                // Resize to max 800px width
                const MAX_WIDTH = 800
                let width = img.width
                let height = img.height
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width)
                    width = MAX_WIDTH
                }

                const canvas = document.createElement('canvas')
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext('2d')
                if (!ctx) return reject(new Error('Canvas not supported'))

                ctx.drawImage(img, 0, 0, width, height)
                setCompressionProgress(50)

                // Iterative compression to hit <50KB
                const TARGET_KB = 50
                let quality = 0.8
                let blob: Blob | null = null

                for (let attempt = 0; attempt < 10; attempt++) {
                    setCompressionProgress(50 + attempt * 5)
                    blob = await new Promise<Blob | null>((res) =>
                        canvas.toBlob((b) => res(b), 'image/webp', quality),
                    )
                    if (!blob) break
                    if (blob.size <= TARGET_KB * 1024) break
                    quality -= 0.08
                    if (quality < 0.05) break
                }

                if (!blob || blob.size > TARGET_KB * 1024) {
                    setCompressionState('error')
                    setError(`Could not compress below ${TARGET_KB}KB (got ${blob ? Math.round(blob.size / 1024) : '?'}KB)`)
                    return reject(new Error('Compression failed'))
                }

                setCompressionProgress(100)
                setCompressedSize(blob.size)
                setCompressionState('done')

                const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' })
                resolve(compressedFile)
            }

            img.onerror = () => {
                URL.revokeObjectURL(url)
                setCompressionState('error')
                setError('Invalid image file')
                reject(new Error('Invalid image'))
            }

            img.src = url
        })
    }, [])

    const handleFile = useCallback(
        async (file: File) => {
            if (!file.type.startsWith('image/')) {
                setError('Only image files are accepted')
                return
            }
            if (file.size > 5 * 1024 * 1024) {
                setError('File must be under 5MB before compression')
                return
            }

            try {
                const compressed = await compressImage(file)
                const preview = URL.createObjectURL(compressed)
                onImageChange(compressed, preview)
            } catch {
                onImageChange(null, null)
            }
        },
        [compressImage, onImageChange],
    )

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault()
            setIsDragOver(false)
            const file = e.dataTransfer.files?.[0]
            if (file) handleFile(file)
        },
        [handleFile],
    )

    const handleRemove = () => {
        onImageChange(null, null)
        setCompressionState('idle')
        setCompressionProgress(0)
        setOriginalSize(0)
        setCompressedSize(0)
        setError('')
        if (fileRef.current) fileRef.current.value = ''
    }

    return (
        <div className="space-y-2">
            <label className="text-xs text-muted-foreground uppercase tracking-wider block">
                Product Image <span className="text-muted-foreground/50">(Optional · max 50KB after compression)</span>
            </label>

            {previewUrl ? (
                <div className="relative group">
                    <div className="flex items-start gap-4 bg-secondary/20 rounded-xl p-3">
                        <img
                            src={previewUrl}
                            alt="Product preview"
                            className="w-24 h-24 rounded-lg object-cover border-2 border-gold/20 shrink-0"
                        />
                        <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                <span className="text-sm font-medium text-emerald-400">Compressed</span>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                                <p>Original: {(originalSize / 1024).toFixed(1)} KB</p>
                                <p>Compressed: <span className="text-gold font-medium">{(compressedSize / 1024).toFixed(1)} KB</span></p>
                                <p>Saved: {Math.round((1 - compressedSize / originalSize) * 100)}%</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className="text-xs text-gold hover:underline"
                                >
                                    Replace
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRemove}
                                    className="text-xs text-red-400 hover:underline"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleRemove}
                        className="absolute top-2 right-2 p-1.5 bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <X className="w-3.5 h-3.5 text-white" />
                    </button>
                </div>
            ) : (
                <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => compressionState !== 'compressing' && fileRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragOver ? 'border-gold bg-gold/5 scale-[1.01]' : 'border-border/40 hover:border-gold/30 hover:bg-secondary/10'
                        }`}
                >
                    {compressionState === 'compressing' ? (
                        <div className="space-y-3">
                            <Loader2 className="w-8 h-8 text-gold mx-auto animate-spin" />
                            <p className="text-sm text-muted-foreground">Compressing... {compressionProgress}%</p>
                            <div className="w-48 mx-auto h-1.5 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full gold-gradient rounded-full transition-all duration-300"
                                    style={{ width: `${compressionProgress}%` }}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center mx-auto mb-3">
                                <Upload className="w-6 h-6 text-gold" />
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">
                                Drag & drop image here, or <span className="text-gold">click to browse</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground/50">
                                PNG, JPEG, WebP · Max 5MB · Auto-compressed to &lt;50KB WebP
                            </p>
                        </>
                    )}
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/5 rounded-lg px-3 py-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                </div>
            )}

            <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                className="hidden"
            />
        </div>
    )
}
