import { useState, useEffect, useMemo } from 'react'
import { Settings as SettingsIcon, Bell, Shield, Palette, Globe, ChevronRight, TrendingUp, BarChart3 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'
import { useGoldRate } from '@/hooks/useGoldRate'
import { fetchGoldRateHistory } from '@/lib/api/goldRate'
import { fetchAllMetalRateRows, updateMetalRate } from '@/lib/api/metalRates'
import { METAL_TYPES, METAL_BADGE_COLORS, METAL_ICON_COLORS, type MetalType } from '@/lib/metalTypes'
import { usePageTitle } from '@/hooks'
import ChangePassword from '@/components/settings/ChangePassword'

const settingsSections = [
    { name: 'Notifications', icon: Bell, desc: 'Configure alerts and notifications', items: ['Email Alerts', 'Low Stock Alerts', 'Transfer Notifications'] },
    { name: 'Security', icon: Shield, desc: 'Password, 2FA, and session management', items: ['Change Password', 'Two-Factor Auth', 'Active Sessions'] },
    { name: 'Appearance', icon: Palette, desc: 'Theme, colors, and display preferences', items: ['Dark Mode', 'Accent Color', 'Compact View'] },
    { name: 'Localization', icon: Globe, desc: 'Language, currency, and timezone', items: ['Language', 'Currency (₹ INR)', 'Timezone (IST)'] },
]

// ─── Gold Rate History Chart (pure SVG) ─────────────────────────
function GoldRateChart({ data }: { data: { rate: number; changed_at: string }[] }) {
    const chartW = 700
    const chartH = 200
    const padL = 60
    const padR = 20
    const padT = 20
    const padB = 40

    const chart = useMemo(() => {
        if (data.length === 0) return null

        const rates = data.map(d => Number(d.rate))
        const minRate = Math.min(...rates) * 0.995
        const maxRate = Math.max(...rates) * 1.005
        const rangeR = maxRate - minRate || 1

        const w = chartW - padL - padR
        const h = chartH - padT - padB

        const points = data.map((d, i) => {
            const x = padL + (i / Math.max(data.length - 1, 1)) * w
            const y = padT + h - ((Number(d.rate) - minRate) / rangeR) * h
            return { x, y, rate: Number(d.rate), date: d.changed_at }
        })

        // SVG path for the line
        const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

        // SVG area fill
        const areaPath = `${linePath} L${points[points.length - 1].x},${padT + h} L${points[0].x},${padT + h} Z`

        // Y-axis labels (5 ticks)
        const yTicks = Array.from({ length: 5 }, (_, i) => {
            const val = minRate + (rangeR * i) / 4
            const y = padT + h - (i / 4) * h
            return { val, y }
        })

        return { points, linePath, areaPath, yTicks, minRate, maxRate }
    }, [data])

    if (!chart || data.length < 2) {
        return (
            <div className="flex items-center justify-center h-48 text-muted-foreground/40 text-sm">
                Not enough data to display chart. Update the gold rate a few times to see trends.
            </div>
        )
    }

    return (
        <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
            {/* Gold gradient definition */}
            <defs>
                <linearGradient id="goldAreaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(212,175,55,0.3)" />
                    <stop offset="100%" stopColor="rgba(212,175,55,0)" />
                </linearGradient>
                <linearGradient id="goldLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#B8962E" />
                    <stop offset="50%" stopColor="#D4AF37" />
                    <stop offset="100%" stopColor="#F0D060" />
                </linearGradient>
            </defs>

            {/* Grid lines */}
            {chart.yTicks.map((tick, i) => (
                <g key={i}>
                    <line
                        x1={padL} y1={tick.y} x2={chartW - padR} y2={tick.y}
                        stroke="rgba(255,255,255,0.04)" strokeWidth="1"
                    />
                    <text
                        x={padL - 8} y={tick.y + 4}
                        fill="rgba(255,255,255,0.3)" fontSize="10" textAnchor="end"
                        fontFamily="monospace"
                    >
                        ₹{tick.val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </text>
                </g>
            ))}

            {/* Area fill */}
            <path d={chart.areaPath} fill="url(#goldAreaFill)" />

            {/* Line */}
            <path d={chart.linePath} fill="none" stroke="url(#goldLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {/* Data points */}
            {chart.points.map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="#0A0A0A" stroke="#D4AF37" strokeWidth="2" />
                    {/* Date label on x-axis for first, middle, last */}
                    {(i === 0 || i === chart.points.length - 1 || i === Math.floor(chart.points.length / 2)) && (
                        <text
                            x={p.x} y={chartH - 8}
                            fill="rgba(255,255,255,0.3)" fontSize="9" textAnchor="middle"
                            fontFamily="monospace"
                        >
                            {new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </text>
                    )}
                </g>
            ))}

            {/* Current rate label at last point */}
            {chart.points.length > 0 && (
                <text
                    x={chart.points[chart.points.length - 1].x}
                    y={chart.points[chart.points.length - 1].y - 12}
                    fill="#D4AF37" fontSize="11" textAnchor="middle" fontWeight="bold"
                    fontFamily="monospace"
                >
                    ₹{chart.points[chart.points.length - 1].rate.toLocaleString('en-IN')}
                </text>
            )}
        </svg>
    )
}

// ─── Settings Page ──────────────────────────────────────────────
export default function Settings() {
    usePageTitle('Settings')
    const { profile } = useAuth()
    const { rate: goldRate, lastUpdatedAt, loading: goldLoading, updateRate } = useGoldRate()
    const [expandedSection, setExpandedSection] = useState<string | null>(null)
    const [rateHistory, setRateHistory] = useState<{ rate: number; changed_at: string }[]>([])
    const [toggles, setToggles] = useState<Record<string, boolean>>({
        'Email Alerts': true,
        'Low Stock Alerts': true,
        'Transfer Notifications': false,
        'Dark Mode': true,
        'Compact View': false,
    })
    const [showChangePassword, setShowChangePassword] = useState(false)

    const isAdmin = profile?.role === 'ADMIN'

    // Fetch history on mount and after rate updates
    useEffect(() => {
        fetchGoldRateHistory(30).then(setRateHistory).catch(console.error)
    }, [goldRate])

    const handleToggle = (item: string) => {
        setToggles(prev => {
            const next = { ...prev, [item]: !prev[item] }
            toast.success(`${item} ${next[item] ? 'enabled' : 'disabled'}`)
            return next
        })
    }

    const handleSectionClick = (name: string) => {
        setExpandedSection(expandedSection === name ? null : name)
    }

    const handleItemClick = (item: string) => {
        if (item === 'Change Password') {
            setShowChangePassword(true)
            return
        }
        if (item in toggles) {
            handleToggle(item)
        } else {
            toast.info(`${item} — settings panel coming soon`)
        }
    }

    // ─── Multi-metal rates ──────────────────────────────────────
    const [metalRates, setMetalRates] = useState<any[]>([])
    const [metalRatesLoading, setMetalRatesLoading] = useState(true)
    const [editingMetal, setEditingMetal] = useState<string | null>(null)
    const [newMetalRate, setNewMetalRate] = useState('')
    const [updatingMetal, setUpdatingMetal] = useState(false)

    // Fetch all metal rates on mount
    useEffect(() => {
        fetchAllMetalRateRows()
            .then(rows => { setMetalRates(rows); setMetalRatesLoading(false) })
            .catch(() => setMetalRatesLoading(false))
    }, [])

    const handleMetalRateUpdate = async (metalType: string) => {
        const parsed = parseFloat(newMetalRate)
        if (isNaN(parsed) || parsed <= 0 || parsed > 9999999) {
            toast.error('Enter a valid rate')
            return
        }
        if (!profile?.id) return

        setUpdatingMetal(true)
        try {
            await updateMetalRate(metalType as MetalType, parsed, profile.id)
            // Optimistic update
            setMetalRates(prev => prev.map(r => r.metal_type === metalType ? { ...r, rate: parsed, last_updated_at: new Date().toISOString() } : r))
            toast.success(`${metalType} rate updated to ₹${parsed.toLocaleString('en-IN')}`)
            setNewMetalRate('')
            setEditingMetal(null)
        } catch (err: any) {
            toast.error(err.message || `Failed to update ${metalType} rate`)
        } finally {
            setUpdatingMetal(false)
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold heading-luxury">Settings</h2>
                <p className="text-muted-foreground text-sm">System configuration and preferences.</p>
            </div>

            {/* ═══ Multi-Metal Rate Control ═══ */}
            <div className="glass-card rounded-2xl p-8">
                <h3 className="text-lg font-semibold heading-serif mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-gold" /> Metal Rate Control
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {metalRatesLoading ? (
                        <p className="text-muted-foreground text-sm col-span-3 text-center py-8">Loading rates...</p>
                    ) : (
                        METAL_TYPES.map(metal => {
                            const row = metalRates.find((r: any) => r.metal_type === metal)
                            const rate = Number(row?.rate ?? 0)
                            const badgeClass = METAL_BADGE_COLORS[metal]
                            return (
                                <div key={metal} className={`rounded-2xl border p-5 space-y-3 ${badgeClass}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-bold uppercase tracking-wider">{metal}</span>
                                        <span className="text-[10px] opacity-60">per gram</span>
                                    </div>
                                    <p className="text-2xl font-bold">
                                        ₹{rate.toLocaleString('en-IN')}
                                    </p>
                                    {row?.last_updated_at && (
                                        <p className="text-[10px] opacity-60">
                                            Updated: {new Date(row.last_updated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                                        </p>
                                    )}
                                    {isAdmin && editingMetal === metal ? (
                                        <div className="flex gap-2 pt-1">
                                            <input
                                                type="number"
                                                value={newMetalRate}
                                                onChange={e => setNewMetalRate(e.target.value)}
                                                placeholder={rate.toString()}
                                                className="flex-1 bg-white/[0.06] border border-white/[0.1] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold/40"
                                                autoFocus
                                            />
                                            <button
                                                onClick={() => handleMetalRateUpdate(metal)}
                                                disabled={updatingMetal || !newMetalRate}
                                                className="px-4 py-2 gold-gradient text-black font-semibold text-xs rounded-lg disabled:opacity-40"
                                            >
                                                {updatingMetal ? '...' : 'Save'}
                                            </button>
                                            <button
                                                onClick={() => { setEditingMetal(null); setNewMetalRate('') }}
                                                className="px-3 py-2 text-xs border border-white/10 rounded-lg hover:bg-white/5"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : isAdmin ? (
                                        <button
                                            onClick={() => { setEditingMetal(metal); setNewMetalRate('') }}
                                            className="text-xs opacity-70 hover:opacity-100 transition-opacity"
                                        >
                                            Edit Rate →
                                        </button>
                                    ) : null}
                                </div>
                            )
                        })
                    )}
                </div>

                {!isAdmin && (
                    <p className="text-xs text-muted-foreground/60 italic mt-4">
                        Only administrators can update metal rates.
                    </p>
                )}
            </div>

            {/* ═══ Gold Rate History Chart ═══ */}
            <div className="glass-card rounded-2xl p-8">
                <h3 className="text-lg font-semibold heading-serif mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-gold" /> Rate History
                </h3>
                <GoldRateChart data={rateHistory} />
            </div>

            {/* Profile Card */}
            <div className="glass-card rounded-2xl p-8">
                <h3 className="text-lg font-semibold heading-serif mb-6 flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-gold" /> Profile
                </h3>
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full gold-gradient p-[2px]">
                        <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-gold font-bold text-2xl">
                            {profile?.name?.charAt(0) ?? '?'}
                        </div>
                    </div>
                    <div>
                        <p className="text-xl font-semibold">{profile?.name}</p>
                        <p className="text-sm text-muted-foreground">{profile?.email}</p>
                        <span className="inline-block mt-2 text-xs bg-gold/10 text-gold px-3 py-1 rounded-lg">{profile?.role}</span>
                    </div>
                </div>
            </div>

            {/* Settings sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {settingsSections.map((section) => (
                    <div key={section.name} className="glass-card rounded-2xl overflow-hidden">
                        <button
                            onClick={() => handleSectionClick(section.name)}
                            className={`w-full p-6 text-left transition-all group flex items-start gap-4 ${expandedSection === section.name ? 'bg-gold/5' : 'hover:bg-secondary/30'
                                }`}
                        >
                            <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                                <section.icon className="w-6 h-6 text-gold group-hover:scale-110 transition-transform" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold">{section.name}</h3>
                                <p className="text-sm text-muted-foreground">{section.desc}</p>
                            </div>
                            <ChevronRight className={`w-5 h-5 text-muted-foreground shrink-0 mt-1 transition-transform ${expandedSection === section.name ? 'rotate-90' : ''}`} />
                        </button>

                        {expandedSection === section.name && (
                            <div className="border-t border-border/30 divide-y divide-border/20">
                                {section.items.map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => handleItemClick(item)}
                                        className="w-full px-6 py-3 flex items-center justify-between text-sm hover:bg-secondary/20 transition-all"
                                    >
                                        <span>{item}</span>
                                        {item in toggles ? (
                                            <div className={`w-9 h-5 rounded-full transition-all flex items-center px-0.5 ${toggles[item] ? 'bg-gold' : 'bg-muted'}`}>
                                                <div className={`w-4 h-4 rounded-full bg-black transition-transform ${toggles[item] ? 'translate-x-4' : ''}`} />
                                            </div>
                                        ) : (
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Change Password Panel (inline) */}
                        {section.name === 'Security' && expandedSection === 'Security' && showChangePassword && (
                            <div className="border-t border-gold/10 bg-secondary/5">
                                <ChangePassword onClose={() => setShowChangePassword(false)} />
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
