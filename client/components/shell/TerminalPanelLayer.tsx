'use client';

import { useTerminals } from '@/lib/contexts/TerminalContext';
import TerminalPanel from './TerminalPanel';

export default function TerminalPanelLayer() {
  const { terminals, panels } = useTerminals();

  const openPanels = Array.from(panels.entries())
    .filter(([, panel]) => panel.displayState === 'popup')
    .map(([sessionId, panel]) => {
      const entry = terminals.get(sessionId);
      if (!entry) return null;
      return <TerminalPanel key={sessionId} entry={entry} panel={panel} />;
    })
    .filter(Boolean);

  if (openPanels.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 50 }}>
      <div className="pointer-events-auto">
        {openPanels}
      </div>
    </div>
  );
}
