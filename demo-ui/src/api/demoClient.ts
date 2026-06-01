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
import {
  DEMO_COLLABRA_CSV,
  DEMO_LINEAGE,
  DEMO_OWNERSHIP,
  DEMO_QUALITY_RULES,
  DEMO_TRUST_SCORES,
  addOfflineAnalysisResults,
  createOfflineKbSection,
  deleteOfflineKbSection,
  getOfflineAudit,
  getOfflineDefinitions,
  getOfflineKbSections,
  setOfflineDefinition,
  updateOfflineKbSection,
} from "../data/demoData";

const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

function filterDefs(
  items: FieldDefinition[],
  params?: {
    database_name?: string;
    table_name?: string;
    approval_status?: string;
  },
) {
  return items.filter((d) => {
    if (params?.database_name && d.database_name !== params.database_name) return false;
    if (params?.table_name && d.table_name !== params.table_name) return false;
    if (params?.approval_status && d.approval_status !== params.approval_status)
      return false;
    return true;
  });
}

/** Simulated analyze from CSV — returns demo definitions */
async function simulateAnalyze(
  _file: File,
  _opts?: { dataset_context?: string; mask_samples?: boolean; no_llm?: boolean; persist?: boolean; retrieval_mode?: string; apiKey?: string },
): Promise<FieldDefinition[]> {
  await delay(800);
  const results = getOfflineDefinitions().map((d) => ({
    ...d,
    approval_status: "pending_review",
    updated_at: new Date().toISOString(),
  }));
  addOfflineAnalysisResults(results);
  return results;
}

export const demoApi = {
  health: async () => {
    await delay(200);
    return { status: "ok", app: "governance-demo-offline" };
  },

  kbSections: async (_apiKey?: string): Promise<KbSection[]> => {
    await delay(150);
    return getOfflineKbSections();
  },

  createKbSection: async (body: { title: string; text?: string }, _apiKey?: string) => {
    await delay(300);
    return createOfflineKbSection(body.title, body.text ?? "");
  },

  updateKbSection: async (
    body: { original_title: string; title?: string; text?: string },
    _apiKey?: string,
  ) => {
    await delay(300);
    const current = getOfflineKbSections().find((s) => s.title === body.original_title);
    if (!current) throw new Error(`Section not found: ${body.original_title}`);
    return updateOfflineKbSection(
      body.original_title,
      body.title ?? current.title,
      body.text ?? current.text ?? "",
    );
  },

  deleteKbSection: async (title: string, _apiKey?: string) => {
    await delay(300);
    return deleteOfflineKbSection(title);
  },

  nlUpdateKb: async (
    body: {
      instruction: string;
      target_section?: string;
      no_llm?: boolean;
      dry_run?: boolean;
    },
    _apiKey?: string,
  ): Promise<KbNlUpdateResult> => {
    await delay(body.no_llm ? 400 : 1200);
    const sections = getOfflineKbSections();
    const title =
      body.target_section ||
      sections.find((s) => s.title.toLowerCase().includes("alias"))?.title ||
      "Column Aliases And Abbreviations";
    const match = sections.find((s) => s.title === title) ?? sections[0];
    if (!match) {
      throw new Error("No sections available to update");
    }
    const addition = body.instruction.trim();
    const change = {
      action: "update" as const,
      original_title: match.title,
      title: match.title,
      text: `${match.text ?? ""}\n\nPolicy update (natural language):\n- ${addition}`,
    };
    const summary = body.no_llm
      ? `Appended instruction to '${match.title}' (heuristic — connect LLM for richer edits).`
      : `Updated '${match.title}' with policy changes from your instruction.`;
    if (body.dry_run) {
      return { summary, dry_run: true, applied: false, changes: [change], sections };
    }
    updateOfflineKbSection(change.original_title, change.title, change.text);
    return {
      summary,
      dry_run: false,
      applied: true,
      changes: [change],
      sections: getOfflineKbSections(),
    };
  },

  definitions: async (params?: {
    database_name?: string;
    table_name?: string;
    approval_status?: string;
    apiKey?: string;
  }): Promise<FieldDefinition[]> => {
    await delay(300);
    return filterDefs(getOfflineDefinitions(), params);
  },

  approve: async (
    id: string,
    body: { approval_status: string; steward_comment?: string; approved_by?: string },
    _apiKey?: string,
  ): Promise<FieldDefinition> => {
    await delay(400);
    const found = getOfflineDefinitions().find((d) => d.id === id);
    if (!found) throw new Error("Definition not found");
    const updated: FieldDefinition = {
      ...found,
      approval_status: body.approval_status,
      steward_comment: body.steward_comment ?? "",
      approved_by: body.approved_by ?? "",
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setOfflineDefinition(updated);
    return updated;
  },

  ownership: async (_apiKey?: string): Promise<StewardAssignment[]> => {
    await delay(300);
    return DEMO_OWNERSHIP;
  },

  auditLog: async (params?: {
    action?: string;
    limit?: number;
    apiKey?: string;
  }): Promise<AuditEntry[]> => {
    await delay(250);
    let items = getOfflineAudit();
    if (params?.action) items = items.filter((a) => a.action === params.action);
    return items.slice(0, params?.limit ?? 50);
  },

  lineage: async (_database_name?: string, _apiKey?: string): Promise<LineageGraph> => {
    await delay(350);
    return DEMO_LINEAGE;
  },

  lineagePolicies: async (_apiKey?: string) => {
    await delay(200);
    return {
      policies: [
        {
          id: "match-column-full-name",
          name: "Stitch columns by matching full name",
          rule_type: "match_full_name",
          enabled: true,
        },
        {
          id: "match-logical-attribute",
          name: "Stitch by logical attribute name",
          rule_type: "match_logical_attribute",
          enabled: true,
        },
      ],
    };
  },

  applyLineagePolicies: async (_apiKey?: string) => {
    await delay(500);
    return { policies_run: 2, edges_added: 1, results: [] };
  },

  nlUpdateLineagePolicy: async (
    body: {
      instruction: string;
      no_llm?: boolean;
      dry_run?: boolean;
      apply_after?: boolean;
    },
    _apiKey?: string,
  ): Promise<LineageNlUpdateResult> => {
    await delay(body.no_llm ? 400 : 1000);
    const policy: LineagePolicy = {
      id: "demo-policy",
      name: body.instruction.toLowerCase().includes("full name")
        ? "Stitch columns by matching full name"
        : "Custom lineage policy",
      description: body.instruction,
      rule_type: "match_full_name",
      enabled: true,
      config: { cross_database: true, edge_label: "same full name" },
    };
    return {
      summary: body.dry_run
        ? `Preview: would add policy "${policy.name}"`
        : `Added policy "${policy.name}" and stitched matching columns`,
      dry_run: Boolean(body.dry_run),
      applied: !body.dry_run,
      policy,
      apply_result: body.dry_run
        ? undefined
        : { policies_run: 1, edges_added: 1, results: [{ name: policy.name, edges_added: 1 }] },
    };
  },

  qualityRules: async (_params?: {
    database_name?: string;
    table_name?: string;
    apiKey?: string;
  }): Promise<QualityRule[]> => {
    await delay(300);
    return DEMO_QUALITY_RULES;
  },

  updateRuleStatus: async (
    id: string,
    status: string,
  ): Promise<QualityRule> => {
    await delay(300);
    const rule = DEMO_QUALITY_RULES.find((r) => r.id === id);
    if (!rule) throw new Error("Rule not found");
    return { ...rule, status };
  },

  trustScores: async (_database_name?: string, _apiKey?: string): Promise<TrustScore[]> => {
    await delay(300);
    return DEMO_TRUST_SCORES;
  },

  exportCollibra: async (params?: { approval_status?: string; format?: string; apiKey?: string }) => {
    await delay(400);
    if (params?.approval_status === "approved") return DEMO_COLLABRA_CSV;
    return DEMO_COLLABRA_CSV;
  },

  uploadCsv: simulateAnalyze,

  analyze: async (fields: AnalyzeField[]): Promise<FieldDefinition[]> => {
    await delay(600);
    const results = getOfflineDefinitions()
      .filter((d) =>
        fields.some(
          (f) =>
            f.column_name === d.column_name && f.table_name === d.table_name,
        ),
      )
      .slice(0, fields.length);
    if (results.length === 0) {
      return getOfflineDefinitions().slice(0, Math.min(fields.length, 3));
    }
    addOfflineAnalysisResults(results);
    return results;
  },
};
