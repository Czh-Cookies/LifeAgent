# LifeAgent

LifeAgent 是一个本地优先、手机优先的个人生活计划与实际活动记录 PWA。当前版本只覆盖 Phase 0 + Phase 1A：计划、实际记录、日期总览、本地持久化、备份与离线应用外壳。

它刻意不把生活变成严格时间表：计划任务只需要日期，不要求开始或结束时间；实际活动单独记录真实发生的时间。任务是否完成只由用户明确确认，不会根据活动记录自动推断。

## 技术栈

- React + TypeScript + Vite
- Dexie.js + IndexedDB（主数据存储）
- vite-plugin-pwa + Workbox（Manifest、Service Worker、离线应用外壳）
- Vitest + fake-indexeddb（业务与持久化测试）
- 原生 CSS（无重型 UI 框架）

## 数据设计

- `Task`：计划日期、名称、说明、优先级、用户确认的完成状态、创建/更新时间。
- `Activity`：实际活动日期、实际开始/结束时间、内容、结果与困难、记录创建/更新时间。
- `TaskActivityLink`：独立的多对多关联表。活动可以无关联，也可以关联多个任务。

IndexedDB 当前 schema 版本为 1。后续升级应在 `src/db/database.ts` 中追加 Dexie 版本迁移，不应原地改写已发布版本的含义。

## Windows 11 开发

需要 Node.js 和 npm。PowerShell 中运行：

```powershell
Set-Location 'D:\LifeAgent'
npm install
npm run dev
```

电脑访问 `http://localhost:5173`。开发服务器监听所有本机网络接口，因此同一 Wi-Fi 下的手机可访问 `http://<电脑局域网IP>:5173`。可用以下命令查看 IPv4 地址：

```powershell
ipconfig
```

Windows 防火墙可能首次询问是否允许 Node.js 访问专用网络。只应在可信的专用网络中允许。请注意：手机浏览器通常要求 HTTPS 才能注册 Service Worker 或显示“添加到主屏幕”；局域网 HTTP 可验证响应式界面与普通读写，但完整安装/离线测试需要可信 HTTPS 环境。

## 验证命令

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

生产预览默认在 `http://localhost:4173`。浏览器开发者工具的 Application 面板可查看 Manifest、Service Worker 和 IndexedDB。

## 本地数据与备份

记录保存在当前浏览器、当前站点来源的 IndexedDB 中，不使用 `localStorage` 作为数据库，也不会进入 Service Worker 的静态资源缓存。刷新和正常关闭浏览器不会删除记录，但以下操作可能导致数据丢失：

- 清理浏览器站点数据；
- 无痕/隐私窗口关闭；
- 卸载浏览器或重置设备；
- 改用不同域名、端口、浏览器或设备（它们有各自独立的数据空间）。
- 在 iPhone 上从 Safari 页面切换到“添加到主屏幕”后的应用（两者可能使用独立数据空间）。

页面底部“数据备份”支持导出 JSON。恢复时会先完整校验应用标识、格式版本、字段、时间、ID 和关联完整性；校验成功并经用户确认后，才会在单个 IndexedDB 事务内替换当前数据。导出的 JSON 包含私人生活记录，请保存在安全位置，不要公开分享。

备份面板会记录最近一次成功生成备份文件的时间，但浏览器无法确认下载文件是否已由用户安全保存，请在系统“文件”或“下载”中再次检查。支持 Storage API 的浏览器可申请持久化存储，以降低系统自动回收站点数据的风险；该能力仍不能防止用户主动清除数据、卸载应用、设备损坏或更换设备。

PWA 检测到新版本后会提示用户先保存正在填写的内容，再由用户确认刷新，避免自动更新打断未提交的表单。Service Worker 只缓存应用静态资源，不缓存 IndexedDB 中的生活记录。

## 目录结构

```text
LifeAgent/
├─ public/                 PWA 图标
├─ src/
│  ├─ components/         通用界面组件、备份面板
│  ├─ db/                 Dexie 数据库与 schema 版本
│  ├─ domain/             领域模型
│  ├─ pages/              明日计划、实际记录、今日总览
│  ├─ services/           CRUD、校验、关联、导入导出
│  ├─ test/               IndexedDB 业务测试
│  ├─ utils/              本地日期与显示工具
│  ├─ App.tsx
│  ├─ main.tsx
│  └─ styles.css
├─ vite.config.ts         Vite、PWA 与测试配置
└─ package.json
```

## 当前范围

没有登录、云同步、AI、长期画像、支付、社交或自动推荐。数据没有端到端加密；任何能够访问该浏览器配置文件或导出文件的人都可能读取记录。

## HTTPS 测试部署

静态部署准备、Cloudflare Pages 参数、授权边界和 iPhone 安装步骤见 [`DEPLOYMENT.md`](./DEPLOYMENT.md)。项目不会自动把 IndexedDB 数据上传到部署平台，不同设备也不会自动同步。
