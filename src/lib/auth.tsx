import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

export interface UserProfile {
    id: string
    email: string
    name: string
    role: string
    branchId: string | null
    branchName: string | null
}

interface AuthContextType {
    profile: UserProfile | null
    loading: boolean
    signIn: (email: string, password: string) => Promise<{ error: string | null; profile?: UserProfile }>
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const PROFILE_CACHE_KEY = 'virudti_profile_cache'

export function AuthProvider({ children }: { children: ReactNode }) {
    const [profile, setProfile] = useState<UserProfile | null>(() => {
        // Instantly restore cached profile on mount (zero latency)
        try {
            const cached = localStorage.getItem(PROFILE_CACHE_KEY)
            return cached ? JSON.parse(cached) : null
        } catch { return null }
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Quick session check — if we have a cached profile, don't block
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) {
                // Refresh profile in background (non-blocking if cached)
                fetchAndSetProfile(session.user)
            } else {
                setProfile(null)
                localStorage.removeItem(PROFILE_CACHE_KEY)
                setLoading(false)
            }
        })

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                // Don't block — profile will be set by signIn() directly
                fetchAndSetProfile(session.user)
            } else if (event === 'SIGNED_OUT') {
                setProfile(null)
                localStorage.removeItem(PROFILE_CACHE_KEY)
            }
        })

        return () => subscription.unsubscribe()
    }, [])

    const fetchAndSetProfile = async (authData: any) => {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('id, email, name, role:roles(name), branch_id, branch:branches(name)')
                .eq('id', authData.id)
                .single()

            if (error) {
                console.error("Profile fetch error:", error)
                // Don't clear profile if we have a cache — degrade gracefully
                if (!profile) setProfile(null)
            } else if (data) {
                // @ts-ignore
                const roleName = data.role ? (Array.isArray(data.role) ? data.role[0]?.name : data.role.name) : 'USER'

                // @ts-ignore
                const branchName = data.branch ? (Array.isArray(data.branch) ? data.branch[0]?.name : data.branch.name) : null

                const p: UserProfile = {
                    id: data.id,
                    email: data.email,
                    name: data.name || authData.user_metadata?.name || '',
                    role: roleName,
                    branchId: data.branch_id,
                    branchName,
                }

                setProfile(p)
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p))
            }
        } catch (err) {
            console.error("Profile fetch error:", err)
        } finally {
            setLoading(false)
        }
    }

    const signIn = async (email: string, password: string) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) return { error: error.message }

        // Immediately fetch profile inline (not via listener) for instant redirect
        if (data.user) {
            const { data: userData } = await supabase
                .from('users')
                .select('id, email, name, role:roles(name), branch_id, branch:branches(name)')
                .eq('id', data.user.id)
                .single()

            if (userData) {
                // @ts-ignore
                const roleName = userData.role ? (Array.isArray(userData.role) ? userData.role[0]?.name : userData.role.name) : 'USER'
                // @ts-ignore
                const branchName = userData.branch ? (Array.isArray(userData.branch) ? userData.branch[0]?.name : userData.branch.name) : null
                const p: UserProfile = {
                    id: userData.id,
                    email: userData.email,
                    name: userData.name || data.user.user_metadata?.name || '',
                    role: roleName,
                    branchId: userData.branch_id,
                    branchName,
                }
                setProfile(p)
                localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p))
                setLoading(false)
                return { error: null, profile: p }
            }
        }

        return { error: null }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setProfile(null)
        localStorage.removeItem(PROFILE_CACHE_KEY)
    }

    return (
        <AuthContext.Provider value={{ profile, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) throw new Error('useAuth must be used within AuthProvider')
    return context
}
