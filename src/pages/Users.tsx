import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Users as UsersIcon, Shield, Loader2, Building2, Trash2, Edit, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useUsers, useBranches, usePageTitle } from '@/hooks'
import { deleteUser, createUser } from '@/lib/api/common'
import { useQueryClient } from '@tanstack/react-query'

export default function Users() {
    usePageTitle('Users');
    const { data: users = [], isLoading } = useUsers()
    const { data: branches = [] } = useBranches()
    const [showAddForm, setShowAddForm] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const queryClient = useQueryClient()

    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'USER', branch_id: '' })
    const updateField = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }))

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name.trim()) return toast.error('Name is required')
        if (!form.email.trim()) return toast.error('Email is required')
        if (!form.password.trim() || form.password.length < 6) return toast.error('Password must be at least 6 characters')

        setIsSubmitting(true)
        try {
            await createUser({
                name: form.name.trim(),
                email: form.email.trim(),
                password: form.password,
                role: form.role,
                branch_id: form.branch_id || undefined,
            })
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast.success(`User "${form.name}" created!`)
            setShowAddForm(false)
            setForm({ name: '', email: '', password: '', role: 'USER', branch_id: '' })
        } catch (err: any) {
            toast.error(err.message || 'Failed to create user')
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteUser = async (id: string, name: string) => {
        if (!confirm(`Delete user "${name}"?`)) return
        try {
            await deleteUser(id)
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast.success(`User "${name}" deleted`)
        } catch {
            toast.error('Failed to delete user')
        }
    }

    const inputClass = 'w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30'

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold heading-luxury">User Management</h2>
                    <p className="text-muted-foreground text-sm">Manage system users and permissions.</p>
                </div>
                <button
                    onClick={() => setShowAddForm(true)}
                    className="gold-gradient text-black px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:shadow-lg hover:shadow-gold/20 transition-all"
                >
                    <Plus className="w-4 h-4" /> Add User
                </button>
            </div>

            {/* Add User Modal */}
            <AnimatePresence>
                {showAddForm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setShowAddForm(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass-card rounded-2xl p-8 w-full max-w-md"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-xl font-bold heading-luxury flex items-center gap-2">
                                    <UsersIcon className="w-5 h-5 text-gold" /> Add New User
                                </h3>
                                <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-secondary rounded-lg"><X className="w-5 h-5" /></button>
                            </div>
                            <form onSubmit={handleAddUser} className="space-y-4">
                                <div>
                                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Full Name *</label>
                                    <input value={form.name} onChange={e => updateField('name', e.target.value)} placeholder="e.g. Rajesh Kumar" className={inputClass} required />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Email *</label>
                                    <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="e.g. rajesh@virudtijewells.com" className={inputClass} required />
                                </div>
                                <div>
                                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Temporary Password *</label>
                                    <input type="password" value={form.password} onChange={e => updateField('password', e.target.value)} placeholder="min 6 chars" className={inputClass} required minLength={6} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Role</label>
                                        <select value={form.role} onChange={e => updateField('role', e.target.value)} className={inputClass}>
                                            <option value="USER">User</option>
                                            <option value="ADMIN">Admin</option>
                                            <option value="MANAGER">Manager</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Branch</label>
                                        <select value={form.branch_id} onChange={e => updateField('branch_id', e.target.value)} className={inputClass}>
                                            <option value="">No branch</option>
                                            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 border border-border px-4 py-2.5 rounded-xl text-sm hover:bg-secondary">Cancel</button>
                                    <button type="submit" disabled={isSubmitting} className="flex-1 gold-gradient text-black px-4 py-2.5 rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        {isSubmitting ? 'Creating...' : 'Create User'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* User Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isLoading ? (
                    <div className="col-span-full flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-gold" />
                    </div>
                ) : users.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">No users found</div>
                ) : (
                    users.map((user: any) => (
                        <motion.div
                            key={user.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-card rounded-2xl p-6 hover:border-gold/20 transition-all"
                        >
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-lg shrink-0">
                                    {user.name?.charAt(0) ?? '?'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold truncate">{user.name}</h3>
                                    <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                                    <div className="flex items-center gap-3 mt-3">
                                        <span className="flex items-center gap-1 text-xs bg-gold/10 text-gold px-2 py-1 rounded-lg">
                                            <Shield className="w-3 h-3" /> {user.role}
                                        </span>
                                        {user.branch && (
                                            <span className="flex items-center gap-1 text-xs bg-secondary px-2 py-1 rounded-lg">
                                                <Building2 className="w-3 h-3" /> {user.branch.name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button
                                        onClick={() => toast.info(`Edit user: ${user.name}`)}
                                        className="p-2 hover:bg-secondary rounded-lg transition-all"
                                    >
                                        <Edit className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(user.id, user.name)}
                                        className="p-2 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    )
}
