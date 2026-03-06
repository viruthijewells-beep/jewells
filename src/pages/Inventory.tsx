import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { METAL_TYPES, PURITY_OPTIONS, DEFAULT_PURITY, METAL_BADGE_COLORS, getDefaultPurity, getPurityOptions } from '@/lib/metalTypes'
import {
    Search, Filter, Plus, Edit, Trash2, ChevronLeft, ChevronRight,
    Diamond, AlertCircle, Download, MinusCircle, PlusCircle, Loader2, X, Package, CheckCircle2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useProducts, useCategories, useBranches, useOptimisticStockUpdate, usePageTitle } from '@/hooks'
import { useMetalRates } from '@/hooks/useMetalRates'
import { deleteProduct, createProductFull } from '@/lib/api/products'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'
import ProductImageUpload from '@/components/ProductImageUpload'
import BarcodeDisplay from '@/components/BarcodeDisplay'

// ─── Stock Controls ──────────────────────────────────────────────
function StockControls({ product, stockMutation }: { product: any; stockMutation: any }) {
    const { profile } = useAuth()
    const isPending = stockMutation.isPending && stockMutation.variables?.productId === product.id
    const stock = product.stockCount ?? 0

    if (!product.branchId) return <span className="text-xs text-muted-foreground">No inventory</span>

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() =>
                    stockMutation.mutate({
                        productId: product.id,
                        branchId: product.branchId,
                        action: 'REMOVE' as const,
                        amount: 1,
                        userId: profile?.id,
                    })
                }
                disabled={isPending || stock <= 0}
                className="p-1 rounded-lg hover:bg-red-500/10 text-red-400 disabled:opacity-30 transition-all"
            >
                <MinusCircle className="w-5 h-5" />
            </button>
            <span className={`font-bold min-w-[40px] text-center ${stock <= 5 ? 'text-red-400' : 'text-gold'}`}>
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : stock}
            </span>
            <button
                onClick={() =>
                    stockMutation.mutate({
                        productId: product.id,
                        branchId: product.branchId,
                        action: 'ADD' as const,
                        amount: 1,
                        userId: profile?.id,
                    })
                }
                disabled={isPending}
                className="p-1 rounded-lg hover:bg-emerald-500/10 text-emerald-400 disabled:opacity-30 transition-all"
            >
                <PlusCircle className="w-5 h-5" />
            </button>
        </div>
    )
}

// ─── Fast Add Entry Modal ────────────────────────────────────────
function FastAddModal({
    onClose,
    categories,
    branches,
}: {
    onClose: () => void
    categories: any[]
    branches: any[]
}) {
    const { profile } = useAuth()
    const queryClient = useQueryClient()
    const { rates: metalRates } = useMetalRates()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [createdBarcode, setCreatedBarcode] = useState<string | null>(null)
    const [createdName, setCreatedName] = useState('')
    const [createdDesignCode, setCreatedDesignCode] = useState('')
    const [createdSku, setCreatedSku] = useState('')
    const [priceOverridden, setPriceOverridden] = useState(false)
    const [form, setForm] = useState({
        name: '',
        category_id: '',
        metal_type: 'Gold',
        purity: '22K',
        design_code: '',
        weight: '',
        branch_id: '',
        sku: '',
        stock_count: '1',
        selling_price: '',
        purchase_price: '',
        min_stock_level: '5',
    })

    const updateField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

    // When metal changes, reset purity to the default for that metal
    const handleMetalChange = (metal: string) => {
        setForm(prev => ({ ...prev, metal_type: metal, purity: getDefaultPurity(metal) }))
        setPriceOverridden(false)  // recalculate on metal change
    }

    // ── Auto-calculate selling price from weight × metal rate ────────
    useEffect(() => {
        if (priceOverridden) return
        const w = parseFloat(form.weight)
        if (!w || w <= 0) return
        const rate = metalRates[form.metal_type as keyof typeof metalRates] ?? 0
        if (rate > 0) {
            setForm(prev => ({ ...prev, selling_price: String(Math.round(w * rate)) }))
        }
    }, [form.weight, form.metal_type, metalRates, priceOverridden])

    const autoPrice = (() => {
        const w = parseFloat(form.weight)
        if (!w || w <= 0) return null
        const rate = metalRates[form.metal_type as keyof typeof metalRates] ?? 0
        if (rate <= 0) return null
        return { weight: w, rate, total: Math.round(w * rate) }
    })()

    const handleImageChange = (file: File | null, preview: string | null) => {
        setImageFile(file)
        setPreviewUrl(preview)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        // Validation
        if (!form.name.trim()) return toast.error('Product name is required')
        if (!form.category_id) return toast.error('Category is required')
        if (!form.branch_id) return toast.error('Branch is required')
        // SKU is auto-generated if empty
        if (!form.selling_price) return toast.error('Selling price is required')

        setIsSubmitting(true)
        try {
            const result = await createProductFull({
                name: form.name.trim(),
                category_id: form.category_id,
                metal_type: form.metal_type,
                purity: form.purity,
                design_code: form.design_code.trim(),
                weight: Number(form.weight) || 0,
                branch_id: form.branch_id,
                sku: form.sku.trim(),
                stock_count: Number(form.stock_count) || 1,
                selling_price: Number(form.selling_price),
                purchase_price: Number(form.purchase_price) || 0,
                min_stock_level: Number(form.min_stock_level) || 5,
                user_id: profile?.id ?? '',
                imageFile: imageFile,
            })
            setCreatedBarcode(result.barcode)
            setCreatedName(form.name)
            setCreatedDesignCode(result.design_code || '')
            setCreatedSku(result.sku || '')
            toast.success(`Product created with barcode: ${result.barcode}`)
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] })
        } catch (err: any) {
            toast.error(err.message || 'Failed to create product')
        } finally {
            setIsSubmitting(false)
        }
    }

    const inputClass = 'w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30'
    const labelClass = 'text-xs text-muted-foreground uppercase tracking-wider block mb-1.5'

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-card rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold heading-luxury flex items-center gap-2">
                        <Diamond className="w-5 h-5 text-gold" /> Fast Add Entry
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Row 1: Name + Category */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Product Name *</label>
                            <input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Gold Necklace 22K" className={inputClass} required />
                        </div>
                        <div>
                            <label className={labelClass}>Category *</label>
                            <select value={form.category_id} onChange={e => updateField('category_id', e.target.value)} className={inputClass} required>
                                <option value="">Select category...</option>
                                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Product Image (Optional) */}
                    <ProductImageUpload
                        imageFile={imageFile}
                        previewUrl={previewUrl}
                        onImageChange={handleImageChange}
                    />

                    {/* Row 2: Metal Type + Purity + Weight + Design Code */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className={labelClass}>Metal Type</label>
                            <select
                                value={form.metal_type}
                                onChange={e => handleMetalChange(e.target.value)}
                                className={inputClass}
                            >
                                {METAL_TYPES.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Purity</label>
                            <select
                                value={form.purity}
                                onChange={e => updateField('purity', e.target.value)}
                                className={inputClass}
                            >
                                {getPurityOptions(form.metal_type).map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Weight (grams)</label>
                            <input type="number" step="0.01" value={form.weight} onChange={e => updateField('weight', e.target.value)} placeholder="0.00" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Design Code</label>
                            <input value={form.design_code} onChange={e => updateField('design_code', e.target.value)} placeholder="Auto-generated" className={`${inputClass} border-gold/20 text-gold/60`} readOnly />
                        </div>
                    </div>

                    {/* Row 3: Branch + SKU */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Branch *</label>
                            <select value={form.branch_id} onChange={e => updateField('branch_id', e.target.value)} className={inputClass} required>
                                <option value="">Select branch...</option>
                                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>SKU (auto if empty)</label>
                            <input value={form.sku} onChange={e => updateField('sku', e.target.value)} placeholder="Auto-generated" className={inputClass} />
                        </div>
                    </div>

                    {/* Row 4: Stock + Selling Price + Purchase Price + Min Stock */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className={labelClass}>Initial Stock</label>
                            <input type="number" min="0" value={form.stock_count} onChange={e => updateField('stock_count', e.target.value)} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>
                                Selling Price *
                                {autoPrice && !priceOverridden && (
                                    <span className="ml-1 text-[10px] font-normal text-emerald-400">
                                        {autoPrice.weight}g × ₹{autoPrice.rate.toLocaleString('en-IN')} = ₹{autoPrice.total.toLocaleString('en-IN')}
                                    </span>
                                )}
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.selling_price}
                                onChange={e => { setPriceOverridden(true); updateField('selling_price', e.target.value) }}
                                placeholder="₹ Auto from rate"
                                className={inputClass}
                                required
                            />
                        </div>
                        <div>
                            <label className={labelClass}>Purchase Price</label>
                            <input type="number" step="0.01" value={form.purchase_price} onChange={e => updateField('purchase_price', e.target.value)} placeholder="₹0.00" className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Min Stock</label>
                            <input type="number" min="0" value={form.min_stock_level} onChange={e => updateField('min_stock_level', e.target.value)} className={inputClass} />
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl border border-border text-sm hover:bg-secondary transition-all">Cancel</button>
                        <button type="submit" disabled={isSubmitting} className="gold-gradient text-black px-8 py-2.5 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50">
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {isSubmitting ? 'Creating...' : 'Create Product'}
                        </button>
                    </div>

                    {/* Info: barcode auto-generated */}
                    <p className="text-[10px] text-muted-foreground/50 text-center">
                        Barcode, Design Code & SKU are auto-generated server-side (guaranteed unique)
                    </p>
                </form>

                {/* Success: Show generated barcode */}
                {createdBarcode && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 pt-6 border-t border-gold/20"
                    >
                        <div className="text-center mb-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                            <p className="text-sm font-semibold">Product "{createdName}" Created!</p>
                            <p className="text-xs text-muted-foreground">All codes auto-generated</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-secondary/30 rounded-xl p-3 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Design Code</p>
                                <p className="text-sm font-bold text-gold mt-1">{createdDesignCode}</p>
                            </div>
                            <div className="bg-secondary/30 rounded-xl p-3 text-center">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">SKU</p>
                                <p className="text-sm font-bold font-mono mt-1">{createdSku}</p>
                            </div>
                        </div>
                        <BarcodeDisplay barcode={createdBarcode} productName={createdName} showDownload />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => { setCreatedBarcode(null); setCreatedName(''); setCreatedDesignCode(''); setCreatedSku(''); setForm({ name: '', category_id: '', metal_type: 'Gold', purity: '22K', design_code: '', weight: '', branch_id: '', sku: '', stock_count: '1', selling_price: '', purchase_price: '', min_stock_level: '5' }); setImageFile(null); setPreviewUrl(null) }}
                                className="flex-1 gold-gradient text-black px-4 py-2.5 rounded-xl font-semibold text-sm"
                            >
                                Add Another Product
                            </button>
                            <button onClick={onClose} className="flex-1 border border-border px-4 py-2.5 rounded-xl text-sm hover:bg-secondary">
                                Done
                            </button>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    )
}

// ─── Main Inventory Page ─────────────────────────────────────────
export default function Inventory() {
    usePageTitle('Inventory');
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [category, setCategory] = useState('all')
    const [showAddForm, setShowAddForm] = useState(false)
    const queryClient = useQueryClient()

    const catQuery = category !== 'all' ? category : ''
    const { data: productsData, isLoading, error } = useProducts(page, search, catQuery)
    const { data: categories = [] } = useCategories()
    const { data: branches = [] } = useBranches()
    const stockMutation = useOptimisticStockUpdate()

    const handleDelete = useCallback(async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"? This will also remove all inventory records.`)) return
        try {
            await deleteProduct(id)
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] })
            toast.success(`"${name}" deleted`)
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete product')
        }
    }, [queryClient])

    const handleExportCSV = () => {
        const products = productsData?.products ?? []
        if (products.length === 0) return toast.error('No data to export')
        const header = 'Name,Category,SKU,Barcode,Gold Type,Weight,Stock,MSRP,Branch'
        const csv = products.map((p: any) =>
            `"${p.name}","${p.categoryName}","${p.sku}","${p.barcode}","${p.gold_type}","${p.weight}","${p.stockCount}","${p.msrp}","${p.branchName}"`
        ).join('\n')
        const blob = new Blob([`${header}\n${csv}`], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
        URL.revokeObjectURL(url)
        toast.success('CSV exported!')
    }

    const products = productsData?.products ?? []
    const totalPages = Math.ceil((productsData?.total ?? 0) / 20)

    return (
        <>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold heading-luxury">Inventory Vault</h2>
                        <p className="text-muted-foreground text-sm">
                            {productsData?.total ? `${productsData.total.toLocaleString()} products` : 'Manage and track your precious collections.'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleExportCSV} className="border border-border px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-secondary transition-all">
                            <Download className="w-4 h-4" /> Export CSV
                        </button>
                        <button onClick={() => setShowAddForm(true)} className="gold-gradient text-black px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-gold/20 transition-all">
                            <Plus className="w-4 h-4" /> Fast Add Entry
                        </button>
                    </div>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search by name or design code..."
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                            className="w-full pl-10 pr-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <select
                            value={category}
                            onChange={(e) => { setCategory(e.target.value); setPage(1) }}
                            className="pl-10 pr-8 py-3 bg-secondary/50 border border-border rounded-xl text-sm appearance-none cursor-pointer min-w-[180px]"
                        >
                            <option value="all">All Categories</option>
                            {categories.map((cat: any) => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Error display */}
                {error && (
                    <div className="flex items-center gap-2 text-red-400 bg-red-400/5 border border-red-400/10 rounded-xl px-4 py-3 text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{(error as Error).message}</span>
                    </div>
                )}

                {/* Low stock warning */}
                {products.some((p: any) => p.isLowStock || (p.stockCount ?? 0) < (p.minStockLevel ?? 5)) && (
                    <div className="flex items-center gap-2 text-amber-400 bg-amber-400/5 border border-amber-400/10 rounded-xl px-4 py-2 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        {products.filter((p: any) => (p.stockCount ?? 0) < (p.minStockLevel ?? 5)).length} items below minimum stock level
                    </div>
                )}

                {/* Table */}
                <div className="glass-card rounded-2xl overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                        <thead>
                            <tr className="border-b border-border/30">
                                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-6 py-4">Product</th>
                                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Category</th>
                                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">SKU / Barcode</th>
                                <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Specification</th>
                                <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Fast Stock</th>
                                <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">MSRP</th>
                                <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Operations</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={7} className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gold mx-auto" /></td></tr>
                            ) : products.length === 0 ? (
                                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">{error ? 'Failed to load' : 'No products found'}</td></tr>
                            ) : (
                                products.map((product: any) => (
                                    <motion.tr
                                        key={product.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="border-b border-border/10 hover:bg-secondary/30 transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {product.image_url ? (
                                                    <img src={product.image_url} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-border/30 shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                                                        <Package className="w-5 h-5 text-muted-foreground/30" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="font-medium text-sm">{product.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{product.branchName}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="text-xs bg-secondary px-3 py-1 rounded-lg uppercase tracking-wider">
                                                {product.categoryName}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-xs text-muted-foreground">
                                            <div>SKU: {product.sku}</div>
                                            <div>BAR: {product.barcode}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${METAL_BADGE_COLORS[(product.metal_type as keyof typeof METAL_BADGE_COLORS)] || METAL_BADGE_COLORS.Gold
                                                }`}>
                                                {product.metal_type ?? 'Gold'} · {product.purity ?? product.gold_type ?? '22K'}
                                            </span>
                                            <span className="text-xs text-muted-foreground ml-2">{product.weight ? `${product.weight}g` : ''}</span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <StockControls product={product} stockMutation={stockMutation} />
                                        </td>
                                        <td className="px-4 py-4 text-right text-sm font-medium text-gold">
                                            ₹{Number(product.msrp ?? 0).toLocaleString()}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button onClick={() => toast.info(`Edit: ${product.name}`)} className="p-2 hover:bg-secondary rounded-lg transition-all">
                                                    <Edit className="w-4 h-4 text-muted-foreground" />
                                                </button>
                                                <button onClick={() => handleDelete(product.id, product.name)} className="p-2 hover:bg-red-500/10 rounded-lg transition-all">
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-4">
                        <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="p-2 rounded-xl hover:bg-secondary disabled:opacity-30 transition-all">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages} className="p-2 rounded-xl hover:bg-secondary disabled:opacity-30 transition-all">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>

            {/* Fast Add Modal */}
            <AnimatePresence>
                {showAddForm && (
                    <FastAddModal
                        onClose={() => setShowAddForm(false)}
                        categories={categories}
                        branches={branches}
                    />
                )}
            </AnimatePresence>
        </>
    )
}
