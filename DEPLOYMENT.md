# HTTPS 测试部署准备

本项目适合部署为纯静态 PWA。构建结果位于 `dist/`，不包含数据库、生活记录或服务器端代码。运行时数据继续保存在每台设备、每个浏览器、当前 HTTPS 来源自己的 IndexedDB 中。

## 推荐：GitHub 私有仓库 + Cloudflare Pages Git 集成

推荐 Cloudflare Pages，原因是它原生支持 Vite 的 `npm run build` / `dist` 约定、提供 HTTPS 和 CDN，并会把没有顶层 `404.html` 的项目按 SPA 处理。项目还在 `public/_headers` 中提供了安全响应头以及 Manifest、Service Worker 的重新验证规则。

仓库根目录的 `.node-version` 固定为 Node.js `22.16.0`，与 Cloudflare Pages v3 构建镜像的默认版本一致，也满足 Vite 和 Vitest 的最低版本要求。当前不需要配置环境变量或密钥。

## 1. 创建 GitHub 私有仓库

1. 登录 GitHub，打开 <https://github.com/new>。
2. Repository name 可填写 `LifeAgent`。
3. Visibility 必须选择 **Private**。
4. 不要勾选 README、`.gitignore` 或 License 初始化选项；本地仓库已经包含这些内容和提交历史。
5. 创建仓库后复制 GitHub 显示的 HTTPS 或 SSH 地址。

## 2. 首次关联并推送远程仓库

以下命令必须由用户在确认仓库地址和 GitHub 身份后执行。本项目不会自动执行 `git push`：

```powershell
Set-Location 'D:\LifeAgent'
git remote add origin https://github.com/<你的用户名>/LifeAgent.git
git remote -v
git push -u origin main
```

如果仓库名称不同，请替换地址。使用 SSH 时将 URL 换成 `git@github.com:<你的用户名>/<仓库名>.git`，并确保本机 SSH Key 已加入 GitHub。

## 3. 配置 Cloudflare Pages Git 集成

1. 登录 Cloudflare Dashboard。
2. 进入 **Workers & Pages → Create application → Pages → Connect to Git**。
3. 选择 GitHub，安装/授权 Cloudflare Pages GitHub App。建议只授权刚创建的 LifeAgent 私有仓库。
4. 选择该仓库并点击 **Begin setup**。
5. 使用以下配置：

- Framework preset：React (Vite)
- Production branch：`main`
- Build command：`npm run build`
- Build output directory：`dist`
- Root directory：`/`（仓库根目录；若界面以空白表示根目录，则保持空白）
- 环境变量：当前不需要

6. 确认后 Cloudflare 才会开始首次公开构建。构建成功后，通过 `https://<项目名>.pages.dev` 访问。

Cloudflare 支持私有 GitHub 仓库。生产分支 `main` 的新提交会自动部署，其他分支可产生预览部署。

## 4. 日常更新与自动部署

重要更新前先在当前正式站点导出 JSON 备份，然后执行本地验证：

```powershell
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

确认结果后再提交并推送：

```powershell
git add <本轮文件>
git commit -m "<清晰的提交说明>"
git push
```

推送到 `main` 会触发生产部署。只要继续使用同一个 HTTPS 来源，普通静态版本更新不会主动清除 IndexedDB；但部署前仍应备份，以防浏览器清理、域名切换或迁移失误。

## 发布前本地验证

```powershell
Set-Location 'D:\LifeAgent'
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

预览地址为 `http://127.0.0.1:4173`。确认 `dist/` 中存在：

- `index.html`
- `manifest.webmanifest`
- `sw.js`
- PNG 和 SVG 图标
- `_headers`
- `robots.txt`

## iPhone HTTPS 安装测试

1. 用 Safari 打开 Pages HTTPS 地址。
2. 新建一条仅用于测试的任务，刷新并重新打开 Safari，确认仍存在。
3. 点击 Safari 分享按钮，选择“添加到主屏幕”。
4. 从主屏幕启动，检查图标、顶部安全区域、底部导航、时间输入和软键盘遮挡。
5. 在飞行模式下重新打开已经加载过的应用，确认基础记录仍可操作。
6. 恢复网络后部署一个小版本更新，确认应用最终能加载新版静态资源。

Safari 的 IndexedDB 按网站来源隔离；Pages 预览域名、正式域名和自定义域名各自拥有不同数据。切换地址前请导出 JSON 备份。

## Android HTTPS 安装测试

1. 用 Chrome 打开 Pages HTTPS 地址。
2. 创建测试任务并刷新，确认数据仍存在。
3. 打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。
4. 从主屏幕启动，检查 standalone 显示、maskable 图标、时间输入、底部导航和返回行为。
5. 加载完成后使用飞行模式重新启动，验证离线基础记录。

Android Chrome 的 IndexedDB 同样按浏览器和网站来源隔离，不会与电脑或 iPhone 自动同步。

## 数据安全边界

- 静态托管方能看到普通 HTTP 访问日志，但页面没有把任务或活动内容发送给托管方。
- CSP 禁止连接第三方网络服务，也禁用摄像头、麦克风和定位权限。
- 不同设备不会自动同步数据。
- 清除网站数据、更换设备、浏览器或部署域名之前必须导出备份。
- 每次重要部署或域名变更前，都应在正在使用的设备上导出最新备份。
- JSON 文件是明文私人数据，应保存在可信位置。
