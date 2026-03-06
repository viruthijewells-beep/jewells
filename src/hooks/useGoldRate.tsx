import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchGoldRate, updateGoldRate as apiUpdateGoldRate } from '@/lib/api/goldRate'

// ─── Types ──────────────────────────────────────────────────────
interface GoldRateContextType {
    rate: number
    lastUpdatedAt: string | null
    loading: boolean
    updateRate: (newRate: number, userId: string) => Promise<void>
}

const GoldRateContext = createContext<GoldRateContextType | undefined>(undefined)

// ─── Default fallback rate ──────────────────────────────────────
const DEFAULT_RATE = 7245.00

// ─── Provider ───────────────────────────────────────────────────
export function GoldRateProvider({ children }: { children: ReactNode }) {
    const [rate, setRate] = useState<number>(DEFAULT_RATE)
    const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    // Fetch initial gold rate
    useEffect(() => {
        async function loadRate() {
            try {
                const data = await fetchGoldRate()
                if (data) {
                    setRate(Number(data.current_rate))
                    setLastUpdatedAt(data.last_updated_at)
                }
            } catch (err) {
                console.error('Failed to load gold rate:', err)
            } finally {
                setLoading(false)
            }
        }
        loadRate()
    }, [])

    // Subscribe to real-time changes
    useEffect(() => {
        const channel = supabase
            .channel('gold-rate-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'gold_settings',
                },
                (payload) => {
                    const updated = payload.new as any
                    if (updated.current_rate !== undefined) {
                        setRate(Number(updated.current_rate))
                        setLastUpdatedAt(updated.last_updated_at)
                    }
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    // Update handler
    const updateRate = useCallback(async (newRate: number, userId: string) => {
        await apiUpdateGoldRate(newRate, userId)
        // Optimistic update (real-time will also fire)
        setRate(newRate)
        setLastUpdatedAt(new Date().toISOString())
    }, [])

    return (
        <GoldRateContext.Provider value={{ rate, lastUpdatedAt, loading, updateRate }}>
            {children}
        </GoldRateContext.Provider>
    )
}

// ─── Hook ───────────────────────────────────────────────────────
export function useGoldRate() {
    const context = useContext(GoldRateContext)
    if (context === undefined) {
        throw new Error('useGoldRate must be used within GoldRateProvider')
    }
    return context
}
