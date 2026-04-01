import json
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from db.mappers.summary_mapper import SummaryMapper
from db.mappers.core_info_mapper import CoreInfoMapper
from db.mappers.chapter_mapper import ChapterMapper


async def build_sources_data_map(
    db: AsyncSession,
    document_id: str,
    sources: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not sources:
        return {}

    result: Dict[str, Any] = {}

    for source_config in sources:
        source_type = source_config.get("source", {})
        if isinstance(source_type, dict):
            source_value = source_type.get("value", "")
        else:
            source_value = source_type

        match_keys = source_config.get("match_keys", [])
        target_field = source_config.get("target_field", "")

        if not target_field:
            continue

        data = await _fetch_source_data(db, document_id, source_value, match_keys)
        if data:
            result[target_field] = data

    return result


async def _fetch_source_data(
    db: AsyncSession,
    document_id: str,
    source_type: str,
    match_keys: List[Dict[str, Any]],
) -> Any:
    if source_type == "keyinfo":
        return await _fetch_keyinfo_data(db, document_id, match_keys)
    elif source_type == "summary":
        return await _fetch_summary_data(db, document_id, match_keys)
    elif source_type == "chapter":
        return await _fetch_chapter_data(db, document_id, match_keys)
    return None


async def _fetch_keyinfo_data(
    db: AsyncSession,
    document_id: str,
    match_keys: List[Dict[str, Any]],
) -> Dict[str, Any]:
    import uuid
    from db.models import DocumentCoreInfo

    doc_uuid = uuid.UUID(document_id)
    all_core_info = await CoreInfoMapper.get_core_info_by_document_id(db, doc_uuid)

    result: Dict[str, Any] = {}

    if not match_keys:
        for info in all_core_info:
            result[info.field_key if hasattr(info, "field_key") else info.title] = info.content
        return result

    match_key_values = [mk.get("value", "") for mk in match_keys]

    for info in all_core_info:
        field_key = info.field_key if hasattr(info, "field_key") else info.title
        if field_key in match_key_values or not match_key_values:
            result[field_key] = info.content

    return result


async def _fetch_summary_data(
    db: AsyncSession,
    document_id: str,
    match_keys: List[Dict[str, Any]],
) -> Dict[str, Any]:
    import uuid

    doc_uuid = uuid.UUID(document_id)
    all_summaries = await SummaryMapper.get_summaries_by_document_id(db, doc_uuid)

    result: Dict[str, Any] = {}

    if not match_keys:
        for summary in all_summaries:
            result[summary.field_key if hasattr(summary, "field_key") else summary.title] = {
                "title": summary.title,
                "content": summary.content,
            }
        return result

    match_key_values = [mk.get("value", "") for mk in match_keys]

    for summary in all_summaries:
        field_key = summary.field_key if hasattr(summary, "field_key") else summary.title
        if field_key in match_key_values:
            result[field_key] = {
                "title": summary.title,
                "content": summary.content,
            }

    return result


async def _fetch_chapter_data(
    db: AsyncSession,
    document_id: str,
    match_keys: List[Dict[str, Any]],
) -> Dict[str, Any]:
    import uuid

    doc_uuid = uuid.UUID(document_id)
    all_chapters = await ChapterMapper.get_chapters_by_document_id(db, doc_uuid)

    result: Dict[str, Any] = {}

    if not match_keys:
        for chapter in all_chapters:
            chapter_info = await ChapterMapper.get_chapter_with_paragraphs(db, chapter.chapter_id)
            if chapter_info:
                _, paragraphs = chapter_info
                result[chapter.title] = {
                    "title": chapter.title,
                    "paragraphs": [p.content for p in paragraphs],
                }
        return result

    match_key_values = [mk.get("value", "") for mk in match_keys]

    for chapter in all_chapters:
        if chapter.title in match_key_values or chapter.field_key in match_key_values:
            chapter_info = await ChapterMapper.get_chapter_with_paragraphs(db, chapter.chapter_id)
            if chapter_info:
                _, paragraphs = chapter_info
                result[chapter.title] = {
                    "title": chapter.title,
                    "paragraphs": [p.content for p in paragraphs],
                }

    return result


def format_sources_data_for_prompt(sources_data: Dict[str, Any]) -> str:
    if not sources_data:
        return ""

    lines: List[str] = []
    for key, value in sources_data.items():
        if isinstance(value, dict):
            if "content" in value:
                lines.append(f"{key}：{value['content']}")
            elif "paragraphs" in value:
                paragraphs_text = "\n".join(value["paragraphs"])
                lines.append(f"{key}：\n{paragraphs_text}")
            else:
                lines.append(f"{key}：{json.dumps(value, ensure_ascii=False)}")
        elif isinstance(value, str):
            lines.append(f"{key}：{value}")
        else:
            lines.append(f"{key}：{json.dumps(value, ensure_ascii=False)}")

    return "\n".join(lines)
