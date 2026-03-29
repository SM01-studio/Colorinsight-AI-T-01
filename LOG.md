# ColorInsight AI 开发日志

> 记录 ColorInsight AI 项目的所有开发工作

---

## 目录

- [2026-03-23 代码优化与清理](#2026-03-23-代码优化与清理)
- [2026-03-22 项目移植与架构重构](#2026-03-22-项目移植与架构重构)
- [待办事项](#待办事项)

---

<a name="2026-03-23-代码优化与清理"></a>
## 2026-03-23 代码优化与清理

### 📋 工作概述

项目部署前的代码优化工作，清理 AI Studio 遗留代码，提升安全性和代码质量。

### ✅ 完成工作

#### 1. 清理 AI Studio 遗留代码
- [x] 移除 `@google/genai` 依赖（未使用）
- [x] 移除 `jspdf-autotable` 依赖（未使用）
- [x] 更新 package.json 版本号为 `3.0.0`
- [x] 更新落地页版本显示为 `v3.0`

#### 2. 性能优化
- [x] 前端 API 请求添加超时机制（5分钟）
- [x] 使用 AbortController 实现请求取消
- [x] 添加超时错误提示

#### 3. 代码优化
- [x] 移除前端未使用的 Lucide 图标导入（7个）
- [x] 移除后端未使用的 `import base64`
- [x] 修复 `/health` 端点 bug（引用未定义的 request.user）

#### 4. 安全优化
- [x] 移除后端硬编码的 API Key 默认值
- [x] 添加环境变量验证警告
- [x] 更新 `.gitignore` 保护 `.env` 文件

### 📁 文件变更清单

```
修改文件：
├── package.json              # 移除未使用依赖，更新版本
├── App.tsx                   # 移除未使用导入，更新版本号
├── services/geminiService.ts # 添加请求超时机制
├── backend/app.py            # 移除硬编码Key，修复health端点
└── .gitignore                # 保护.env文件
```

---

<a name="2026-03-22-项目移植与架构重构"></a>
## 2026-03-22 项目移植与架构重构

### 📋 工作概述

将 ColorInsight AI 从 AI Studio (aistudio.google.com) 移植到本地开发环境，并进行架构重构以满足生产部署要求。

### 🔴 原项目问题

| 问题 | 说明 | 风险等级 |
|------|------|----------|
| API Key 暴露 | Gemini API Key 直接在前端调用 | 🔴 高 |
| 无认证机制 | 任何人都可以访问使用 | 🔴 高 |
| CDN 依赖 | 使用 aistudiocdn.com，国内可能无法访问 | 🟡 中 |
| 无法集成 | 无法与 siliang.cfd 主门户集成 | 🟡 中 |

### ✅ 完成工作

#### 1. 项目初始化
- [x] 从 GitHub 克隆源码：`https://github.com/SM01-studio/Colorinsight-AI-T-01`
- [x] 阅读 siliang-lab-dev 技能文件，了解部署架构要求
- [x] 分析原有代码结构和功能

#### 2. 生图 API 配置
- [x] 查找参考文件中的生图 API 配置
- [x] 配置 apicore.ai API（模型：gemini-3-pro-image-preview-4k）
- [x] 修改 `services/geminiService.ts` 中的 `generateVisualizationImage` 函数
- [x] 测试生图 API 连通性 ✅

**API 配置信息：**
```
Endpoint: https://api.apicore.ai/v1/chat/completions
Model: gemini-3-pro-image-preview-4k
Format: OpenAI 兼容格式
```

#### 3. 后端架构重构

**创建 Python Flask 后端** (`backend/app.py`)

| API 端点 | 方法 | 功能 |
|----------|------|------|
| `/api/colorinsight/health` | GET | 健康检查 |
| `/api/colorinsight/verify` | GET | JWT Token 验证 |
| `/api/colorinsight/extract-requirements` | POST | 从 PDF 文本提取需求 |
| `/api/colorinsight/market-search` | POST | Google 全网搜索色彩趋势 |
| `/api/colorinsight/generate-schemes` | POST | 生成并评分配色方案 |
| `/api/colorinsight/generate-image` | POST | 生成 AI 效果图 |

**认证中间件特性：**
- JWT Token 验证
- 开发模式支持（DEV_MODE=true 时接受 dev-token）
- 自动从 .env 文件加载配置

**依赖文件：** `backend/requirements.txt`
```
flask>=3.0.0
flask-cors>=4.0.0
requests>=2.31.0
pyjwt>=2.8.0
gunicorn>=21.0.0
python-dotenv>=1.0.0
```

#### 4. 前端认证集成

**修改文件：** `App.tsx`

- 添加认证状态管理：`isAuthenticated`, `isAuthChecking`, `currentUser`
- `useEffect` 实现自动认证检查
- 支持开发模式绕过认证（`VITE_BYPASS_AUTH=true`）
- 支持 URL 参数传递 token（`?auth_token=xxx`）
- 未认证时自动重定向到主门户

**修改文件：** `services/geminiService.ts`

- 完全重写为调用后端 API
- 移除直接调用 Gemini API 的代码
- 添加统一的 `apiRequest` 函数处理认证
- 添加 `verifyAuth()` 函数

#### 5. 部署配置创建

| 文件 | 用途 |
|------|------|
| `deploy/siliang-colorinsight.service` | Systemd 服务配置（阿里云） |
| `deploy/nginx.conf` | Nginx 反向代理配置 |
| `backend/.env` | 后端环境变量（含 API Keys） |
| `backend/.env.example` | 环境变量模板 |

#### 6. 本地测试

**后端测试结果：**

| API | 状态 | 说明 |
|-----|------|------|
| `/health` | ✅ 通过 | 服务正常 |
| `/extract-requirements` | ✅ 通过 | 正确提取需求 |
| `/market-search` | ✅ 通过 | 返回趋势和案例 |
| `/generate-schemes` | ✅ 通过 | 生成4种配色方案 |
| `/generate-image` | ✅ 通过 | 返回 base64 图片 |

**前端测试结果：**
- ✅ 页面正常加载
- ✅ 认证逻辑正常（开发模式）
- ✅ 完整流程可运行

#### 7. 文档完善

- [x] 重写 README.md（中英双语）
- [x] 添加预览图片（page01.jpeg, page02.jpeg）
- [x] 创建 .env.example 模板
- [x] 创建 LOG.md 开发日志

### 📁 文件变更清单

```
新增文件：
├── backend/
│   ├── app.py                    # Flask 后端主程序
│   ├── requirements.txt          # Python 依赖
│   ├── .env                      # 环境变量（已配置）
│   └── .env.example              # 环境变量模板
├── deploy/
│   ├── siliang-colorinsight.service  # Systemd 配置
│   └── nginx.conf                # Nginx 路由
├── page01.jpeg                   # 预览图1
├── page02.jpeg                   # 预览图2
└── LOG.md                        # 开发日志

修改文件：
├── App.tsx                       # 添加认证逻辑
├── services/geminiService.ts     # 重写为调用后端
├── index.html                    # 移除 CDN importmap
├── .env.local                    # 前端环境变量
└── README.md                     # 重写文档
```

### 🔑 已配置的 API Keys

| Key | 来源 | 用途 |
|-----|------|------|
| GEMINI_API_KEY | Google AI Studio | 文本分析、搜索 |
| IMAGE_API_KEY | apicore.ai | AI 生图 |

### 🏗️ 目标部署架构

```
┌──────────────────────────┐      ┌─────────────────────────────┐
│ colorinsight.siliang.cfd │      │ api.siliang.cfd/colorinsight│
│     前端     │ ───► │    后端 (阿里云:5002)        │
│                          │      │  - JWT 认证                 │
│  - 认证检查              │      │  - Gemini 文本分析          │
│  - 调用后端 API          │      │  - apicore.ai 生图          │
└──────────────────────────┘      └─────────────────────────────┘
```

---

<a name="2026-03-23-生产环境部署"></a>
## 2026-03-23 生产环境部署

### 📋 工作概述

完成 ColorInsight AI v3.0 的生产环境部署，包括后端部署到阿里云、前端部署到 Vercel、以及与主门户 Dashboard 的集成。

### ✅ 完成工作

#### 1. 后端部署 (阿里云 47.79.0.228:5002)
- [x] 上传后端代码到 `/www/siliang-ai-lab/colorinsight/`
- [x] 配置 Python 虚拟环境和依赖
- [x] 配置 Systemd 服务 `siliang-colorinsight.service`
- [x] 配置 Nginx 路由 `/api/colorinsight/` → 端口 5002
- [x] 配置生产环境 `.env` 文件（API Keys）

**API 端点验证**：
| 端点 | 状态 |
|------|------|
| `/api/colorinsight/health` | ✅ 正常 |
| `/api/colorinsight/verify` | ✅ 正常 |
| `/api/colorinsight/extract-requirements` | ✅ 正常 |
| `/api/colorinsight/market-search` | ✅ 正常 |
| `/api/colorinsight/generate-schemes` | ✅ 正常 |
| `/api/colorinsight/generate-image` | ✅ 正常 |

#### 2. 前端部署 (Vercel)
- [x] 推送代码到 GitHub
- [x] Vercel 项目配置
- [x] 域名绑定：`colorinsight.siliang.cfd`
- [x] DNS 配置：CNAME → `cname.vercel-dns.com`
- [x] 前端环境变量配置 (`VITE_API_BASE_URL`)

#### 3. 主门户 Dashboard 集成
- [x] 数据库添加 ColorInsight 应用记录
  - name: 色彩洞察
  - url: https://colorinsight.siliang.cfd
  - module: dm
  - is_active: 1
- [x] 分配用户权限
- [x] Dashboard 添加动态加载容器 `#dynamic-apps-dm`
- [x] 动态卡片位置调整（位于 ArchiAudit 之前）

### 📁 文件变更清单

```
部署文件：
├── deploy/siliang-colorinsight.service  # Systemd 服务配置
└── deploy/nginx.conf                    # Nginx 路由配置

服务器文件：
└── /www/siliang-ai-lab/colorinsight/    # 后端代码目录
    ├── app.py
    ├── requirements.txt
    └── .env
```

### 🔗 访问地址

| 服务 | URL |
|------|-----|
| 前端 | https://colorinsight.siliang.cfd |
| API | https://api.siliang.cfd/api/colorinsight/ |
| 健康检查 | https://api.siliang.cfd/api/colorinsight/health |

---

<a name="待办事项"></a>
## 待办事项

### ✅ 2026-03-23 完成

所有部署工作已完成！

---

## 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v3.0 | 2026-03-22 | 架构重构：前后端分离 + 认证集成 |
| v2.2 | - | AI Studio 原版 |

---

## 联系信息

- **开发者**: SM01 Studio
- **GitHub**: https://github.com/SM01-studio/Colorinsight-AI-T-01

---

## 2026-03-27 — API 迁移 (Google Gemini → LinkAPI)

### 背景
Google Gemini 免费 API 额度用完，需要切换到 LinkAPI (OpenAI 兼容格式)。

### 双 API 架构

| 用途 | API | 模型 | 说明 |
|---|---|---|---|
| 文本分析 | LinkAPI | gemini-3.1-flash-lite-preview | extract-requirements, generate-schemes |
| Google Search | Google 原生 API | gemini-2.5-flash | market-search (需要 googleSearch grounding) |
| 图像生成 | LinkAPI | gemini-3.1-flash-image-preview | generate-image |

### 修改文件
- `app.py` — 主要修改文件（后端）
  - 新增 `call_gemini_api()` 双路由逻辑（LinkAPI vs Google 原生）
  - 新增 `clean_json_response()` 清理 markdown 代码块
  - LinkAPI 响应转换为 Gemini 格式以兼容现有解析函数
  - `generate-schemes` prompt 补全 `usageAdvice` 和 `swot` 字段
  - `generate-schemes` 添加防御性默认值
  - `generate-image` 添加 markdown+base64 提取逻辑

### 配置 (.env)
```
GEMINI_API_KEY=sk-UM2pn3uKLuCCWvHXvPCukBvtzhWQyHe33roTFBMrKM9ypb1i
GEMINI_API_ENDPOINT=https://api.linkapi.ai/v1/chat/completions
GEMINI_TEXT_MODEL=gemini-3.1-flash-lite-preview
GOOGLE_API_KEY=AIzaSyAjPfzr1xAq5hV6h_sthcTu7BTFx6gS4LA
IMAGE_API_KEY=sk-UM2pn3uKLuCCWvHXvPCukBvtzhWQyHe33roTFBMrKM9ypb1i
IMAGE_API_ENDPOINT=https://api.linkapi.ai/v1/chat/completions
IMAGE_MODEL=gemini-3.1-flash-image-preview
```

### 修复记录

#### 1. 403 Forbidden (gemini-2.5-flash)
- **错误**: LinkAPI key 无权访问 gemini-2.5-flash 模型
- **修复**: extract-requirements 和 generate-schemes 改用默认模型 gemini-3.1-flash-lite-preview
- **注意**: market-search 的 Google Search 仍使用 Google 原生 API 的 gemini-2.5-flash

#### 2. JSON Parse Error (char 0)
- **错误**: LinkAPI 不支持 Google 的 responseSchema 参数，返回 markdown 包裹的 JSON
- **修复**: 添加 `clean_json_response()` 函数，清理 ```` ```json ``` ```` 代码块标记

#### 3. Result 页面白屏
- **错误**: `Cannot read properties of undefined (reading 'en')`
- **原因**: generate-schemes prompt 缺少 `usageAdvice` 和 `swot` 字段，前端直接访问 `bestScheme.usageAdvice.en` 崩溃
- **修复**:
  - prompt 补全 usageAdvice 和 swot 字段模板
  - 后端解析后添加防御性默认值（所有必需字段）

#### 4. 图片不渲染
- **错误**: `No image found in API response`
- **原因**: LinkAPI 返回 `![image](data:image/jpeg;base64,...)` 格式，代码只匹配 http URL
- **修复**: 添加正则 `r'!\[.*?\]\((data:image[^)]+)\)'` 提取 markdown 包裹的 base64 数据

#### 5. 前端 React Error #310
- **错误**: Hooks 调用顺序问题（在之前的 ArchiAudit 迁移时发现）
- **原因**: auth 检查的 useEffect + 条件 return 放在其他 useState 之前
- **修复**: 所有 useState 移到条件返回之前

### 部署信息
- 服务器后端目录: `/www/siliang-ai-lab/colorinsight/` (非 git 仓库，SCP 直接部署)
- 前端: Vercel (colorinsight.siliang.cfd)
- SSH: `ssh -i /Users/www.macpe.cn/Downloads/Aliali.pem root@47.79.0.228`

### 注意事项
- LinkAPI 返回 OpenAI 格式，`call_gemini_api()` 非 search 分支会转换为 Gemini 格式
- `extract_text_from_response()` 和 `extract_sources_from_response()` 保持不变
- 服务器 .env 中的配置优先于代码中的默认值

---

## 2026-03-29 — 后端持久化 + sessionId 传递

### 后端持久化存储
为 ColorInsight 后端添加服务器端会话持久化，支持文件管理功能。
- 存储目录：`data/sessions/`（会话 JSON）+ `data/output/`（输出文件）
- `/extract-requirements`：创建会话，保存提取的需求
- `/market-search`：保存市场搜索结果
- `/generate-schemes`：保存评分配色方案
- `/generate-image`：保存可视化效果图
- 新增 4 个管理 API：`GET /api/admin/sessions`、`DELETE /api/admin/sessions/<id>`、`POST /api/admin/sessions/batch-delete`、`GET /api/admin/sessions/<id>/download`

### 前端 sessionId 传递
让前端在同一次使用流程中传递同一个 sessionId，使文件管理显示为一条完整记录。
- `services/geminiService.ts`：`extractRequirements`、`performMarketSearch`、`generateAndScoreSchemes`、`generateVisualizationImage` 添加 `sessionId` 参数
- `App.tsx`：添加 `sessionId` 状态，从 `/extract-requirements` 响应中提取并传递给后续 API 调用
