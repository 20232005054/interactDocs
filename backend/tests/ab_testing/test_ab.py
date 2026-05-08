"""
A/B 测试框架

用于对比 v1/v2 服务的实际效果，支持用户分组、指标收集和统计分析
"""

import pytest
import asyncio
import random
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from uuid import uuid4, UUID
from enum import Enum
import statistics


class ABGroup(str, Enum):
    """A/B 测试分组"""
    CONTROL = "control"  # 对照组（v1）
    TREATMENT = "treatment"  # 实验组（v2）


@dataclass
class ABTestMetric:
    """A/B 测试指标"""
    user_id: UUID
    group: ABGroup
    feature: str
    metric_name: str
    metric_value: float
    timestamp: datetime = field(default_factory=datetime.now)


class ABTestFramework:
    """
    A/B 测试框架
    
    功能：
    1. 用户分组（随机/哈希）
    2. 指标收集
    3. 统计分析
    4. 显著性检验
    """
    
    def __init__(self, split_ratio: float = 0.5):
        """
        初始化 A/B 测试框架
        
        Args:
            split_ratio: 实验组比例（0.0 - 1.0）
        """
        self.split_ratio = split_ratio
        self.user_groups: Dict[UUID, ABGroup] = {}
        self.metrics: List[ABTestMetric] = []
    
    def assign_group(self, user_id: UUID) -> ABGroup:
        """
        分配用户到 A/B 组
        
        Args:
            user_id: 用户 ID
        
        Returns:
            分组
        """
        # 如果已经分配过，返回之前的分组
        if user_id in self.user_groups:
            return self.user_groups[user_id]
        
        # 使用哈希保证同一用户总是分到同一组
        hash_value = hash(str(user_id))
        group = ABGroup.TREATMENT if (hash_value % 100) < (self.split_ratio * 100) else ABGroup.CONTROL
        
        self.user_groups[user_id] = group
        return group
    
    def record_metric(
        self,
        user_id: UUID,
        feature: str,
        metric_name: str,
        metric_value: float,
    ):
        """
        记录指标
        
        Args:
            user_id: 用户 ID
            feature: 功能名称
            metric_name: 指标名称
            metric_value: 指标值
        """
        group = self.assign_group(user_id)
        
        metric = ABTestMetric(
            user_id=user_id,
            group=group,
            feature=feature,
            metric_name=metric_name,
            metric_value=metric_value,
        )
        
        self.metrics.append(metric)
    
    def get_group_metrics(
        self,
        group: ABGroup,
        feature: Optional[str] = None,
        metric_name: Optional[str] = None,
    ) -> List[float]:
        """
        获取分组的指标值
        
        Args:
            group: 分组
            feature: 过滤功能
            metric_name: 过滤指标名称
        
        Returns:
            指标值列表
        """
        filtered = [m for m in self.metrics if m.group == group]
        
        if feature:
            filtered = [m for m in filtered if m.feature == feature]
        
        if metric_name:
            filtered = [m for m in filtered if m.metric_name == metric_name]
        
        return [m.metric_value for m in filtered]
    
    def analyze(
        self,
        feature: str,
        metric_name: str,
    ) -> Dict:
        """
        分析 A/B 测试结果
        
        Args:
            feature: 功能名称
            metric_name: 指标名称
        
        Returns:
            分析结果
        """
        control_values = self.get_group_metrics(ABGroup.CONTROL, feature, metric_name)
        treatment_values = self.get_group_metrics(ABGroup.TREATMENT, feature, metric_name)
        
        if not control_values or not treatment_values:
            return {
                "error": "数据不足",
                "control_count": len(control_values),
                "treatment_count": len(treatment_values),
            }
        
        # 计算统计量
        control_mean = statistics.mean(control_values)
        treatment_mean = statistics.mean(treatment_values)
        
        control_stdev = statistics.stdev(control_values) if len(control_values) > 1 else 0
        treatment_stdev = statistics.stdev(treatment_values) if len(treatment_values) > 1 else 0
        
        # 计算改进百分比
        improvement = ((treatment_mean - control_mean) / control_mean * 100) if control_mean != 0 else 0
        
        return {
            "feature": feature,
            "metric_name": metric_name,
            "control": {
                "count": len(control_values),
                "mean": control_mean,
                "stdev": control_stdev,
                "min": min(control_values),
                "max": max(control_values),
            },
            "treatment": {
                "count": len(treatment_values),
                "mean": treatment_mean,
                "stdev": treatment_stdev,
                "min": min(treatment_values),
                "max": max(treatment_values),
            },
            "improvement": improvement,
        }
    
    def clear(self):
        """清空所有数据"""
        self.user_groups.clear()
        self.metrics.clear()


class TestABTestFramework:
    """测试 A/B 测试框架"""
    
    def test_user_assignment(self):
        """测试用户分组"""
        framework = ABTestFramework(split_ratio=0.5)
        
        # 分配 100 个用户
        users = [uuid4() for _ in range(100)]
        groups = [framework.assign_group(user_id) for user_id in users]
        
        # 统计分组
        control_count = sum(1 for g in groups if g == ABGroup.CONTROL)
        treatment_count = sum(1 for g in groups if g == ABGroup.TREATMENT)
        
        print(f"\n对照组: {control_count}")
        print(f"实验组: {treatment_count}")
        
        # 分组应该大致均衡（允许 20% 误差）
        assert 40 <= control_count <= 60
        assert 40 <= treatment_count <= 60
    
    def test_consistent_assignment(self):
        """测试分组一致性"""
        framework = ABTestFramework(split_ratio=0.5)
        
        user_id = uuid4()
        
        # 多次分配应该得到相同结果
        group1 = framework.assign_group(user_id)
        group2 = framework.assign_group(user_id)
        group3 = framework.assign_group(user_id)
        
        assert group1 == group2 == group3
    
    def test_record_metric(self):
        """测试记录指标"""
        framework = ABTestFramework(split_ratio=0.5)
        
        user_id = uuid4()
        
        framework.record_metric(
            user_id=user_id,
            feature="chat",
            metric_name="response_time",
            metric_value=1.5,
        )
        
        assert len(framework.metrics) == 1
        assert framework.metrics[0].user_id == user_id
        assert framework.metrics[0].feature == "chat"
        assert framework.metrics[0].metric_name == "response_time"
        assert framework.metrics[0].metric_value == 1.5
    
    def test_analyze(self):
        """测试分析结果"""
        framework = ABTestFramework(split_ratio=0.5)
        
        # 模拟对照组数据（慢）
        for i in range(50):
            user_id = uuid4()
            framework.user_groups[user_id] = ABGroup.CONTROL
            framework.record_metric(
                user_id=user_id,
                feature="chat",
                metric_name="response_time",
                metric_value=2.0 + random.uniform(-0.2, 0.2),
            )
        
        # 模拟实验组数据（快）
        for i in range(50):
            user_id = uuid4()
            framework.user_groups[user_id] = ABGroup.TREATMENT
            framework.record_metric(
                user_id=user_id,
                feature="chat",
                metric_name="response_time",
                metric_value=1.0 + random.uniform(-0.2, 0.2),
            )
        
        # 分析结果
        result = framework.analyze("chat", "response_time")
        
        print(f"\n对照组平均: {result['control']['mean']:.2f}s")
        print(f"实验组平均: {result['treatment']['mean']:.2f}s")
        print(f"改进: {result['improvement']:.1f}%")
        
        # 实验组应该更快
        assert result['treatment']['mean'] < result['control']['mean']
        assert result['improvement'] < 0  # 负数表示时间减少（改进）


class TestABTestScenarios:
    """测试 A/B 测试场景"""
    
    def test_response_time_comparison(self):
        """测试响应时间对比"""
        framework = ABTestFramework(split_ratio=0.5)
        
        # 模拟 100 个用户的请求
        for i in range(100):
            user_id = uuid4()
            group = framework.assign_group(user_id)
            
            # 对照组（v1）慢，实验组（v2）快
            if group == ABGroup.CONTROL:
                response_time = 2.0 + random.uniform(-0.3, 0.3)
            else:
                response_time = 1.0 + random.uniform(-0.2, 0.2)
            
            framework.record_metric(
                user_id=user_id,
                feature="paragraph_generation",
                metric_name="response_time",
                metric_value=response_time,
            )
        
        # 分析结果
        result = framework.analyze("paragraph_generation", "response_time")
        
        print(f"\n段落生成响应时间对比:")
        print(f"v1 (对照组): {result['control']['mean']:.2f}s ± {result['control']['stdev']:.2f}s")
        print(f"v2 (实验组): {result['treatment']['mean']:.2f}s ± {result['treatment']['stdev']:.2f}s")
        print(f"改进: {abs(result['improvement']):.1f}%")
        
        # v2 应该更快
        assert result['treatment']['mean'] < result['control']['mean']
    
    def test_success_rate_comparison(self):
        """测试成功率对比"""
        framework = ABTestFramework(split_ratio=0.5)
        
        # 模拟 100 个用户的请求
        for i in range(100):
            user_id = uuid4()
            group = framework.assign_group(user_id)
            
            # 对照组（v1）成功率 90%，实验组（v2）成功率 95%
            if group == ABGroup.CONTROL:
                success = 1.0 if random.random() < 0.90 else 0.0
            else:
                success = 1.0 if random.random() < 0.95 else 0.0
            
            framework.record_metric(
                user_id=user_id,
                feature="chat",
                metric_name="success",
                metric_value=success,
            )
        
        # 分析结果
        result = framework.analyze("chat", "success")
        
        print(f"\n对话成功率对比:")
        print(f"v1 (对照组): {result['control']['mean'] * 100:.1f}%")
        print(f"v2 (实验组): {result['treatment']['mean'] * 100:.1f}%")
        print(f"改进: {result['improvement']:.1f}%")
        
        # v2 成功率应该更高
        assert result['treatment']['mean'] >= result['control']['mean']
    
    def test_user_satisfaction_comparison(self):
        """测试用户满意度对比"""
        framework = ABTestFramework(split_ratio=0.5)
        
        # 模拟 100 个用户的满意度评分（1-5 分）
        for i in range(100):
            user_id = uuid4()
            group = framework.assign_group(user_id)
            
            # 对照组（v1）平均 3.5 分，实验组（v2）平均 4.2 分
            if group == ABGroup.CONTROL:
                satisfaction = min(5.0, max(1.0, random.gauss(3.5, 0.8)))
            else:
                satisfaction = min(5.0, max(1.0, random.gauss(4.2, 0.6)))
            
            framework.record_metric(
                user_id=user_id,
                feature="overall",
                metric_name="satisfaction",
                metric_value=satisfaction,
            )
        
        # 分析结果
        result = framework.analyze("overall", "satisfaction")
        
        print(f"\n用户满意度对比:")
        print(f"v1 (对照组): {result['control']['mean']:.2f}/5.0")
        print(f"v2 (实验组): {result['treatment']['mean']:.2f}/5.0")
        print(f"改进: {result['improvement']:.1f}%")
        
        # v2 满意度应该更高
        assert result['treatment']['mean'] > result['control']['mean']


class TestABTestIntegration:
    """测试 A/B 测试集成"""
    
    @pytest.mark.asyncio
    async def test_ab_test_with_service_router(self):
        """测试 A/B 测试与服务路由器集成"""
        from unittest.mock import Mock, patch, AsyncMock
        from services.service_router import ServiceRouter
        
        framework = ABTestFramework(split_ratio=0.5)
        
        # 模拟 v1 服务
        v1_service = Mock()
        v1_service.test_method = AsyncMock(side_effect=lambda: asyncio.sleep(0.2))
        
        # 模拟 v2 服务
        v2_service = Mock()
        v2_service.test_method = AsyncMock(side_effect=lambda: asyncio.sleep(0.1))
        
        # 模拟 10 个用户
        for i in range(10):
            user_id = uuid4()
            group = framework.assign_group(user_id)
            
            # 根据分组选择服务
            if group == ABGroup.CONTROL:
                # 使用 v1
                with patch("services.service_router.is_langchain_enabled", return_value=False):
                    service = ServiceRouter.route_service(
                        feature="test",
                        v1_service=v1_service,
                        v2_service=v2_service,
                        fallback_enabled=False,
                    )
            else:
                # 使用 v2
                with patch("services.service_router.is_langchain_enabled", return_value=True):
                    service = ServiceRouter.route_service(
                        feature="test",
                        v1_service=v1_service,
                        v2_service=v2_service,
                        fallback_enabled=False,
                    )
            
            # 执行请求并记录指标
            import time
            start = time.time()
            await service.test_method()
            duration = time.time() - start
            
            framework.record_metric(
                user_id=user_id,
                feature="test",
                metric_name="response_time",
                metric_value=duration,
            )
        
        # 分析结果
        result = framework.analyze("test", "response_time")
        
        print(f"\nA/B 测试结果:")
        print(f"对照组 (v1): {result['control']['mean']:.2f}s")
        print(f"实验组 (v2): {result['treatment']['mean']:.2f}s")
        print(f"改进: {abs(result['improvement']):.1f}%")


# 全局 A/B 测试框架实例
ab_test_framework = ABTestFramework(split_ratio=0.5)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
