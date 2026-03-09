# SoloCrop

SoloCrop 是一个纯前端的短视频剪辑原型项目，运行在浏览器本地，无需后端服务。项目当前聚焦于 MP4 素材导入、时间轴编辑、自动字幕、滤镜/转场、贴纸、模板复用以及成片导出能力。

## 项目特点

- 纯前端运行：基于 Vue 3 + Vite，核心处理在浏览器端完成
- 本地视频处理：使用 FFmpeg.wasm 执行分段、拼接和导出
- 时间轴编辑：支持拖拽、裁剪、分割、撤销/重做
- 自动字幕：提供本地 ASR 流程与字幕编辑能力
- 模板系统：支持内置模板，以及将当前时间轴保存为本地自定义模板
- 导出闭环：支持导出队列、失败重试和错误分类

## 当前功能范围

已验收或可用的核心能力：

- 素材导入：当前首批仅支持 MP4
- 时间轴编辑：视频/音频/字幕/贴纸四轨
- 自动字幕：本地识别、编辑、批量偏移
- 滤镜与转场：亮度、对比度、饱和度、预设、淡入淡出
- 贴纸素材：文本/图形贴纸，支持样式与位置调整
- 模板系统：内置模板一键应用，本地自定义模板保存/应用/删除
- 成片导出：支持分辨率、码率和字幕烧录

详细需求与验收状态见 [docs/需求文档.md](C:\Test\SoloCrop\docs\需求文档.md)。

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

- `frontend/`：前端应用主体
- `frontend/src/views/`：页面视图
- `frontend/src/stores/`：状态管理
- `frontend/src/components/editor/`：编辑器组件
- `frontend/src/features/`：分段、导出、字幕、模板等功能模块
- `docs/`：需求、功能、开发、数据结构、部署文档
- `scripts/`：启动、校验、构建与 E2E 脚本

## 快速开始

### 1. 安装依赖

```powershell
cd frontend
npm install
```

### 2. 启动开发环境

如果使用项目封装脚本：

```powershell
./scripts/start-all.ps1
```

或仅启动前端：

```powershell
cd frontend
npm run dev
```

### 3. 构建产物

```powershell
cd frontend
npm run build
```

## 测试与校验

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

文档与需求门禁：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/check-doc-sync.ps1
powershell -ExecutionPolicy Bypass -File scripts/check-requirement-coverage.ps1
```

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

## 适用场景

- 本地浏览器环境下的轻量短视频剪辑
- 前端视频编辑能力验证与原型开发
- 围绕“需求文档 + 测试 + 门禁脚本”的功能闭环实践
