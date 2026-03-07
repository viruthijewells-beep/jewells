import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
    ScanBarcode, Package, Search, Loader2, Camera, CameraOff,
    AlertCircle, CheckCircle2, RefreshCcw, MapPin, Building2, ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { scanProduct } from '@/lib/api/products'
import { usePageTitle } from '@/hooks'
import BarcodeDisplay from '@/components/BarcodeDisplay'
import { METAL_BADGE_COLORS } from '@/lib/metalTypes'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'

type BranchStock = {
    inventoryId: string
    branchId: string
    branchName: string
    sku: string
    barcode: string
    stockCount: number
    minStock: number
    sellingPrice: number
    purchasePrice: number
    lastUpdated: string
    isLowStock: boolean
}

type ScannedProduct = {
    id: string
    name: string
    barcode: string
    categoryName: string
    gold_type: string
    metal_type: string
    purity: string
    weight: number
    design_code: string
    image_url: string | null
    branches: BranchStock[]
    totalStock: number
    isLowStock: boolean
} | null

export default function Scan() {
    usePageTitle('Scan Barcode')
    const [barcode, setBarcode] = useState('')
    const [product, setProduct] = useState<ScannedProduct>(null)
    const [isScanning, setIsScanning] = useState(false)
    const [notFound, setNotFound] = useState(false)
    const [lastScanned, setLastScanned] = useState('')

    // ─── ZXing-based scanner with video ref ───────────────────────────────────
    const videoRef = useRef<HTMLVideoElement>(null)

    const handleScanResult = (decodedText: string) => {
        // Debounce: ignore repeated identical scans within 2s
        if (decodedText === lastScanned) return
        setLastScanned(decodedText)
        setTimeout(() => setLastScanned(''), 2000)

        setBarcode(decodedText)
        lookupBarcode(decodedText)
        toast.success(`Barcode detected: ${decodedText}`)
    }

    const scanner = useBarcodeScanner(videoRef, handleScanResult)

    // ─── Barcode Lookup ───────────────────────────────────────────────────────
    const lookupBarcode = async (code: string) => {
        if (!code.trim()) return
        setIsScanning(true)
        setNotFound(false)
        setProduct(null)

        try {
            const data = await scanProduct(code.trim())
            if (data) {
                setProduct(data as ScannedProduct)
                toast.success('Product found!')
            } else {
                setNotFound(true)
                toast.error('Product not found for this barcode')
            }
        } catch (err: any) {
            toast.error(err.message || 'Scan failed')
            setNotFound(true)
        } finally {
            setIsScanning(false)
        }
    }

    const handleManualScan = () => lookupBarcode(barcode)

    const handleScanAnother = () => {
        setProduct(null)
        setBarcode('')
        setNotFound(false)
        setLastScanned('')
        scanner.start()
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center">
                <div className="w-20 h-20 gold-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-gold/20">
                    <ScanBarcode className="text-black w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold heading-luxury">Barcode Scanner</h2>
                <p className="text-muted-foreground text-sm mt-2">
                    Scan with camera or enter barcode manually · Multi-branch stock
                </p>
            </div>

            {/* Camera Section */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Camera className="w-4 h-4 text-gold" /> Camera Scanner
                    </h3>
                    <div className="flex items-center gap-3">
                        {/* Camera switcher — only when multiple cameras available */}
                        {scanner.cameras.length > 1 && scanner.isActive && (
                            <div className="relative">
                                <select
                                    value={scanner.activeCameraId ?? ''}
                                    onChange={(e) => scanner.switchCamera(e.target.value)}
                                    className="appearance-none bg-secondary/50 border border-border rounded-lg px-3 py-1.5 pr-7 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-gold/30"
                                >
                                    {scanner.cameras.map(cam => (
                                        <option key={cam.deviceId} value={cam.deviceId}>
                                            {cam.isRear ? '📷 Rear: ' : cam.isFront ? '🤳 Front: ' : '📸 '}{cam.label}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                            </div>
                        )}

                        {scanner.isActive ? (
                            <button onClick={scanner.stop} className="text-xs text-red-400 flex items-center gap-1 hover:text-red-300">
                                <CameraOff className="w-3 h-3" /> Stop Camera
                            </button>
                        ) : (
                            <button
                                onClick={scanner.start}
                                disabled={scanner.isStarting}
                                className="text-xs text-gold flex items-center gap-1 hover:text-gold/80 disabled:opacity-50"
                            >
                                {scanner.isStarting
                                    ? <Loader2 className="w-3 h-3 animate-spin" />
                                    : <Camera className="w-3 h-3" />
                                }
                                {scanner.isStarting ? 'Starting...' : 'Start Camera'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Camera count badge */}
                {scanner.cameras.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/60">
                        {scanner.cameras.length} camera{scanner.cameras.length > 1 ? 's' : ''} detected
                        {scanner.activeCameraId && (() => {
                            const active = scanner.cameras.find(c => c.deviceId === scanner.activeCameraId)
                            return active ? ` · Using: ${active.label}` : ''
                        })()}
                    </p>
                )}

                {/* Error */}
                {scanner.error && (
                    <div className="flex items-start gap-2 text-red-400 bg-red-400/5 border border-red-400/10 rounded-xl px-4 py-3 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            <span>{scanner.error}</span>
                            <button onClick={scanner.start} className="block mt-1 text-xs text-gold hover:underline">
                                Try again
                            </button>
                        </div>
                    </div>
                )}

                {/* ─── Video viewport — ZXing renders into this <video> ─────────── */}
                <AnimatePresence>
                    {(scanner.isActive || scanner.isStarting) && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="relative overflow-hidden rounded-xl bg-black"
                        >
                            {/* The actual video stream */}
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline    /* critical for iOS Safari */
                                className="w-full max-h-[350px] object-cover"
                                style={{ display: 'block' }}
                            />

                            {/* Scanning guide overlay */}
                            {scanner.isActive && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    {/* Dark vignette */}
                                    <div className="absolute inset-0 bg-black/30" />
                                    {/* Scan box */}
                                    <div
                                        className="relative z-10 border-2 border-gold/80 rounded-lg"
                                        style={{ width: '75%', maxWidth: 320, height: 140 }}
                                    >
                                        {/* Corner accents */}
                                        <span className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-2 border-l-2 border-gold rounded-tl-lg" />
                                        <span className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-2 border-r-2 border-gold rounded-tr-lg" />
                                        <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-2 border-l-2 border-gold rounded-bl-lg" />
                                        <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-2 border-r-2 border-gold rounded-br-lg" />
                                        {/* Animated scan line */}
                                        <motion.div
                                            className="absolute left-2 right-2 h-[1px] bg-gold/70"
                                            animate={{ top: ['15%', '85%', '15%'] }}
                                            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                                        />
                                    </div>
                                    {/* Label */}
                                    <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] tracking-[0.2em] uppercase text-white/60 z-10">
                                        Align barcode within frame
                                    </p>
                                </div>
                            )}

                            {/* Starting spinner */}
                            {scanner.isStarting && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-gold" />
                                    <p className="text-xs text-white/60 tracking-wider uppercase">Opening camera…</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Idle start prompt */}
                {!scanner.isActive && !scanner.isStarting && !scanner.error && (
                    <button
                        onClick={scanner.start}
                        className="w-full py-8 border-2 border-dashed border-border/50 rounded-xl flex flex-col items-center gap-3 hover:border-gold/30 hover:bg-gold/5 transition-all group"
                    >
                        <Camera className="w-10 h-10 text-muted-foreground group-hover:text-gold transition-colors" />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            Tap to open camera and scan barcode
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                            Uses rear camera on mobile · Works on all browsers
                        </span>
                    </button>
                )}
            </div>

            {/* Manual Entry */}
            <div className="glass-card rounded-2xl p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                    <Search className="w-4 h-4 text-gold" /> Manual Barcode Entry
                </h3>
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            value={barcode}
                            onChange={(e) => setBarcode(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleManualScan()}
                            placeholder="Enter barcode number..."
                            className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                            autoFocus
                        />
                    </div>
                    <button
                        onClick={handleManualScan}
                        disabled={isScanning || !barcode.trim()}
                        className="gold-gradient text-black px-6 py-3 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50"
                    >
                        {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanBarcode className="w-4 h-4" />}
                        Lookup
                    </button>
                </div>
            </div>

            {/* Not Found */}
            <AnimatePresence>
                {notFound && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="glass-card rounded-2xl p-8 text-center"
                    >
                        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                        <h3 className="text-lg font-semibold mb-1">Product Not Found</h3>
                        <p className="text-sm text-muted-foreground">
                            No product matches barcode: <strong className="text-gold">{barcode}</strong>
                        </p>
                        <button
                            onClick={handleScanAnother}
                            className="mt-4 text-sm text-gold flex items-center gap-2 mx-auto hover:underline"
                        >
                            <RefreshCcw className="w-4 h-4" /> Try Again
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Product Result */}
            <AnimatePresence>
                {product && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        {/* Product Info Card */}
                        <div className="glass-card rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                                <h3 className="text-lg font-semibold heading-luxury">Product Found</h3>
                            </div>
                            <div className="flex flex-col sm:flex-row items-start gap-4">
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-16 h-16 rounded-xl object-cover border-2 border-gold/20 shrink-0" />
                                ) : (
                                    <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center shrink-0">
                                        <Package className="w-8 h-8 text-gold" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0 space-y-3 w-full">
                                    <h3 className="text-xl font-bold heading-luxury break-words">{product.name}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Barcode</p>
                                            <p className="font-mono font-medium text-gold text-xs break-all mt-0.5">{product.barcode}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Category</p>
                                            <p className="font-medium mt-0.5">{product.categoryName}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Metal</p>
                                            <span className={`font-medium px-2 py-0.5 rounded text-xs border inline-block mt-0.5 ${METAL_BADGE_COLORS[(product.metal_type as keyof typeof METAL_BADGE_COLORS)] || METAL_BADGE_COLORS.Gold}`}>
                                                {product.metal_type ?? 'Gold'} · {product.purity ?? product.gold_type ?? '22K'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Weight</p>
                                            <p className="font-medium mt-0.5">{product.weight}g</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Design</p>
                                            <p className="font-medium text-gold mt-0.5">{product.design_code}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Total Stock */}
                        <div className={`glass-card rounded-2xl p-5 ${product.isLowStock ? 'border border-red-500/20' : 'border border-emerald-500/20'}`}>
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <Building2 className="w-5 h-5 text-gold shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold">Total Stock</p>
                                        <p className="text-xs text-muted-foreground">{product.branches.length} branch{product.branches.length !== 1 ? 'es' : ''}</p>
                                    </div>
                                </div>
                                <span className={`text-3xl font-bold shrink-0 ${product.isLowStock ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {product.totalStock}
                                </span>
                            </div>
                        </div>

                        {/* Per-Branch Stock */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 px-1">
                                <MapPin className="w-3.5 h-3.5 text-gold" /> Stock Per Branch
                            </h4>
                            {product.branches.map((branch, idx) => (
                                <motion.div
                                    key={branch.branchId}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className={`glass-card rounded-xl p-4 ${branch.isLowStock ? 'border border-red-500/15' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-start gap-2.5 min-w-0">
                                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${branch.isLowStock ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate">{branch.branchName}</p>
                                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                                    SKU: {branch.sku}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    ₹{Number(branch.sellingPrice).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className={`text-xl font-bold ${branch.isLowStock ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {branch.stockCount}
                                            </span>
                                            {branch.isLowStock && (
                                                <p className="text-[9px] text-red-400 flex items-center gap-1 justify-end">
                                                    <AlertCircle className="w-2.5 h-2.5" /> min: {branch.minStock}
                                                </p>
                                            )}
                                            {branch.lastUpdated && (
                                                <p className="text-[9px] text-muted-foreground/50">
                                                    {new Date(branch.lastUpdated).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>

                        {/* Barcode Image */}
                        {product.barcode && (
                            <div className="glass-card rounded-2xl p-5">
                                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Product Barcode</p>
                                <BarcodeDisplay barcode={product.barcode} productName={product.name} showDownload compact />
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleScanAnother}
                                className="flex-1 border border-border px-4 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 hover:bg-secondary transition-all"
                            >
                                <RefreshCcw className="w-4 h-4" /> Scan Another
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
