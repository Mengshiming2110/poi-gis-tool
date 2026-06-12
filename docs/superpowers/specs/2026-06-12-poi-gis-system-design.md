# POI 数据挖掘与 GIS 可视化系统 — 设计文档

**日期**: 2026-06-12
**状态**: 已确认

---

## 1. 项目概述

基于 React 与高德地图的 POI 数据采集工具。核心功能：按类别筛选 POI，支持网格自动切分与自定义区域绘制两种采集模式，批量调用高德 API 采集数据存入 SQLite，前端可视化展示采集进度与结果，支持 Excel 和 GeoJSON 导出。

**使用场景**: 数据采集工具——核心是高德 POI 数据的批量采集能力，可视化作为辅助监控手段。

## 2. 技术架构

```
poi-gis-system/
├── client/                         # React 前端 (Vite + TypeScript)
│   ├── src/
│   │   ├── App.tsx                 # 根布局：地图 + 面板 + 抽屉
│   │   ├── components/
│   │   │   ├── MapView.tsx         # 高德地图容器，管理覆盖物
│   │   │   ├── ControlPanel.tsx    # 左上悬浮控制面板（可拖拽）
│   │   │   ├── CategoryPicker.tsx  # 类别选择器（标签云 + 可展开列表）
│   │   │   ├── CollectionMode.tsx  # Tab 页签切换网格/区域模式
│   │   │   ├── DrawToolbar.tsx     # 右上角绘制工具（多边形/矩形/圆形）
│   │   │   ├── ProgressDrawer.tsx  # 底部进度抽屉（可拖拽高度）
│   │   │   ├── DataTable.tsx       # POI 数据表格
│   │   │   └── ExportPanel.tsx     # 导出按钮组（Excel / GeoJSON）
│   │   ├── hooks/
│   │   │   ├── useAmap.ts          # 高德 JSAPI 加载与实例管理
│   │   │   ├── useCollection.ts    # 采集任务状态管理
│   │   │   └── useSSE.ts           # SSE 进度流订阅
│   │   ├── services/
│   │   │   └── api.ts              # 后端 API 调用封装
│   │   └── types/
│   │       └── poi.ts              # POI、任务、分类类型定义
│   └── package.json
├── server/                          # Node 后端 (Express + TypeScript)
│   ├── src/
│   │   ├── index.ts                # Express 入口，CORS，SSE 路由
│   │   ├── routes/
│   │   │   ├── collection.ts       # POST /api/collect, GET /api/collect/:id
│   │   │   ├── pois.ts             # GET /api/pois
│   │   │   └── export.ts           # GET /api/export/:id?fmt=xlsx|geojson
│   │   ├── services/
│   │   │   ├── amap.ts             # 高德 Web Service API 封装
│   │   │   ├── grid.ts             # 网格切分与区域切分算法
│   │   │   └── exporter.ts         # xlsx / GeoJSON 文件生成
│   │   ├── queue.ts                # 内存任务队列，逐格调用，推送进度
│   │   ├── db.ts                   # better-sqlite3 初始化与查询
│   │   └── config.ts               # 高德 Key、端口等配置
│   └── package.json
└── README.md
```

### 技术选型

| 层 | 技术 | 理由 |
|---|------|------|
| 前端框架 | React 18 + TypeScript | UI 状态管理清晰 |
| 构建工具 | Vite | 开发体验快 |
| 地图 | @amap/amap-jsapi-loader | 高德官方 JSAPI 加载器 |
| 图标 | @phosphor-icons/react | 6 种粗细，现代风格 |
| 后端框架 | Express + TypeScript | 轻量，生态成熟 |
| 数据库 | better-sqlite3 | 同步 API 简单，适合单机工具 |
| 导出 xlsx | exceljs | 支持样式、流式写入 |
| 导出 geojson | 原生 JSON 序列化 | 无额外依赖 |
| 进度推送 | SSE (Server-Sent Events) | 比 WebSocket 更简单，单向推送足够 |

### 数据流

```
React 前端                       Express 后端                   高德 API
    │                                │                            │
    ├─ POST /api/collect ──────────>├─ 创建任务，入队              │
    │  {categories, mode, grid, ...} │   ├─ 按网格/区域逐格调用 ──>├─ POI搜索
    │                                │   │<── 每格结果 ────────────┤
    │<── SSE progress ───────────────┤   ├─ 写入 SQLite            │
    │  {cell: 248/400, pois: 1856}   │   └─ 推送进度              │
    │                                │                            │
    │─ GET /api/pois?task=xxx ─────>├─ 查询 SQLite               │
    │<── {pois: [...], total} ──────┤                            │
    │                                │                            │
    │─ GET /api/export/:id?fmt=xlsx >├─ 生成文件                  │
    │<── 文件下载 ───────────────────┤                            │
```

## 3. UI 设计

### 3.1 整体布局

- **全屏地图**: 高德地图占满整个视口（100vw × 100vh）
- **左上悬浮面板**: 控制面板以浮窗形式叠在地图上，可拖拽，默认 260px 宽
- **右上角工具栏**: 绘制工具（多边形/矩形/圆形/清除）
- **底部进度抽屉**: 采集开始后底部滑出，收起时显示进度条，点击展开为数据表格，占视口 40% 高度，支持上下拖拽调整
- **视觉风格**: 亮色主题，白底+蓝色点缀，简洁克制

### 3.2 控制面板组件

**类别选择器**（CategoryPicker）：
- 默认：搜索框 + 标签云，已选中高亮蓝色，未选中灰色
- 点击"更多"展开：带分组的折叠列表，大类可展开显示子类，支持全选/清空
- 底部显示已选数量

**采集模式**（CollectionMode）：
- Tab 页签切换：网格采集 / 区域采集
- 网格模式参数：精度下拉框（0.005° / 0.01° / 0.02° / 0.05°）
- 实时估算：网格数量、预计耗时
- 开始采集按钮（主操作）
- 区域模式提示：提醒先在地图右上角绘制区域

### 3.3 地图交互

- **网格覆盖层**: 选中网格模式后，当前视口显示半透明网格线
- **区域绘制**: 支持多边形、矩形、圆形三种绘制模式，支持编辑和清除
- **POI 标记**: 按大类颜色渲染 `MapPin` 图标，悬停浮窗显示名称+类别+地址

### 3.4 进度与数据

- **进度条**: 底部抽屉收起时显示进度条、当前格子/总格子、POI 数量、耗时与预估剩余
- **控制按钮**: 暂停/继续/取消采集
- **数据表**: 分页表格，列：名称、类别、地址、经度、纬度；支持搜索筛选
- **导出**: 下拉或按钮组，导出 Excel / GeoJSON

## 4. 数据模型

### 4.1 数据库表（SQLite）

```sql
CREATE TABLE tasks (
  id          TEXT PRIMARY KEY,       -- UUID
  mode        TEXT NOT NULL,          -- 'grid' | 'region'
  categories  TEXT NOT NULL,          -- JSON 数组，如 '["餐饮","购物"]'
  grid_size   REAL,                   -- 网格精度（仅 grid 模式）
  region_geo  TEXT,                   -- GeoJSON 多边形（仅 region 模式）
  status      TEXT DEFAULT 'pending', -- pending | running | paused | done | cancelled
  total_cells INTEGER,
  done_cells  INTEGER DEFAULT 0,
  total_pois  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE pois (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id     TEXT NOT NULL REFERENCES tasks(id),
  name        TEXT NOT NULL,
  category    TEXT,                   -- 大类
  subcategory TEXT,                   -- 中类
  address     TEXT,
  lng         REAL NOT NULL,
  lat         REAL NOT NULL,
  phone       TEXT,
  rating      REAL,
  collected_at TEXT DEFAULT (datetime('now'))
);
```

### 4.2 POI 分类与渲染颜色

高德 POI 分类体系取大类别进行视觉区分：

| 大类代码 | 大类名称 | 标记颜色 | 色值 |
|---------|---------|---------|------|
| 050000 | 餐饮美食 | 红 | #EF4444 |
| 060000 | 购物消费 | 橙 | #F97316 |
| 070000 | 生活服务 | 黄 | #EAB308 |
| 080000 | 医疗保健 | 红 | #EF4444 |
| 100000 | 酒店住宿 | 紫 | #8B5CF6 |
| 110000 | 旅游景点 | 绿 | #22C55E |
| 140000 | 交通设施 | 蓝 | #3B82F6 |
| 150000 | 教育培训 | 粉 | #EC4899 |
| 160000 | 金融服务 | 紫 | #A855F7 |
| 120000 | 公司企业 | 灰 | #6B7280 |
| 130000 | 政府机构 | 深 | #1E293B |
| 010000 | 汽车服务 | 青 | #14B8A6 |
| 180000 | 体育休闲 | 草绿 | #84CC16 |

### 4.3 导出格式

**Excel (.xlsx)**:

| name | category | subcategory | address | lng | lat | phone | rating | collected_at |
|------|----------|-------------|---------|-----|-----|-------|--------|--------------|
| 星巴克(国贸店) | 餐饮美食 | 咖啡厅 | 朝阳区... | 116.4587 | 39.9087 | 010-... | 4.5 | 2026-06-12 14:32:15 |

**GeoJSON**:

```json
{
  "type": "FeatureCollection",
  "features": [{
    "type": "Feature",
    "geometry": { "type": "Point", "coordinates": [116.4587, 39.9087] },
    "properties": {
      "name": "星巴克(国贸店)",
      "category": "餐饮美食",
      "subcategory": "咖啡厅",
      "address": "朝阳区...",
      "phone": "010-...",
      "rating": 4.5,
      "collected_at": "2026-06-12T14:32:15+08:00"
    }
  }]
}
```

## 5. API 设计

### 5.1 采集任务

```
POST /api/collect
Content-Type: application/json
{
  "mode": "grid",                    // "grid" | "region"
  "categories": ["050000", "060000"],
  "bounds": {                        // 地图视口范围
    "southwest": { "lng": 116.3, "lat": 39.8 },
    "northeast": { "lng": 116.5, "lat": 40.0 }
  },
  "gridSize": 0.01,                  // 网格精度（仅 grid 模式）
  "region": { ... }                  // GeoJSON 多边形（仅 region 模式）
}

Response: { "taskId": "uuid", "totalCells": 400, "estimatedMinutes": 8 }
```

```
GET /api/collect/:id
Response: { "taskId": "uuid", "status": "running", "doneCells": 248, "totalCells": 400, "totalPois": 1856 }
```

```
POST /api/collect/:id/pause
POST /api/collect/:id/resume
POST /api/collect/:id/cancel
```

### 5.2 进度推送（SSE）

```
GET /api/collect/:id/progress
event: progress
data: {"doneCells": 249, "totalCells": 400, "totalPois": 1862, "elapsed": 265, "remaining": 160}

event: complete
data: {"totalPois": 1900, "elapsed": 480}
```

### 5.3 数据查询

```
GET /api/pois?taskId=xxx&page=1&pageSize=50&search=星巴克&category=050000
Response: { "pois": [...], "total": 1900, "page": 1, "pageSize": 50 }
```

### 5.4 导出

```
GET /api/export/:taskId?format=xlsx    → 返回 .xlsx 文件
GET /api/export/:taskId?format=geojson → 返回 .geojson 文件
```

## 6. 网格切分算法

### 6.1 规则网格

```
输入: bounds (southwest, northeast), gridSize (度)
输出: 网格单元列表 [{row, col, sw, ne}]

算法:
  rows = ceil((bounds.ne.lat - bounds.sw.lat) / gridSize)
  cols = ceil((bounds.ne.lng - bounds.sw.lng) / gridSize)
  for r in 0..rows:
    for c in 0..cols:
      cell.sw = {lat: sw.lat + r * gridSize, lng: sw.lng + c * gridSize}
      cell.ne = {lat: cell.sw.lat + gridSize, lng: cell.sw.lng + gridSize}

高德 POI 搜索每格上限约 1000 条。密集区域（如北京国贸）每平方公里
可能有 500+ POI，gridSize=0.01°（约 1.1km²）通常不超限。
```

### 6.2 自定义区域切分

```
输入: 多边形 GeoJSON, gridSize (度)
输出: 与多边形相交的网格单元列表

算法:
  1. 计算多边形包围盒
  2. 按 gridSize 在包围盒内生成网格
  3. 过滤：保留与多边形相交的网格单元
  4. 按列优先顺序排列
```

## 7. 错误处理

- **高德 API 限流**: 每格请求间隔 200ms，遇到 `OVER_QUOTA` 自动退避 1s 重试最多 3 次
- **网络中断**: 采集过程断网 → 任务自动暂停，恢复后手动继续
- **密钥未配置**: 启动时检查环境变量 `AMAP_KEY`，缺失时后端报错退出
- **导出为空**: 无数据时导出按钮禁用，给出提示

## 8. 未纳入范围

- 用户登录/权限管理
- 数据同步/云存储
- 历史任务对比分析
- POI 热力图
- 定时自动采集
