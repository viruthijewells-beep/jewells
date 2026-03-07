import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import {
    Package, TrendingUp, AlertCircle, FolderOpen, ScanBarcode,
    ArrowLeftRight, BarChart3, Clock, Plus, Diamond,
} from 'lucide-react'
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useDashboardStats, usePageTitle } from '@/hooks'
import { ROUTES } from '@/lib/routes'

// Distinct gold palette for clear differentiation between segments
const GOLD_COLORS = ['#D4AF37', '#F5D67A', '#E8B923', '#CBA135', '#FFD700', '#B8860B']

const quickActions = [
    { name: 'Scan Item', icon: ScanBarcode, href: ROUTES.SCAN, color: 'from-emerald-500/10 to-transparent' },
    { name: 'Transfer', icon: ArrowLeftRight, href: ROUTES.TRANSFERS, color: 'from-blue-500/10 to-transparent' },
    { name: 'Inventory', icon: Package, href: ROUTES.INVENTORY, color: 'from-purple-500/10 to-transparent' },
    { name: 'Stock History', icon: Clock, href: ROUTES.HISTORY, color: 'from-amber-500/10 to-transparent' },
]

export default function Dashboard() {
    usePageTitle('Dashboard')
    const { data: stats, isLoading } = useDashboardStats()

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold heading-luxury">Executive Overview</h2>
                    <p className="text-muted-foreground text-sm">
                        Your jewelry empire at a glance.
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link
                        to={ROUTES.INVENTORY}
                        className="gold-gradient text-black px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-gold/20 transition-all"
                    >
                        <Plus className="w-4 h-4" /> Add Product
                    </Link>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: 'TOTAL PRODUCTS',
                        value: stats?.totalProducts ?? 0,
                        sub: 'Across branches',
                        icon: Package,
                        change: '+12%',
                    },
                    {
                        label: 'TOTAL STOCK',
                        value: stats?.totalStock ?? 0,
                        sub: 'Units in inventory',
                        icon: TrendingUp,
                        change: '+5%',
                    },
                    {
                        label: 'LOW STOCK',
                        value: stats?.lowStockCount ?? 0,
                        sub: 'Need attention',
                        icon: AlertCircle,
                        changeColor: 'text-red-400',
                    },
                    {
                        label: 'CATEGORIES',
                        value: stats?.totalCategories ?? 0,
                        sub: 'Active collections',
                        icon: FolderOpen,
                        change: `${stats?.totalCategories ?? 0} types`,
                    },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="glass-card rounded-2xl p-6 relative overflow-hidden group"
                    >
                        <div className="flex items-start justify-between mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
                                <stat.icon className="w-6 h-6 text-gold" />
                            </div>
                            {stat.change && (
                                <span
                                    className={`text-xs font-medium px-2 py-1 rounded-lg ${stat.changeColor || 'bg-emerald-500/10 text-emerald-400'
                                        }`}
                                >
                                    {stat.change}
                                </span>
                            )}
                        </div>
                        <p className="text-3xl font-bold heading-luxury">{isLoading ? '—' : stat.value}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
                            {stat.label}
                        </p>
                        <p className="text-xs text-muted-foreground/60 mt-1">{stat.sub}</p>
                    </motion.div>
                ))}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {quickActions.map((action) => (
                    <Link
                        key={action.name}
                        to={action.href}
                        className="glass-card rounded-2xl p-6 text-center hover:border-gold/20 transition-all group"
                    >
                        <div
                            className={`w-14 h-14 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mx-auto mb-3`}
                        >
                            <action.icon className="w-7 h-7 text-foreground group-hover:text-gold transition-colors" />
                        </div>
                        <p className="text-sm font-medium uppercase tracking-wider">{action.name}</p>
                    </Link>
                ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stock Trends */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-2xl p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold heading-serif flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-gold" /> Stock Trends
                        </h3>
                    </div>
                    <div className="h-[300px] w-full min-w-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats?.stockTrends || []}>
                                <defs>
                                    <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.2} />
                                        <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(212,175,55,0.06)" vertical={false} />
                                <XAxis dataKey="date" stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis stroke="#525252" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(15,15,15,0.97)',
                                        border: '1px solid rgba(212,175,55,0.35)',
                                        borderRadius: '10px',
                                        padding: '8px 14px',
                                    }}
                                    labelStyle={{ color: '#F5D67A', fontWeight: 600, fontSize: '13px' }}
                                    itemStyle={{ color: '#F5D67A', fontSize: '13px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#D4AF37"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorStock)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Categories — Luxury Readable Panel */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="glass-card rounded-2xl p-6"
                >
                    {/* Section Header */}
                    <div className="mb-4">
                        <h3
                            className="text-xl font-semibold flex items-center gap-2"
                            style={{ color: '#F5D67A', letterSpacing: '0.4px' }}
                        >
                            <Diamond className="w-5 h-5" style={{ color: '#D4AF37' }} />
                            Categories
                        </h3>
                        <p className="text-sm mt-1" style={{ color: '#BFA15B' }}>
                            {(stats?.categoryBreakdown || []).length} Product Types
                        </p>
                    </div>

                    {/* Donut Chart */}
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats?.categoryBreakdown || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={4}
                                    dataKey="count"
                                    nameKey="name"
                                >
                                    {(stats?.categoryBreakdown || []).map((_: any, index: number) => (
                                        <Cell
                                            key={index}
                                            fill={GOLD_COLORS[index % GOLD_COLORS.length]}
                                            stroke="transparent"
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(15,15,15,0.97)',
                                        border: '1px solid rgba(212,175,55,0.35)',
                                        borderRadius: '10px',
                                        padding: '8px 14px',
                                    }}
                                    labelStyle={{ color: '#F5D67A', fontWeight: 600, fontSize: '13px' }}
                                    itemStyle={{ color: '#F5D67A', fontSize: '13px' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Legend — clearly readable */}
                    <div className="mt-4 space-y-2.5">
                        {(stats?.categoryBreakdown || []).map((cat: any, index: number) => (
                            <div key={cat.name} className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: GOLD_COLORS[index % GOLD_COLORS.length] }}
                                    />
                                    <span
                                        className="text-sm font-medium truncate"
                                        style={{ color: '#E6C36A', letterSpacing: '0.3px' }}
                                    >
                                        {cat.name}
                                    </span>
                                </div>
                                <span
                                    className="text-sm font-semibold shrink-0 tabular-nums"
                                    style={{ color: '#F5D67A' }}
                                >
                                    {cat.count} {cat.count === 1 ? 'item' : 'items'}
                                </span>
                            </div>
                        ))}
                        {(!stats?.categoryBreakdown || stats.categoryBreakdown.length === 0) && (
                            <p className="text-sm text-center py-4" style={{ color: '#BFA15B' }}>
                                No categories yet
                            </p>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Recent Activity */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass-card rounded-2xl p-6"
            >
                <h3 className="text-lg font-semibold heading-serif mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gold" /> Recent Activity
                </h3>
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                    {(stats?.recentActivity || []).slice(0, 8).map((activity: any, i: number) => (
                        <div key={i} className="py-3 border-b border-border/30 last:border-0">
                            <div className="flex items-start justify-between gap-3 min-w-0">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-gold uppercase tracking-wider truncate">
                                        {activity.action?.replace(/_/g, ' ')}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5 break-words line-clamp-2">
                                        {activity.details}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-[10px] text-muted-foreground/60">
                                        {activity.user?.name || 'System'}
                                    </p>
                                    {activity.createdAt && (
                                        <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                                            {new Date(activity.createdAt).toLocaleTimeString('en-IN', {
                                                hour: '2-digit', minute: '2-digit',
                                            })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    {(!stats?.recentActivity || stats.recentActivity.length === 0) && (
                        <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                    )}
                </div>
            </motion.div>
        </div>
    )
}
