"""
Schema Mapper
=============
Transforms the Section Detector AST into the paper-schema.json format
(nested tree: Paper → Section → Subsection → Paragraph/Equation),
normalises missing fields, validates against the JSON Schema, and
writes the result to a downloadable JSON file.

Pipeline:
    AST → Schema Mapping → Field Normalisation → Validation → JSON File
"""

import json
import os
import re
from pathlib import Path

import jsonschema

BASE_DIR = Path(__file__).resolve().parent.parent
SCHEMA_PATH = BASE_DIR / "typst" / "paper-schema.json"
OUTPUTS_DIR = BASE_DIR / "outputs"


def _load_schema() -> dict:
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# ── Step 1: Schema Mapping ─────────────────────────────────────────

def _text_to_paragraphs(text: str) -> list[dict]:
    """Split a text block into paragraph objects, splitting on blank lines."""
    if not text or not text.strip():
        return []
    chunks = re.split(r"\n\s*\n", text.strip())
    return [{"type": "paragraph", "text": " ".join(c.split())} for c in chunks if c.strip()]


def _map_ast_to_schema(ast: dict) -> dict:
    """
    Map AST field names to the nested schema format.
    Produces: { title, abstract, authors, content[ {type:'section', ...} ], references }
    Prefers nested_sections if available, falls back to flat sections.
    """
    # ── Authors ──
    authors = []
    for a in (ast.get("authors") or []):
        if isinstance(a, str):
            authors.append({"name": a})
        elif isinstance(a, dict):
            authors.append({
                "name": a.get("name", ""),
                "department": a.get("department", ""),
                "organization": a.get("organization", a.get("affiliation", "")),
                "location": a.get("location", ""),
                "email": a.get("email", ""),
            })

    # ── Content (nested tree) ──
    content = []

    nested = ast.get("nested_sections") or []
    if nested:
        for sec in nested:
            section_node = {
                "type": "section",
                "title": sec.get("heading", "Untitled"),
                "content": _text_to_paragraphs(sec.get("content", "")),
            }
            for sub in (sec.get("subsections") or []):
                sub_node = {
                    "type": "subsection",
                    "title": sub.get("heading", "Untitled"),
                    "content": _text_to_paragraphs(sub.get("content", "")),
                }
                for subsub in (sub.get("subsections") or []):
                    subsub_node = {
                        "type": "subsubsection",
                        "title": subsub.get("heading", "Untitled"),
                        "content": _text_to_paragraphs(subsub.get("content", "")),
                    }
                    sub_node["content"].append(subsub_node)
                section_node["content"].append(sub_node)
            content.append(section_node)
    else:
        # Flat sections fallback
        for s in (ast.get("sections") or []):
            section_node = {
                "type": "section",
                "title": s.get("heading", ""),
                "content": _text_to_paragraphs(s.get("content", "")),
            }
            content.append(section_node)

    # ── References ──
    references = []
    raw_refs = ast.get("references", "")
    if isinstance(raw_refs, list):
        for r in raw_refs:
            if isinstance(r, dict):
                references.append({"id": r.get("id", ""), "citation": r.get("citation", "")})
            elif isinstance(r, str):
                references.append({"id": str(len(references) + 1), "citation": r})
    elif isinstance(raw_refs, str) and raw_refs.strip():
        for i, line in enumerate(raw_refs.strip().split("\n"), 1):
            if line.strip():
                references.append({"id": str(i), "citation": line.strip()})

    return {
        "title": ast.get("title", ""),
        "abstract": ast.get("abstract", ""),
        "index_terms": ast.get("keywords") or ast.get("index_terms") or [],
        "authors": authors,
        "content": content,
        "references": references,
    }


# ── Step 2: Field Normalisation ────────────────────────────────────

def _normalise(schema_obj: dict) -> dict:
    """Ensure every required / optional field has a sensible default."""
    schema_obj.setdefault("title", "")
    schema_obj.setdefault("abstract", "")
    schema_obj.setdefault("index_terms", [])
    schema_obj.setdefault("authors", [])
    schema_obj.setdefault("content", [])
    schema_obj.setdefault("references", [])

    for author in schema_obj["authors"]:
        author.setdefault("department", "")
        author.setdefault("organization", "")
        author.setdefault("location", "")
        author.setdefault("email", "")

    return schema_obj


# ── Step 3: JSON Schema Validation ─────────────────────────────────

def _validate(schema_obj: dict) -> list[str]:
    """
    Validate against paper-schema.json.
    Returns a list of error messages (empty if valid).
    """
    schema = _load_schema()
    validator = jsonschema.Draft7Validator(schema)
    errors = sorted(validator.iter_errors(schema_obj), key=lambda e: list(e.absolute_path))
    return [f"{'.'.join(str(p) for p in e.absolute_path) or '(root)'}: {e.message}" for e in errors]


# ── Step 4: JSON File Generation ───────────────────────────────────

def _write_json(schema_obj: dict, filename: str = "paper.json") -> str:
    """Write the validated JSON to the outputs directory. Returns the file path."""
    OUTPUTS_DIR.mkdir(exist_ok=True)
    out_path = OUTPUTS_DIR / filename
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(schema_obj, f, indent=2, ensure_ascii=False)
    return str(out_path)


# ── Public API ─────────────────────────────────────────────────────

def map_and_generate(ast: dict, *, save: bool = True) -> dict:
    """
    Full pipeline: map → normalise → validate → (optionally) save JSON file.

    Returns:
        {
            "status": "success" | "error",
            "data": { ...schema json },
            "json_url": "/outputs/paper.json",   # only when save=True
            "validation_errors": [...]            # only when validation fails
        }
    """
    # Step 1 – mapping
    schema_obj = _map_ast_to_schema(ast)

    # Step 2 – normalisation
    schema_obj = _normalise(schema_obj)

    # Step 3 – validation
    errors = _validate(schema_obj)
    if errors:
        return {
            "status": "error",
            "data": schema_obj,
            "validation_errors": errors,
        }

    # Step 4 – file generation
    if save:
        _write_json(schema_obj)
        return {
            "status": "success",
            "data": schema_obj,
            "json_url": "/outputs/paper.json",
        }

    return {
        "status": "success",
        "data": schema_obj,
    }
