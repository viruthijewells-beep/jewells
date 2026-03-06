import { useState } from 'react'
import { motion } from 'motion/react'
import { ShieldCheck, Search, Loader2 } from 'lucide-react'
import { useAuditLogs, usePageTitle } from '@/hooks'

export default function Audit() {
    usePageTitle('Audit Logs');
    const [cursor, setCursor] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [action, setAction] = useState('all')
    const { data, isLoading } = useAuditLogs(cursor, search, action)
    const logs = data?.logs ?? []

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold heading-luxury">Audit Logs</h2>
                <p className="text-muted-foreground text-sm">Complete system activity trail.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setCursor(null) }}
                        placeholder="Search logs..."
                        className="w-full pl-10 pr-4 py-3 bg-secondary/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gold/30"
                    />
                </div>
                <select value={action} onChange={(e) => { setAction(e.target.value); setCursor(null) }} className="bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm">
                    <option value="all">All Actions</option>
                    <option value="CREATE">Create</option>
                    <option value="UPDATE">Update</option>
                    <option value="DELETE">Delete</option>
                    <option value="STOCK_UPDATE">Stock Update</option>
                    <option value="SALE">Sale</option>
                    <option value="TRANSFER">Transfer</option>
                </select>
            </div>

            <div className="glass-card rounded-2xl overflow-x-auto">
                <table className="w-full min-w-[600px]">
                    <thead>
                        <tr className="border-b border-border/30">
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-6 py-4">Action</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Details</th>
                            <th className="text-left text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">User</th>
                            <th className="text-right text-[10px] uppercase tracking-wider text-muted-foreground px-4 py-4">Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={4} className="text-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gold mx-auto" /></td></tr>
                        ) : logs.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No audit logs found</td></tr>
                        ) : (
                            logs.map((log: any) => (
                                <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-border/10 hover:bg-secondary/30">
                                    <td className="px-6 py-4">
                                        <span className="text-xs bg-gold/10 text-gold px-3 py-1 rounded-lg">{log.action}</span>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-muted-foreground max-w-[300px] truncate">{log.details}</td>
                                    <td className="px-4 py-4 text-sm">{log.user?.name ?? 'System'}</td>
                                    <td className="px-4 py-4 text-right text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                                </motion.tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {data?.nextCursor && (
                <div className="text-center">
                    <button onClick={() => setCursor(data.nextCursor)} className="text-gold text-sm hover:underline">Load more...</button>
                </div>
            )}
        </div>
    )
}
