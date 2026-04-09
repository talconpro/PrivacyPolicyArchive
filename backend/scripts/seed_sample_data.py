from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import App, CrawlJob, PolicyVersion, UserSubmission


def cuid_like() -> str:
    return uuid.uuid4().hex[:24]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def analysis_payload(
    risk_level: str,
    one_liner: str,
    key_findings: list[str],
    plain_summary: str,
    data_collected: list[str],
    data_shared_with: list[str],
    user_rights: list[str],
    dispute: str,
) -> dict:
    return {
        "risk_level": risk_level,
        "one_liner": one_liner,
        "key_findings": key_findings,
        "plain_summary": plain_summary,
        "data_collected": data_collected,
        "data_shared_with": data_shared_with,
        "user_rights": user_rights,
        "dispute": dispute,
    }


SAMPLE_APPS = [
    {
        "slug": "wechat",
        "name": "微信",
        "category": "社交",
        "developer": "腾讯",
        "privacyPolicyUrl": "https://weixin.qq.com/cgi-bin/readtemplate?lang=zh_CN&t=weixin_agreement&s=privacy",
        "termsOfServiceUrl": "https://weixin.qq.com/cgi-bin/readtemplate?lang=zh_CN&t=weixin_agreement&s=agreement",
        "riskLevel": "high",
        "featured": True,
        "warningPinned": True,
        "analysis": analysis_payload(
            "high",
            "收集标识符与设备信息，第三方共享边界描述偏宽。",
            [
                "收集设备标识符、日志与网络信息",
                "涉及第三方服务共享场景",
                "删除与导出流程说明不够直观",
            ],
            "整体条款完整，但部分共享条款的触发条件较概括，用户需结合官方原文进一步确认。",
            ["设备标识符", "手机号", "日志信息", "网络状态"],
            ["云服务合作方", "统计分析服务商"],
            ["查询", "更正", "删除", "注销账号"],
            "适用中国大陆法律，争议提交有管辖权法院处理。",
        ),
    },
    {
        "slug": "douyin",
        "name": "抖音",
        "category": "视频娱乐",
        "developer": "字节跳动",
        "privacyPolicyUrl": "https://www.douyin.com/agreement?name=privacy",
        "termsOfServiceUrl": "https://www.douyin.com/agreement?name=service",
        "riskLevel": "medium",
        "featured": True,
        "warningPinned": False,
        "analysis": analysis_payload(
            "medium",
            "存在常见推荐场景数据处理，条款中给出了主要用户权利入口。",
            [
                "覆盖推荐算法相关处理说明",
                "收集范围与功能场景存在绑定关系",
                "用户权利入口在设置页可达",
            ],
            "条款对数据处理场景说明较清晰，但仍建议重点核对个性化推荐与广告相关条款。",
            ["设备信息", "浏览行为", "位置信息（按权限）"],
            ["内容审核服务方", "广告服务合作方"],
            ["访问", "删除", "撤回授权"],
            "争议优先协商，无法协商时按约定法院处理。",
        ),
    },
    {
        "slug": "alipay",
        "name": "支付宝",
        "category": "金融",
        "developer": "蚂蚁集团",
        "privacyPolicyUrl": "https://render.alipay.com/p/c/k2cx0tg8",
        "termsOfServiceUrl": "https://render.alipay.com/p/c/k2cx0tg8",
        "riskLevel": "medium",
        "featured": True,
        "warningPinned": False,
        "analysis": analysis_payload(
            "medium",
            "金融场景下采集项较多，权限说明与风控需求关联明确。",
            [
                "涉及实名与风控相关信息",
                "条款包含支付安全与反欺诈说明",
                "数据留存期限受监管要求影响",
            ],
            "条款内容系统性较强，信息类型较多，建议重点查看风控与授权管理章节。",
            ["身份信息", "交易信息", "设备信息"],
            ["清算机构", "风控服务合作方"],
            ["查询", "更正", "删除（依法可删范围）"],
            "争议处理按服务协议约定执行。",
        ),
    },
    {
        "slug": "xiaohongshu",
        "name": "小红书",
        "category": "社交",
        "developer": "行吟信息科技",
        "privacyPolicyUrl": "https://www.xiaohongshu.com/help/privacy",
        "termsOfServiceUrl": "https://www.xiaohongshu.com/help/agreement",
        "riskLevel": "medium",
        "featured": False,
        "warningPinned": False,
        "analysis": analysis_payload(
            "medium",
            "社区互动与内容推荐场景下存在行为数据处理。",
            [
                "覆盖互动行为与内容偏好",
                "提供账号管理与隐私设置入口",
                "第三方 SDK 使用有列示说明",
            ],
            "社区型产品常见的数据处理场景已覆盖，建议结合授权页面核对权限实际使用。",
            ["互动记录", "设备信息", "账号资料"],
            ["云服务商", "内容安全合作方"],
            ["查询", "更正", "删除", "账号注销"],
            "争议处理以协议约定方式为准。",
        ),
    },
    {
        "slug": "meituan",
        "name": "美团",
        "category": "生活服务",
        "developer": "美团",
        "privacyPolicyUrl": "https://www.meituan.com/about/privacy",
        "termsOfServiceUrl": "https://www.meituan.com/about/terms",
        "riskLevel": "low",
        "featured": False,
        "warningPinned": False,
        "analysis": analysis_payload(
            "low",
            "与本地生活服务相关的信息处理范围相对明确。",
            [
                "订单与履约信息条款清晰",
                "定位权限与配送功能绑定",
                "用户权利入口较明确",
            ],
            "条款对业务场景与信息关系解释充分，整体风险等级较低。",
            ["订单信息", "收货地址", "设备信息"],
            ["配送合作方", "支付合作方"],
            ["查询", "更正", "删除", "导出"],
            "争议按平台服务协议执行。",
        ),
    },
]


def upsert_apps(session) -> list[App]:
    inserted_or_updated: list[App] = []
    now = now_utc()

    for item in SAMPLE_APPS:
        existing = session.execute(select(App).where(App.slug == item["slug"])).scalar_one_or_none()
        analysis = item["analysis"]

        if existing:
            existing.name = item["name"]
            existing.category = item["category"]
            existing.developer = item["developer"]
            existing.privacyPolicyUrl = item["privacyPolicyUrl"]
            existing.termsOfServiceUrl = item["termsOfServiceUrl"]
            existing.riskLevel = item["riskLevel"]
            existing.oneLiner = analysis["one_liner"]
            existing.plainSummary = analysis["plain_summary"]
            existing.analysis = analysis
            existing.analysisSource = analysis
            existing.featured = item["featured"]
            existing.warningPinned = item["warningPinned"]
            existing.isPublished = True
            existing.status = "published"
            existing.rawText = (existing.rawText or "")[:2000] or f"{item['name']} 隐私政策样例文本。"
            existing.lastError = None
            existing.updatedAt = now
            existing.analyzedAt = now
            inserted_or_updated.append(existing)
            continue

        app = App(
            id=cuid_like(),
            slug=item["slug"],
            name=item["name"],
            category=item["category"],
            developer=item["developer"],
            privacyPolicyUrl=item["privacyPolicyUrl"],
            termsOfServiceUrl=item["termsOfServiceUrl"],
            rawText=f"{item['name']} 隐私政策样例文本。",
            analysis=analysis,
            analysisSource=analysis,
            riskLevel=item["riskLevel"],
            oneLiner=analysis["one_liner"],
            plainSummary=analysis["plain_summary"],
            status="published",
            featured=item["featured"],
            warningPinned=item["warningPinned"],
            isPublished=True,
            analyzedAt=now,
            sourceType="manual",
            createdAt=now,
            updatedAt=now,
        )
        session.add(app)
        inserted_or_updated.append(app)

    session.flush()
    return inserted_or_updated


def ensure_policy_versions(session, apps: list[App]) -> None:
    now = now_utc()
    for app in apps:
        exists = session.execute(select(PolicyVersion).where(PolicyVersion.appId == app.id)).first()
        if exists:
            continue
        version = PolicyVersion(
            id=cuid_like(),
            appId=app.id,
            versionLabel=f"Seed {now.strftime('%Y-%m-%d')}",
            rawText=app.rawText or f"{app.name} policy text",
            contentHash=f"seed-{app.slug}",
            analysis=app.analysis,
            sourceUrl=app.privacyPolicyUrl,
            createdAt=now,
        )
        session.add(version)


def ensure_submissions(session, apps: list[App]) -> None:
    if session.execute(select(UserSubmission).limit(1)).first():
        return

    now = now_utc()
    for app in apps[:2]:
        status = "review_ready" if app.slug == "xiaohongshu" else "pending"
        submission = UserSubmission(
            id=cuid_like(),
            appName=app.name,
            privacyUrl=app.privacyPolicyUrl or f"https://example.com/{app.slug}/privacy",
            termsUrl=app.termsOfServiceUrl,
            remark="样例数据迁移",
            submitterEmail="sample@example.com",
            ipHash="sample-ip-hash",
            status=status,
            fetchStatus="success" if status == "review_ready" else "idle",
            analysisStatus="success" if status == "review_ready" else "idle",
            adminNote="系统样例数据",
            extractedText=app.rawText,
            extractedHash=f"sample-hash-{app.slug}",
            suggestedRisk=app.riskLevel,
            analysisDraft=app.analysis,
            linkedAppId=app.id if status == "review_ready" else None,
            createdAt=now,
            updatedAt=now,
        )
        session.add(submission)


def ensure_jobs(session) -> None:
    if session.execute(select(CrawlJob).limit(1)).first():
        return

    now = now_utc()
    jobs = [
        CrawlJob(
            id=cuid_like(),
            type="sample_seed",
            status="success",
            targetType="system",
            targetId=None,
            startedAt=now,
            finishedAt=now,
            summary="Sample data seeded",
            meta={"source": "seed_sample_data.py"},
        ),
        CrawlJob(
            id=cuid_like(),
            type="submission_bulk_action",
            status="success",
            targetType="submission",
            targetId=None,
            startedAt=now,
            finishedAt=now,
            summary="seed summary: success=2 failed=0",
            meta={"batchId": "sample-seed", "action": "process"},
        ),
    ]
    session.add_all(jobs)


def run() -> None:
    session = SessionLocal()
    try:
        apps = upsert_apps(session)
        ensure_policy_versions(session, apps)
        ensure_submissions(session, apps)
        ensure_jobs(session)
        session.commit()
        print(f"Seed completed. Apps processed: {len(apps)}")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    run()
