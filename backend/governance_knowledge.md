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
- Validate consent and preference management where applicable.
- Mask in analytics unless exact values are required.

## Financial Data

Columns such as credit_card, card_number, bank_account, routing_number, iban, swift_code, payment_token, salary, income, revenue, balance, invoice_amount, and transaction_amount relate to money, compensation, or payment.

Governance guidance:
- Classify as restricted or highly confidential when values identify a person, account, or payment instrument.
- Do not store raw payment card numbers unless explicitly approved and compliant.
- Encrypt at rest and in transit.
- Monitor access and use stronger approval workflows.

## Health Data

Columns such as diagnosis, medication, lab_result, claim_code, member_id, patient_id, provider_id, treatment, and insurance_policy may contain protected health information.

Governance guidance:
- Classify as restricted health data.
- Limit use to approved care, claims, operations, or compliance workflows.
- Apply audit logging, minimum necessary access, and strict retention controls.

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
