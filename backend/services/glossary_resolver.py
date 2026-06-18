"""Map physical column names to distinct business glossary concepts."""

from __future__ import annotations

import re
from dataclasses import dataclass

_TOKEN_SPLIT = re.compile(r"[_\-\s]+")


@dataclass(frozen=True)
class BusinessGlossary:
    term: str
    term_description: str
    logical_name: str
    logical_description: str
    definition: str
    likely_purpose: str


@dataclass(frozen=True)
class _AliasRule:
    """Match column name tokens or substrings; first matching rule wins (most specific first)."""

    patterns: tuple[str, ...]
    concept: BusinessGlossary
    require_all: bool = False


def _tokens(column_name: str) -> set[str]:
    return {part for part in _TOKEN_SPLIT.split(column_name.lower()) if part}


def _entity_label(table_name: str) -> str:
    table = table_name.lower().strip()
    mapping = {
        "patients": "Patient",
        "patient": "Patient",
        "customers": "Customer",
        "customer": "Customer",
        "employees": "Employee",
        "employee": "Employee",
        "orders": "Order",
        "order": "Order",
        "claims": "Claim",
        "claim": "Claim",
        "encounters": "Encounter",
        "encounter": "Encounter",
        "members": "Member",
        "member": "Member",
        "users": "User",
        "user": "User",
        "providers": "Provider",
        "provider": "Provider",
        "tickets": "Support Ticket",
        "ticket": "Support Ticket",
        "payments": "Payment",
        "payment": "Payment",
    }
    if table in mapping:
        return mapping[table]
    if table.endswith("s") and table[:-1] in mapping:
        return mapping[table[:-1]]
    return table.replace("_", " ").title()


def _matches(column_name: str, patterns: tuple[str, ...], *, require_all: bool) -> bool:
    lowered = column_name.lower()
    token_set = _tokens(column_name)
    hits = [pattern in lowered or pattern in token_set for pattern in patterns]
    return all(hits) if require_all else any(hits)


def _concept(
    *,
    term: str,
    term_description: str,
    logical_name: str,
    logical_description: str,
    definition: str,
    likely_purpose: str,
) -> BusinessGlossary:
    return BusinessGlossary(
        term=term,
        term_description=term_description,
        logical_name=logical_name,
        logical_description=logical_description,
        definition=definition,
        likely_purpose=likely_purpose,
    )


def _rules() -> list[_AliasRule]:
    return [
        _AliasRule(
            ("primary_diagnosis_icd10", "icd10_dx_code", "icd10_dx", "icd10_cm"),
            _concept(
                term="ICD-10-CM Diagnosis Code",
                term_description="Standard diagnosis code used for clinical documentation and claims.",
                logical_name="icd10_cm_diagnosis_code",
                logical_description="Coded diagnosis associated with a clinical encounter or record.",
                definition="{column} stores an ICD-10-CM diagnosis code documenting a treated or recorded condition.",
                likely_purpose="Clinical documentation, quality reporting, and claims adjudication.",
            ),
        ),
        _AliasRule(
            ("mrn", "medical_record_number", "med_rec_num"),
            _concept(
                term="Medical Record Number",
                term_description="Organization-specific identifier assigned to a patient's medical record.",
                logical_name="medical_record_number",
                logical_description="Primary clinical identifier for a patient record.",
                definition="{column} stores the medical record number used to index patient charts, orders, and results.",
                likely_purpose="Clinical identification and record linking.",
            ),
        ),
        _AliasRule(
            ("patient_id", "pt_id"),
            _concept(
                term="Patient Identifier",
                term_description="Internal surrogate key that uniquely identifies a patient within the organization.",
                logical_name="patient_identifier",
                logical_description="System identifier linking patient records across clinical applications.",
                definition="{column} uniquely identifies a patient record within {database}.{table}.",
                likely_purpose="Record linking across encounters, orders, and results.",
            ),
        ),
        _AliasRule(
            ("patient_email",),
            _concept(
                term="Patient Email Address",
                term_description="Email address used for patient portal communication and notifications.",
                logical_name="patient_email_address",
                logical_description="Contact email tied to a patient identity in a clinical context.",
                definition="{column} stores the email address used to contact a patient through approved channels.",
                likely_purpose="Patient portal login, reminders, and care communication.",
            ),
        ),
        _AliasRule(
            ("customer_id", "cust_id", "custid", "cust_nbr"),
            _concept(
                term="Customer Identifier",
                term_description="Unique value that distinguishes a customer across systems and channels.",
                logical_name="customer_identifier",
                logical_description="Primary business key for a customer profile.",
                definition="{column} uniquely identifies a customer record in {database}.{table}.",
                likely_purpose="Customer profile linking, transactions, and service history.",
            ),
        ),
        _AliasRule(
            ("email_address", "email_addr", "e_mail"),
            _concept(
                term="Customer Email Address",
                term_description="Email address used to contact, authenticate, or notify a customer.",
                logical_name="customer_email_address",
                logical_description="Primary electronic mail contact for a customer account.",
                definition="{column} stores the email address used for customer login, notifications, and contact.",
                likely_purpose="Authentication, notifications, and customer communication.",
            ),
        ),
        _AliasRule(
            ("email", "mail"),
            _concept(
                term="Email Address",
                term_description="Electronic mail address used to reach or identify a person or account.",
                logical_name="email_address",
                logical_description="Contact email associated with a person or account record.",
                definition="{column} stores an email address used for contact or account communication.",
                likely_purpose="Contact, authentication, and notification workflows.",
            ),
        ),
        _AliasRule(
            ("date_of_birth", "birth_date", "birth_dt", "dob", "bdate"),
            _concept(
                term="Date of Birth",
                term_description="Calendar date on which a person was born.",
                logical_name="date_of_birth",
                logical_description="Birth date used for age-based rules, eligibility, and identity verification.",
                definition="{column} records the date of birth associated with a person in {database}.{table}.",
                likely_purpose="Age verification, eligibility checks, and identity validation.",
            ),
        ),
        _AliasRule(
            ("phone_number", "phone_nbr", "mobile", "cell", "tel"),
            _concept(
                term="Phone Number",
                term_description="Telephone number used to contact a person or account holder.",
                logical_name="phone_number",
                logical_description="Voice or SMS contact number for a person or account.",
                definition="{column} stores a telephone number used to reach the associated person or account.",
                likely_purpose="Contact, verification, and notification.",
            ),
        ),
        _AliasRule(
            ("loyalty_status",),
            _concept(
                term="Customer Loyalty Tier",
                term_description="Program tier or status that reflects a customer's loyalty level.",
                logical_name="customer_loyalty_tier",
                logical_description="Marketing loyalty classification for a customer account.",
                definition="{column} indicates the loyalty program tier assigned to a customer.",
                likely_purpose="Marketing benefits, segmentation, and rewards eligibility.",
            ),
        ),
        _AliasRule(
            ("payment_token", "pmt_token", "pay_token", "card_token"),
            _concept(
                term="Payment Token",
                term_description="Surrogate token referencing a payment instrument without storing raw card data.",
                logical_name="payment_token",
                logical_description="Tokenized payment reference used during transaction processing.",
                definition="{column} stores a tokenized payment reference returned by the payment processor.",
                likely_purpose="Secure payment processing and recurring billing.",
            ),
        ),
        _AliasRule(
            ("order_status", "wf_status"),
            _concept(
                term="Order Status",
                term_description="Current lifecycle state of an order in fulfillment or service processing.",
                logical_name="order_status",
                logical_description="Workflow state code describing order progress.",
                definition="{column} describes the current processing state of an order record.",
                likely_purpose="Order tracking, fulfillment routing, and customer service.",
            ),
        ),
        _AliasRule(
            ("salary", "compensation", "annual_salary", "base_pay"),
            _concept(
                term="Employee Compensation Amount",
                term_description="Monetary amount representing employee pay or compensation.",
                logical_name="employee_compensation_amount",
                logical_description="Compensation value associated with an employee record.",
                definition="{column} stores compensation or salary information for an employee.",
                likely_purpose="Payroll processing, HR reporting, and compensation analysis.",
            ),
        ),
        _AliasRule(
            ("customer_comments", "comments", "notes", "feedback"),
            _concept(
                term="Customer Comment Text",
                term_description="Free-form notes or comments captured from customers or support interactions.",
                logical_name="customer_comment_text",
                logical_description="Unstructured text that may contain personal or sensitive details.",
                definition="{column} stores free-form customer comments or case notes.",
                likely_purpose="Support history, service context, and issue resolution.",
            ),
        ),
        _AliasRule(
            ("member_id", "subscriber_id", "subscriber_nbr"),
            _concept(
                term="Health Plan Member Identifier",
                term_description="Identifier for a covered member or subscriber on a health plan.",
                logical_name="health_plan_member_identifier",
                logical_description="Payer-side identifier for a beneficiary or subscriber.",
                definition="{column} identifies a health plan member or subscriber for eligibility and claims.",
                likely_purpose="Coverage verification, claims routing, and eligibility.",
            ),
        ),
        _AliasRule(
            ("hcpcs_code", "cpt_cd", "cpt_code"),
            _concept(
                term="HCPCS Procedure Code",
                term_description="Procedure or service code used on professional or facility claims.",
                logical_name="hcpcs_procedure_code",
                logical_description="Standardized procedure code for billing and reporting.",
                definition="{column} stores an HCPCS or CPT procedure code billed on a claim.",
                likely_purpose="Claims adjudication and utilization reporting.",
            ),
        ),
        _AliasRule(
            ("billed_amount", "allowed_amt", "paid_amt"),
            _concept(
                term="Claim Billed Amount",
                term_description="Monetary amount submitted to a payer for a covered service or claim line.",
                logical_name="claim_billed_amount",
                logical_description="Financial charge associated with a healthcare claim.",
                definition="{column} stores the amount billed to a payer for adjudication.",
                likely_purpose="Claims payment, revenue reporting, and contract analysis.",
            ),
        ),
        _AliasRule(
            ("loinc_code", "loinc_cd"),
            _concept(
                term="LOINC Observation Code",
                term_description="Logical Observation Identifiers Names and Codes value for a lab or clinical observation.",
                logical_name="loinc_observation_code",
                logical_description="Standard code identifying a laboratory or clinical observation.",
                definition="{column} stores a LOINC code identifying a laboratory or clinical observation.",
                likely_purpose="Lab result indexing, interoperability, and clinical reporting.",
            ),
        ),
        _AliasRule(
            ("ndc_code", "ndc_cd"),
            _concept(
                term="NDC Medication Code",
                term_description="National Drug Code identifying a dispensed medication package.",
                logical_name="ndc_medication_code",
                logical_description="Drug product identifier used in pharmacy and claims systems.",
                definition="{column} stores an NDC code for a dispensed or billed medication.",
                likely_purpose="Medication management, safety checks, and pharmacy claims.",
            ),
        ),
        _AliasRule(
            ("sud_treatment_flag", "sud_flag"),
            _concept(
                term="Substance Use Disorder Program Flag",
                term_description="Indicates whether a record is subject to heightened SUD privacy controls.",
                logical_name="sud_program_indicator",
                logical_description="Compliance flag for 42 CFR Part 2 protected records.",
                definition="{column} flags treatment episodes that require heightened SUD privacy controls.",
                likely_purpose="Compliance routing for consent and redisclosure rules.",
            ),
        ),
        _AliasRule(
            ("rendering_npi", "provider_npi", "npi"),
            _concept(
                term="National Provider Identifier",
                term_description="Standard identifier for a healthcare provider used in claims and credentialing.",
                logical_name="national_provider_identifier",
                logical_description="NPI for a rendering, ordering, or attending clinician.",
                definition="{column} stores the National Provider Identifier for a clinician or organization.",
                likely_purpose="Claims routing, credentialing, and provider attribution.",
            ),
        ),
        _AliasRule(
            ("password", "password_hash", "passwd"),
            _concept(
                term="Credential Secret",
                term_description="Secret value used to authenticate a user or service account.",
                logical_name="credential_secret",
                logical_description="Authentication secret that must never be logged or exposed.",
                definition="{column} stores credential material used for authentication.",
                likely_purpose="User or system authentication.",
            ),
        ),
        _AliasRule(
            ("api_key", "apikey", "client_secret", "access_token", "auth_token"),
            _concept(
                term="API Credential Secret",
                term_description="Secret key or token used to authorize API access.",
                logical_name="api_credential_secret",
                logical_description="Programmatic authentication secret for integrations.",
                definition="{column} stores an API or integration secret used for authorized access.",
                likely_purpose="Secure service-to-service authentication.",
            ),
        ),
        _AliasRule(
            ("session_id", "sess_id", "sid"),
            _concept(
                term="Session Identifier",
                term_description="Identifier assigned to an authenticated user session.",
                logical_name="session_identifier",
                logical_description="Security-sensitive session tracking value.",
                definition="{column} stores the identifier for an authenticated application session.",
                likely_purpose="Session management and access control.",
            ),
        ),
        _AliasRule(
            ("ssn", "social_security"),
            _concept(
                term="Social Security Number",
                term_description="Government-issued identifier used for tax and identity verification.",
                logical_name="social_security_number",
                logical_description="Highly restricted national identifier for a person.",
                definition="{column} stores a Social Security Number or equivalent national identifier.",
                likely_purpose="Tax reporting, identity verification, and regulated processing.",
            ),
        ),
        _AliasRule(
            ("status", "state", "stage"),
            _concept(
                term="Workflow Status",
                term_description="Code indicating the current step or state in a business process.",
                logical_name="workflow_status",
                logical_description="Operational state value for a business record.",
                definition="{column} indicates the current workflow status of a record in {database}.{table}.",
                likely_purpose="Process tracking and operational routing.",
            ),
        ),
        _AliasRule(
            ("created_at", "updated_at", "modified_at", "crt_dt", "upd_ts"),
            _concept(
                term="Record Timestamp",
                term_description="Date and time marking when a record was created or last updated.",
                logical_name="record_timestamp",
                logical_description="Audit timestamp for record lifecycle events.",
                definition="{column} records when the related business record was created or last changed.",
                likely_purpose="Audit trails, synchronization, and operational reporting.",
            ),
        ),
    ]


def _table_stems(table_name: str) -> set[str]:
    table = table_name.lower().strip()
    stems = {table}
    if table.endswith("s") and len(table) > 1:
        stems.add(table[:-1])
    stems.add(_entity_label(table_name).lower())
    return stems


def _humanize_words(column_name: str) -> str:
    words = [part for part in _TOKEN_SPLIT.split(column_name) if part]
    rendered: list[str] = []
    for word in words:
        lower = word.lower()
        if lower in {"id", "mrn", "npi", "ndc", "icd10"}:
            rendered.append(lower.upper() if lower != "id" else "Identifier")
        else:
            rendered.append(word.title())
    return " ".join(rendered)


def _business_term(*, table_name: str, column_name: str) -> str:
    """Plain glossary label — never duplicate table entity when column already implies it."""
    readable = _humanize_words(column_name)
    if not readable:
        return _entity_label(table_name) or column_name

    column_tokens = _tokens(column_name)
    if column_tokens & _table_stems(table_name):
        return readable

    entity = _entity_label(table_name)
    return f"{entity} {readable}".strip() if entity else readable


def _fallback_glossary(*, database_name: str, table_name: str, column_name: str) -> BusinessGlossary:
    entity = _entity_label(table_name)
    term = _business_term(table_name=table_name, column_name=column_name)
    logical_name = column_name.lower()
    return _concept(
        term=term,
        term_description=f"Business meaning of {term} on {entity or table_name} records.",
        logical_name=logical_name,
        logical_description=f"Logical data attribute for {term} in {table_name}.",
        definition=(
            f"{column_name} stores {term.lower()} information for records in "
            f"{database_name}.{table_name}."
        ),
        likely_purpose=f"Supports {table_name} processes that use {term.lower()}.",
    )


def _apply_field_context(
    concept: BusinessGlossary,
    *,
    database_name: str,
    table_name: str,
    column_name: str,
) -> BusinessGlossary:
    values = {
        "column": column_name,
        "table": table_name,
        "database": database_name,
        "term": concept.term,
    }
    definition = concept.definition.format(**values)
    return BusinessGlossary(
        term=concept.term,
        term_description=concept.term_description,
        logical_name=concept.logical_name,
        logical_description=concept.logical_description,
        definition=definition,
        likely_purpose=concept.likely_purpose,
    )


def resolve_business_glossary(
    *,
    database_name: str,
    table_name: str,
    column_name: str,
) -> BusinessGlossary:
    """Return a distinct business glossary concept for a physical column."""
    ctx = {
        "database_name": database_name,
        "table_name": table_name,
        "column_name": column_name,
    }
    for rule in _rules():
        if _matches(column_name, rule.patterns, require_all=rule.require_all):
            return _apply_field_context(rule.concept, **ctx)
    return _apply_field_context(_fallback_glossary(**ctx), **ctx)
