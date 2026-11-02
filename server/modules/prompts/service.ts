import { getDb } from '../../db/connection';
import { generateId } from '../../shared/utils/uuid';
import { spawn } from 'child_process';
import {
  Prompt,
  PromptRow,
  CreatePromptInput,
  UpdatePromptInput,
  PromptVersion,
} from './types';
import { getProfilePath } from '../profiles/service';

function attachTags(row: PromptRow): Prompt {
  const db = getDb();
  const tags = db
    .prepare('SELECT tag FROM prompt_tags WHERE prompt_id = ? ORDER BY tag')
    .all(row.id) as { tag: string }[];
  return { ...row, tags: tags.map(t => t.tag) };
}

export function listPrompts(search?: string, tag?: string): Prompt[] {
  const db = getDb();
  let query = 'SELECT * FROM prompts';
  const conditions: string[] = [];
  const params: string[] = [];

  if (search) {
    conditions.push('(title LIKE ? OR content LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (tag) {
    conditions.push(
      'id IN (SELECT prompt_id FROM prompt_tags WHERE tag = ?)'
    );
    params.push(tag);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY updated_at DESC';

  const rows = db.prepare(query).all(...params) as PromptRow[];
  return rows.map(attachTags);
}

export function getPrompt(id: string): Prompt | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id) as
    | PromptRow
    | undefined;
  if (!row) return null;
  return attachTags(row);
}

export function createPrompt(input: CreatePromptInput): Prompt {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO prompts (id, title, content, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, input.title, input.content ?? '', input.notes ?? '', now, now);

  if (input.tags && input.tags.length > 0) {
    const insertTag = db.prepare(
      'INSERT INTO prompt_tags (id, prompt_id, tag) VALUES (?, ?, ?)'
    );
    for (const tag of input.tags) {
      insertTag.run(generateId(), id, tag);
    }
  }

  return getPrompt(id)!;
}

export function updatePrompt(id: string, input: UpdatePromptInput): Prompt | null {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id) as
    | PromptRow
    | undefined;
  if (!existing) return null;

  const txn = db.transaction(() => {
    const lastVersion = db
      .prepare(
        'SELECT created_at FROM prompt_versions WHERE prompt_id = ? ORDER BY created_at DESC LIMIT 1'
      )
      .get(id) as { created_at: string } | undefined;

    const shouldSnapshot =
      !lastVersion ||
      Date.now() - new Date(lastVersion.created_at).getTime() >= 30000;

    if (shouldSnapshot) {
      db.prepare(
        'INSERT INTO prompt_versions (id, prompt_id, title, content, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(generateId(), id, existing.title, existing.content, existing.notes, new Date().toISOString());
    }

    const now = new Date().toISOString();
    const title = input.title ?? existing.title;
    const content = input.content ?? existing.content;
    const notes = input.notes ?? existing.notes;

    db.prepare(
      'UPDATE prompts SET title = ?, content = ?, notes = ?, updated_at = ? WHERE id = ?'
    ).run(title, content, notes, now, id);

    if (input.tags !== undefined) {
      db.prepare('DELETE FROM prompt_tags WHERE prompt_id = ?').run(id);
      const insertTag = db.prepare(
        'INSERT INTO prompt_tags (id, prompt_id, tag) VALUES (?, ?, ?)'
      );
      for (const tag of input.tags) {
        insertTag.run(generateId(), id, tag);
      }
    }
  });

  txn();
  return getPrompt(id)!;
}

export function deletePrompt(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM prompts WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listVersions(promptId: string): PromptVersion[] {
  const db = getDb();
  return db
    .prepare(
      'SELECT * FROM prompt_versions WHERE prompt_id = ? ORDER BY created_at DESC'
    )
    .all(promptId) as PromptVersion[];
}

export function restoreVersion(promptId: string, versionId: string): Prompt | null {
  const db = getDb();
  const version = db
    .prepare('SELECT * FROM prompt_versions WHERE id = ? AND prompt_id = ?')
    .get(versionId, promptId) as PromptVersion | undefined;
  if (!version) return null;

  const existing = db.prepare('SELECT * FROM prompts WHERE id = ?').get(promptId) as
    | PromptRow
    | undefined;
  if (!existing) return null;

  const txn = db.transaction(() => {
    db.prepare(
      'INSERT INTO prompt_versions (id, prompt_id, title, content, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(generateId(), promptId, existing.title, existing.content, existing.notes, new Date().toISOString());

    const now = new Date().toISOString();
    db.prepare(
      'UPDATE prompts SET title = ?, content = ?, notes = ?, updated_at = ? WHERE id = ?'
    ).run(version.title, version.content, version.notes, now, promptId);
  });

  txn();
  return getPrompt(promptId)!;
}

const ENHANCE_META_PROMPT = `You are a world-class prompt engineer specializing in Claude. Your task is to rewrite the user's draft prompt into a highly effective, structured prompt following Anthropic's recommended prompt engineering framework.

Think carefully about the draft prompt's intent before rewriting. Identify what role, tone, context, rules, and output format would make this prompt produce the best possible results from Claude.

Apply the Anthropic Prompt Engineering Framework — use as many components as the prompt warrants:

1. **Task Context (Role & Identity)**: Define WHO the AI should be. Assign a specific, expert role that matches the task (e.g., "You are a senior backend engineer with 10 years of experience in distributed systems" not just "You are a helpful assistant"). The more specific the role, the better the output.

2. **Tone & Communication Style**: Specify the exact tone and style. "Professional but approachable, like explaining to a smart colleague" beats "be professional." Match tone to the task's audience and purpose.

3. **Background & Context**: Include any context the model needs to respond well. Frame the situation, the audience, relevant constraints, and why this task matters. Claude uses large context windows effectively — relevant background improves output quality significantly.

4. **Detailed Task Description & Rules**: Describe the task with precision and set clear boundaries. State what to do AND what to avoid. Include constraints like length limits, required sections, forbidden approaches, or quality criteria. Claude performs better with more constraints, not fewer.

5. **Examples**: If the prompt would benefit from showing what good output looks like, add 1-2 concise input/output examples. Examples dramatically improve consistency and are worth more than paragraphs of explanation. Use them for any task where format or style matters.

6. **Step-by-Step Reasoning**: When the task involves analysis, problem-solving, or complex reasoning, instruct the model to think through the problem systematically before responding. This activates Claude's chain-of-thought capabilities.

7. **Output Formatting**: Specify EXACTLY how the output should be structured — sections, headers, bullet points, XML tags, code blocks, or any other format. Be explicit about structure. If the output should NOT include certain elements (like preambles or summaries), say so.

Rewriting Rules:
- PRESERVE the original intent completely — enhance the prompt's effectiveness, never change its goal.
- PRESERVE all {{variable}} placeholders exactly as written, including their names and double-brace syntax.
- Do NOT add {{variables}} that weren't in the original.
- Do NOT wrap the result in markdown code fences or XML tags.
- Do NOT add meta-commentary — return ONLY the improved prompt text.
- Front-load critical information (role, context, core task) at the top.
- Place constraints, rules, and formatting requirements after the main task description.
- Keep the improved prompt concise and information-dense. Every sentence should earn its place. Do not pad with filler.
- Prefer direct, imperative language ("Analyze X" not "You could maybe analyze X").
- Layer context hierarchically: general context first, specific task second, immediate deliverable last.

Return the rewritten prompt and nothing else.`;

export function enhancePrompt(
  id: string,
  profile?: string
): Promise<{ content: string }> {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM prompts WHERE id = ?').get(id) as
      | PromptRow
      | undefined;
    if (!existing) {
      reject(new Error('Prompt not found'));
      return;
    }

    // Create version snapshot before enhancing
    db.prepare(
      'INSERT INTO prompt_versions (id, prompt_id, title, content, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(generateId(), id, existing.title, existing.content, existing.notes, new Date().toISOString());

    // Read meta-prompt from DB (editable via UI), fall back to hardcoded default
    const metaRow = db.prepare('SELECT content FROM prompts WHERE id = ?').get('system-enhance-meta-prompt') as { content: string } | undefined;
    const metaPrompt = metaRow?.content || ENHANCE_META_PROMPT;

    const fullPrompt = `${metaPrompt}\n\n---\n\n${existing.content}`;

    const args = ['-p', fullPrompt, '--dangerously-skip-permissions', '--output-format', 'json'];
    const env = { ...process.env };
    if (profile) {
      const profileDir = getProfilePath(profile);
      if (profileDir) env.CLAUDE_CONFIG_DIR = profileDir;
    }
    const child = spawn('claude', args, {
      timeout: 300000,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.on('error', (err) => {
      reject(new Error(`Enhancement failed: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Enhancement failed: ${stderr || `exit code ${code}`}`));
        return;
      }

      let enhancedContent = stdout;
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.result) enhancedContent = parsed.result;
      } catch {
        // stdout wasn't JSON, use raw output
      }

      enhancedContent = enhancedContent.trim();

      // Update prompt with enhanced content
      const now = new Date().toISOString();
      db.prepare('UPDATE prompts SET content = ?, updated_at = ? WHERE id = ?')
        .run(enhancedContent, now, id);

      resolve({ content: enhancedContent });
    });
  });
}
