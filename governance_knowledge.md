# Data Governance Field Classification Knowledge Base

## Direct Identifiers

Columns such as email, phone, mobile, ssn, social_security_number, national_id, tax_id, passport, driver_license, account_number, customer_id, employee_id, user_id, ip_address, device_id, and cookie_id can identify a person or account.

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


## Contact Information

Columns such as email_address, phone_number, mailing_address, shipping_address, city, state, country, postal_code, and zip_code describe how to contact or locate a person.

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
