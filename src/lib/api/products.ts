import { supabase } from '../supabase'

// ─── Fetch Products with Inventory ─────────────────────────────
export async function fetchProducts(page: number, search: string, category: string) {
    const pageSize = 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
        .from('products')
        .select('id, name, category_id, gold_type, metal_type, purity, design_code, weight_base, status, image_url, created_at, category:categories(name)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (search) {
        query = query.or(`name.ilike.%${search}%,design_code.ilike.%${search}%`)
    }
    if (category) {
        query = query.eq('category_id', category)
    }

    const { data: products, count, error } = await query
    if (error) throw new Error(`Products fetch failed: ${error.message}`)

    if (!products || products.length === 0) {
        return { products: [], total: count ?? 0, page }
    }

    // Fetch branch_inventory for these products
    const productIds = products.map((p: any) => p.id)
    const { data: inventory, error: invError } = await supabase
        .from('branch_inventory')
        .select('id, product_id, branch_id, sku, barcode, stock_count, selling_price, purchase_price, min_stock_level, branch:branches(name)')
        .in('product_id', productIds)

    if (invError) throw new Error(`Inventory fetch failed: ${invError.message}`)

    const invMap = new Map<string, any>()
        ; (inventory ?? []).forEach((inv: any) => {
            if (!invMap.has(inv.product_id)) invMap.set(inv.product_id, inv)
        })

    const merged = products.map((p: any) => {
        const inv = invMap.get(p.id)
        return {
            id: p.id,
            name: p.name,
            category_id: p.category_id,
            categoryName: p.category?.name ?? '—',
            gold_type: p.gold_type,
            metal_type: p.metal_type ?? 'Gold',
            purity: p.purity ?? p.gold_type ?? '22K',
            weight: p.weight_base,
            design_code: p.design_code,
            status: p.status,
            image_url: p.image_url,
            sku: inv?.sku ?? '—',
            barcode: inv?.barcode ?? '—',
            msrp: inv?.selling_price ?? 0,
            purchasePrice: inv?.purchase_price ?? 0,
            stockCount: inv?.stock_count ?? 0,
            minStockLevel: inv?.min_stock_level ?? 5,
            inventoryId: inv?.id ?? null,
            branchId: inv?.branch_id ?? null,
            branchName: inv?.branch?.name ?? '—',
        }
    })

    return { products: merged, total: count ?? 0, page }
}

// ─── Create Product via Atomic RPC ──────────────────────────────
// Single DB transaction: barcode generation + product + inventory + history + audit
export async function createProductFull({
    name, category_id, metal_type, purity, gold_type, design_code, weight, branch_id,
    sku, stock_count, selling_price, purchase_price,
    min_stock_level, user_id, imageFile, branchCode,
}: {
    name: string
    category_id: string
    metal_type: string
    purity: string
    // legacy param — still accepted
    gold_type?: string
    design_code: string
    weight: number
    branch_id: string
    sku: string
    stock_count: number
    selling_price: number
    purchase_price: number
    min_stock_level: number
    user_id: string
    imageFile?: File | null
    branchCode?: string
}) {
    // 0. Upload image to Supabase Storage (if provided)
    let image_url: string | null = null
    let uploadedPath: string | null = null

    if (imageFile) {
        const fileExt = imageFile.name.split('.').pop() || 'webp'
        uploadedPath = `products/${crypto.randomUUID()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(uploadedPath, imageFile, { contentType: imageFile.type, upsert: false })

        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)

        const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(uploadedPath)

        image_url = urlData.publicUrl
    }

    // 1. Call atomic RPC — generates barcode + inserts everything in single transaction
    const { data, error } = await supabase.rpc('create_product_with_stock', {
        p_name: name,
        p_category_id: category_id,
        p_metal_type: metal_type,
        p_purity: purity,
        p_gold_type: gold_type,  // backward compat
        p_design_code: design_code || '',
        p_weight: weight,
        p_branch_id: branch_id,
        p_sku: sku || '',
        p_stock_count: stock_count,
        p_selling_price: selling_price,
        p_purchase_price: purchase_price,
        p_min_stock_level: min_stock_level,
        p_user_id: user_id,
        p_image_url: image_url,
        p_branch_code: branchCode || '200',
    })

    if (error) {
        // Rollback: delete uploaded image
        if (uploadedPath) {
            await supabase.storage.from('product-images').remove([uploadedPath])
        }
        throw new Error(`Product creation failed: ${error.message}`)
    }

    // data = { product_id, inventory_id, barcode, design_code, sku }
    return data as { product_id: string; inventory_id: string; barcode: string; design_code: string; sku: string }
}

// ─── Update Product ─────────────────────────────────────────────
export async function updateProduct(id: string, updates: any) {
    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single()
    if (error) throw new Error(`Update failed: ${error.message}`)
    return data
}

// ─── Delete Product ─────────────────────────────────────────────
export async function deleteProduct(id: string) {
    const { data: prod } = await supabase.from('products').select('image_url').eq('id', id).single()
    const { error: invError } = await supabase.from('branch_inventory').delete().eq('product_id', id)
    if (invError) throw new Error(`Delete inventory failed: ${invError.message}`)
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) throw new Error(`Delete product failed: ${error.message}`)
    if (prod?.image_url) {
        const path = prod.image_url.split('/product-images/')[1]
        if (path) await supabase.storage.from('product-images').remove([path])
    }
}

// ─── Update Stock (Atomic RPC — race-safe) ─────────────────────
export async function updateStock({
    productId, branchId, action, amount, userId, reason,
}: {
    productId: string; branchId: string; action: 'ADD' | 'REMOVE'; amount: number; userId?: string; reason?: string
}) {
    const { data, error } = await supabase.rpc('update_stock', {
        p_product_id: productId,
        p_branch_id: branchId,
        p_amount: amount,
        p_action: action,
        p_reason: reason || `Manual ${action.toLowerCase()} of ${amount}`,
        p_user_id: userId || null,
    })

    if (error) throw new Error(`Stock update failed: ${error.message}`)
    return data as { inventory_id: string; old_count: number; new_count: number }
}

// ─── Scan Product by Barcode (Multi-Branch, Indexed) ────────────
export async function scanProduct(barcode: string) {
    // Step 1: Find the product via barcode (exact indexed lookup)
    const { data: invRow, error: invErr } = await supabase
        .from('branch_inventory')
        .select('product_id')
        .eq('barcode', barcode)
        .limit(1)
        .maybeSingle()

    if (invErr) throw new Error(`Scan failed: ${invErr.message}`)
    if (!invRow) return null

    const productId = invRow.product_id

    // Step 2: Fetch product details
    const { data: product, error: prodErr } = await supabase
        .from('products')
        .select('id, name, gold_type, metal_type, purity, weight_base, design_code, image_url, category:categories(name)')
        .eq('id', productId)
        .single()

    if (prodErr || !product) throw new Error('Product fetch failed')

    // Step 3: Fetch ALL branch inventory for this product
    const { data: allInventory, error: allErr } = await supabase
        .from('branch_inventory')
        .select('id, branch_id, sku, barcode, stock_count, selling_price, purchase_price, min_stock_level, updated_at, branch:branches(name)')
        .eq('product_id', productId)
        .order('stock_count', { ascending: false })

    if (allErr) throw new Error(`Inventory fetch failed: ${allErr.message}`)

    const branches = (allInventory ?? []).map((inv: any) => ({
        inventoryId: inv.id,
        branchId: inv.branch_id,
        branchName: inv.branch?.name ?? '—',
        sku: inv.sku,
        barcode: inv.barcode,
        stockCount: inv.stock_count ?? 0,
        minStock: inv.min_stock_level ?? 5,
        sellingPrice: inv.selling_price ?? 0,
        purchasePrice: inv.purchase_price ?? 0,
        lastUpdated: inv.updated_at,
        isLowStock: (inv.stock_count ?? 0) < (inv.min_stock_level ?? 5),
    }))

    const totalStock = branches.reduce((sum: number, b: any) => sum + b.stockCount, 0)
    const p = product as any

    return {
        id: p.id,
        name: p.name,
        gold_type: p.gold_type,
        metal_type: (p as any).metal_type ?? 'Gold',
        purity: (p as any).purity ?? p.gold_type ?? '22K',
        weight: p.weight_base,
        design_code: p.design_code,
        image_url: p.image_url,
        categoryName: p.category?.name ?? '—',
        barcode,
        branches,
        totalStock,
        isLowStock: branches.some((b: any) => b.isLowStock),
    }
}
