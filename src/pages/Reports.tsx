import { useState } from 'react'
import { BarChart3, TrendingUp, Package, DollarSign, Loader2, Download, FileText, Pencil, X, AlertTriangle, RotateCcw, Undo2, XCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { usePageTitle } from '@/hooks'
import { useAuth } from '@/lib/auth'
import { exportSalesReport, exportStockReport, exportTrendsReport } from '@/utils/exportReportWord'
import { exportToExcelCSV } from '@/utils/exportExcelCSV'
import { updateSale, refundSale, returnItems, cancelSale } from '@/lib/api/sales'

type ReportType = 'sales' | 'stock' | 'trends' | null

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
    COMPLETED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Completed' },
    REFUNDED: { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Refunded' },
    PARTIAL_RETURN: { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Partial Return' },
    CANCELLED: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', label: 'Cancelled' },
}

export default function Reports() {
    usePageTitle('Reports')
    const { profile } = useAuth()
    const canExport = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN' || profile?.role === 'MANAGER'
    const isSuperAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN'
    const [activeReport, setActiveReport] = useState<ReportType>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [reportData, setReportData] = useState<any>(null)

    // ── Modal States ──
    const [editSale, setEditSale] = useState<any>(null)
    const [editForm, setEditForm] = useState({ customer_name: '', discount_percent: 0, tax_percent: 0, payment_method: '' })
    const [refundData, setRefundData] = useState<any>(null)
    const [refundForm, setRefundForm] = useState({ reason: '', method: 'CASH' })
    const [returnData, setReturnData] = useState<any>(null)
    const [returnSelections, setReturnSelections] = useState<Record<string, number>>({})
    const [returnReason, setReturnReason] = useState('')
    const [cancelData, setCancelData] = useState<any>(null)
    const [cancelReason, setCancelReason] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    // ── Fetch Reports ──
    const fetchSalesReport = async () => {
        const { data, error } = await supabase
            .from('sales')
            .select('id, total_amount, discount_amount, tax_amount, payment_method, customer_name, status, created_at, sale_items(id, product_id, quantity, name, unit_price, subtotal)')
            .order('created_at', { ascending: false })
            .limit(50)
        if (error) throw new Error(error.message)
        const sales = data ?? []
        const activeSales = sales.filter((s: any) => s.status !== 'REFUNDED' && s.status !== 'CANCELLED')
        const totalRevenue = activeSales.reduce((s, r: any) => s + Number(r.total_amount ?? 0), 0)
        const totalItems = activeSales.reduce((s, r: any) => s + (r.sale_items?.reduce((sum: number, si: any) => sum + (si.quantity ?? 0), 0) ?? 0), 0)
        const byPayment: Record<string, number> = {}
        activeSales.forEach((s: any) => { byPayment[s.payment_method] = (byPayment[s.payment_method] || 0) + Number(s.total_amount ?? 0) })
        const refundedSales = sales.filter((s: any) => s.status === 'REFUNDED')
        const refundedAmount = refundedSales.reduce((s, r: any) => s + Number(r.total_amount ?? 0), 0)
        return { sales, totalRevenue, totalItems, totalSales: activeSales.length, byPayment, refundedCount: refundedSales.length, refundedAmount }
    }

    const fetchStockReport = async () => {
        const { data, error } = await supabase
            .from('branch_inventory')
            .select('stock_count, selling_price, min_stock_level, sku, barcode, product:products(name, gold_type), branch:branches(name)')
            .order('stock_count', { ascending: true })
            .limit(100)
        if (error) throw new Error(error.message)
        const items = (data ?? []) as any[]
        const totalStock = items.reduce((s, i) => s + (i.stock_count ?? 0), 0)
        const totalValue = items.reduce((s, i) => s + (i.stock_count ?? 0) * Number(i.selling_price ?? 0), 0)
        const lowStock = items.filter(i => i.stock_count < (i.min_stock_level ?? 5))
        const outOfStock = items.filter(i => i.stock_count <= 0)
        return { items, totalStock, totalValue, lowStockCount: lowStock.length, outOfStockCount: outOfStock.length }
    }

    const fetchTrendsReport = async () => {
        const { data, error } = await supabase
            .from('stock_history')
            .select('action_type, old_count, new_count, reason, created_at, product:products(name)')
            .order('created_at', { ascending: false })
            .limit(50)
        if (error) throw new Error(error.message)
        const entries = (data ?? []) as any[]
        const adds = entries.filter(e => e.action_type === 'ADD').length
        const removes = entries.filter(e => e.action_type === 'REMOVE').length
        return { entries, totalMovements: entries.length, adds, removes }
    }

    const handleSelectReport = async (type: ReportType) => {
        setActiveReport(type)
        setIsLoading(true)
        setReportData(null)
        try {
            let data
            if (type === 'sales') data = await fetchSalesReport()
            else if (type === 'stock') data = await fetchStockReport()
            else if (type === 'trends') data = await fetchTrendsReport()
            setReportData(data)
        } catch (err: any) {
            toast.error(err.message || 'Failed to generate report')
        } finally {
            setIsLoading(false)
        }
    }

    const handleExport = () => {
        if (!reportData || !activeReport) return
        if (activeReport === 'sales') {
            const rows = reportData.sales.map((s: any) => ({
                Date: new Date(s.created_at).toLocaleDateString(), Customer: s.customer_name || 'Walk-in',
                Items: s.sale_items?.length ?? 0, Status: s.status || 'COMPLETED',
                Total: Number(s.total_amount ?? 0), Payment: s.payment_method,
            }))
            exportToExcelCSV(rows, `sales_report_${Date.now()}`)
        } else if (activeReport === 'stock') {
            const rows = reportData.items.map((i: any) => ({
                Product: i.product?.name ?? '', Branch: i.branch?.name ?? '', SKU: i.sku,
                Stock: i.stock_count, 'Unit Price': Number(i.selling_price ?? 0),
                'Total Value': i.stock_count * Number(i.selling_price ?? 0),
            }))
            exportToExcelCSV(rows, `stock_report_${Date.now()}`)
        } else if (activeReport === 'trends') {
            const rows = reportData.entries.map((e: any) => ({
                Date: new Date(e.created_at).toLocaleDateString(), Product: e.product?.name ?? '',
                Action: e.action_type, 'Previous': e.old_count, 'New': e.new_count, Reason: e.reason ?? '',
            }))
            exportToExcelCSV(rows, `trends_report_${Date.now()}`)
        }
        toast.success('Excel report downloaded!')
    }

    const handleWordExport = async () => {
        if (!reportData || !activeReport) return
        if (!canExport) return toast.error('Only Admin or Manager can export reports')
        try {
            if (activeReport === 'sales') await exportSalesReport(reportData)
            else if (activeReport === 'stock') await exportStockReport(reportData)
            else if (activeReport === 'trends') await exportTrendsReport(reportData)
            toast.success('Word document downloaded!')
        } catch (err: any) { toast.error(err.message || 'Export failed') }
    }

    // ── Open Edit Modal ──
    const openEditModal = (sale: any) => {
        setEditSale(sale)
        setEditForm({
            customer_name: sale.customer_name || '',
            discount_percent: sale.discount_amount ? Math.round((Number(sale.discount_amount) / (Number(sale.total_amount) - Number(sale.tax_amount ?? 0) + Number(sale.discount_amount))) * 100) : 0,
            tax_percent: sale.tax_amount ? Math.round((Number(sale.tax_amount) / (Number(sale.total_amount) - Number(sale.tax_amount))) * 100) : 0,
            payment_method: sale.payment_method || 'CASH',
        })
    }

    // ── Handle Edit Save ──
    const handleEditSave = async () => {
        if (!editSale) return
        setIsSaving(true)
        try {
            await updateSale(editSale.id, {
                customer_name: editForm.customer_name || undefined,
                discount_percent: editForm.discount_percent,
                tax_percent: editForm.tax_percent,
                payment_method: editForm.payment_method,
            })
            toast.success('Sale updated successfully')
            setEditSale(null)
            if (activeReport === 'sales') handleSelectReport('sales')
        } catch (err: any) { toast.error(err?.message || 'Update failed') }
        finally { setIsSaving(false) }
    }

    // ── Handle Refund ──
    const handleRefund = async () => {
        if (!refundData || !refundForm.reason.trim()) return toast.error('Please enter a reason')
        setIsSaving(true)
        try {
            const result = await refundSale(refundData.id, refundForm.reason, refundForm.method)
            toast.success(`Refund of ₹${result.refundAmount.toLocaleString()} processed — ${result.itemsRestored} item(s) restored`)
            setRefundData(null)
            setRefundForm({ reason: '', method: 'CASH' })
            if (activeReport === 'sales') handleSelectReport('sales')
        } catch (err: any) { toast.error(err?.message || 'Refund failed') }
        finally { setIsSaving(false) }
    }

    // ── Handle Return ──
    const handleReturn = async () => {
        if (!returnData || !returnReason.trim()) return toast.error('Please enter a reason')
        const items = Object.entries(returnSelections)
            .filter(([, qty]) => qty > 0)
            .map(([itemId, qty]) => {
                const si = returnData.sale_items.find((i: any) => i.id === itemId)
                return { sale_item_id: itemId, product_id: si.product_id, quantity: qty, name: si.name }
            })
        if (items.length === 0) return toast.error('Select at least one item to return')
        setIsSaving(true)
        try {
            const result = await returnItems(returnData.id, items, returnReason)
            toast.success(`Return processed — ₹${result.returnedValue.toLocaleString()} adjusted, ${result.itemsReturned} item(s) restored`)
            setReturnData(null)
            setReturnSelections({})
            setReturnReason('')
            if (activeReport === 'sales') handleSelectReport('sales')
        } catch (err: any) { toast.error(err?.message || 'Return failed') }
        finally { setIsSaving(false) }
    }

    // ── Handle Cancel ──
    const handleCancel = async () => {
        if (!cancelData || !cancelReason.trim()) return toast.error('Please enter a reason')
        setIsSaving(true)
        try {
            const result = await cancelSale(cancelData.id, cancelReason)
            toast.success(`Invoice cancelled — ₹${result.totalCancelled.toLocaleString()} removed, ${result.itemsRestored} item(s) restored`)
            setCancelData(null)
            setCancelReason('')
            if (activeReport === 'sales') handleSelectReport('sales')
        } catch (err: any) { toast.error(err?.message || 'Cancel failed') }
        finally { setIsSaving(false) }
    }

    // ── Open Return Modal ──
    const openReturnModal = (sale: any) => {
        setReturnData(sale)
        const selections: Record<string, number> = {}
        sale.sale_items?.forEach((i: any) => { selections[i.id] = 0 })
        setReturnSelections(selections)
        setReturnReason('')
    }

    const reports = [
        { type: 'sales' as const, name: 'Sales Report', icon: DollarSign, desc: 'Revenue & transaction analysis' },
        { type: 'stock' as const, name: 'Stock Report', icon: Package, desc: 'Inventory levels & valuation' },
        { type: 'trends' as const, name: 'Trend Analysis', icon: TrendingUp, desc: 'Stock movements over time' },
    ]

    const getStatusBadge = (status: string) => {
        const s = STATUS_BADGE[status] || STATUS_BADGE.COMPLETED
        return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>{s.label}</span>
    }

    const canActOn = (sale: any) => {
        const st = sale.status || 'COMPLETED'
        return st !== 'REFUNDED' && st !== 'CANCELLED'
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold heading-luxury">Reports & Analytics</h2>
                        <p className="text-muted-foreground text-sm">Real-time business intelligence from your data.</p>
                    </div>
                    {reportData && canExport && (
                        <div className="flex items-center gap-2">
                            <button onClick={handleExport} className="border border-border px-4 py-2 rounded-xl flex items-center gap-2 text-sm hover:bg-secondary transition-all">
                                <Download className="w-4 h-4" /> Export Excel
                            </button>
                            <button onClick={handleWordExport} className="gold-gradient text-black px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-semibold hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all">
                                <FileText className="w-4 h-4" /> Download Word
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {reports.map((report) => (
                        <button key={report.type} onClick={() => handleSelectReport(report.type)}
                            className={`glass-card rounded-2xl p-6 text-left transition-all group ${activeReport === report.type ? 'border-gold/30 bg-gold/5' : 'hover:border-gold/20'}`}>
                            <div className="w-14 h-14 rounded-xl bg-gold/10 flex items-center justify-center mb-4">
                                <report.icon className="w-7 h-7 text-gold group-hover:scale-110 transition-transform" />
                            </div>
                            <h3 className="font-semibold mb-1">{report.name}</h3>
                            <p className="text-sm text-muted-foreground">{report.desc}</p>
                        </button>
                    ))}
                </div>

                {/* Report Content */}
                <div className="glass-card rounded-2xl overflow-hidden">
                    {isLoading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="w-12 h-12 text-gold mx-auto mb-4 animate-spin" />
                            <p className="text-muted-foreground">Generating report...</p>
                        </div>
                    ) : !reportData ? (
                        <div className="p-12 text-center">
                            <BarChart3 className="w-16 h-16 text-gold/30 mx-auto mb-4" />
                            <p className="text-muted-foreground">Select a report type above to generate.</p>
                        </div>
                    ) : activeReport === 'sales' ? (
                        <>
                            {/* Sales Summary — 5 cards */}
                            <div className="grid grid-cols-2 md:grid-cols-5 border-b border-border/30">
                                <div className="p-5 border-r border-border/30">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Revenue</p>
                                    <p className="text-xl font-bold text-gold mt-1">₹{reportData.totalRevenue.toLocaleString()}</p>
                                </div>
                                <div className="p-5 border-r border-border/30">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Transactions</p>
                                    <p className="text-xl font-bold mt-1">{reportData.totalSales}</p>
                                </div>
                                <div className="p-5 border-r border-border/30">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Items Sold</p>
                                    <p className="text-xl font-bold mt-1">{reportData.totalItems}</p>
                                </div>
                                <div className="p-5 border-r border-border/30">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Payment Split</p>
                                    <div className="mt-1 space-y-0.5">
                                        {Object.entries(reportData.byPayment).map(([method, amt]: [string, any]) => (
                                            <div key={method} className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">{method}</span>
                                                <span>₹{amt.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-5">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Refunded</p>
                                    <p className="text-xl font-bold text-red-400 mt-1">₹{(reportData.refundedAmount ?? 0).toLocaleString()}</p>
                                    <p className="text-xs text-muted-foreground">{reportData.refundedCount ?? 0} sale(s)</p>
                                </div>
                            </div>
                            {/* Sales Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px]">
                                    <thead><tr className="border-b border-border/30">
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-3">Date</th>
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-3">Customer</th>
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-3">Items</th>
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-3">Payment</th>
                                        <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-3">Status</th>
                                        <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-3">Total</th>
                                        {isSuperAdmin && <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-3">Actions</th>}
                                    </tr></thead>
                                    <tbody>
                                        {reportData.sales.length === 0 ? (
                                            <tr><td colSpan={isSuperAdmin ? 7 : 6} className="text-center py-8 text-muted-foreground">No sales recorded yet.</td></tr>
                                        ) : reportData.sales.map((s: any) => (
                                            <tr key={s.id} className="border-b border-border/10 hover:bg-secondary/30">
                                                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</td>
                                                <td className="px-3 py-3 text-sm">{s.customer_name || 'Walk-in'}</td>
                                                <td className="px-3 py-3 text-sm">{s.sale_items?.reduce((sum: number, si: any) => sum + (si.quantity ?? 0), 0) ?? 0}</td>
                                                <td className="px-3 py-3"><span className="text-xs bg-gold/10 text-gold px-2 py-1 rounded-lg">{s.payment_method}</span></td>
                                                <td className="px-3 py-3 text-center">{getStatusBadge(s.status || 'COMPLETED')}</td>
                                                <td className="px-3 py-3 text-right text-sm font-medium text-gold">₹{Number(s.total_amount).toLocaleString()}</td>
                                                {isSuperAdmin && (
                                                    <td className="px-3 py-3">
                                                        {canActOn(s) ? (
                                                            <div className="flex items-center justify-center gap-0.5">
                                                                <button onClick={() => { setRefundData(s); setRefundForm({ reason: '', method: s.payment_method || 'CASH' }) }}
                                                                    className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all" title="Refund">
                                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                                </button>
                                                                {(s.status || 'COMPLETED') !== 'PARTIAL_RETURN' || s.sale_items?.length > 0 ? (
                                                                    <button onClick={() => openReturnModal(s)}
                                                                        className="p-1 rounded-lg hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 transition-all" title="Return Items">
                                                                        <Undo2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                ) : null}
                                                                <button onClick={() => { setCancelData(s); setCancelReason('') }}
                                                                    className="p-1 rounded-lg hover:bg-zinc-500/10 text-muted-foreground hover:text-zinc-400 transition-all" title="Cancel Invoice">
                                                                    <XCircle className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => openEditModal(s)}
                                                                    className="p-1 rounded-lg hover:bg-gold/10 text-muted-foreground hover:text-gold transition-all" title="Edit">
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground">—</span>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : activeReport === 'stock' ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 border-b border-border/30">
                                <div className="p-6 border-r border-border/30">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Units</p>
                                    <p className="text-2xl font-bold mt-1">{reportData.totalStock.toLocaleString()}</p>
                                </div>
                                <div className="p-6 border-r border-border/30">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Value</p>
                                    <p className="text-2xl font-bold text-gold mt-1">₹{reportData.totalValue.toLocaleString()}</p>
                                </div>
                                <div className="p-6 border-r border-border/30">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Low Stock</p>
                                    <p className="text-2xl font-bold text-amber-400 mt-1">{reportData.lowStockCount}</p>
                                </div>
                                <div className="p-6">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Out of Stock</p>
                                    <p className="text-2xl font-bold text-red-400 mt-1">{reportData.outOfStockCount}</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[500px]">
                                    <thead><tr className="border-b border-border/30">
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-6 py-3">Product</th>
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-3">Branch</th>
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-3">SKU</th>
                                        <th className="text-center text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-3">Stock</th>
                                        <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground px-6 py-3">Value</th>
                                    </tr></thead>
                                    <tbody>
                                        {reportData.items.map((i: any, idx: number) => (
                                            <tr key={idx} className="border-b border-border/10 hover:bg-secondary/30">
                                                <td className="px-6 py-3 text-sm font-medium">{i.product?.name ?? '—'}</td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">{i.branch?.name ?? '—'}</td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground">{i.sku}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-xs px-2 py-1 rounded-lg ${i.stock_count <= 0 ? 'bg-red-500/10 text-red-400' : i.stock_count < (i.min_stock_level ?? 5) ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                        {i.stock_count}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-right text-sm text-gold">₹{(i.stock_count * Number(i.selling_price ?? 0)).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : activeReport === 'trends' ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-border/30">
                                <div className="p-6 border-r border-border/30">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Movements</p>
                                    <p className="text-2xl font-bold mt-1">{reportData.totalMovements}</p>
                                </div>
                                <div className="p-6 border-r border-border/30">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Stock Added</p>
                                    <p className="text-2xl font-bold text-emerald-400 mt-1">{reportData.adds}</p>
                                </div>
                                <div className="p-6">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Stock Removed</p>
                                    <p className="text-2xl font-bold text-red-400 mt-1">{reportData.removes}</p>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[500px]">
                                    <thead><tr className="border-b border-border/30">
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-6 py-3">Date</th>
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-3">Product</th>
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-3">Action</th>
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-3">Change</th>
                                        <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-3">Reason</th>
                                    </tr></thead>
                                    <tbody>
                                        {reportData.entries.map((e: any, idx: number) => (
                                            <tr key={idx} className="border-b border-border/10 hover:bg-secondary/30">
                                                <td className="px-6 py-3 text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 text-sm">{e.product?.name ?? '—'}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs px-2 py-1 rounded-lg ${e.action_type === 'ADD' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{e.action_type}</span>
                                                </td>
                                                <td className="px-4 py-3 text-sm">{e.old_count} → {e.new_count}</td>
                                                <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]">{e.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>

            {/* ═══════════ MODALS ═══════════ */}

            {/* ── Edit Sale Modal ── */}
            {editSale && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setEditSale(null)}>
                    <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><Pencil className="w-5 h-5 text-gold" /> Edit Transaction</h3>
                            <button onClick={() => setEditSale(null)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Customer Name</label>
                                <input value={editForm.customer_name} onChange={e => setEditForm(f => ({ ...f, customer_name: e.target.value }))} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm" placeholder="Walk-in" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Discount %</label>
                                    <input type="number" min={0} max={100} value={editForm.discount_percent} onChange={e => setEditForm(f => ({ ...f, discount_percent: Number(e.target.value) }))} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">GST/Tax %</label>
                                    <input type="number" min={0} max={100} value={editForm.tax_percent} onChange={e => setEditForm(f => ({ ...f, tax_percent: Number(e.target.value) }))} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Payment Method</label>
                                <select value={editForm.payment_method} onChange={e => setEditForm(f => ({ ...f, payment_method: e.target.value }))} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm">
                                    <option value="CASH">Cash</option><option value="CARD">Card</option><option value="UPI">UPI</option>
                                </select>
                            </div>
                            <div className="flex justify-between items-center pt-2 border-t border-border/30">
                                <span className="text-sm text-muted-foreground">Current Total</span>
                                <span className="text-lg font-bold text-gold">₹{Number(editSale.total_amount).toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setEditSale(null)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-secondary transition-all">Cancel</button>
                            <button onClick={handleEditSave} disabled={isSaving} className="flex-1 gold-gradient text-black px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} Update
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Refund Modal ── */}
            {refundData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setRefundData(null)}>
                    <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><RotateCcw className="w-5 h-5 text-red-400" /> Process Refund</h3>
                            <button onClick={() => setRefundData(null)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                                <p className="text-sm font-medium">Full refund of ₹{Number(refundData.total_amount).toLocaleString()}</p>
                                <p className="text-xs text-muted-foreground mt-1">All {refundData.sale_items?.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0) ?? 0} item(s) will be restored to inventory</p>
                            </div>
                            {refundData.sale_items?.length > 0 && (
                                <div className="border border-border/30 rounded-xl p-3">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Items to Restore</p>
                                    {refundData.sale_items.map((item: any, i: number) => (
                                        <div key={i} className="flex justify-between text-xs py-1">
                                            <span>{item.name}</span>
                                            <span className="text-emerald-400">+{item.quantity} units</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Refund Method</label>
                                <select value={refundForm.method} onChange={e => setRefundForm(f => ({ ...f, method: e.target.value }))} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm">
                                    <option value="CASH">Cash</option><option value="CARD">Card</option><option value="UPI">UPI</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Reason <span className="text-red-400">*</span></label>
                                <textarea value={refundForm.reason} onChange={e => setRefundForm(f => ({ ...f, reason: e.target.value }))} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm h-20 resize-none" placeholder="Customer returned all items..." />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setRefundData(null)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-secondary transition-all">Cancel</button>
                            <button onClick={handleRefund} disabled={isSaving || !refundForm.reason.trim()} className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-red-700 transition-all">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Process Refund
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Return Items Modal ── */}
            {returnData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setReturnData(null)}>
                    <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><Undo2 className="w-5 h-5 text-amber-400" /> Return Items</h3>
                            <button onClick={() => setReturnData(null)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <p className="text-xs text-muted-foreground">Select items and quantities to return:</p>
                            {returnData.sale_items?.map((item: any) => (
                                <div key={item.id} className="border border-border/30 rounded-xl p-3 flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{item.name}</p>
                                        <p className="text-xs text-muted-foreground">{item.quantity} × ₹{Number(item.unit_price).toLocaleString()}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] text-muted-foreground">Return:</label>
                                        <select value={returnSelections[item.id] || 0}
                                            onChange={e => setReturnSelections(s => ({ ...s, [item.id]: Number(e.target.value) }))}
                                            className="bg-secondary/50 border border-border rounded-lg px-2 py-1 text-sm w-16">
                                            {Array.from({ length: item.quantity + 1 }, (_, i) => (
                                                <option key={i} value={i}>{i}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                            <div>
                                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Return Reason <span className="text-red-400">*</span></label>
                                <textarea value={returnReason} onChange={e => setReturnReason(e.target.value)} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm h-20 resize-none" placeholder="Defective item, wrong size..." />
                            </div>
                            {Object.values(returnSelections).some(q => q > 0) && (
                                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                                    <p className="text-xs font-medium text-amber-400">
                                        Returning {Object.values(returnSelections).reduce((s, q) => s + q, 0)} item(s)
                                    </p>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setReturnData(null)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-secondary transition-all">Cancel</button>
                            <button onClick={handleReturn} disabled={isSaving || !returnReason.trim() || !Object.values(returnSelections).some(q => q > 0)}
                                className="flex-1 bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-amber-700 transition-all">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />} Process Return
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Cancel Invoice Modal ── */}
            {cancelData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCancelData(null)}>
                    <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-semibold flex items-center gap-2"><XCircle className="w-5 h-5 text-zinc-400" /> Cancel Invoice</h3>
                            <button onClick={() => setCancelData(null)} className="p-1 rounded-lg hover:bg-secondary"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-3">
                            <div className="bg-zinc-500/5 border border-zinc-500/20 rounded-xl p-4 space-y-2">
                                <p className="text-sm font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> This will cancel the entire invoice</p>
                                <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
                                    <li>Restore {cancelData.sale_items?.reduce((s: number, i: any) => s + (i.quantity ?? 0), 0) ?? 0} item(s) to inventory</li>
                                    <li>Remove ₹{Number(cancelData.total_amount).toLocaleString()} from revenue</li>
                                    <li>Mark invoice as CANCELLED</li>
                                    <li>Log action in audit trail</li>
                                </ul>
                            </div>
                            {cancelData.sale_items?.length > 0 && (
                                <div className="border border-border/30 rounded-xl p-3">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Items to Restore</p>
                                    {cancelData.sale_items.map((item: any, i: number) => (
                                        <div key={i} className="flex justify-between text-xs py-1">
                                            <span>{item.name}</span>
                                            <span className="text-emerald-400">+{item.quantity} units</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Cancellation Reason <span className="text-red-400">*</span></label>
                                <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm h-20 resize-none" placeholder="Duplicate invoice, customer cancelled..." />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-5">
                            <button onClick={() => setCancelData(null)} className="flex-1 px-4 py-2.5 border border-border rounded-xl text-sm hover:bg-secondary transition-all">Keep Invoice</button>
                            <button onClick={handleCancel} disabled={isSaving || !cancelReason.trim()} className="flex-1 bg-zinc-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-zinc-800 transition-all">
                                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Cancel Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
