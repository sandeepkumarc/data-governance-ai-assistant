import type { FieldDefinition } from "../types";

const DRAFT_KEY = "analyze_page_draft_v1";

export interface AnalyzeDraft {
  fileName: string;
  fileText: string;
  sourceHint: string;
  context: string;
  mode: "rag" | "llm";
  retrieval: "tfidf" | "vector";
  maskSamples: boolean;
  persist: boolean;
  useCollibra: boolean;
  results: FieldDefinition[];
  selectedKey: string | null;
}

export function loadAnalyzeDraft(): AnalyzeDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as AnalyzeDraft) : null;
  } catch {
    return null;
  }
}

export function saveAnalyzeDraft(draft: AnalyzeDraft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore quota errors — draft persistence is best-effort.
  }
}

export function clearAnalyzeDraft(): void {
  sessionStorage.removeItem(DRAFT_KEY);
}

export function fieldKey(field: FieldDefinition): string {
  return `${field.database_name}.${field.table_name}.${field.column_name}`;
}
