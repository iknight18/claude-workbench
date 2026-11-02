import { apiFetch } from './client';

export type AuthStatus = 'valid' | 'expired' | 'no_credentials';

export interface Profile {
  id: string;
  name: string;
  display_name: string;
  directory_path: string;
  is_active: boolean;
  is_authenticated: boolean;
  auth_status: AuthStatus;
  created_at: string;
  updated_at: string;
}

export interface ProfileConfig {
  profilePath: string;
  claudeMd: string | null;
  settings: object | null;
}

export interface Skill {
  name: string;
  description: string;
  command: string;
  filePath: string;
}

export interface CreateProfileInput {
  name: string;
  display_name?: string;
}

export interface UpdateProfileInput {
  display_name?: string;
}

export function fetchProfiles(): Promise<Profile[]> {
  return apiFetch<Profile[]>('/profiles');
}

export function fetchProfile(id: string): Promise<Profile> {
  return apiFetch<Profile>(`/profiles/${id}`);
}

export function createProfile(input: CreateProfileInput): Promise<Profile> {
  return apiFetch<Profile>('/profiles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProfile(id: string, input: UpdateProfileInput): Promise<Profile> {
  return apiFetch<Profile>(`/profiles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteProfile(id: string, mode: 'unlink' | 'disk' = 'unlink'): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/profiles/${id}?mode=${mode}`, {
    method: 'DELETE',
  });
}

export function fetchProfileConfig(id: string): Promise<ProfileConfig> {
  return apiFetch<ProfileConfig>(`/profiles/${id}/config`);
}

export function writeProfileConfig(
  id: string,
  data: { claudeMd?: string; settings?: string }
): Promise<ProfileConfig> {
  return apiFetch<ProfileConfig>(`/profiles/${id}/config`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function fetchSkills(id: string): Promise<Skill[]> {
  return apiFetch<Skill[]>(`/profiles/${id}/skills`);
}

