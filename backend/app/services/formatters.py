from datetime import datetime


def to_date_label(value):
    if not value:
        return '-'
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except Exception:
            return value
    return value.strftime('%Y-%m-%d %H:%M')


def normalize_analysis(analysis: dict | None):
    source = analysis or {}
    return {
        'riskLevel': source.get('risk_level') or 'medium',
        'oneLiner': source.get('one_liner') or '暂无一句话总结',
        'keyFindings': source.get('key_findings') or [],
        'plainSummary': source.get('plain_summary') or '暂无简述',
        'dataCollected': source.get('data_collected') or [],
        'dataSharedWith': source.get('data_shared_with') or [],
        'userRights': source.get('user_rights') or [],
        'dispute': source.get('dispute') or '暂无争议条款摘要',
    }
