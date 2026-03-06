import { useRef, useEffect, useCallback } from 'react'
import JsBarcode from 'jsbarcode'
import { Download, FileImage, FileText } from 'lucide-react'

interface BarcodeDisplayProps {
    barcode: string
    productName?: string
    showDownload?: boolean
    compact?: boolean
}

export default function BarcodeDisplay({ barcode, productName, showDownload = true, compact = false }: BarcodeDisplayProps) {
    const svgRef = useRef<SVGSVGElement>(null)

    useEffect(() => {
        if (svgRef.current && barcode) {
            try {
                JsBarcode(svgRef.current, barcode, {
                    format: 'EAN13',
                    width: compact ? 1.5 : 2,
                    height: compact ? 40 : 60,
                    displayValue: true,
                    fontSize: compact ? 12 : 14,
                    background: 'transparent',
                    lineColor: '#D4AF37',
                    margin: 8,
                    font: 'monospace',
                    textMargin: 4,
                })
            } catch {
                // Invalid barcode format — show as text
                if (svgRef.current) {
                    svgRef.current.innerHTML = ''
                }
            }
        }
    }, [barcode, compact])

    const downloadPNG = useCallback(() => {
        if (!svgRef.current) return
        const svg = svgRef.current
        const canvas = document.createElement('canvas')
        const bbox = svg.getBBox()
        canvas.width = (bbox.width + 20) * 2
        canvas.height = (bbox.height + 20) * 2
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const svgData = new XMLSerializer().serializeToString(svg)
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(svgBlob)

        const img = new Image()
        img.onload = () => {
            ctx.drawImage(img, 10, 10, canvas.width - 20, canvas.height - 20)
            URL.revokeObjectURL(url)

            const link = document.createElement('a')
            link.download = `barcode_${barcode}${productName ? `_${productName.replace(/\s+/g, '_')}` : ''}.png`
            link.href = canvas.toDataURL('image/png')
            link.click()
        }
        img.src = url
    }, [barcode, productName])

    const downloadSVG = useCallback(() => {
        if (!svgRef.current) return
        const svgData = new XMLSerializer().serializeToString(svgRef.current)
        const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = `barcode_${barcode}.svg`
        link.href = url
        link.click()
        URL.revokeObjectURL(url)
    }, [barcode])

    if (!barcode || barcode.length < 13) return null

    return (
        <div className={`${compact ? '' : 'space-y-3'}`}>
            <div className="bg-white rounded-xl p-3 flex items-center justify-center">
                <svg ref={svgRef} />
            </div>
            {showDownload && (
                <div className="flex gap-2">
                    <button
                        onClick={downloadPNG}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 border border-border rounded-lg hover:bg-secondary transition-all"
                    >
                        <FileImage className="w-3.5 h-3.5 text-gold" /> PNG
                    </button>
                    <button
                        onClick={downloadSVG}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 border border-border rounded-lg hover:bg-secondary transition-all"
                    >
                        <FileText className="w-3.5 h-3.5 text-gold" /> SVG
                    </button>
                </div>
            )}
        </div>
    )
}
