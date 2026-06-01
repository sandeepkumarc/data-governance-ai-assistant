"""Natural-language knowledge base policy updates via local LLM."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from rag_governance import call_ollama, parse_json_response
from services.audit import record_audit
from services.knowledge import (
    create_section,
    delete_section,
    load_sections,
    update_section,
)

MAX_SECTION_PREVIEW = 1200


def _sections_catalog(sections: list[dict[str, str]]) -> str:
    blocks: list[str] = []
    for section in sections:
        text = section.get("text", "")
        if len(text) > MAX_SECTION_PREVIEW:
            text = text[:MAX_SECTION_PREVIEW] + "\n... [truncated]"
        blocks.append(f"### {section['title']}\n{text}")
    return "\n\n".join(blocks)


def _build_nl_prompt(
    sections: list[dict[str, str]],
    instruction: str,
    target_section: str | None,
) -> str:
    target_hint = (
        f"\nThe user indicated this section should be prioritized: {target_section}\n"
        if target_section
        else ""
    )
    return f"""You are a data governance policy editor. Update the governance knowledge base based on the user's natural language instruction.

Current knowledge base sections:
{_sections_catalog(sections)}
{target_hint}
User instruction:
{instruction.strip()}

Return ONLY valid JSON with this shape:
{{
  "summary": "One sentence describing what you changed",
  "changes": [
    {{
      "action": "create|update|delete",
      "original_title": "required for update/delete — exact existing title",
      "title": "section title",
      "text": "full section body for create/update (plain text, no ## heading)"
    }}
  ]
}}

Rules:
- For "update", include the COMPLETE updated section text, not a diff or partial snippet.
- For "create", provide a clear ##-ready title and full policy body with governance guidance bullets where appropriate.
- For "delete", set text to "" and include original_title.
- Prefer updating an existing section over creating duplicates when the topic already exists.
- Keep enterprise data governance tone: classification, sensitivity, masking, retention, stewardship.
- Include column name examples and aliases when the instruction mentions abbreviations or synonyms.
"""


def _parse_llm_plan(raw: dict[str, object]) -> tuple[str, list[dict[str, Any]]]:
    summary = str(raw.get("summary", "")).strip()
    changes_raw = raw.get("changes")
    if not isinstance(changes_raw, list) or not changes_raw:
        raise ValueError("LLM response did not include any changes")

    changes: list[dict[str, Any]] = []
    for item in changes_raw:
        if not isinstance(item, dict):
            continue
        action = str(item.get("action", "")).strip().lower()
        if action not in {"create", "update", "delete"}:
            continue
        title = str(item.get("title", "")).strip()
        original_title = str(item.get("original_title", title)).strip()
        text = str(item.get("text", "")).strip()
        if action in {"create", "update"} and not title:
            continue
        if action in {"update", "delete"} and not original_title:
            continue
        changes.append(
            {
                "action": action,
                "original_title": original_title,
                "title": title or original_title,
                "text": text,
            }
        )

    if not changes:
        raise ValueError("No valid changes parsed from LLM response")
    if not summary:
        summary = f"Proposed {len(changes)} knowledge base change(s)."
    return summary, changes


def _heuristic_plan(
    sections: list[dict[str, str]],
    instruction: str,
    target_section: str | None,
) -> tuple[str, list[dict[str, Any]]]:
    """Simple offline fallback — append instruction to a target or aliases section."""
    title = target_section or "Column Aliases And Abbreviations"
    match = next((s for s in sections if s["title"].lower() == title.lower()), None)
    if match is None:
        match = next(
            (s for s in sections if "alias" in s["title"].lower() or "abbreviation" in s["title"].lower()),
            sections[0] if sections else None,
        )
    if match is None:
        return (
            "Create a new policy section from the instruction.",
            [{"action": "create", "original_title": "", "title": "Custom Policy", "text": instruction.strip()}],
        )

    addition = instruction.strip()
    if not addition.endswith("."):
        addition += "."
    updated_text = f"{match.get('text', '').rstrip()}\n\nPolicy update:\n- {addition}"
    return (
        f"Appended instruction to '{match['title']}' (heuristic mode — enable LLM for richer edits).",
        [
            {
                "action": "update",
                "original_title": match["title"],
                "title": match["title"],
                "text": updated_text,
            }
        ],
    )


def propose_nl_updates(
    instruction: str,
    *,
    target_section: str | None = None,
    provider: str = "ollama",
    model: str = "gemma4:e2b",
    base_url: str = "http://localhost:11434",
    no_llm: bool = False,
) -> tuple[str, list[dict[str, Any]]]:
    instruction = instruction.strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="Instruction is required")

    sections = load_sections()
    if no_llm:
        return _heuristic_plan(sections, instruction, target_section)

    if provider != "ollama":
        raise HTTPException(status_code=400, detail="Natural language updates currently support provider=ollama")

    prompt = _build_nl_prompt(sections, instruction, target_section)
    try:
        response = call_ollama(prompt, model=model, base_url=base_url)
        plan = parse_json_response(response)
        return _parse_llm_plan(plan)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Failed to generate knowledge update plan: {exc}",
        ) from exc


def apply_change_plan(
    session: Session,
    changes: list[dict[str, Any]],
    *,
    dry_run: bool,
    instruction: str,
    summary: str,
) -> dict[str, Any]:
    existing = {s["title"] for s in load_sections()}
    applied: list[dict[str, Any]] = []

    for change in changes:
        action = change["action"]
        if action == "create":
            if dry_run:
                applied.append(change)
                continue
            if change["title"] in existing:
                update_section(
                    session,
                    original_title=change["title"],
                    text=change.get("text", ""),
                )
                applied.append({**change, "action": "update"})
            else:
                create_section(session, title=change["title"], text=change.get("text", ""))
                existing.add(change["title"])
                applied.append(change)
        elif action == "update":
            if dry_run:
                applied.append(change)
                continue
            update_section(
                session,
                original_title=change["original_title"],
                title=change["title"] if change["title"] != change["original_title"] else None,
                text=change.get("text"),
            )
            if change["title"] != change["original_title"]:
                existing.discard(change["original_title"])
                existing.add(change["title"])
            applied.append(change)
        elif action == "delete":
            if dry_run:
                applied.append(change)
                continue
            delete_section(session, title=change["original_title"])
            existing.discard(change["original_title"])
            applied.append(change)

    if not dry_run:
        record_audit(
            session,
            action="nl_update_knowledge",
            entity_type="knowledge_base",
            details={
                "instruction": instruction,
                "summary": summary,
                "changes": applied,
            },
        )
        session.commit()

    return {
        "summary": summary,
        "dry_run": dry_run,
        "applied": not dry_run,
        "changes": applied,
        "sections": load_sections(),
    }


def apply_natural_language_update(
    session: Session,
    instruction: str,
    *,
    target_section: str | None = None,
    provider: str = "ollama",
    model: str = "gemma4:e2b",
    base_url: str = "http://localhost:11434",
    no_llm: bool = False,
    dry_run: bool = False,
) -> dict[str, Any]:
    summary, changes = propose_nl_updates(
        instruction,
        target_section=target_section,
        provider=provider,
        model=model,
        base_url=base_url,
        no_llm=no_llm,
    )
    return apply_change_plan(
        session,
        changes,
        dry_run=dry_run,
        instruction=instruction,
        summary=summary,
    )
