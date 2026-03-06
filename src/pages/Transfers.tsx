import { useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeftRight, ArrowRight, Building2, Package, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useBranches, useTransferHistory, usePageTitle } from '@/hooks'
import { useProducts } from '@/hooks'
import { createTransfer } from '@/lib/api/dashboard'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth'

export default function Transfers() {
    usePageTitle('Transfers')
    const { profile } = useAuth()
    const isManager = profile?.role === 'MANAGER'

    const [sourceBranch, setSourceBranch] = useState(isManager && profile?.branchId ? profile.branchId : '')
    const [destBranch, setDestBranch] = useState('')
    const [selectedProduct, setSelectedProduct] = useState('')
    const [quantity, setQuantity] = useState(1)
    const [isTransferring, setIsTransferring] = useState(false)
    const [cursor, setCursor] = useState<string | null>(null)

    const { data: branches = [] } = useBranches()
    const { data: productsData } = useProducts(1, '', '')
    const { data: transferData, isLoading } = useTransferHistory(cursor)
    const queryClient = useQueryClient()

    const handleTransfer = async () => {
        if (!sourceBranch || !destBranch || !selectedProduct || sourceBranch === destBranch) {
            toast.error('Please fill all fields correctly')
            return
        }
        setIsTransferring(true)
        try {
            await createTransfer({ fromBranchId: sourceBranch, toBranchId: destBranch, productId: selectedProduct, quantity })
            queryClient.invalidateQueries({ queryKey: ['transfers'] })
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['stock-history'] })
            toast.success('Transfer completed!')
            setSelectedProduct('')
            setQuantity(1)
        } catch (err: any) {
            toast.error(err?.message || 'Transfer failed')
        } finally {
            setIsTransferring(false)
        }
    }

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold heading-luxury">Stock Transfers</h2>
                <p className="text-muted-foreground text-sm">Transfer inventory between branches.</p>
            </div>

            {/* Transfer Form */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl p-8">
                <h3 className="text-lg font-semibold heading-serif mb-6 flex items-center gap-2">
                    <ArrowLeftRight className="w-5 h-5 text-gold" /> New Transfer
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">
                            {isManager ? 'Your Branch' : 'From Branch'}
                        </label>
                        <select
                            value={sourceBranch}
                            onChange={(e) => setSourceBranch(e.target.value)}
                            disabled={isManager}
                            className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm disabled:opacity-70"
                        >
                            <option value="">Select...</option>
                            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center justify-center"><ArrowRight className="w-6 h-6 text-gold" /></div>
                    <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">To Branch</label>
                        <select value={destBranch} onChange={(e) => setDestBranch(e.target.value)} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm">
                            <option value="">Select...</option>
                            {branches.filter((b: any) => b.id !== sourceBranch).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Product</label>
                        <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm">
                            <option value="">Select...</option>
                            {(productsData?.products ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-2">Quantity</label>
                        <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm" />
                    </div>
                    <button onClick={handleTransfer} disabled={isTransferring} className="gold-gradient text-black px-6 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                        {isTransferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeftRight className="w-4 h-4" />}
                        Transfer
                    </button>
                </div>
            </motion.div>

            {/* Transfer History */}
            <div className="glass-card rounded-2xl overflow-x-auto">
                <div className="p-6 border-b border-border/30">
                    <h3 className="text-lg font-semibold heading-serif">Transfer History</h3>
                </div>
                <table className="w-full min-w-[600px]">
                    <thead>
                        <tr className="border-b border-border/30">
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-6 py-4">Product</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">From</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">To</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Qty</th>
                            <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={5} className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gold mx-auto" /></td></tr>
                        ) : (transferData?.transfers ?? []).length === 0 ? (
                            <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No transfers yet</td></tr>
                        ) : (
                            (transferData?.transfers ?? []).map((t: any) => (
                                <tr key={t.id} className="border-b border-border/10 hover:bg-secondary/30">
                                    <td className="px-6 py-4 text-sm font-medium">{t.product?.name ?? '—'}</td>
                                    <td className="px-4 py-4 text-sm">{t.from_branch?.name ?? '—'}</td>
                                    <td className="px-4 py-4 text-sm">{t.to_branch?.name ?? '—'}</td>
                                    <td className="px-4 py-4 text-sm text-gold">{t.quantity}</td>
                                    <td className="px-4 py-4 text-right text-xs text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
