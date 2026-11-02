'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  Play,
  Trash,
  Power,
  FolderOpen,
  CaretDown,
  CaretRight,
  CalendarCheck,
} from '@phosphor-icons/react';
import { EditorView } from '@codemirror/view';
import MarkdownEditor from '@/components/shared/MarkdownEditor';
import ToolsPromptTab from '@/components/sessions/ToolsPromptTab';
import FrequencyPicker from './FrequencyPicker';
import DirectoryBrowser from '@/components/sessions/DirectoryBrowser';
import RunHistory from './RunHistory';
import ProfileSelector from '@/components/sessions/ProfileSelector';
import EmptyState from '@/components/shared/EmptyState';
import type { TaskWithRuns, ScheduledTask } from '@/lib/api/scheduler';
import type { Profile } from '@/lib/api/profiles';
import { runTaskNow } from '@/lib/api/scheduler';

interface TaskEditorProps {
  task: TaskWithRuns | null;
  profiles: Profile[];
  onUpdate: (id: string, input: Partial<{
    name: string;
    prompt: string;
    cron_expression: string;
    directory: string;
    profile: string;
    enabled: boolean;
    scheduled_at: string | null;
  }>) => Promise<ScheduledTask>;
  onDelete: (id: string) => void;
  onRunNow: () => void;
  onCreate?: () => void;
}

export default function TaskEditor({
  task,
  profiles,
  onUpdate,
  onDelete,
  onRunNow,
  onCreate,
}: TaskEditorProps) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [cronExpression, setCronExpression] = useState('');
  const [directory, setDirectory] = useState('');
  const [profile, setProfile] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [running, setRunning] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [promptsOpen, setPromptsOpen] = useState(false);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const lastSyncedRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (!task) return;
    const fingerprint = `${task.id}|${task.name}|${task.directory}|${task.profile}|${task.cron_expression}|${task.prompt}|${task.enabled}|${task.scheduled_at}`;
    if (fingerprint === lastSyncedRef.current) return;
    lastSyncedRef.current = fingerprint;

    setName(task.name);
    setPrompt(task.prompt);
    setCronExpression(task.cron_expression);
    setDirectory(task.directory);
    setEnabled(task.enabled);
    setScheduledAt(task.scheduled_at);

    // Auto-select first profile if none set (default profile is unauthenticated)
    if (!task.profile && profiles.length > 0) {
      const newProfile = profiles[0].name;
      setProfile(newProfile);
      trackedUpdate(task.id, { profile: newProfile });
    } else {
      setProfile(task.profile);
    }
  }, [task, profiles, trackedUpdate]);

  const handleNameSave = useCallback(() => {
    if (!task || name === task.name) return;
    trackedUpdate(task.id, { name }).catch(() => setName(task.name));
  }, [task, name, trackedUpdate]);

  const handleDirectorySave = useCallback((dir?: string) => {
    const val = dir ?? directory;
    if (!task || val === task.directory) return;
    trackedUpdate(task.id, { directory: val }).catch(() => setDirectory(task.directory));
  }, [task, directory, trackedUpdate]);

  const handleProfileChange = useCallback((newProfile: string) => {
    if (!task) return;
    setProfile(newProfile);
    trackedUpdate(task.id, { profile: newProfile }).catch(() => setProfile(task.profile));
  }, [task, trackedUpdate]);

  const handlePromptSave = useCallback(() => {
    if (!task || prompt === task.prompt) return;
    trackedUpdate(task.id, { prompt }).catch(() => setPrompt(task.prompt));
  }, [task, prompt, trackedUpdate]);

  const handleFrequencyChange = useCallback((cron: string) => {
    setCronExpression(cron);
    if (!task) return;
    trackedUpdate(task.id, { cron_expression: cron }).catch(() => setCronExpression(task.cron_expression));
  }, [task, trackedUpdate]);

  const handleScheduledAtChange = useCallback((date: string | null) => {
    setScheduledAt(date);
    if (!task) return;
    trackedUpdate(task.id, { scheduled_at: date }).catch(() => setScheduledAt(task.scheduled_at));
  }, [task, trackedUpdate]);

  const handleRunNow = useCallback(async () => {
    if (!task) return;
    setRunning(true);
    try {
      await runTaskNow(task.id);
      onRunNow();
    } finally {
      setTimeout(() => setRunning(false), 2000);
    }
  }, [task, onRunNow]);

  const handlePromptInsert = useCallback((text: string) => {
    if (editorView) {
      const { from, to } = editorView.state.selection.main;
      editorView.dispatch({
        changes: { from, to, insert: text },
      });
      editorView.focus();
    } else {
      setPrompt(prev => prev ? `${prev}\n${text}` : text);
    }
  }, [editorView]);

  if (!task) {
    return (
      <EmptyState
        icon={<CalendarCheck size={32} weight="light" />}
        title="No task selected"
        description="Select a task from the list, or create one to automate Claude workflows on a schedule."
        action={onCreate ? { label: 'New Task', onClick: onCreate, shortcut: 'Alt+N' } : undefined}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>Schedule</span>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400">{name || 'New Task'}</span>
        </div>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && <span className="text-xs text-zinc-500">Saving...</span>}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-emerald-500">
              <Check size={12} weight="bold" /> Saved
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-xs text-red-400">{saveError}</span>
          )}
          <button
            onClick={() => { const next = !enabled; setEnabled(next); trackedUpdate(task.id, { enabled: next }); }}
            title={enabled ? 'Disable' : 'Enable'}
            className={`flex items-center gap-1 px-2 py-1 text-xs rounded-lg transition-colors ${
              enabled ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-500 bg-zinc-800'
            }`}
          >
            <Power size={12} />
            {enabled ? 'On' : 'Off'}
          </button>
          <button
            onClick={handleRunNow}
            disabled={running}
            className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-500 hover:text-emerald-500 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <Play size={12} weight="fill" />
            {running ? 'Started' : 'Run Now'}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 space-y-4 border-b border-zinc-800">
          {/* Name */}
          <div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onBlur={handleNameSave}
              placeholder="Task name"
              className="w-full text-base font-semibold bg-transparent text-zinc-100 placeholder:text-zinc-600 focus:outline-none tracking-tight"
            />
          </div>

          {/* Directory + Profile row */}
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">Directory</label>
              <button
                type="button"
                onClick={() => setBrowserOpen(true)}
                title={directory || 'Browse directories'}
                className="w-full flex items-center gap-2 px-2 py-1 text-xs font-mono bg-zinc-900 border border-zinc-800 rounded text-left text-zinc-300 hover:border-zinc-700 focus:outline-none focus:border-zinc-700"
              >
                <FolderOpen size={14} className="text-zinc-600 flex-shrink-0" />
                <span className="flex-1 truncate">
                  {directory || <span className="text-zinc-600">/path/to/project</span>}
                </span>
              </button>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">Profile</label>
              <ProfileSelector value={profile} profiles={profiles} onChange={handleProfileChange} />
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">Frequency</label>
            <FrequencyPicker
              value={cronExpression}
              onChange={handleFrequencyChange}
              scheduledAt={scheduledAt}
              onScheduledAtChange={handleScheduledAtChange}
            />
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-1">Prompt</label>
            <div
              className="border border-zinc-800 rounded-lg overflow-hidden [&_.cm-editor]:!h-full"
              style={{ resize: 'vertical', minHeight: '120px', height: '120px' }}
            >
              <MarkdownEditor
                value={prompt}
                onChange={setPrompt}
                onBlur={handlePromptSave}
                placeholder="The instruction sent to Claude when this task runs..."
                onViewReady={setEditorView}
              />
            </div>
          </div>

          {/* Saved Prompts collapsible */}
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setPromptsOpen(!promptsOpen)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-500 uppercase tracking-wider hover:bg-zinc-800/30 transition-colors"
            >
              {promptsOpen ? <CaretDown size={10} /> : <CaretRight size={10} />}
              Saved Prompts
            </button>
            {promptsOpen && (
              <div className="h-64 border-t border-zinc-800">
                <ToolsPromptTab onInsert={handlePromptInsert} />
              </div>
            )}
          </div>

          {/* Delete */}
          <div className="pt-2 border-t border-zinc-800/50">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Delete this task and all its runs?</span>
                <button
                  onClick={() => { onDelete(task.id); setConfirmDelete(false); }}
                  className="px-2 py-0.5 text-xs text-red-500 bg-red-500/10 rounded hover:bg-red-500/20 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 text-xs text-zinc-600 hover:text-red-400 transition-colors"
              >
                <Trash size={12} />
                Delete task
              </button>
            )}
          </div>
        </div>

        {/* Run History */}
        <div className="px-4 py-3">
          <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Run History</div>
          <RunHistory runs={task.recent_runs} />
        </div>
      </div>
      <DirectoryBrowser
        open={browserOpen}
        initialPath={directory || undefined}
        onSelect={(d) => { setDirectory(d); handleDirectorySave(d); }}
        onClose={() => setBrowserOpen(false)}
      />
    </div>
  );
}
