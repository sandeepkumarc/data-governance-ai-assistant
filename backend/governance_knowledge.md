# Data Governance Field Classification Knowledge Base

## Direct Identifiers

Columns such as email, phone, mobile, ssn, social_security_number, national_id, tax_id, passport, driver_license, account_number, customer_id, cust_id, custid, employee_id, emp_id, user_id, uid, ip_address, device_id, and cookie_id can identify a person or account.

Governance guidance:
- Classify as sensitive or confidential.
- Define an accountable data owner.
- Restrict access by business need.
- Mask, tokenize, or hash values in non-production environments.
- Track lineage and downstream usage.
- Apply retention rules based on legal and business requirements.

## Business Glossary Definition Guidance

A business glossary definition should describe the business meaning of a field, not just its technical storage purpose.

Good glossary definitions:
- Use business-friendly language.
- Avoid table-specific implementation details when possible.
- Explain what the concept means across the organization.
- Include the business context, approved use, and sensitivity when relevant.

Examples:
- Customer Email Address: The electronic mail address used to contact, identify, or communicate with a customer.
- Customer Identifier: A unique value assigned to distinguish a customer across systems and business processes.
- Payment Token: A surrogate value used to reference a payment instrument without storing the raw payment card or bank account number.

## Column Aliases And Abbreviations

Enterprise metadata often uses shortened or legacy column names. Treat these abbreviations the same as their standard glossary terms for classification, sensitivity, masking, and stewardship.

Customer and person identifiers:
- cust_id, custid, cust_nbr, customer_id, client_id, acct_id, account_id → Customer Identifier
- user_id, uid, usr_id, member_id, mbr_id, subscriber_id → User or Member Identifier
- emp_id, employee_id, ee_id, worker_id → Employee Identifier
- patient_id, pt_id, mrn, medical_record_number → Patient Identifier

Contact and demographic fields:
- email, email_addr, e_mail, mail_id → Email Address (contact / PII)
- phone, phone_nbr, tel, mobile, cell, msisdn → Phone Number (contact / PII)
- addr, address_line, street_addr, mailing_addr → Mailing Address (contact / PII)
- dob, birth_dt, birth_date, date_of_birth, bdate → Date of Birth (personal demographic / PII)
- fname, first_name, given_name, lname, last_name, surname → Person Name (PII)
- zip, zipcode, postal_code, postcode → Postal Code (contact / location)

Financial and payment fields:
- pmt_token, pay_token, payment_token, card_token → Payment Token (restricted financial surrogate)
- cc_num, card_nbr, pan, card_number → Payment Card Number (highly restricted; tokenize or prohibit storage)
- acct_bal, balance, bal_amt, account_balance → Account Balance (financial)
- salary, comp, compensation, annual_salary, base_pay → Employee Compensation (restricted HR/financial)
- rev, revenue, amt, amount, txn_amt, transaction_amount → Monetary Amount (financial)

Authentication and security fields:
- pwd, passwd, password, password_hash → Password or Credential Secret (restricted; never log or expose)
- api_key, apikey, secret, client_secret, auth_token, access_token → API or Auth Secret (restricted)
- sess_id, session_id, sid → Session Identifier (security-sensitive)

Health and regulated data:
- diag, diagnosis, dx_code, icd_code → Diagnosis (restricted health data)
- rx, prescription, medication, med_name → Medication (restricted health data)
- policy_id, member_nbr, subscriber_nbr → Insurance or Member Identifier (restricted health data)

Workflow and reference fields:
- stat, status, state, stage, wf_status → Workflow Status (classify by entity being described)
- sku, prod_id, product_id, item_id → Product Identifier (internal reference data)
- ccy, currency, currency_code → Currency Code (reference data)
- ts, created_at, crt_dt, upd_ts, modified_at → Timestamp (operational metadata; classify by related entity)

Governance guidance for abbreviated columns:
- Map the abbreviation to the standard glossary term before assigning classification.
- Apply the same sensitivity, masking, retention, and access controls as the full standard name.
- Document the alias in the business glossary and note the authoritative source system.
- When vector or semantic retrieval is used, prefer glossary meaning over literal token overlap with column names.

Policy update:
- Add txn_id as alias for transaction identifier.

## Contact Information

Columns such as email_address, email_addr, phone_number, phone, tel, mailing_address, shipping_address, city, state, country, postal_code, zip, zipcode, and zip_code describe how to contact or locate a person.

Governance guidance:
- Classify as personal data.
- Limit usage to approved communication, fulfillment, support, or compliance purposes.
- Validate consent and preference management where applicable, especially for marketing communications.
- Track explicit consent status for all fields used for marketing purposes.
- Mask in analytics unless exact values are required.
- Ensure consent records are auditable and linked to the data subject's preferences.

## Financial Data

Columns such as credit_card, card_number, bank_account, routing_number, iban, swift_code, payment_token, salary, income, revenue, balance, invoice_amount, and transaction_amount relate to money, compensation, or payment.

Governance guidance:
- Classify as restricted or highly confidential when values identify a person, account, or payment instrument.
- Do not store raw payment card numbers unless explicitly approved and compliant.
- Encrypt at rest and in transit.
- Monitor access and use stronger approval workflows.

## Health Data

Columns such as diagnosis, medication, lab_result, claim_code, member_id, patient_id, provider_id, treatment, insurance_policy, mrn, encounter_id, admission_date, discharge_date, vital_sign, lab_value, procedure_code, and prior_authorization may contain protected health information (PHI) or equivalent regulated health data.

Governance guidance:
- Classify as restricted health data (PHI / special category health data where applicable).
- Map each field to applicable regulatory sections in this knowledge base (HIPAA, Part 2, GDPR Article 9, CMS, FDA, etc.).
- Limit use to approved treatment, payment, operations, research (with IRB/consent), or compliance workflows.
- Apply audit logging, minimum necessary access, role-based controls, and strict retention controls.
- Document lawful basis, consent, and de-identification method when used outside clinical care.
- Never use production PHI in analytics sandboxes without masking, synthetic data, or formal de-identification.

## Authentication And Security Data

Columns such as password, password_hash, salt, token, api_key, secret, session_id, mfa_secret, reset_token, and auth_code are security-sensitive.

Governance guidance:
- Classify as restricted security data.
- Never expose in logs, analytics exports, or broad-access datasets.
- Store only hashed, encrypted, or tokenized forms as appropriate.
- Rotate secrets and enforce short retention for temporary tokens.

## Operational Status And Workflow Data

Columns such as status, state, stage, priority, queue, assigned_to, created_at, updated_at, closed_at, effective_date, expiration_date, and deleted_flag describe workflow state or operational lifecycle.

Governance guidance:
- Classify based on the entity the workflow describes.
- Define authoritative source and data quality rules.
- Use consistent enumerations and timestamp standards.
- Retain according to business process and audit requirements.

## Product And Reference Data

Columns such as product_id, sku, category, brand, currency, country_code, region, department, cost_center, and lookup_code often describe products, organizational structure, or reference values.

Governance guidance:
- Classify as internal or public depending on business sensitivity.
- Define stewardship, allowed values, and reference-data ownership.
- Track lineage when reused across reports or integrations.

## Free Text And Notes

Columns such as notes, comments, description, message, subject, feedback, reason, and details may contain unpredictable personal, confidential, or regulated information.

Governance guidance:
- Treat as potentially sensitive.
- Apply scanning, redaction, and stricter access where possible.
- Avoid using free text for governed attributes when structured fields exist.

## Derived Analytics Fields

Columns such as score, risk_score, segment, propensity, prediction, model_output, churn_probability, and lifetime_value are derived analytics attributes.

Governance guidance:
- Track model or rule lineage.
- Document intended use and limitations.
- Check for fairness, explainability, and regulatory constraints when used for decisions about people.
- Classify based on source data and business impact.
- In healthcare, derived clinical or utilization scores may still be PHI if they can identify a patient or reveal health status — classify accordingly.

---

## Healthcare Regulatory Landscape Overview

This section summarizes common healthcare and life-sciences regulations for **metadata governance** (classification, glossary, lineage, access, retention). It is operational guidance, not legal advice — confirm obligations with privacy, compliance, and counsel for your jurisdiction and entity type (covered entity, business associate, sponsor, payer, provider, etc.).

Regulatory families to tag in the catalog:
- **US HIPAA / HITECH** — PHI privacy, security, breach notification; business associates.
- **42 CFR Part 2** — substance use disorder (SUD) records stricter than HIPAA alone.
- **CMS / Medicare-Medicaid** — claims, eligibility, quality reporting, interoperability (USCDI, TEFCA).
- **FDA 21 CFR Part 11** — electronic records and signatures in regulated clinical/manufacturing systems.
- **EU/UK GDPR** — Article 9 special category (health); national implementations.
- **Research** — Common Rule (US), IRB protocols, consent artifacts, de-identification standards.
- **Payment** — PCI DSS where card data exists alongside healthcare workflows.
- **Cyber frameworks** — NIST CSF, HITRUST (certification mapping, not a statute).

Governance actions for every regulated health column:
- Assign business owner and data steward; link to definition approval workflow.
- Record regulation tags (e.g., HIPAA-PHI, Part-2, GDPR-Art9) in glossary or custom attributes.
- Define permitted purposes, retention, masking rules, and downstream systems in lineage.
- Require steward approval before export to warehouse, lakehouse, or vendor environments.

## HIPAA Privacy Rule PHI And Identifiers

The HIPAA Privacy Rule protects **individually identifiable health information (PHI)** held or transmitted by covered entities and business associates.

PHI identifiers (18 HIPAA identifiers — treat columns matching these as PHI when combined with health context):
- Names, geographic subdivisions smaller than state, dates (except year) related to an individual, phone/fax/email, SSN, medical record numbers (MRN), health plan beneficiary numbers, account numbers, certificate/license numbers, vehicle identifiers, device identifiers, URLs, IP addresses, biometric identifiers, full-face photos, any other unique identifying number or code.

Column patterns: patient_id, mrn, member_id, subscriber_id, encounter_id, visit_id, claim_id, policy_id, beneficiary_id, hicn, medicare_id, medicaid_id, npi (when linked to patient context).

Governance guidance:
- Default classification: **restricted / PHI**.
- Document **permitted uses**: treatment, payment, healthcare operations (TPO), or other lawful basis with authorization where required.
- Apply **minimum necessary** — scope roles, views, and exports to job function.
- Maintain **Notice of Privacy Practices** linkage for patient-facing data uses.
- Prohibit marketing or sale of PHI without explicit rules and authorizations.
- For **de-identified** datasets, document method: Safe Harbor (remove 18 identifiers) or Expert Determination; record certification date and steward sign-off.

## HIPAA Security Rule Safeguards

The HIPAA Security Rule requires administrative, physical, and technical safeguards for **electronic PHI (ePHI)**.

Metadata governance implications:
- Tag systems and columns storing ePHI with `ePHI=true` and security control tier.
- Require encryption at rest and in transit for ePHI fields in catalogs and integration maps.
- Document access control model: unique user IDs, emergency access, automatic logoff, encryption.
- Audit controls: who read/changed PHI columns — map to audit log retention requirements.
- Integrity controls: lineage and version history for clinical and billing master data.
- Transmission security: document interfaces (HL7 FHIR, EDI X12, APIs) in lineage with security protocol.

Governance guidance:
- Classify authentication secrets, API keys, and session tokens on clinical apps as **restricted security data**.
- Risk assessments (periodic) should reference high-risk columns (diagnosis, genetic, behavioral health, SUD).
- BAA-required vendors must appear in lineage as business associates with data categories shared.

## HIPAA Breach Notification And Incident Data

Breach notification applies when unsecured PHI is acquired, accessed, used, or disclosed without authorization.

Governance guidance:
- Maintain inventory of PHI columns and systems for rapid impact assessment.
- Tag incident-related fields (breach_case_id, affected_individual_count) as **compliance confidential**.
- Retain breach investigation artifacts per legal retention schedules; restrict to privacy/legal roles.
- Document whether data at issue was encrypted (safe harbor considerations) in metadata notes.

## HITECH Act And Enforcement

HITECH strengthened HIPAA enforcement, breach notification, and promoted EHR adoption.

Governance guidance:
- Track **accounting of disclosures** requirements for certain PHI uses.
- Ensure audit trails for EHR and downstream copies include user, timestamp, and patient context fields.
- Business associates face direct liability — record BA status on connected systems in glossary or lineage notes.

## Business Associate Agreements And Third Party Data

Business associates (BAs) create, receive, maintain, or transmit PHI on behalf of covered entities.

Column/system patterns: vendor_id, interface_id, clearinghouse_id, cloud_tenant_id, fhir_endpoint.

Governance guidance:
- Lineage must show PHI flow to BA systems; tag with `BAA-required=true`.
- Prohibit secondary use in vendor contracts unless documented in metadata permitted-purpose field.
- Subcontractor chains require downstream BA documentation.
- International transfers need separate transfer mechanism tags (SCCs, adequacy) under GDPR/UK GDPR where applicable.

## 42 CFR Part 2 Substance Use Disorder Records

Part 2 protects **substance use disorder (SUD)** patient records with consent requirements stricter than HIPAA for many disclosures.

Column patterns: sud_program_id, substance_abuse_diagnosis, methadone, otp_clinic_id, part2_consent_id, 42cfr_consent_date.

Governance guidance:
- Classify as **highly restricted Part 2** — separate from general PHI where regulations apply.
- Document explicit patient consent scope, expiration, and redisclosure prohibitions in glossary.
- Do not commingle Part 2 data in general analytics pools without qualified consent and legal review.
- Redisclosure notices must be tracked when Part 2 data is shared.

## CMS Medicare Medicaid And Claims Data

Centers for Medicare & Medicaid Services (CMS) govern Medicare/Medicaid eligibility, claims, quality programs, and value-based care.

Column patterns: hcpcs, drg, revenue_code, ndc, place_of_service, pos_code, beneficiary_id, mbi, medicare_advantage_plan_id, risk_adjustment_factor, hedis_measure.

Governance guidance:
- Classify claims and eligibility fields as **restricted PHI/financial health**.
- Map to billing code stewards (ICD, CPT, HCPCS) with authoritative code system version dates.
- Quality reporting fields (HEDIS, Stars) require documented calculation lineage and program year.
- Fraud, waste, and abuse analytics need access segregation and audit trails.

## Clinical And Claims Code Sets ICD LOINC SNOMED CPT

Standard vocabularies must be governed for semantic consistency.

| Family | Examples | Stewardship |
|--------|----------|---------------|
| ICD-10-CM/PCS | diagnosis, procedure codes | Clinical coding team; annual updates |
| CPT / HCPCS | procedure, supply codes | Revenue cycle steward |
| LOINC | lab observation codes | Laboratory informatics |
| SNOMED CT | clinical terms, problem lists | Clinical terminology steward |
| RxNorm / NDC | medications | Pharmacy informatics |
| CVX | vaccines | Immunization registry steward |

Governance guidance:
- Glossary definitions must state code system, version, and map-to-standard concept ID where used.
- Prohibit free-text diagnosis when coded fields exist; map aliases (dx, icd10) to governed concepts.
- Track lineage from source EHR code to warehouse normalized concept.

## FDA 21 CFR Part 11 Electronic Records

Applies to electronic records and electronic signatures in FDA-regulated activities (e.g., clinical trials, manufacturing QMS) where Part 11 is applicable.

Column patterns: esig_user, esig_timestamp, audit_trail_hash, batch_record_id, protocol_deviation_id, case_report_form_id.

Governance guidance:
- Classify as **GxP regulated** with immutable audit expectations.
- Metadata must support ALCOA+ principles: attributable, legible, contemporaneous, original, accurate.
- Version control on definition changes; steward approval with electronic signature policy linkage.
- System validation status documented in glossary for each regulated dataset.

## GDPR And UK GDPR Health Special Category Data

Under GDPR Article 9, **health data** is a special category requiring a lawful basis and often explicit consent or specific Article 9(2) condition.

Column patterns: nhs_number, chi_number (Scotland), health_insurance_number (EU), clinical_study_id (EU site).

Governance guidance:
- Tag `GDPR-Art9-health` on EU/UK patient health columns.
- Document lawful basis, DPIA reference, and retention in glossary.
- Data subject rights (access, erasure, restriction) require locatable fields across lineage.
- Pseudonymization vs anonymization must be documented; re-identification risk assessed.
- UK: align with UK GDPR, NHS DSPT, and Caldicott principles for health and social care.

## HIPAA Research De identification Safe Harbor Expert

Research uses PHI under IRB/Privacy Board approvals or de-identified datasets.

Column patterns: study_id, irb_protocol_id, subject_id (coded), randomization_arm, consent_version, recontact_flag.

Governance guidance:
- **Identified research PHI**: restricted; link to protocol ID and consent scope in metadata.
- **De-identified**: document Safe Harbor checklist completion or Expert Determination report reference.
- **Limited data sets**: retain dates and geographic info only per DUA; tag `LDS=true`.
- Prohibit re-identification attempts in analytics policies; classify linkage keys as highly restricted.

## Minimum Necessary And Role Based Access Healthcare

HIPAA minimum necessary standard limits PHI used/disclosed to the minimum needed.

Governance guidance:
- Define role-to-column matrices (nurse, biller, researcher, data scientist) in stewardship notes.
- Mask direct identifiers in operational reporting; use surrogate keys with separate break-glass process.
- Column-level security tags drive warehouse masking and BI row-level filters.
- Periodic access reviews documented against PHI inventory.

## Healthcare Data Retention And Legal Hold

Retention varies by record type (medical record, billing, research, pediatric rules by state).

Governance guidance:
- Assign retention_policy and legal_hold_flag attributes per table/column category.
- Pediatric records often extended retention — tag `pediatric_record=true` where birth_date implies minor.
- Destruction workflows require steward and legal approval — log in audit trail.
- Backup and archive tiers documented in lineage (cold storage, tape, cloud lifecycle).

## Interoperability USCDI TEFCA And Patient Access

US interoperability rules promote standardized clinical data classes and trusted exchange.

Column patterns: fhir_resource_id, uscdi_element, tefca_qhin_route, patient_access_app_id, ccda_document_id.

Governance guidance:
- Map columns to **USCDI** data classes for exchange eligibility documentation.
- Patient access APIs expose designated record set fields — tag patient-facing sensitivity.
- TEFCA/QHIN participation requires logging of exchanged data categories in lineage.
- Consent and opt-out preferences (where applicable) must be linkable metadata fields.

## HITRUST NIST And Healthcare Cybersecurity

HITRUST CSF maps healthcare security controls; NIST CSF/800-53 are common baselines.

Governance guidance:
- Tag systems with control framework coverage (encryption, DLP, SIEM) in platform metadata.
- Vulnerability and patch status is operational — not column-level, but ePHI systems require higher rigor.
- Security risk tier drives classification defaults for new health columns.

## State Privacy Laws Healthcare CMIA And Others

US states add requirements (e.g., California CMIA, Washington My Health My Data Act, Texas medical privacy).

Governance guidance:
- Tag datasets with `state_regime` when processing state residents' health information.
- Stricter state rules override generic classification — document in glossary per jurisdiction.
- Consumer health data laws may apply to non-HIPAA entities — assess entity role in metadata.

## PCI DSS In Healthcare Payment Card Data

Healthcare organizations may process copays or retail pharmacy payments — PCI applies to cardholder data.

Column patterns: pan, cardholder_name, track_data, cvv (must not store post-auth), merchant_id.

Governance guidance:
- **Never** store prohibited card data elements; tokenize via approved payment gateway.
- Separate PCI scope from PHI scope in lineage diagrams.
- Classify payment card fields as **PCI restricted**, distinct from PHI but often co-located — segregate tables.

## AI ML Clinical Analytics And SaMD Governance

Machine learning on health data triggers HIPAA, GDPR, FDA (Software as a Medical Device), and fairness obligations.

Column patterns: model_score, sepsis_risk, readmission_probability, llm_summary, embedding_vector (clinical notes).

Governance guidance:
- Document training data sources and whether PHI was used; link model version to catalog.
- Human-in-the-loop for clinical decision support where policy requires.
- FDA SaMD / GMLP: tag regulated algorithm outputs with intended use and validation study reference.
- Bias and performance monitoring metrics stored with restricted access.
- Synthetic data generation must be labeled `synthetic=true` — not production PHI.

## International Health Regulations Brief Reference

| Region | Framework | Governance note |
|--------|-----------|-----------------|
| EU | GDPR Art 9, MDR for devices | Special category tagging, DPIA |
| UK | UK GDPR, NHS DSPT | Caldicott guardian roles |
| Canada | PIPEDA, provincial health acts | Province-specific retention |
| Australia | Privacy Act, My Health Records | Consumer health identifiers |
| Brazil | LGPD sensitive health | Similar to Art 9 controls |
| India | DPDP Act sensitive personal data | Health as sensitive category |

Tag `jurisdiction` on databases or domains; stewards maintain crosswalk to corporate policy.

## Healthcare Column Aliases Extended

Additional abbreviations common in EHR, claims, and payer files:

Clinical: bp_sys, bp_dia, hr, pulse, spo2, temp, weight_kg, height_cm, bmi, chief_complaint, hpi, ros, pe, appt_id, enc_nbr, admit_dt, disch_dt, los, ward, bed, attending_npi, ordering_provider_npi.

Laboratory: loinc_cd, result_val, ref_range, spec_type, coll_dt, lab_accn.

Pharmacy: ndc_cd, rxnorm_cui, dose_amt, freq, route, days_supply, prescriber_dea.

Claims: cpt_cd, icd10_dx, icd10_px, mod_cd, billed_amt, allowed_amt, paid_amt, adj_cd, cob_flag.

Insurance: group_nbr, plan_cd, payer_id, auth_nbr, elig_sts, cobra_flag.

Behavioral health / SUD: bh_diag, mental_health_flag, sud_flag, otp_id — apply Part 2 and heightened controls.

Public health: immunization_id, vaccine_lot, reportable_condition_cd — may have public health reporting obligations separate from routine HIPAA TPO.

Governance guidance:
- Map aliases to standard glossary concepts before classification.
- Flag SUD and behavioral health columns for Part 2 and heightened sensitivity review.
- Genetic and genomic fields (hgvs, gene_variant, pgx_score) — often **highly restricted**; many jurisdictions treat genetic data specially.

## Customer Identifier Aliases

Customer identifiers:
- cust_nbr, cust_id, customer_id → Customer Identifier
Classify as Confidential with steward review.
