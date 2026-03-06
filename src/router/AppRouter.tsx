import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { ROUTES } from '@/lib/routes'
import { lazy, Suspense, type ReactNode } from 'react'
import { Diamond, Loader2 } from 'lucide-react'
import DashboardLayout from '@/layouts/DashboardLayout'

// Lazy-load all pages for code splitting
const Landing = lazy(() => import('@/pages/Landing'))
const Login = lazy(() => import('@/pages/Login'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Inventory = lazy(() => import('@/pages/Inventory'))
const Scan = lazy(() => import('@/pages/Scan'))
const History = lazy(() => import('@/pages/History'))
const Transfers = lazy(() => import('@/pages/Transfers'))
const POS = lazy(() => import('@/pages/POS'))
const Audit = lazy(() => import('@/pages/Audit'))
const Users = lazy(() => import('@/pages/Users'))
const Reports = lazy(() => import('@/pages/Reports'))
const Settings = lazy(() => import('@/pages/Settings'))
const BarcodeVault = lazy(() => import('@/pages/BarcodeVault'))
const BranchManagement = lazy(() => import('@/pages/BranchManagement'))

// ─── Loading Spinner ─────────────────────────────────────────
function PageLoader() {
    return (
        <div className="flex-1 flex items-center justify-center min-h-[60vh]">
            <div className="relative">
                <Loader2 className="w-12 h-12 text-gold animate-spin" />
                <Diamond className="absolute inset-0 m-auto w-5 h-5 text-gold animate-pulse" />
            </div>
        </div>
    )
}

// ─── Auth Guard (wraps the entire dashboard layout) ──────────
function AuthGuard() {
    const { profile, loading } = useAuth()
    if (loading) return <PageLoader />
    if (!profile) return <Navigate to={ROUTES.LOGIN} replace />
    // Renders DashboardLayout once — Outlet fills the main content
    return (
        <DashboardLayout>
            <Outlet />
        </DashboardLayout>
    )
}

// ─── Admin Guard ─────────────────────────────────────────────
function AdminGuard({ children }: { children: ReactNode }) {
    const { profile, loading } = useAuth()
    if (loading) return <PageLoader />
    const isAdmin = profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN'
    if (!isAdmin) return <Navigate to={ROUTES.DASHBOARD} replace />
    return <>{children}</>
}

// ─── App Router ──────────────────────────────────────────────
export default function AppRouter() {
    return (
        <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    {/* Public */}
                    <Route path={ROUTES.LANDING} element={<Landing />} />
                    <Route path={ROUTES.LOGIN} element={<Login />} />

                    {/* Protected — AuthGuard mounts DashboardLayout ONCE */}
                    <Route element={<AuthGuard />}>
                        <Route path={ROUTES.DASHBOARD} element={<Dashboard />} />
                        <Route path={ROUTES.INVENTORY} element={<Inventory />} />
                        <Route path={ROUTES.SCAN} element={<Scan />} />
                        <Route path={ROUTES.HISTORY} element={<History />} />
                        <Route path={ROUTES.TRANSFERS} element={<Transfers />} />
                        <Route path={ROUTES.POS} element={<POS />} />
                        <Route path={ROUTES.BARCODES} element={<BarcodeVault />} />
                        <Route path={ROUTES.REPORTS} element={<Reports />} />
                        <Route path={ROUTES.SETTINGS} element={<Settings />} />

                        {/* Admin only */}
                        <Route path={ROUTES.AUDIT} element={<AdminGuard><Audit /></AdminGuard>} />
                        <Route path={ROUTES.USERS} element={<AdminGuard><Users /></AdminGuard>} />
                        <Route path={ROUTES.BRANCHES} element={<AdminGuard><BranchManagement /></AdminGuard>} />
                    </Route>

                    {/* 404 */}
                    <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
                </Routes>
            </Suspense>
        </BrowserRouter>
    )
}
