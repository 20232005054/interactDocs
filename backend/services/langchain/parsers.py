import json
import re
from typing import Any, Dict, List, Optional


def parse_summary_output(output: str) -> Dict[str, Any]:
    if not output:
        return {"content": "", "error": "Empty output"}

    cleaned = output.strip()
    cleaned = re.sub(r"^#+\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^摘要[：:]\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()

    return {"content": cleaned}


def parse_structure_output(output: str) -> List[Dict[str, Any]]:
    if not output:
        return []

    cleaned = output.strip()
    cleaned = re.sub(r"^```(?:markdown)?\s*", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"\s*```$", "", cleaned, flags=re.MULTILINE)
    cleaned = cleaned.strip()

    lines = cleaned.split("\n")
    structure: List[Dict[str, Any]] = []

    for line in lines:
        line = line.strip()
        if not line:
            continue

        match = re.match(r"^(#{1,6})\s+(.+)$", line)
        if match:
            level = len(match.group(1))
            title = match.group(2).strip()
            structure.append({
                "level": level,
                "title": title,
                "type": f"heading-{level}",
            })
        else:
            structure.append({
                "level": 1,
                "title": line,
                "type": "heading-1",
            })

    return structure


def parse_json_output(output: str) -> Dict[str, Any]:
    if not output:
        return {}

    cleaned = output.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        return {}


def clean_output(output: str, remove_patterns: Optional[List[str]] = None) -> str:
    if not output:
        return ""

    cleaned = output.strip()
    default_patterns = [
        r"^#+\s*",
        r"^摘要[：:]\s*",
        r"^内容[：:]\s*",
        r"^标题[：:]\s*",
    ]

    patterns = remove_patterns or default_patterns
    for pattern in patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.MULTILINE)

    return cleaned.strip()
