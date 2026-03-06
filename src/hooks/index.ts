import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchProducts, updateStock, scanProduct } from '@/lib/api/products'
import {
    fetchCategories,
    fetchBranches,
    fetchUsers,
    createBranch,
    createBranchWithManager,
    updateBranch,
    toggleBranchStatus,
} from '@/lib/api/common'
import {
    fetchDashboardStats,
    fetchStockHistory,
    fetchAuditLogs,
    fetchTransfers,
} from '@/lib/api/dashboard'
export { usePageTitle } from './usePageTitle'
export { useGoldRate, GoldRateProvider } from './useGoldRate'

// ─── Error handler ──────────────────────────────────────────────
function onQueryError(error: Error) {
    toast.error(error.message || 'An error occurred')
}

// ─── Dashboard Stats ────────────────────────────────────────────
export function useDashboardStats() {
    return useQuery({
        queryKey: ['dashboard', 'stats'],
        queryFn: fetchDashboardStats,
        staleTime: 30_000,
        retry: 1,
        meta: { onError: onQueryError },
    })
}

// ─── Products ───────────────────────────────────────────────────
export function useProducts(page: number, search: string, category: string) {
    return useQuery({
        queryKey: ['products', page, search, category],
        queryFn: () => fetchProducts(page, search, category),
        staleTime: 10_000,
        retry: 1,
        meta: { onError: onQueryError },
    })
}

// ─── Categories ─────────────────────────────────────────────────
export function useCategories() {
    return useQuery({
        queryKey: ['categories'],
        queryFn: fetchCategories,
        staleTime: 60_000,
        meta: { onError: onQueryError },
    })
}

// ─── Branches ───────────────────────────────────────────────────
export function useBranches() {
    return useQuery({
        queryKey: ['branches'],
        queryFn: fetchBranches,
        staleTime: 60_000,
        retry: 1,
        meta: { onError: onQueryError },
    })
}

export function useCreateBranch() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: createBranch,
        onSuccess: () => {
            toast.success('Branch created successfully')
            queryClient.invalidateQueries({ queryKey: ['branches'] })
        },
        onError: (err: any) => toast.error(err.message || 'Failed to create branch'),
    })
}

export function useCreateBranchWithManager() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: createBranchWithManager,
        onSuccess: (_data, variables) => {
            if (variables.manager_email) {
                toast.success(`Branch created! Manager account: ${variables.manager_email}`, { duration: 6000 })
            } else {
                toast.success('Branch created successfully')
            }
            queryClient.invalidateQueries({ queryKey: ['branches'] })
            queryClient.invalidateQueries({ queryKey: ['users'] })
        },
        onError: (err: any) => toast.error(err.message || 'Failed to create branch'),
    })
}

export function useUpdateBranch() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, updates }: { id: string; updates: any }) => updateBranch(id, updates),
        onSuccess: () => {
            toast.success('Branch updated')
            queryClient.invalidateQueries({ queryKey: ['branches'] })
        },
        onError: (err: any) => toast.error(err.message || 'Failed to update branch'),
    })
}

export function useToggleBranchStatus() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ id, currentStatus }: { id: string; currentStatus: string }) =>
            toggleBranchStatus(id, currentStatus),
        onSuccess: (data: any) => {
            toast.success(`Branch ${data.status === 'active' ? 'activated' : 'deactivated'}`)
            queryClient.invalidateQueries({ queryKey: ['branches'] })
        },
        onError: (err: any) => toast.error(err.message || 'Failed to toggle branch status'),
    })
}

// ─── Users ──────────────────────────────────────────────────────
export function useUsers() {
    return useQuery({
        queryKey: ['users'],
        queryFn: fetchUsers,
        staleTime: 30_000,
        meta: { onError: onQueryError },
    })
}

// ─── Stock History ──────────────────────────────────────────────
export function useStockHistory(cursor: string | null, productId: string | null) {
    return useQuery({
        queryKey: ['stockHistory', cursor, productId],
        queryFn: () => fetchStockHistory(cursor, productId),
        staleTime: 10_000,
        meta: { onError: onQueryError },
    })
}

// ─── Audit Logs ─────────────────────────────────────────────────
export function useAuditLogs(cursor: string | null, search: string, action: string) {
    return useQuery({
        queryKey: ['auditLogs', cursor, search, action],
        queryFn: () => fetchAuditLogs(cursor, search, action),
        staleTime: 10_000,
        meta: { onError: onQueryError },
    })
}

// ─── Transfer History ───────────────────────────────────────────
export function useTransferHistory(cursor: string | null) {
    return useQuery({
        queryKey: ['transfers', cursor],
        queryFn: () => fetchTransfers(cursor),
        staleTime: 10_000,
        meta: { onError: onQueryError },
    })
}

// ─── Optimistic Stock Update ────────────────────────────────────
export function useOptimisticStockUpdate() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: updateStock,
        onMutate: async ({ productId, action, amount }) => {
            await queryClient.cancelQueries({ queryKey: ['products'] })
            const previousProducts = queryClient.getQueriesData({ queryKey: ['products'] })
            queryClient.setQueriesData({ queryKey: ['products'] }, (old: any) => {
                if (!old?.products) return old
                return {
                    ...old,
                    products: old.products.map((p: any) => {
                        if (p.id !== productId) return p
                        return {
                            ...p,
                            stockCount:
                                action === 'ADD'
                                    ? (p.stockCount ?? 0) + amount
                                    : Math.max(0, (p.stockCount ?? 0) - amount),
                        }
                    }),
                }
            })
            return { previousProducts }
        },
        onError: (err: any, _vars, context) => {
            toast.error(err.message || 'Stock update failed')
            if (context?.previousProducts) {
                context.previousProducts.forEach(([key, data]: any) => {
                    queryClient.setQueryData(key, data)
                })
            }
        },
        onSuccess: () => {
            toast.success('Stock updated')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'stats'] })
            queryClient.invalidateQueries({ queryKey: ['stockHistory'] })
        },
    })
}

// ─── Scan ───────────────────────────────────────────────────────
export function useScanProduct() {
    return useMutation({
        mutationFn: scanProduct,
        onError: (err: any) => {
            toast.error(err.message || 'Scan failed')
        },
    })
}
