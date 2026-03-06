import { useState } from 'react'
import { motion } from 'motion/react'
import { Clock, Package, Loader2 } from 'lucide-react'
import { useStockHistory, usePageTitle } from '@/hooks'

export default function History() {
    usePageTitle('Stock History');
    const [cursor, setCursor] = useState<string | null>(null)
    const { data, isLoading } = useStockHistory(cursor, null)

    const history = data?.history ?? []

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold heading-luxury">Stock History</h2>
                <p className="text-muted-foreground text-sm">Complete audit trail of all stock movements.</p>
            </div>

            <div className="glass-card rounded-2xl overflow-x-auto">
                <table className="w-full min-w-[600px]">
                    <thead>
                        <tr className="border-b border-border/30">
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-6 py-4">Product</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Action</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Quantity</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Previous → New</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">User</th>
                            <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={6} className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gold mx-auto" /></td></tr>
                        ) : history.length === 0 ? (
                            <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No history records</td></tr>
                        ) : (
                            history.map((entry: any) => (
                                <motion.tr key={entry.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border/10 hover:bg-secondary/30">
                                    <td className="px-6 py-4 flex items-center gap-3">
                                        <Package className="w-4 h-4 text-gold" />
                                        <span className="text-sm font-medium">{entry.product?.name ?? '—'}</span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <span className={`text-xs px-2 py-1 rounded-lg ${entry.action === 'ADD' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {entry.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-sm">{entry.quantity}</td>
                                    <td className="px-4 py-4 text-sm text-muted-foreground">{entry.previousCount} → {entry.newCount}</td>
                                    <td className="px-4 py-4 text-sm">{entry.user?.name ?? 'System'}</td>
                                    <td className="px-4 py-4 text-right text-xs text-muted-foreground">
                                        {new Date(entry.createdAt).toLocaleDateString()}
                                    </td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {data?.nextCursor && (
                <div className="text-center">
                    <button onClick={() => setCursor(data.nextCursor)} className="text-gold text-sm hover:underline">
                        Load more...
                    </button>
                </div>
            )}
        </div>
    )
}
