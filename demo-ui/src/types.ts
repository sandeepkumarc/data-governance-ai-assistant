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
  threshold: string;
  status: string;
  failure_count: number;
  source: string;
}

export interface TrustScore {
  id: string;
  database_name: string;
  table_name: string;
  overall_score: number;
  breakdown: {
    completeness: number;
    accuracy: number;
    freshness: number;
    schema_consistency: number;
  };
  status: string;
  steward_assigned: string;
  last_profiled: string | null;
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
