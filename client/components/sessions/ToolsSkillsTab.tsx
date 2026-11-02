'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlass,
  PaperPlaneTilt,
  Lightning,
  Trash,
  Eye,
  CaretDown,
  CaretRight,
  Globe,
  FolderOpen,
} from '@phosphor-icons/react';
import { fetchSkills } from '@/lib/api/profiles';
import { uninstallSkill, fetchProjectSkills } from '@/lib/api/skills';
import type { Skill } from '@/lib/api/profiles';
import SkillBrowseTab from './SkillBrowseTab';
import SkillViewerModal from './SkillViewerModal';

type Mode = 'installed' | 'browse';
type SkillSource = 'profile' | 'project';

interface TaggedSkill extends Skill {
  source: SkillSource;
}

interface ToolsSkillsTabProps {
  profileId: string;
  sessionId: string;
  sessionName: string;
  profile: string;
  directory: string;
  onInsert?: (text: string) => void;
}

export default function ToolsSkillsTab({
  profileId,
  sessionId,
  sessionName,
  profile,
  directory,
  onInsert,
}: ToolsSkillsTabProps) {
  const [mode, setMode] = useState<Mode>('installed');
  const [skills, setSkills] = useState<TaggedSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [viewingSkill, setViewingSkill] = useState<TaggedSkill | null>(null);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const results: TaggedSkill[] = [];

      if (profileId) {
        const profileSkills = await fetchSkills(profileId);
        results.push(...profileSkills.map(s => ({ ...s, source: 'profile' as SkillSource })));
      }

      if (directory) {
        try {
          const projectSkills = await fetchProjectSkills(directory);
          for (const s of projectSkills) {
            if (!results.some(r => r.name === s.name)) {
              results.push({ ...s, source: 'project' as SkillSource });
            }
          }
        } catch {}
      }

      setSkills(results);
    } catch {
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [profileId, directory]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleUninstall = useCallback(
    async (skill: TaggedSkill) => {
      setDeleting(skill.name);
      setDeleteError(null);
      try {
        if (skill.source === 'project') {
          await uninstallSkill(profileId, skill.name, 'project', directory);
        } else {
          await uninstallSkill(profileId, skill.name);
        }
        setSkills(prev => prev.filter(s => !(s.name === skill.name && s.source === skill.source)));
        setConfirmDelete(null);
        setExpandedSkill(null);
      } catch {
        setDeleteError(`Failed to remove ${skill.name}`);
      } finally {
        setDeleting(null);
      }
    },
    [profileId, directory]
  );

  const filtered = skills.filter(
    s =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  );

  if (!profileId) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-zinc-600">
        Select a profile to view skills
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode toggle */}
      <div className="flex border-b border-zinc-800">
        <button
          onClick={() => setMode('installed')}
          className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${
            mode === 'installed'
              ? 'text-emerald-400 border-b border-emerald-500'
              : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          Installed
        </button>
        <button
          onClick={() => setMode('browse')}
          className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${
            mode === 'browse'
              ? 'text-emerald-400 border-b border-emerald-500'
              : 'text-zinc-500 hover:text-zinc-400'
          }`}
        >
          Browse
        </button>
      </div>

      {mode === 'browse' ? (
        <SkillBrowseTab
          profileId={profileId}
          sessionId={sessionId}
          sessionName={sessionName}
          profile={profile}
          directory={directory}
          installedSkills={skills.map(s => ({ name: s.name, source: s.source }))}
          onInstalled={loadSkills}
        />
      ) : (
        <>
          {/* Search input */}
          <div className="p-2 border-b border-zinc-800/50">
            <div className="relative">
              <MagnifyingGlass
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600"
              />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search installed skills..."
                className="w-full pl-7 pr-2 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>

          {/* Installed skills list */}
          <div className="flex-1 overflow-y-auto">
            {deleteError && (
              <div className="px-3 py-1.5 text-[10px] text-red-400 bg-red-500/5 border-b border-zinc-800/30">
                {deleteError}
              </div>
            )}
            {loading && (
              <div className="flex items-center justify-center h-20 text-xs text-zinc-600">
                Loading skills...
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex items-center justify-center h-20 text-xs text-zinc-600">
                {search ? 'No skills found' : 'No skills installed'}
              </div>
            )}
            {!loading &&
              filtered.map(skill => {
                const key = `${skill.source}:${skill.name}`;
                const isExpanded = expandedSkill === key;

                return (
                  <div key={key} className="border-b border-zinc-800/30">
                    <button
                      onClick={() => setExpandedSkill(isExpanded ? null : key)}
                      className="w-full px-3 py-2 hover:bg-zinc-800/20 transition-colors text-left space-y-1"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-zinc-600 flex-shrink-0">
                          {isExpanded ? <CaretDown size={10} /> : <CaretRight size={10} />}
                        </span>
                        <span className="text-xs font-medium text-zinc-300 truncate">{skill.name}</span>
                        <span
                          title={skill.source === 'project' ? 'Project skill' : 'Profile skill'}
                          className={`flex items-center gap-0.5 px-1 py-px text-[9px] rounded flex-shrink-0 ${
                            skill.source === 'project'
                              ? 'text-blue-400 bg-blue-500/10'
                              : 'text-zinc-500 bg-zinc-800'
                          }`}
                        >
                          {skill.source === 'project' ? (
                            <><FolderOpen size={8} /> project</>
                          ) : (
                            <><Globe size={8} /> profile</>
                          )}
                        </span>
                      </div>
                      {skill.description && (
                        <p className="text-[10px] text-zinc-500 pl-4 line-clamp-2">
                          {skill.description}
                        </p>
                      )}
                    </button>

                    {isExpanded && (
                      <div className="flex items-center gap-1.5 px-3 pb-2 pl-6">
                        <button
                          onClick={() => setViewingSkill(skill)}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded transition-colors"
                        >
                          <Eye size={10} />
                          View
                        </button>
                        {onInsert && (
                          <button
                            onClick={() => onInsert(skill.command + '\n')}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] text-emerald-500 bg-emerald-500/10 rounded hover:bg-emerald-500/20 transition-colors"
                          >
                            <PaperPlaneTilt size={10} />
                            Insert
                          </button>
                        )}

                        {confirmDelete === key ? (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <span className="text-[10px] text-zinc-500">Remove?</span>
                            <button
                              onClick={() => handleUninstall(skill)}
                              disabled={deleting === skill.name}
                              className="text-[10px] text-red-400 hover:text-red-300"
                            >
                              {deleting === skill.name ? '...' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-[10px] text-zinc-500 hover:text-zinc-400"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(key)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] text-zinc-500 hover:text-red-400 bg-zinc-800 rounded transition-colors ml-auto"
                          >
                            <Trash size={10} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </>
      )}

      {viewingSkill && (
        <SkillViewerModal
          skillName={viewingSkill.name}
          filePath={viewingSkill.filePath}
          onClose={() => setViewingSkill(null)}
        />
      )}
    </div>
  );
}
