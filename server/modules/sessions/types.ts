export interface Session {
  id: string;
  name: string;
  directory: string;
  status: 'active' | 'completed' | 'archived';
  profile: string;
  skip_permissions: boolean;
  hooks_enabled: boolean;
  debug_enabled: boolean;
  group: string;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SessionRow {
  id: string;
  name: string;
  directory: string;
  status: string;
  profile: string;
  skip_permissions: number;
  hooks_enabled: number;
  debug_enabled: number;
  group: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SessionWithGit extends Session {
  git_branch: string | null;
}

export interface CreateSessionInput {
  name: string;
  directory?: string;
  profile?: string;
  skip_permissions?: boolean;
  hooks_enabled?: boolean;
  debug_enabled?: boolean;
  group?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdateSessionInput {
  name?: string;
  directory?: string;
  status?: 'active' | 'completed' | 'archived';
  profile?: string;
  skip_permissions?: boolean;
  hooks_enabled?: boolean;
  debug_enabled?: boolean;
  group?: string;
  notes?: string;
  tags?: string[];
}

export interface SessionTask {
  id: string;
  session_id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  completed_at: string | null;
}

export interface SessionTaskRow {
  id: string;
  session_id: string;
  subject: string;
  status: string;
  created_at: string;
  completed_at: string | null;
}
