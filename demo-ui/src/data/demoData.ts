import type {
  AuditEntry,
  FieldDefinition,
  KbSection,
  LineageGraph,
  QualityRule,
  StewardAssignment,
  TrustScore,
} from "../types";

const now = new Date().toISOString();
const ts = (minsAgo: number) =>
  new Date(Date.now() - minsAgo * 60_000).toISOString();

export const DEMO_KB_SECTIONS: KbSection[] = [
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

export const DEMO_DEFINITIONS: FieldDefinition[] = [
  {
    id: "demo-001",
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
    id: "demo-002",
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
    id: "demo-003",
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
    id: "demo-004",
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
    id: "demo-005",
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

export const DEMO_OWNERSHIP: StewardAssignment[] = [
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
    field_definition_id: "demo-002",
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
    field_definition_id: "demo-001",
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
    field_definition_id: "demo-004",
  },
];

export const DEMO_QUALITY_RULES: QualityRule[] = [
  {
    id: "qr-001",
    database_name: "customer_db",
    table_name: "customers",
    column_name: "email_address",
    rule_name: "Valid Email Schema Format",
    rule_type: "Validity",
    description: "Verifies that values match a valid email address pattern.",
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
    threshold: "100%",
    status: "Warning",
    failure_count: 3,
    source: "auto_suggested",
  },
];

export const DEMO_TRUST_SCORES: TrustScore[] = [
  {
    id: "ts-001",
    database_name: "customer_db",
    table_name: "customers",
    overall_score: 87,
    breakdown: { completeness: 100, accuracy: 85, freshness: 80, schema_consistency: 82 },
    status: "Warning",
    steward_assigned: "Alex Rivera",
    last_profiled: ts(30),
  },
  {
    id: "ts-002",
    database_name: "finance_db",
    table_name: "payments",
    overall_score: 94,
    breakdown: { completeness: 100, accuracy: 95, freshness: 90, schema_consistency: 90 },
    status: "Healthy",
    steward_assigned: "Sarah Jenkins",
    last_profiled: ts(60),
  },
  {
    id: "ts-003",
    database_name: "hr_db",
    table_name: "employees",
    overall_score: 72,
    breakdown: { completeness: 80, accuracy: 70, freshness: 65, schema_consistency: 73 },
    status: "Warning",
    steward_assigned: "Michael Chang",
    last_profiled: ts(45),
  },
];

export const DEMO_LINEAGE: LineageGraph = {
  nodes: [
    { id: "db:customer_db", label: "customer_db", type: "database", details: "Customer database" },
    { id: "tbl:customer_db:customers", label: "customers", type: "table", database_name: "customer_db", details: "Customer profiles" },
    { id: "col:customer_db:customers:email_address", label: "email_address", type: "column", classification: "Confidential", sensitivity: "Medium", details: "Primary email contact" },
    { id: "col:customer_db:customers:customer_id", label: "customer_id", type: "column", classification: "Restricted", sensitivity: "High" },
    { id: "col:customer_db:customers:date_of_birth", label: "date_of_birth", type: "column", classification: "Confidential", sensitivity: "High" },
    { id: "db:finance_db", label: "finance_db", type: "database" },
    { id: "tbl:finance_db:payments", label: "payments", type: "table", database_name: "finance_db" },
    { id: "col:finance_db:payments:payment_token", label: "payment_token", type: "column", classification: "Restricted", sensitivity: "High" },
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
  ],
};

export const DEMO_AUDIT: AuditEntry[] = [
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
    entity_id: "demo-002",
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
    entity_id: "demo-004",
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

export const DEMO_COLLABRA_CSV = `Asset Type,Asset Name,Definition,Classification,Sensitivity,Business Glossary Term,Logical Attribute,Approval Status,Steward
Column,customer_db.customers.customer_id,"The customer_id is the unique primary key assigned to each customer record.",Restricted,High,Customer Identifier,customer_id,approved,Alex Rivera
Column,finance_db.payments.payment_token,"Tokenized surrogate for a payment instrument.",Restricted,High,Payment Token,payment_reference_token,approved,Sarah Jenkins
`;

/** Mutable in-memory store for offline approve/analyze interactions */
let offlineDefinitions = [...DEMO_DEFINITIONS];
let offlineAudit = [...DEMO_AUDIT];

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
      provider: "demo",
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
  offlineDefinitions = [...DEMO_DEFINITIONS];
  offlineAudit = [...DEMO_AUDIT];
  offlineKbSections = DEMO_KB_SECTIONS.map((s) => ({ ...s }));
}

let offlineKbSections = DEMO_KB_SECTIONS.map((s) => ({ ...s }));

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

export const DEMO_CREDENTIALS = {
  email: "demo@govern.ai",
  password: "demo",
};

export const DEMO_USER = {
  email: "demo@govern.ai",
  name: "Alex Rivera",
  role: "Data Steward",
  avatar: "AR",
};
