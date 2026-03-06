import { useState } from 'react'
import { Eye, EyeOff, Lock, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '@/lib/routes'

// ─── Password strength calculator ───────────────────────────────
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
    let score = 0
    if (pw.length >= 8) score++
    if (pw.length >= 12) score++
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
    if (/\d/.test(pw)) score++
    if (/[^a-zA-Z0-9]/.test(pw)) score++

    if (score <= 1) return { score, label: 'Weak', color: 'bg-red-500' }
    if (score <= 2) return { score, label: 'Fair', color: 'bg-amber-500' }
    if (score <= 3) return { score, label: 'Good', color: 'bg-yellow-400' }
    if (score <= 4) return { score, label: 'Strong', color: 'bg-emerald-400' }
    return { score, label: 'Very Strong', color: 'bg-emerald-500' }
}

// ─── ChangePassword Component ───────────────────────────────────
export default function ChangePassword({ onClose }: { onClose: () => void }) {
    const { signOut } = useAuth()
    const navigate = useNavigate()

    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)

    const strength = getPasswordStrength(newPassword)

    const validate = (): string | null => {
        if (!currentPassword.trim()) return 'Please enter your current password'
        if (newPassword.length < 8) return 'New password must be at least 8 characters'
        if (!/[a-zA-Z]/.test(newPassword)) return 'Password must contain at least one letter'
        if (!/\d/.test(newPassword)) return 'Password must contain at least one number'
        if (newPassword !== confirmPassword) return 'Passwords do not match'
        if (newPassword === currentPassword) return 'New password must be different from current'
        return null
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        const error = validate()
        if (error) {
            toast.error(error)
            return
        }

        setLoading(true)

        try {
            // Step 1: Verify current password by re-authenticating
            const { data: { user } } = await supabase.auth.getUser()
            if (!user?.email) {
                toast.error('Session expired. Please login again.')
                await signOut()
                navigate(ROUTES.LOGIN)
                return
            }

            // Re-authenticate with current password to verify identity
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: user.email,
                password: currentPassword,
            })

            if (signInError) {
                toast.error('Current password is incorrect')
                setLoading(false)
                return
            }

            // Step 2: Update password via Supabase Auth
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            })

            if (updateError) {
                toast.error(updateError.message || 'Failed to update password')
                setLoading(false)
                return
            }

            // Step 3: Success
            setSuccess(true)
            toast.success('Password updated successfully!')

            // Step 4: Wait, then sign out and redirect to login
            setTimeout(async () => {
                await signOut()
                navigate(ROUTES.LOGIN)
            }, 2000)

        } catch (err: any) {
            toast.error(err.message || 'An unexpected error occurred')
        } finally {
            setLoading(false)
        }
    }

    const inputClass = "w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all"

    // ── Success State ────────────────────────────────────────────
    if (success) {
        return (
            <div className="p-6 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold">Password Changed!</h3>
                <p className="text-sm text-muted-foreground">
                    Your password has been updated successfully.<br />
                    Redirecting to login...
                </p>
                <Loader2 className="w-5 h-5 animate-spin text-gold mx-auto" />
            </div>
        )
    }

    // ── Change Password Form ─────────────────────────────────────
    return (
        <div className="p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-gold" />
                </div>
                <div>
                    <h3 className="font-semibold">Change Password</h3>
                    <p className="text-xs text-muted-foreground">Update your account password</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Current Password */}
                <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Current Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type={showCurrent ? 'text' : 'password'}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            className={inputClass}
                            required
                            autoComplete="current-password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowCurrent(!showCurrent)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                {/* New Password */}
                <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">
                        New Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type={showNew ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            className={inputClass}
                            required
                            autoComplete="new-password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowNew(!showNew)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {/* Strength Indicator */}
                    {newPassword.length > 0 && (
                        <div className="mt-2 space-y-1">
                            <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div
                                        key={i}
                                        className={`h-1 flex-1 rounded-full transition-all ${i <= strength.score ? strength.color : 'bg-secondary'
                                            }`}
                                    />
                                ))}
                            </div>
                            <p className={`text-[10px] ${strength.score <= 2 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {strength.label}
                            </p>
                        </div>
                    )}
                </div>

                {/* Confirm Password */}
                <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">
                        Confirm New Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            className={inputClass}
                            required
                            autoComplete="new-password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm(!showConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                        <p className="text-[10px] text-red-400 mt-1">Passwords do not match</p>
                    )}
                    {confirmPassword.length > 0 && newPassword === confirmPassword && (
                        <p className="text-[10px] text-emerald-400 mt-1">✓ Passwords match</p>
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                        className="flex-1 gold-gradient text-black py-3 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-40 hover:shadow-lg hover:shadow-gold/20 transition-all"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Updating...
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="w-4 h-4" />
                                Update Password
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-6 py-3 border border-border rounded-xl text-sm hover:bg-secondary transition-all disabled:opacity-40"
                    >
                        Cancel
                    </button>
                </div>
            </form>

            {/* Security Note */}
            <p className="text-[10px] text-muted-foreground/60 text-center">
                After changing your password, you will be signed out and need to log in again.
            </p>
        </div>
    )
}
