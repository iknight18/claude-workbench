'use client';

import { useState } from 'react';
import { Lightning, Notebook, Gear } from '@phosphor-icons/react';
import ToolsPromptTab from './ToolsPromptTab';
import ToolsSkillsTab from './ToolsSkillsTab';
import ToolsConfigTab from './ToolsConfigTab';

type TabId = 'prompts' | 'skills' | 'config';

interface SessionToolsPanelProps {
  profileId: string;
  sessionId: string;
  sessionName: string;
  profile: string;
  directory: string;
  onInsert?: (text: string) => void;
}

const tabs: { id: TabId; label: string; icon: typeof Lightning }[] = [
  { id: 'prompts', label: 'Prompts', icon: Notebook },
  { id: 'skills', label: 'Skills', icon: Lightning },
  { id: 'config', label: 'Config', icon: Gear },
];

export default function SessionToolsPanel({
  profileId,
  sessionId,
  sessionName,
  profile,
  directory,
  onInsert,
}: SessionToolsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('prompts');

  return (
    <div className="flex flex-col h-full border-l border-zinc-800 w-[300px]">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] transition-colors ${
                activeTab === tab.id
                  ? 'text-emerald-400 border-b border-emerald-500'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'prompts' && <ToolsPromptTab onInsert={onInsert} />}
        {activeTab === 'skills' && (
          <ToolsSkillsTab profileId={profileId} sessionId={sessionId} sessionName={sessionName} profile={profile} directory={directory} onInsert={onInsert} />
        )}
        {activeTab === 'config' && (
          <ToolsConfigTab sessionId={sessionId} directory={directory} />
        )}
      </div>
    </div>
  );
}
