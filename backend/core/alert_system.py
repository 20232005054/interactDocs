"""
告警系统

监控关键指标，触发告警
"""

import logging
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


logger = logging.getLogger(__name__)


class AlertLevel(str, Enum):
    """告警级别"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class AlertType(str, Enum):
    """告警类型"""
    HIGH_ERROR_RATE = "high_error_rate"
    SLOW_RESPONSE = "slow_response"
    HIGH_LATENCY = "high_latency"
    SERVICE_DOWN = "service_down"
    QUOTA_EXCEEDED = "quota_exceeded"
    CUSTOM = "custom"


@dataclass
class Alert:
    """告警"""
    alert_type: AlertType
    level: AlertLevel
    message: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    resolved: bool = False
    resolved_at: Optional[datetime] = None


class AlertRule:
    """
    告警规则
    
    定义触发条件和告警行为
    """
    
    def __init__(
        self,
        name: str,
        alert_type: AlertType,
        level: AlertLevel,
        condition: Callable[[Dict[str, Any]], bool],
        message_template: str,
        cooldown_seconds: int = 300,  # 冷却时间（秒）
    ):
        self.name = name
        self.alert_type = alert_type
        self.level = level
        self.condition = condition
        self.message_template = message_template
        self.cooldown_seconds = cooldown_seconds
        self.last_triggered: Optional[datetime] = None
    
    def check(self, metrics: Dict[str, Any]) -> Optional[Alert]:
        """
        检查规则
        
        Args:
            metrics: 指标数据
        
        Returns:
            告警对象，如果不触发则返回 None
        """
        # 检查冷却时间
        if self.last_triggered:
            elapsed = (datetime.now() - self.last_triggered).total_seconds()
            if elapsed < self.cooldown_seconds:
                return None
        
        # 检查条件
        if self.condition(metrics):
            self.last_triggered = datetime.now()
            
            # 生成告警消息
            message = self.message_template.format(**metrics)
            
            return Alert(
                alert_type=self.alert_type,
                level=self.level,
                message=message,
                metadata=metrics,
            )
        
        return None


class AlertSystem:
    """
    告警系统
    
    功能：
    1. 注册告警规则
    2. 检查指标触发告警
    3. 记录告警历史
    4. 发送告警通知
    """
    
    def __init__(self):
        self.rules: List[AlertRule] = []
        self.alerts: List[Alert] = []
        self.max_alerts = 1000
        
        # 注册默认规则
        self._register_default_rules()
    
    def _register_default_rules(self):
        """注册默认告警规则"""
        # 高错误率告警
        self.register_rule(
            AlertRule(
                name="高错误率",
                alert_type=AlertType.HIGH_ERROR_RATE,
                level=AlertLevel.ERROR,
                condition=lambda m: m.get("failure_rate", 0) > 0.1,  # 错误率 > 10%
                message_template="错误率过高: {failure_rate:.1%}，总调用数: {total_calls}",
                cooldown_seconds=300,
            )
        )
        
        # 慢响应告警
        self.register_rule(
            AlertRule(
                name="慢响应",
                alert_type=AlertType.SLOW_RESPONSE,
                level=AlertLevel.WARNING,
                condition=lambda m: m.get("avg_duration_ms", 0) > 5000,  # 平均响应时间 > 5s
                message_template="平均响应时间过长: {avg_duration_ms:.0f}ms",
                cooldown_seconds=300,
            )
        )
        
        # 高延迟告警
        self.register_rule(
            AlertRule(
                name="高延迟",
                alert_type=AlertType.HIGH_LATENCY,
                level=AlertLevel.WARNING,
                condition=lambda m: m.get("p95_duration_ms", 0) > 10000,  # P95 > 10s
                message_template="P95 延迟过高: {p95_duration_ms:.0f}ms",
                cooldown_seconds=300,
            )
        )
    
    def register_rule(self, rule: AlertRule):
        """
        注册告警规则
        
        Args:
            rule: 告警规则
        """
        self.rules.append(rule)
        logger.info(f"[告警系统] 注册规则: {rule.name}")
    
    def check_metrics(self, operation: str, metrics: Dict[str, Any]) -> List[Alert]:
        """
        检查指标并触发告警
        
        Args:
            operation: 操作名称
            metrics: 指标数据
        
        Returns:
            触发的告警列表
        """
        triggered_alerts = []
        
        for rule in self.rules:
            alert = rule.check(metrics)
            if alert:
                # 添加操作名称到元数据
                alert.metadata["operation"] = operation
                
                # 记录告警
                self.alerts.append(alert)
                triggered_alerts.append(alert)
                
                # 限制告警数量
                if len(self.alerts) > self.max_alerts:
                    self.alerts = self.alerts[-self.max_alerts:]
                
                # 记录日志
                logger.warning(
                    f"[告警] {rule.name} - {alert.message} "
                    f"operation={operation} level={alert.level}"
                )
                
                # 发送通知
                self._send_notification(alert)
        
        return triggered_alerts
    
    def _send_notification(self, alert: Alert):
        """
        发送告警通知
        
        Args:
            alert: 告警对象
        """
        # 记录日志（始终执行）
        logger.info(f"[告警通知] {alert.level.upper()}: {alert.message}")
        
        # 根据告警级别选择通知渠道
        try:
            if alert.level in (AlertLevel.CRITICAL, AlertLevel.ERROR):
                # 严重告警：发送到所有渠道
                self._send_email_notification(alert)
                self._send_webhook_notification(alert)
            elif alert.level == AlertLevel.WARNING:
                # 警告：只发送 webhook
                self._send_webhook_notification(alert)
            # INFO 级别只记录日志
        except Exception as e:
            logger.error(f"[告警通知] 发送失败: {e}", exc_info=True)
    
    def _send_email_notification(self, alert: Alert):
        """
        发送邮件通知
        
        Args:
            alert: 告警对象
        """
        # 检查是否配置了邮件
        from core.config import ALERT_EMAIL_ENABLED, ALERT_EMAIL_TO
        
        if not ALERT_EMAIL_ENABLED:
            return
        
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            from core.config import (
                ALERT_EMAIL_HOST, ALERT_EMAIL_PORT,
                ALERT_EMAIL_USER, ALERT_EMAIL_PASSWORD,
                ALERT_EMAIL_FROM
            )
            
            # 构建邮件
            msg = MIMEMultipart()
            msg['From'] = ALERT_EMAIL_FROM
            msg['To'] = ALERT_EMAIL_TO
            msg['Subject'] = f"[{alert.level.upper()}] {alert.alert_type.value}"
            
            # 邮件正文
            body = f"""
告警级别：{alert.level.upper()}
告警类型：{alert.alert_type.value}
告警时间：{alert.timestamp.strftime('%Y-%m-%d %H:%M:%S')}

告警信息：
{alert.message}

详细数据：
{self._format_metadata(alert.metadata)}
"""
            msg.attach(MIMEText(body, 'plain', 'utf-8'))
            
            # 发送邮件
            with smtplib.SMTP(ALERT_EMAIL_HOST, ALERT_EMAIL_PORT) as server:
                server.starttls()
                server.login(ALERT_EMAIL_USER, ALERT_EMAIL_PASSWORD)
                server.send_message(msg)
            
            logger.info(f"[告警通知] 邮件发送成功: {ALERT_EMAIL_TO}")
        
        except Exception as e:
            logger.error(f"[告警通知] 邮件发送失败: {e}")
    
    def _send_webhook_notification(self, alert: Alert):
        """
        发送 Webhook 通知（钉钉、Slack、企业微信等）
        
        Args:
            alert: 告警对象
        """
        from core.config import ALERT_WEBHOOK_ENABLED, ALERT_WEBHOOK_URL, ALERT_WEBHOOK_TYPE
        
        if not ALERT_WEBHOOK_ENABLED:
            return
        
        try:
            import httpx
            
            # 根据 webhook 类型构建不同的消息格式
            if ALERT_WEBHOOK_TYPE == "dingtalk":
                payload = self._build_dingtalk_payload(alert)
            elif ALERT_WEBHOOK_TYPE == "slack":
                payload = self._build_slack_payload(alert)
            elif ALERT_WEBHOOK_TYPE == "wecom":
                payload = self._build_wecom_payload(alert)
            else:
                # 通用格式
                payload = {
                    "level": alert.level.value,
                    "type": alert.alert_type.value,
                    "message": alert.message,
                    "timestamp": alert.timestamp.isoformat(),
                    "metadata": alert.metadata,
                }
            
            # 发送请求
            response = httpx.post(
                ALERT_WEBHOOK_URL,
                json=payload,
                timeout=5.0
            )
            response.raise_for_status()
            
            logger.info(f"[告警通知] Webhook 发送成功: {ALERT_WEBHOOK_TYPE}")
        
        except Exception as e:
            logger.error(f"[告警通知] Webhook 发送失败: {e}")
    
    def _build_dingtalk_payload(self, alert: Alert) -> dict:
        """构建钉钉消息格式"""
        return {
            "msgtype": "markdown",
            "markdown": {
                "title": f"[{alert.level.upper()}] 系统告警",
                "text": f"""### [{alert.level.upper()}] {alert.alert_type.value}

**告警时间：** {alert.timestamp.strftime('%Y-%m-%d %H:%M:%S')}

**告警信息：**
{alert.message}

**详细数据：**
```
{self._format_metadata(alert.metadata)}
```
"""
            }
        }
    
    def _build_slack_payload(self, alert: Alert) -> dict:
        """构建 Slack 消息格式"""
        color = {
            AlertLevel.INFO: "#36a64f",
            AlertLevel.WARNING: "#ff9900",
            AlertLevel.ERROR: "#ff0000",
            AlertLevel.CRITICAL: "#8b0000",
        }.get(alert.level, "#808080")
        
        return {
            "attachments": [
                {
                    "color": color,
                    "title": f"[{alert.level.upper()}] {alert.alert_type.value}",
                    "text": alert.message,
                    "fields": [
                        {
                            "title": "告警时间",
                            "value": alert.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                            "short": True
                        },
                        {
                            "title": "详细数据",
                            "value": f"```{self._format_metadata(alert.metadata)}```",
                            "short": False
                        }
                    ],
                    "footer": "InteractiveDocs 告警系统",
                    "ts": int(alert.timestamp.timestamp())
                }
            ]
        }
    
    def _build_wecom_payload(self, alert: Alert) -> dict:
        """构建企业微信消息格式"""
        return {
            "msgtype": "markdown",
            "markdown": {
                "content": f"""### [{alert.level.upper()}] 系统告警

> 类型：{alert.alert_type.value}
> 时间：{alert.timestamp.strftime('%Y-%m-%d %H:%M:%S')}

**告警信息：**
{alert.message}

**详细数据：**
```
{self._format_metadata(alert.metadata)}
```
"""
            }
        }
    
    def _format_metadata(self, metadata: Dict[str, Any]) -> str:
        """格式化元数据为可读字符串"""
        lines = []
        for key, value in metadata.items():
            if isinstance(value, float):
                lines.append(f"{key}: {value:.2f}")
            else:
                lines.append(f"{key}: {value}")
        return "\n".join(lines)
    
    def get_active_alerts(self, level: Optional[AlertLevel] = None) -> List[Alert]:
        """
        获取活跃告警
        
        Args:
            level: 过滤告警级别
        
        Returns:
            告警列表
        """
        alerts = [a for a in self.alerts if not a.resolved]
        
        if level:
            alerts = [a for a in alerts if a.level == level]
        
        return alerts
    
    def get_alert_history(
        self,
        limit: int = 50,
        alert_type: Optional[AlertType] = None,
    ) -> List[Alert]:
        """
        获取告警历史
        
        Args:
            limit: 返回数量
            alert_type: 过滤告警类型
        
        Returns:
            告警列表
        """
        alerts = self.alerts
        
        if alert_type:
            alerts = [a for a in alerts if a.alert_type == alert_type]
        
        return alerts[-limit:]
    
    def resolve_alert(self, alert: Alert):
        """
        解决告警
        
        Args:
            alert: 告警对象
        """
        alert.resolved = True
        alert.resolved_at = datetime.now()
        logger.info(f"[告警] 已解决: {alert.message}")
    
    def clear_alerts(self):
        """清空所有告警"""
        self.alerts.clear()
        logger.info("[告警系统] 已清空所有告警")


# 全局告警系统实例
alert_system = AlertSystem()


def check_and_alert(operation: str, metrics: Dict[str, Any]) -> List[Alert]:
    """
    检查指标并触发告警
    
    Args:
        operation: 操作名称
        metrics: 指标数据
    
    Returns:
        触发的告警列表
    """
    return alert_system.check_metrics(operation, metrics)


def get_active_alerts(level: Optional[AlertLevel] = None) -> List[Alert]:
    """获取活跃告警"""
    return alert_system.get_active_alerts(level)


def get_alert_history(limit: int = 50, alert_type: Optional[AlertType] = None) -> List[Alert]:
    """获取告警历史"""
    return alert_system.get_alert_history(limit, alert_type)
