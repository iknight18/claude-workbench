import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { getDb } from '../../db/connection';
import { getProfilePath } from '../profiles/service';

const HOOK_URL = 'http://localhost:4201/api/notifications/hook';

const HOOK_TEMPLATE = {
  Stop: [
    {
      hooks: [
        {
          type: 'http',
          url: HOOK_URL,
        },
      ],
    },
  ],
  Notification: [
    {
      matcher: 'permission_prompt',
      hooks: [
        {
          type: 'http',
          url: HOOK_URL,
        },
      ],
    },
    {
      matcher: 'idle_prompt',
      hooks: [
        {
          type: 'http',
          url: HOOK_URL,
        },
      ],
    },
  ],
  TaskCreated: [
    {
      hooks: [
        {
          type: 'http',
          url: HOOK_URL,
        },
      ],
    },
  ],
  TaskCompleted: [
    {
      hooks: [
        {
          type: 'http',
          url: HOOK_URL,
        },
      ],
    },
  ],
};

function isOurHookEntry(entry: any): boolean {
  if (!entry?.hooks || !Array.isArray(entry.hooks)) return false;
  return entry.hooks.some(
    (h: any) => h?.url && typeof h.url === 'string' && h.url.includes('localhost:4201/api/notifications/hook')
  );
}

export function enableHooks(profileName: string): boolean {
  const profilePath = getProfilePath(profileName);
  if (!profilePath) return false;

  const settingsPath = path.join(profilePath, 'settings.json');
  let settings: any = {};

  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }

  for (const [eventName, entries] of Object.entries(HOOK_TEMPLATE)) {
    if (!settings.hooks[eventName]) {
      settings.hooks[eventName] = [];
    }

    for (const entry of entries as any[]) {
      const alreadyExists = settings.hooks[eventName].some(
        (existing: any) => isOurHookEntry(existing)
          && (existing.matcher ?? null) === (entry.matcher ?? null)
      );
      if (!alreadyExists) {
        settings.hooks[eventName].push(entry);
      }
    }
  }

  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch {
    return false;
  }

  const db = getDb();
  db.prepare(
    'INSERT INTO notification_settings (profile_name, hooks_enabled) VALUES (?, 1) ON CONFLICT(profile_name) DO UPDATE SET hooks_enabled = 1'
  ).run(profileName);

  return true;
}

export function disableHooks(profileName: string): boolean {
  const profilePath = getProfilePath(profileName);
  if (!profilePath) return false;

  const settingsPath = path.join(profilePath, 'settings.json');
  if (!existsSync(settingsPath)) return true;

  let settings: any;
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    return false;
  }

  if (!settings.hooks) return true;

  for (const eventName of Object.keys(settings.hooks)) {
    if (!Array.isArray(settings.hooks[eventName])) continue;

    settings.hooks[eventName] = settings.hooks[eventName].filter(
      (entry: any) => !isOurHookEntry(entry)
    );

    if (settings.hooks[eventName].length === 0) {
      delete settings.hooks[eventName];
    }
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch {
    return false;
  }

  const db = getDb();
  db.prepare(
    'INSERT INTO notification_settings (profile_name, hooks_enabled) VALUES (?, 0) ON CONFLICT(profile_name) DO UPDATE SET hooks_enabled = 0'
  ).run(profileName);

  return true;
}

export function enableProjectHooks(directory: string): boolean {
  const claudeDir = path.join(directory, '.claude');
  const settingsPath = path.join(claudeDir, 'settings.local.json');

  if (!existsSync(claudeDir)) {
    try {
      mkdirSync(claudeDir, { recursive: true });
    } catch {
      return false;
    }
  }

  let settings: any = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch {
      settings = {};
    }
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }

  for (const [eventName, entries] of Object.entries(HOOK_TEMPLATE)) {
    if (!settings.hooks[eventName]) {
      settings.hooks[eventName] = [];
    }

    for (const entry of entries as any[]) {
      const alreadyExists = settings.hooks[eventName].some(
        (existing: any) => isOurHookEntry(existing)
          && (existing.matcher ?? null) === (entry.matcher ?? null)
      );
      if (!alreadyExists) {
        settings.hooks[eventName].push(entry);
      }
    }
  }

  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch {
    return false;
  }
  return true;
}

export function disableProjectHooks(directory: string): boolean {
  const settingsPath = path.join(directory, '.claude', 'settings.local.json');
  if (!existsSync(settingsPath)) return true;

  let settings: any;
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
  } catch {
    return false;
  }

  if (!settings.hooks) return true;

  for (const eventName of Object.keys(settings.hooks)) {
    if (!Array.isArray(settings.hooks[eventName])) continue;

    settings.hooks[eventName] = settings.hooks[eventName].filter(
      (entry: any) => !isOurHookEntry(entry)
    );

    if (settings.hooks[eventName].length === 0) {
      delete settings.hooks[eventName];
    }
  }

  if (Object.keys(settings.hooks).length === 0) {
    delete settings.hooks;
  }

  try {
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch {
    return false;
  }
  return true;
}

export function getHooksStatus(): { profile_name: string; hooks_enabled: boolean }[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM notification_settings')
    .all() as { profile_name: string; hooks_enabled: number }[];
  return rows.map((r) => ({
    profile_name: r.profile_name,
    hooks_enabled: Boolean(r.hooks_enabled),
  }));
}
