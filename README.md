# POI 数据采集工具

基于 React + 高德地图的 POI 批量采集工具，支持网格/区域两种采集模式。

## 环境要求

- Node.js >= 18
- 高德地图 API Key（需同时开通 **Web服务 API** 和 **JS API**）

## 快速开始

### 1. 获取高德 Key

1. 访问 [高德开放平台](https://lbs.amap.com/) 注册账号
2. 创建应用，开通 **Web服务 API** 和 **JS API** 两个服务
3. 获取 Key

### 2. 配置密钥

**后端** — 设置环境变量：
```bash
export AMAP_KEY="你的高德Web服务Key"
```

**前端** — 编辑 `client/src/hooks/useAmap.ts`，将 `YOUR_AMAP_KEY` 替换为你的 JS API Key。

### 3. 安装依赖

```bash
cd server && npm install
cd ../client && npm install
```

### 4. 启动

```bash
# 终端 1：启动后端（端口 3001）
cd server && npm run dev

# 终端 2：启动前端（端口 5173）
cd client && npm run dev
```

浏览器打开 **http://localhost:5173**

## 使用说明

1. 在左上角面板选择 POI 类别（可搜索、多选）
2. 选择采集模式——**网格** 或 **区域绘制**
3. 网格模式：选择精度后点击开始
4. 区域模式：点击右上角绘制工具在地图上画区域，再开始
5. 底部进度条实时显示采集状态，可暂停/取消
6. 采集完成后展开数据表查看，导出 Excel 或 GeoJSON

## 项目结构

```
poi-gis-tool/
├── client/                     # React 前端 (Vite + TypeScript)
│   └── src/
│       ├── App.tsx, App.css    # 根组件
│       ├── components/
│       │   ├── MapView.tsx     # 高德地图容器
│       │   ├── ControlPanel.tsx # 可拖拽悬浮面板
│       │   ├── CategoryPicker.tsx # 类别标签云+展开列表
│       │   ├── CollectionMode.tsx # 网格/区域Tab切换
│       │   ├── DrawToolbar.tsx # 绘制工具栏
│       │   ├── ProgressDrawer.tsx # 底部进度抽屉
│       │   └── DataTable.tsx   # POI数据表格
│       ├── hooks/              # useAmap, useSSE, useCollection
│       ├── services/api.ts     # 后端API封装
│       └── types/poi.ts        # 类型定义
├── server/                     # Node 后端 (Express + TypeScript)
│   └── src/
│       ├── index.ts            # 入口
│       ├── db.ts               # SQLite (better-sqlite3)
│       ├── queue.ts            # 任务队列
│       ├── config.ts, types.ts
│       ├── routes/             # collection, pois, export
│       └── services/           # amap.ts, grid.ts
└── docs/superpowers/           # 设计文档与计划
```

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18, TypeScript, Vite, Phosphor Icons, 高德 JSAPI |
| 后端 | Express, better-sqlite3, exceljs, SSE |
| 图标 | Phosphor Icons (6种粗细) |
| 导出 | Excel (.xlsx) + GeoJSON |

## 数据导出

- **Excel**: 名称、大类、中类、地址、经纬度、电话、评分、采集时间
- **GeoJSON**: FeatureCollection 格式，可直接导入 QGIS / kepler.gl / Mapbox

## API

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/collect` | POST | 创建采集任务 |
| `/api/collect/:id` | GET | 查询任务状态 |
| `/api/collect/:id/progress` | GET | SSE 进度推送 |
| `/api/collect/:id/pause` | POST | 暂停采集 |
| `/api/collect/:id/resume` | POST | 继续采集 |
| `/api/collect/:id/cancel` | POST | 取消采集 |
| `/api/pois` | GET | 查询POI数据（分页+搜索） |
| `/api/export/:taskId` | GET | 导出 Excel/GeoJSON |
