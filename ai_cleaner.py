"""
AI Front-Matter & AST Refiner
=============================
Uses Gemini to refine document metadata (title, authors, abstract, keywords)
when GEMINI_API_KEY is configured. Gracefully falls back to the original AST
if the API key is missing, network is unavailable, or an error occurs.
"""

import os
import json
import logging
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def refine_ast(document_ast: dict) -> dict:
    """
    Refine title, authors, abstract, and keywords of document_ast using Gemini.
    Returns the updated document_ast (or original on any failure).
    """
    if not document_ast:
        return document_ast

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.info("ai_cleaner: GEMINI_API_KEY not configured, skipping AI refinement.")
        return document_ast

    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=api_key)
        model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")

        # Provide a snapshot of the front matter and first few sections
        title = document_ast.get("title", "")
        authors = document_ast.get("authors", [])
        abstract = document_ast.get("abstract", "")
        keywords = document_ast.get("keywords", [])
        sections = document_ast.get("sections", [])

        # Extract sample of document body (up to 3000 chars) to give context
        sample_sections = []
        for s in sections[:3]:
            h = s.get("heading", "")
            c = (s.get("content", "") or "")[:800]
            sample_sections.append(f"### {h}\n{c}")
        sample_text = "\n\n".join(sample_sections)

        prompt = f"""You are an academic paper metadata extractor and refiner.
Analyze the following paper extracted AST and initial text, and return a clean JSON object with corrected metadata.

Current Extracted Metadata:
- Title: {json.dumps(title)}
- Authors: {json.dumps(authors)}
- Abstract: {json.dumps(abstract)}
- Keywords: {json.dumps(keywords)}

Initial Document Sections / Text:
{sample_text}

Rules:
1. "title": The complete, accurate title of the paper. Fix cut-off titles or noise.
2. "authors": List of author objects with keys "name" (str) and "affiliation" (str). Separate institutional affiliations (e.g., universities, departments) from author names.
3. "abstract": The full academic abstract text. If the current abstract is empty or incomplete, extract it from the provided text. Do not summarize; use the actual abstract text.
4. "keywords": List of keywords or index terms mentioned in the paper.
5. "remove_first_section": Boolean. True ONLY if the first section heading was actually the abstract that was mistakenly treated as a section.

Respond with ONLY valid JSON matching this schema:
{{
  "title": "string",
  "authors": [
    {{"name": "string", "affiliation": "string"}}
  ],
  "abstract": "string",
  "keywords": ["string"],
  "remove_first_section": false
}}"""

        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        if not response or not response.text:
            return document_ast

        data = json.loads(response.text)

        # Apply refined fields if present
        if data.get("title"):
            document_ast["title"] = str(data["title"]).strip()

        if data.get("abstract"):
            document_ast["abstract"] = str(data["abstract"]).strip()

        if data.get("keywords") and isinstance(data["keywords"], list):
            document_ast["keywords"] = [str(k).strip() for k in data["keywords"] if str(k).strip()]

        if data.get("authors") and isinstance(data["authors"], list):
            refined_authors = []
            for a in data["authors"]:
                if isinstance(a, dict) and a.get("name"):
                    refined_authors.append(a)
                elif isinstance(a, str) and a.strip():
                    refined_authors.append({"name": a.strip(), "affiliation": ""})
            if refined_authors:
                document_ast["authors"] = refined_authors

        # If the first section was mistakenly the abstract, remove it from sections
        if data.get("remove_first_section") and document_ast.get("sections"):
            document_ast["sections"] = document_ast["sections"][1:]
            if document_ast.get("nested_sections"):
                document_ast["nested_sections"] = document_ast["nested_sections"][1:]

        logger.info("ai_cleaner: successfully refined metadata for '%s'", document_ast.get("title"))
        return document_ast

    except Exception as e:
        logger.warning("ai_cleaner: failed to refine AST with Gemini, using original: %s", e)
        return document_ast
