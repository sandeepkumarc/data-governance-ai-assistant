"""HTTP client for the Data Governance FastAPI backend."""

from __future__ import annotations

import os
from typing import Any

import requests


DEFAULT_API_URL = os.getenv("GOVERNANCE_API_URL", "http://localhost:8000")


class GovernanceApiError(Exception):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class GovernanceApiClient:
    def __init__(
        self,
        base_url: str = DEFAULT_API_URL,
        timeout: int = 120,
        api_key: str = "",
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.api_key = api_key or os.getenv("GOVERNANCE_API_KEY", "")

    def _headers(self) -> dict[str, str]:
        if not self.api_key:
            return {}
        return {"X-API-Key": self.api_key}

    def _url(self, path: str) -> str:
        return f"{self.base_url}{path}"

    def _handle_response(self, response: requests.Response) -> Any:
        try:
            payload = response.json()
        except ValueError as exc:
            raise GovernanceApiError(
                f"Backend returned non-JSON response (HTTP {response.status_code}).",
                status_code=response.status_code,
            ) from exc

        if response.ok:
            return payload

        detail = payload.get("detail", response.text) if isinstance(payload, dict) else response.text
        raise GovernanceApiError(str(detail), status_code=response.status_code)

    def health(self) -> dict[str, Any]:
        response = requests.get(self._url("/api/health"), headers=self._headers(), timeout=self.timeout)
        return self._handle_response(response)

    def knowledge_sections(self) -> list[dict[str, Any]]:
        response = requests.get(
            self._url("/api/knowledge-base/sections"),
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def create_knowledge_section(self, title: str, text: str = "") -> dict[str, Any]:
        response = requests.post(
            self._url("/api/knowledge-base/sections"),
            json={"title": title, "text": text},
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def update_knowledge_section(
        self,
        original_title: str,
        *,
        title: str | None = None,
        text: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"original_title": original_title}
        if title is not None:
            payload["title"] = title
        if text is not None:
            payload["text"] = text
        response = requests.put(
            self._url("/api/knowledge-base/sections"),
            json=payload,
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def delete_knowledge_section(self, title: str) -> dict[str, Any]:
        response = requests.delete(
            self._url("/api/knowledge-base/sections"),
            params={"title": title},
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def nl_update_knowledge(
        self,
        instruction: str,
        *,
        target_section: str | None = None,
        no_llm: bool = False,
        dry_run: bool = False,
        model: str = "gemma4:e2b",
        base_url: str = "http://localhost:11434",
    ) -> dict[str, Any]:
        payload = {
            "instruction": instruction,
            "target_section": target_section,
            "provider": "ollama",
            "model": model,
            "base_url": base_url,
            "no_llm": no_llm,
            "dry_run": dry_run,
        }
        response = requests.post(
            self._url("/api/knowledge-base/nl-update"),
            json=payload,
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def analyze_metadata(
        self,
        fields: list[dict[str, Any]],
        *,
        dataset_context: str = "",
        mask_samples: bool = True,
        no_llm: bool = True,
        provider: str = "ollama",
        model: str = "gemma4:e2b",
        base_url: str = "http://localhost:11434",
        persist: bool = True,
        retrieval_mode: str = "tfidf",
        embedding_model: str = "nomic-embed-text",
    ) -> list[dict[str, Any]]:
        payload = {
            "fields": fields,
            "dataset_context": dataset_context,
            "mask_samples": mask_samples,
            "no_llm": no_llm,
            "provider": provider,
            "model": model,
            "base_url": base_url,
            "persist": persist,
            "retrieval_mode": retrieval_mode,
            "embedding_model": embedding_model,
        }
        response = requests.post(
            self._url("/api/analyze-metadata"),
            json=payload,
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def upload_metadata(
        self,
        file_name: str,
        file_bytes: bytes,
        *,
        dataset_context: str = "",
        mask_samples: bool = True,
        no_llm: bool = True,
        provider: str = "ollama",
        model: str = "gemma4:e2b",
        base_url: str = "http://localhost:11434",
        persist: bool = True,
    ) -> list[dict[str, Any]]:
        response = requests.post(
            self._url("/api/upload-metadata"),
            files={"file": (file_name, file_bytes, "text/csv")},
            data={
                "dataset_context": dataset_context,
                "mask_samples": str(mask_samples).lower(),
                "no_llm": str(no_llm).lower(),
                "provider": provider,
                "model": model,
                "base_url": base_url,
                "persist": str(persist).lower(),
            },
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def list_definitions(
        self,
        *,
        database_name: str | None = None,
        table_name: str | None = None,
        approval_status: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {}
        if database_name:
            params["database_name"] = database_name
        if table_name:
            params["table_name"] = table_name
        if approval_status:
            params["approval_status"] = approval_status
        response = requests.get(self._url("/api/definitions"), params=params, headers=self._headers(), timeout=self.timeout)
        return self._handle_response(response)

    def approve_definition(
        self,
        definition_id: str,
        *,
        approval_status: str,
        steward_comment: str = "",
        approved_by: str = "",
    ) -> dict[str, Any]:
        payload = {
            "approval_status": approval_status,
            "steward_comment": steward_comment,
            "approved_by": approved_by,
        }
        response = requests.patch(
            self._url(f"/api/definitions/{definition_id}/approve"),
            json=payload,
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def list_ownership(self) -> list[dict[str, Any]]:
        response = requests.get(self._url("/api/ownership"), headers=self._headers(), timeout=self.timeout)
        return self._handle_response(response)

    def list_audit_log(self, *, action: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        params: dict[str, str | int] = {"limit": limit}
        if action:
            params["action"] = action
        response = requests.get(self._url("/api/audit-log"), params=params, headers=self._headers(), timeout=self.timeout)
        return self._handle_response(response)

    def get_lineage(self, *, database_name: str | None = None) -> dict[str, Any]:
        params: dict[str, str] = {}
        if database_name:
            params["database_name"] = database_name
        response = requests.get(self._url("/api/lineage"), params=params, headers=self._headers(), timeout=self.timeout)
        return self._handle_response(response)

    def list_quality_rules(
        self,
        *,
        database_name: str | None = None,
        table_name: str | None = None,
        status: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {}
        if database_name:
            params["database_name"] = database_name
        if table_name:
            params["table_name"] = table_name
        if status:
            params["status"] = status
        response = requests.get(self._url("/api/quality-rules"), params=params, headers=self._headers(), timeout=self.timeout)
        return self._handle_response(response)

    def update_quality_rule_status(
        self,
        rule_id: str,
        *,
        status: str,
        failure_count: int | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"status": status}
        if failure_count is not None:
            payload["failure_count"] = failure_count
        response = requests.patch(
            self._url(f"/api/quality-rules/{rule_id}/status"),
            json=payload,
            headers=self._headers(),
            timeout=self.timeout,
        )
        return self._handle_response(response)

    def list_trust_scores(
        self,
        *,
        database_name: str | None = None,
        table_name: str | None = None,
    ) -> list[dict[str, Any]]:
        params: dict[str, str] = {}
        if database_name:
            params["database_name"] = database_name
        if table_name:
            params["table_name"] = table_name
        response = requests.get(self._url("/api/trust-scores"), params=params, headers=self._headers(), timeout=self.timeout)
        return self._handle_response(response)

    def export_collibra_csv(
        self,
        *,
        approval_status: str | None = None,
        database_name: str | None = None,
    ) -> str:
        params: dict[str, str] = {"format": "csv"}
        if approval_status:
            params["approval_status"] = approval_status
        if database_name:
            params["database_name"] = database_name
        response = requests.get(
            self._url("/api/export/collibra"),
            params=params,
            headers=self._headers(),
            timeout=self.timeout,
        )
        if response.ok:
            return response.text
        raise GovernanceApiError(response.text, status_code=response.status_code)
