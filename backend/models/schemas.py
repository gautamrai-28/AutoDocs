"""
models/schemas.py — Pydantic Request / Response Schemas
Placement: backend/models/schemas.py
"""
from __future__ import annotations
from typing import Any
from pydantic import BaseModel, field_validator


class GenerationOptions(BaseModel):
    readme:  bool = True
    folders: bool = True
    files:   bool = True


class KeyFile(BaseModel):
    name: str
    path: str
    role: str = "core"


class GenerateRequest(BaseModel):
    repo_url: str
    options:  GenerationOptions = GenerationOptions()

    @field_validator("repo_url")
    @classmethod
    def validate_github_url(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped.startswith("https://github.com/"):
            raise ValueError(
                "Only public GitHub repository URLs are supported. "
                "URL must start with https://github.com/"
            )
        parts = stripped.rstrip("/").split("/")
        if len(parts) < 5:
            raise ValueError(
                "URL must include both an owner and a repository name."
            )
        return stripped


class GenerateResponse(BaseModel):
    job_id:         str
    repo_name:      str
    file_count:     int
    folder_count:   int
    doc_count:      int
    folder_tree:    dict[str, Any]
    key_files:      list[KeyFile]
    readme_preview: str
    readme_content: str


class StatusResponse(BaseModel):
    job_id:  str
    status:  str
    step:    int
    result:  GenerateResponse | None = None
    error:   str | None = None


class ValidateRequest(BaseModel):
    repo_url: str


class ValidateResponse(BaseModel):
    valid:   bool
    message: str


class ErrorResponse(BaseModel):
    detail: str