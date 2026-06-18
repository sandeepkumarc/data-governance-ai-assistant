const METADATA_REQUIRED_COLUMNS = [
  "database_name",
  "table_name",
  "column_name",
  "data_type",
  "sample_values",
] as const;

const HEALTHCARE_SIGNALS = [
  "clinical_ehr",
  "claims_payer",
  "mrn",
  "medical_record",
  "patient",
  "diagnosis",
  "icd",
  "icd10",
  "loinc",
  "ndc",
  "medication",
  "lab_result",
  "encounter",
  "admission",
  "discharge",
  "vital",
  "phi",
  "hipaa",
  "claim",
  "hcpcs",
  "drg",
  "beneficiary",
  "member_id",
  "subscriber",
  "provider_npi",
  "npi",
  "sud",
  "substance",
  "behavioral_health",
] as const;

export const DEFAULT_DATASET_CONTEXT =
  "Enterprise table export. Draft definitions and classifications for steward review.";

export const HEALTHCARE_DATASET_CONTEXT =
  "Healthcare EHR table export. Classify PHI with cited policies from the knowledge base.";

const HEALTHCARE_SIGNAL_THRESHOLD = 2;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INTEGER_RE = /^-?\d+$/;
const DECIMAL_RE = /^-?\d+(\.\d+)?$/;

export type CsvUploadFormat = "metadata_catalog" | "table_export";

function normalizeHeaders(headers: string[] | null | undefined): string[] {
  return (headers ?? []).map((header) => header.trim()).filter(Boolean);
}

function parseCsvRows(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((cell) => cell.trim());
  const rows = lines.slice(1).map((line) => line.split(",").map((cell) => cell.trim()));
  return { headers, rows };
}

export function detectCsvFormat(text: string): CsvUploadFormat {
  const { headers } = parseCsvRows(text);
  const present = new Set(headers.map((header) => header.toLowerCase()));
  const isCatalog = METADATA_REQUIRED_COLUMNS.every((column) => present.has(column));
  return isCatalog ? "metadata_catalog" : "table_export";
}

export function inferTableScope(
  filename = "",
  overrides?: { database_name?: string; table_name?: string },
): { database_name: string; table_name: string } {
  if (overrides?.database_name?.trim() && overrides?.table_name?.trim()) {
    return {
      database_name: overrides.database_name.trim(),
      table_name: overrides.table_name.trim(),
    };
  }

  const stem = filename.replace(/\.csv$/i, "").toLowerCase().replace(/-/g, "_");
  const parts = stem.split("_").filter(Boolean);
  if (parts.length >= 2) {
    return {
      database_name: parts.slice(0, -1).join("_"),
      table_name: parts[parts.length - 1],
    };
  }
  if (parts.length === 1) {
    return { database_name: "demo_db", table_name: parts[0] };
  }
  return { database_name: "demo_db", table_name: "exported_table" };
}

export function inferDataType(samples: string[]): string {
  if (!samples.length) return "string";
  if (samples.every((sample) => DATE_RE.test(sample))) return "date";
  if (samples.every((sample) => INTEGER_RE.test(sample))) return "integer";
  if (samples.every((sample) => DECIMAL_RE.test(sample))) return "decimal";
  return "string";
}

export function describeCsvSource(text: string, filename = ""): string {
  const format = detectCsvFormat(text);
  if (format === "metadata_catalog") {
    const { rows } = parseCsvRows(text);
    return `Column catalog detected · ${rows.length} field(s)`;
  }

  const { headers, rows } = parseCsvRows(text);
  const scope = inferTableScope(filename);
  return `Table export detected · ${scope.database_name}.${scope.table_name} · ${headers.length} column(s) · ${rows.length} sample row(s)`;
}

export function validateMetadataCsvHeaders(headers: string[] | null | undefined): string | null {
  const present = new Set(normalizeHeaders(headers).map((header) => header.toLowerCase()));
  const missing = METADATA_REQUIRED_COLUMNS.filter((column) => !present.has(column));
  if (!missing.length) return null;
  return `CSV file is missing required columns: ${missing.join(", ")}`;
}

export function countHealthcareSignals(text: string): number {
  const haystack = text.toLowerCase();
  return HEALTHCARE_SIGNALS.reduce(
    (count, signal) => (haystack.includes(signal) ? count + 1 : count),
    0,
  );
}

export function isHealthcareMetadata(text: string): boolean {
  return countHealthcareSignals(text) >= HEALTHCARE_SIGNAL_THRESHOLD;
}

export function inferDatasetContext(text: string): string {
  return isHealthcareMetadata(text) ? HEALTHCARE_DATASET_CONTEXT : DEFAULT_DATASET_CONTEXT;
}
