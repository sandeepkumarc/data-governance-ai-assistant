export interface FieldDefinition {
  id: string;
  database_name: string;
  table_name: string;
  column_name: string;
  table_description: string;
  glossary_term: string;
  glossary_term_description: string;
  logical_data_attribute_name: string;
  logical_data_attribute_description: string;
  definition: string;
  likely_purpose: string;
  data_classification: string;
  sensitivity: string;
  governance_actions: string[];
  retrieved_context: string[];
  policy_citations?: PolicyCitation[];
  decision_rationale?: string;
  regulatory_tags?: string[];
  sample_values_masked: boolean;
  masking_reasons: string[];
  source: string;
  llm_error: string;
  approval_status: string;
  steward_comment: string;
  approved_by: string;
  approved_at: string;
  created_at: string;
  updated_at: string;
  retrieval_mode?: string;
  collibra_asset_id?: string;
  collibra_sync_status?: string;
  collibra_matches?: CollibraMatch[];
  collibra_recommended_action?: string;
}

export interface CollibraMatch {
  collibra_asset_id: string;
  name: string;
  display_name: string;
  type: string;
  definition_excerpt: string;
  suggested_action: "link" | "create_new" | string;
  match_query?: string;
}

export interface CollibraStatus {
  enabled: boolean;
  configured: boolean;
  mode: string;
  api_url: string;
  glossary_domain: string;
  business_term_type: string;
  auto_push_on_approve: boolean;
  mcp_note?: string;
}

export interface PolicyCitation {
  section: string;
  excerpt: string;
  relevance_score?: number | null;
}

export interface StewardAssignment {
  id: string;
  database_name: string;
  table_name: string;
  column_name: string;
  business_owner: string;
  business_owner_email: string;
  data_steward: string;
  data_steward_email: string;
  lifecycle_status: string;
  notes: string;
  field_definition_id: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  provider: string;
  model: string;
  no_llm: boolean;
  mask_samples: boolean;
  fields_processed: number;
  details: Record<string, unknown>;
  created_at: string;
}

export interface QualityRule {
  id: string;
  database_name: string;
  table_name: string;
  column_name: string;
  rule_name: string;
  rule_type: string;
  description: string;
  reasoning?: string;
  threshold: string;
  status: string;
  failure_count: number;
  source: string;
}

export interface TrustScoreReasoning {
  summary?: string;
  [principleId: string]: string | undefined;
}

export interface TrustScore {
  id: string;
  database_name: string;
  table_name: string;
  overall_score: number;
  breakdown: Record<string, number | TrustScoreReasoning | undefined>;
  scores?: Record<string, number>;
  dimension_labels?: Record<string, string>;
  reasoning?: TrustScoreReasoning;
  readiness_note?: string;
  score_type?: string;
  status: string;
  steward_assigned: string;
  last_profiled: string | null;
}

export interface GovernancePrinciple {
  id?: string;
  name: string;
  description?: string;
  enabled?: boolean;
  weight?: number;
  rule_type: string;
  config?: Record<string, unknown>;
  source?: string;
  nl_instruction?: string;
}

export interface GovernanceRuleTypeCatalogEntry {
  rule_type: string;
  label: string;
  description: string;
  default_config: Record<string, unknown>;
  maturity_axis?: string | null;
  maturity_pillar_label?: string | null;
}

export interface GovernancePrinciplesBundle {
  readiness_note: string;
  thresholds: { ready: number; in_progress: number };
  principles: GovernancePrinciple[];
  rule_type_catalog: GovernanceRuleTypeCatalogEntry[];
}

export interface GovernanceNlUpdateResult {
  summary: string;
  dry_run: boolean;
  applied: boolean;
  principle: GovernancePrinciple;
  principles?: GovernancePrinciplesBundle;
  recompute_result?: { tables_recomputed: number };
}

export interface DataMaturityStage {
  level: number;
  key: string;
  label: string;
  description: string;
  computed_level?: number;
}

export interface DataMaturityDimension {
  key: string;
  label: string;
  description: string;
  score: number;
  level: number;
  detail: string;
  weight?: number;
  principle_ids?: string[];
  principle_scores?: Array<{
    id: string;
    name: string;
    rule_type?: string;
    weight: number;
    score: number;
    detail: string;
  }>;
}

export interface DataMaturityDomain {
  domain_id: string;
  domain_label: string;
  overall_level: number;
  overall_score: number;
  stage: DataMaturityStage;
  dimensions: DataMaturityDimension[];
  stats: Record<string, number | string>;
}

export interface DataMaturityPayload {
  framework: string;
  source?: "local" | "collibra" | "blended";
  stages: DataMaturityStage[];
  dimension_catalog: Array<{ key: string; label: string; description: string }>;
  config?: MaturityConfig;
  collibra_available?: boolean;
  collibra_meta?: {
    asset_count?: number;
    domain_count?: number;
    synced_at?: string | null;
  };
  synced_at?: string | null;
  ok?: boolean;
  principles_drive_maturity?: boolean;
  governing_principles?: GovernancePrinciple[];
  axis_principle_map?: Record<string, string[]>;
  error?: string;
  selected_domain_id: string;
  selected: DataMaturityDomain;
  enterprise: DataMaturityDomain;
  domains: DataMaturityDomain[];
  local_domains?: DataMaturityDomain[];
  collibra_domains?: DataMaturityDomain[];
}

export interface MaturityExecutiveSummary {
  domain_id: string;
  domain_label: string;
  source: "local" | "collibra" | "blended";
  summary: string;
  heuristic_summary: string;
  used_llm: boolean;
  strongest: Array<{ key: string; label: string; level: number; score: number }>;
  weakest: Array<{ key: string; label: string; level: number; score: number }>;
  stage: DataMaturityStage;
  overall_level: number;
  overall_score: number;
}

export interface MaturityConfig {
  domain_labels: Record<string, string>;
  dimension_weights: Record<string, number>;
  axis_principle_map?: Record<string, string[]>;
  collibra_max_assets: number;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type AssistantConfidence = "high" | "low" | "unknown";

export interface AssistantChatResponse {
  answer: string;
  sources: string[];
  mode: string;
  confidence?: AssistantConfidence;
  offer_help_desk?: boolean;
  guardrail_note?: string;
  context_preview?: string;
}

export interface HelpDeskSubmitResponse {
  id: string;
  question: string;
  status: string;
  message: string;
  created_at?: string;
}

export interface HelpDeskTicket {
  id: string;
  question: string;
  user_email: string;
  user_name: string;
  page_context: string;
  assistant_confidence: string;
  assistant_preview: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export interface LineageNode {
  id: string;
  label: string;
  type: string;
  details?: string;
  database_name?: string;
  table_name?: string;
  column_name?: string;
  classification?: string;
  sensitivity?: string;
}

export interface LineageEdge {
  id: string;
  source_id: string;
  target_id: string;
  label: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  mermaid?: string;
}

export interface KbSection {
  title: string;
  text?: string;
  verification?: KnowledgeSectionVerification;
}

export interface KnowledgeSectionVerification {
  passed: boolean;
  confidence: number;
  target_section: string;
  target_rank: number | null;
  target_relevance_score: number | null;
  retrieved_sections: string[];
  cited_sections: string[];
  probe_columns: string[];
  test_case: {
    database_name: string;
    table_name: string;
    column_name: string;
    data_type: string;
    sample_values: string[];
    notes: string;
    sample_csv: string;
    csv_filename: string;
  };
  analysis_preview: {
    glossary_term: string;
    definition: string;
    data_classification: string;
    sensitivity: string;
    decision_rationale: string;
  };
  recommendations: string[];
  retrieval_mode: string;
}

export interface KbNlChange {
  action: "create" | "update" | "delete";
  original_title?: string;
  title: string;
  text?: string;
}

export interface KbNlUpdateResult {
  summary: string;
  dry_run: boolean;
  applied: boolean;
  changes: KbNlChange[];
  sections?: KbSection[];
}

export interface LineagePolicy {
  id?: string;
  name: string;
  description?: string;
  enabled?: boolean;
  rule_type: string;
  config?: Record<string, unknown>;
  source?: string;
}

export interface LineageNlUpdateResult {
  summary: string;
  dry_run: boolean;
  applied: boolean;
  policy: LineagePolicy;
  policies?: LineagePolicy[];
  apply_result?: {
    policies_run: number;
    edges_added: number;
    results: Array<Record<string, unknown>>;
  };
}

export interface AnalyzeField {
  database_name: string;
  table_name: string;
  column_name: string;
  data_type: string;
  sample_values: string[];
  notes: string;
}

export type Classification =
  | "Public"
  | "Internal"
  | "Confidential"
  | "Restricted"
  | string;
