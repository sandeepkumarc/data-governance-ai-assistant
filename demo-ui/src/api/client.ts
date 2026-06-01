import type {
  AnalyzeField,
  AuditEntry,
  FieldDefinition,
  KbNlUpdateResult,
  KbSection,
  LineageGraph,
  LineageNlUpdateResult,
  LineagePolicy,
  QualityRule,
  StewardAssignment,
  TrustScore,
} from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function headers(apiKey?: string): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (apiKey) h["X-API-Key"] = apiKey;
  return h;
}

async function request<T>(
  path: string,
  init?: RequestInit & { apiKey?: string },
): Promise<T> {
  const { apiKey, ...rest } = init ?? {};
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: { ...headers(apiKey), ...(rest.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || `HTTP ${res.status}`, res.status);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return res.json() as Promise<T>;
  return res.text() as Promise<T>;
}

export const api = {
  health: (apiKey?: string) =>
    request<{ status: string; app: string }>("/api/health", { apiKey }),

  kbSections: (apiKey?: string) =>
    request<KbSection[]>("/api/knowledge-base/sections", { apiKey }),

  createKbSection: (body: { title: string; text?: string }, apiKey?: string) =>
    request<KbSection>("/api/knowledge-base/sections", {
      method: "POST",
      apiKey,
      body: JSON.stringify(body),
    }),

  updateKbSection: (
    body: { original_title: string; title?: string; text?: string },
    apiKey?: string,
  ) =>
    request<KbSection>("/api/knowledge-base/sections", {
      method: "PUT",
      apiKey,
      body: JSON.stringify(body),
    }),

  deleteKbSection: (title: string, apiKey?: string) =>
    request<KbSection>(`/api/knowledge-base/sections?title=${encodeURIComponent(title)}`, {
      method: "DELETE",
      apiKey,
    }),

  nlUpdateKb: (
    body: {
      instruction: string;
      target_section?: string;
      no_llm?: boolean;
      dry_run?: boolean;
      model?: string;
      base_url?: string;
    },
    apiKey?: string,
  ) =>
    request<KbNlUpdateResult>("/api/knowledge-base/nl-update", {
      method: "POST",
      apiKey,
      body: JSON.stringify({
        provider: "ollama",
        model: body.model ?? "gemma4:e2b",
        base_url: body.base_url ?? "http://localhost:11434",
        ...body,
      }),
    }),

  analyze: (
    fields: AnalyzeField[],
    opts: {
      dataset_context?: string;
      mask_samples?: boolean;
      no_llm?: boolean;
      model?: string;
      base_url?: string;
      persist?: boolean;
      retrieval_mode?: "tfidf" | "vector";
      embedding_model?: string;
      apiKey?: string;
    } = {},
  ) =>
    request<FieldDefinition[]>("/api/analyze-metadata", {
      method: "POST",
      apiKey: opts.apiKey,
      body: JSON.stringify({
        fields,
        dataset_context: opts.dataset_context ?? "",
        mask_samples: opts.mask_samples ?? true,
        no_llm: opts.no_llm ?? true,
        provider: "ollama",
        model: opts.model ?? "gemma4:e2b",
        base_url: opts.base_url ?? "http://localhost:11434",
        persist: opts.persist ?? true,
        retrieval_mode: opts.retrieval_mode ?? "tfidf",
        embedding_model: opts.embedding_model ?? "nomic-embed-text",
      }),
    }),

  uploadCsv: async (
    file: File,
    opts: {
      dataset_context?: string;
      mask_samples?: boolean;
      no_llm?: boolean;
      model?: string;
      persist?: boolean;
      retrieval_mode?: string;
      apiKey?: string;
    } = {},
  ) => {
    const form = new FormData();
    form.append("file", file);
    form.append("dataset_context", opts.dataset_context ?? "");
    form.append("mask_samples", String(opts.mask_samples ?? true));
    form.append("no_llm", String(opts.no_llm ?? true));
    form.append("provider", "ollama");
    form.append("model", opts.model ?? "gemma4:e2b");
    form.append("base_url", "http://localhost:11434");
    form.append("persist", String(opts.persist ?? true));
    form.append("retrieval_mode", opts.retrieval_mode ?? "tfidf");
    form.append("embedding_model", "nomic-embed-text");
    const h: HeadersInit = {};
    if (opts.apiKey) h["X-API-Key"] = opts.apiKey;
    const res = await fetch(`${BASE}/api/upload-metadata`, {
      method: "POST",
      headers: h,
      body: form,
    });
    if (!res.ok) throw new ApiError(await res.text(), res.status);
    return res.json() as Promise<FieldDefinition[]>;
  },

  definitions: (params?: {
    database_name?: string;
    table_name?: string;
    approval_status?: string;
    apiKey?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.database_name) q.set("database_name", params.database_name);
    if (params?.table_name) q.set("table_name", params.table_name);
    if (params?.approval_status) q.set("approval_status", params.approval_status);
    const qs = q.toString();
    return request<FieldDefinition[]>(`/api/definitions${qs ? `?${qs}` : ""}`, {
      apiKey: params?.apiKey,
    });
  },

  approve: (
    id: string,
    body: { approval_status: string; steward_comment?: string; approved_by?: string },
    apiKey?: string,
  ) =>
    request<FieldDefinition>(`/api/definitions/${id}/approve`, {
      method: "PATCH",
      apiKey,
      body: JSON.stringify(body),
    }),

  ownership: (apiKey?: string) =>
    request<StewardAssignment[]>("/api/ownership", { apiKey }),

  auditLog: (params?: { action?: string; limit?: number; apiKey?: string }) => {
    const q = new URLSearchParams();
    if (params?.action) q.set("action", params.action);
    if (params?.limit) q.set("limit", String(params.limit));
    const qs = q.toString();
    return request<AuditEntry[]>(`/api/audit-log${qs ? `?${qs}` : ""}`, {
      apiKey: params?.apiKey,
    });
  },

  lineage: async (database_name?: string, apiKey?: string) => {
    const q = database_name
      ? `?database_name=${encodeURIComponent(database_name)}`
      : "";
    const graph = await request<LineageGraph>(`/api/lineage${q}`, { apiKey });
    return {
      ...graph,
      edges: graph.edges.map((e, i) => ({
        id: e.id ?? `edge-${i}`,
        source_id: e.source_id ?? (e as { source?: string }).source ?? "",
        target_id: e.target_id ?? (e as { target?: string }).target ?? "",
        label: e.label ?? "",
      })),
    };
  },

  lineagePolicies: (apiKey?: string) =>
    request<{ policies: LineagePolicy[] }>("/api/lineage/policies", { apiKey }),

  applyLineagePolicies: (apiKey?: string) =>
    request<LineageNlUpdateResult["apply_result"]>("/api/lineage/policies/apply", {
      method: "POST",
      apiKey,
    }),

  nlUpdateLineagePolicy: (
    body: {
      instruction: string;
      no_llm?: boolean;
      dry_run?: boolean;
      apply_after?: boolean;
    },
    apiKey?: string,
  ) =>
    request<LineageNlUpdateResult>("/api/lineage/policies/nl-update", {
      method: "POST",
      apiKey,
      body: JSON.stringify({
        provider: "ollama",
        model: "gemma4:e2b",
        base_url: "http://localhost:11434",
        ...body,
      }),
    }),

  qualityRules: (params?: {
    database_name?: string;
    table_name?: string;
    apiKey?: string;
  }) => {
    const q = new URLSearchParams();
    if (params?.database_name) q.set("database_name", params.database_name);
    if (params?.table_name) q.set("table_name", params.table_name);
    const qs = q.toString();
    return request<QualityRule[]>(`/api/quality-rules${qs ? `?${qs}` : ""}`, {
      apiKey: params?.apiKey,
    });
  },

  updateRuleStatus: (
    id: string,
    status: string,
    failure_count?: number,
    apiKey?: string,
  ) =>
    request<QualityRule>(`/api/quality-rules/${id}/status`, {
      method: "PATCH",
      apiKey,
      body: JSON.stringify({ status, failure_count }),
    }),

  trustScores: (database_name?: string, apiKey?: string) => {
    const q = database_name
      ? `?database_name=${encodeURIComponent(database_name)}`
      : "";
    return request<TrustScore[]>(`/api/trust-scores${q}`, { apiKey });
  },

  exportCollibra: async (params?: {
    approval_status?: string;
    database_name?: string;
    format?: "csv" | "json";
    apiKey?: string;
  }) => {
    const q = new URLSearchParams({ format: params?.format ?? "csv" });
    if (params?.approval_status) q.set("approval_status", params.approval_status);
    if (params?.database_name) q.set("database_name", params.database_name);
    const h: HeadersInit = {};
    if (params?.apiKey) h["X-API-Key"] = params.apiKey;
    const res = await fetch(`${BASE}/api/export/collibra?${q}`, { headers: h });
    if (!res.ok) throw new ApiError(await res.text(), res.status);
    if (params?.format === "json") return res.json();
    return res.text();
  },
};

export { ApiError };
