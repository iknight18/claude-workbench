'use client';

import { useState, useCallback } from 'react';
import { Plus } from '@phosphor-icons/react';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { createProfile, deleteProfile, updateProfile } from '@/lib/api/profiles';
import type { CreateProfileInput, UpdateProfileInput } from '@/lib/api/profiles';
import ProfileCard from './ProfileCard';

export default function ProfileManager() {
  const { profiles, loading, reload } = useProfiles();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateProfileInput>({
    name: '',
    display_name: '',
  });

  const handleCreate = useCallback(async () => {
    if (!formData.name.trim()) return;
    const created = await createProfile({
      ...formData,
      display_name: formData.display_name?.trim() || undefined,
    });
    setFormData({ name: '', display_name: '' });
    setShowForm(false);
    setExpandedId(created.id);
    reload();
  }, [formData, reload]);

  const handleUpdate = useCallback(async (id: string, input: UpdateProfileInput) => {
    await updateProfile(id, input);
    reload();
  }, [reload]);

  const handleDelete = useCallback(async (id: string, mode: 'unlink' | 'disk') => {
    await deleteProfile(id, mode);
    setExpandedId(null);
    reload();
  }, [reload]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-300">Profiles</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          <Plus size={12} />
          New Profile
        </button>
      </div>

      {/* Inline create form */}
      {showForm && (
        <div className="border border-zinc-800 rounded-lg p-3 space-y-3">
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
              Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((d) => ({ ...d, name: e.target.value }))}
              placeholder="e.g. claude-perso"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={formData.display_name}
              onChange={(e) => setFormData((d) => ({ ...d, display_name: e.target.value }))}
              placeholder="Optional"
              className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={!formData.name.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded transition-colors disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Profile list */}
      {loading ? (
        <div className="text-xs text-zinc-500 py-4">Loading profiles...</div>
      ) : profiles.length === 0 ? (
        <div className="text-xs text-zinc-500 py-4">No profiles found</div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              expanded={expandedId === profile.id}
              onToggle={() => setExpandedId((prev) => (prev === profile.id ? null : profile.id))}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
