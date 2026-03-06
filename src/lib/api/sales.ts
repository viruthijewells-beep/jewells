import { supabase } from '../supabase'

// ─── Update Sale (Edit) ─────────────────────────────────────────
export async function updateSale(
    saleId: string,
    updates: {
        customer_name?: string
        discount_percent?: number
        tax_percent?: number
        payment_method?: string
    }
) {
    const { data: sale, error: fetchErr } = await supabase
        .from('sales')
        .select('id, subtotal, discount_percent, discount_amount, tax_percent, tax_amount, total_amount, payment_method, customer_name, branch_id, user_id, status')
        .eq('id', saleId)
        .single()

    if (fetchErr || !sale) throw new Error('Sale not found')
    if ((sale as any).status === 'REFUNDED') throw new Error('Cannot edit a refunded sale')
    if ((sale as any).status === 'CANCELLED') throw new Error('Cannot edit a cancelled sale')

    const subtotal = Number(sale.subtotal ?? 0)
    const discountPercent = updates.discount_percent ?? sale.discount_percent ?? 0
    const taxPercent = updates.tax_percent ?? sale.tax_percent ?? 0

    const discountAmount = subtotal * (discountPercent / 100)
    const afterDiscount = subtotal - discountAmount
    const taxAmount = afterDiscount * (taxPercent / 100)
    const totalAmount = afterDiscount + taxAmount

    const { error: updateErr } = await supabase
        .from('sales')
        .update({
            customer_name: updates.customer_name ?? sale.customer_name,
            discount_percent: discountPercent,
            discount_amount: discountAmount,
            tax_percent: taxPercent,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            payment_method: updates.payment_method ?? sale.payment_method,
        })
        .eq('id', saleId)

    if (updateErr) throw new Error(`Update failed: ${updateErr.message}`)

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
        action: 'SALE_EDIT',
        user_id: user?.id ?? null,
        branch_id: sale.branch_id,
        details: {
            sale_id: saleId,
            old_total: Number(sale.total_amount),
            new_total: totalAmount,
            changes: updates,
        },
    })

    return { totalAmount, discountAmount, taxAmount }
}

// ─── Refund Sale (Full Refund) ───────────────────────────────────
export async function refundSale(
    saleId: string,
    reason: string,
    refundMethod: string = 'CASH'
) {
    // 1. Fetch sale + items
    const { data: sale, error: saleErr } = await supabase
        .from('sales')
        .select('id, branch_id, total_amount, status, user_id, sale_items(id, product_id, inventory_id, quantity, name)')
        .eq('id', saleId)
        .single()

    if (saleErr || !sale) throw new Error('Sale not found')
    if ((sale as any).status === 'REFUNDED') throw new Error('Sale already refunded')
    if ((sale as any).status === 'CANCELLED') throw new Error('Sale already cancelled')

    const items = (sale as any).sale_items ?? []
    const { data: { user } } = await supabase.auth.getUser()

    // 2. Restore stock for each item
    for (const item of items) {
        const { error: stockErr } = await supabase.rpc('update_stock', {
            p_product_id: item.product_id,
            p_branch_id: sale.branch_id,
            p_amount: item.quantity,
            p_action: 'ADD',
            p_reason: `REFUND — Sale #${saleId.slice(0, 8)} refunded`,
            p_user_id: user?.id ?? null,
        })

        if (stockErr) {
            // Fallback: direct update
            const { data: inv } = await supabase
                .from('branch_inventory')
                .select('id, stock_count')
                .eq('product_id', item.product_id)
                .eq('branch_id', sale.branch_id)
                .maybeSingle()
            if (inv) {
                await supabase.from('branch_inventory')
                    .update({ stock_count: (inv.stock_count ?? 0) + item.quantity })
                    .eq('id', inv.id)
            }
        }
    }

    // 3. Update sale status
    const { error: statusErr } = await supabase
        .from('sales')
        .update({ status: 'REFUNDED' })
        .eq('id', saleId)
    if (statusErr) throw new Error(`Status update failed: ${statusErr.message}`)

    // 4. Insert refund record
    await supabase.from('refunds').insert({
        sale_id: saleId,
        refund_amount: Number(sale.total_amount),
        refund_method: refundMethod,
        reason: reason,
        processed_by: user?.id ?? null,
    })

    // 5. Audit log
    await supabase.from('audit_logs').insert({
        action: 'REFUND',
        user_id: user?.id ?? null,
        branch_id: sale.branch_id,
        details: {
            sale_id: saleId,
            refund_amount: Number(sale.total_amount),
            refund_method: refundMethod,
            reason,
            items_restored: items.length,
            items: items.map((i: any) => ({ name: i.name, qty: i.quantity })),
        },
    })

    return { refundAmount: Number(sale.total_amount), itemsRestored: items.length }
}

// ─── Return Items (Partial Return) ───────────────────────────────
export async function returnItems(
    saleId: string,
    itemsToReturn: { sale_item_id: string; product_id: string; quantity: number; name: string }[],
    reason: string
) {
    if (itemsToReturn.length === 0) throw new Error('No items selected for return')

    // 1. Fetch sale
    const { data: sale, error: saleErr } = await supabase
        .from('sales')
        .select('id, branch_id, total_amount, subtotal, discount_percent, tax_percent, status, sale_items(id, product_id, quantity, unit_price, name)')
        .eq('id', saleId)
        .single()

    if (saleErr || !sale) throw new Error('Sale not found')
    if ((sale as any).status === 'REFUNDED') throw new Error('Sale already fully refunded')
    if ((sale as any).status === 'CANCELLED') throw new Error('Sale already cancelled')

    const { data: { user } } = await supabase.auth.getUser()
    const allItems = (sale as any).sale_items ?? []

    // 2. Validate return quantities
    for (const ret of itemsToReturn) {
        const saleItem = allItems.find((si: any) => si.id === ret.sale_item_id)
        if (!saleItem) throw new Error(`Item "${ret.name}" not found in sale`)
        if (ret.quantity > saleItem.quantity) throw new Error(`Cannot return more than ${saleItem.quantity} of "${ret.name}"`)
    }

    // 3. Restore stock for returned items
    for (const ret of itemsToReturn) {
        const { error: stockErr } = await supabase.rpc('update_stock', {
            p_product_id: ret.product_id,
            p_branch_id: sale.branch_id,
            p_amount: ret.quantity,
            p_action: 'ADD',
            p_reason: `RETURN — ${ret.quantity}x "${ret.name}" returned from sale #${saleId.slice(0, 8)}`,
            p_user_id: user?.id ?? null,
        })

        if (stockErr) {
            const { data: inv } = await supabase
                .from('branch_inventory')
                .select('id, stock_count')
                .eq('product_id', ret.product_id)
                .eq('branch_id', sale.branch_id)
                .maybeSingle()
            if (inv) {
                await supabase.from('branch_inventory')
                    .update({ stock_count: (inv.stock_count ?? 0) + ret.quantity })
                    .eq('id', inv.id)
            }
        }

        // 4. Update sale_item quantity (reduce)
        const saleItem = allItems.find((si: any) => si.id === ret.sale_item_id)
        const newQty = saleItem.quantity - ret.quantity
        if (newQty <= 0) {
            await supabase.from('sale_items').delete().eq('id', ret.sale_item_id)
        } else {
            await supabase.from('sale_items')
                .update({ quantity: newQty, subtotal: newQty * Number(saleItem.unit_price) })
                .eq('id', ret.sale_item_id)
        }

        // 5. Insert return record
        await supabase.from('returns').insert({
            sale_id: saleId,
            sale_item_id: ret.sale_item_id,
            product_id: ret.product_id,
            quantity: ret.quantity,
            return_reason: reason,
            processed_by: user?.id ?? null,
        })
    }

    // 6. Recalculate sale totals
    const { data: updatedItems } = await supabase
        .from('sale_items')
        .select('quantity, unit_price')
        .eq('sale_id', saleId)

    const remainingItems = updatedItems ?? []
    const newSubtotal = remainingItems.reduce((s, i: any) => s + (i.quantity * Number(i.unit_price)), 0)
    const discountPct = Number(sale.discount_percent ?? 0)
    const taxPct = Number(sale.tax_percent ?? 0)
    const discountAmt = newSubtotal * (discountPct / 100)
    const afterDiscount = newSubtotal - discountAmt
    const taxAmt = afterDiscount * (taxPct / 100)
    const newTotal = afterDiscount + taxAmt

    // Check if ALL items returned
    const allReturned = remainingItems.length === 0
    const newStatus = allReturned ? 'REFUNDED' : 'PARTIAL_RETURN'

    await supabase.from('sales').update({
        subtotal: newSubtotal,
        discount_amount: discountAmt,
        tax_amount: taxAmt,
        total_amount: newTotal,
        status: newStatus,
    }).eq('id', saleId)

    // 7. Audit log
    await supabase.from('audit_logs').insert({
        action: 'RETURN_ITEM',
        user_id: user?.id ?? null,
        branch_id: sale.branch_id,
        details: {
            sale_id: saleId,
            returned_items: itemsToReturn.map(i => ({ name: i.name, qty: i.quantity })),
            reason,
            old_total: Number(sale.total_amount),
            new_total: newTotal,
            new_status: newStatus,
        },
    })

    const returnedValue = Number(sale.total_amount) - newTotal
    return { returnedValue, newTotal, newStatus, itemsReturned: itemsToReturn.length }
}

// ─── Cancel Sale ─────────────────────────────────────────────────
export async function cancelSale(saleId: string, reason: string) {
    // 1. Fetch sale + items
    const { data: sale, error: saleErr } = await supabase
        .from('sales')
        .select('id, branch_id, total_amount, status, user_id, sale_items(id, product_id, inventory_id, quantity, name)')
        .eq('id', saleId)
        .single()

    if (saleErr || !sale) throw new Error('Sale not found')
    if ((sale as any).status === 'CANCELLED') throw new Error('Sale already cancelled')
    if ((sale as any).status === 'REFUNDED') throw new Error('Sale already refunded — cannot cancel')

    const items = (sale as any).sale_items ?? []
    const { data: { user } } = await supabase.auth.getUser()

    // 2. Restore stock for each item
    for (const item of items) {
        const { error: stockErr } = await supabase.rpc('update_stock', {
            p_product_id: item.product_id,
            p_branch_id: sale.branch_id,
            p_amount: item.quantity,
            p_action: 'ADD',
            p_reason: `CANCEL — Invoice #${saleId.slice(0, 8)} cancelled`,
            p_user_id: user?.id ?? null,
        })

        if (stockErr) {
            const { data: inv } = await supabase
                .from('branch_inventory')
                .select('id, stock_count')
                .eq('product_id', item.product_id)
                .eq('branch_id', sale.branch_id)
                .maybeSingle()
            if (inv) {
                await supabase.from('branch_inventory')
                    .update({ stock_count: (inv.stock_count ?? 0) + item.quantity })
                    .eq('id', inv.id)
            }
        }
    }

    // 3. Update status
    const { error: statusErr } = await supabase
        .from('sales')
        .update({ status: 'CANCELLED' })
        .eq('id', saleId)
    if (statusErr) throw new Error(`Cancel failed: ${statusErr.message}`)

    // 4. Audit log
    await supabase.from('audit_logs').insert({
        action: 'CANCEL_INVOICE',
        user_id: user?.id ?? null,
        branch_id: sale.branch_id,
        details: {
            sale_id: saleId,
            total_cancelled: Number(sale.total_amount),
            reason,
            items_restored: items.length,
            items: items.map((i: any) => ({ name: i.name, qty: i.quantity })),
        },
    })

    return { totalCancelled: Number(sale.total_amount), itemsRestored: items.length }
}

// ─── Delete Sale (legacy — kept for backward compat) ─────────────
export async function deleteSale(saleId: string) {
    const { data: sale, error: saleErr } = await supabase
        .from('sales')
        .select('id, branch_id, total_amount, user_id, sale_items(id, product_id, inventory_id, quantity, name)')
        .eq('id', saleId)
        .single()

    if (saleErr || !sale) throw new Error('Sale not found')

    const items = (sale as any).sale_items ?? []
    const { data: { user } } = await supabase.auth.getUser()

    for (const item of items) {
        const { error: stockErr } = await supabase.rpc('update_stock', {
            p_product_id: item.product_id,
            p_branch_id: sale.branch_id,
            p_amount: item.quantity,
            p_action: 'ADD',
            p_reason: `SALE REVERSED — Admin deleted sale #${saleId.slice(0, 8)}`,
            p_user_id: user?.id ?? null,
        })
        if (stockErr) {
            const { data: inv } = await supabase
                .from('branch_inventory')
                .select('id, stock_count')
                .eq('product_id', item.product_id)
                .eq('branch_id', sale.branch_id)
                .maybeSingle()
            if (inv) {
                await supabase.from('branch_inventory')
                    .update({ stock_count: (inv.stock_count ?? 0) + item.quantity })
                    .eq('id', inv.id)
            }
        }
    }

    await supabase.from('sale_items').delete().eq('sale_id', saleId)
    const { error: delErr } = await supabase.from('sales').delete().eq('id', saleId)
    if (delErr) throw new Error(`Delete failed: ${delErr.message}`)

    await supabase.from('audit_logs').insert({
        action: 'SALE_DELETE',
        user_id: user?.id ?? null,
        branch_id: sale.branch_id,
        details: {
            sale_id: saleId,
            total: Number(sale.total_amount),
            items_restored: items.length,
            items: items.map((i: any) => ({ name: i.name, qty: i.quantity })),
        },
    })

    return { itemsRestored: items.length }
}
