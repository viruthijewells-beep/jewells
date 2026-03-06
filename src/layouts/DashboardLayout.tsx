import { memo, useState, useRef, useEffect, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '@/lib/auth'
import { useRealtimeMetalRates } from '@/hooks/useMetalRates'
import { ROUTES } from '@/lib/routes'
import {
    LayoutDashboard,
    Package,
    ScanBarcode,
    Clock,
    ArrowLeftRight,
    Monitor,
    ShieldCheck,
    Users,
    BarChart3,
    Settings,
    Diamond,
    LogOut,
    Menu,
    X,
    QrCode,
    Building2,
    Globe,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Nav item definitions (static — defined outside component) ─
const navItems = [
    { name: 'Dashboard', href: ROUTES.DASHBOARD, icon: LayoutDashboard },
    { name: 'Inventory', href: ROUTES.INVENTORY, icon: Package },
    { name: 'Scan Barcode', href: ROUTES.SCAN, icon: ScanBarcode },
    { name: 'Stock History', href: ROUTES.HISTORY, icon: Clock },
    { name: 'Transfers', href: ROUTES.TRANSFERS, icon: ArrowLeftRight },
    { name: 'POS Mode', href: ROUTES.POS, icon: Monitor },
    { name: 'Barcode Vault', href: ROUTES.BARCODES, icon: QrCode },
    { name: 'Audit Logs', href: ROUTES.AUDIT, icon: ShieldCheck, adminOnly: true },
    { name: 'User Management', href: ROUTES.USERS, icon: Users, adminOnly: true },
    { name: 'Branch Management', href: ROUTES.BRANCHES, icon: Building2, adminOnly: true },
    { name: 'Reports', href: ROUTES.REPORTS, icon: BarChart3 },
    { name: 'Settings', href: ROUTES.SETTINGS, icon: Settings },
]

const SCROLL_KEY = 'vj-sidebar-scroll'

// ─────────────────────────────────────────────────────────────────
// Sidebar — memoized so it NEVER re-renders on route changes
// ─────────────────────────────────────────────────────────────────
const Sidebar = memo(function Sidebar({
    role,
    name,
    branchName,
    onLogout,
    isOpen,
    onClose,
}: {
    role: string
    name: string
    branchName: string | null
    onLogout: () => void
    isOpen: boolean
    onClose: () => void
}) {
    const navRef = useRef<HTMLElement>(null)

    // Restore scroll on mount
    useEffect(() => {
        const saved = sessionStorage.getItem(SCROLL_KEY)
        if (saved && navRef.current) navRef.current.scrollTop = parseInt(saved, 10)
    }, [])

    const handleScroll = () => {
        if (navRef.current) sessionStorage.setItem(SCROLL_KEY, String(navRef.current.scrollTop))
    }

    const SidebarContent = (
        <aside
            ref={navRef}
            onScroll={handleScroll}
            className="flex flex-col h-full w-64 bg-[#0A0A0A] border-r border-gold/[0.06] overflow-y-auto overflow-x-hidden"
        >
            {/* Logo */}
            <div className="p-6 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 gold-gradient rounded-xl flex items-center justify-center shadow-lg shadow-gold/20">
                    <Diamond className="text-black w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-xl font-bold heading-luxury">VIRUDTI JEWELLS</h1>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.25em]">
                        Jewells ERP
                    </p>
                </div>
            </div>

            {/* Nav links */}
            <nav className="flex-1 px-4 py-2 space-y-0.5">
                {navItems.map((item) => {
                    if (item.adminOnly && role !== 'ADMIN' && role !== 'SUPER_ADMIN') return null
                    return (
                        <NavLink
                            key={item.name}
                            to={item.href}
                            end={item.href === ROUTES.DASHBOARD}
                            onClick={() => { if (window.innerWidth < 1024) onClose() }}
                            className={({ isActive }) =>
                                `relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 group whitespace-nowrap ${isActive
                                    ? 'bg-gold/10 text-gold'
                                    : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon
                                        className={`w-5 h-5 shrink-0 transition-colors ${isActive ? 'text-gold' : 'group-hover:text-gold'
                                            }`}
                                    />
                                    <span className="font-medium text-sm">{item.name}</span>
                                    {isActive && (
                                        <motion.span
                                            layoutId="sidebar-active-dot"
                                            className="ml-auto w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_8px_rgba(212,175,55,0.8)]"
                                            transition={{ type: 'spring', duration: 0.3 }}
                                        />
                                    )}
                                </>
                            )}
                        </NavLink>
                    )
                })}
            </nav>

            {/* User card + Logout */}
            <div className="p-4 border-t border-border/50 shrink-0">
                <div className="bg-secondary/50 rounded-2xl p-4 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-xs shrink-0">
                            {name.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-semibold truncate">{name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                {role}{branchName ? ` • ${branchName}` : ''}
                            </p>
                        </div>
                    </div>
                </div>
                <a
                    href="/"
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-secondary/30 hover:text-gold transition-all whitespace-nowrap mb-1"
                >
                    <Globe className="w-5 h-5 shrink-0" />
                    <span className="font-medium text-sm">Back to Website</span>
                </a>
                <button
                    onClick={onLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-all whitespace-nowrap"
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span className="font-medium text-sm">Logout</span>
                </button>
            </div>
        </aside>
    )

    return (
        <>
            {/* Desktop sidebar — always visible */}
            <div className="hidden lg:flex h-full">{SidebarContent}</div>

            {/* Mobile sidebar — slide-in drawer */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            key="overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
                        />
                        {/* Drawer */}
                        <motion.div
                            key="drawer"
                            initial={{ x: -256 }}
                            animate={{ x: 0 }}
                            exit={{ x: -256 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                            className="fixed left-0 top-0 h-full z-50 lg:hidden"
                        >
                            {SidebarContent}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
})

// ─────────────────────────────────────────────────────────────────
// DashboardLayout — stable shell, never re-mounts
// ─────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: ReactNode }) {
    const [isMobileOpen, setIsMobileOpen] = useState(false)
    const { profile, signOut } = useAuth()
    const { rates: metalRates, loading: ratesLoading } = useRealtimeMetalRates()
    const navigate = useNavigate()

    const handleLogout = async () => {
        await signOut()
        toast.success('Logged out successfully')
        navigate(ROUTES.LOGIN)
    }

    if (!profile) return null

    return (
        /* Full-screen fixed container — nothing overflows outside it */
        <div className="flex h-screen w-screen overflow-hidden bg-background">

            {/* ── Sidebar (memoized — never re-renders) ─────────── */}
            <Sidebar
                role={profile.role}
                name={profile.name}
                branchName={profile.branchName}
                onLogout={handleLogout}
                isOpen={isMobileOpen}
                onClose={() => setIsMobileOpen(false)}
            />

            {/* ── Right side: header + scrollable content ──────── */}
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

                {/* Topbar */}
                <header className="h-16 shrink-0 border-b border-border bg-[#0D0D0D]/90 backdrop-blur-xl z-30 px-4 flex items-center justify-between">
                    {/* Mobile hamburger */}
                    <button
                        onClick={() => setIsMobileOpen(v => !v)}
                        className="p-2 hover:bg-secondary rounded-lg transition-all lg:hidden"
                        aria-label="Toggle menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    {/* Desktop: empty left side */}
                    <div className="hidden lg:block" />

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-3">
                            <div className="flex flex-col items-end">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Gold (22K)</p>
                                <p className="text-xs font-bold text-yellow-400">
                                    {ratesLoading ? '...' : `₹${metalRates.Gold.toLocaleString('en-IN')}`}
                                </p>
                            </div>
                            <div className="w-px h-6 bg-border/30" />
                            <div className="flex flex-col items-end">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Silver</p>
                                <p className="text-xs font-bold text-slate-300">
                                    {ratesLoading ? '...' : `₹${metalRates.Silver.toLocaleString('en-IN')}`}
                                </p>
                            </div>
                            <div className="w-px h-6 bg-border/30" />
                            <div className="flex flex-col items-end">
                                <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Platinum</p>
                                <p className="text-xs font-bold text-blue-300">
                                    {ratesLoading ? '...' : `₹${metalRates.Platinum.toLocaleString('en-IN')}`}
                                </p>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-border mx-2" />
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-medium">{profile.name}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">
                                    {profile.role}{profile.branchName ? ` • ${profile.branchName}` : ''}
                                </p>
                            </div>
                            <div className="w-10 h-10 rounded-full gold-gradient p-[1px]">
                                <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-gold font-bold">
                                    {profile.name.charAt(0)}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Main content — ONLY this area scrolls */}
                <main className="flex-1 overflow-y-auto">
                    <div className="p-4 md:p-8">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}
