import { useState } from 'react'
import { motion } from 'motion/react'
import { useBranches, useCreateBranchWithManager, useUpdateBranch, useToggleBranchStatus, usePageTitle } from '@/hooks'
import {
    Plus, Search, Edit2, Building2, MapPin, Phone, User,
    CheckCircle2, XCircle, MoreVertical, Loader2, ShieldAlert,
    Mail, KeyRound, Eye, EyeOff, UserPlus, Copy
} from 'lucide-react'
import { toast } from 'sonner'

export default function BranchManagement() {
    usePageTitle('Branch Management')
    const { data: branches = [], isLoading, isError, error, refetch } = useBranches()
    const createMutation = useCreateBranchWithManager()
    const updateMutation = useUpdateBranch()
    const toggleMutation = useToggleBranchStatus()

    const [search, setSearch] = useState('')
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [editingBranch, setEditingBranch] = useState<any | null>(null)
    const [showPassword, setShowPassword] = useState(false)

    // Form state
    const [form, setForm] = useState({
        name: '',
        city: '',
        address: '',
        phone: '',
        manager_name: '',
        manager_email: '',
        manager_password: '',
    })

    const filteredBranches = branches.filter((b: any) =>
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.city?.toLowerCase().includes(search.toLowerCase()) ||
        b.manager_name?.toLowerCase().includes(search.toLowerCase())
    )

    const handleOpenModal = (branch: any = null) => {
        if (branch) {
            setEditingBranch(branch)
            setForm({
                name: branch.name,
                city: branch.city || '',
                address: branch.address || '',
                phone: branch.phone || '',
                manager_name: branch.manager_name || '',
                manager_email: '',
                manager_password: '',
            })
        } else {
            setEditingBranch(null)
            setForm({ name: '', city: '', address: '', phone: '', manager_name: '', manager_email: '', manager_password: '' })
        }
        setShowPassword(false)
        setIsAddModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.name.trim()) return toast.error('Branch name is required')

        if (editingBranch) {
            // When editing, only send branch fields (not manager credentials)
            const { manager_email, manager_password, ...branchUpdates } = form
            updateMutation.mutate({ id: editingBranch.id, updates: branchUpdates }, {
                onSuccess: () => setIsAddModalOpen(false)
            })
        } else {
            // When creating, validate manager email + password if provided
            if (form.manager_email && !form.manager_password) {
                return toast.error('Password is required when creating a manager account')
            }
            if (form.manager_password && !form.manager_email) {
                return toast.error('Email is required when creating a manager account')
            }
            if (form.manager_email && form.manager_password && !form.manager_name) {
                return toast.error('Manager name is required when creating an account')
            }

            createMutation.mutate(form, {
                onSuccess: () => setIsAddModalOpen(false)
            })
        }
    }

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copied!`)
    }

    const inputClass = 'w-full bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all placeholder:text-muted-foreground/40'
    const labelClass = 'text-xs text-muted-foreground uppercase tracking-wider block mb-1.5 font-medium'

    if (isLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-3">
                <Loader2 className="w-10 h-10 text-gold animate-spin" />
                <p className="text-sm text-muted-foreground animate-pulse">Loading branches...</p>
            </div>
        )
    }

    if (isError) {
        console.error('[BranchManagement] Query error:', error)
        return (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] gap-4 p-8">
                <ShieldAlert className="w-12 h-12 text-red-400" />
                <h2 className="text-xl font-semibold text-white/80">Failed to load branches</h2>
                <p className="text-sm text-muted-foreground max-w-md text-center">
                    {(error as any)?.message || 'Could not fetch branch data. This may be a permissions issue.'}
                </p>
                <button
                    onClick={() => refetch()}
                    className="gold-gradient text-black px-6 py-2.5 rounded-xl font-semibold hover:shadow-lg hover:shadow-gold/20 transition-all"
                >
                    Retry
                </button>
            </div>
        )
    }

    return (
        <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold heading-luxury flex items-center gap-3">
                        <Building2 className="w-8 h-8 text-gold" />
                        Branch Management
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage store locations, addresses, and branch managers.</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search branches..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-secondary/50 border border-border rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all w-64"
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="gold-gradient text-black px-5 py-2 rounded-xl font-semibold flex items-center gap-2 text-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all"
                    >
                        <Plus className="w-4 h-4" /> Add Branch
                    </button>
                </div>
            </div>

            {/* Branches Table */}
            <div className="glass-card rounded-2xl border border-gold/10 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b border-white/[0.04] bg-white/[0.02]">
                                <th className="px-6 py-4 text-xs tracking-[0.15em] uppercase text-white/40 font-medium">Branch Name</th>
                                <th className="px-6 py-4 text-xs tracking-[0.15em] uppercase text-white/40 font-medium">Location</th>
                                <th className="px-6 py-4 text-xs tracking-[0.15em] uppercase text-white/40 font-medium">Manager</th>
                                <th className="px-6 py-4 text-xs tracking-[0.15em] uppercase text-white/40 font-medium">Contact</th>
                                <th className="px-6 py-4 text-xs tracking-[0.15em] uppercase text-white/40 font-medium">Status</th>
                                <th className="px-6 py-4 text-xs tracking-[0.15em] uppercase text-white/40 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04]">
                            {filteredBranches.map((branch: any) => (
                                <tr key={branch.id} className="hover:bg-white/[0.01] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-gold/5 flex items-center justify-center border border-gold/10">
                                                <Building2 className="w-4 h-4 text-gold/60" />
                                            </div>
                                            <p className="text-sm font-semibold text-white/90">{branch.name}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-white/70">{branch.city || '—'}</span>
                                            <span className="text-[10px] text-white/40 truncate max-w-[150px]" title={branch.address}>{branch.address}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-white/70">
                                            <User className="w-3.5 h-3.5 text-white/30" />
                                            {branch.manager_name || 'Unassigned'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-white/70">
                                            <Phone className="w-3.5 h-3.5 text-white/30" />
                                            {branch.phone || '—'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${branch.status === 'active'
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                                            }`}>
                                            {branch.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                            {branch.status === 'active' ? 'Active' : 'Inactive'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(branch)}
                                                className="p-2 text-white/40 hover:text-gold hover:bg-gold/10 rounded-lg transition-colors border border-transparent hover:border-gold/20"
                                                title="Edit Branch"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => toggleMutation.mutate({ id: branch.id, currentStatus: branch.status })}
                                                disabled={toggleMutation.isPending}
                                                className={`p-2 rounded-lg transition-colors border border-transparent ${branch.status === 'active'
                                                    ? 'text-white/40 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20'
                                                    : 'text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/20'
                                                    }`}
                                                title={branch.status === 'active' ? 'Deactivate Branch' : 'Activate Branch'}
                                            >
                                                {branch.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredBranches.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                        {search ? `No branches found matching "${search}"` : 'No branches yet. Click "Add Branch" to create one.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="glass-card rounded-2xl w-full max-w-lg border border-gold/20 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold heading-luxury flex items-center gap-2">
                                <Building2 className="w-5 h-5 text-gold" />
                                {editingBranch ? 'Edit Branch' : 'Create New Branch'}
                            </h3>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <XCircle className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Branch Details Section */}
                            <div className="space-y-1 mb-2">
                                <p className="text-xs uppercase tracking-widest text-gold/70 font-semibold">Branch Details</p>
                                <div className="h-px bg-gold/10" />
                            </div>

                            <div>
                                <label className={labelClass}>Branch Name *</label>
                                <input
                                    value={form.name}
                                    onChange={e => setForm({ ...form, name: e.target.value })}
                                    className={inputClass}
                                    placeholder="e.g. Kalavasal Branch"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>City</label>
                                    <input
                                        value={form.city}
                                        onChange={e => setForm({ ...form, city: e.target.value })}
                                        className={inputClass}
                                        placeholder="e.g. Madurai"
                                    />
                                </div>
                                <div>
                                    <label className={labelClass}>Phone</label>
                                    <input
                                        value={form.phone}
                                        onChange={e => setForm({ ...form, phone: e.target.value })}
                                        className={inputClass}
                                        placeholder="e.g. +91 9876543210"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Full Address</label>
                                <textarea
                                    value={form.address}
                                    onChange={e => setForm({ ...form, address: e.target.value })}
                                    className={`${inputClass} min-h-[70px] resize-y`}
                                    placeholder="Enter complete street address..."
                                />
                            </div>

                            {/* Manager Account Section */}
                            <div className="space-y-1 mt-6 mb-2">
                                <p className="text-xs uppercase tracking-widest text-gold/70 font-semibold flex items-center gap-1.5">
                                    <UserPlus className="w-3.5 h-3.5" />
                                    Manager Account {editingBranch && <span className="text-white/30 normal-case">(edit name only)</span>}
                                </p>
                                <div className="h-px bg-gold/10" />
                            </div>

                            <div>
                                <label className={labelClass}>Manager Name</label>
                                <input
                                    value={form.manager_name}
                                    onChange={e => setForm({ ...form, manager_name: e.target.value })}
                                    className={inputClass}
                                    placeholder="e.g. Samy"
                                />
                            </div>

                            {/* Only show email/password for NEW branches */}
                            {!editingBranch && (
                                <>
                                    <div>
                                        <label className={labelClass}>
                                            <Mail className="w-3 h-3 inline mr-1" />
                                            Manager Email
                                        </label>
                                        <input
                                            type="email"
                                            value={form.manager_email}
                                            onChange={e => setForm({ ...form, manager_email: e.target.value })}
                                            className={inputClass}
                                            placeholder="e.g. samy@virudtijewells.com"
                                        />
                                    </div>

                                    <div>
                                        <label className={labelClass}>
                                            <KeyRound className="w-3 h-3 inline mr-1" />
                                            Temporary Password
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                value={form.manager_password}
                                                onChange={e => setForm({ ...form, manager_password: e.target.value })}
                                                className={`${inputClass} pr-10`}
                                                placeholder="e.g. temp@123"
                                                minLength={6}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                                            Manager can login with this email &amp; password immediately
                                        </p>
                                    </div>

                                    {form.manager_email && form.manager_password && (
                                        <div className="bg-gold/5 border border-gold/15 rounded-xl p-3 space-y-2">
                                            <p className="text-xs text-gold/80 font-medium">Login Credentials Preview</p>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-white/60">Email: <span className="text-white/90">{form.manager_email}</span></span>
                                                <button type="button" onClick={() => copyToClipboard(form.manager_email, 'Email')} className="text-gold/60 hover:text-gold">
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-white/60">Password: <span className="text-white/90">{form.manager_password}</span></span>
                                                <button type="button" onClick={() => copyToClipboard(form.manager_password, 'Password')} className="text-gold/60 hover:text-gold">
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.04] mt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-6 py-2.5 rounded-xl border border-border text-sm hover:bg-secondary font-medium transition-colors text-white/80"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                    className="gold-gradient text-black px-8 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-all disabled:opacity-50"
                                >
                                    {(createMutation.isPending || updateMutation.isPending) ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="w-4 h-4" />
                                    )}
                                    {editingBranch ? 'Save Changes' : form.manager_email ? 'Create Branch + Manager' : 'Create Branch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
