# Knowledge Base Guide — Adding Policy Content for Better Governance Help

Anyone on your team can improve **definitions, classifications, citations, and assistant answers** by adding or editing content in the **governance knowledge base**. All of it stays **on your machine** (or your server) — nothing is fetched from the internet.

---

## What the knowledge base powers

| Feature | How it uses the KB |
|---------|-------------------|
| **Analyze columns** | Retrieves the top matching policy sections per column; builds **policy citations** and classification rationale |
| **Ask assistant** | Answers from catalog + KB excerpts (when backend is connected) |
| **Natural language KB update** | Drafts edits to sections from plain-English instructions |
| **Semantic search** | Optional Ollama embeddings over the same section text |

If a topic is missing from the KB, retrieval cannot cite it — the app may fall back to generic heuristics only.

---

## Where content lives

| Environment | Location |
|-------------|----------|
| **Live backend** | `backend/governance_knowledge.md` |
| **Format** | Markdown with one section per `## Section Title` heading |
| **Offline UI** | In-browser memory only (edits lost on refresh unless you export or switch to live backend) |

The backend reads the file on each analysis run (with in-memory caching). **Saving in the Knowledge Base UI writes back to this file** when the API is connected.

---

## Four ways to add knowledge

### 1. Knowledge Base page (recommended for most people)

1. Sign in to the web UI → sidebar **Knowledge Base**
2. Click **New section** or select an existing section
3. **Title** — short, specific (e.g. `HIPAA Privacy Rule PHI And Identifiers`)
4. **Body** — plain text or bullets (see writing tips below)
5. Click **Save**
6. Re-run **Analyze columns** on a sample CSV to see new **policy citations**

### 2. Natural language update (fast drafts)

On **Knowledge Base** → **Update with natural language**:

- Example: *"Add txn_id as alias for transaction identifier in the aliases section"*
- Example: *"Create a section for state privacy laws requiring tag state_regime on datasets"*
- Use **Preview** first, then **Apply**
- **Quick draft (no LLM)** works without Ollama; turn on local LLM for richer rewrites

### 3. Edit the markdown file directly

```bash
# Default path (repo)
code backend/governance_knowledge.md
```

Add a new block:

```markdown
## Your Section Title

Columns such as foo_bar, baz_id ...

Governance guidance:
- Classify as ...
- Assign steward ...
```

Restart the backend if it was running (or wait — file mtime invalidates cache automatically).

### 4. HTTP API (automation / CI)

```bash
# List sections
curl -s http://127.0.0.1:8000/api/knowledge-base/sections

# Create section
curl -X POST http://127.0.0.1:8000/api/knowledge-base/sections \
  -H "Content-Type: application/json" \
  -d '{"title":"My Policy Section","text":"Governance guidance:\n- ..."}'

# Update section
curl -X PUT http://127.0.0.1:8000/api/knowledge-base/sections \
  -H "Content-Type: application/json" \
  -d '{"original_title":"My Policy Section","title":"My Policy Section","text":"Updated text..."}'
```

---

## Writing tips for more accurate retrieval and citations

### 1. Use searchable language

Include **column names, abbreviations, and business terms** stewards actually see in exports:

```markdown
Column patterns: mrn, medical_record_number, patient_id, member_id, subscriber_id
```

The retriever tokenizes text — literal matches (and close variants) rank higher.

### 2. Follow a consistent section shape

```markdown
## Section Title (specific, not "Misc")

One sentence on what data this covers.

Column patterns: col_a, col_b, table_context ...

Governance guidance:
- Classification: Restricted / Confidential / ...
- Sensitivity: High / Medium / ...
- Access: minimum necessary, role-based ...
- Retention / masking / lineage expectations
- Regulatory tags if applicable (e.g. HIPAA-PHI, GDPR-Art9)
```

### 3. Prefer many focused sections over one huge section

- **Good:** `HIPAA Privacy Rule PHI And Identifiers`, `42 CFR Part 2 Substance Use Disorder Records`
- **Harder to retrieve:** One 10-page "All regulations" section

Aim for **~15–80 lines per section**; split when topics differ.

### 4. Add aliases next to standards

Mirror the style in **Column Aliases And Abbreviations** and **Healthcare Column Aliases Extended**:

```markdown
- cust_nbr, acct_id → Customer Identifier (Confidential)
```

### 5. Tie guidance to decisions the app makes

Spell out what stewards should **classify**, **mask**, and **approve** — that aligns with heuristic rules and LLM prompts.

### 6. Legal review disclaimer

Content in the KB is **operational governance guidance for metadata**, not legal advice. Have privacy/compliance review before production use.

---

## Example: new healthcare policy section

```markdown
## My Hospital Consent Tracking

Columns such as consent_id, consent_version, marketing_opt_in, research_consent_flag.

Governance guidance:
- Classify consent and preference fields as Confidential.
- Document lawful basis and link to consent artifact ID in glossary notes.
- Prohibit use of marketing fields without documented opt-in.
- Retain consent history per hospital policy (minimum 7 years unless legal says otherwise).
```

After saving, analyze a CSV that includes `marketing_opt_in` — citations should reference **My Hospital Consent Tracking** when retrieval scores are high enough.

---

## After you add content

| Step | Why |
|------|-----|
| **Re-run Analyze** on representative CSV | Refreshes citations and definitions |
| **Check citation panel** per column | Confirm the right sections appear |
| **Optional: warm embeddings** | Only if you use **Semantic search** |

```bash
curl -X POST http://127.0.0.1:8000/api/knowledge-base/warm-embeddings
```

| **Use Standard search (TF-IDF)** for fast analysis | Fast, local, no Ollama |

---

## Improving the Ask assistant

The assistant uses the same KB plus **saved catalog** data (definitions, trust scores, lineage). To get better answers:

1. Add KB sections for policies people ask about
2. **Analyze + persist** metadata so the catalog is populated
3. Ask specific questions (*"How should we classify mrn under HIPAA?"*)

Product UI help (Quick draft, Help Desk, etc.) comes from a built-in product guide — separate from this policy KB.

---

## AI-Assisted Data Governance (offline) vs live backend

| Mode | KB edits |
|------|----------|
| **Work offline** | UI edits stay in browser; use live backend to persist to `governance_knowledge.md` |
| **Backend connected** | UI and API writes update the file on disk |

---

## Suggested ownership (enterprise)

| Role | Responsibility |
|------|----------------|
| **Data governance lead** | Section structure, glossary alignment |
| **Privacy / compliance** | Regulatory sections (HIPAA, GDPR, etc.) |
| **Domain stewards** | Department-specific rules and aliases |
| **Engineering** | API automation, backups of `governance_knowledge.md` |

Version-control the markdown file in Git so changes are reviewable like code.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Citations unchanged after edit | Re-run analysis; confirm backend connected and file saved |
| Section not retrieved | Add column aliases and keywords; split or shorten section |
| Semantic search still slow | Use Standard search; warm embeddings once |
| Duplicate section title | Titles must be unique — rename or merge sections |

---

## Related docs

- [QUICKSTART.md](../QUICKSTART.md) — run the stack
- [PROJECT_HANDOFF.md](./PROJECT_HANDOFF.md) — architecture
- [PRESENTATION_SCRIPT.md](./PRESENTATION_SCRIPT.md) — presenter flow
