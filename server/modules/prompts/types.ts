export interface Prompt {
  id: string;
  title: string;
  content: string;
  notes: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface PromptRow {
  id: string;
  title: string;
  content: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePromptInput {
  title: string;
  content?: string;
  notes?: string;
  tags?: string[];
}

export interface UpdatePromptInput {
  title?: string;
  content?: string;
  notes?: string;
  tags?: string[];
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  title: string;
  content: string;
  notes: string;
  created_at: string;
}
