'use client';

import { useState, useEffect } from 'react';
import {
  CaretRight,
  CaretDown,
  WarningCircle,
  CheckCircle,
  FloppyDisk,
  Trash,
  FolderOpen,
} from '@phosphor-icons/react';
import { fetchProfileConfig, writeProfileConfig } from '@/lib/api/profiles';
import type { Profile, UpdateProfileInput } from '@/lib/api/profiles';
import JsonEditor from '@/components/shared/JsonEditor';

type Tab = 'config' | 'claude-md' | 'settings-json';
type DeleteConfirm = null | 'pending';

interface ProfileCardProps {
  profile: Profile;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (id: string, input: UpdateProfileInput) => Promise<void>;
  onDelete: (id: string, mode: 'unlink' | 'disk') => Promise<void>;
}

export default function ProfileCard({
  profile,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: ProfileCardProps) {
  const [tab, setTab] = useState<Tab>('config');
  const [displayName, setDisplayName] = useState(profile.display_name || '');
  const [claudeMd, setClaudeMd] = useState('');
  const [settingsJson, setSettingsJson] = useState('');
  const [configLoaded, setConfigLoaded] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm>(null);
  const [saving, setSaving] = useState(false);

  // Reset form when profile changes
  useEffect(() => {
    setDisplayName(profile.display_name || '');
    setConfigLoaded(false);
    setTab('config');
    setDeleteConfirm(null);
  }, [profile.id, profile.display_name]);

  // Load config files when switching to those tabs
  useEffect(() => {
    if (!expanded) return;
    if ((tab === 'claude-md' || tab === 'settings-json') && !configLoaded) {
      fetchProfileConfig(profile.id).then((config) => {
        setClaudeMd(config.claudeMd || '');
        setSettingsJson(config.settings ? JSON.stringify(config.settings, null, 2) : '');
        setConfigLoaded(true);
      }).catch(() => {
        setConfigLoaded(true);
      });
    }
  }, [expanded, tab, configLoaded, profile.id]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await onUpdate(profile.id, {
        display_name: displayName || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClaudeMd = async () => {
    setSaving(true);
    try {
      await writeProfileConfig(profile.id, { claudeMd });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettingsJson = async () => {
    try {
      JSON.parse(settingsJson);
    } catch {
      alert('Invalid JSON. Please fix syntax errors before saving.');
      return;
    }
    setSaving(true);
    try {
      await writeProfileConfig(profile.id, { settings: settingsJson });
    } finally {
      setSaving(false);
    }
  };

  const Icon = expanded ? CaretDown : CaretRight;
  const label = profile.display_name || profile.name;

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-zinc-800/40 transition-colors"
      >
        <Icon size={14} className="text-zinc-500 mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-200 truncate">{label}</span>
            {profile.auth_status === 'valid' ? (
              <span title="Authenticated"><CheckCircle size={12} weight="fill" className="text-emerald-500 shrink-0" /></span>
            ) : profile.auth_status === 'expired' ? (
              <span title="Token expired"><WarningCircle size={12} weight="fill" className="text-red-500 shrink-0" /></span>
            ) : (
              <span title="Not authenticated"><WarningCircle size={12} className="text-amber-500 shrink-0" /></span>
            )}
            {!profile.is_active && (
              <span title="Executable not found"><WarningCircle size={12} className="text-red-500 shrink-0" /></span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] font-mono text-zinc-500 truncate">claude-{profile.name}</span>
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-800 px-3 py-3 space-y-3">
          {/* Directory */}
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <FolderOpen size={12} />
            <span className="font-mono truncate">{profile.directory_path}</span>
          </div>

          {/* Tab bar */}
          <div role="tablist" className="flex gap-4 border-b border-zinc-800">
            {(['config', 'claude-md', 'settings-json'] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`pb-1.5 text-xs font-medium transition-colors border-b-2 ${
                  tab === t
                    ? 'text-emerald-500 border-emerald-500'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                {t === 'config' ? 'Config' : t === 'claude-md' ? 'CLAUDE.md' : 'settings.json'}
              </button>
            ))}
          </div>

          {/* Config tab */}
          {tab === 'config' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={profile.name}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded transition-colors disabled:opacity-50"
                >
                  <FloppyDisk size={12} />
                  {saving ? 'Saving...' : 'Save'}
                </button>

                {deleteConfirm === null ? (
                  <button
                    onClick={() => setDeleteConfirm('pending')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  >
                    <Trash size={12} />
                    Delete
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setDeleteConfirm(null);
                        await onDelete(profile.id, 'unlink');
                      }}
                      className="px-2 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                    >
                      Remove from dashboard
                    </button>
                    <button
                      onClick={async () => {
                        setDeleteConfirm(null);
                        await onDelete(profile.id, 'disk');
                      }}
                      className="px-2 py-1.5 text-[11px] font-medium text-red-500 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
                    >
                      Delete from disk
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CLAUDE.md tab */}
          {tab === 'claude-md' && (
            <div className="space-y-2">
              <textarea
                value={claudeMd}
                onChange={(e) => setClaudeMd(e.target.value)}
                className="w-full h-64 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs font-mono text-zinc-300 resize-y focus:outline-none focus:border-zinc-700"
                placeholder={configLoaded ? 'Empty' : 'Loading...'}
              />
              <button
                onClick={handleSaveClaudeMd}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded transition-colors disabled:opacity-50"
              >
                <FloppyDisk size={12} />
                {saving ? 'Saving...' : 'Save to disk'}
              </button>
            </div>
          )}

          {/* settings.json tab */}
          {tab === 'settings-json' && (
            <div className="space-y-2">
              {configLoaded ? (
                <JsonEditor
                  value={settingsJson}
                  onChange={setSettingsJson}
                  placeholder="{}"
                  minHeight="256px"
                />
              ) : (
                <div className="h-64 flex items-center justify-center text-xs text-zinc-500">
                  Loading...
                </div>
              )}
              <button
                onClick={handleSaveSettingsJson}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded transition-colors disabled:opacity-50"
              >
                <FloppyDisk size={12} />
                {saving ? 'Saving...' : 'Save to disk'}
              </button>
            </div>
          )}

          {/* Sign-in happens in Claude Code itself, against this profile's config directory */}
          {profile.auth_status !== 'valid' && (
            <p className="text-[11px] text-zinc-500">
              {profile.auth_status === 'expired' ? 'Session expired.' : 'Not signed in.'} Run{' '}
              <code className="font-mono text-zinc-400">CLAUDE_CONFIG_DIR={profile.directory_path} claude</code>{' '}
              and use <code className="font-mono text-zinc-400">/login</code>.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
