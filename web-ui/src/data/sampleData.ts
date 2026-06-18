import type {
  AuditEntry,
  DataMaturityPayload,
  FieldDefinition,
  GovernancePrinciple,
  GovernancePrinciplesBundle,
  KbSection,
  LineageGraph,
  QualityRule,
  StewardAssignment,
  TrustScore,
} from "../types";

const now = new Date().toISOString();
const ts = (minsAgo: number) =>
  new Date(Date.now() - minsAgo * 60_000).toISOString();

export const DEFAULT_KB_SECTIONS: KbSection[] = [
  {
    title: "Direct Identifiers",
    text: `Columns such as email, phone, ssn, customer_id, cust_id, user_id, and account_number can identify a person or account.

Governance guidance:
- Classify as sensitive or confidential.
- Define an accountable data owner.
- Restrict access by business need.
- Mask values in non-production environments.`,
  },
  {
    title: "Contact Information",
    text: `Columns such as email_address, phone_number, and mailing_address describe how to contact or locate a person.

Governance guidance:
- Classify as personal data.
- Limit usage to approved communication purposes.
- Mask in analytics unless exact values are required.`,
  },
  {
    title: "Financial Data",
    text: `Columns such as payment_token, salary, revenue, and balance relate to money or compensation.

Governance guidance:
- Classify as restricted when values identify a person or account.
- Encrypt at rest and in transit.
- Monitor access with stronger approval workflows.`,
  },
  {
    title: "Business Glossary Definition Guidance",
    text: `A business glossary definition should describe the business meaning of a field, not just its technical storage purpose.

Good glossary definitions use business-friendly language and explain approved use and sensitivity.`,
  },
  {
    title: "Column Aliases And Abbreviations",
    text: `Enterprise metadata often uses shortened column names. Treat abbreviations the same as standard glossary terms.

Examples:
- cust_id, custid, customer_id → Customer Identifier
- dob, birth_dt, date_of_birth → Date of Birth (PII)
- email, email_addr → Email Address (contact / PII)
- pmt_token, payment_token → Payment Token (restricted financial)
- pwd, password_hash → Credential Secret (restricted)

Apply the same classification, masking, and stewardship as the full standard name.`,
  },
  {
    title: "Health Data",
    text: `Columns such as diagnosis, medication, and patient_id may contain protected health information.

Governance guidance:
- Classify as restricted health data.
- Apply minimum necessary access and strict retention controls.`,
  },
  {
    title: "Authentication And Security Data",
    text: `Columns such as password, token, api_key, and session_id relate to authentication secrets.

Governance guidance:
- Never store raw passwords.
- Classify as restricted and apply encryption.`,
  },
  {
    title: "Free Text And Notes",
    text: `Unstructured comment, note, and description fields may contain unexpected PII.

Governance guidance:
- Treat as potentially sensitive.
- Scan for PII and apply masking in downstream analytics.`,
  },
  {
    title: "Workflow And Status Fields",
    text: `Status, state, and stage columns describe process workflow positions.

Governance guidance:
- Define allowed value enumerations.
- Document business meaning of each status code.`,
  },
];

export const SAMPLE_DEFINITIONS: FieldDefinition[] = [
  {
    id: "sample-001",
    database_name: "customer_db",
    table_name: "customers",
    column_name: "email_address",
    table_description: "Contains records and attributes for customers.",
    glossary_term: "Customer Email Address",
    glossary_term_description:
      "The electronic mail address used to contact, identify, or communicate with a customer.",
    logical_data_attribute_name: "personal_contact_attribute",
    logical_data_attribute_description:
      "Logical attribute containing personal identification or contact details.",
    definition:
      "email_address stores the primary electronic mail contact for a customer account, used for login, notifications, and identity verification.",
    likely_purpose: "Customer communication, authentication, and account recovery.",
    data_classification: "Confidential",
    sensitivity: "Medium",
    governance_actions: [
      "Assign data owner and steward.",
      "Document approved business uses.",
      "Define retention and access rules.",
      "Track lineage to downstream reports and applications.",
    ],
    retrieved_context: ["Contact Information", "Direct Identifiers", "Business Glossary Definition Guidance"],
    sample_values_masked: true,
    masking_reasons: ["contact_field"],
    source: "retrieval_heuristic",
    llm_error: "",
    approval_status: "pending_review",
    steward_comment: "",
    approved_by: "",
    approved_at: "",
    created_at: ts(120),
    updated_at: ts(120),
    retrieval_mode: "vector",
  },
  {
    id: "sample-002",
    database_name: "customer_db",
    table_name: "customers",
    column_name: "customer_id",
    table_description: "Stores core information and profiles for all registered customers.",
    glossary_term: "Customer Identifier",
    glossary_term_description:
      "A unique, system-assigned value used to distinguish a specific customer across organizational systems.",
    logical_data_attribute_name: "customer_id",
    logical_data_attribute_description: "The unique primary key used to identify a customer record.",
    definition:
      "The customer_id is the unique primary key assigned to each customer record in the system.",
    likely_purpose: "To uniquely identify and link all related data points for a specific customer profile.",
    data_classification: "Restricted",
    sensitivity: "High",
    governance_actions: [
      "Define an accountable data owner for customer identifiers.",
      "Restrict access based strictly on business need.",
      "Apply masking or tokenization in non-production environments.",
    ],
    retrieved_context: ["Direct Identifiers"],
    sample_values_masked: true,
    masking_reasons: ["identifier_field"],
    source: "ollama:gemma4:e2b",
    llm_error: "",
    approval_status: "approved",
    steward_comment: "Verified against enterprise glossary v2.1",
    approved_by: "Alex Rivera",
    approved_at: ts(45),
    created_at: ts(300),
    updated_at: ts(45),
    retrieval_mode: "tfidf",
  },
  {
    id: "sample-003",
    database_name: "customer_db",
    table_name: "customers",
    column_name: "date_of_birth",
    table_description: "Contains records and attributes for customers.",
    glossary_term: "Date of Birth",
    glossary_term_description: "The calendar date on which a person was born.",
    logical_data_attribute_name: "personal_demographic_attribute",
    logical_data_attribute_description: "Demographic attribute associated with an individual.",
    definition:
      "date_of_birth records the birth date of a customer, used for age verification and regulatory compliance.",
    likely_purpose: "Age verification, eligibility checks, and compliance reporting.",
    data_classification: "Confidential",
    sensitivity: "High",
    governance_actions: [
      "Classify as personal data under GDPR/CCPA.",
      "Restrict access to authorized personnel only.",
      "Apply date-level masking in analytics environments.",
    ],
    retrieved_context: ["Direct Identifiers", "Contact Information"],
    sample_values_masked: true,
    masking_reasons: ["date_of_birth"],
    source: "retrieval_heuristic",
    llm_error: "",
    approval_status: "pending_review",
    steward_comment: "",
    approved_by: "",
    approved_at: "",
    created_at: ts(118),
    updated_at: ts(118),
    retrieval_mode: "vector",
  },
  {
    id: "sample-004",
    database_name: "finance_db",
    table_name: "payments",
    column_name: "payment_token",
    table_description: "Payment transaction records and tokenized instrument references.",
    glossary_term: "Payment Token",
    glossary_term_description:
      "A surrogate value used to reference a payment instrument without storing raw card or bank numbers.",
    logical_data_attribute_name: "payment_reference_token",
    logical_data_attribute_description: "Tokenized reference to a payment method.",
    definition:
      "payment_token is a tokenized surrogate for a payment instrument, enabling transactions without exposing raw financial account data.",
    likely_purpose: "Secure payment processing and recurring billing.",
    data_classification: "Restricted",
    sensitivity: "High",
    governance_actions: [
      "Encrypt at rest and in transit.",
      "Monitor access with audit logging.",
      "Never log token values in plain text.",
    ],
    retrieved_context: ["Financial Data", "Authentication And Security Data"],
    sample_values_masked: true,
    masking_reasons: ["token_or_secret"],
    source: "ollama:gemma4:e2b",
    llm_error: "",
    approval_status: "approved",
    steward_comment: "PCI scope confirmed with security team",
    approved_by: "Sarah Jenkins",
    approved_at: ts(90),
    created_at: ts(200),
    updated_at: ts(90),
    retrieval_mode: "tfidf",
  },
  {
    id: "sample-005",
    database_name: "hr_db",
    table_name: "employees",
    column_name: "salary",
    table_description: "Employee compensation and HR profile data.",
    glossary_term: "Employee Compensation",
    glossary_term_description: "The monetary amount paid to an employee for services rendered.",
    logical_data_attribute_name: "compensation_amount",
    logical_data_attribute_description: "Numeric value representing employee pay.",
    definition:
      "salary stores the annual or periodic compensation amount for an employee, subject to HR confidentiality policies.",
    likely_purpose: "Payroll processing, compensation planning, and regulatory reporting.",
    data_classification: "Restricted",
    sensitivity: "High",
    governance_actions: [
      "Restrict to HR and finance roles.",
      "Apply aggregation in reporting.",
      "Define retention per employment law.",
    ],
    retrieved_context: ["Financial Data"],
    sample_values_masked: true,
    masking_reasons: ["financial_field"],
    source: "retrieval_heuristic",
    llm_error: "",
    approval_status: "pending_review",
    steward_comment: "",
    approved_by: "",
    approved_at: "",
    created_at: ts(115),
    updated_at: ts(115),
    retrieval_mode: "tfidf",
  },
];

export const SAMPLE_OWNERSHIP: StewardAssignment[] = [
  {
    id: "own-001",
    database_name: "customer_db",
    table_name: "customers",
    column_name: "customer_id",
    business_owner: "Sarah Jenkins",
    business_owner_email: "sarah.jenkins@company.com",
    data_steward: "Alex Rivera",
    data_steward_email: "alex.rivera@company.com",
    lifecycle_status: "Approved",
    notes: "Core profile primary identifier.",
    field_definition_id: "sample-002",
  },
  {
    id: "own-002",
    database_name: "customer_db",
    table_name: "customers",
    column_name: "email_address",
    business_owner: "Sarah Jenkins",
    business_owner_email: "sarah.jenkins@company.com",
    data_steward: "Alex Rivera",
    data_steward_email: "alex.rivera@company.com",
    lifecycle_status: "Approved",
    notes: "PII classification review is completed.",
    field_definition_id: "sample-001",
  },
  {
    id: "own-003",
    database_name: "finance_db",
    table_name: "payments",
    column_name: "payment_token",
    business_owner: "Michael Chang",
    business_owner_email: "michael.chang@company.com",
    data_steward: "Sarah Jenkins",
    data_steward_email: "sarah.jenkins@company.com",
    lifecycle_status: "Reviewed",
    notes: "Token references sensitive payout routes.",
    field_definition_id: "sample-004",
  },
];

export const SAMPLE_QUALITY_RULES: QualityRule[] = [
  {
    id: "qr-001",
    database_name: "customer_db",
    table_name: "customers",
    column_name: "email_address",
    rule_name: "Valid Email Schema Format",
    rule_type: "Validity",
    description: "Verifies that values match a valid email address pattern.",
    reasoning:
      "Column `email_address` on `customer_db.customers`; classification **Confidential**; glossary term “Primary Email”. The column name indicates a contact field, so email format validation at 99.9% is recommended before catalog publication.",
    threshold: "99.9%",
    status: "Suggested",
    failure_count: 0,
    source: "auto_suggested",
  },
  {
    id: "qr-002",
    database_name: "customer_db",
    table_name: "customers",
    column_name: "customer_id",
    rule_name: "Primary Key Uniqueness",
    rule_type: "Uniqueness",
    description: "Validates zero duplicate identifier values across active table rows.",
    reasoning:
      "Column `customer_id` on `customer_db.customers`; classification **Restricted**. Identifier naming pattern (`_id`) implies a primary key — uniqueness at 100% protects joins and master data integrity.",
    threshold: "100%",
    status: "Passed",
    failure_count: 0,
    source: "auto_suggested",
  },
  {
    id: "qr-003",
    database_name: "customer_db",
    table_name: "customers",
    column_name: "email_address",
    rule_name: "PII Compliance Adherence",
    rule_type: "Compliance Check",
    description: "Flags rows where sensitive values appear without approved masking controls.",
    reasoning:
      "Column `email_address` on `customer_db.customers`; classification **Confidential**. Sensitive classification plus contact data — compliance and masking checks should run in your enterprise DQ stack.",
    threshold: "100%",
    status: "Suggested",
    failure_count: 0,
    source: "auto_suggested",
  },
  {
    id: "qr-004",
    database_name: "hr_db",
    table_name: "employees",
    column_name: "salary",
    rule_name: "Value Boundary Constraint",
    rule_type: "Accuracy",
    description: "Verifies numeric financial values are within approved business boundaries.",
    reasoning:
      "Column `salary` on `hr_db.employees`; classification **Confidential**. Financial token `salary` detected — range and boundary validation reduces payroll and reporting risk.",
    threshold: "100%",
    status: "Warning",
    failure_count: 3,
    source: "auto_suggested",
  },
];

const READINESS_NOTE =
  "Scores reflect your governing principles and steward workflow in this assistant — not statistical data quality or warehouse profiling.";

const DEFAULT_PRINCIPLES: GovernancePrinciple[] = [
  { id: "approved-definitions", name: "Approved definitions", rule_type: "approved_definitions", enabled: true, weight: 25 },
  { id: "dq-rules-stewarded", name: "DQ rules stewarded", rule_type: "dq_rule_stewardship", enabled: true, weight: 25 },
  { id: "recent-activity", name: "Recent steward activity", rule_type: "recent_activity", enabled: true, weight: 25 },
  { id: "steward-approvals", name: "Steward approvals", rule_type: "steward_approvals", enabled: true, weight: 25 },
];

const DIMENSION_LABELS = Object.fromEntries(
  DEFAULT_PRINCIPLES.map((p) => [p.id!, p.name]),
);

export const SAMPLE_GOVERNANCE_PRINCIPLES: GovernancePrinciplesBundle = {
  readiness_note: READINESS_NOTE,
  thresholds: { ready: 75, in_progress: 40 },
  principles: DEFAULT_PRINCIPLES,
  rule_type_catalog: [
    {
      rule_type: "classification_coverage",
      label: "Sensitive data classified",
      description: "Sensitive-looking columns have an assigned classification.",
      default_config: {},
      maturity_axis: "security_classification",
      maturity_pillar_label: "Security & classification",
    },
    {
      rule_type: "glossary_linked",
      label: "Glossary terms linked",
      description: "Columns are linked to business glossary terms.",
      default_config: {},
      maturity_axis: "metadata_definitions",
      maturity_pillar_label: "Metadata & definitions",
    },
  ],
};

export const SAMPLE_TRUST_SCORES: TrustScore[] = [
  {
    id: "ts-001",
    database_name: "customer_db",
    table_name: "customers",
    overall_score: 48,
    breakdown: {
      "approved-definitions": 33,
      "dq-rules-stewarded": 25,
      "recent-activity": 50,
      "steward-approvals": 33,
    },
    scores: {
      "approved-definitions": 33,
      "dq-rules-stewarded": 25,
      "recent-activity": 50,
      "steward-approvals": 33,
    },
    dimension_labels: DIMENSION_LABELS,
    readiness_note: READINESS_NOTE,
    score_type: "governance_readiness",
    reasoning: {
      summary: READINESS_NOTE,
      "approved-definitions": "1/3 columns have approved definitions (33%). Draft or pending AI suggestions do not count.",
      "dq-rules-stewarded": "3 suggested DQ rules; 0 Passed, 3 still Suggested (25%).",
      "recent-activity": "50% of approved definitions updated in the last 7 day(s).",
      "steward-approvals": "1/3 columns steward-approved (33%). Pending review earns no credit.",
    },
    status: "In progress",
    steward_assigned: "Alex Rivera",
    last_profiled: ts(30),
  },
  {
    id: "ts-002",
    database_name: "finance_db",
    table_name: "payments",
    overall_score: 69,
    breakdown: {
      "approved-definitions": 100,
      "dq-rules-stewarded": 25,
      "recent-activity": 100,
      "steward-approvals": 50,
    },
    scores: {
      "approved-definitions": 100,
      "dq-rules-stewarded": 25,
      "recent-activity": 100,
      "steward-approvals": 50,
    },
    dimension_labels: DIMENSION_LABELS,
    readiness_note: READINESS_NOTE,
    score_type: "governance_readiness",
    reasoning: {
      summary: READINESS_NOTE,
      "approved-definitions": "1/1 columns have approved definitions (100%).",
      "dq-rules-stewarded": "1 suggested DQ rule; 0 Passed, 1 Suggested (25%).",
      "recent-activity": "100% of approved definitions updated in the last 7 day(s).",
      "steward-approvals": "1/2 columns steward-approved (50%).",
    },
    status: "In progress",
    steward_assigned: "Sarah Jenkins",
    last_profiled: ts(60),
  },
  {
    id: "ts-003",
    database_name: "hr_db",
    table_name: "employees",
    overall_score: 19,
    breakdown: {
      "approved-definitions": 0,
      "dq-rules-stewarded": 25,
      "recent-activity": 0,
      "steward-approvals": 50,
    },
    scores: {
      "approved-definitions": 0,
      "dq-rules-stewarded": 25,
      "recent-activity": 0,
      "steward-approvals": 50,
    },
    dimension_labels: DIMENSION_LABELS,
    readiness_note: READINESS_NOTE,
    score_type: "governance_readiness",
    reasoning: {
      summary: READINESS_NOTE,
      "approved-definitions": "0/2 columns have approved definitions (0%).",
      "dq-rules-stewarded": "2 suggested DQ rules; 0 Passed, 2 Suggested (25%).",
      "recent-activity": "No approved definitions yet — steward approvals unlock this dimension.",
      "steward-approvals": "1/2 columns steward-approved (50%).",
    },
    status: "Needs attention",
    steward_assigned: "Michael Chang",
    last_profiled: ts(45),
  },
];

const GARTNER_STAGES = [
  { level: 1, key: "unaware", label: "Unaware", description: "Ad hoc data practices; limited awareness of data as an asset." },
  { level: 2, key: "reactive", label: "Reactive", description: "Issue-driven fixes; inconsistent stewardship and quality controls." },
  { level: 3, key: "proactive", label: "Proactive", description: "Intentional capabilities; emerging governance and metadata discipline." },
  { level: 4, key: "managed", label: "Managed", description: "Measured, governed processes with steward accountability." },
  { level: 5, key: "strategic", label: "Strategic", description: "Data treated as a strategic asset; trusted for enterprise decisions." },
];

const MATURITY_DIMS = [
  { key: "governance_stewardship", label: "Governance & stewardship", description: "Steward approvals and ownership." },
  { key: "metadata_definitions", label: "Metadata & definitions", description: "Approved definitions and glossary." },
  { key: "data_quality", label: "Data quality", description: "Steward-validated DQ rules." },
  { key: "lineage_traceability", label: "Lineage & traceability", description: "Documented column-to-report flows." },
  { key: "security_classification", label: "Security & classification", description: "Sensitivity labels and policy citations." },
  { key: "operational_readiness", label: "Operational readiness", description: "Composite governance readiness." },
];

function sampleDomain(
  domain_id: string,
  domain_label: string,
  overall_level: number,
  stageLevel: number,
  scores: number[],
  stats: Record<string, number | string>,
  details: string[],
): DataMaturityPayload["domains"][0] {
  return {
    domain_id,
    domain_label,
    overall_level,
    overall_score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    stage: { ...GARTNER_STAGES[stageLevel - 1], computed_level: overall_level },
    dimensions: MATURITY_DIMS.map((d, i) => ({
      ...d,
      score: scores[i],
      level: Math.round((1 + (scores[i] / 100) * 4) * 10) / 10,
      detail: details[i],
    })),
    stats,
  };
}

const SAMPLE_DOMAINS = [
  sampleDomain(
    "customer_db",
    "Customer",
    2.4,
    2,
    [45, 38, 25, 55, 62, 48],
    { columns: 3, tables: 1, dq_rules: 3, trust_tables: 1 },
    [
      "1/3 steward-approved; 2/3 with assigned data steward.",
      "1/3 with approved definitions; 1/3 glossary-linked.",
      "0/3 DQ rules marked Passed.",
      "3/3 columns in lineage graph.",
      "3/3 classified; 1/3 with policy citations.",
      "Average readiness 48% across 1 table.",
    ],
  ),
  sampleDomain(
    "finance_db",
    "Finance",
    3.1,
    3,
    [58, 72, 25, 68, 70, 69],
    { columns: 2, tables: 2, dq_rules: 1, trust_tables: 1 },
    [
      "1/2 steward-approved; 2/2 with assigned data steward.",
      "1/1 with approved definitions; 1/2 glossary-linked.",
      "0/1 DQ rules marked Passed.",
      "2/2 columns in lineage graph; cross-system policy stitches detected.",
      "2/2 classified; 1/2 with policy citations.",
      "Average readiness 69% across 1 table.",
    ],
  ),
  sampleDomain(
    "hr_db",
    "Human Resources",
    1.8,
    2,
    [35, 12, 25, 40, 28, 19],
    { columns: 2, tables: 1, dq_rules: 2, trust_tables: 1 },
    [
      "1/2 steward-approved; 1/2 with assigned data steward.",
      "0/2 with approved definitions; 0/2 glossary-linked.",
      "0/2 DQ rules marked Passed.",
      "1/2 columns in lineage graph.",
      "1/2 classified; 0/2 with policy citations.",
      "Average readiness 19% across 1 table.",
    ],
  ),
];

const enterpriseScores = MATURITY_DIMS.map((_, i) =>
  Math.round(SAMPLE_DOMAINS.reduce((s, d) => s + d.dimensions[i].score, 0) / SAMPLE_DOMAINS.length),
);

export const SAMPLE_DATA_MATURITY: DataMaturityPayload = {
  framework: "gartner_data_analytics_maturity",
  source: "local",
  collibra_available: true,
  config: {
    domain_labels: {
      customer_db: "Customer",
      finance_db: "Finance",
      hr_db: "Human Resources",
    },
    dimension_weights: {
      governance_stewardship: 20,
      metadata_definitions: 20,
      data_quality: 15,
      lineage_traceability: 15,
      security_classification: 15,
      operational_readiness: 15,
    },
    axis_principle_map: {
      governance_stewardship: ["steward-approvals", "ownership-assigned"],
      metadata_definitions: ["approved-definitions", "glossary-linked"],
      data_quality: ["dq-rules-stewarded"],
      lineage_traceability: [],
      security_classification: ["classification-coverage", "policy-citations"],
      operational_readiness: ["recent-activity"],
    },
    collibra_max_assets: 3000,
  },
  principles_drive_maturity: true,
  stages: GARTNER_STAGES,
  dimension_catalog: MATURITY_DIMS,
  selected_domain_id: "enterprise",
  domains: SAMPLE_DOMAINS,
  enterprise: sampleDomain(
    "enterprise",
    "Enterprise",
    2.4,
    2,
    enterpriseScores,
    { domains: 3, columns: 7, tables: 4 },
    MATURITY_DIMS.map(() => "Enterprise average across 3 data domain(s)."),
  ),
  selected: sampleDomain(
    "enterprise",
    "Enterprise",
    2.4,
    2,
    enterpriseScores,
    { domains: 3, columns: 7, tables: 4 },
    MATURITY_DIMS.map(() => "Enterprise average across 3 data domain(s)."),
  ),
};

const COLLIBRA_SAMPLE_DOMAINS = [
  sampleDomain(
    "collibra:business_glossary",
    "Business Glossary",
    3.6,
    4,
    [72, 68, 45, 55, 60, 58],
    { collibra_assets: 124, source: "collibra" },
    [
      "Average across 124 Collibra assets in “Business Glossary”.",
      "Average across 124 Collibra assets in “Business Glossary”.",
      "Average across 124 Collibra assets in “Business Glossary”.",
      "Average across 124 Collibra assets in “Business Glossary”.",
      "Average across 124 Collibra assets in “Business Glossary”.",
      "Average across 124 Collibra assets in “Business Glossary”.",
    ],
  ),
  sampleDomain(
    "collibra:technical_data_dictionary",
    "Technical Data Dictionary",
    2.8,
    3,
    [55, 48, 30, 62, 52, 44],
    { collibra_assets: 890, source: "collibra" },
    [
      "Average across 890 Collibra assets in “Technical Data Dictionary”.",
      "Average across 890 Collibra assets in “Technical Data Dictionary”.",
      "Average across 890 Collibra assets in “Technical Data Dictionary”.",
      "Average across 890 Collibra assets in “Technical Data Dictionary”.",
      "Average across 890 Collibra assets in “Technical Data Dictionary”.",
      "Average across 890 Collibra assets in “Technical Data Dictionary”.",
    ],
  ),
];

const collibraEntScores = MATURITY_DIMS.map((_, i) =>
  Math.round(
    COLLIBRA_SAMPLE_DOMAINS.reduce((s, d) => s + d.dimensions[i].score, 0) /
      COLLIBRA_SAMPLE_DOMAINS.length,
  ),
);

export const SAMPLE_COLLIBRA_MATURITY: DataMaturityPayload = {
  framework: "gartner_data_analytics_maturity",
  source: "collibra",
  ok: true,
  synced_at: new Date().toISOString(),
  collibra_meta: { asset_count: 1014, domain_count: 2, synced_at: new Date().toISOString() },
  config: SAMPLE_DATA_MATURITY.config,
  stages: GARTNER_STAGES,
  dimension_catalog: MATURITY_DIMS,
  selected_domain_id: "enterprise",
  domains: COLLIBRA_SAMPLE_DOMAINS,
  enterprise: sampleDomain(
    "enterprise",
    "Enterprise (Collibra)",
    3.1,
    3,
    collibraEntScores,
    { collibra_assets: 1014, domains: 2, source: "collibra" },
    MATURITY_DIMS.map(() => "Enterprise average across 2 Collibra domain(s), 1014 assets."),
  ),
  selected: sampleDomain(
    "enterprise",
    "Enterprise (Collibra)",
    3.1,
    3,
    collibraEntScores,
    { collibra_assets: 1014, domains: 2, source: "collibra" },
    MATURITY_DIMS.map(() => "Enterprise average across 2 Collibra domain(s), 1014 assets."),
  ),
};

export const SAMPLE_LINEAGE: LineageGraph = {
  nodes: [
    { id: "db:customer_db", label: "customer_db", type: "database", details: "Customer database" },
    { id: "tbl:customer_db:customers", label: "customers", type: "table", database_name: "customer_db", details: "Customer profiles" },
    { id: "col:customer_db:customers:email_address", label: "email_address", type: "column", classification: "Confidential", sensitivity: "Medium", details: "Primary email contact" },
    { id: "col:customer_db:customers:customer_id", label: "customer_id", type: "column", classification: "Restricted", sensitivity: "High" },
    { id: "col:customer_db:customers:date_of_birth", label: "date_of_birth", type: "column", classification: "Confidential", sensitivity: "High" },
    { id: "db:finance_db", label: "finance_db", type: "database" },
    { id: "tbl:finance_db:payments", label: "payments", type: "table", database_name: "finance_db" },
    { id: "col:finance_db:payments:payment_token", label: "payment_token", type: "column", classification: "Restricted", sensitivity: "High" },
    { id: "col:finance_db:orders:customer_id", label: "customer_id", type: "column", classification: "Restricted", sensitivity: "High", database_name: "finance_db", table_name: "orders" },
    { id: "tbl:finance_db:orders", label: "orders", type: "table", database_name: "finance_db" },
    { id: "report_audit", label: "GDPR Compliance Ledger", type: "report", details: "Securities audit log" },
    { id: "report_sales", label: "Sales & Revenue Dashboard", type: "report", details: "Executive reporting" },
  ],
  edges: [
    { id: "e1", source_id: "db:customer_db", target_id: "tbl:customer_db:customers", label: "" },
    { id: "e2", source_id: "tbl:customer_db:customers", target_id: "col:customer_db:customers:email_address", label: "" },
    { id: "e3", source_id: "tbl:customer_db:customers", target_id: "col:customer_db:customers:customer_id", label: "" },
    { id: "e4", source_id: "col:customer_db:customers:email_address", target_id: "report_audit", label: "PII scan target" },
    { id: "e5", source_id: "db:finance_db", target_id: "tbl:finance_db:payments", label: "" },
    { id: "e6", source_id: "tbl:finance_db:payments", target_id: "col:finance_db:payments:payment_token", label: "" },
    { id: "e7", source_id: "col:finance_db:payments:payment_token", target_id: "report_sales", label: "revenue links" },
    { id: "e8", source_id: "db:finance_db", target_id: "tbl:finance_db:orders", label: "" },
    { id: "e9", source_id: "tbl:finance_db:orders", target_id: "col:finance_db:orders:customer_id", label: "" },
    { id: "e10", source_id: "col:customer_db:customers:customer_id", target_id: "col:finance_db:orders:customer_id", label: "same full name" },
  ],
};

export const SAMPLE_AUDIT: AuditEntry[] = [
  {
    id: "aud-001",
    action: "upload_metadata",
    entity_type: "field_definition",
    entity_id: "",
    provider: "ollama",
    model: "gemma4:e2b",
    no_llm: false,
    mask_samples: true,
    fields_processed: 5,
    details: { dataset_context: "Enterprise customer metadata export", run_meta: { retrieval_mode: "vector" } },
    created_at: ts(120),
  },
  {
    id: "aud-002",
    action: "approve_definition",
    entity_type: "field_definition",
    entity_id: "sample-002",
    provider: "",
    model: "",
    no_llm: false,
    mask_samples: false,
    fields_processed: 0,
    details: { approval_status: "approved", approved_by: "Alex Rivera" },
    created_at: ts(45),
  },
  {
    id: "aud-003",
    action: "approve_definition",
    entity_type: "field_definition",
    entity_id: "sample-004",
    provider: "",
    model: "",
    no_llm: false,
    mask_samples: false,
    fields_processed: 0,
    details: { approval_status: "approved", approved_by: "Sarah Jenkins" },
    created_at: ts(90),
  },
  {
    id: "aud-004",
    action: "analyze_metadata",
    entity_type: "field_definition",
    entity_id: "",
    provider: "ollama",
    model: "gemma4:e2b",
    no_llm: true,
    mask_samples: true,
    fields_processed: 1,
    details: { run_meta: { retrieval_mode: "tfidf" } },
    created_at: ts(15),
  },
];

export const SAMPLE_COLLIBRA_CSV = `Asset Type,Asset Name,Definition,Classification,Sensitivity,Business Glossary Term,Logical Attribute,Approval Status,Steward
Column,customer_db.customers.customer_id,"The customer_id is the unique primary key assigned to each customer record.",Restricted,High,Customer Identifier,customer_id,approved,Alex Rivera
Column,finance_db.payments.payment_token,"Tokenized surrogate for a payment instrument.",Restricted,High,Payment Token,payment_reference_token,approved,Sarah Jenkins
`;

/** Mutable in-memory store for offline approve/analyze interactions */
let offlineDefinitions = [...SAMPLE_DEFINITIONS];
let offlineAudit = [...SAMPLE_AUDIT];

export function getOfflineDefinitions() {
  return [...offlineDefinitions];
}

export function setOfflineDefinition(updated: FieldDefinition) {
  offlineDefinitions = offlineDefinitions.map((d) =>
    d.id === updated.id ? updated : d,
  );
  offlineAudit = [
    {
      id: `aud-${Date.now()}`,
      action: "approve_definition",
      entity_type: "field_definition",
      entity_id: updated.id,
      provider: "",
      model: "",
      no_llm: false,
      mask_samples: false,
      fields_processed: 0,
      details: {
        approval_status: updated.approval_status,
        approved_by: updated.approved_by,
      },
      created_at: now,
    },
    ...offlineAudit,
  ];
}

export function addOfflineAnalysisResults(results: FieldDefinition[]) {
  for (const r of results) {
    const existing = offlineDefinitions.findIndex(
      (d) =>
        d.database_name === r.database_name &&
        d.table_name === r.table_name &&
        d.column_name === r.column_name,
    );
    if (existing >= 0) offlineDefinitions[existing] = r;
    else offlineDefinitions.push(r);
  }
  offlineAudit = [
    {
      id: `aud-${Date.now()}`,
      action: "upload_metadata",
      entity_type: "field_definition",
      entity_id: "",
      provider: "offline",
      model: "offline",
      no_llm: true,
      mask_samples: true,
      fields_processed: results.length,
      details: { offline: true },
      created_at: now,
    },
    ...offlineAudit,
  ];
}

export function getOfflineAudit() {
  return [...offlineAudit];
}

export function resetOfflineStore() {
  offlineDefinitions = [...SAMPLE_DEFINITIONS];
  offlineAudit = [...SAMPLE_AUDIT];
  offlineKbSections = DEFAULT_KB_SECTIONS.map((s) => ({ ...s }));
}

let offlineKbSections = DEFAULT_KB_SECTIONS.map((s) => ({ ...s }));

export function getOfflineKbSections(): KbSection[] {
  return offlineKbSections.map((s) => ({ ...s }));
}

export function createOfflineKbSection(title: string, text: string): KbSection {
  if (offlineKbSections.some((s) => s.title.toLowerCase() === title.toLowerCase())) {
    throw new Error(`Section already exists: ${title}`);
  }
  const section = { title, text };
  offlineKbSections.push(section);
  return section;
}

export function updateOfflineKbSection(
  originalTitle: string,
  title: string,
  text: string,
): KbSection {
  const index = offlineKbSections.findIndex((s) => s.title === originalTitle);
  if (index < 0) throw new Error(`Section not found: ${originalTitle}`);
  const updated = { title, text };
  offlineKbSections[index] = updated;
  return updated;
}

export function deleteOfflineKbSection(title: string): KbSection {
  const index = offlineKbSections.findIndex((s) => s.title === title);
  if (index < 0) throw new Error(`Section not found: ${title}`);
  const [removed] = offlineKbSections.splice(index, 1);
  return removed;
}

export const DEFAULT_CREDENTIALS = {
  email: "steward@governance.local",
  password: "steward",
};

export const DEFAULT_USER = {
  email: "steward@governance.local",
  name: "Alex Rivera",
  role: "Data Steward",
  avatar: "AR",
};
