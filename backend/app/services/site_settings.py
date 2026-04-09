import json
import re
from pathlib import Path
from threading import RLock

from app.services.sanitize import sanitize_text

_LOCK = RLock()
_FILE_PATH = Path(__file__).resolve().parents[1] / 'data' / 'site_settings.json'

DEFAULT_SITE_SETTINGS = {
    'showAppIcon': True,
    'legalDisclaimerShort': '本网站内容仅供参考，不构成法律、合规或专业意见。',
    'disclaimerNoAdviceNotice': '本网站不构成任何法律建议、合规建议或专业意见。用户在使用相关应用或作出决策前，应自行查阅官方隐私政策及相关法律文件。',
    'disclaimerAccuracyNotice': '尽管我们努力确保信息的准确性与及时性，但由于数据来源、自动分析及信息更新等因素，相关内容可能存在不完整、不准确或滞后的情况。本网站不对任何因依赖本网站内容而产生的直接或间接损失承担责任。',
    'disclaimerTrademarkNotice': '所有应用名称、商标及相关内容均归其各自权利人所有。本网站仅作信息性引用，不代表与相关公司存在任何关联、认可或合作关系。',
    'disclaimerRightsContactNotice': '如相关权利方认为本网站内容存在不准确或侵权情况，请通过指定渠道联系我们，我们将在核实后及时处理。',
    'dataSourceNotice': '本平台数据来源于公开可访问的应用隐私政策及相关页面，不涉及非公开数据采集。',
    'aiAnalysisNotice': '部分内容由人工智能生成，可能存在理解偏差，请结合原文判断。',
    'iconUsageNotice': '应用图标与商标归各自权利人所有，仅用于信息识别与引用，不代表合作、认可或官方背书。',
    'contactEmail': 'talconpro@outlook.com',
    'appealSlaDays': 3,
    'smtpEnabled': True,
    'smtpHost': '',
    'smtpPort': 587,
    'smtpUsername': '',
    'smtpPassword': '',
    'smtpSender': '',
    'smtpUseTls': True,
    'smtpUseSsl': False,
    'mailSubjectTemplate': '【AppSignal】申诉处理结果通知：{statusLabel}',
    'mailSignature': 'AppSignal 审核团队',
    'mailCcEnabled': False,
}

PUBLIC_SITE_SETTINGS_KEYS = {
    'showAppIcon',
    'legalDisclaimerShort',
    'disclaimerNoAdviceNotice',
    'disclaimerAccuracyNotice',
    'disclaimerTrademarkNotice',
    'disclaimerRightsContactNotice',
    'dataSourceNotice',
    'aiAnalysisNotice',
    'iconUsageNotice',
    'contactEmail',
    'appealSlaDays',
}


def _sanitize_email(value: str | None) -> str:
    text = sanitize_text(value, max_len=120)
    if not text:
        return DEFAULT_SITE_SETTINGS['contactEmail']
    if re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', text):
        return text
    return DEFAULT_SITE_SETTINGS['contactEmail']


def _normalize(raw: dict | None) -> dict:
    source = raw or {}
    appeal_sla_days = source.get('appealSlaDays', DEFAULT_SITE_SETTINGS['appealSlaDays'])
    try:
        appeal_sla_days = int(appeal_sla_days)
    except Exception:
        appeal_sla_days = DEFAULT_SITE_SETTINGS['appealSlaDays']
    appeal_sla_days = max(1, min(30, appeal_sla_days))

    smtp_port = source.get('smtpPort', DEFAULT_SITE_SETTINGS['smtpPort'])
    try:
        smtp_port = int(smtp_port)
    except Exception:
        smtp_port = DEFAULT_SITE_SETTINGS['smtpPort']
    smtp_port = max(1, min(65535, smtp_port))

    return {
        'showAppIcon': bool(source.get('showAppIcon', DEFAULT_SITE_SETTINGS['showAppIcon'])),
        'legalDisclaimerShort': sanitize_text(
            source.get('legalDisclaimerShort', DEFAULT_SITE_SETTINGS['legalDisclaimerShort']),
            max_len=300,
        )
        or DEFAULT_SITE_SETTINGS['legalDisclaimerShort'],
        'disclaimerNoAdviceNotice': sanitize_text(
            source.get('disclaimerNoAdviceNotice', DEFAULT_SITE_SETTINGS['disclaimerNoAdviceNotice']),
            max_len=1000,
        )
        or DEFAULT_SITE_SETTINGS['disclaimerNoAdviceNotice'],
        'disclaimerAccuracyNotice': sanitize_text(
            source.get('disclaimerAccuracyNotice', DEFAULT_SITE_SETTINGS['disclaimerAccuracyNotice']),
            max_len=1200,
        )
        or DEFAULT_SITE_SETTINGS['disclaimerAccuracyNotice'],
        'disclaimerTrademarkNotice': sanitize_text(
            source.get('disclaimerTrademarkNotice', DEFAULT_SITE_SETTINGS['disclaimerTrademarkNotice']),
            max_len=1000,
        )
        or DEFAULT_SITE_SETTINGS['disclaimerTrademarkNotice'],
        'disclaimerRightsContactNotice': sanitize_text(
            source.get('disclaimerRightsContactNotice', DEFAULT_SITE_SETTINGS['disclaimerRightsContactNotice']),
            max_len=1000,
        )
        or DEFAULT_SITE_SETTINGS['disclaimerRightsContactNotice'],
        'dataSourceNotice': sanitize_text(
            source.get('dataSourceNotice', DEFAULT_SITE_SETTINGS['dataSourceNotice']),
            max_len=600,
        )
        or DEFAULT_SITE_SETTINGS['dataSourceNotice'],
        'aiAnalysisNotice': sanitize_text(
            source.get('aiAnalysisNotice', DEFAULT_SITE_SETTINGS['aiAnalysisNotice']),
            max_len=600,
        )
        or DEFAULT_SITE_SETTINGS['aiAnalysisNotice'],
        'iconUsageNotice': sanitize_text(
            source.get('iconUsageNotice', DEFAULT_SITE_SETTINGS['iconUsageNotice']),
            max_len=600,
        )
        or DEFAULT_SITE_SETTINGS['iconUsageNotice'],
        'contactEmail': _sanitize_email(source.get('contactEmail')),
        'appealSlaDays': appeal_sla_days,
        'smtpEnabled': bool(source.get('smtpEnabled', DEFAULT_SITE_SETTINGS['smtpEnabled'])),
        'smtpHost': sanitize_text(source.get('smtpHost'), max_len=200),
        'smtpPort': smtp_port,
        'smtpUsername': sanitize_text(source.get('smtpUsername'), max_len=200),
        'smtpPassword': sanitize_text(source.get('smtpPassword'), max_len=300),
        'smtpSender': sanitize_text(source.get('smtpSender'), max_len=200),
        'smtpUseTls': bool(source.get('smtpUseTls', DEFAULT_SITE_SETTINGS['smtpUseTls'])),
        'smtpUseSsl': bool(source.get('smtpUseSsl', DEFAULT_SITE_SETTINGS['smtpUseSsl'])),
        'mailSubjectTemplate': sanitize_text(
            source.get('mailSubjectTemplate', DEFAULT_SITE_SETTINGS['mailSubjectTemplate']),
            max_len=300,
        )
        or DEFAULT_SITE_SETTINGS['mailSubjectTemplate'],
        'mailSignature': sanitize_text(
            source.get('mailSignature', DEFAULT_SITE_SETTINGS['mailSignature']),
            max_len=120,
        )
        or DEFAULT_SITE_SETTINGS['mailSignature'],
        'mailCcEnabled': bool(source.get('mailCcEnabled', DEFAULT_SITE_SETTINGS['mailCcEnabled'])),
    }


def _ensure_file():
    if _FILE_PATH.exists():
        return
    _FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _FILE_PATH.write_text(json.dumps(DEFAULT_SITE_SETTINGS, ensure_ascii=False, indent=2), encoding='utf-8')


def get_site_settings() -> dict:
    with _LOCK:
        _ensure_file()
        try:
            raw = json.loads(_FILE_PATH.read_text(encoding='utf-8'))
        except Exception:
            raw = {}
        normalized = _normalize(raw)
        if normalized != raw:
            _FILE_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding='utf-8')
        return normalized


def get_public_site_settings() -> dict:
    settings = get_site_settings()
    return {k: settings.get(k) for k in PUBLIC_SITE_SETTINGS_KEYS}


def update_site_settings(payload: dict) -> dict:
    with _LOCK:
        current = get_site_settings()
        merged = {
            **current,
            **{k: v for k, v in payload.items() if v is not None},
        }
        normalized = _normalize(merged)
        _FILE_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding='utf-8')
        return normalized
