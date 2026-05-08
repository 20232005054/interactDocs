"""
集成测试

测试完整的 v1/v2 切换流程、降级方案和端到端工作流
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from uuid import uuid4

from services.service_router import (
    ServiceRouter,
    get_ai_service,
    get_chat_service,
    get_literature_rag_service,
    get_template_apply_service,
)
from core.performance_monitor import performance_monitor


class TestServiceSwitching:
    """测试服务切换"""
    
    @pytest.mark.asyncio
    async def test_switch_from_v1_to_v2(self):
        """测试从 v1 切换到 v2"""
        # 模拟 v1 服务
        v1_service = Mock()
        v1_service.test_method = AsyncMock(return_value="v1_result")
        
        # 模拟 v2 服务
        v2_service = Mock()
        v2_service.test_method = AsyncMock(return_value="v2_result")
        
        # 测试 v1（Feature Flag 关闭）
        with patch("services.service_router.is_langchain_enabled", return_value=False):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=False,
            )
            result = await service.test_method()
            assert result == "v1_result"
        
        # 测试 v2（Feature Flag 开启）
        with patch("services.service_router.is_langchain_enabled", return_value=True):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=False,
            )
            result = await service.test_method()
            assert result == "v2_result"
    
    @pytest.mark.asyncio
    async def test_fallback_on_v2_failure(self):
        """测试 v2 失败时降级到 v1"""
        # 模拟 v1 服务（正常）
        v1_service = Mock()
        v1_service.test_method = AsyncMock(return_value="v1_fallback_result")
        
        # 模拟 v2 服务（失败）
        v2_service = Mock()
        v2_service.test_method = AsyncMock(side_effect=Exception("v2 failed"))
        
        # 启用降级
        with patch("services.service_router.is_langchain_enabled", return_value=True):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=True,
            )
            
            # 应该降级到 v1
            result = await service.test_method()
            assert result == "v1_fallback_result"
            
            # 验证 v2 被调用过
            assert v2_service.test_method.called
            # 验证 v1 被调用过（降级）
            assert v1_service.test_method.called
    
    @pytest.mark.asyncio
    async def test_fallback_disabled(self):
        """测试禁用降级时直接抛出异常"""
        # 模拟 v1 服务
        v1_service = Mock()
        v1_service.test_method = AsyncMock(return_value="v1_result")
        
        # 模拟 v2 服务（失败）
        v2_service = Mock()
        v2_service.test_method = AsyncMock(side_effect=Exception("v2 failed"))
        
        # 禁用降级
        with patch("services.service_router.is_langchain_enabled", return_value=True):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=False,
            )
            
            # 应该直接抛出异常
            with pytest.raises(Exception, match="v2 failed"):
                await service.test_method()
            
            # v1 不应该被调用
            assert not v1_service.test_method.called


class TestEndToEndWorkflows:
    """测试端到端工作流"""
    
    @pytest.mark.asyncio
    async def test_document_generation_workflow(self):
        """测试文档生成工作流（端到端）"""
        # 跳过，需要真实数据库和 AI 服务
        pytest.skip("需要真实环境")
        
        from services.langchain.workflows.document_generation import (
            create_document_generation_workflow
        )
        
        document_id = uuid4()
        workflow = create_document_generation_workflow(document_id)
        
        # 执行工作流
        result = await workflow.run(mode="full")
        
        # 验证结果
        assert result["status"] == "completed"
        assert result["core_info_count"] > 0
        assert result["summary_count"] > 0
        assert result["chapter_count"] > 0
    
    @pytest.mark.asyncio
    async def test_chapter_completion_workflow(self):
        """测试章节完善工作流（端到端）"""
        # 跳过，需要真实数据库和 AI 服务
        pytest.skip("需要真实环境")
        
        from services.langchain.workflows.chapter_completion import (
            create_chapter_completion_workflow
        )
        
        chapter_id = uuid4()
        workflow = create_chapter_completion_workflow(chapter_id)
        
        # 执行工作流
        result = await workflow.run(target_score=8.0, max_iterations=3)
        
        # 验证结果
        assert result["status"] == "completed"
        assert result["final_score"] >= 8.0
        assert result["iterations"] <= 3
    
    @pytest.mark.asyncio
    async def test_content_review_workflow(self):
        """测试内容审核工作流（端到端）"""
        # 跳过，需要真实数据库和 AI 服务
        pytest.skip("需要真实环境")
        
        from services.langchain.workflows.content_review import (
            create_content_review_workflow
        )
        
        document_id = uuid4()
        workflow = create_content_review_workflow(document_id)
        
        # 执行工作流
        result = await workflow.run(level="STANDARD")
        
        # 验证结果
        assert result["status"] == "completed"
        assert "passed" in result
        assert "report" in result


class TestServiceIntegration:
    """测试服务集成"""
    
    @pytest.mark.asyncio
    async def test_ai_service_integration(self):
        """测试 AI 服务集成"""
        service = get_ai_service()
        
        # 验证接口存在
        assert hasattr(service, "ai_assist_paragraph")
        assert hasattr(service, "ai_evaluate_paragraph")
        assert hasattr(service, "assist_single_summary")
    
    @pytest.mark.asyncio
    async def test_chat_service_integration(self):
        """测试对话服务集成"""
        service = get_chat_service()
        
        # 验证接口存在
        assert hasattr(service, "chat_stream")
        assert hasattr(service, "chat")
    
    @pytest.mark.asyncio
    async def test_literature_rag_service_integration(self):
        """测试文献 RAG 服务集成"""
        service = get_literature_rag_service()
        
        # 验证接口存在
        assert hasattr(service, "retrieve_and_format")
        assert hasattr(service, "retrieve_and_format_for_paragraph")
    
    @pytest.mark.asyncio
    async def test_template_apply_service_integration(self):
        """测试模板应用服务集成"""
        service = get_template_apply_service()
        
        # 验证接口存在
        assert hasattr(service, "apply_core_info_template")
        assert hasattr(service, "apply_summary_template")
        assert hasattr(service, "apply_structure_template")


class TestConcurrentRequests:
    """测试并发请求"""
    
    @pytest.mark.asyncio
    async def test_concurrent_v1_requests(self):
        """测试 v1 服务并发请求"""
        # 模拟 v1 服务
        v1_service = Mock()
        v1_service.test_method = AsyncMock(side_effect=lambda x: f"v1_{x}")
        
        v2_service = Mock()
        
        with patch("services.service_router.is_langchain_enabled", return_value=False):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=False,
            )
            
            # 并发 10 个请求
            tasks = [service.test_method(i) for i in range(10)]
            results = await asyncio.gather(*tasks)
            
            # 验证结果
            assert len(results) == 10
            assert all(r.startswith("v1_") for r in results)
    
    @pytest.mark.asyncio
    async def test_concurrent_v2_requests(self):
        """测试 v2 服务并发请求"""
        # 模拟 v2 服务
        v1_service = Mock()
        
        v2_service = Mock()
        v2_service.test_method = AsyncMock(side_effect=lambda x: f"v2_{x}")
        
        with patch("services.service_router.is_langchain_enabled", return_value=True):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=False,
            )
            
            # 并发 10 个请求
            tasks = [service.test_method(i) for i in range(10)]
            results = await asyncio.gather(*tasks)
            
            # 验证结果
            assert len(results) == 10
            assert all(r.startswith("v2_") for r in results)
    
    @pytest.mark.asyncio
    async def test_concurrent_mixed_success_failure(self):
        """测试并发请求（部分成功部分失败）"""
        # 模拟 v1 服务（降级）
        v1_service = Mock()
        v1_service.test_method = AsyncMock(side_effect=lambda x: f"v1_fallback_{x}")
        
        # 模拟 v2 服务（偶数成功，奇数失败）
        async def v2_method(x):
            if x % 2 == 0:
                return f"v2_{x}"
            else:
                raise Exception(f"v2 failed for {x}")
        
        v2_service = Mock()
        v2_service.test_method = AsyncMock(side_effect=v2_method)
        
        with patch("services.service_router.is_langchain_enabled", return_value=True):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=True,
            )
            
            # 并发 10 个请求
            tasks = [service.test_method(i) for i in range(10)]
            results = await asyncio.gather(*tasks)
            
            # 验证结果
            assert len(results) == 10
            # 偶数应该是 v2，奇数应该是 v1（降级）
            for i, result in enumerate(results):
                if i % 2 == 0:
                    assert result == f"v2_{i}"
                else:
                    assert result == f"v1_fallback_{i}"


class TestPerformanceMonitoring:
    """测试性能监控"""
    
    def setup_method(self):
        """每个测试前清空监控数据"""
        performance_monitor.clear()
    
    @pytest.mark.asyncio
    async def test_monitor_records_metrics(self):
        """测试监控器记录指标"""
        # 模拟服务调用
        performance_monitor.record(
            service_version="v2",
            feature="test",
            method="test_method",
            duration=1.5,
            success=True,
        )
        
        # 验证记录
        assert len(performance_monitor.metrics) == 1
        
        metric = performance_monitor.metrics[0]
        assert metric.service_version == "v2"
        assert metric.feature == "test"
        assert metric.method == "test_method"
        assert metric.duration == 1.5
        assert metric.success is True
    
    @pytest.mark.asyncio
    async def test_monitor_statistics(self):
        """测试监控器统计信息"""
        # 记录多个指标
        for i in range(10):
            performance_monitor.record(
                service_version="v2",
                feature="test",
                method="test_method",
                duration=1.0 + i * 0.1,
                success=i < 8,  # 前 8 个成功
            )
        
        # 获取统计信息
        stats = performance_monitor.get_statistics(
            service_version="v2",
            feature="test",
        )
        
        # 验证统计
        assert stats["total_count"] == 10
        assert stats["success_count"] == 8
        assert stats["failure_count"] == 2
        assert stats["success_rate"] == 0.8
        assert stats["avg_duration"] > 0
    
    @pytest.mark.asyncio
    async def test_monitor_version_comparison(self):
        """测试监控器版本对比"""
        # v1 指标（慢）
        for i in range(5):
            performance_monitor.record(
                service_version="v1",
                feature="test",
                method="test_method",
                duration=2.0,
                success=True,
            )
        
        # v2 指标（快）
        for i in range(5):
            performance_monitor.record(
                service_version="v2",
                feature="test",
                method="test_method",
                duration=1.0,
                success=True,
            )
        
        # 对比版本
        comparison = performance_monitor.compare_versions("test", "test_method")
        
        # 验证对比结果
        assert comparison["v1"]["avg_duration"] == 2.0
        assert comparison["v2"]["avg_duration"] == 1.0
        assert comparison["improvements"]["duration"] == 50.0  # v2 快 50%


class TestErrorHandling:
    """测试错误处理"""
    
    @pytest.mark.asyncio
    async def test_v2_timeout_fallback(self):
        """测试 v2 超时时降级"""
        # 模拟 v1 服务
        v1_service = Mock()
        v1_service.test_method = AsyncMock(return_value="v1_result")
        
        # 模拟 v2 服务（超时）
        async def v2_timeout():
            await asyncio.sleep(10)  # 模拟超时
            return "v2_result"
        
        v2_service = Mock()
        v2_service.test_method = AsyncMock(side_effect=asyncio.TimeoutError("timeout"))
        
        with patch("services.service_router.is_langchain_enabled", return_value=True):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=True,
            )
            
            # 应该降级到 v1
            result = await service.test_method()
            assert result == "v1_result"
    
    @pytest.mark.asyncio
    async def test_both_services_fail(self):
        """测试 v1 和 v2 都失败"""
        # 模拟 v1 服务（失败）
        v1_service = Mock()
        v1_service.test_method = AsyncMock(side_effect=Exception("v1 failed"))
        
        # 模拟 v2 服务（失败）
        v2_service = Mock()
        v2_service.test_method = AsyncMock(side_effect=Exception("v2 failed"))
        
        with patch("services.service_router.is_langchain_enabled", return_value=True):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=True,
            )
            
            # 应该抛出 v1 的异常
            with pytest.raises(Exception, match="v1 failed"):
                await service.test_method()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
