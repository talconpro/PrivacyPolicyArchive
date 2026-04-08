# Privacy Policy Archive

基于 **Nuxt 4 + Nitro + Prisma + TailwindCSS** 的 App 隐私协议档案馆。

## 这次补完了什么

- DeepSeek 真正接入：`shared/lib/analysis.ts` 已包含真实 OpenAI-compatible 调用
- 管理员登录页：`/admin/login`
- GitHub Actions：构建部署、每周巡检、自动处理提交
- 提交审核自动流转：`pending -> processing -> review_ready -> approved/rejected`
- 更完整的后台编辑能力：
  - App 基础信息与发布控制
  - 分析结果可视化编辑与恢复 AI 原稿
  - 提交详情审核台
  - 任务日志与批量处理入口
  - 审计日志与版本记录

## 启动

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

## 管理后台

- 登录地址：`/admin/login`
- 默认账号：读取 `.env` 中的 `NUXT_ADMIN_USERNAME`
- 默认密码：读取 `.env` 中的 `NUXT_ADMIN_PASSWORD`

## DeepSeek

配置以下环境变量即可启用真实分析：

```bash
NUXT_DEEPSEEK_API_KEY=your_key
NUXT_DEEPSEEK_BASE_URL=https://api.deepseek.com
NUXT_DEEPSEEK_MODEL=deepseek-chat
```

如果没有配置 API Key，系统会自动回退到本地规则分析，方便本地开发。

## GitHub Actions

仓库内已生成：

- `.github/workflows/ci.yml`
- `.github/workflows/weekly-maintenance.yml`
- `.github/workflows/process-submissions.yml`

你只需要在 GitHub 仓库里补上 secrets：

- `NUXT_DEEPSEEK_API_KEY`
- `NUXT_ADMIN_USERNAME`
- `NUXT_ADMIN_PASSWORD`
- `NUXT_ADMIN_TOKEN`
- `NUXT_SESSION_SECRET`
- `DATABASE_URL`（如果生产环境不是 SQLite）

## 自动流转说明

1. 用户提交表单进入 `pending`
2. 后台或工作流运行 `process_submission`
3. 系统抓取协议、提取文本、调用 DeepSeek，生成草稿 App
4. 提交状态进入 `review_ready`
5. 管理员在后台审核后发布或拒绝

## 主要后台页面

- `/admin/apps`：App 编辑台
- `/admin/apps/:id`：App 详细编辑页
- `/admin/analyses`：分析列表
- `/admin/analyses/:id`：分析编辑器
- `/admin/submissions`：提交审核台
- `/admin/submissions/:id`：提交详情工作台
- `/admin/jobs`：任务日志与批量执行

## 说明

当前源码已经把完整流程和后台结构补齐，但我这边没有联网安装依赖，因此 **没有实际执行 `npm install` / `nuxt build`**。你本地装完依赖后即可继续开发和联调。
