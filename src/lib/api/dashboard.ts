import { supabase } from '../supabase'

export async function fetchDashboardStats() {
    // Use head:true count queries — no data transferred
    const [productsRes, categoriesRes, lowStockRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('branch_inventory').select('id', { count: 'exact', head: true }).lt('stock_count', 10),
    ])

    // Get total stock via limited sample — avoid fetching 500K rows
    const { data: stockSample, error: stockError } = await supabase
        .from('branch_inventory')
        .select('stock_count')
        .limit(5000)

    const totalStock = stockError ? 0 : (stockSample ?? []).reduce((sum: number, r: any) => sum + (r.stock_count || 0), 0)

    // Recent stock history for trends
    const { data: stockTrends } = await supabase
        .from('stock_history')
        .select('created_at, new_count, action_type')
        .order('created_at', { ascending: false })
        .limit(50)

    // Recent activity
    const { data: recentActivity } = await supabase
        .from('audit_logs')
        .select('id, action, details, created_at, user:users(name)')
        .order('created_at', { ascending: false })
        .limit(10)

    // Category breakdown
    const { data: categoryBreakdown } = await supabase
        .from('categories')
        .select('name, products:products(id)')

    return {
        totalProducts: productsRes.count ?? 0,
        totalStock,
        totalCategories: categoriesRes.count ?? 0,
        lowStockCount: lowStockRes.count ?? 0,
        stockTrends: (stockTrends ?? []).map((s: any) => ({
            date: new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            count: s.new_count,
        })),
        recentActivity: (recentActivity ?? []).map((a: any) => {
            // Parse details JSON into a readable summary
            let detailSummary = ''
            try {
                const d = typeof a.details === 'object' ? a.details : JSON.parse(a.details ?? '{}')
                if (d.operation && d.newStock !== undefined) {
                    const delta = d.stockDelta !== undefined ? ` (${d.stockDelta > 0 ? '+' : ''}${d.stockDelta})` : ''
                    detailSummary = `${d.operation} · Stock ${d.oldStock ?? '?'} → ${d.newStock}${delta}`
                } else if (d.table) {
                    detailSummary = `Table: ${d.table}`
                } else {
                    const str = JSON.stringify(d)
                    detailSummary = str.length > 60 ? str.slice(0, 60) + '…' : str
                }
            } catch {
                const str = String(a.details ?? '')
                detailSummary = str.length > 60 ? str.slice(0, 60) + '…' : str
            }
            return {
                action: a.action,
                details: detailSummary,
                user: a.user,
                createdAt: a.created_at,
            }
        }),
        categoryBreakdown: (categoryBreakdown ?? []).map((c: any) => ({
            name: c.name,
            count: c.products?.length ?? 0,
        })),
    }
}

export async function fetchStockHistory(cursor: string | null, productId: string | null) {
    let query = supabase
        .from('stock_history')
        .select('id, product_id, branch_id, old_count, new_count, action_type, reason, user_id, created_at, product:products(name, design_code), user:users(name)')
        .order('created_at', { ascending: false })
        .limit(20)

    if (productId) query = query.eq('product_id', productId)
    if (cursor) query = query.lt('created_at', cursor)

    const { data, error } = await query
    if (error) throw new Error(`Stock history failed: ${error.message}`)

    const history = (data ?? []).map((h: any) => ({
        id: h.id,
        action: h.action_type,
        quantity: Math.abs((h.new_count ?? 0) - (h.old_count ?? 0)),
        previousCount: h.old_count,
        newCount: h.new_count,
        reason: h.reason,
        product: h.product,
        user: h.user,
        createdAt: h.created_at,
    }))

    const nextCursor = data && data.length === 20 ? data[data.length - 1].created_at : null
    return { history, nextCursor }
}

export async function fetchAuditLogs(cursor: string | null, search: string, action: string) {
    let query = supabase
        .from('audit_logs')
        .select('id, action, details, created_at, user:users(name)')
        .order('created_at', { ascending: false })
        .limit(15)

    if (search) query = query.ilike('action', `%${search}%`)
    if (action && action !== 'all') query = query.eq('action', action)
    if (cursor) query = query.lt('created_at', cursor)

    const { data, error } = await query
    if (error) throw new Error(`Audit logs failed: ${error.message}`)

    const logs = (data ?? []).map((l: any) => ({
        id: l.id,
        action: l.action,
        details: typeof l.details === 'object' ? JSON.stringify(l.details) : l.details,
        user: l.user,
        createdAt: l.created_at,
    }))

    const nextCursor = data && data.length === 15 ? data[data.length - 1].created_at : null
    return { logs, nextCursor }
}

export async function fetchTransfers(cursor: string | null) {
    // Note: if a 'transfers' table doesn't exist yet, return empty
    try {
        let query = supabase
            .from('transfers')
            .select('*, from_branch:branches!from_branch_id(name), to_branch:branches!to_branch_id(name), product:products(name), user:users(name)')
            .order('created_at', { ascending: false })
            .limit(20)

        if (cursor) query = query.lt('created_at', cursor)

        const { data, error } = await query
        if (error) {
            // Table may not exist — graceful fallback
            console.warn('Transfers query error:', error.message)
            return { transfers: [], nextCursor: null }
        }
        const nextCursor = data && data.length === 20 ? data[data.length - 1].created_at : null
        return { transfers: data ?? [], nextCursor }
    } catch {
        return { transfers: [], nextCursor: null }
    }
}

export async function createTransfer(transfer: {
    fromBranchId: string
    toBranchId: string
    productId: string
    quantity: number
}) {
    const { fromBranchId, toBranchId, productId, quantity } = transfer

    // ── 1. Validate: source ≠ destination ──
    if (fromBranchId === toBranchId) {
        throw new Error('Cannot transfer to the same branch')
    }
    if (quantity <= 0) {
        throw new Error('Quantity must be greater than 0')
    }

    // ── 2. Check source stock ──
    const { data: sourceInv, error: srcErr } = await supabase
        .from('branch_inventory')
        .select('id, stock_count')
        .eq('branch_id', fromBranchId)
        .eq('product_id', productId)
        .maybeSingle()

    if (srcErr) throw new Error(`Source stock lookup failed: ${srcErr.message}`)
    if (!sourceInv) throw new Error('Product not found in source branch')
    if ((sourceInv.stock_count ?? 0) < quantity) {
        throw new Error(`Insufficient stock: only ${sourceInv.stock_count ?? 0} available`)
    }

    const oldSourceCount = sourceInv.stock_count ?? 0
    const newSourceCount = oldSourceCount - quantity

    // ── 3. Deduct stock from source branch ──
    const { error: deductErr } = await supabase
        .from('branch_inventory')
        .update({ stock_count: newSourceCount })
        .eq('id', sourceInv.id)

    if (deductErr) throw new Error(`Source deduction failed: ${deductErr.message}`)

    // ── 4. Upsert stock to destination branch ──
    const { data: destInv } = await supabase
        .from('branch_inventory')
        .select('id, stock_count')
        .eq('branch_id', toBranchId)
        .eq('product_id', productId)
        .maybeSingle()

    let oldDestCount = 0
    let newDestCount = quantity

    if (destInv) {
        // Product exists at destination by product_id — update quantity
        oldDestCount = destInv.stock_count ?? 0
        newDestCount = oldDestCount + quantity
        const { error: addErr } = await supabase
            .from('branch_inventory')
            .update({ stock_count: newDestCount })
            .eq('id', destInv.id)
        if (addErr) throw new Error(`Destination update failed: ${addErr.message}`)
    } else {
        // Product NOT found by product_id — fetch full source row details
        const { data: srcRow, error: srcRowErr } = await supabase
            .from('branch_inventory')
            .select('sku, barcode, selling_price, purchase_price, min_stock_level')
            .eq('id', sourceInv.id)
            .single()
        if (srcRowErr) throw new Error(`Failed to read source inventory: ${srcRowErr.message}`)

        // Also check if the barcode already exists in the destination
        // (can happen if product was transferred before under a different product_id)
        const { data: destByBarcode } = await supabase
            .from('branch_inventory')
            .select('id, stock_count')
            .eq('branch_id', toBranchId)
            .eq('barcode', srcRow?.barcode ?? '')
            .maybeSingle()

        if (destByBarcode) {
            // Barcode exists at destination (different product_id row) — just increment stock
            oldDestCount = destByBarcode.stock_count ?? 0
            newDestCount = oldDestCount + quantity
            const { error: mergeErr } = await supabase
                .from('branch_inventory')
                .update({ stock_count: newDestCount })
                .eq('id', destByBarcode.id)
            if (mergeErr) throw new Error(`Destination merge failed: ${mergeErr.message}`)
        } else {
            // Truly new at destination — use upsert with onConflict to be 100% safe
            newDestCount = quantity
            const { error: upsertErr } = await supabase
                .from('branch_inventory')
                .upsert(
                    {
                        branch_id: toBranchId,
                        product_id: productId,
                        stock_count: quantity,
                        sku: srcRow?.sku ?? null,
                        barcode: srcRow?.barcode ?? null,
                        selling_price: srcRow?.selling_price ?? 0,
                        purchase_price: srcRow?.purchase_price ?? 0,
                        min_stock_level: srcRow?.min_stock_level ?? 5,
                    },
                    { onConflict: 'branch_id,barcode', ignoreDuplicates: false }
                )
            if (upsertErr) throw new Error(`Destination upsert failed: ${upsertErr.message}`)
        }
    }

    // ── 5. Insert transfer record ──
    const { data: transferRecord, error: transferErr } = await supabase
        .from('transfers')
        .insert({
            from_branch_id: fromBranchId,
            to_branch_id: toBranchId,
            product_id: productId,
            quantity,
        })
        .select()
        .single()

    if (transferErr) {
        console.warn('Transfer record insert failed:', transferErr.message)
        // Non-critical — stock already moved, log the record anyway
    }

    // ── 6. Log stock history (TRANSFER_OUT + TRANSFER_IN) ──
    const { data: { user } } = await supabase.auth.getUser()
    const historyRecords = [
        {
            product_id: productId,
            branch_id: fromBranchId,
            action: 'TRANSFER_OUT',
            quantity,
            previous_count: oldSourceCount,
            new_count: newSourceCount,
            reason: `Transfer to branch`,
            user_id: user?.id ?? null,
        },
        {
            product_id: productId,
            branch_id: toBranchId,
            action: 'TRANSFER_IN',
            quantity,
            previous_count: oldDestCount,
            new_count: newDestCount,
            reason: `Transfer from branch`,
            user_id: user?.id ?? null,
        },
    ]

    await supabase.from('stock_history').insert(historyRecords).then(({ error }) => {
        if (error) console.warn('Stock history insert failed:', error.message)
    })

    return transferRecord
}
