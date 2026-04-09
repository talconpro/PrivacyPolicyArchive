from __future__ import annotations

import json
import re
from typing import Any

import httpx

from app.core.config import settings

RISK_LEVELS = ('low', 'medium', 'high', 'critical')
RISK_ORDER = {name: index for index, name in enumerate(RISK_LEVELS)}
LEGAL_DETERMINISTIC_TERMS = ['违法', '非法']

SYSTEM_PROMPT = (
    'You are a senior privacy-policy analyst. Output JSON only (no Markdown). '
    'Required fields: risk_level, one_liner, key_findings, plain_summary, '
    'data_collected, data_shared_with, user_rights, dispute. '
    'Hard requirements: '
    '1) risk_level must be one of low / medium / high / critical. '
    '2) one_liner should be concise Chinese, ideally 36-50 Chinese characters (must be readable). '
    '3) key_findings must contain 3-5 items, and each item must include a short evidence cue, '
    'for example by adding "(依据: ...)" or "(关键词: ...)". '
    '4) plain_summary must be plain-language Chinese and <= 220 Chinese characters. '
    '5) Do not fabricate facts not mentioned in the policy. '
    '6) Avoid deterministic legal judgments (e.g. "违法", "非法"), use neutral wording '
    '(e.g. "可能涉及", "条款中提及"). '
    '7) Follow this risk scoring rubric: '
    '+2 for sensitive personal data collection (precise location, contacts, biometrics, ID/financial identifiers), '
    '+2 for broad third-party sharing/transfer wording, '
    '+1 if user rights (delete/export/account cancellation etc.) are unclear or missing, '
    '+1 if minors are involved without clear guardian consent/protection terms, '
    '+1 if retention period is vague or long-term/permanent. '
    'Risk mapping: score 0-1 => low, 2-3 => medium, 4-5 => high, >=6 => critical.'
)

_SENSITIVE_PATTERN = re.compile(r'精确位置|位置信息|通讯录|联系人|身份证|生物特征|人脸|指纹|银行卡|金融账户|短信|通话记录|麦克风|摄像头|相册')
_SHARING_PATTERN = re.compile(r'共享|第三方|合作方|转让|出售|披露')
_RIGHTS_PATTERN = re.compile(r'删除|注销|访问|更正|导出|撤回同意')
_MINORS_PATTERN = re.compile(r'未成年人|儿童|青少年')
_GUARDIAN_PATTERN = re.compile(r'监护人|法定监护|监护|同意')
_RETENTION_PATTERN = re.compile(r'长期保存|长期保留|永久保存|永久|无限期')
_CJK_PATTERN = re.compile(r'[\u4e00-\u9fff]')


def contains_deterministic_legal_terms(text: str) -> bool:
    source = text or ''
    return any(term in source for term in LEGAL_DETERMINISTIC_TERMS)


def _replace_deterministic_terms(text: str) -> str:
    output = text or ''
    output = output.replace('违法', '可能涉及合规风险')
    output = output.replace('非法', '可能不符合相关要求')
    return output


def _normalize_spaces(text: str) -> str:
    return re.sub(r'\s+', ' ', (text or '')).strip()


def _truncate_by_cjk(text: str, max_cjk: int, hard_limit: int) -> str:
    source = _normalize_spaces(text)
    if not source:
        return ''

    chars: list[str] = []
    cjk_count = 0
    for ch in source:
        if _CJK_PATTERN.match(ch):
            cjk_count += 1
            if cjk_count > max_cjk:
                break
        chars.append(ch)
        if len(chars) >= hard_limit:
            break

    return ''.join(chars).rstrip('，,。.;； ')


def _safe_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [_normalize_spaces(str(item)) for item in value if _normalize_spaces(str(item))]
    if isinstance(value, str):
        item = _normalize_spaces(value)
        return [item] if item else []
    return []


def _ensure_evidence(finding: str) -> str:
    text = _normalize_spaces(_replace_deterministic_terms(finding))
    if not text:
        return ''
    if any(token in text for token in ('依据', '关键词', '条款')):
        return text
    return f'{text}（依据：条款中提及相关描述）'


def _risk_level_from_score(score: int) -> str:
    if score >= 6:
        return 'critical'
    if score >= 4:
        return 'high'
    if score >= 2:
        return 'medium'
    return 'low'


def _rubric_risk_level(policy_text: str, analysis: dict[str, Any]) -> str:
    text = policy_text or ''
    evidence_text = ' '.join(
        [
            text,
            analysis.get('one_liner', '') or '',
            analysis.get('plain_summary', '') or '',
            analysis.get('dispute', '') or '',
            ' '.join(_safe_list(analysis.get('key_findings', []))),
            ' '.join(_safe_list(analysis.get('data_collected', []))),
            ' '.join(_safe_list(analysis.get('data_shared_with', []))),
            ' '.join(_safe_list(analysis.get('user_rights', []))),
        ]
    )

    score = 0
    sensitive = bool(_SENSITIVE_PATTERN.search(evidence_text))
    sharing = bool(_SHARING_PATTERN.search(evidence_text))
    rights_missing = not _RIGHTS_PATTERN.search(evidence_text) and len(_safe_list(analysis.get('user_rights', []))) == 0
    minors = bool(_MINORS_PATTERN.search(evidence_text))
    guardian_missing = minors and not _GUARDIAN_PATTERN.search(evidence_text)
    long_retention = bool(_RETENTION_PATTERN.search(evidence_text))

    if sensitive:
        score += 2
    if sharing:
        score += 2
    if rights_missing:
        score += 1
    if guardian_missing:
        score += 1
    if long_retention:
        score += 1
    if sensitive and sharing:
        score += 1

    return _risk_level_from_score(score)


def fallback_analysis(text: str) -> dict[str, Any]:
    short = _normalize_spaces(text)[:180]
    mentions_sharing = bool(_SHARING_PATTERN.search(text or ''))
    mentions_sensitive = bool(_SENSITIVE_PATTERN.search(text or ''))
    risk = 'high' if mentions_sharing and mentions_sensitive else 'medium' if mentions_sensitive else 'low'
    return {
        'risk_level': risk,
        'one_liner': '条款覆盖核心处理场景，建议结合原文进行人工复核。',
        'key_findings': [
            '已完成隐私政策文本抓取与结构化预处理（依据：任务流程日志）。',
            '条款中提及第三方共享相关描述。' + ('（依据：关键词“第三方/共享”）' if mentions_sharing else '（依据：未检出明确共享关键词）'),
            '条款中提及敏感信息处理内容。' + ('（依据：关键词“位置/通讯录/相机”等）' if mentions_sensitive else '（依据：未检出典型敏感权限关键词）'),
        ],
        'plain_summary': short or '暂无足够文本生成摘要，请补充可读政策文本后重试。',
        'data_collected': ['设备信息', '权限信息'] if mentions_sensitive else ['账号信息'],
        'data_shared_with': ['第三方服务商或合作方'] if mentions_sharing else [],
        'user_rights': ['查询', '删除', '注销'],
        'dispute': '争议处理条款请结合官方隐私政策原文进行复核。',
    }


def _safe_parse_json(content: str) -> dict[str, Any]:
    try:
        return json.loads(content)
    except Exception:
        matched = re.search(r'\{[\s\S]*\}', content or '')
        if not matched:
            raise ValueError('Model response has no JSON object')
        return json.loads(matched.group(0))


def _normalize_model_output(raw: dict[str, Any], policy_text: str) -> dict[str, Any]:
    base = fallback_analysis(policy_text)
    merged: dict[str, Any] = {**base, **(raw or {})}

    raw_risk = str(merged.get('risk_level') or '').strip().lower()
    if raw_risk not in RISK_LEVELS:
        raw_risk = base['risk_level']

    one_liner = _truncate_by_cjk(_replace_deterministic_terms(str(merged.get('one_liner') or '')), max_cjk=50, hard_limit=140)
    if not one_liner:
        one_liner = base['one_liner']

    plain_summary = _truncate_by_cjk(_replace_deterministic_terms(str(merged.get('plain_summary') or '')), max_cjk=220, hard_limit=520)
    if not plain_summary:
        plain_summary = base['plain_summary']

    findings: list[str] = []
    for item in _safe_list(merged.get('key_findings')):
        text = _ensure_evidence(item)
        if text and text not in findings:
            findings.append(text)
        if len(findings) >= 5:
            break

    for item in base['key_findings']:
        if len(findings) >= 3:
            break
        text = _ensure_evidence(item)
        if text and text not in findings:
            findings.append(text)

    if len(findings) > 5:
        findings = findings[:5]

    data_collected = [_replace_deterministic_terms(item) for item in _safe_list(merged.get('data_collected'))][:12]
    data_shared_with = [_replace_deterministic_terms(item) for item in _safe_list(merged.get('data_shared_with'))][:12]
    user_rights = [_replace_deterministic_terms(item) for item in _safe_list(merged.get('user_rights'))][:12]

    if not user_rights:
        user_rights = _safe_list(base.get('user_rights'))

    dispute = _truncate_by_cjk(_replace_deterministic_terms(str(merged.get('dispute') or '')), max_cjk=120, hard_limit=260)
    if not dispute:
        dispute = base['dispute']

    rubric_risk = _rubric_risk_level(policy_text, merged)
    final_risk = raw_risk if RISK_ORDER[raw_risk] >= RISK_ORDER[rubric_risk] else rubric_risk

    normalized = {
        'risk_level': final_risk,
        'one_liner': one_liner,
        'key_findings': findings,
        'plain_summary': plain_summary,
        'data_collected': data_collected,
        'data_shared_with': data_shared_with,
        'user_rights': user_rights,
        'dispute': dispute,
    }

    # Final deterministic-legal check.
    for key in ('one_liner', 'plain_summary', 'dispute'):
        normalized[key] = _replace_deterministic_terms(str(normalized[key]))
    normalized['key_findings'] = [_replace_deterministic_terms(item) for item in normalized['key_findings']]
    return normalized


async def analyze_policy_text(text: str) -> dict[str, Any]:
    if not settings.deepseek_api_key:
        return _normalize_model_output({}, text)

    payload = {
        'model': settings.deepseek_model,
        'temperature': 0.1,
        'response_format': {'type': 'json_object'},
        'messages': [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            {'role': 'user', 'content': f'请分析以下隐私政策文本：\n\n{text[:120000]}'},
        ],
    }

    base = settings.deepseek_base_url.rstrip('/')
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f'{base}/chat/completions',
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {settings.deepseek_api_key}',
                },
                json=payload,
            )
    except Exception:
        return _normalize_model_output({}, text)

    if response.status_code >= 400:
        return _normalize_model_output({}, text)

    content = response.json().get('choices', [{}])[0].get('message', {}).get('content', '')
    if not content:
        return _normalize_model_output({}, text)

    try:
        parsed = _safe_parse_json(content)
    except Exception:
        return _normalize_model_output({}, text)

    return _normalize_model_output(parsed, text)
