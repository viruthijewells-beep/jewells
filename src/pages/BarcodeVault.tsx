import { useState, useRef, useCallback } from 'react'
import { motion } from 'motion/react'
import {
    Search, Download, Printer, FileText, Package,
    AlertCircle, ChevronLeft, ChevronRight, Loader2, QrCode,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePageTitle } from '@/hooks'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'
import BarcodeDisplay from '@/components/BarcodeDisplay'
import JsBarcode from 'jsbarcode'

const PAGE_SIZE = 30

// ─── Fetch barcode inventory data ──────────────────────────────
async function fetchBarcodeData(page: number, search: string) {
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    let query = supabase
        .from('branch_inventory')
        .select(`
            id, product_id, branch_id, sku, barcode, stock_count,
            selling_price, min_stock_level, updated_at,
            product:products(id, name, gold_type, weight_base, design_code, image_url,
                category:categories(name)
            ),
            branch:branches(name)
        `, { count: 'exact' })
        .order('updated_at', { ascending: false })
        .range(from, to)

    if (search.trim()) {
        query = query.or(`barcode.eq.${search},sku.ilike.%${search}%`)
    }

    const { data, count, error } = await query
    if (error) throw new Error(error.message)

    return {
        items: (data ?? []).map((d: any) => ({
            id: d.id,
            productId: d.product_id,
            branchId: d.branch_id,
            barcode: d.barcode,
            sku: d.sku,
            name: d.product?.name ?? '—',
            designCode: d.product?.design_code ?? '—',
            goldType: d.product?.gold_type ?? '—',
            weight: d.product?.weight_base ?? 0,
            categoryName: d.product?.category?.name ?? '—',
            branchName: d.branch?.name ?? '—',
            stockCount: d.stock_count ?? 0,
            minStock: d.min_stock_level ?? 5,
            sellingPrice: d.selling_price ?? 0,
            imageUrl: d.product?.image_url,
            lastUpdated: d.updated_at,
            isLowStock: (d.stock_count ?? 0) < (d.min_stock_level ?? 5),
        })),
        total: count ?? 0,
    }
}

// ─── Export CSV ──────────────────────────────────────────────────
function exportCSV(items: any[]) {
    const headers = ['Barcode', 'SKU', 'Design Code', 'Product', 'Category', 'Gold Type', 'Weight(g)', 'Branch', 'Stock', 'Price']
    const rows = items.map(i => [i.barcode, i.sku, i.designCode, i.name, i.categoryName, i.goldType, i.weight, i.branchName, i.stockCount, i.sellingPrice])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `virudti_barcodes_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exported!')
}

// ─── Print Label Sheet (Scanner-Compatible, A4 Optimized) ───────
function printLabelSheet(items: any[]) {
    const win = window.open('', '_blank')
    if (!win) return toast.error('Popup blocked — allow popups for this site')

    // Generate high-resolution barcode SVGs using CODE128 (most scanner-compatible)
    const labels = items.map(item => {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        const barcodeValue = String(item.barcode || '').trim()
        if (!barcodeValue) return ''

        try {
            // Try EAN13 first (if 13 digits), fallback to CODE128
            const isEAN = /^\d{13}$/.test(barcodeValue)
            JsBarcode(svg, barcodeValue, {
                format: isEAN ? 'EAN13' : 'CODE128',
                width: 2,
                height: 60,
                displayValue: false, // We show number separately for clarity
                margin: 8,
                background: '#ffffff',
                lineColor: '#000000',
            })
        } catch {
            // Final fallback: CODE128 handles anything
            try {
                JsBarcode(svg, barcodeValue, {
                    format: 'CODE128', width: 2, height: 60,
                    displayValue: false, margin: 8,
                    background: '#ffffff', lineColor: '#000000',
                })
            } catch { return '' }
        }

        const svgStr = new XMLSerializer().serializeToString(svg)

        return `<div class="label">
            <div class="barcode-img">${svgStr}</div>
            <div class="barcode-num">${barcodeValue}</div>
            <div class="label-sku">${item.sku || '—'}</div>
            <div class="label-name">${item.name || '—'}</div>
            <div class="label-meta">Stock: ${item.stockCount} &nbsp;|&nbsp; ${item.branchName}</div>
        </div>`
    }).filter(Boolean)

    if (labels.length === 0) return toast.error('No valid barcodes to print')

    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Barcode Labels — VIRUDTI JEWELLS ERP</title>
<style>
    /* ── Page Setup ── */
    @page {
        size: A4 portrait;
        margin: 8mm 6mm;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: 'Arial', 'Helvetica Neue', sans-serif;
        background: #fff;
        color: #000;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    /* ── Controls (hidden on print) ── */
    .controls {
        position: sticky;
        top: 0;
        z-index: 100;
        background: #f8f8f8;
        border-bottom: 2px solid #D4AF37;
        padding: 12px 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
    }
    .controls button {
        padding: 10px 28px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: 2px solid #D4AF37;
        background: #D4AF37;
        color: #000;
        border-radius: 8px;
    }
    .controls button:hover { opacity: 0.9; }
    .controls span {
        font-size: 13px;
        color: #666;
    }

    /* ── Label Grid (3 cols × 8 rows = 24 per page) ── */
    .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0;
        padding: 0;
    }

    /* ── Each Label ── */
    .label {
        border: 1px solid #ccc;
        padding: 6mm 4mm 4mm;
        text-align: center;
        page-break-inside: avoid;
        break-inside: avoid;
        height: 33.5mm;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    /* ── Barcode Image ── */
    .barcode-img {
        width: 100%;
        display: flex;
        justify-content: center;
    }
    .barcode-img svg {
        width: 90%;
        max-width: 56mm;
        height: 14mm;
    }

    /* ── Barcode Number ── */
    .barcode-num {
        font-family: 'Courier New', monospace;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 1.5px;
        margin-top: 1mm;
        color: #000;
    }

    /* ── SKU ── */
    .label-sku {
        font-size: 8px;
        font-weight: 700;
        color: #222;
        margin-top: 0.5mm;
    }

    /* ── Product Name ── */
    .label-name {
        font-size: 7px;
        color: #555;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 95%;
    }

    /* ── Meta (Stock / Branch) ── */
    .label-meta {
        font-size: 6.5px;
        color: #888;
        margin-top: 0.3mm;
    }

    /* ── Print-specific overrides ── */
    @media print {
        .controls { display: none !important; }
        body { background: #fff !important; }
        .label { border-color: #ddd; }
    }
</style>
</head>
<body>

<div class="controls">
    <button onclick="window.print()">🖨️ Print Labels</button>
    <span>${labels.length} labels ready · A4 · 300DPI safe</span>
</div>

<div class="grid">
${labels.join('\n')}
</div>

</body>
</html>`)
    win.document.close()
    toast.success(`${labels.length} labels ready to print`)
}

// ─── Main Page ──────────────────────────────────────────────────
export default function BarcodeVault() {
    usePageTitle('Barcode Vault')
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [expandedRow, setExpandedRow] = useState<string | null>(null)

    const { data, isLoading } = useQuery({
        queryKey: ['barcodeVault', page, search],
        queryFn: () => fetchBarcodeData(page, search),
        staleTime: 15_000,
    })

    const items = data?.items ?? []
    const total = data?.total ?? 0
    const totalPages = Math.ceil(total / PAGE_SIZE)

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setSearch(searchInput)
        setPage(1)
    }

    return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 gold-gradient rounded-2xl flex items-center justify-center shadow-lg shadow-gold/20">
                            <QrCode className="w-6 h-6 text-black" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold heading-luxury">Barcode Vault</h1>
                            <p className="text-xs text-muted-foreground">{total} barcodes · Indexed · Searchable</p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => items.length > 0 && exportCSV(items)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm hover:bg-secondary transition-all"
                        >
                            <FileText className="w-4 h-4 text-gold" /> Export CSV
                        </button>
                        <button
                            onClick={() => items.length > 0 && printLabelSheet(items)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-sm hover:bg-secondary transition-all"
                        >
                            <Printer className="w-4 h-4 text-gold" /> Print Labels
                        </button>
                    </div>
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            placeholder="Search by barcode (exact) or SKU..."
                            className="w-full bg-secondary/50 border border-border rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all"
                        />
                    </div>
                    <button type="submit" className="gold-gradient text-black px-6 py-3 rounded-xl font-semibold text-sm">
                        Search
                    </button>
                </form>

                {/* Table */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-gold animate-spin" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-20 text-muted-foreground">
                        <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No barcodes found</p>
                    </div>
                ) : (
                    <div className="glass-card rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                                        <th className="px-4 py-3">Barcode</th>
                                        <th className="px-4 py-3">SKU</th>
                                        <th className="px-4 py-3">Design Code</th>
                                        <th className="px-4 py-3">Product</th>
                                        <th className="px-4 py-3">Branch</th>
                                        <th className="px-4 py-3">Gold</th>
                                        <th className="px-4 py-3 text-right">Stock</th>
                                        <th className="px-4 py-3 text-right">Price</th>
                                        <th className="px-4 py-3 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item: any) => (
                                        <motion.tr
                                            key={item.id}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="border-b border-border/50 hover:bg-secondary/20 transition-colors cursor-pointer"
                                            onClick={() => setExpandedRow(expandedRow === item.id ? null : item.id)}
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-gold text-xs">{item.barcode}</span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs">{item.sku}</td>
                                            <td className="px-4 py-3">
                                                <span className="bg-gold/10 text-gold px-2 py-0.5 rounded-md text-[10px] font-medium">
                                                    {item.designCode}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {item.imageUrl ? (
                                                        <img src={item.imageUrl} className="w-7 h-7 rounded-md object-cover border border-border/30" />
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-md bg-secondary flex items-center justify-center">
                                                            <Package className="w-3.5 h-3.5 text-muted-foreground" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-medium text-xs">{item.name}</p>
                                                        <p className="text-[10px] text-muted-foreground">{item.categoryName}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs">{item.branchName}</td>
                                            <td className="px-4 py-3 text-xs">{item.goldType} · {item.weight}g</td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`font-bold text-xs ${item.isLowStock ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {item.stockCount}
                                                </span>
                                                {item.isLowStock && <AlertCircle className="w-3 h-3 text-red-400 inline ml-1" />}
                                            </td>
                                            <td className="px-4 py-3 text-right text-xs text-gold font-medium">
                                                ₹{Number(item.sellingPrice).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Download className="w-3.5 h-3.5 text-muted-foreground" />
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Expanded Row — Barcode Preview */}
                        {expandedRow && (() => {
                            const item = items.find((i: any) => i.id === expandedRow)
                            if (!item) return null
                            return (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    className="border-t border-gold/10 bg-secondary/10 p-6"
                                >
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                                        <div className="md:col-span-1">
                                            <BarcodeDisplay barcode={item.barcode} productName={item.name} showDownload />
                                        </div>
                                        <div className="md:col-span-2 space-y-3 text-sm">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase">Design Code</p>
                                                    <p className="font-medium text-gold">{item.designCode}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase">SKU</p>
                                                    <p className="font-mono font-medium">{item.sku}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase">Current Stock</p>
                                                    <p className={`font-bold ${item.isLowStock ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {item.stockCount} {item.isLowStock && `(min: ${item.minStock})`}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase">Last Updated</p>
                                                    <p className="text-xs">{item.lastUpdated ? new Date(item.lastUpdated).toLocaleString() : '—'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })()}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                                <p className="text-xs text-muted-foreground">{total} results · Page {page} of {totalPages}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                        className="p-2 rounded-lg hover:bg-secondary disabled:opacity-30">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                        className="p-2 rounded-lg hover:bg-secondary disabled:opacity-30">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
    )
}
