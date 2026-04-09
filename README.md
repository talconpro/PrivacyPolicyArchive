# AppSignal 隐私政策

AppSignal 是一个面向普通用户、运营同学和审核人员的隐私政策解读平台。  
它的目标很直接：用几秒钟看懂一个 App 隐私条款的关键风险点，而不是让用户自己啃几千字原文。

## 这个项目在解决什么问题

大多数隐私政策都存在这些共性难点：
- 篇幅长，读完成本高。
- 法律/合规术语密集，普通用户理解门槛高。
- 关键条款分散在不同段落，不容易快速定位。
- 用户很难判断“这个条款对我意味着什么”。

AppSignal 通过结构化分析，把“原文很长”转换为“可快速理解的信息卡片”。

## 核心能力

- 按应用检索隐私分析档案。
- 输出风险等级、一句话结论、关键发现、白话摘要。
- 支持应用对比，帮助用户横向判断。
- 支持用户提交新应用，进入审核流程。
- 提供开发者申诉通道，支持后台处理与状态追踪。
- 提供后台运营工具：分析工作台、批量抓取 App Store ID、站点设置等。

## 用户看到的分析结果

- `risk_level`：低 / 中 / 高 / 严重。[TODO]
- `one_liner`：一句话快速判断。
- `key_findings`：重点条款提炼。
- `plain_summary`：更易读的白话解释。
- `data_collected` / `data_shared_with` / `user_rights`：帮助用户快速理解数据处理范围与权利入口。

## 产品流程

1. 采集公开可访问的隐私政策文本。
2. 自动分析生成结构化结果。
3. 管理后台人工复核与修订。
4. 发布到前台供用户检索与对比。
5. 开发者可提交申诉，后台闭环处理。

## 边界与声明

- 平台内容基于公开信息处理与整理，仅供参考。
- 平台不构成法律建议、合规建议或专业意见。
- 部分内容由 AI 生成，可能存在理解偏差，请结合官方原文判断。
- 应用名称、图标、商标归各自权利方所有，仅作信息引用。

## 开发者申诉

- 前台提供申诉提交页面。
- 后台支持申诉列表、详情、时间线、状态处理。
- 状态变更为“已解决/已驳回”后，可按配置自动发送邮件通知。

## 快速体验（本地）

### 1) 启动后端
```powershell
cd backend
.\.venv\Scripts\activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 2) 初始化样例数据
```powershell
cd backend
$env:PYTHONPATH='.'
.\.venv\Scripts\python.exe scripts\seed_sample_data.py
```

### 3) 启动前端
```powershell
cd frontend
npm install
npm run dev
```

前端默认运行在 `http://127.0.0.1:3000`，并将 `/api` 代理到 `http://127.0.0.1:8000`。

## 数据库配置（PostgreSQL）

### 1) 修改 `backend/.env` 的 `DATABASE_URL`
```powershell
DATABASE_URL=postgresql+psycopg2://postgres:postgres@127.0.0.1:5432/privacy_policy_archive
```

### 2) 初始化 PostgreSQL 表结构
```powershell
alembic upgrade head
```