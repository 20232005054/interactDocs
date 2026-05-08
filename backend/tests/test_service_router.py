"""
服务路由器测试

测试 v1/v2 服务动态切换和降级方案
"""

import pytest
from unittest.mock import Mock, patch
from uuid import uuid4

from services.service_router import ServiceRouter, get_ai_service, get_chat_service
from core.performance_monitor import PerformanceMonitor


class TestServiceRouter:
    """测试服务路由器"""
    
    def test_route_service_v1(self):
        """测试路由到 v1 服务"""
        v1_service = Mock()
        v2_service = Mock()
        
        with patch("services.service_router.is_langchain_enabled", return_value=False):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=False,
            )
            
            assert service == v1_service
    
    def test_route_service_v2(self):
        """测试路由到 v2 服务"""
        v1_service = Mock()
        v2_service = Mock()
        
        with patch("services.service_router.is_langchain_enabled", return_value=True):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=False,
            )
            
            assert service == v2_service
    
    @pytest.mark.asyncio
    async def test_fallback_on_v2_failure(self):
        """测试 v2 失败时降级到 v1"""
        # 创建 mock 服务
        v1_service = Mock()
        v1_service.test_method = Mock(return_value="v1_result")
        
        v2_service = Mock()
        v2_service.test_method = Mock(side_effect=Exception("v2 failed"))
        
        with patch("services.service_router.is_langchain_enabled", return_value=True):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=True,
            )
            
            # 调用方法应该降级到 v1
            result = await service.test_method()
            
            assert result == "v1_result"
            assert v2_service.test_method.called
            assert v1_service.test_method.called
    
    def test_get_ai_service(self):
        """测试获取 AI 服务"""
        service = get_ai_service()
        assert service is not None
        assert hasattr(service, "ai_assist_paragraph")
        assert hasattr(service, "ai_evaluate_paragraph")
        assert hasattr(service, "assist_single_summary")
    
    def test_get_chat_service(self):
        """测试获取对话服务"""
        service = get_chat_service()
        assert service is not None
        assert hasattr(service, "chat_stream")


class TestPerformanceMonitor:
    """测试性能监控器"""
    
    def test_record_metric(self):
        """测试记录指标"""
        monitor = PerformanceMonitor()
        
        monitor.record(
            service_version="v1",
            feature="test",
            method="test_method",
            duration=1.5,
            success=True,
        )
        
        assert len(monitor.metrics) == 1
        assert monitor.metrics[0].service_version == "v1"
        assert monitor.metrics[0].feature == "test"
        assert monitor.metrics[0].method == "test_method"
        assert monitor.metrics[0].duration == 1.5
        assert monitor.metrics[0].success is True
    
    def test_get_statistics(self):
        """测试获取统计信息"""
        monitor = PerformanceMonitor()
        
        # 记录多个指标
        for i in range(10):
            monitor.record(
                service_version="v1",
                feature="test",
                method="test_method",
                duration=1.0 + i * 0.1,
                success=i < 8,  # 前 8 个成功，后 2 个失败
            )
        
        stats = monitor.get_statistics(service_version="v1", feature="test")
        
        assert stats["total_count"] == 10
        assert stats["success_count"] == 8
        assert stats["failure_count"] == 2
        assert stats["success_rate"] == 0.8
        assert stats["avg_duration"] > 0
    
    def test_compare_versions(self):
        """测试版本对比"""
        monitor = PerformanceMonitor()
        
        # v1 指标
        for i in range(5):
            monitor.record(
                service_version="v1",
                feature="test",
                method="test_method",
                duration=2.0,
                success=True,
            )
        
        # v2 指标（更快）
        for i in range(5):
            monitor.record(
                service_version="v2",
                feature="test",
                method="test_method",
                duration=1.0,
                success=True,
            )
        
        comparison = monitor.compare_versions("test", "test_method")
        
        assert comparison["v1"]["avg_duration"] == 2.0
        assert comparison["v2"]["avg_duration"] == 1.0
        assert comparison["improvements"]["duration"] == 50.0  # v2 快 50%
    
    def test_get_recent_failures(self):
        """测试获取最近失败记录"""
        monitor = PerformanceMonitor()
        
        # 记录成功和失败
        for i in range(10):
            monitor.record(
                service_version="v1",
                feature="test",
                method="test_method",
                duration=1.0,
                success=i % 2 == 0,  # 偶数成功，奇数失败
                error="test error" if i % 2 == 1 else None,
            )
        
        failures = monitor.get_recent_failures(limit=3)
        
        assert len(failures) == 3
        assert all(not f.success for f in failures)
        assert all(f.error == "test error" for f in failures)
    
    def test_clear(self):
        """测试清空记录"""
        monitor = PerformanceMonitor()
        
        monitor.record(
            service_version="v1",
            feature="test",
            method="test_method",
            duration=1.0,
            success=True,
        )
        
        assert len(monitor.metrics) == 1
        
        monitor.clear()
        
        assert len(monitor.metrics) == 0


class TestIntegration:
    """测试集成"""
    
    @pytest.mark.asyncio
    async def test_service_router_with_monitoring(self):
        """测试服务路由器与性能监控集成"""
        monitor = PerformanceMonitor()
        
        # 模拟服务调用
        monitor.record(
            service_version="v2",
            feature="chat",
            method="chat_stream",
            duration=1.5,
            success=True,
        )
        
        stats = monitor.get_statistics(service_version="v2", feature="chat")
        
        assert stats["total_count"] == 1
        assert stats["success_count"] == 1
        assert stats["avg_duration"] == 1.5
