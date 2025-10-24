# OCR Master - AI驱动的图片文字提取工具

这是一个基于Next.js 14构建的OCR（光学字符识别）工具站，支持从图片中快速提取文字。项目采用现代化的技术栈，可以在3天内快速上线。

## 🌟 核心功能

这个MVP版本包含以下核心功能：

- ✅ Google账号登录（使用Supabase Auth）
- ✅ 单张图片上传（最大5MB）
- ✅ AI驱动的文字识别
- ✅ 识别结果展示和复制
- ✅ 新用户3次免费试用
- ✅ 积分系统（扣费机制）
- ✅ 响应式设计（支持手机和电脑）

## 🛠 技术栈

我们选择这套技术栈的原因是：它们都提供免费套餐，对初创项目非常友好，而且相互之间配合非常好。

- **前端框架**: Next.js 14 (App Router) - 最新的React框架，支持服务器组件
- **样式**: Tailwind CSS - 实用优先的CSS框架，开发速度快
- **数据库**: Supabase (PostgreSQL) - 开源的Firebase替代品，自带认证和实时功能
- **部署**: Vercel - Next.js官方推荐，部署简单快捷
- **OCR服务**: OCR.space API - 免费额度足够初期使用，未来可切换到DeepSeek OCR
- **图标**: Lucide React - 美观的开源图标库

## 📋 前置准备

在开始之前，你需要准备以下账号和工具。不要担心，所有这些服务都有免费套餐，不需要花钱：

### 1. 开发环境

- Node.js 18或更高版本（可以从 https://nodejs.org 下载）
- Git（用于版本控制）
- 一个代码编辑器（推荐VS Code或Cursor）

### 2. 需要注册的服务

1. **Supabase账号** (https://supabase.com)
   - 用于数据库和用户认证
   - 免费套餐提供500MB数据库空间和50000次请求/月

2. **Vercel账号** (https://vercel.com)
   - 用于部署网站
   - 免费套餐提供100GB带宽/月，足够初期使用

3. **OCR.space API密钥** (https://ocr.space/ocrapi)
   - 用于图片文字识别
   - 免费套餐提供25000次识别/月

## 🚀 快速开始

按照以下步骤，你可以在30分钟内在本地运行这个项目：

### 第一步：克隆项目并安装依赖

```bash
# 如果你是从GitHub克隆的
git clone <你的仓库地址>
cd ocr-master

# 安装所有依赖包
npm install
```

如果你看到一些警告信息（warnings），不用担心，这是正常的。只要没有错误（errors）就可以。

### 第二步：配置Supabase数据库

这一步是配置数据库，让你的应用知道如何连接到Supabase：

1. 登录 Supabase控制台（https://app.supabase.com）
2. 创建一个新项目（点击"New Project"）
3. 等待项目创建完成（大约需要1-2分钟）
4. 在项目设置中找到以下信息：
   - 进入 Settings → API
   - 复制 "Project URL"（类似 https://xxx.supabase.co）
   - 复制 "anon public" 密钥（一长串字符）

5. 初始化数据库表：
   - 进入 SQL Editor（左侧菜单）
   - 新建一个查询（点击"+ New query"）
   - 复制 `database.sql` 文件的内容，粘贴到编辑器
   - 点击"Run"执行SQL脚本

这个SQL脚本会创建三个表：users（用户信息）、payments（支付记录）、ocr_results（识别记录）。

6. 配置Google OAuth认证：
   - 进入 Authentication → Providers
   - 启用 Google Provider
   - 你需要创建一个Google Cloud项目并获取Client ID和Client Secret
   - 详细步骤参考：https://supabase.com/docs/guides/auth/social-login/auth-google

### 第三步：创建环境变量文件

环境变量就像是你网站的"配置文件"，存储了所有敏感信息（如密钥）。这些信息不应该提交到Git，所以我们单独配置：

1. 在项目根目录创建一个名为 `.env.local` 的文件
2. 复制以下内容并填入你的实际值：

```bash
# Supabase配置（从第二步获取）
NEXT_PUBLIC_SUPABASE_URL=你的Supabase项目URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的Supabase匿名密钥

# 站点URL（本地开发时用这个）
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# OCR API密钥（从 https://ocr.space/ocrapi 注册获取）
# 如果你还没注册，可以暂时用这个测试密钥：K87899142388957
OCR_API_KEY=你的OCR_API密钥
```

注意：以 `NEXT_PUBLIC_` 开头的变量会暴露给浏览器，所以不要放敏感信息。其他变量只在服务器端可见，更安全。

### 第四步：启动开发服务器

现在一切准备就绪，让我们启动项目：

```bash
npm run dev
```

如果一切正常，你会看到类似这样的输出：

```
  ▲ Next.js 14.2.0
  - Local:        http://localhost:3000
  - Ready in 2.3s
```

打开浏览器，访问 http://localhost:3000，你应该能看到OCR Master的首页了！

### 第五步：测试功能

让我们测试一下核心功能是否正常：

1. 点击"Google登录"按钮
2. 选择你的Google账号登录
3. 上传一张包含文字的图片（可以是截图、照片等）
4. 点击"开始识别"
5. 等待3-5秒，应该能看到识别结果

如果遇到问题，查看浏览器控制台（按F12）和终端的错误信息。

## 🌐 部署到Vercel

本地测试成功后，让我们把网站部署到互联网上，让全世界都能访问！

### 方式一：通过GitHub自动部署（推荐）

这是最简单的方式，以后你每次提交代码，Vercel都会自动重新部署：

1. 将代码推送到GitHub：

```bash
# 初始化Git仓库（如果还没有）
git init
git add .
git commit -m "Initial commit"

# 推送到GitHub（先在GitHub创建一个空仓库）
git remote add origin <你的GitHub仓库地址>
git push -u origin main
```

2. 登录Vercel（https://vercel.com）
3. 点击"Add New" → "Project"
4. 选择你刚创建的GitHub仓库
5. Vercel会自动检测到这是Next.js项目，使用默认配置即可
6. **重要**：添加环境变量
   - 在部署设置中找到"Environment Variables"
   - 添加所有 `.env.local` 中的变量（除了 `NEXT_PUBLIC_SITE_URL`）
   - `NEXT_PUBLIC_SITE_URL` 改为你的Vercel域名（如 https://your-project.vercel.app）

7. 点击"Deploy"

等待2-3分钟，你的网站就上线了！Vercel会给你一个免费的域名，类似 `your-project.vercel.app`。

### 方式二：使用Vercel CLI

如果你更喜欢命令行，可以这样部署：

```bash
# 安装Vercel CLI
npm i -g vercel

# 登录
vercel login

# 部署
vercel

# 添加环境变量
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add OCR_API_KEY

# 生产环境部署
vercel --prod
```

## 🔧 配置Google OAuth回调URL

部署成功后，还需要更新Supabase中的Google OAuth配置：

1. 进入Supabase控制台 → Authentication → URL Configuration
2. 在"Redirect URLs"中添加：
   - `https://your-project.vercel.app/auth/callback`
   - `http://localhost:3000/auth/callback`（用于本地开发）

3. 在Google Cloud Console中更新Authorized redirect URIs：
   - 添加你的Supabase Auth回调URL（在Supabase的Google Provider设置中可以看到）

## 📊 项目结构说明

让我解释一下项目的文件组织结构，这样你就知道在哪里找到什么：

```
ocr-master/
├── app/                      # Next.js 14的App Router目录
│   ├── api/                  # API路由（后端接口）
│   │   ├── ocr/             # OCR识别接口
│   │   │   └── route.ts
│   │   └── auth/            # 认证相关接口
│   │       └── callback/
│   │           └── route.ts
│   ├── globals.css          # 全局样式
│   ├── layout.tsx           # 根布局（所有页面的外层）
│   └── page.tsx             # 首页（主要的OCR界面）
├── lib/                     # 工具函数和配置
│   └── supabase.ts          # Supabase客户端配置
├── public/                  # 静态资源（图片、图标等）
├── database.sql             # 数据库初始化脚本
├── .env.local.example       # 环境变量示例
├── next.config.js           # Next.js配置
├── tailwind.config.ts       # Tailwind CSS配置
├── package.json             # 项目依赖和脚本
└── README.md               # 你正在看的这个文件
```

每个文件都有详细的注释，解释了代码的作用。如果你是编程新手，可以打开这些文件慢慢阅读注释。

## 🎯 下一步计划

这只是MVP（最小可行产品）版本，还有很多功能可以添加：

### 短期优化（上线后1-2周）

1. **切换到DeepSeek OCR**
   - 目前使用的是OCR.space，精度还可以，但不是最佳
   - DeepSeek OCR支持更多语言，精度更高
   - 需要自己部署模型，或等待DeepSeek提供官方API

2. **添加支付功能**
   - 集成Stripe或Creem
   - 用户可以购买积分包（如$4.99购买10次识别）
   - 实现webhook处理支付回调

3. **性能优化**
   - 添加图片压缩（减少上传时间）
   - 使用CDN加速图片传输
   - 优化数据库查询

### 中期功能（1-2个月）

1. **高级功能**
   - 批量上传（一次识别多张图片）
   - 识别历史记录
   - 支持PDF文件
   - 多语言选择（目前只支持英文识别）

2. **SEO和内容营销**
   - 添加博客功能
   - 发布"如何使用OCR"等教程文章
   - 优化关键词排名

3. **用户体验**
   - 添加识别进度条
   - 支持拖拽多张图片
   - 添加图片编辑功能（裁剪、旋转）

### 长期规划（3个月+）

1. **商业化**
   - 订阅制（月付/年付）
   - 企业版（API接口、批量识别）
   - 广告收入（Google AdSense）

2. **技术升级**
   - 移动端APP
   - 浏览器扩展
   - 桌面客户端

## 🐛 常见问题

### 为什么我点击"Google登录"后没有反应？

可能的原因：

1. 你还没有在Supabase中配置Google OAuth
2. Google OAuth的回调URL配置不正确
3. 检查浏览器控制台是否有错误信息

解决方法：重新检查"配置Google OAuth认证"这一步。

### OCR识别为什么失败？

可能的原因：

1. OCR API密钥无效或额度用完
2. 图片太大或格式不支持
3. 图片中没有文字或文字太模糊

解决方法：检查环境变量是否正确配置，尝试上传一张清晰的文字图片。

### 如何查看日志和错误信息？

- **本地开发**：查看终端（运行npm run dev的窗口）
- **Vercel部署**：登录Vercel控制台，进入项目 → Functions → 查看日志

### 数据库连接失败怎么办？

1. 检查 `.env.local` 中的Supabase配置是否正确
2. 确认Supabase项目处于激活状态（未暂停）
3. 检查数据库表是否已创建（运行database.sql）

## 📝 贡献和反馈

如果你发现bug或有新功能建议，欢迎：

- 在GitHub提Issue
- 提交Pull Request
- 发送邮件到 your-email@example.com

## 📄 许可证

MIT License - 你可以自由使用、修改和分发这个项目。

---

## 💡 给新手的建议

如果你是第一次部署网站，可能会觉得步骤很多、很复杂。不要担心，这是正常的！我的建议是：

1. **一步一步来**：不要想一次搞定所有事情。先在本地跑起来，再考虑部署。
2. **遇到错误不要慌**：仔细阅读错误信息，90%的错误是配置问题（环境变量、API密钥等）。
3. **善用搜索**：遇到问题先Google或问ChatGPT，大部分问题别人都遇到过。
4. **记录你的修改**：每次修改配置或代码，记录下来。这样出问题时知道是哪一步造成的。

记住：**完成比完美更重要**。这个MVP版本不需要完美，只要能跑起来就是成功。上线后根据用户反馈再迭代优化。

祝你上线顺利！🚀
