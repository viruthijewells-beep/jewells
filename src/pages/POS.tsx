import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
    ScanBarcode, ShoppingCart, CreditCard, Loader2, Plus, Minus,
    Trash2, Banknote, Smartphone, X, CheckCircle2, Package,
    Receipt, Clock, AlertCircle, Monitor, Printer,
} from 'lucide-react'
import POSInvoice from '@/components/POSInvoice'
import type { InvoiceData } from '@/components/POSInvoice'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import { useBranches, usePageTitle } from '@/hooks'
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner'
import { METAL_BADGE_COLORS } from '@/lib/metalTypes'
import {
    getOrCreateSession,
    posLookupProduct,
    processCheckout,
    closeSession,
    fetchSessionSales,
} from '@/lib/api/pos'
import type { CartItem } from '@/lib/api/pos'

type POSState = 'idle' | 'active' | 'checkout' | 'success'

export default function POS() {
    usePageTitle('POS Mode');
    const { profile } = useAuth()
    const queryClient = useQueryClient()
    const { data: allBranches = [] } = useBranches()

    // Managers can only access their own branch
    const isManager = profile?.role === 'MANAGER'
    const branches = isManager && profile?.branchId
        ? allBranches.filter((b: any) => b.id === profile.branchId)
        : allBranches

    // Session
    const [posState, setPosState] = useState<POSState>('idle')
    const [sessionId, setSessionId] = useState('')
    const [branchId, setBranchId] = useState(isManager && profile?.branchId ? profile.branchId : '')
    const [isStarting, setIsStarting] = useState(false)

    // Cart
    const [cart, setCart] = useState<CartItem[]>([])
    const [barcodeInput, setBarcodeInput] = useState('')
    const [isScanning, setIsScanning] = useState(false)
    const [discountPercent, setDiscountPercent] = useState(0)
    const [taxPercent, setTaxPercent] = useState(3)
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI'>('CASH')
    const [customerName, setCustomerName] = useState('')
    const [customerPhone, setCustomerPhone] = useState('')
    const [isCheckingOut, setIsCheckingOut] = useState(false)
    const [lastSale, setLastSale] = useState<any>(null)
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null)
    const [sessionSales, setSessionSales] = useState<any[]>([])
    const invoiceRef = useRef<HTMLDivElement>(null)

    const barcodeRef = useRef<HTMLInputElement>(null)

    // Computed totals
    const subtotal = cart.reduce((sum, i) => sum + i.subtotal, 0)
    const discountAmount = subtotal * (discountPercent / 100)
    const afterDiscount = subtotal - discountAmount
    const taxAmount = afterDiscount * (taxPercent / 100)
    const totalAmount = afterDiscount + taxAmount

    // ── Start Session ────────────────────────────────────────────
    const handleStartSession = async () => {
        if (!branchId) return toast.error('Select a branch first')
        setIsStarting(true)
        try {
            const session = await getOrCreateSession(branchId, profile?.id ?? '')
            setSessionId(session.id)
            setPosState('active')
            toast.success('POS Session started!')
            // Load previous sales for this session
            const sales = await fetchSessionSales(session.id)
            setSessionSales(sales)
            setTimeout(() => barcodeRef.current?.focus(), 300)
        } catch (err: any) {
            toast.error(err.message || 'Failed to start session')
        } finally {
            setIsStarting(false)
        }
    }

    // ── Universal Camera Scanner ──────────────────────────────────
    const posScanner = useBarcodeScanner('pos-qr-reader', (text) => {
        setBarcodeInput(text)
        addItemByBarcode(text)
    }, {
        fps: 15,
        qrboxWidth: 250,
        qrboxHeight: 120,
    })

    // ── Add Item ─────────────────────────────────────────────────
    const addItemByBarcode = async (barcode: string) => {
        if (!barcode.trim()) return
        setIsScanning(true)
        try {
            const product = await posLookupProduct(barcode.trim(), branchId)
            if (!product) {
                toast.error(`No product found: ${barcode}`)
                return
            }
            if (product.stockCount <= 0) {
                toast.error(`${product.name} is out of stock`)
                return
            }

            setCart(prev => {
                const existing = prev.find(i => i.inventoryId === product.inventoryId)
                if (existing) {
                    if (existing.quantity >= product.stockCount) {
                        toast.error(`Max stock reached (${product.stockCount})`)
                        return prev
                    }
                    return prev.map(i =>
                        i.inventoryId === product.inventoryId
                            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
                            : i,
                    )
                }
                toast.success(`Added: ${product.name}`)
                return [
                    ...prev,
                    {
                        inventoryId: product.inventoryId,
                        productId: product.productId,
                        branchId: product.branchId ?? branchId,
                        name: product.name,
                        sku: product.sku,
                        barcode: product.barcode,
                        gold_type: product.gold_type ?? '',
                        metal_type: product.metal_type ?? 'Gold',
                        purity: product.purity ?? product.gold_type ?? '22K',
                        weight: product.weight ?? 0,
                        image_url: product.image_url,
                        unitPrice: product.sellingPrice,
                        quantity: 1,
                        subtotal: product.sellingPrice,
                        maxStock: product.stockCount,
                    },
                ]
            })
            setBarcodeInput('')
        } catch (err: any) {
            toast.error(err.message)
        } finally {
            setIsScanning(false)
            barcodeRef.current?.focus()
        }
    }

    const updateQuantity = (inventoryId: string, delta: number) => {
        setCart(prev =>
            prev.map(i => {
                if (i.inventoryId !== inventoryId) return i
                const newQty = Math.max(1, Math.min(i.maxStock, i.quantity + delta))
                return { ...i, quantity: newQty, subtotal: newQty * i.unitPrice }
            }),
        )
    }

    const removeItem = (inventoryId: string) => {
        setCart(prev => prev.filter(i => i.inventoryId !== inventoryId))
    }

    // ── Checkout ──────────────────────────────────────────────────
    const handleCheckout = async () => {
        if (cart.length === 0) return toast.error('Cart is empty')
        setIsCheckingOut(true)

        // Snapshot cart before clearing
        const cartSnapshot = [...cart]
        const checkoutDiscount = discountPercent
        const checkoutTax = taxPercent
        const checkoutPayment = paymentMethod
        const checkoutCustomer = customerName.trim()
        const checkoutPhone = customerPhone.trim()

        try {
            const result = await processCheckout({
                sessionId,
                branchId,
                userId: profile?.id ?? '',
                cart: cartSnapshot,
                discountPercent: checkoutDiscount,
                taxPercent: checkoutTax,
                paymentMethod: checkoutPayment,
                customerName: checkoutCustomer || undefined,
                customerPhone: checkoutPhone || undefined,
            })
            setLastSale(result)

            // Build invoice data
            const saleDate = new Date()
            const branch = allBranches.find((b: any) => b.id === branchId)
            const invoiceNum = `INV-${result.saleId.replace(/-/g, '').slice(0, 6).toUpperCase()}`

            setInvoiceData({
                saleId: result.saleId,
                invoiceNumber: invoiceNum,
                date: saleDate,
                branchName: branch?.name ?? 'Virudti Jewells',
                cashierName: profile?.name ?? profile?.email ?? 'Cashier',
                items: cartSnapshot.map(item => ({
                    name: item.name,
                    weight: item.weight ?? 0,
                    purity: item.purity ?? '',
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    total: item.subtotal,
                })),
                subtotal: result.subtotal,
                discountPercent: checkoutDiscount,
                discountAmount: result.discountAmount,
                taxPercent: checkoutTax,
                taxAmount: result.taxAmount,
                totalAmount: result.totalAmount,
                paymentMethod: checkoutPayment,
                customerName: checkoutCustomer || undefined,
                customerPhone: checkoutPhone || undefined,
            })

            setPosState('success')
            setCart([])
            setDiscountPercent(0)
            setCustomerName('')
            setCustomerPhone('')

            // Invalidate caches
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] })
            queryClient.invalidateQueries({ queryKey: ['stockHistory'] })
            toast.success('Sale completed!')

            // Auto-print invoice
            setTimeout(() => window.print(), 600)
        } catch (err: any) {
            toast.error(err.message || 'Checkout failed')
        } finally {
            setIsCheckingOut(false)
        }
    }

    const handleEndSession = async () => {
        try {
            await closeSession(sessionId, profile?.id ?? '')
            setPosState('idle')
            setSessionId('')
            setCart([])
            toast.success('Session closed')
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    // ── RENDER: Idle State ───────────────────────────────────────
    if (posState === 'idle') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-6 max-w-md">
                    <div className="w-20 h-20 gold-gradient rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-gold/20">
                        <Monitor className="text-black w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-bold heading-luxury">POS Mode</h2>
                    <p className="text-muted-foreground text-sm">
                        Start a billing session to scan items, build cart, apply discounts, and process checkout.
                    </p>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                                {isManager ? 'Your Branch' : 'Select Branch'}
                            </label>
                            <select
                                value={branchId}
                                onChange={(e) => setBranchId(e.target.value)}
                                disabled={isManager}
                                className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm disabled:opacity-70"
                            >
                                {!isManager && <option value="">Choose branch...</option>}
                                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={handleStartSession}
                            disabled={isStarting || !branchId}
                            className="gold-gradient text-black px-8 py-3 rounded-xl font-semibold flex items-center gap-2 mx-auto disabled:opacity-50"
                        >
                            {isStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanBarcode className="w-5 h-5" />}
                            {isStarting ? 'Starting...' : 'Start Session'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    // ── RENDER: Success State ────────────────────────────────────
    if (posState === 'success' && lastSale) {
        return (
            <div className="flex flex-col items-center justify-start min-h-[60vh] py-6 gap-6">
                {/* Action buttons */}
                <motion.div
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="flex items-center gap-4"
                >
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    <h2 className="text-xl font-bold heading-luxury">Sale Complete!</h2>
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl border border-gold/40 text-gold hover:bg-gold/10 transition-all text-sm font-semibold"
                    >
                        <Printer className="w-4 h-4" /> Print Invoice
                    </button>
                    <button
                        onClick={() => { setPosState('active'); setLastSale(null); setInvoiceData(null); setTimeout(() => barcodeRef.current?.focus(), 300) }}
                        className="gold-gradient text-black px-5 py-2 rounded-xl font-semibold text-sm"
                    >
                        New Sale
                    </button>
                    <button
                        onClick={handleEndSession}
                        className="px-5 py-2 rounded-xl border border-border text-sm hover:bg-secondary transition-all"
                    >
                        End Session
                    </button>
                </motion.div>

                {/* Printable Invoice */}
                {invoiceData && (
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-2xl shadow-2xl shadow-gold/10 overflow-hidden"
                    >
                        <POSInvoice ref={invoiceRef} data={invoiceData} />
                    </motion.div>
                )}
            </div>
        )
    }

    // ── RENDER: Active POS ───────────────────────────────────────
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 lg:h-[calc(100vh-120px)]">
            {/* LEFT: Scan + Items */}
            <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
                {/* Scanner Bar */}
                <div className="glass-card rounded-2xl p-4">
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                        <div className="relative flex-1">
                            <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gold" />
                            <input
                                ref={barcodeRef}
                                type="text"
                                value={barcodeInput}
                                onChange={(e) => setBarcodeInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addItemByBarcode(barcodeInput)}
                                placeholder="Scan barcode or enter manually..."
                                className="w-full pl-10 pr-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                                autoFocus
                            />
                        </div>
                        <button
                            onClick={() => addItemByBarcode(barcodeInput)}
                            disabled={isScanning}
                            className="gold-gradient text-black px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50"
                        >
                            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Add
                        </button>
                        <button
                            onClick={posScanner.isActive ? posScanner.stop : posScanner.start}
                            disabled={posScanner.isStarting}
                            className={`px-4 py-2.5 rounded-xl border text-sm flex items-center gap-2 transition-all ${posScanner.isActive ? 'border-red-400 text-red-400' : 'border-border hover:bg-secondary'}`}
                        >
                            <ScanBarcode className="w-4 h-4" />
                            {posScanner.isStarting ? 'Starting...' : posScanner.isActive ? 'Stop' : 'Camera'}
                        </button>
                        {/* Camera selector */}
                        {posScanner.cameras.length > 1 && posScanner.isActive && (
                            <select
                                value={posScanner.activeCameraId ?? ''}
                                onChange={(e) => posScanner.switchCamera(e.target.value)}
                                className="bg-secondary/50 border border-border rounded-lg px-2 py-2 text-xs text-foreground cursor-pointer"
                            >
                                {posScanner.cameras.map(cam => (
                                    <option key={cam.deviceId} value={cam.deviceId}>{cam.label}</option>
                                ))}
                            </select>
                        )}
                    </div>
                    {/* Camera preview */}
                    <div id="pos-qr-reader" className={`mt-3 rounded-xl overflow-hidden ${posScanner.isActive ? 'min-h-[200px]' : 'hidden'}`} />
                    {posScanner.error && (
                        <p className="text-xs text-red-400 mt-2">{posScanner.error}</p>
                    )}
                </div>

                {/* Cart Items */}
                <div className="glass-card rounded-2xl flex-1 overflow-hidden flex flex-col">
                    <div className="px-6 py-3 border-b border-border/30 flex items-center justify-between">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-gold" /> Cart ({cart.length} items)
                        </h3>
                        {cart.length > 0 && (
                            <button onClick={() => setCart([])} className="text-xs text-red-400 hover:underline">Clear All</button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {cart.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
                                <ShoppingCart className="w-16 h-16 mb-3" />
                                <p className="text-sm">Scan a barcode to start</p>
                            </div>
                        ) : (
                            cart.map((item) => (
                                <motion.div
                                    key={item.inventoryId}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-3 bg-secondary/20 rounded-xl p-3 hover:bg-secondary/30 transition-all"
                                >
                                    {item.image_url ? (
                                        <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-lg object-cover border border-border/30 shrink-0" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                                            <Package className="w-6 h-6 text-muted-foreground/30" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{item.name}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {item.sku} · <span className={`px-1.5 py-0.5 rounded text-[9px] border ${METAL_BADGE_COLORS[(item.metal_type as keyof typeof METAL_BADGE_COLORS)] || METAL_BADGE_COLORS.Gold}`}>{item.metal_type} · {item.purity}</span> · {item.weight}g
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => updateQuantity(item.inventoryId, -1)} className="p-1 rounded-lg hover:bg-red-500/10"><Minus className="w-4 h-4 text-red-400" /></button>
                                        <span className="w-8 text-center font-bold text-sm">{item.quantity}</span>
                                        <button onClick={() => updateQuantity(item.inventoryId, 1)} className="p-1 rounded-lg hover:bg-emerald-500/10"><Plus className="w-4 h-4 text-emerald-400" /></button>
                                    </div>
                                    <p className="font-semibold text-sm text-gold w-24 text-right">₹{item.subtotal.toLocaleString()}</p>
                                    <button onClick={() => removeItem(item.inventoryId)} className="p-1.5 rounded-lg hover:bg-red-500/10">
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </button>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT: Checkout Panel */}
            <div className="flex flex-col gap-4">
                {/* Session Info */}
                <div className="glass-card rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Active Session</span>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-lg">LIVE</span>
                    </div>
                    <p className="text-xs text-muted-foreground">ID: {sessionId.slice(0, 8)}</p>
                </div>

                {/* Customer (Optional) */}
                <div className="glass-card rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Customer (Optional)</h4>
                    <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm" />
                    <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone number" className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm" />
                </div>

                {/* Discount + Tax */}
                <div className="glass-card rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Adjustments</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">Discount %</label>
                            <input type="number" min={0} max={100} step={0.5} value={discountPercent} onChange={(e) => setDiscountPercent(Number(e.target.value))} className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm" />
                        </div>
                        <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">GST %</label>
                            <input type="number" min={0} max={28} step={0.5} value={taxPercent} onChange={(e) => setTaxPercent(Number(e.target.value))} className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm" />
                        </div>
                    </div>
                </div>

                {/* Payment Method */}
                <div className="glass-card rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Payment Method</h4>
                    <div className="grid grid-cols-3 gap-2">
                        {([
                            { id: 'CASH' as const, icon: Banknote, label: 'Cash' },
                            { id: 'CARD' as const, icon: CreditCard, label: 'Card' },
                            { id: 'UPI' as const, icon: Smartphone, label: 'UPI' },
                        ]).map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => setPaymentMethod(m.id)}
                                className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-xs transition-all ${paymentMethod === m.id
                                    ? 'border-gold bg-gold/10 text-gold'
                                    : 'border-border hover:bg-secondary'
                                    }`}
                            >
                                <m.icon className="w-5 h-5" />
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Totals */}
                <div className="glass-card rounded-2xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal</span><span>₹{subtotal.toLocaleString()}</span>
                    </div>
                    {discountPercent > 0 && (
                        <div className="flex justify-between text-emerald-400">
                            <span>Discount ({discountPercent}%)</span><span>-₹{discountAmount.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-muted-foreground">
                        <span>GST ({taxPercent}%)</span><span>₹{taxAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gold border-t border-border/30 pt-2">
                        <span>Total</span><span>₹{totalAmount.toLocaleString()}</span>
                    </div>
                </div>

                {/* Checkout Button */}
                <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || isCheckingOut}
                    className="gold-gradient text-black py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-40 hover:shadow-lg hover:shadow-gold/20 transition-all"
                >
                    {isCheckingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : <Receipt className="w-5 h-5" />}
                    {isCheckingOut ? 'Processing...' : `Checkout ₹${totalAmount.toLocaleString()}`}
                </button>

                {/* End Session */}
                <button
                    onClick={handleEndSession}
                    className="text-xs text-muted-foreground hover:text-red-400 text-center transition-colors"
                >
                    End Session
                </button>
            </div>
        </div>
    )
}
