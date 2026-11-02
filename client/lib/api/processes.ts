import { apiFetch } from './client';

export interface ClaudeProcess {
  pid: number;
  args: string;
}

export interface KillResult {
  killed: number[];
  failed: number[];
}

export function scanClaudeProcesses(): Promise<ClaudeProcess[]> {
  return apiFetch<ClaudeProcess[]>('/processes/claude');
}

export function killClaudeProcesses(pids?: number[]): Promise<KillResult> {
  return apiFetch<KillResult>('/processes/claude/kill', {
    method: 'POST',
    body: JSON.stringify(pids ? { pids } : {}),
  });
}
