from __future__ import annotations

import os
import tempfile
from pathlib import Path

from app.core.errors import AppError

SENSITIVE_PERMISSION_LABELS: dict[str, str] = {
    'android.permission.READ_CONTACTS': '通讯录',
    'android.permission.WRITE_CONTACTS': '通讯录',
    'android.permission.READ_SMS': '短信',
    'android.permission.SEND_SMS': '短信',
    'android.permission.RECEIVE_SMS': '短信',
    'android.permission.READ_CALL_LOG': '通话记录',
    'android.permission.WRITE_CALL_LOG': '通话记录',
    'android.permission.CALL_PHONE': '电话',
    'android.permission.READ_PHONE_STATE': '设备识别信息',
    'android.permission.ACCESS_FINE_LOCATION': '精确位置',
    'android.permission.ACCESS_COARSE_LOCATION': '粗略位置',
    'android.permission.RECORD_AUDIO': '麦克风',
    'android.permission.CAMERA': '相机',
    'android.permission.READ_EXTERNAL_STORAGE': '本地存储',
    'android.permission.WRITE_EXTERNAL_STORAGE': '本地存储',
    'android.permission.READ_MEDIA_IMAGES': '媒体文件',
    'android.permission.READ_MEDIA_VIDEO': '媒体文件',
    'android.permission.BLUETOOTH_SCAN': '蓝牙设备',
    'android.permission.NEARBY_WIFI_DEVICES': '附近设备',
    'android.permission.BODY_SENSORS': '身体传感器',
}


def _to_risk_level(sensitive_count: int) -> str:
    if sensitive_count >= 7:
        return 'critical'
    if sensitive_count >= 4:
        return 'high'
    if sensitive_count >= 2:
        return 'medium'
    return 'low'


def _collect_data_tags(sensitive_permissions: list[str]) -> list[str]:
    tags: list[str] = []
    for permission in sensitive_permissions:
        label = SENSITIVE_PERMISSION_LABELS.get(permission)
        if label and label not in tags:
            tags.append(label)
    if not tags:
        tags.append('基础设备信息')
    return tags


def analyze_apk_binary(content: bytes, filename: str) -> dict:
    if not content:
        raise AppError(400, 'APK_EMPTY_FILE', 'APK 文件为空')

    try:
        from androguard.misc import AnalyzeAPK
    except Exception as error:
        raise AppError(500, 'APK_ANALYZER_UNAVAILABLE', f'APK 解析依赖不可用: {error}')

    temp_path = ''
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.apk') as tmp:
            tmp.write(content)
            temp_path = tmp.name

        apk, _, _ = AnalyzeAPK(temp_path)
        package_name = apk.get_package() or ''
        version_name = apk.get_androidversion_name() or ''
        detected_name = apk.get_app_name() or ''
        permissions = sorted(set(apk.get_permissions() or []))
    except AppError:
        raise
    except Exception as error:
        raise AppError(400, 'APK_PARSE_FAILED', f'APK 解析失败: {error}')
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

    sensitive_permissions = [p for p in permissions if p in SENSITIVE_PERMISSION_LABELS]
    risk_level = _to_risk_level(len(sensitive_permissions))
    data_tags = _collect_data_tags(sensitive_permissions)

    if risk_level in {'high', 'critical'}:
        one_liner = '敏感权限请求较多，建议重点复核用途与最小必要性。'
    elif risk_level == 'medium':
        one_liner = '存在若干敏感权限请求，建议核对业务场景说明。'
    else:
        one_liner = '权限请求相对克制，未发现明显高敏组合。'

    sensitive_preview = sensitive_permissions[:5]
    analysis = {
        'risk_level': risk_level,
        'one_liner': one_liner,
        'key_findings': [
            f'包名: {package_name or "未知"}，版本: {version_name or "未知"}。',
            f'共声明 {len(permissions)} 项权限，其中敏感权限 {len(sensitive_permissions)} 项。',
            (
                f'敏感权限示例: {", ".join(sensitive_preview)}。'
                if sensitive_preview
                else '未识别到高敏权限，建议仍结合隐私政策核对权限用途。'
            ),
        ],
        'plain_summary': 'APK 静态权限清单分析结果，仅反映声明权限，不代表运行时必然使用。',
        'data_collected': data_tags,
        'data_shared_with': [],
        'user_rights': ['查看隐私政策', '管理系统权限', '卸载应用'],
        'dispute': '如与官方隐私政策描述不一致，应以官方条款与实际权限弹窗为准。',
    }

    apk_meta = {
        'fileName': filename,
        'fileSize': len(content),
        'packageName': package_name,
        'versionName': version_name,
        'detectedAppName': detected_name,
        'permissionCount': len(permissions),
        'sensitivePermissionCount': len(sensitive_permissions),
        'permissions': permissions,
        'sensitivePermissions': sensitive_permissions,
    }

    app_name = detected_name.strip() or Path(filename).stem
    return {'appName': app_name, 'analysis': analysis, 'apkMeta': apk_meta}
