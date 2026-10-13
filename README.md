# 爱的错位 · 亲子关系测评网站

双卷制人格测评（家长卷 12 题 + 孩子卷 12 题 = 32 种错位组合报告）。

**架构**：前端纯静态（GitHub Pages）+ 后端数据库（Supabase），无需自己的服务器，全球随时随地可访问。

## 功能清单

| 功能 | 说明 |
|---|---|
| 密码门禁 | 打开网站先输密码；每个密码可测 3 次（点「开始测评」时消耗 1 次） |
| 双卷测评 | 家长卷 8 型 × 孩子卷 4 型 = 32 种错位组合报告；支持返回上一题重选 |
| 单卷模式 | 可只测家长卷或只测孩子卷 |
| 结果长图 | 一键生成结果页长图：手机长按存相册 / 电脑下载 PNG |
| 分享链接 | 每次完成生成 6 位结果码，链接 `r.html?code=结果码` 打开即见结果 |
| 双人对比 | 输入两个结果码并排对比；本机自动记录最近 10 次结果可一键带入 |
| 再测一次 | 密码还有次数直接重测；用完自动回到密码输入 |
| 好评有礼 | 结果页按钮，弹窗提示好评后联系客服领返现（文案在 supabase-config.js 改） |
| 管理后台 | `admin.html`：Supabase 账号登录、批量生成密码、查看用量、停用/启用 |
| 移动端适配 | 全站移动端优先 |

## 部署步骤（约 15 分钟）

### 第一步：创建 Supabase 项目（免费）

1. 打开 https://supabase.com 注册登录，点 **New project** 创建一个项目（区域选 Singapore 或 Tokyo，国内访问更快）。
2. 项目创建后，进入 **SQL Editor** → **New query**，把本项目根目录的 `supabase-schema.sql` **整段粘贴进去，点 Run**。
   （这一步会创建 3 张表 + 安全策略 + 4 个函数，是全部后端逻辑）
3. 进入 **Authentication** → **Users** → **Add user**，创建管理员账号（填你的邮箱 + 密码，勾选 Auto Confirm User）。这个账号就是以后登录管理后台用的。
4. 进入 **Project Settings** → **Data API**，复制两样东西：
   - **Project URL**（形如 `https://abcdefgh.supabase.co`）
   - **anon public** key（一长串字符）

### 第二步：填写配置

编辑 `supabase-config.js`，把上一步的两个值填进去，同时改店铺信息：

```js
var SUPABASE_URL = "https://abcdefgh.supabase.co";   // 你的 Project URL
var SUPABASE_ANON_KEY = "eyJhbGciOi...";             // 你的 anon public key

var SHOP_CONFIG = {
  name: "您的店铺名",
  service: "客服微信：kefu888",
  reward: "1元"
};
```

### 第三步：部署到 GitHub Pages

1. 在 GitHub 新建一个仓库（建议 Public，名字如 `love-test`）。
2. 把本项目**所有文件**上传到仓库根目录（网页上传或 git push 均可）：
   `index.html  r.html  compare.html  admin.html  supabase-config.js  supabase-schema.sql  css/  js/  vendor/`
3. 进入仓库 **Settings** → **Pages** → Source 选 **Deploy from a branch** → Branch 选 `main`、目录选 `/ (root)` → **Save**。
4. 等 1~2 分钟，访问 `https://你的GitHub用户名.github.io/love-test/` 即可使用。

> 以后修改网站：直接改仓库里的文件提交，Pages 会自动更新（约 1 分钟生效）。

## 日常使用

- **生成密码**：访问 `https://你的域名/admin.html`，用 Supabase 管理员账号登录，批量生成密码（自动复制到剪贴板），发给买家。
- **买家使用**：打开网站 → 输密码 → 答题 → 保存长图 / 复制链接发给家人 / 去 `compare.html` 对比。
- **查看数据**：Supabase 控制台 → Table Editor → `results` 表看所有测评结果，`passwords` 表看密码用量。

## 本地预览（可选）

```bash
cd love-test-site
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 目录结构

```
love-test-site/
├── index.html          # 首页（密码门 + 答题 + 结果）
├── r.html              # 分享结果页（?code=XXXXXX）
├── compare.html        # 对比页（?a=码1&b=码2）
├── admin.html          # 管理后台
├── supabase-config.js  # ⭐ 部署前只需改这个文件
├── supabase-schema.sql # ⭐ 数据库结构（在 Supabase SQL Editor 执行）
├── css/style.css
├── js/
│   ├── data.js         # 题库、类型、组合判词
│   ├── render.js       # 结果渲染（三页共用）
│   ├── api.js          # Supabase 访问层
│   ├── app.js / r.js / compare.js / admin.js
└── vendor/             # supabase-js、html2canvas（本地引用，无 CDN 依赖）
```

## 安全说明

- 数据库全部开启行级安全（RLS）：匿名用户只能通过 4 个受限函数操作（验证密码、保存结果、读结果），无法遍历或篡改数据；密码表只有登录后的管理员可读写。
- 验证密码是数据库内的原子操作（`update ... where used < uses`），并发点击也不会超出次数。
- 每次测评发放一次性会话令牌，保存结果时核销，防止跳过门禁直接刷结果。
- `anon key` 可以公开暴露（前端必须用它），真正的权限由 RLS 控制。

## 常见问题

- **国内访问慢**：GitHub Pages 偶尔不稳定，可后续绑定自己的域名（仓库根目录放一个 `CNAME` 文件，内容为你的域名，并在域名 DNS 加 CNAME 记录到 `用户名.github.io`）。
- **想改题库/类型/判词**：编辑 `js/data.js`，提交即生效。
- **想改返现规则文案**：编辑 `supabase-config.js` 里的 `SHOP_CONFIG`。
- **Supabase 免费额度**：50MB 数据库 + 每月 5GB 流量，本应用每条约 1KB 数据，足够数万次测评。
