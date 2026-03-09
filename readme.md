# SoloCrop

SoloCrop 是一个纯前端短视频剪辑原型项目，运行在浏览器本地，无需后端服务。项目围绕“需求文档 + 测试 + 门禁脚本”的方式推进，当前已经具备素材导入、时间轴编辑、自动字幕、滤镜/转场、贴纸、模板复用和成片导出等核心能力。

## 快速了解

- 运行方式：纯前端，本地浏览器执行
- 核心栈：Vue 3 + TypeScript + Vite + Pinia + Element Plus
- 本地处理：FFmpeg.wasm
- 数据存储：IndexedDB + LocalStorage
- 测试体系：Vitest + Playwright
- 目标方向：对标 CapCut 短视频基础编辑能力

## 已实现能力

- 素材导入：当前首批仅支持 MP4
- 时间轴编辑：视频/音频/字幕/贴纸四轨，支持拖拽、裁剪、分割、撤销/重做
- 自动字幕：本地 ASR、字幕编辑、批量偏移
- 滤镜与转场：亮度、对比度、饱和度、预设、淡入淡出、跨片段批量应用
- 贴纸素材：文本贴纸、图形贴纸、样式与颜色调整
- 模板系统：内置模板一键应用，本地自定义模板保存/应用/删除
- 成片导出：分辨率、码率、字幕烧录、导出队列、失败重试

详细功能状态见 [需求文档](C:\Test\SoloCrop\docs\需求文档.md)。

## 技术栈

- Vue 3
- TypeScript
- Vite
- Element Plus
- Pinia
- Dexie
- FFmpeg.wasm
- Vitest
- Playwright

## 目录结构

```text
SoloCrop/
├─ docs/                    项目文档
├─ frontend/                前端应用
│  ├─ src/
│  │  ├─ views/             页面视图
│  │  ├─ stores/            Pinia 状态管理
│  │  ├─ components/editor/ 编辑器组件
│  │  ├─ features/          分段、导出、字幕、模板等功能模块
│  │  ├─ db/                IndexedDB 封装
│  │  └─ types/             公共类型
│  ├─ e2e/                  Playwright 用例
│  └─ public/               静态资源与 ffmpeg 运行时
└─ scripts/                 启动、构建、校验脚本
```

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+
- Windows PowerShell（项目内脚本以 PowerShell 为主）
- Chrome 或 Edge 最新版

### 安装依赖

```powershell
cd frontend
npm install
```

### 启动开发环境

使用项目脚本一键启动：

```powershell
./scripts/start-all.ps1
```

脚本会自动：

- 检查 `frontend/` 是否存在
- 在缺少依赖时执行 `npm install`
- 同步 FFmpeg 运行时
- 清理占用 `5173` 端口的旧进程
- 启动 Vite 开发服务器

如果只想手动启动前端：

```powershell
cd frontend
npm run dev
```

## 常用命令

开发：

```powershell
cd frontend
npm run dev
```

构建：

```powershell
cd frontend
npm run build
```

预览构建产物：

```powershell
cd frontend
npm run preview
```

同步 FFmpeg 运行时：

```powershell
cd frontend
npm run sync:ffmpeg-core
```

单元测试：

```powershell
cd frontend
npm run test
```

E2E 测试：

```powershell
cd frontend
npm run test:e2e
```

带报告的 E2E：

```powershell
cd frontend
npm run test:e2e:report
```

使用脚本跑构建 + 预览 + E2E：

```powershell
./scripts/run-e2e.ps1
```

## 质量门禁

文档同步检查：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-doc-sync.ps1
```

需求覆盖检查：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-requirement-coverage.ps1
```

发布前需要确认：

1. 本轮必须项在 [需求文档](C:\Test\SoloCrop\docs\需求文档.md) 中已标记为 `已验收`
2. `npm run test` 通过
3. 关键 Playwright 用例为 `PASS`
4. 两个门禁脚本都通过

## 开发闭环

建议按下面的节奏推进功能：

1. 在 [需求文档](C:\Test\SoloCrop\docs\需求文档.md) 中新增或更新功能条目
2. 开发代码并同步相关文档
3. 运行单测与 E2E
4. 更新验收结果与状态
5. 通过门禁脚本后再提交

## 文档入口

- [需求文档](C:\Test\SoloCrop\docs\需求文档.md)
- [功能文档](C:\Test\SoloCrop\docs\功能文档.md)
- [开发文档](C:\Test\SoloCrop\docs\开发文档.md)
- [数据结构文档](C:\Test\SoloCrop\docs\数据结构文档.md)
- [部署文档](C:\Test\SoloCrop\docs\部署文档.md)

## 已知限制

- 当前输入格式首批仅支持 MP4
- 自动字幕为纯前端本地流程，识别精度受设备性能影响
- 大文件处理受浏览器内存限制影响明显
- 模板市场、共享能力和更高级的多轨编辑仍待继续补齐
- 项目当前更偏桌面浏览器体验，移动端以基础可用为主

## FAQ

### 为什么项目不需要后端？

当前版本定位是纯前端原型，视频处理、字幕流程和本地持久化都在浏览器内完成，便于快速验证产品闭环。

### FFmpeg 相关文件缺失怎么办？

先执行下面命令同步本地运行时：

```powershell
cd frontend
npm run sync:ffmpeg-core
```

### 启动时报端口被占用怎么办？

优先使用 `./scripts/start-all.ps1`，脚本会主动清理 `5173` 端口上的旧进程。

### 怎样快速了解当前缺什么功能？

先看 [需求文档](C:\Test\SoloCrop\docs\需求文档.md) 的“功能对比矩阵”，它是当前最准确的状态来源。

## 适用场景

- 本地浏览器环境下的轻量短视频剪辑
- 前端视频编辑能力验证与原型开发
- 围绕需求、测试和文档门禁的工程化实践
