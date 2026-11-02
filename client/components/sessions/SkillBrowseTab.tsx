'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  MagnifyingGlass,
  DownloadSimple,
  Check,
  CircleNotch,
  CaretDown,
  CaretRight,
  Eye,
  Globe,
  FolderOpen,
  ArrowClockwise,
} from '@phosphor-icons/react';
import {
  searchSkills,
  resolveSkills,
  installSkill,
  type SearchSkill,
  type ResolvedSkill,
} from '@/lib/api/skills';
import { useTerminals } from '@/lib/contexts/TerminalContext';
import SkillViewerModal from './SkillViewerModal';

type InstallTarget = 'profile' | 'project';

interface PendingInstall {
  source: string;
  skill: ResolvedSkill;
}

interface InstalledSkillInfo {
  name: string;
  source: 'profile' | 'project';
}

interface SkillBrowseTabProps {
  profileId: string;
  sessionId: string;
  sessionName: string;
  profile: string;
  directory: string;
  installedSkills: InstalledSkillInfo[];
  onInstalled: () => void;
}

export default function SkillBrowseTab({
  profileId,
  sessionId,
  sessionName,
  profile,
  directory,
  installedSkills,
  onInstalled,
}: SkillBrowseTabProps) {
  const { killTerminal, startTerminal } = useTerminals();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [expanded, setExpanded] = useState<Record<string, ResolvedSkill[]>>({});
  const [resolving, setResolving] = useState<Record<string, boolean>>({});
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [installError, setInstallError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<{ source: string; branch: string; skillPath: string; skillName: string } | null>(null);

  // Install target dialog
  const [pendingInstall, setPendingInstall] = useState<PendingInstall | null>(null);

  // Restart prompt
  const [restartPrompt, setRestartPrompt] = useState<{ skillName: string } | null>(null);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    setQuery('');
    setResults([]);
    setExpanded({});
    setResolving({});
    setInstalling({});
    setInstalled({});
    setInstallError(null);
    setError(null);
    setPreviewing(null);
    setPendingInstall(null);
    setRestartPrompt(null);
  }, [profileId]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await searchSkills(q);
      setResults(res.skills);
    } catch {
      setError('Search unavailable');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => doSearch(value), 300);
    },
    [doSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleExpand = useCallback(async (source: string) => {
    if (expanded[source]) {
      setExpanded(prev => {
        const next = { ...prev };
        delete next[source];
        return next;
      });
      return;
    }

    setResolving(prev => ({ ...prev, [source]: true }));
    try {
      const res = await resolveSkills(source);
      setExpanded(prev => ({ ...prev, [source]: res.skills }));
    } catch {
      setExpanded(prev => ({ ...prev, [source]: [] }));
    } finally {
      setResolving(prev => ({ ...prev, [source]: false }));
    }
  }, [expanded]);

  const doInstall = useCallback(
    async (source: string, skill: ResolvedSkill, target: InstallTarget) => {
      const key = `${source}/${skill.name}`;
      setInstalling(prev => ({ ...prev, [key]: true }));
      setInstallError(null);
      try {
        await installSkill({
          profileId,
          source,
          skillName: skill.name,
          skillPath: skill.path,
          branch: skill.branch,
          files: skill.files.map(f => f.path),
          target,
          directory: target === 'project' ? directory : undefined,
        });
        setInstalled(prev => ({ ...prev, [`${key}:${target}`]: true }));
        onInstalled();
        setRestartPrompt({ skillName: skill.name });
      } catch (err) {
        setInstallError(`Failed to install ${skill.name}: ${(err as Error).message}`);
      } finally {
        setInstalling(prev => ({ ...prev, [key]: false }));
      }
    },
    [profileId, directory, onInstalled]
  );

  const handleInstallClick = useCallback(
    (source: string, skill: ResolvedSkill) => {
      if (directory) {
        setPendingInstall({ source, skill });
      } else {
        doInstall(source, skill, 'profile');
      }
    },
    [directory, doInstall]
  );

  const handleRestartTerminal = useCallback(async () => {
    setRestarting(true);
    try {
      await killTerminal(sessionId);
      await startTerminal(sessionId, sessionName, profile);
    } catch {}
    setRestarting(false);
    setRestartPrompt(null);
  }, [sessionId, sessionName, profile, killTerminal, startTerminal]);

  const getInstallStatus = useCallback(
    (source: string, name: string): { profile: boolean; project: boolean } => {
      const key = `${source}/${name}`;
      const fromDb = installedSkills.filter(s => s.name === name);
      return {
        profile: fromDb.some(s => s.source === 'profile') || installed[`${key}:profile`] || false,
        project: fromDb.some(s => s.source === 'project') || installed[`${key}:project`] || false,
      };
    },
    [installed, installedSkills]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="p-2 border-b border-zinc-800/50">
        <div className="relative">
          <MagnifyingGlass
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600"
          />
          <input
            type="text"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search skills.sh..."
            className="w-full pl-7 pr-2 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-20 text-xs text-zinc-600">
            <CircleNotch size={14} className="animate-spin mr-2" />
            Searching...
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center h-20 text-xs text-zinc-500">
            {error}
          </div>
        )}

        {installError && (
          <div className="px-3 py-1.5 text-[10px] text-red-400 bg-red-500/5 border-b border-zinc-800/30">
            {installError}
          </div>
        )}

        {/* Restart prompt banner */}
        {restartPrompt && (
          <div className="px-3 py-2 bg-amber-500/5 border-b border-amber-500/20">
            <p className="text-[11px] text-amber-400 mb-1.5">
              <strong>{restartPrompt.skillName}</strong> installed. Restart the terminal for changes to take effect.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRestartTerminal}
                disabled={restarting}
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-500 bg-emerald-500/10 rounded hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
              >
                <ArrowClockwise size={10} className={restarting ? 'animate-spin' : ''} />
                {restarting ? 'Restarting...' : 'Restart for me'}
              </button>
              <button
                onClick={() => setRestartPrompt(null)}
                className="text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors"
              >
                I'll do it myself
              </button>
            </div>
          </div>
        )}

        {!loading && !error && results.length === 0 && query && (
          <div className="flex items-center justify-center h-20 text-xs text-zinc-600">
            No skills found
          </div>
        )}

        {!loading &&
          results.map(result => {
            const isExpanded = !!expanded[result.source];
            const isResolving = resolving[result.source];
            const resolvedSkills = expanded[result.source] || [];

            return (
              <div key={result.id} className="border-b border-zinc-800/30">
                <button
                  onClick={() => handleExpand(result.source)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-800/20 transition-colors text-left"
                >
                  <span className="text-zinc-600">
                    {isResolving ? (
                      <CircleNotch size={10} className="animate-spin" />
                    ) : isExpanded ? (
                      <CaretDown size={10} />
                    ) : (
                      <CaretRight size={10} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-zinc-300 truncate">
                      {result.name}
                    </div>
                    <div className="text-[10px] text-zinc-600 truncate">
                      {result.source}
                      {result.installs > 0 && (
                        <span className="ml-2">{result.installs.toLocaleString()} installs</span>
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && resolvedSkills.length === 0 && !isResolving && (
                  <div className="px-7 py-2 text-[10px] text-zinc-600">
                    No skills found in this repository
                  </div>
                )}

                {isExpanded &&
                  resolvedSkills.map(skill => {
                    const key = `${result.source}/${skill.name}`;
                    const isSkillInstalling = installing[key];
                    const status = getInstallStatus(result.source, skill.name);
                    const fullyInstalled = status.profile && status.project;
                    const partiallyInstalled = status.profile || status.project;

                    return (
                      <div
                        key={skill.name}
                        className="px-3 pl-7 py-2 hover:bg-zinc-800/20 transition-colors space-y-1.5"
                      >
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-300 font-medium truncate">{skill.name}</div>
                          {skill.description && (
                            <div className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5">
                              {skill.description}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            onClick={() => setPreviewing({
                              source: result.source,
                              branch: skill.branch,
                              skillPath: skill.path,
                              skillName: skill.name,
                            })}
                            className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-zinc-500 hover:text-zinc-300 bg-zinc-800/50 rounded transition-colors"
                            title="Preview skill"
                          >
                            <Eye size={10} />
                            Preview
                          </button>

                          {isSkillInstalling ? (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-zinc-500">
                              <CircleNotch size={10} className="animate-spin" />
                              Installing...
                            </span>
                          ) : fullyInstalled || (!directory && status.profile) ? (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-emerald-500 bg-emerald-500/10 rounded">
                              <Check size={10} />
                              Installed
                            </span>
                          ) : partiallyInstalled ? (
                            <>
                              <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-emerald-500 bg-emerald-500/10 rounded">
                                <Check size={10} />
                                {status.profile ? 'Profile' : 'Project'}
                              </span>
                              <button
                                onClick={() => doInstall(result.source, skill, status.profile ? 'project' : 'profile')}
                                className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-blue-400 bg-blue-500/10 rounded hover:bg-blue-500/20 transition-colors"
                              >
                                <DownloadSimple size={10} />
                                + {status.profile ? 'Project' : 'Profile'}
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleInstallClick(result.source, skill)}
                              className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-emerald-500 bg-emerald-500/10 rounded hover:bg-emerald-500/20 transition-colors"
                            >
                              <DownloadSimple size={10} />
                              Install
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            );
          })}
      </div>

      {previewing && (
        <SkillViewerModal
          skillName={previewing.skillName}
          source={previewing.source}
          branch={previewing.branch}
          skillPath={previewing.skillPath}
          onClose={() => setPreviewing(null)}
        />
      )}

      {/* Install target dialog */}
      {pendingInstall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 max-w-xs w-full mx-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">Install to...</h3>
            <p className="text-xs text-zinc-400">
              Where should <span className="text-zinc-200 font-medium">{pendingInstall.skill.name}</span> be installed?
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  const p = pendingInstall;
                  setPendingInstall(null);
                  doInstall(p.source, p.skill, 'profile');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
              >
                <Globe size={16} className="text-zinc-400 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium text-zinc-200">Profile (global)</div>
                  <div className="text-[10px] text-zinc-500">Available in all sessions using this profile</div>
                </div>
              </button>
              <button
                onClick={() => {
                  const p = pendingInstall;
                  setPendingInstall(null);
                  doInstall(p.source, p.skill, 'project');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition-colors"
              >
                <FolderOpen size={16} className="text-blue-400 flex-shrink-0" />
                <div>
                  <div className="text-xs font-medium text-zinc-200">Project (local)</div>
                  <div className="text-[10px] text-zinc-500">Only available in this project directory</div>
                </div>
              </button>
            </div>
            <button
              onClick={() => setPendingInstall(null)}
              className="w-full text-center text-[11px] text-zinc-500 hover:text-zinc-400 transition-colors py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
