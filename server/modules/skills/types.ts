// --- Search (skills.sh proxy) ---

export interface SearchSkill {
  id: string;
  name: string;
  installs: number;
  source: string;
}

export interface SearchResponse {
  skills: SearchSkill[];
}

// --- Resolve (GitHub tree discovery) ---

export interface SkillFile {
  path: string;
  size: number;
}

export interface ResolvedSkill {
  name: string;
  description: string;
  path: string;
  branch: string;
  files: SkillFile[];
}

// --- Install ---

export interface InstallRequest {
  profileId: string;
  source: string;
  skillName: string;
  skillPath: string;
  branch: string;
  files: string[];
  target?: 'profile' | 'project';
  directory?: string;
}

export interface UninstallRequest {
  profileId: string;
  skillName: string;
}
