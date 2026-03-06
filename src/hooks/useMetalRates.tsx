import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllMetalRates } from '@/lib/api/metalRates'
import type { MetalType } from '@/lib/metalTypes'
import { DEFAULT_METAL_RATES } from '@/lib/metalTypes'

// ─── useMetalRates — fetches all 3 rates with react-query ─────────
export function useMetalRates() {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['metalRates'],
        queryFn: fetchAllMetalRates,
        staleTime: 30_000,
        refetchOnWindowFocus: true,
    })

    return {
        rates: data ?? { ...DEFAULT_METAL_RATES },
        isLoading,
        error,
        refetch,
    }
}

// ─── useGoldRate — backward-compat, returns just gold rate  ───────
export function useGoldRate() {
    const { rates, isLoading } = useMetalRates()
    return { rate: rates.Gold ?? DEFAULT_METAL_RATES.Gold, loading: isLoading }
}

// ─── useRealtimeMetalRates — live updates via Supabase channel ────
export function useRealtimeMetalRates() {
    const [rates, setRates] = useState<Record<MetalType, number>>({ ...DEFAULT_METAL_RATES })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Initial fetch
        fetchAllMetalRates().then(r => { setRates(r); setLoading(false) })

        // Subscribe to realtime changes
        const channel = supabase
            .channel('metal_rates_realtime')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'metal_rates' }, (payload) => {
                const { metal_type, rate } = payload.new as any
                setRates(prev => ({ ...prev, [metal_type]: Number(rate) }))
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    return { rates, loading }
}
