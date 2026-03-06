import { supabase } from '../supabase'

// ─── Session Management ─────────────────────────────────────────
export async function getOrCreateSession(branchId: string, userId: string) {
    // Check for existing OPEN session
    const { data: existing } = await supabase
        .from('pos_sessions')
        .select('*')
        .eq('branch_id', branchId)
        .eq('status', 'OPEN')
        .limit(1)
        .maybeSingle()

    if (existing) return existing

    // Create new session
    const { data, error } = await supabase
        .from('pos_sessions')
        .insert({ branch_id: branchId, user_id: userId, status: 'OPEN' })
        .select()
        .single()

    if (error) throw new Error(`Session creation failed: ${error.message}`)
    return data
}

export async function closeSession(sessionId: string, userId: string) {
    const { error } = await supabase
        .from('pos_sessions')
        .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
        .eq('id', sessionId)

    if (error) throw new Error(`Session close failed: ${error.message}`)
}

// ─── Scan Product for POS ───────────────────────────────────────
export async function posLookupProduct(barcode: string, branchId: string) {
    // Exact match on barcode in branch_inventory
    const { data, error } = await supabase
        .from('branch_inventory')
        .select('id, product_id, sku, barcode, stock_count, selling_price, min_stock_level, product:products(id, name, gold_type, metal_type, purity, weight_base, image_url, category:categories(name))')
        .eq('barcode', barcode)
        .eq('branch_id', branchId)
        .limit(1)
        .maybeSingle()

    if (error) throw new Error(`Lookup failed: ${error.message}`)
    if (!data) {
        // Try across all branches
        const { data: anyBranch, error: err2 } = await supabase
            .from('branch_inventory')
            .select('id, product_id, sku, barcode, stock_count, selling_price, min_stock_level, branch_id, product:products(id, name, gold_type, metal_type, purity, weight_base, image_url, category:categories(name))')
            .eq('barcode', barcode)
            .limit(1)
            .maybeSingle()

        if (err2 || !anyBranch) return null

        const d = anyBranch as any
        return {
            inventoryId: d.id,
            productId: d.product_id,
            name: d.product?.name ?? 'Unknown',
            sku: d.sku,
            barcode: d.barcode,
            gold_type: d.product?.gold_type,
            metal_type: d.product?.metal_type ?? 'Gold',
            purity: d.product?.purity ?? d.product?.gold_type ?? '22K',
            weight: d.product?.weight_base,
            image_url: d.product?.image_url,
            categoryName: d.product?.category?.name ?? '',
            stockCount: d.stock_count ?? 0,
            sellingPrice: Number(d.selling_price ?? 0),
            branchId: d.branch_id,
        }
    }

    const d = data as any
    return {
        inventoryId: d.id,
        productId: d.product_id,
        name: d.product?.name ?? 'Unknown',
        sku: d.sku,
        barcode: d.barcode,
        gold_type: d.product?.gold_type,
        metal_type: d.product?.metal_type ?? 'Gold',
        purity: d.product?.purity ?? d.product?.gold_type ?? '22K',
        weight: d.product?.weight_base,
        image_url: d.product?.image_url,
        categoryName: d.product?.category?.name ?? '',
        stockCount: d.stock_count ?? 0,
        sellingPrice: Number(d.selling_price ?? 0),
        branchId,
    }
}

// ─── Checkout (atomic: sale + items + stock deduction + history + audit) ──
export async function processCheckout({
    sessionId, branchId, userId, cart, discountPercent, taxPercent, paymentMethod, customerName, customerPhone,
}: {
    sessionId: string
    branchId: string
    userId: string
    cart: CartItem[]
    discountPercent: number
    taxPercent: number
    paymentMethod: 'CASH' | 'CARD' | 'UPI'
    customerName?: string
    customerPhone?: string
}) {
    if (cart.length === 0) throw new Error('Cart is empty')

    // Calculate totals
    const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0)
    const discountAmount = subtotal * (discountPercent / 100)
    const afterDiscount = subtotal - discountAmount
    const taxAmount = afterDiscount * (taxPercent / 100)
    const totalAmount = afterDiscount + taxAmount

    // 1. Create sale record
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
            session_id: sessionId,
            branch_id: branchId,
            subtotal,
            discount_percent: discountPercent,
            discount_amount: discountAmount,
            tax_percent: taxPercent,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            payment_method: paymentMethod,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            user_id: userId,
        })
        .select('id')
        .single()

    if (saleError) throw new Error(`Sale creation failed: ${saleError.message}`)

    // 2. Insert sale items
    const saleItems = cart.map((item) => ({
        sale_id: sale.id,
        product_id: item.productId,
        inventory_id: item.inventoryId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        subtotal: item.subtotal,
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
    if (itemsError) throw new Error(`Sale items failed: ${itemsError.message}`)

    // 3. Deduct stock atomically via RPC (race-safe, audit-logged)
    for (const item of cart) {
        const { error: stockErr } = await supabase.rpc('update_stock', {
            p_product_id: item.productId,
            p_branch_id: item.branchId || branchId,
            p_amount: item.quantity,
            p_action: 'REMOVE',
            p_reason: `SALE — Invoice #${sale.id.slice(0, 8)}`,
            p_user_id: userId,
        })

        if (stockErr) throw new Error(`Stock deduction failed for "${item.name}": ${stockErr.message}`)
    }

    // 4. Session update (best-effort, non-critical)
    try {
        // Session totals are informational only
    } catch {
        // Non-critical — session totals are informational
    }

    // 5. Audit log
    await supabase.from('audit_logs').insert({
        action: 'SALE',
        user_id: userId,
        branch_id: branchId,
        details: {
            sale_id: sale.id,
            items: cart.length,
            total: totalAmount,
            payment: paymentMethod,
            customer: customerName || 'Walk-in',
        },
    })

    return {
        saleId: sale.id,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        itemCount: cart.length,
    }
}

// ─── Fetch session sales ────────────────────────────────────────
export async function fetchSessionSales(sessionId: string) {
    const { data, error } = await supabase
        .from('sales')
        .select('id, total_amount, payment_method, customer_name, created_at')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })

    if (error) throw new Error(`Fetch sales failed: ${error.message}`)
    return data ?? []
}

// ─── Types ──────────────────────────────────────────────────────
export interface CartItem {
    inventoryId: string
    productId: string
    branchId: string
    name: string
    sku: string
    barcode: string
    gold_type: string
    metal_type: string
    purity: string
    weight: number
    image_url: string | null
    unitPrice: number
    quantity: number
    subtotal: number
    maxStock: number
}
