from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.core.config import settings
from app.services.site_settings import get_site_settings

STATUS_LABELS = {
    'resolved': '已解决',
    'rejected': '已驳回',
    'processing': '处理中',
    'pending': '待处理',
}


def _to_bool(value, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    text = str(value).strip().lower()
    if text in {'1', 'true', 'yes', 'on'}:
        return True
    if text in {'0', 'false', 'no', 'off'}:
        return False
    return default


def _resolve_mail_config() -> dict:
    data = get_site_settings()

    smtp_enabled = _to_bool(data.get('smtpEnabled'), True)
    smtp_host = str(data.get('smtpHost') or settings.smtp_host or '').strip()
    smtp_sender = str(data.get('smtpSender') or settings.smtp_sender or '').strip()
    smtp_username = str(data.get('smtpUsername') or settings.smtp_username or '').strip()
    smtp_password = str(data.get('smtpPassword') or settings.smtp_password or '').strip()

    smtp_port_raw = data.get('smtpPort', settings.smtp_port)
    try:
        smtp_port = int(smtp_port_raw)
    except Exception:
        smtp_port = settings.smtp_port
    smtp_port = max(1, min(65535, smtp_port))

    smtp_use_tls = _to_bool(data.get('smtpUseTls'), settings.smtp_use_tls)
    smtp_use_ssl = _to_bool(data.get('smtpUseSsl'), settings.smtp_use_ssl)
    subject_template = str(data.get('mailSubjectTemplate') or '【AppSignal】申诉处理结果通知：{statusLabel}').strip()
    signature = str(data.get('mailSignature') or 'AppSignal 审核团队').strip()
    cc_enabled = _to_bool(data.get('mailCcEnabled'), False)
    contact_email = str(data.get('contactEmail') or '').strip()

    return {
        'enabled': smtp_enabled,
        'host': smtp_host,
        'port': smtp_port,
        'sender': smtp_sender,
        'username': smtp_username,
        'password': smtp_password,
        'use_tls': smtp_use_tls,
        'use_ssl': smtp_use_ssl,
        'subject_template': subject_template,
        'signature': signature,
        'cc_enabled': cc_enabled,
        'contact_email': contact_email,
    }


def _email_config_ready(config: dict) -> tuple[bool, str]:
    if not config.get('enabled'):
        return False, 'SMTP 通知已关闭'
    if not config.get('host'):
        return False, 'SMTP_HOST 未配置'
    if not config.get('sender'):
        return False, 'SMTP_SENDER 未配置'
    return True, ''


def _render_template(template: str, variables: dict[str, str]) -> str:
    text = template or ''
    for key, value in variables.items():
        text = text.replace(f'{{{key}}}', value)
    return text


def send_appeal_status_email(
    *,
    to_email: str,
    app_name: str,
    ticket_id: str,
    status: str,
    admin_note: str | None = None,
) -> dict:
    config = _resolve_mail_config()
    ready, reason = _email_config_ready(config)
    if not ready:
        return {'attempted': False, 'sent': False, 'message': reason}

    subject_status = STATUS_LABELS.get(status, status or '状态已更新')
    variables = {
        'appName': app_name,
        'ticketId': ticket_id,
        'status': status,
        'statusLabel': subject_status,
    }
    subject = _render_template(config.get('subject_template') or '', variables).strip()
    if not subject:
        subject = f'【AppSignal】申诉处理结果通知：{subject_status}'

    message = EmailMessage()
    message['Subject'] = subject
    message['From'] = config['sender']
    message['To'] = to_email

    cc_target = ''
    if config.get('cc_enabled'):
        candidate = str(config.get('contact_email') or '').strip()
        if candidate and candidate.lower() != to_email.lower():
            cc_target = candidate
            message['Cc'] = cc_target

    note_text = admin_note.strip() if admin_note else '无'
    signature = config.get('signature') or 'AppSignal 审核团队'
    body = (
        f'您好，\n\n'
        f'您提交的申诉工单已更新。\n'
        f'工单编号：{ticket_id}\n'
        f'应用名称：{app_name}\n'
        f'处理结果：{subject_status}\n'
        f'管理员备注：{note_text}\n\n'
        f'如对结果有疑问，欢迎继续通过申诉通道补充说明。\n\n'
        f'{signature}\n'
    )
    message.set_content(body)

    try:
        if config['use_ssl']:
            with smtplib.SMTP_SSL(config['host'], config['port'], timeout=15) as server:
                if config['username']:
                    server.login(config['username'], config['password'])
                server.send_message(message)
        else:
            with smtplib.SMTP(config['host'], config['port'], timeout=15) as server:
                if config['use_tls']:
                    server.starttls()
                if config['username']:
                    server.login(config['username'], config['password'])
                server.send_message(message)
        result_message = '邮件发送成功'
        if cc_target:
            result_message += f'（已抄送 {cc_target}）'
        return {'attempted': True, 'sent': True, 'message': result_message}
    except Exception as exc:
        return {'attempted': True, 'sent': False, 'message': str(exc)}
