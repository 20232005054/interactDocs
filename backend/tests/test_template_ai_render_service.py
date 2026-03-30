import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

from api.v1.documents import apply_summary_template, apply_structure_template
from services.document_service import DocumentService
from services.summary_template_service import SummaryTemplateService


class TestSummaryTemplateService(unittest.IsolatedAsyncioTestCase):
    async def test_build_sources_data_map_supports_keyinfo_summary_chapter(self):
        document = SimpleNamespace(document_id="doc-1", template_id="tpl-1")
        db = AsyncMock()
        generated_summary_map = {"sum_generated": "新生成摘要"}
        sources = [
            {"source": "keyinfo", "match_key": "trial_name", "target_field": "trial_name"},
            {"source": "summary", "match_key": "sum_overview", "target_field": "overview"},
            {"source": "summary", "match_key": "sum_generated", "target_field": "generated"},
            {"source": "chapter", "match_key": "chp_design", "target_field": "design"},
        ]

        with (
            patch.object(
                SummaryTemplateService,
                "_get_core_info_map",
                AsyncMock(return_value={"trial_name": "试验A"}),
            ),
            patch.object(
                SummaryTemplateService,
                "_get_summary_content_map",
                AsyncMock(return_value={"sum_overview": "历史摘要"}),
            ),
            patch.object(
                SummaryTemplateService,
                "_get_chapter_content_map",
                AsyncMock(return_value={"chp_design": "研究设计内容"}),
            ),
        ):
            data_map = await SummaryTemplateService.build_sources_data_map(
                db=db,
                document=document,
                sources=sources,
                generated_summary_map=generated_summary_map,
            )

        self.assertEqual(data_map["trial_name"], "试验A")
        self.assertEqual(data_map["overview"], "历史摘要")
        self.assertEqual(data_map["generated"], "新生成摘要")
        self.assertEqual(data_map["design"], "研究设计内容")

    async def test_render_ai_content_prefers_custom_prompt(self):
        db = AsyncMock()
        document = SimpleNamespace(document_id="doc-1", template_id="tpl-1")
        summary_template = SimpleNamespace(
            summary_template_id="st-1",
            field_key="sum_a",
            custom_prompt="请基于{{trial_name}}输出摘要",
            default_prompt="默认{{trial_name}}",
            sources=[{"source": "keyinfo", "match_key": "trial_name", "target_field": "trial_name"}],
        )

        with (
            patch.object(
                SummaryTemplateService,
                "build_sources_data_map",
                AsyncMock(return_value={"trial_name": "试验B"}),
            ),
            patch.object(
                SummaryTemplateService,
                "_call_ai_renderer",
                AsyncMock(return_value="AI结果"),
            ) as ai_call,
        ):
            content = await SummaryTemplateService.render_ai_content(
                db=db,
                document=document,
                summary_template=summary_template,
            )

        self.assertEqual(content, "AI结果")
        ai_call.assert_awaited_once_with(
            "请基于试验B输出摘要",
            template_id="st-1",
            field_key="sum_a",
        )

    def test_generate_content_copy_mode_renders_target_field(self):
        content_template = "标题：{{trial_name}}；目标：{{objective}}"
        sources = [
            {"match_key": "trial_name", "target_field": "trial_name"},
            {"match_key": "trial_purpose", "target_field": "objective"},
        ]
        data_map = {"trial_name": "研究X", "trial_purpose": "验证疗效"}

        content = SummaryTemplateService.generate_content_copy_mode(
            content_template=content_template,
            sources=sources,
            data_map=data_map,
        )

        self.assertEqual(content, "标题：研究X；目标：验证疗效")


class TestDocumentServiceApplySummaryTemplate(unittest.IsolatedAsyncioTestCase):
    async def test_apply_summary_template_handles_copy_and_ai_modes(self):
        db = SimpleNamespace(add=Mock(), commit=AsyncMock())
        document = SimpleNamespace(document_id="doc-1", template_id="tpl-1")
        copy_template = SimpleNamespace(
            summary_template_id="st-1",
            title="摘要A",
            field_key="sum_a",
            generation_mode=0,
            content_template="{{trial_name}}",
            sources=[{"source": "keyinfo", "match_key": "trial_name", "target_field": "trial_name"}],
        )
        ai_template = SimpleNamespace(
            summary_template_id="st-2",
            title="摘要B",
            field_key="sum_b",
            generation_mode=1,
            content_template=None,
            sources=[{"source": "summary", "match_key": "sum_a", "target_field": "base"}],
            custom_prompt=None,
            default_prompt="基于{{base}}生成",
        )

        with (
            patch("services.document_service.DocumentMapper.get_document_by_id", AsyncMock(return_value=document)),
            patch("services.document_service.SummaryTemplateMapper.get_by_template_id", AsyncMock(return_value=[copy_template, ai_template])),
            patch(
                "services.document_service.SummaryTemplateService.build_sources_data_map",
                AsyncMock(side_effect=[{"trial_name": "试验C"}, {"base": "复制摘要内容"}]),
            ) as data_map_call,
            patch(
                "services.document_service.SummaryTemplateService.generate_content_copy_mode",
                return_value="复制摘要内容",
            ) as copy_call,
            patch(
                "services.document_service.SummaryTemplateService.render_ai_content",
                AsyncMock(return_value="AI摘要内容"),
            ) as ai_call,
        ):
            items = await DocumentService.apply_summary_template(db, "doc-1")

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["summary"].content, "复制摘要内容")
        self.assertEqual(items[1]["summary"].content, "AI摘要内容")
        self.assertFalse(items[0]["degraded"])
        self.assertIsNone(items[0]["generation_error"])
        self.assertFalse(items[1]["degraded"])
        self.assertIsNone(items[1]["generation_error"])
        copy_call.assert_called_once()
        ai_call.assert_awaited_once()
        self.assertEqual(ai_call.await_args.kwargs["source_data_map"], {"base": "复制摘要内容"})
        self.assertEqual(data_map_call.await_args_list[1].kwargs["generated_summary_map"], {"sum_a": "复制摘要内容"})
        db.commit.assert_awaited_once()

    async def test_apply_summary_template_downgrades_mode1_when_ai_fails(self):
        db = SimpleNamespace(add=Mock(), commit=AsyncMock())
        document = SimpleNamespace(document_id="doc-1", template_id="tpl-1")
        ai_template = SimpleNamespace(
            summary_template_id="st-2",
            title="摘要B",
            field_key="sum_b",
            generation_mode=1,
            content_template="降级内容：{{base}}",
            sources=[{"source": "summary", "match_key": "sum_a", "target_field": "base"}],
            custom_prompt=None,
            default_prompt="基于{{base}}生成",
        )

        with (
            patch("services.document_service.DocumentMapper.get_document_by_id", AsyncMock(return_value=document)),
            patch("services.document_service.SummaryTemplateMapper.get_by_template_id", AsyncMock(return_value=[ai_template])),
            patch(
                "services.document_service.SummaryTemplateService.build_sources_data_map",
                AsyncMock(return_value={"base": "复制摘要内容"}),
            ),
            patch(
                "services.document_service.SummaryTemplateService.render_ai_content",
                AsyncMock(side_effect=RuntimeError("模型超时")),
            ),
            patch(
                "services.document_service.SummaryTemplateService.generate_content_copy_mode",
                return_value="降级内容：复制摘要内容",
            ) as copy_call,
        ):
            items = await DocumentService.apply_summary_template(db, "doc-1")

        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["summary"].content, "降级内容：复制摘要内容")
        self.assertTrue(items[0]["degraded"])
        self.assertEqual(items[0]["generation_error"]["error_type"], "RuntimeError")
        self.assertEqual(items[0]["generation_error"]["error_message"], "模型超时")
        self.assertEqual(items[0]["generation_error"]["generation_mode"], 1)
        self.assertTrue(items[0]["generation_error"]["trace_id"])
        copy_call.assert_called_once()
        db.commit.assert_awaited_once()

    async def test_apply_summary_template_continues_when_single_item_source_build_fails(self):
        db = SimpleNamespace(add=Mock(), commit=AsyncMock())
        document = SimpleNamespace(document_id="doc-1", template_id="tpl-1")
        first_ai_template = SimpleNamespace(
            summary_template_id="st-1",
            title="摘要A",
            field_key="sum_a",
            generation_mode=1,
            content_template="降级：{{base}}",
            sources=[{"source": "summary", "match_key": "sum_x", "target_field": "base"}],
            custom_prompt=None,
            default_prompt="请生成A",
        )
        second_copy_template = SimpleNamespace(
            summary_template_id="st-2",
            title="摘要B",
            field_key="sum_b",
            generation_mode=0,
            content_template="复制：{{trial_name}}",
            sources=[{"source": "keyinfo", "match_key": "trial_name", "target_field": "trial_name"}],
            custom_prompt=None,
            default_prompt=None,
        )

        with (
            patch("services.document_service.DocumentMapper.get_document_by_id", AsyncMock(return_value=document)),
            patch(
                "services.document_service.SummaryTemplateMapper.get_by_template_id",
                AsyncMock(return_value=[first_ai_template, second_copy_template]),
            ),
            patch(
                "services.document_service.SummaryTemplateService.build_sources_data_map",
                AsyncMock(side_effect=[RuntimeError("来源装配失败"), {"trial_name": "试验D"}]),
            ),
            patch(
                "services.document_service.SummaryTemplateService.generate_content_copy_mode",
                side_effect=["降级：", "复制：试验D"],
            ) as copy_call,
            patch(
                "services.document_service.SummaryTemplateService.render_ai_content",
                AsyncMock(return_value="不会被调用"),
            ) as ai_call,
        ):
            items = await DocumentService.apply_summary_template(db, "doc-1")

        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["summary"].content, "降级：")
        self.assertEqual(items[1]["summary"].content, "复制：试验D")
        self.assertTrue(items[0]["degraded"])
        self.assertEqual(items[0]["generation_error"]["error_type"], "RuntimeError")
        self.assertEqual(items[0]["generation_error"]["error_message"], "来源装配失败")
        self.assertEqual(items[0]["generation_error"]["error_code"], None)
        self.assertEqual(items[1]["degraded"], False)
        ai_call.assert_not_awaited()
        self.assertEqual(copy_call.call_count, 2)
        db.commit.assert_awaited_once()


class TestDocumentServiceApplyStructureTemplate(unittest.IsolatedAsyncioTestCase):
    async def test_apply_structure_template_creates_mode1_paragraph_and_keeps_parent_relation(self):
        added_objects = []

        def add_with_id(obj):
            added_objects.append(obj)
            if hasattr(obj, "chapter_id") and getattr(obj, "chapter_id", None) is None:
                obj.chapter_id = uuid4()
            if hasattr(obj, "paragraph_id") and getattr(obj, "paragraph_id", None) is None:
                obj.paragraph_id = uuid4()

        db = SimpleNamespace(add=Mock(side_effect=add_with_id), flush=AsyncMock(), commit=AsyncMock())
        document = SimpleNamespace(document_id="doc-1", template_id="tpl-1")
        root_template_id = uuid4()
        root_template = SimpleNamespace(
            structure_template_id=root_template_id,
            parent_id=None,
            title="一级章节",
            field_key="chp_root",
            generation_mode=0,
            content_template=None,
            sources=None,
            default_prompt=None,
            custom_prompt=None,
            level=1,
            order_index=1,
        )
        child_template = SimpleNamespace(
            structure_template_id=uuid4(),
            parent_id=root_template_id,
            title="二级章节",
            field_key="chp_child",
            generation_mode=1,
            content_template="默认正文：{{base}}",
            sources=[{"source": "summary", "match_key": "sum_a", "target_field": "base"}],
            default_prompt="基于{{base}}生成正文",
            custom_prompt=None,
            level=2,
            order_index=0,
        )

        with (
            patch("services.document_service.DocumentMapper.get_document_by_id", AsyncMock(return_value=document)),
            patch("services.document_service.StructureTemplateMapper.get_by_template_id", AsyncMock(return_value=[child_template, root_template])),
            patch(
                "services.document_service.SummaryTemplateService.build_sources_data_map",
                AsyncMock(return_value={"base": "摘要内容"}),
            ),
            patch(
                "services.document_service.SummaryTemplateService.render_ai_content",
                AsyncMock(return_value="AI生成正文"),
            ),
            patch(
                "services.document_service.SummaryTemplateService.generate_content_copy_mode",
                return_value="降级正文",
            ) as copy_call,
        ):
            items = await DocumentService.apply_structure_template(db, "doc-1")

        self.assertEqual(len(items), 2)
        root_item = items[0]
        child_item = items[1]
        self.assertEqual(child_item["chapter"].parent_id, root_item["chapter"].chapter_id)
        self.assertEqual(child_item["generation_mode"], 1)
        self.assertEqual(child_item["paragraph"].content, "AI生成正文")
        self.assertEqual(child_item["paragraph_content"], "AI生成正文")
        self.assertFalse(child_item["degraded"])
        self.assertIsNone(child_item["generation_error"])
        self.assertIsNone(root_item["paragraph"])
        copy_call.assert_not_called()
        db.commit.assert_awaited_once()

    async def test_apply_structure_template_downgrades_mode1_when_ai_fails(self):
        def add_with_id(obj):
            if hasattr(obj, "chapter_id") and getattr(obj, "chapter_id", None) is None:
                obj.chapter_id = uuid4()
            if hasattr(obj, "paragraph_id") and getattr(obj, "paragraph_id", None) is None:
                obj.paragraph_id = uuid4()

        db = SimpleNamespace(add=Mock(side_effect=add_with_id), flush=AsyncMock(), commit=AsyncMock())
        document = SimpleNamespace(document_id="doc-1", template_id="tpl-1")
        ai_template = SimpleNamespace(
            structure_template_id=uuid4(),
            parent_id=None,
            title="章节A",
            field_key="chp_a",
            generation_mode=1,
            content_template="降级正文：{{base}}",
            sources=[{"source": "summary", "match_key": "sum_a", "target_field": "base"}],
            default_prompt="基于{{base}}生成正文",
            custom_prompt=None,
            level=1,
            order_index=0,
        )

        with (
            patch("services.document_service.DocumentMapper.get_document_by_id", AsyncMock(return_value=document)),
            patch("services.document_service.StructureTemplateMapper.get_by_template_id", AsyncMock(return_value=[ai_template])),
            patch(
                "services.document_service.SummaryTemplateService.build_sources_data_map",
                AsyncMock(return_value={"base": "摘要内容"}),
            ),
            patch(
                "services.document_service.SummaryTemplateService.render_ai_content",
                AsyncMock(side_effect=RuntimeError("模型异常")),
            ),
            patch(
                "services.document_service.SummaryTemplateService.generate_content_copy_mode",
                return_value="降级正文：摘要内容",
            ) as copy_call,
        ):
            items = await DocumentService.apply_structure_template(db, "doc-1")

        self.assertEqual(len(items), 1)
        self.assertTrue(items[0]["degraded"])
        self.assertEqual(items[0]["generation_error"]["error_type"], "RuntimeError")
        self.assertEqual(items[0]["generation_error"]["error_message"], "模型异常")
        self.assertEqual(items[0]["paragraph"].content, "降级正文：摘要内容")
        self.assertEqual(items[0]["paragraph_content"], "降级正文：摘要内容")
        copy_call.assert_called_once()
        db.commit.assert_awaited_once()

    async def test_apply_structure_template_continues_when_single_item_source_build_fails(self):
        def add_with_id(obj):
            if hasattr(obj, "chapter_id") and getattr(obj, "chapter_id", None) is None:
                obj.chapter_id = uuid4()
            if hasattr(obj, "paragraph_id") and getattr(obj, "paragraph_id", None) is None:
                obj.paragraph_id = uuid4()

        db = SimpleNamespace(add=Mock(side_effect=add_with_id), flush=AsyncMock(), commit=AsyncMock())
        document = SimpleNamespace(document_id="doc-1", template_id="tpl-1")
        ai_template = SimpleNamespace(
            structure_template_id=uuid4(),
            parent_id=None,
            title="章节A",
            field_key="chp_a",
            generation_mode=1,
            content_template="降级正文：{{base}}",
            sources=[{"source": "summary", "match_key": "sum_a", "target_field": "base"}],
            default_prompt="基于{{base}}生成正文",
            custom_prompt=None,
            level=1,
            order_index=0,
        )
        copy_template = SimpleNamespace(
            structure_template_id=uuid4(),
            parent_id=None,
            title="章节B",
            field_key="chp_b",
            generation_mode=0,
            content_template="",
            sources=[],
            default_prompt=None,
            custom_prompt=None,
            level=1,
            order_index=1,
        )

        with (
            patch("services.document_service.DocumentMapper.get_document_by_id", AsyncMock(return_value=document)),
            patch(
                "services.document_service.StructureTemplateMapper.get_by_template_id",
                AsyncMock(return_value=[ai_template, copy_template]),
            ),
            patch(
                "services.document_service.SummaryTemplateService.build_sources_data_map",
                AsyncMock(side_effect=RuntimeError("章节来源装配失败")),
            ),
            patch(
                "services.document_service.SummaryTemplateService.generate_content_copy_mode",
                return_value="降级正文：",
            ) as copy_call,
            patch(
                "services.document_service.SummaryTemplateService.render_ai_content",
                AsyncMock(return_value="不会被调用"),
            ) as ai_call,
        ):
            items = await DocumentService.apply_structure_template(db, "doc-1")

        self.assertEqual(len(items), 2)
        self.assertTrue(items[0]["degraded"])
        self.assertEqual(items[0]["generation_error"]["error_message"], "章节来源装配失败")
        self.assertEqual(items[0]["paragraph_content"], "降级正文：")
        self.assertEqual(items[1]["chapter"].title, "章节B")
        self.assertFalse(items[1]["degraded"])
        ai_call.assert_not_awaited()
        copy_call.assert_called_once()
        db.commit.assert_awaited_once()


class TestDocumentsApiApplySummaryTemplate(unittest.IsolatedAsyncioTestCase):
    async def test_apply_summary_template_response_contains_mode_and_error_fields(self):
        summary_mode0 = SimpleNamespace(
            summary_id="sum-1",
            title="摘要A",
            content="复制内容",
            order_index=0,
        )
        summary_mode1 = SimpleNamespace(
            summary_id="sum-2",
            title="摘要B",
            content="降级内容",
            order_index=1,
        )

        service_result = [
            {
                "summary": summary_mode0,
                "generation_mode": 0,
                "sources": [{"source": "keyinfo"}],
                "degraded": False,
                "generation_error": None,
            },
            {
                "summary": summary_mode1,
                "generation_mode": 1,
                "sources": [{"source": "summary"}],
                "degraded": True,
                "generation_error": {"trace_id": "trace-1", "error_type": "AIEmptyResponse"},
            },
        ]

        with patch(
            "api.v1.documents.DocumentService.apply_summary_template",
            AsyncMock(return_value=service_result),
        ):
            response = await apply_summary_template(uuid4(), db=AsyncMock())

        payload = json.loads(response.body)
        self.assertEqual(payload["code"], 200)
        self.assertEqual(payload["data"]["items"][0]["generation_mode"], 0)
        self.assertEqual(payload["data"]["items"][1]["generation_mode"], 1)
        self.assertFalse(payload["data"]["items"][0]["degraded"])
        self.assertTrue(payload["data"]["items"][1]["degraded"])
        self.assertIsNone(payload["data"]["items"][0]["generation_error"])
        self.assertEqual(payload["data"]["items"][1]["generation_error"]["trace_id"], "trace-1")


class TestDocumentsApiApplyStructureTemplate(unittest.IsolatedAsyncioTestCase):
    async def test_apply_structure_template_response_contains_mode_and_paragraph_fields(self):
        chapter = SimpleNamespace(chapter_id="chp-1", title="章节A", order_index=0)
        paragraph = SimpleNamespace(paragraph_id="para-1")
        service_result = [
            {
                "chapter": chapter,
                "generation_mode": 1,
                "content_template": "模板",
                "sources": [{"source": "summary"}],
                "default_prompt": "默认提示",
                "custom_prompt": None,
                "degraded": False,
                "generation_error": None,
                "paragraph": paragraph,
                "paragraph_content": "生成正文",
            }
        ]

        with patch(
            "api.v1.documents.DocumentService.apply_structure_template",
            AsyncMock(return_value=service_result),
        ):
            response = await apply_structure_template(uuid4(), db=AsyncMock())

        payload = json.loads(response.body)
        self.assertEqual(payload["code"], 200)
        item = payload["data"]["items"][0]
        self.assertEqual(item["generation_mode"], 1)
        self.assertEqual(item["paragraph_id"], "para-1")
        self.assertEqual(item["paragraph_content"], "生成正文")
        self.assertFalse(item["degraded"])
        self.assertIsNone(item["generation_error"])

    async def test_apply_structure_template_response_covers_mode0_and_mode1_error_fields(self):
        chapter_mode0 = SimpleNamespace(chapter_id="chp-1", title="章节A", order_index=0)
        chapter_mode1 = SimpleNamespace(chapter_id="chp-2", title="章节B", order_index=1)
        paragraph_mode1 = SimpleNamespace(paragraph_id="para-2")
        service_result = [
            {
                "chapter": chapter_mode0,
                "generation_mode": 0,
                "content_template": "复制模板",
                "sources": [{"source": "keyinfo"}],
                "default_prompt": None,
                "custom_prompt": None,
                "degraded": False,
                "generation_error": None,
                "paragraph": None,
                "paragraph_content": None,
            },
            {
                "chapter": chapter_mode1,
                "generation_mode": 1,
                "content_template": "AI模板",
                "sources": [{"source": "summary"}],
                "default_prompt": "默认提示",
                "custom_prompt": None,
                "degraded": True,
                "generation_error": {
                    "trace_id": "trace-2",
                    "error_type": "AIEmptyResponse",
                    "error_code": "AI_EMPTY_RESPONSE",
                },
                "paragraph": paragraph_mode1,
                "paragraph_content": "降级正文",
            },
        ]

        with patch(
            "api.v1.documents.DocumentService.apply_structure_template",
            AsyncMock(return_value=service_result),
        ):
            response = await apply_structure_template(uuid4(), db=AsyncMock())

        payload = json.loads(response.body)
        self.assertEqual(payload["code"], 200)
        items = payload["data"]["items"]
        self.assertEqual(items[0]["generation_mode"], 0)
        self.assertEqual(items[0]["paragraph_id"], None)
        self.assertEqual(items[0]["paragraph_content"], None)
        self.assertFalse(items[0]["degraded"])
        self.assertIsNone(items[0]["generation_error"])
        self.assertEqual(items[1]["generation_mode"], 1)
        self.assertEqual(items[1]["paragraph_id"], "para-2")
        self.assertEqual(items[1]["paragraph_content"], "降级正文")
        self.assertTrue(items[1]["degraded"])
        self.assertEqual(items[1]["generation_error"]["error_code"], "AI_EMPTY_RESPONSE")
        self.assertEqual(items[1]["generation_error"]["trace_id"], "trace-2")


if __name__ == "__main__":
    unittest.main()
