import type { FieldDefinition } from "../types";

const ts = (minsAgo: number) =>
  new Date(Date.now() - minsAgo * 60_000).toISOString();

const hipaaPrivacy = {
  section: "HIPAA Privacy Rule PHI And Identifiers",
  excerpt:
    "PHI identifiers include medical record numbers (MRN), dates related to an individual, and other unique identifying numbers. Default classification: restricted / PHI.",
  relevance_score: 0.42,
};

const healthData = {
  section: "Health Data",
  excerpt:
    "Columns such as diagnosis, lab_result, and patient_id may contain PHI. Apply audit logging, minimum necessary access, and strict retention controls.",
  relevance_score: 0.38,
};

const hipaaSecurity = {
  section: "HIPAA Security Rule Safeguards",
  excerpt:
    "Tag systems and columns storing ePHI; require encryption at rest and in transit and audit controls for access.",
  relevance_score: 0.31,
};

const part2 = {
  section: "42 CFR Part 2 Substance Use Disorder Records",
  excerpt:
    "Part 2 protects SUD patient records with consent requirements stricter than HIPAA for many disclosures.",
  relevance_score: 0.55,
};

const codeSets = {
  section: "Clinical And Claims Code Sets ICD LOINC SNOMED CPT",
  excerpt:
    "ICD-10-CM, LOINC, HCPCS, and NDC must be governed with code system version and clinical coding stewards.",
  relevance_score: 0.36,
};

const cmsClaims = {
  section: "CMS Medicare Medicaid And Claims Data",
  excerpt:
    "Classify claims and eligibility fields as restricted PHI/financial health; map to billing code stewards.",
  relevance_score: 0.33,
};

const aliases = {
  section: "Healthcare Column Aliases Extended",
  excerpt:
    "Map mrn, icd10_dx, loinc_cd, ndc_cd, member_id to standard glossary concepts before classification.",
  relevance_score: 0.29,
};

export const HEALTHCARE_SAMPLE_DEFINITIONS: FieldDefinition[] = [
  {
    id: "hc-001",
    database_name: "clinical_ehr",
    table_name: "patients",
    column_name: "mrn",
    table_description: "Contains patient demographic and identity attributes for the EHR.",
    glossary_term: "Medical Record Number",
    glossary_term_description:
      "Organization-specific identifier assigned to a patient's medical record.",
    logical_data_attribute_name: "medical_record_number",
    logical_data_attribute_description: "Primary clinical identifier for a patient record.",
    definition:
      "mrn stores the primary medical record number used to index patient charts, orders, and results across clinical systems.",
    likely_purpose: "Clinical identification and record linking — minimum necessary access only.",
    data_classification: "Restricted",
    sensitivity: "High",
    governance_actions: [
      "Assign clinical data steward and business owner.",
      "Document permitted HIPAA purposes (treatment, payment, operations).",
      "Apply minimum necessary access and audit logging for PHI.",
      "Mask in non-production environments.",
    ],
    retrieved_context: [hipaaPrivacy.section, healthData.section, aliases.section],
    policy_citations: [hipaaPrivacy, healthData, aliases],
    decision_rationale:
      'Assigned Restricted with High sensitivity primarily from policy section "HIPAA Privacy Rule PHI And Identifiers" (plus 2 supporting sections). Regulatory tags: HIPAA-PHI.',
    regulatory_tags: ["HIPAA-PHI"],
    sample_values_masked: true,
    masking_reasons: ["identifier_field"],
    source: "retrieval_heuristic",
    llm_error: "",
    approval_status: "pending_review",
    steward_comment: "",
    approved_by: "",
    approved_at: "",
    created_at: ts(30),
    updated_at: ts(30),
    retrieval_mode: "tfidf",
  },
  {
    id: "hc-002",
    database_name: "clinical_ehr",
    table_name: "encounters",
    column_name: "icd10_dx_code",
    table_description: "Encounter-level clinical and billing attributes.",
    glossary_term: "ICD-10-CM Diagnosis Code",
    glossary_term_description: "Standard diagnosis code used for clinical documentation and claims.",
    logical_data_attribute_name: "icd10_cm_diagnosis_code",
    logical_data_attribute_description: "Coded diagnosis associated with an encounter.",
    definition:
      "icd10_dx_code stores ICD-10-CM diagnosis codes documenting conditions treated during an encounter.",
    likely_purpose: "Clinical documentation, quality reporting, and claims adjudication.",
    data_classification: "Restricted",
    sensitivity: "High",
    governance_actions: [
      "Assign clinical coding steward; document code system version year.",
      "Restrict analytics use to approved populations and de-identified sets where possible.",
    ],
    retrieved_context: [codeSets.section, healthData.section, cmsClaims.section],
    policy_citations: [codeSets, healthData, cmsClaims],
    decision_rationale:
      'Assigned Restricted with High sensitivity primarily from policy section "Clinical And Claims Code Sets ICD LOINC SNOMED CPT". Regulatory tags: HIPAA-PHI, Clinical-Code-Set.',
    regulatory_tags: ["HIPAA-PHI", "Clinical-Code-Set"],
    sample_values_masked: false,
    masking_reasons: [],
    source: "retrieval_heuristic",
    llm_error: "",
    approval_status: "pending_review",
    steward_comment: "",
    approved_by: "",
    approved_at: "",
    created_at: ts(28),
    updated_at: ts(28),
    retrieval_mode: "tfidf",
  },
  {
    id: "hc-003",
    database_name: "behavioral_health",
    table_name: "treatment",
    column_name: "sud_treatment_flag",
    table_description: "Behavioral health treatment episode attributes.",
    glossary_term: "Substance Use Disorder Program Flag",
    glossary_term_description:
      "Indicates whether an episode is subject to 42 CFR Part 2 SUD protections.",
    logical_data_attribute_name: "sud_program_indicator",
    logical_data_attribute_description: "Flags records requiring Part 2 consent and segregation.",
    definition:
      "sud_treatment_flag marks treatment episodes that fall under federal SUD privacy rules beyond standard HIPAA.",
    likely_purpose: "Compliance routing for heightened consent and redisclosure controls.",
    data_classification: "Restricted",
    sensitivity: "High",
    governance_actions: [
      "Do not commingle Part 2 data in general analytics pools without qualified consent.",
      "Document consent scope and expiration in glossary metadata.",
    ],
    retrieved_context: [part2.section, healthData.section, hipaaPrivacy.section],
    policy_citations: [part2, healthData, hipaaPrivacy],
    decision_rationale:
      'Assigned Restricted with High sensitivity primarily from policy section "42 CFR Part 2 Substance Use Disorder Records". Regulatory tags: HIPAA-PHI, 42-CFR-Part-2.',
    regulatory_tags: ["HIPAA-PHI", "42-CFR-Part-2"],
    sample_values_masked: false,
    masking_reasons: [],
    source: "retrieval_heuristic",
    llm_error: "",
    approval_status: "pending_review",
    steward_comment: "",
    approved_by: "",
    approved_at: "",
    created_at: ts(26),
    updated_at: ts(26),
    retrieval_mode: "tfidf",
  },
  {
    id: "hc-004",
    database_name: "claims_payer",
    table_name: "claims",
    column_name: "member_id",
    table_description: "Payer claims and adjudication attributes.",
    glossary_term: "Health Plan Member Identifier",
    glossary_term_description: "Subscriber or beneficiary identifier on a health plan.",
    logical_data_attribute_name: "health_plan_member_id",
    logical_data_attribute_description: "Links claims to covered individuals.",
    definition:
      "member_id identifies the subscriber or beneficiary associated with a claim line for payment operations.",
    likely_purpose: "Claims payment, eligibility, and risk adjustment — PHI in payer context.",
    data_classification: "Restricted",
    sensitivity: "High",
    governance_actions: [
      "Map to CMS claims stewardship; restrict access to revenue cycle roles.",
      "Track lineage to downstream risk and reporting files.",
    ],
    retrieved_context: [cmsClaims.section, hipaaPrivacy.section, healthData.section],
    policy_citations: [cmsClaims, hipaaPrivacy, healthData],
    decision_rationale:
      'Assigned Restricted with High sensitivity primarily from policy section "CMS Medicare Medicaid And Claims Data". Regulatory tags: HIPAA-PHI, CMS-Claims.',
    regulatory_tags: ["HIPAA-PHI", "CMS-Claims"],
    sample_values_masked: true,
    masking_reasons: ["identifier_field"],
    source: "retrieval_heuristic",
    llm_error: "",
    approval_status: "pending_review",
    steward_comment: "",
    approved_by: "",
    approved_at: "",
    created_at: ts(24),
    updated_at: ts(24),
    retrieval_mode: "tfidf",
  },
  {
    id: "hc-005",
    database_name: "clinical_ehr",
    table_name: "lab_results",
    column_name: "loinc_code",
    table_description: "Laboratory result observations.",
    glossary_term: "LOINC Observation Code",
    glossary_term_description: "Standard code for laboratory and clinical observations.",
    logical_data_attribute_name: "loinc_observation_code",
    logical_data_attribute_description: "Identifies the type of lab test or observation.",
    definition:
      "loinc_code stores the LOINC identifier for a laboratory test or clinical observation result.",
    likely_purpose: "Clinical interoperability, result routing, and analytics with coded lab semantics.",
    data_classification: "Restricted",
    sensitivity: "High",
    governance_actions: [
      "Assign laboratory informatics steward; document LOINC version.",
      "Pair with result_value under combined PHI handling.",
    ],
    retrieved_context: [codeSets.section, healthData.section, hipaaSecurity.section],
    policy_citations: [codeSets, healthData, hipaaSecurity],
    decision_rationale:
      'Assigned Restricted with High sensitivity primarily from policy section "Clinical And Claims Code Sets ICD LOINC SNOMED CPT". Regulatory tags: HIPAA-PHI, Clinical-Code-Set.',
    regulatory_tags: ["HIPAA-PHI", "Clinical-Code-Set"],
    sample_values_masked: false,
    masking_reasons: [],
    source: "retrieval_heuristic",
    llm_error: "",
    approval_status: "pending_review",
    steward_comment: "",
    approved_by: "",
    approved_at: "",
    created_at: ts(22),
    updated_at: ts(22),
    retrieval_mode: "tfidf",
  },
];
