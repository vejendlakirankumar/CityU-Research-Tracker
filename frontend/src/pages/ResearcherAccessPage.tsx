import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users, Search, X, Plus, RefreshCw,
  UserCheck, Tag, Loader2, AlertCircle, Globe, Lock,
} from 'lucide-react'
import api from '../lib/axios'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubmissionType {
  id: string
  label: string
  slug: string
  is_active: boolean
  description: string | null
}

interface AssignedUser {
  id: string
  name: string
  email: string
  roles: string[]
}

interface GroupItem {
  id: string
  name: string
  slug: string
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ typeId }: { typeId: string }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const { data: assignedData, isLoading } = useQuery<{ data: AssignedUser[] }>({
    queryKey: ['type-users', typeId],
    queryFn: () => api.get(`/admin/submission-types/${typeId}/users`).then((r) => r.data),
  })

  const { data: searchData, isFetching: searching } = useQuery<{ data: AssignedUser[]; meta: object }>({
    queryKey: ['user-search-access', search],
    queryFn: () =>
      api.get('/users', { params: { search: search.trim(), per_page: 10 } }).then((r) => r.data),
    enabled: showSearch && search.trim().length >= 2,
    placeholderData: (prev) => prev,
  })

  const assigned = assignedData?.data ?? []
  const assignedIds = new Set(assigned.map((u) => u.id))

  const syncMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.put(`/admin/submission-types/${typeId}/users`, { user_ids: ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['type-users', typeId] }),
  })

  const addUser = (user: AssignedUser) => {
    if (assignedIds.has(user.id)) return
    syncMutation.mutate([...Array.from(assignedIds), user.id])
    setSearch('')
    setShowSearch(false)
  }

  const removeUser = (userId: string) =>
    syncMutation.mutate(Array.from(assignedIds).filter((id) => id !== userId))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {assigned.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 text-xs rounded-full font-medium">
            <Globe className="w-3.5 h-3.5" /> Open to all researchers
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-full font-medium">
            <Lock className="w-3.5 h-3.5" /> {assigned.length} researcher{assigned.length !== 1 ? 's' : ''} assigned
          </span>
        )}
        {assigned.length > 0 && !syncMutation.isPending && (
          <button onClick={() => syncMutation.mutate([])} className="text-xs text-red-500 hover:text-red-700">
            Remove all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-1.5">
          {assigned.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700 flex-shrink-0">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                <p className="text-xs text-gray-500 truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                  {u.roles?.[0] ?? 'user'}
                </span>
                <button
                  onClick={() => removeUser(u.id)}
                  disabled={syncMutation.isPending}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {assigned.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-3">
              No specific users assigned — category is accessible to everyone
            </p>
          )}
        </div>
      )}

      {showSearch ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 border border-blue-300 rounded-xl px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-blue-500">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              className="flex-1 text-sm outline-none"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            <button onClick={() => { setShowSearch(false); setSearch('') }}>
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          {search.trim().length >= 2 && (
            <div className="border border-gray-200 rounded-xl bg-white max-h-52 overflow-y-auto">
              {searching ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : !searchData || searchData.data.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">No users found</p>
              ) : (
                searchData.data.map((u) => (
                  <button
                    key={u.id}
                    disabled={assignedIds.has(u.id)}
                    onClick={() => addUser(u)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-700 flex-shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <span className="text-xs font-medium flex-shrink-0 capitalize">
                      {assignedIds.has(u.id)
                        ? <span className="text-green-600">✓ Added</span>
                        : <span className="text-blue-600">{u.roles?.[0] ?? ''}</span>
                      }
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <Plus className="w-4 h-4" /> Add researcher
        </button>
      )}

      {syncMutation.isError && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5" /> Failed to update. Please try again.
        </p>
      )}
    </div>
  )
}

// ── Groups Tab ────────────────────────────────────────────────────────────────

function GroupsTab({ typeId }: { typeId: string }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)

  const { data: assignedData, isLoading } = useQuery<{ data: GroupItem[] }>({
    queryKey: ['type-groups', typeId],
    queryFn: () => api.get(`/admin/submission-types/${typeId}/groups`).then((r) => r.data),
  })

  const { data: searchData, isFetching: searching } = useQuery<{ data: GroupItem[] }>({
    queryKey: ['group-search-access', search],
    queryFn: () =>
      api.get('/groups', { params: { search: search.trim(), per_page: 10 } }).then((r) => r.data),
    enabled: showSearch && search.trim().length >= 1,
    placeholderData: (prev) => prev,
  })

  const assigned = assignedData?.data ?? []
  const assignedIds = new Set(assigned.map((g) => g.id))
  const searchResults = (searchData?.data ?? []).filter((g) => !assignedIds.has(g.id))

  const syncMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.put(`/admin/submission-types/${typeId}/groups`, { group_ids: ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['type-groups', typeId] }),
  })

  const addGroup = (g: GroupItem) => {
    syncMutation.mutate([...Array.from(assignedIds), g.id])
    setSearch('')
    setShowSearch(false)
  }

  const removeGroup = (groupId: string) =>
    syncMutation.mutate(Array.from(assignedIds).filter((id) => id !== groupId))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {assigned.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 border border-green-200 text-green-700 text-xs rounded-full font-medium">
            <Globe className="w-3.5 h-3.5" /> No group restrictions
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs rounded-full font-medium">
            <Lock className="w-3.5 h-3.5" /> {assigned.length} group{assigned.length !== 1 ? 's' : ''} assigned
          </span>
        )}
        {assigned.length > 0 && !syncMutation.isPending && (
          <button onClick={() => syncMutation.mutate([])} className="text-xs text-red-500 hover:text-red-700">
            Remove all
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-1.5">
          {assigned.map((g) => (
            <div key={g.id} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-gray-100 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                <p className="text-xs text-gray-500 font-mono truncate">{g.slug}</p>
              </div>
              <button
                onClick={() => removeGroup(g.id)}
                disabled={syncMutation.isPending}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {assigned.length === 0 && (
            <p className="text-sm text-gray-400 italic text-center py-3">
              No groups assigned — accessible to all groups
            </p>
          )}
        </div>
      )}

      {showSearch ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2 border border-purple-300 rounded-xl px-3 py-2.5 bg-white focus-within:ring-2 focus-within:ring-purple-500">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              autoFocus
              className="flex-1 text-sm outline-none"
              placeholder="Search groups by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            <button onClick={() => { setShowSearch(false); setSearch('') }}>
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          {search.trim().length >= 1 && (
            <div className="border border-gray-200 rounded-xl bg-white max-h-52 overflow-y-auto">
              {searching ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-500">No groups found</p>
              ) : (
                searchResults.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => addGroup(g)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-purple-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                      <p className="text-xs text-gray-500 font-mono truncate">{g.slug}</p>
                    </div>
                    <span className="text-xs text-purple-600 font-medium flex-shrink-0">Add →</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium"
        >
          <Plus className="w-4 h-4" /> Add group
        </button>
      )}

      {syncMutation.isError && (
        <p className="flex items-center gap-1 text-xs text-red-600">
          <AlertCircle className="w-3.5 h-3.5" /> Failed to update. Please try again.
        </p>
      )}
    </div>
  )
}

// ── Access Modal ──────────────────────────────────────────────────────────────

function AccessModal({ type, onClose }: { type: SubmissionType; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'users' | 'groups'>('users')
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const { data: usersData } = useQuery<{ data: AssignedUser[] }>({
    queryKey: ['type-users', type.id],
    queryFn: () => api.get(`/admin/submission-types/${type.id}/users`).then((r) => r.data),
  })
  const { data: groupsData } = useQuery<{ data: GroupItem[] }>({
    queryKey: ['type-groups', type.id],
    queryFn: () => api.get(`/admin/submission-types/${type.id}/groups`).then((r) => r.data),
  })

  const userCount = usersData?.data?.length ?? 0
  const groupCount = groupsData?.data?.length ?? 0

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Tag className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900">{type.label}</h2>
            {type.description && (
              <p className="text-sm text-gray-500 mt-0.5 truncate">{type.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 bg-gray-50">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Individual Researchers
            {userCount > 0 && (
              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">{userCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'groups'
                ? 'border-purple-600 text-purple-700 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            User Groups
            {groupCount > 0 && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">{groupCount}</span>
            )}
          </button>
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'users' ? <UsersTab typeId={type.id} /> : <GroupsTab typeId={type.id} />}
        </div>
      </div>
    </div>
  )
}

// ── Category Card ─────────────────────────────────────────────────────────────

function CategoryCard({ type, onClick }: { type: SubmissionType; onClick: () => void }) {
  const { data: usersData } = useQuery<{ data: AssignedUser[] }>({
    queryKey: ['type-users', type.id],
    queryFn: () => api.get(`/admin/submission-types/${type.id}/users`).then((r) => r.data),
  })
  const { data: groupsData } = useQuery<{ data: GroupItem[] }>({
    queryKey: ['type-groups', type.id],
    queryFn: () => api.get(`/admin/submission-types/${type.id}/groups`).then((r) => r.data),
  })

  const userCount = usersData?.data?.length ?? 0
  const groupCount = groupsData?.data?.length ?? 0
  const isRestricted = userCount > 0 || groupCount > 0

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-5 py-4 bg-white border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-sm text-left transition-all group"
    >
      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
        <Tag className="w-5 h-5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{type.label}</p>
        {type.description && (
          <p className="text-sm text-gray-500 truncate mt-0.5">{type.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!type.is_active && (
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactive</span>
        )}
        {isRestricted ? (
          <>
            {userCount > 0 && (
              <span className="flex items-center gap-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 rounded-full">
                <UserCheck className="w-3 h-3" /> {userCount} user{userCount !== 1 ? 's' : ''}
              </span>
            )}
            {groupCount > 0 && (
              <span className="flex items-center gap-1 text-xs bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full">
                <Users className="w-3 h-3" /> {groupCount} group{groupCount !== 1 ? 's' : ''}
              </span>
            )}
          </>
        ) : (
          <span className="flex items-center gap-1 text-xs bg-green-50 border border-green-200 text-green-700 px-2 py-0.5 rounded-full">
            <Globe className="w-3 h-3" /> Open
          </span>
        )}
        <span className="text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Manage →
        </span>
      </div>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface TypesResponse {
  data: SubmissionType[]
  meta: { total: number; current_page: number; last_page: number; per_page: number }
}

export default function ResearcherAccessPage() {
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<SubmissionType | null>(null)

  const { data, isLoading, isError, refetch } = useQuery<TypesResponse>({
    queryKey: ['admin-submission-types-access', search],
    queryFn: () =>
      api.get('/admin/submission-types', {
        params: { search: search || undefined, all: true },
      }).then((r) => r.data),
  })

  const types = data?.data ?? []

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Researcher Access</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Control which researchers or groups can submit under each category.
            Categories with no assignments are open to all active users.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="relative max-w-xs mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Filter categories…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl mb-6">
        <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-semibold mb-1">How access works</p>
          <ul className="space-y-0.5 text-blue-700">
            <li>• <strong>Open</strong> — no assignments, all active users can see and submit this category</li>
            <li>• <strong>Individual Researchers</strong> tab — only listed users can access</li>
            <li>• <strong>User Groups</strong> tab — all members of listed groups can access</li>
            <li>• Individual + group access stacks — a user qualifies if they appear in either list</li>
          </ul>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-red-600 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-5 h-5" />
          <span>Failed to load submission categories. Please refresh.</span>
        </div>
      ) : types.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Tag className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No categories found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {types.map((t) => (
            <CategoryCard key={t.id} type={t} onClick={() => setSelectedType(t)} />
          ))}
        </div>
      )}

      {selectedType && (
        <AccessModal type={selectedType} onClose={() => setSelectedType(null)} />
      )}
    </div>
  )
}
