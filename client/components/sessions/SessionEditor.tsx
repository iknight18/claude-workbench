'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  Copy,
  GitBranch,
  FolderOpen,
  FolderSimple,
  Notepad,
  CaretDown,
  CaretUp,
  Lightning,
  ShieldSlash,
  Bell,
  ArrowSquareOut,
  Bug,
  Terminal,
} from '@phosphor-icons/react';
import TagEditor from '@/components/prompts/TagEditor';
import EmptyState from '@/components/shared/EmptyState';
import DirectoryBrowser from './DirectoryBrowser';
import SessionTerminal from './SessionTerminal';
import SessionToolsPanel from './SessionToolsPanel';
import ProfileSelector from './ProfileSelector';
import DebugLogPanel from './DebugLogPanel';
import type { Session, SessionWithGit } from '@/lib/api/sessions';
import type { Profile } from '@/lib/api/profiles';
import { fetchSession } from '@/lib/api/sessions';
import { apiFetch } from '@/lib/api/client';
import { useTerminals } from '@/lib/contexts/TerminalContext';

type SessionStatus = 'active' | 'completed' | 'archived';

interface SessionEditorProps {
  session: Session | null;
  allTags: string[];
  profiles: Profile[];
  groups: string[];
  onUpdate: (
    id: string,
    input: Partial<{
      name: string;
      directory: string;
      status: string;
      profile: string;
      skip_permissions: boolean;
      debug_enabled: boolean;
      group: string;
      notes: string;
      tags: string[];
    }>
  ) => Promise<Session>;
  onCreate?: () => void;
}

const statusConfig: Record<
  SessionStatus,
  { dot: string; text: string; label: string }
> = {
  active: { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Active' },
  completed: { dot: 'bg-zinc-500', text: 'text-zinc-400', label: 'Completed' },
  archived: { dot: 'bg-zinc-700', text: 'text-zinc-500', label: 'Archived' },
};

const statusCycle: SessionStatus[] = ['active', 'completed', 'archived'];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SessionEditor({
  session,
  allTags,
  profiles,
  groups,
  onUpdate,
  onCreate,
}: SessionEditorProps) {
  const [name, setName] = useState('');
  const [directory, setDirectory] = useState('');
  const [status, setStatus] = useState<SessionStatus>('active');
  const [profile, setProfile] = useState('');
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [hooksEnabled, setHooksEnabled] = useState(false);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [group, setGroup] = useState('');
  const [showGroupSuggestions, setShowGroupSuggestions] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const terminalInsertRef = useRef<((text: string) => void) | null>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const savedProfileRef = useRef('');
  const [profileChangeConfirm, setProfileChangeConfirm] = useState<{
    newProfile: string;
    oldProfile: string;
  } | null>(null);
  const [debugChangeConfirm, setDebugChangeConfirm] = useState(false);
  const [skipPermsChangeConfirm, setSkipPermsChangeConfirm] = useState(false);
  const { terminals, killTerminal, startTerminal, focusTerminal } = useTerminals();

  useEffect(() => {
    if (!session) return;
    const fingerprint = `${session.id}|${session.name}|${session.directory}|${session.status}|${session.profile}|${session.skip_permissions}|${session.hooks_enabled}|${session.debug_enabled}|${session.group ?? ''}|${session.notes}|${session.tags.join(',')}`;
    if (fingerprint === lastSyncedRef.current) return;
    lastSyncedRef.current = fingerprint;

    setName(session.name);
    setDirectory(session.directory);
    setStatus(session.status);
    setProfile(session.profile);
    savedProfileRef.current = session.profile;
    setSkipPermissions(session.skip_permissions);
    setHooksEnabled(session.hooks_enabled);
    setDebugEnabled(session.debug_enabled);
    setGroup(session.group ?? '');
    setTags(session.tags);
    setNotes(session.notes);
  }, [session]);

  // Collapse notes on session switch
  useEffect(() => {
    setNotesExpanded(false);
  }, [session?.id]);

  // Auto-select first profile if none set and persist to server
  useEffect(() => {
    if (!profile && profiles.length > 0 && session) {
      const first = profiles[0].name;
      setProfile(first);
      savedProfileRef.current = first;
      onUpdate(session.id, { profile: first }).catch(() => {});
    }
  }, [profile, profiles, session]);

  // Fetch git branch only on session switch (not after every save)
  useEffect(() => {
    if (!session) return;
    fetchSession(session.id)
      .then((full: SessionWithGit) => setGitBranch(full.git_branch))
      .catch(() => setGitBranch(null));
  }, [session?.id]);

  const trackedUpdate = useCallback(async (id: string, input: Parameters<typeof onUpdate>[1]) => {
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const result = await onUpdate(id, input);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(prev => prev === 'saved' ? 'idle' : prev), 1500);
      return result;
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
      setTimeout(() => { setSaveStatus('idle'); setSaveError(null); }, 4000);
      throw err;
    }
  }, [onUpdate]);

  const handleProfileChange = useCallback(async (newProfile: string) => {
    if (!session) return;
    const terminalEntry = terminals.get(session.id);
    const terminalRunning = terminalEntry?.status === 'running';

    if (terminalRunning) {
      setProfile(newProfile);
      setProfileChangeConfirm({ newProfile, oldProfile: savedProfileRef.current });
      return;
    }

    setProfile(newProfile);
    try {
      await trackedUpdate(session.id, { profile: newProfile });
      savedProfileRef.current = newProfile;
    } catch {
      setProfile(savedProfileRef.current); // revert on failure
    }
  }, [session, terminals, trackedUpdate]);

  const handleProfileChangeConfirm = useCallback(async () => {
    if (!session || !profileChangeConfirm) return;
    try {
      await trackedUpdate(session.id, { profile: profileChangeConfirm.newProfile });
      savedProfileRef.current = profileChangeConfirm.newProfile;
      setProfileChangeConfirm(null);
      await killTerminal(session.id);
      try {
        await startTerminal(session.id, name, profileChangeConfirm.newProfile);
      } catch {
        // Terminal start error handled by context
      }
    } catch {
      setProfile(profileChangeConfirm.oldProfile);
      setProfileChangeConfirm(null);
    }
  }, [session, profileChangeConfirm, trackedUpdate, killTerminal, startTerminal, name]);

  const handleProfileChangeCancel = useCallback(() => {
    if (profileChangeConfirm) {
      setProfile(profileChangeConfirm.oldProfile);
    }
    setProfileChangeConfirm(null);
  }, [profileChangeConfirm]);

  const handleCopy = useCallback(() => {
    if (directory) {
      navigator.clipboard.writeText(directory);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [directory]);

  const openInVSCode = useCallback(async () => {
    if (!directory) return;
    try {
      const health = await apiFetch<{ isDocker: boolean; workspaceHostPath: string | null }>('/health');
      let hostPath = directory;
      if (health.isDocker && health.workspaceHostPath) {
        hostPath = directory.replace(/^\/workspace/, health.workspaceHostPath);
      }
      window.open(`vscode://file/${hostPath}`, '_self');
    } catch {
      // Fallback: try opening with the directory as-is
      window.open(`vscode://file/${directory}`, '_self');
    }
  }, [directory]);

  const cycleStatus = useCallback(async () => {
    if (!session) return;
    const idx = statusCycle.indexOf(status);
    const next = statusCycle[(idx + 1) % statusCycle.length];
    setStatus(next);
    try {
      await trackedUpdate(session.id, { status: next });
    } catch {
      setStatus(status); // revert on failure
    }
  }, [status, session, trackedUpdate]);

  const handleGroupSave = useCallback(async (newGroup: string) => {
    if (!session) return;
    setGroup(newGroup);
    try {
      await trackedUpdate(session.id, { group: newGroup });
    } catch {
      setGroup(session.group ?? '');
    }
  }, [session, trackedUpdate]);

  const handleDirectorySave = useCallback(async (newDir: string) => {
    if (!session) return;
    setDirectory(newDir);
    try {
      await trackedUpdate(session.id, { directory: newDir });
    } catch {
      setDirectory(session.directory);
    }
  }, [session, trackedUpdate]);

  const handleNotesSave = useCallback(async () => {
    if (!session || notes === session.notes) return;
    try {
      await trackedUpdate(session.id, { notes });
    } catch {
      setNotes(session.notes);
    }
  }, [session, notes, trackedUpdate]);

  const handleNameSave = useCallback(async () => {
    if (!session || name === session.name) return;
    try {
      await trackedUpdate(session.id, { name });
    } catch {
      setName(session.name);
    }
  }, [session, name, trackedUpdate]);

  const handleTagsChange = useCallback(async (newTags: string[]) => {
    if (!session) return;
    const oldTags = tags;
    setTags(newTags);
    try {
      await trackedUpdate(session.id, { tags: newTags });
    } catch {
      setTags(oldTags);
    }
  }, [session, tags, trackedUpdate]);

  const handleTerminalInsert = useCallback((text: string) => {
    terminalInsertRef.current?.(text);
    if (session) focusTerminal(session.id);
  }, [session, focusTerminal]);

  const handleRegisterInsert = useCallback(
    (fn: ((text: string) => void) | null) => {
      terminalInsertRef.current = fn;
    },
    []
  );

  const groupSuggestions = groups.filter(
    g => g !== group && g.toLowerCase().includes(group.toLowerCase())
  );

  if (!session) {
    return (
      <EmptyState
        icon={<Terminal size={32} weight="light" />}
        title="No session selected"
        description="Select a session from the list, or create one to start a new Claude conversation."
        action={onCreate ? { label: 'New Session', onClick: onCreate, shortcut: 'Alt+N' } : undefined}
      />
    );
  }

  const sc = statusConfig[status];

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>Session</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400">{name || 'Untitled'}</span>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && <span className="text-xs text-zinc-500">Saving...</span>}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <Check size={12} weight="bold" />
              Saved
            </span>
          )}
          {saveStatus === 'error' && saveError && (
            <span className="text-xs text-red-400">{saveError}</span>
          )}
          {debugEnabled && (
            <button
              onClick={() => setDebugOpen(!debugOpen)}
              title="Toggle debug log panel"
              className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors ${
                debugOpen
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              <Bug size={14} />
              Logs
            </button>
          )}
          <button
            onClick={() => setToolsOpen(!toolsOpen)}
            title="Toggle tools panel"
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors ${
              toolsOpen
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            <Lightning size={14} />
            Tools
          </button>
        </div>
      </div>

      {/* Compact session header */}
      <div className="px-4 py-3 border-b border-zinc-800 space-y-2">
        {/* Row 1: Name + Status + Profile + Date */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={() => handleNameSave()}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            placeholder="Untitled Session"
            className="flex-1 text-base font-semibold bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:outline-none tracking-tight"
          />
          <button
            onClick={cycleStatus}
            className="flex items-center gap-1.5 flex-shrink-0"
            title="Click to change status"
          >
            <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
            <span className={`text-[11px] font-medium ${sc.text}`}>{sc.label}</span>
          </button>
          <div className="w-px h-3 bg-zinc-800 flex-shrink-0" />
          <ProfileSelector
            value={profile}
            profiles={profiles}
            onChange={handleProfileChange}
          />
          <div className="w-px h-3 bg-zinc-800 flex-shrink-0" />
          <button
            onClick={async () => {
              if (!session) return;
              const terminalEntry = terminals.get(session.id);
              const terminalRunning = terminalEntry?.status === 'running';
              if (terminalRunning) {
                setSkipPermsChangeConfirm(true);
                return;
              }
              const next = !skipPermissions;
              setSkipPermissions(next);
              try {
                await trackedUpdate(session.id, { skip_permissions: next });
              } catch {
                setSkipPermissions(!next); // revert on failure
              }
            }}
            title={skipPermissions ? 'Permissions bypassed' : 'Permissions required'}
            className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
              skipPermissions
                ? 'text-amber-400'
                : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            <ShieldSlash size={12} />
            {skipPermissions ? 'Skip perms' : 'Perms'}
          </button>
          <div className="w-px h-3 bg-zinc-800 flex-shrink-0" />
          <button
            onClick={async () => {
              if (!session) return;
              const next = !hooksEnabled;
              try {
                await apiFetch(`/sessions/${session.id}/hooks`, {
                  method: 'POST',
                  body: JSON.stringify({ enabled: next }),
                });
                setHooksEnabled(next);
              } catch {}
            }}
            title={hooksEnabled ? 'Hooks enabled' : 'Hooks disabled'}
            className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
              hooksEnabled
                ? 'text-emerald-400'
                : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            <Bell size={12} />
            {hooksEnabled ? 'Hooks' : 'Hooks'}
          </button>
          <div className="w-px h-3 bg-zinc-800 flex-shrink-0" />
          <button
            onClick={async () => {
              if (!session) return;
              const terminalEntry = terminals.get(session.id);
              const terminalRunning = terminalEntry?.status === 'running';
              if (terminalRunning) {
                setDebugChangeConfirm(true);
                return;
              }
              const next = !debugEnabled;
              setDebugEnabled(next);
              try {
                await trackedUpdate(session.id, { debug_enabled: next });
              } catch {
                setDebugEnabled(!next);
              }
            }}
            title={debugEnabled ? 'Debug logging enabled' : 'Debug logging disabled'}
            className={`flex items-center gap-1 text-[11px] font-medium transition-colors ${
              debugEnabled
                ? 'text-emerald-400'
                : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            <Bug size={12} />
            Debug
          </button>
          <div className="w-px h-3 bg-zinc-800 flex-shrink-0" />
          <span className="text-[11px] text-zinc-500 flex-shrink-0">
            {formatDate(session.created_at)}
          </span>
        </div>

        {/* Row 2: Directory + Git Branch + Tags */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex items-center gap-1.5 flex-shrink-0">
            <FolderSimple size={11} className="text-zinc-600" />
            <input
              type="text"
              value={group}
              onChange={e => setGroup(e.target.value)}
              onFocus={() => setShowGroupSuggestions(true)}
              onBlur={() => {
                setTimeout(() => setShowGroupSuggestions(false), 150);
                if (group !== (session?.group ?? '')) handleGroupSave(group);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Group..."
              className="w-24 text-[11px] font-mono bg-transparent text-zinc-400 placeholder:text-zinc-600 focus:outline-none focus:text-zinc-300"
            />
            {showGroupSuggestions && groupSuggestions.length > 0 && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg z-10 overflow-hidden max-h-32 overflow-y-auto">
                {groupSuggestions.map(g => (
                  <button
                    key={g}
                    onMouseDown={e => {
                      e.preventDefault();
                      handleGroupSave(g);
                      setShowGroupSuggestions(false);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-[11px] text-zinc-400 font-mono hover:bg-zinc-800 hover:text-zinc-200 transition-colors truncate"
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="w-px h-3 bg-zinc-800 flex-shrink-0" />
          <div className="relative flex items-center gap-1.5 flex-shrink-0">
            <FolderOpen size={11} className="text-zinc-600" />
            <button
              type="button"
              onClick={() => setBrowserOpen(true)}
              title={directory || 'Set directory'}
              className="w-48 text-left text-[11px] font-mono bg-transparent text-zinc-400 hover:text-zinc-300 focus:outline-none truncate"
            >
              {directory || <span className="text-zinc-600">Set directory...</span>}
            </button>
            <button
              onClick={handleCopy}
              title="Copy path"
              className="text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
            {directory && (
              <button
                onClick={openInVSCode}
                title="Open in VS Code"
                className="text-zinc-600 hover:text-zinc-300 transition-colors"
              >
                <ArrowSquareOut size={11} />
              </button>
            )}
          </div>

          {gitBranch && (
            <>
              <div className="w-px h-3 bg-zinc-800 flex-shrink-0" />
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <GitBranch size={11} className="text-zinc-600" />
                <span className="text-[11px] font-mono text-zinc-400">{gitBranch}</span>
                <div className="w-1 h-1 rounded-full bg-emerald-500" />
              </div>
            </>
          )}

          <div className="w-px h-3 bg-zinc-800 flex-shrink-0" />

          <div className="flex-shrink-0">
            <TagEditor tags={tags} allTags={allTags} onChange={handleTagsChange} />
          </div>

          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            <button
              onClick={() => setNotesExpanded(!notesExpanded)}
              className="flex items-center gap-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              <Notepad size={11} />
              Notes
              {notesExpanded ? <CaretUp size={10} /> : <CaretDown size={10} />}
            </button>
          </div>
        </div>

        {notesExpanded && (
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={() => handleNotesSave()}
            placeholder="Add notes..."
            className="w-full h-20 px-2 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 resize-none font-mono"
          />
        )}
      </div>

      {/* Terminal + Tools area */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0">
            <SessionTerminal
              sessionId={session.id}
              sessionName={name}
              directory={directory}
              profile={profile}
              onRegisterInsert={handleRegisterInsert}
            />
          </div>
          {debugEnabled && debugOpen && (
            <div className="h-64 min-h-0 border-t border-zinc-800">
              <DebugLogPanel sessionId={session.id} />
            </div>
          )}
        </div>

        {toolsOpen && (
          <SessionToolsPanel
            profileId={profiles.find(p => p.name === profile)?.id ?? ''}
            sessionId={session.id}
            sessionName={name}
            profile={profile}
            directory={session.directory}
            onInsert={terminalInsertRef.current ? handleTerminalInsert : undefined}
          />
        )}
      </div>

      {profileChangeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">Change Profile?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Changing profile from{' '}
              <span className="text-zinc-200 font-medium">
                {profileChangeConfirm.oldProfile || 'Default'}
              </span>{' '}
              to{' '}
              <span className="text-zinc-200 font-medium">
                {profileChangeConfirm.newProfile || 'Default'}
              </span>{' '}
              will end the current terminal session and start a new one.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={handleProfileChangeCancel}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProfileChangeConfirm}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                Change & Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {skipPermsChangeConfirm && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              {skipPermissions ? 'Disable' : 'Enable'} Permission Bypass?
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {skipPermissions ? 'Disabling' : 'Enabling'} permission bypass requires a terminal restart to take effect.
              The current terminal session will be ended and a new one started.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setSkipPermsChangeConfirm(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const next = !skipPermissions;
                  setSkipPermissions(next);
                  setSkipPermsChangeConfirm(false);
                  try {
                    await trackedUpdate(session.id, { skip_permissions: next });
                    await killTerminal(session.id);
                    try {
                      await startTerminal(session.id, name, profile);
                    } catch {
                      // Terminal start error handled by context
                    }
                  } catch {
                    setSkipPermissions(!next);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                {skipPermissions ? 'Disable' : 'Enable'} & Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {debugChangeConfirm && session && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              {debugEnabled ? 'Disable' : 'Enable'} Debug Mode?
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {debugEnabled ? 'Disabling' : 'Enabling'} debug mode requires a terminal restart to take effect.
              The current terminal session will be ended and a new one started.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDebugChangeConfirm(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const next = !debugEnabled;
                  setDebugEnabled(next);
                  setDebugChangeConfirm(false);
                  try {
                    await trackedUpdate(session.id, { debug_enabled: next });
                    await killTerminal(session.id);
                    try {
                      await startTerminal(session.id, name, profile);
                    } catch {
                      // Terminal start error handled by context
                    }
                  } catch {
                    setDebugEnabled(!next);
                  }
                }}
                className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                {debugEnabled ? 'Disable' : 'Enable'} & Restart
              </button>
            </div>
          </div>
        </div>
      )}

      <DirectoryBrowser
        open={browserOpen}
        initialPath={directory || undefined}
        onSelect={handleDirectorySave}
        onClose={() => setBrowserOpen(false)}
      />
    </div>
  );
}
