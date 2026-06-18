import type {
  AnalyzeField,
  AssistantChatResponse,
  AuditEntry,
  ChatTurn,
  HelpDeskSubmitResponse,
  HelpDeskTicket,
  MaturityConfig,
  MaturityExecutiveSummary,
  DataMaturityPayload,
  FieldDefinition,
  KbNlUpdateResult,
  KbSection,
  LineageGraph,
  GovernanceNlUpdateResult,
  GovernancePrinciple,
  GovernancePrinciplesBundle,
  LineageNlUpdateResult,
  LineagePolicy,
  QualityRule,
  StewardAssignment,
  TrustScore,
} from "../types";
import { HEALTHCARE_SAMPLE_DEFINITIONS } from "../data/healthcareSampleData";
import { isHealthcareMetadata } from "../lib/metadataCsv";
import { buildMaturityExecutiveSummary } from "../lib/maturityExecutiveSummary";
import {
  SAMPLE_COLLIBRA_CSV,
  SAMPLE_LINEAGE,
  SAMPLE_OWNERSHIP,
  SAMPLE_QUALITY_RULES,
  SAMPLE_COLLIBRA_MATURITY,
  SAMPLE_DATA_MATURITY,
  SAMPLE_GOVERNANCE_PRINCIPLES,
  SAMPLE_TRUST_SCORES,
  addOfflineAnalysisResults,
  createOfflineKbSection,
  deleteOfflineKbSection,
  getOfflineAudit,
  getOfflineDefinitions,
  getOfflineKbSections,
  setOfflineDefinition,
  updateOfflineKbSection,
} from "../data/sampleData";

const OFFLINE_LINEAGE_POLICIES: LineagePolicy[] = [
  {
    id: "default-db-table-column",
    name: "Structural hierarchy",
    description: "Baseline: database → table → column from analyzed metadata.",
    rule_type: "structural",
    enabled: true,
    source: "catalog",
  },
  {
    id: "match-column-full-name",
    name: "Stitch columns by matching full name",
    description: "MDM entity resolution across databases.",
    rule_type: "match_full_name",
    enabled: true,
    config: { standard: "MDM / cross-system entity resolution" },
  },
  {
    id: "match-logical-attribute",
    name: "Stitch by logical attribute name",
    rule_type: "match_logical_attribute",
    enabled: true,
  },
  {
    id: "match-glossary-term",
    name: "Stitch by business glossary term",
    rule_type: "match_glossary_term",
    enabled: true,
    config: { standard: "DAMA-DMBOK business glossary" },
  },
  {
    id: "pii-to-audit-report",
    name: "PII columns to compliance ledger",
    rule_type: "keyword_to_report",
    enabled: true,
    config: { standard: "GDPR / CCPA privacy register" },
  },
];

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

/** Simulated analyze from CSV — returns sample definitions */
async function simulateAnalyze(
  file: File,
  _opts?: {
    dataset_context?: string;
    mask_samples?: boolean;
    no_llm?: boolean;
    persist?: boolean;
    retrieval_mode?: string;
    use_collibra?: boolean;
    apiKey?: string;
  },
): Promise<FieldDefinition[]> {
  await delay(800);
  const text = await file.text();
  const source = isHealthcareMetadata(text)
    ? HEALTHCARE_SAMPLE_DEFINITIONS
    : getOfflineDefinitions();
  const results = source.map((d) => ({
    ...d,
    approval_status: "pending_review",
    updated_at: new Date().toISOString(),
  }));
  addOfflineAnalysisResults(results);
  return results;
}

const PILLAR_RULE: Record<string, string> = {
  metadata: "approved_definitions",
  definitions: "approved_definitions",
  governance: "steward_approvals",
  stewardship: "steward_approvals",
  quality: "dq_rule_stewardship",
  dq: "dq_rule_stewardship",
  lineage: "approved_definitions",
  security: "classification_coverage",
  classification: "classification_coverage",
  operational: "recent_activity",
  readiness: "recent_activity",
};

function parseNlInstruction(instruction: string): { name: string; rule_type: string } {
  const arrow = instruction.match(/^(.+?)\s*(?:->|→)\s*(.+)$/);
  if (arrow) {
    const name = arrow[1].trim();
    const hint = arrow[2].trim().toLowerCase().replace(/&/g, "and");
    let rule_type = "approved_definitions";
    if (hint.includes("glossary")) rule_type = "glossary_linked";
    else if (hint.includes("governance") || hint.includes("steward")) rule_type = "steward_approvals";
    else if (hint.includes("quality") || hint.includes("dq")) rule_type = "dq_rule_stewardship";
    else if (hint.includes("security") || hint.includes("classif")) rule_type = "classification_coverage";
    else if (hint.includes("operational") || hint.includes("readiness")) rule_type = "recent_activity";
    else if (hint.includes("metadata") || hint.includes("definition")) rule_type = "approved_definitions";
    else {
      for (const [token, rt] of Object.entries(PILLAR_RULE)) {
        if (hint.includes(token)) {
          rule_type = rt;
          break;
        }
      }
    }
    return { name, rule_type };
  }
  const text = instruction.toLowerCase();
  const rule_type = text.includes("glossary")
    ? "glossary_linked"
    : text.includes("pii") || text.includes("classif")
      ? "classification_coverage"
      : text.includes("steward") && text.includes("assign")
        ? "ownership_assigned"
        : "approved_definitions";
  const custom =
    instruction.match(/^(?:add|create)\s+(?:a\s+)?(?:principle\s+)?(?:called\s+)?['"]?(.+?)['"]?\s*(?:to test|for testing)?\.?$/i)?.[1]?.trim() ??
    instruction.match(/^(.+?)\s+to test\.?$/i)?.[1]?.trim();
  const catalog = SAMPLE_GOVERNANCE_PRINCIPLES.rule_type_catalog.find((e) => e.rule_type === rule_type);
  return { name: custom || catalog?.label || "Custom governing principle", rule_type };
}

export const offlineApi = {
  health: async () => {
    await delay(200);
    return { status: "ok", app: "govassist-offline" };
  },

  kbSections: async (_apiKey?: string): Promise<KbSection[]> => {
    await delay(150);
    return getOfflineKbSections();
  },

  createKbSection: async (body: { title: string; text?: string }, apiKey?: string) => {
    await delay(300);
    const section = createOfflineKbSection(body.title, body.text ?? "");
    const verification = await offlineApi.verifyKbSection(
      { title: body.title, text: body.text ?? "" },
      apiKey,
    );
    return { ...section, verification };
  },

  verifyKbSection: async (
    body: { title: string; text?: string; retrieval_mode?: string },
    _apiKey?: string,
  ) => {
    await delay(500);
    const text = body.text ?? "";
    const columnMatch = text.match(/\b([a-z][a-z0-9_]{2,})\b/i);
    const column = columnMatch?.[1] ?? "email_address";
    const tableSlug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40);
    const sampleCsv =
      column.includes("email") || column.includes("mail")
        ? `${column}\nalex@example.com|sam@company.com`
        : `${column}\nsample_001|sample_002`;
    const passed = text.length > 20;
    return {
      passed,
      confidence: passed ? 78 : 35,
      target_section: body.title,
      target_rank: passed ? 1 : null,
      target_relevance_score: passed ? 0.18 : null,
      retrieved_sections: passed ? [body.title, "Column Aliases And Abbreviations"] : [],
      cited_sections: passed ? [body.title] : [],
      probe_columns: [column],
      test_case: {
        database_name: "policy_test_db",
        table_name: `policy_test_${tableSlug || "section"}`,
        column_name: column,
        data_type: "string",
        sample_values: sampleCsv.split("\n")[1]?.split("|") ?? ["sample_001"],
        notes: `Auto-generated probe for knowledge section: ${body.title}`,
        sample_csv: sampleCsv,
        csv_filename: `policy_test_${tableSlug || "section"}.csv`,
      },
      analysis_preview: {
        glossary_term: column.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        definition: `${column} stores a business attribute governed by ${body.title}.`,
        data_classification: "Confidential",
        sensitivity: "Medium",
        decision_rationale: passed
          ? `Assigned using offline sample match for "${body.title}".`
          : "Add more aliases and examples to improve offline confidence.",
      },
      recommendations: passed
        ? []
        : ["Add column aliases and example field names to the section body."],
      retrieval_mode: body.retrieval_mode ?? "tfidf",
    };
  },

  updateKbSection: async (
    body: { original_title: string; title?: string; text?: string },
    apiKey?: string,
  ) => {
    await delay(300);
    const current = getOfflineKbSections().find((s) => s.title === body.original_title);
    if (!current) throw new Error(`Section not found: ${body.original_title}`);
    const updated = updateOfflineKbSection(
      body.original_title,
      body.title ?? current.title,
      body.text ?? current.text ?? "",
    );
    const verification = await offlineApi.verifyKbSection(
      { title: updated.title, text: updated.text ?? "" },
      apiKey,
    );
    return { ...updated, verification };
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
    return SAMPLE_OWNERSHIP;
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
    return SAMPLE_LINEAGE;
  },

  lineagePolicies: async (_apiKey?: string) => {
    await delay(200);
    return { policies: [...OFFLINE_LINEAGE_POLICIES] };
  },

  updateLineagePolicy: async (
    policyId: string,
    body: { enabled?: boolean },
    _apiKey?: string,
  ) => {
    await delay(150);
    const idx = OFFLINE_LINEAGE_POLICIES.findIndex((p) => p.id === policyId);
    if (idx >= 0 && body.enabled !== undefined) {
      OFFLINE_LINEAGE_POLICIES[idx] = { ...OFFLINE_LINEAGE_POLICIES[idx], enabled: body.enabled };
    }
    return {
      policy: OFFLINE_LINEAGE_POLICIES[idx]!,
      policies: [...OFFLINE_LINEAGE_POLICIES],
    };
  },

  deleteLineagePolicy: async (policyId: string, _apiKey?: string) => {
    await delay(150);
    const idx = OFFLINE_LINEAGE_POLICIES.findIndex((p) => p.id === policyId);
    if (idx >= 0 && policyId !== "default-db-table-column") {
      OFFLINE_LINEAGE_POLICIES.splice(idx, 1);
    }
    return { policies: [...OFFLINE_LINEAGE_POLICIES] };
  },

  syncLineagePolicyCatalog: async (_apiKey?: string) => {
    await delay(300);
    return { added: [], count: 0, policies: [...OFFLINE_LINEAGE_POLICIES] };
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
      id: "policy-offline",
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
    return SAMPLE_QUALITY_RULES;
  },

  updateRuleStatus: async (
    id: string,
    status: string,
    _failure_count?: number,
    _apiKey?: string,
  ): Promise<QualityRule> => {
    await delay(300);
    const rule = SAMPLE_QUALITY_RULES.find((r) => r.id === id);
    if (!rule) throw new Error("Rule not found");
    return { ...rule, status };
  },

  trustScores: async (_database_name?: string, _apiKey?: string): Promise<TrustScore[]> => {
    await delay(300);
    return SAMPLE_TRUST_SCORES;
  },

  governancePrinciples: async (_apiKey?: string): Promise<GovernancePrinciplesBundle> => {
    await delay(200);
    return SAMPLE_GOVERNANCE_PRINCIPLES;
  },

  createGovernancePrinciple: async (
    body: Pick<GovernancePrinciple, "name" | "description" | "rule_type" | "enabled" | "weight" | "config">,
    _apiKey?: string,
  ) => {
    await delay(300);
    const principle: GovernancePrinciple = {
      id: `prin-offline-${Date.now()}`,
      ...body,
      source: "manual",
    };
    SAMPLE_GOVERNANCE_PRINCIPLES.principles.push(principle);
    return { principle, principles: SAMPLE_GOVERNANCE_PRINCIPLES };
  },

  updateGovernancePrinciple: async (
    id: string,
    body: Partial<Pick<GovernancePrinciple, "name" | "description" | "enabled" | "weight" | "config">>,
    _apiKey?: string,
  ) => {
    await delay(200);
    const idx = SAMPLE_GOVERNANCE_PRINCIPLES.principles.findIndex((p) => p.id === id);
    if (idx >= 0) {
      SAMPLE_GOVERNANCE_PRINCIPLES.principles[idx] = {
        ...SAMPLE_GOVERNANCE_PRINCIPLES.principles[idx],
        ...body,
      };
    }
    return {
      principle: SAMPLE_GOVERNANCE_PRINCIPLES.principles[idx],
      principles: SAMPLE_GOVERNANCE_PRINCIPLES,
    };
  },

  deleteGovernancePrinciple: async (id: string, _apiKey?: string) => {
    await delay(200);
    SAMPLE_GOVERNANCE_PRINCIPLES.principles = SAMPLE_GOVERNANCE_PRINCIPLES.principles.filter(
      (p) => p.id !== id,
    );
    return SAMPLE_GOVERNANCE_PRINCIPLES;
  },

  recomputeGovernanceReadiness: async (_apiKey?: string) => {
    await delay(400);
    return {
      tables_recomputed: SAMPLE_TRUST_SCORES.length,
      domains_with_maturity: SAMPLE_DATA_MATURITY.domains.length,
      maturity_note: "Principles drive maturity axes.",
    };
  },

  nlUpdateGovernancePrinciple: async (
    body: {
      instruction: string;
      no_llm?: boolean;
      dry_run?: boolean;
      recompute_after?: boolean;
    },
    _apiKey?: string,
  ): Promise<GovernanceNlUpdateResult> => {
    await delay(body.no_llm ? 400 : 900);
    const parsed = parseNlInstruction(body.instruction);
    const catalog = SAMPLE_GOVERNANCE_PRINCIPLES.rule_type_catalog.find(
      (e) => e.rule_type === parsed.rule_type,
    );
    const principle: GovernancePrinciple = {
      id: `prin-nl-${Date.now()}`,
      name: parsed.name,
      description: body.instruction,
      rule_type: parsed.rule_type,
      enabled: true,
      weight: 20,
      config: catalog?.default_config ?? {},
      source: "nl",
    };
    if (!body.dry_run) {
      SAMPLE_GOVERNANCE_PRINCIPLES.principles.push(principle);
    }
    return {
      summary: body.dry_run
        ? `Preview: would add principle "${principle.name}"`
        : `Added principle "${principle.name}" and recomputed readiness`,
      dry_run: Boolean(body.dry_run),
      applied: !body.dry_run,
      principle,
      principles: SAMPLE_GOVERNANCE_PRINCIPLES,
      recompute_result: body.dry_run ? undefined : { tables_recomputed: 3 },
    };
  },

  dataMaturity: async (
    domain_id?: string,
    source: "local" | "collibra" | "blended" = "local",
    _apiKey?: string,
  ): Promise<DataMaturityPayload> => {
    await delay(350);
    let base: DataMaturityPayload =
      source === "collibra"
        ? SAMPLE_COLLIBRA_MATURITY
        : source === "blended"
          ? {
              ...SAMPLE_DATA_MATURITY,
              source: "blended",
              domains: [...SAMPLE_DATA_MATURITY.domains, ...SAMPLE_COLLIBRA_MATURITY.domains],
              collibra_meta: SAMPLE_COLLIBRA_MATURITY.collibra_meta,
              enterprise: {
                ...SAMPLE_DATA_MATURITY.enterprise,
                domain_label: "Enterprise (blended)",
              },
            }
          : {
              ...SAMPLE_DATA_MATURITY,
              collibra_available: true,
              governing_principles: SAMPLE_GOVERNANCE_PRINCIPLES.principles,
              axis_principle_map: SAMPLE_DATA_MATURITY.config?.axis_principle_map,
            };

    if (!domain_id || domain_id === "enterprise") {
      return base;
    }
    const match = base.domains.find((d) => d.domain_id === domain_id);
    if (!match) return base;
    return { ...base, selected_domain_id: domain_id, selected: match };
  },

  maturityConfig: async (_apiKey?: string): Promise<MaturityConfig> => {
    await delay(150);
    return SAMPLE_DATA_MATURITY.config!;
  },

  updateMaturityConfig: async (body: Partial<MaturityConfig>, _apiKey?: string) => {
    await delay(200);
    if (SAMPLE_DATA_MATURITY.config) {
      SAMPLE_DATA_MATURITY.config = { ...SAMPLE_DATA_MATURITY.config, ...body };
    }
    return SAMPLE_DATA_MATURITY.config!;
  },

  syncCollibraMaturity: async (_apiKey?: string) => {
    await delay(1200);
    return { ...SAMPLE_COLLIBRA_MATURITY, ok: true };
  },

  maturityExecutiveSummary: async (
    domain_id?: string,
    source: "local" | "collibra" | "blended" = "local",
    opts?: { no_llm?: boolean },
    _apiKey?: string,
  ): Promise<MaturityExecutiveSummary> => {
    await delay(opts?.no_llm === false ? 800 : 200);
    const payload = await offlineApi.dataMaturity(domain_id, source);
    return buildMaturityExecutiveSummary(payload.selected, payload.enterprise, payload.source);
  },

  assistantChat: async (
    body: {
      message: string;
      history?: ChatTurn[];
      no_llm?: boolean;
    },
    _apiKey?: string,
  ): Promise<AssistantChatResponse> => {
    await delay(500);
    const q = body.message.toLowerCase();
    const guardrail = {
      guardrail_note:
        "Answers use only your saved governance catalog — not live warehouse data. The assistant will not guess.",
    };
    if (q.includes("quick draft") || q.includes("no llm") || (q.includes("purpose") && q.includes("draft"))) {
      return {
        answer:
          "Quick draft (no LLM) on Analyze columns runs RAG-only: it retrieves governance policy sections and uses heuristics to draft definitions and classifications without calling Ollama. It is fast, works when Ollama is offline, and is ideal for fast analysis. Use Full AI draft (Ollama) for richer LLM-written text on top of the same policies.",
        sources: ["AI-Assisted Data Governance product guide"],
        mode: "product_guide",
        confidence: "high",
        offer_help_desk: false,
        ...guardrail,
      };
    }
    if (
      q.includes("weather") ||
      q.includes("stock price") ||
      q.includes("write code") ||
      q.includes("recipe")
    ) {
      return {
        answer:
          "I don't have enough grounded information to answer that safely, and I won't guess. Submit this question to the governance help desk so an expert can respond.",
        sources: ["Guardrail: out of scope"],
        mode: "guardrail",
        confidence: "unknown",
        offer_help_desk: true,
        ...guardrail,
      };
    }
    if (q.includes("trust") || q.includes("readiness") || q.includes("score")) {
      return {
        answer:
          "Governance readiness scores track steward workflow — approved definitions, DQ rule status labels, and recent catalog edits. They do not profile your warehouse. Approve definitions on Steward Review and mark DQ rules Passed when ready for your external DQ platform.",
        sources: ["Governance readiness scores"],
        mode: "heuristic",
        confidence: "high",
        offer_help_desk: false,
        ...guardrail,
      };
    }
    if (q.includes("quality") || q.includes("dq") || q.includes("rule")) {
      return {
        answer:
          "DQ rules here are suggested specifications for tools like Great Expectations or Informatica. Nothing executes against live data in AI-Assisted Data Governance — stewards review and export specs to your enterprise DQ stack.",
        sources: ["Data quality rules"],
        mode: "heuristic",
        confidence: "high",
        offer_help_desk: false,
        ...guardrail,
      };
    }
    if (q.includes("lineage")) {
      return {
        answer:
          "Lineage is built from saved definitions and optional NL policies that stitch columns to reports or related tables. Open the Lineage page to explore database → table → column → report paths.",
        sources: ["Lineage graph"],
        mode: "heuristic",
        confidence: "high",
        offer_help_desk: false,
        ...guardrail,
      };
    }
    if (q.includes("unknown_table") || q.includes("fake_db")) {
      return {
        answer:
          "I don't have enough grounded information in your catalog to answer that safely, and I won't guess. Submit this question to the governance help desk so a data governance expert can respond.",
        sources: ["Guardrail: unknown asset"],
        mode: "guardrail",
        confidence: "unknown",
        offer_help_desk: true,
        ...guardrail,
      };
    }
    return {
      answer:
        "I'm the AI-Assisted Data Governance assistant on every page — ask about readiness, suggested DQ rules, lineage, steward approvals, or policies. This tool drafts governance work; it does not measure live data.",
      sources: ["Platform overview"],
      mode: "heuristic",
      confidence: "high",
      offer_help_desk: false,
      ...guardrail,
    };
  },

  listHelpDesk: async (params?: {
    status?: string;
    limit?: number;
    apiKey?: string;
  }): Promise<HelpDeskTicket[]> => {
    await delay(200);
    const raw = JSON.parse(localStorage.getItem("governance_help_desk") || "[]") as HelpDeskTicket[];
    let list = raw.map((t) => ({
      id: t.id,
      question: t.question,
      user_email: t.user_email ?? "",
      user_name: t.user_name ?? "",
      page_context: t.page_context ?? "assistant",
      assistant_confidence: t.assistant_confidence ?? "unknown",
      assistant_preview: t.assistant_preview ?? "",
      status: t.status ?? "open",
      created_at: t.created_at ?? "",
      updated_at: t.updated_at,
    }));
    if (params?.status) list = list.filter((t) => t.status === params.status);
    return list.slice(0, params?.limit ?? 50);
  },

  updateHelpDeskStatus: async (id: string, status: string, _apiKey?: string): Promise<HelpDeskTicket> => {
    await delay(200);
    const raw = JSON.parse(localStorage.getItem("governance_help_desk") || "[]") as HelpDeskTicket[];
    const idx = raw.findIndex((t) => t.id === id);
    if (idx < 0) throw new Error("Ticket not found");
    raw[idx] = { ...raw[idx], status, updated_at: new Date().toISOString() };
    localStorage.setItem("governance_help_desk", JSON.stringify(raw));
    return raw[idx];
  },

  submitHelpDesk: async (
    body: {
      question: string;
      user_email?: string;
      user_name?: string;
      page_context?: string;
      assistant_confidence?: string;
      assistant_preview?: string;
    },
    _apiKey?: string,
  ): Promise<HelpDeskSubmitResponse> => {
    await delay(400);
    const id = `hd-${Date.now()}`;
    const stored = JSON.parse(localStorage.getItem("governance_help_desk") || "[]") as unknown[];
    stored.push({ id, ...body, status: "open", created_at: new Date().toISOString() });
    localStorage.setItem("governance_help_desk", JSON.stringify(stored));
    return {
      id,
      question: body.question,
      status: "open",
      message:
        "Your question was submitted to the governance help desk (offline mode). An expert will follow up.",
      created_at: new Date().toISOString(),
    };
  },

  exportCollibra: async (params?: { approval_status?: string; format?: string; apiKey?: string }) => {
    await delay(400);
    if (params?.approval_status === "approved") return SAMPLE_COLLIBRA_CSV;
    return SAMPLE_COLLIBRA_CSV;
  },

  collibraStatus: async (_apiKey?: string) => ({
    enabled: false,
    configured: false,
    mode: "disabled",
    api_url: "",
    glossary_domain: "Business Glossary",
    business_term_type: "Business Term",
    auto_push_on_approve: false,
    mcp_note: "Connect backend with COLLIBRA_* env vars for live Collibra.",
  }),

  collibraPush: async () => {
    throw new Error("Collibra push requires a connected backend");
  },

  collibraPushApproved: async (_apiKey?: string) => ({ pushed: 0, errors: [] as string[] }),

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
