import { supabase } from '../supabase'
import { adminCreateUser, adminResetPassword } from '../supabaseAdmin'

export async function fetchCategories() {
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (error) throw error
    return data ?? []
}

export async function fetchBranches() {
    const { data, error } = await supabase
        .from('branches')
        .select('id, name, city, address, phone, manager_name, status, created_at')
        .order('name')
    if (error) {
        console.error('[fetchBranches] Supabase error:', error.message, error.details, error.hint, error.code)
        throw new Error(`Failed to load branches: ${error.message}`)
    }
    return data ?? []
}

export async function createBranch(branch: {
    name: string
    city?: string
    address?: string
    phone?: string
    manager_name?: string
}) {
    // Auto-generate a unique branch code from name + timestamp
    const code = branch.name
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 10)
        + '-' + Date.now().toString(36).slice(-4).toUpperCase()

    const { data, error } = await supabase
        .from('branches')
        .insert({ ...branch, code, status: 'active' })
        .select()
        .single()
    if (error) throw error
    return data!
}

// Get the MANAGER role UUID from the roles table
async function getManagerRoleId(): Promise<string> {
    const { data, error } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'MANAGER')
        .single()
    if (error || !data) throw new Error('MANAGER role not found in roles table')
    return data.id
}

// Create branch + manager account in one flow
export async function createBranchWithManager(branch: {
    name: string
    city?: string
    address?: string
    phone?: string
    manager_name?: string
    manager_email?: string
    manager_password?: string
}) {
    // Step 1: Create the branch
    const { manager_email, manager_password, ...branchData } = branch
    const branchResult = await createBranch(branchData)

    // Step 2: If manager credentials provided, create manager account
    if (manager_email && manager_password && branch.manager_name) {
        try {
            const roleId = await getManagerRoleId()

            // Direct admin API call — no edge function needed
            const result = await adminCreateUser({
                email: manager_email,
                password: manager_password,
                name: branch.manager_name,
                role_id: roleId,
                branch_id: branchResult.id,
            })

            // Step 3: Update branch with manager_id
            if (result?.user?.id) {
                await supabase.from('branches').update({
                    manager_id: result.user.id,
                }).eq('id', branchResult.id)
            }
        } catch (managerError: any) {
            console.error('[createBranchWithManager] Manager creation failed:', managerError)
            throw new Error(`Branch created, but manager account failed: ${managerError.message}`)
        }
    }

    return branchResult
}

// Reset a user's password (admin only)
export async function resetUserPassword(userId: string, newPassword: string) {
    return adminResetPassword(userId, newPassword)
}

export async function updateBranch(id: string, updates: {
    name?: string
    city?: string
    address?: string
    phone?: string
    manager_name?: string
}) {
    const { data, error } = await supabase
        .from('branches')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function toggleBranchStatus(id: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
    const { data, error } = await supabase
        .from('branches')
        .update({ status: newStatus })
        .eq('id', id)
        .select()
        .single()
    if (error) throw error
    return data
}

export async function fetchUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*, role:roles(name), branch:branches(name)')
        .order('name')
    if (error) throw error
    return (data ?? []).map((u: any) => ({
        ...u,
        role: u.role?.name ?? 'USER',
        branch: u.branch,
    }))
}

export async function createUser(user: { name: string; email: string; password?: string; role: string; branch_id?: string }) {
    // Use direct admin API — no edge function needed
    // First, get the role_id from the role name
    const { data: roleData, error: roleError } = await supabase
        .from('roles')
        .select('id')
        .eq('name', user.role)
        .single()

    if (roleError || !roleData) {
        throw new Error(`Role '${user.role}' not found`)
    }

    return adminCreateUser({
        email: user.email,
        password: user.password || 'TempPass@123',
        name: user.name,
        role_id: roleData.id,
        branch_id: user.branch_id,
    })
}

export async function updateUser(id: string, updates: any) {
    const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single()
    if (error) throw error
    return data
}

export async function deleteUser(id: string) {
    const { error } = await supabase.from('users').delete().eq('id', id)
    if (error) throw error
}
