"""
变更检测服务

职责：
1. 统一的内容变更检测逻辑
2. 基于 embedding 的语义相似度判断
3. 可配置的相似度阈值
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class ChangeDetectionService:
    """内容变更检测服务"""
    
    # 相似度阈值：低于此值认为是实质性变更
    SIMILARITY_THRESHOLD = 0.92
    
    @staticmethod
    async def is_substantial_change(
        old_content: str,
        new_content: str,
        threshold: Optional[float] = None,
    ) -> bool:
        """
        判断内容是否发生实质性变更
        
        策略：
        1. 空内容判断：任一为空则认为有变更
        2. 字符串完全相同：无变更
        3. embedding 相似度：低于阈值则有变更
        4. 降级策略：embedding 失败时用字符串比较
        
        Args:
            old_content: 旧内容
            new_content: 新内容
            threshold: 自定义阈值（可选，默认使用类属性）
            
        Returns:
            True 表示有实质性变更，False 表示无变更
        """
        threshold = threshold or ChangeDetectionService.SIMILARITY_THRESHOLD
        
        # 空内容判断
        if not old_content.strip() or not new_content.strip():
            logger.info("内容为空，判定为有变更")
            return True
        
        # 字符串完全相同
        if old_content.strip() == new_content.strip():
            logger.info("内容完全相同，判定为无变更")
            return False
        
        # embedding 相似度判断
        try:
            from services.ai_client import get_embedding, cosine_similarity
            
            vec_old = await get_embedding(old_content)
            vec_new = await get_embedding(new_content)
            similarity = await cosine_similarity(vec_old, vec_new)
            
            is_changed = similarity <= threshold
            
            logger.info(
                "embedding 相似度判断: similarity=%.4f, threshold=%.2f, is_changed=%s",
                similarity, threshold, is_changed
            )
            
            return is_changed
            
        except Exception as e:
            logger.warning(
                "embedding 判断失败，降级为字符串比较: %s",
                e,
                exc_info=True
            )
            # 降级策略：字符串比较
            is_changed = old_content.strip() != new_content.strip()
            logger.info("字符串比较结果: is_changed=%s", is_changed)
            return is_changed
    
    @staticmethod
    def set_threshold(threshold: float) -> None:
        """
        动态设置相似度阈值（用于 A/B 测试或运行时调整）
        
        Args:
            threshold: 新的阈值（0-1 之间）
        """
        if not 0 <= threshold <= 1:
            raise ValueError(f"阈值必须在 0-1 之间，当前值: {threshold}")
        
        old_threshold = ChangeDetectionService.SIMILARITY_THRESHOLD
        ChangeDetectionService.SIMILARITY_THRESHOLD = threshold
        
        logger.info(
            "相似度阈值已更新: %.2f -> %.2f",
            old_threshold,
            threshold
        )
