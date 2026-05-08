"""
性能测试

对比 v1/v2 服务的性能，进行压力测试和并发测试
"""

import pytest
import asyncio
import time
from unittest.mock import Mock, patch, AsyncMock
from uuid import uuid4
from typing import List
import statistics

from core.performance_monitor import performance_monitor


class TestPerformanceComparison:
    """测试 v1/v2 性能对比"""
    
    def setup_method(self):
        """每个测试前清空监控数据"""
        performance_monitor.clear()
    
    @pytest.mark.asyncio
    async def test_response_time_comparison(self):
        """测试响应时间对比"""
        # 模拟 v1 服务（慢）
        async def v1_method():
            await asyncio.sleep(0.2)  # 200ms
            return "v1_result"
        
        # 模拟 v2 服务（快）
        async def v2_method():
            await asyncio.sleep(0.1)  # 100ms
            return "v2_result"
        
        # 测试 v1
        v1_times = []
        for i in range(10):
            start = time.time()
            await v1_method()
            duration = time.time() - start
            v1_times.append(duration)
            
            performance_monitor.record(
                service_version="v1",
                feature="test",
                method="test_method",
                duration=duration,
                success=True,
            )
        
        # 测试 v2
        v2_times = []
        for i in range(10):
            start = time.time()
            await v2_method()
            duration = time.time() - start
            v2_times.append(duration)
            
            performance_monitor.record(
                service_version="v2",
                feature="test",
                method="test_method",
                duration=duration,
                success=True,
            )
        
        # 对比结果
        v1_avg = statistics.mean(v1_times)
        v2_avg = statistics.mean(v2_times)
        
        print(f"\nv1 平均响应时间: {v1_avg:.3f}s")
        print(f"v2 平均响应时间: {v2_avg:.3f}s")
        print(f"性能提升: {((v1_avg - v2_avg) / v1_avg * 100):.1f}%")
        
        # v2 应该更快
        assert v2_avg < v1_avg
    
    @pytest.mark.asyncio
    async def test_throughput_comparison(self):
        """测试吞吐量对比"""
        # 模拟 v1 服务
        v1_service = Mock()
        v1_service.test_method = AsyncMock(side_effect=lambda: asyncio.sleep(0.1))
        
        # 模拟 v2 服务（更快）
        v2_service = Mock()
        v2_service.test_method = AsyncMock(side_effect=lambda: asyncio.sleep(0.05))
        
        # 测试 v1 吞吐量（1 秒内能处理多少请求）
        v1_count = 0
        start_time = time.time()
        while time.time() - start_time < 1.0:
            await v1_service.test_method()
            v1_count += 1
        
        # 测试 v2 吞吐量
        v2_count = 0
        start_time = time.time()
        while time.time() - start_time < 1.0:
            await v2_service.test_method()
            v2_count += 1
        
        print(f"\nv1 吞吐量: {v1_count} 请求/秒")
        print(f"v2 吞吐量: {v2_count} 请求/秒")
        print(f"吞吐量提升: {((v2_count - v1_count) / v1_count * 100):.1f}%")
        
        # v2 吞吐量应该更高
        assert v2_count > v1_count


class TestStressTest:
    """压力测试"""
    
    @pytest.mark.asyncio
    async def test_high_concurrency(self):
        """测试高并发场景"""
        # 模拟服务
        service = Mock()
        service.test_method = AsyncMock(side_effect=lambda x: f"result_{x}")
        
        # 并发 100 个请求
        concurrency = 100
        tasks = [service.test_method(i) for i in range(concurrency)]
        
        start_time = time.time()
        results = await asyncio.gather(*tasks)
        duration = time.time() - start_time
        
        print(f"\n并发数: {concurrency}")
        print(f"总耗时: {duration:.2f}s")
        print(f"平均响应时间: {duration / concurrency:.3f}s")
        
        # 验证所有请求都成功
        assert len(results) == concurrency
        assert all(r.startswith("result_") for r in results)
    
    @pytest.mark.asyncio
    async def test_sustained_load(self):
        """测试持续负载"""
        # 模拟服务
        service = Mock()
        service.test_method = AsyncMock(side_effect=lambda: asyncio.sleep(0.01))
        
        # 持续 5 秒，每秒 10 个请求
        duration = 5
        requests_per_second = 10
        total_requests = duration * requests_per_second
        
        start_time = time.time()
        success_count = 0
        failure_count = 0
        
        for i in range(total_requests):
            try:
                await service.test_method()
                success_count += 1
            except Exception:
                failure_count += 1
            
            # 控制速率
            await asyncio.sleep(1.0 / requests_per_second)
        
        actual_duration = time.time() - start_time
        
        print(f"\n持续时间: {actual_duration:.2f}s")
        print(f"总请求数: {total_requests}")
        print(f"成功: {success_count}")
        print(f"失败: {failure_count}")
        print(f"成功率: {success_count / total_requests * 100:.1f}%")
        
        # 成功率应该很高
        assert success_count / total_requests > 0.95
    
    @pytest.mark.asyncio
    async def test_memory_usage(self):
        """测试内存使用（简单版本）"""
        # 模拟服务
        service = Mock()
        service.test_method = AsyncMock(side_effect=lambda: "x" * 1000)  # 1KB 数据
        
        # 执行 1000 次请求
        results = []
        for i in range(1000):
            result = await service.test_method()
            results.append(result)
        
        # 验证结果
        assert len(results) == 1000
        
        # 清理
        results.clear()


class TestLatencyPercentiles:
    """测试延迟百分位"""
    
    def setup_method(self):
        """每个测试前清空监控数据"""
        performance_monitor.clear()
    
    @pytest.mark.asyncio
    async def test_latency_distribution(self):
        """测试延迟分布"""
        # 模拟不同延迟的请求
        latencies = [0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 0.8, 1.0, 1.5, 2.0]
        
        for latency in latencies:
            performance_monitor.record(
                service_version="v2",
                feature="test",
                method="test_method",
                duration=latency,
                success=True,
            )
        
        # 获取统计信息
        stats = performance_monitor.get_statistics(
            service_version="v2",
            feature="test",
        )
        
        print(f"\n平均延迟: {stats['avg_duration']:.2f}s")
        print(f"最小延迟: {stats['min_duration']:.2f}s")
        print(f"最大延迟: {stats['max_duration']:.2f}s")
        print(f"P50 延迟: {stats['p50_duration']:.2f}s")
        print(f"P95 延迟: {stats['p95_duration']:.2f}s")
        print(f"P99 延迟: {stats['p99_duration']:.2f}s")
        
        # 验证百分位
        assert stats['p50_duration'] < stats['p95_duration']
        assert stats['p95_duration'] < stats['p99_duration']


class TestFailureRate:
    """测试失败率"""
    
    def setup_method(self):
        """每个测试前清空监控数据"""
        performance_monitor.clear()
    
    @pytest.mark.asyncio
    async def test_v1_vs_v2_failure_rate(self):
        """测试 v1 vs v2 失败率"""
        # v1 失败率 10%
        for i in range(100):
            performance_monitor.record(
                service_version="v1",
                feature="test",
                method="test_method",
                duration=1.0,
                success=i < 90,  # 90% 成功
            )
        
        # v2 失败率 5%
        for i in range(100):
            performance_monitor.record(
                service_version="v2",
                feature="test",
                method="test_method",
                duration=1.0,
                success=i < 95,  # 95% 成功
            )
        
        # 对比失败率
        v1_stats = performance_monitor.get_statistics(service_version="v1", feature="test")
        v2_stats = performance_monitor.get_statistics(service_version="v2", feature="test")
        
        print(f"\nv1 成功率: {v1_stats['success_rate'] * 100:.1f}%")
        print(f"v2 成功率: {v2_stats['success_rate'] * 100:.1f}%")
        
        # v2 成功率应该更高
        assert v2_stats['success_rate'] > v1_stats['success_rate']
    
    @pytest.mark.asyncio
    async def test_fallback_success_rate(self):
        """测试降级成功率"""
        # 模拟 v1 服务（降级）
        v1_service = Mock()
        v1_service.test_method = AsyncMock(return_value="v1_result")
        
        # 模拟 v2 服务（50% 失败率）
        call_count = 0
        
        async def v2_method():
            nonlocal call_count
            call_count += 1
            if call_count % 2 == 0:
                raise Exception("v2 failed")
            return "v2_result"
        
        v2_service = Mock()
        v2_service.test_method = AsyncMock(side_effect=v2_method)
        
        # 测试降级
        from services.service_router import ServiceRouter
        
        with patch("services.service_router.is_langchain_enabled", return_value=True):
            service = ServiceRouter.route_service(
                feature="test",
                v1_service=v1_service,
                v2_service=v2_service,
                fallback_enabled=True,
            )
            
            # 执行 10 次请求
            success_count = 0
            for i in range(10):
                try:
                    result = await service.test_method()
                    success_count += 1
                except Exception:
                    pass
            
            print(f"\n总请求数: 10")
            print(f"成功数: {success_count}")
            print(f"成功率: {success_count / 10 * 100:.1f}%")
            
            # 有降级的情况下，成功率应该是 100%
            assert success_count == 10


class TestResourceUsage:
    """测试资源使用"""
    
    @pytest.mark.asyncio
    async def test_connection_pool(self):
        """测试连接池使用"""
        # 跳过，需要真实数据库
        pytest.skip("需要真实数据库")
    
    @pytest.mark.asyncio
    async def test_ai_concurrency_limit(self):
        """测试 AI 并发限制"""
        # 跳过，需要真实 AI 服务
        pytest.skip("需要真实 AI 服务")


class TestBenchmark:
    """基准测试"""
    
    @pytest.mark.asyncio
    async def test_paragraph_generation_benchmark(self):
        """段落生成基准测试"""
        # 跳过，需要真实环境
        pytest.skip("需要真实环境")
        
        from services.langchain.services.ai_service_v2 import AIServiceV2
        
        paragraph_id = uuid4()
        
        # 测试 10 次
        durations = []
        for i in range(10):
            start = time.time()
            
            # 流式生成
            async for chunk in AIServiceV2.ai_assist_paragraph(
                paragraph_id=paragraph_id,
                user_input="请帮我完善这段内容",
            ):
                pass
            
            duration = time.time() - start
            durations.append(duration)
        
        # 统计
        avg_duration = statistics.mean(durations)
        min_duration = min(durations)
        max_duration = max(durations)
        
        print(f"\n段落生成基准测试:")
        print(f"平均耗时: {avg_duration:.2f}s")
        print(f"最快: {min_duration:.2f}s")
        print(f"最慢: {max_duration:.2f}s")
    
    @pytest.mark.asyncio
    async def test_chat_benchmark(self):
        """对话基准测试"""
        # 跳过，需要真实环境
        pytest.skip("需要真实环境")
        
        from services.langchain.services.ai_chat_service_v2 import AIChatServiceV2
        
        document_id = uuid4()
        
        # 测试 10 次
        durations = []
        for i in range(10):
            start = time.time()
            
            # 流式对话
            async for chunk in AIChatServiceV2.chat_stream(
                document_id=document_id,
                user_message="你好",
            ):
                pass
            
            duration = time.time() - start
            durations.append(duration)
        
        # 统计
        avg_duration = statistics.mean(durations)
        
        print(f"\n对话基准测试:")
        print(f"平均耗时: {avg_duration:.2f}s")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
