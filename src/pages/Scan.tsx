import { useState } from 'react'
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

    // ─── Universal Camera Scanner ─────────────────────────────────
    const scanner = useBarcodeScanner('qr-reader', (decodedText) => {
        setBarcode(decodedText)
        lookupBarcode(decodedText)
    }, {
        fps: 15,
        qrboxWidth: 280,
        qrboxHeight: 150,
    })

    // ─── Barcode Lookup ───────────────────────────────────────────
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

    const handleManualScan = () => {
        lookupBarcode(barcode)
    }

    const handleScanAnother = () => {
        setProduct(null)
        setBarcode('')
        setNotFound(false)
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
                <p className="text-muted-foreground text-sm mt-2">Scan with camera or enter barcode manually · Multi-branch stock</p>
            </div>

            {/* Camera Section */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Camera className="w-4 h-4 text-gold" /> Camera Scanner
                    </h3>
                    <div className="flex items-center gap-3">
                        {/* Camera selector dropdown */}
                        {scanner.cameras.length > 1 && scanner.isActive && (
                            <div className="relative">
                                <select
                                    value={scanner.activeCameraId ?? ''}
                                    onChange={(e) => scanner.switchCamera(e.target.value)}
                                    className="appearance-none bg-secondary/50 border border-border rounded-lg px-3 py-1.5 pr-7 text-xs text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-gold/30"
                                >
                                    {scanner.cameras.map(cam => (
                                        <option key={cam.deviceId} value={cam.deviceId}>
                                            {cam.label}
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
                        {scanner.activeCameraId && scanner.cameras.find(c => c.deviceId === scanner.activeCameraId)
                            ? ` · Using: ${scanner.cameras.find(c => c.deviceId === scanner.activeCameraId)?.label}`
                            : ''}
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

                {/* Scanner viewport */}
                <div
                    id="qr-reader"
                    className={`rounded-xl overflow-hidden bg-black/50 ${scanner.isActive ? 'min-h-[300px]' : 'min-h-0'}`}
                    style={{ display: scanner.isActive || scanner.isStarting ? 'block' : 'none' }}
                />

                {/* Idle start button */}
                {!scanner.isActive && !scanner.isStarting && !scanner.error && (
                    <button
                        onClick={scanner.start}
                        className="w-full py-8 border-2 border-dashed border-border/50 rounded-xl flex flex-col items-center gap-3 hover:border-gold/30 hover:bg-gold/5 transition-all group"
                    >
                        <Camera className="w-10 h-10 text-muted-foreground group-hover:text-gold transition-colors" />
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                            Click to open camera and scan barcode
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">
                            Works with mobile rear camera, laptop webcam, or external camera
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

            {/* Product Result — Multi-Branch */}
            <AnimatePresence>
                {product && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                    >
                        {/* Product Info Card */}
                        <div className="glass-card rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-5">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                <h3 className="text-lg font-semibold heading-luxury">Product Found</h3>
                            </div>

                            <div className="flex items-start gap-5">
                                {product.image_url ? (
                                    <img src={product.image_url} alt={product.name} className="w-20 h-20 rounded-xl object-cover border-2 border-gold/20 shrink-0" />
                                ) : (
                                    <div className="w-20 h-20 bg-secondary rounded-xl flex items-center justify-center shrink-0">
                                        <Package className="w-10 h-10 text-gold" />
                                    </div>
                                )}
                                <div className="flex-1 space-y-3">
                                    <h3 className="text-xl font-bold heading-luxury">{product.name}</h3>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Barcode</span>
                                            <span className="font-mono font-medium text-gold">{product.barcode}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Category</span>
                                            <span className="font-medium">{product.categoryName}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Metal</span>
                                            <span className={`font-medium px-2 py-0.5 rounded text-xs border ${METAL_BADGE_COLORS[(product.metal_type as keyof typeof METAL_BADGE_COLORS)] || METAL_BADGE_COLORS.Gold}`}>
                                                {product.metal_type ?? 'Gold'} · {product.purity ?? product.gold_type ?? '22K'}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Weight</span>
                                            <span className="font-medium">{product.weight}g</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Design</span>
                                            <span className="font-medium text-gold">{product.design_code}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Total Stock Bar */}
                        <div className={`glass-card rounded-2xl p-5 ${product.isLowStock ? 'border border-red-500/20' : 'border border-emerald-500/20'}`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Building2 className="w-5 h-5 text-gold" />
                                    <div>
                                        <p className="text-sm font-semibold">Total Stock Across All Branches</p>
                                        <p className="text-xs text-muted-foreground">{product.branches.length} branch{product.branches.length !== 1 ? 'es' : ''}</p>
                                    </div>
                                </div>
                                <span className={`text-3xl font-bold ${product.isLowStock ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {product.totalStock}
                                </span>
                            </div>
                        </div>

                        {/* Per-Branch Stock Cards */}
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
                                    className={`glass-card rounded-xl p-4 flex items-center justify-between ${branch.isLowStock ? 'border border-red-500/15' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${branch.isLowStock ? 'bg-red-400' : 'bg-emerald-400'}`} />
                                        <div>
                                            <p className="text-sm font-semibold">{branch.branchName}</p>
                                            <p className="text-[10px] text-muted-foreground">
                                                SKU: {branch.sku} · ₹{Number(branch.sellingPrice).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
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
                                </motion.div>
                            ))}
                        </div>

                        {/* Barcode Image + Download */}
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
