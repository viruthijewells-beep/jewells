import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { Diamond, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { ROUTES } from '@/lib/routes'
import { toast } from 'sonner'
import { usePageTitle } from '@/hooks'

export default function Login() {
    usePageTitle('Sign In');
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const { signIn } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)

        try {
            const { error } = await signIn(email, password)

            if (error) {
                toast.error(error)
                setIsLoading(false)
                return
            }

            toast.success('Welcome to Virudti Jewells')
            navigate(ROUTES.DASHBOARD)
        } catch {
            toast.error('Something went wrong. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="login-page">
            {/* ── Animated background layers ── */}
            <div className="login-bg-layer login-bg-1" />
            <div className="login-bg-layer login-bg-2" />
            <div className="login-bg-layer login-bg-3" />

            {/* ── Floating gold particles ── */}
            <div className="login-particles">
                {Array.from({ length: 8 }).map((_, i) => (
                    <span key={i} className="login-particle" style={{
                        '--i': i,
                        '--x': `${12 + Math.random() * 76}%`,
                        '--delay': `${i * 2.5}s`,
                        '--duration': `${18 + Math.random() * 12}s`,
                        '--size': `${2 + Math.random() * 3}px`,
                    } as React.CSSProperties} />
                ))}
            </div>

            {/* ── Login card ── */}
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="login-card-wrapper"
            >
                {/* Glow layer behind card */}
                <div className="login-glow" />

                <div className="login-card">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="login-diamond-icon"
                        >
                            <Diamond className="text-black w-8 h-8" />
                        </motion.div>
                        <motion.h1
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35, duration: 0.5 }}
                            className="text-3xl font-bold heading-luxury mb-2"
                        >
                            VIRUDTI JEWELLS
                        </motion.h1>
                        <motion.p
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="text-muted-foreground/60 text-sm tracking-wider"
                        >
                            Jewells ERP System
                        </motion.p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="login-label">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="login-input"
                                placeholder="admin@virudtijewells.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="login-label">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="login-input pr-12"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-gold/70 transition-colors duration-200"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="login-submit"
                        >
                            <span className="login-submit-shimmer" />
                            <span className="relative z-10 flex items-center justify-center gap-2">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Authenticating...
                                    </>
                                ) : (
                                    'Sign In'
                                )}
                            </span>
                        </button>
                    </form>

                    {/* Footer */}
                    <p className="text-center text-[10px] text-muted-foreground/30 mt-6 tracking-wider">
                        SECURE · ENCRYPTED · ENTERPRISE
                    </p>
                    <a
                        href="/"
                        className="flex items-center justify-center gap-2 mt-4 text-xs text-gold/60 hover:text-gold transition-colors"
                    >
                        <ArrowLeft className="w-3 h-3" />
                        Back to Website
                    </a>
                </div>
            </motion.div>
        </div>
    )
}
