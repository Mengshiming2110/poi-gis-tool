# POI GIS 商户信息采集工具 — 设计文档

> 版本：v2.6.3
> 日期：2026-06-14
> 方向：modern-minimal（Linear / Vercel 风格）

---

## 一、产品概述

### 1.1 定位

面向配送公司运营人员的 POI 数据采集与 GIS 可视化工具。在高德地图上划定目标区域，勾选 POI 分类，通过高德 API 批量拉取公开商户数据，实时查看进度，数据写入本地 SQLite 数据库，支持云端同步（Supabase）、多维度统计和按区县导出。

### 1.2 核心流程

```
划定区域 → 配置 POI 类型 → 调用高德 API → 进度追踪
                                              ↓
              数据浏览 ← 数据管理 ← 本地 SQLite 入库 ←┘
                 ↓
          地图标记 / 导出 Excel/GeoJSON / 云端同步
```

### 1.3 用户角色

- **运营人员（桌面端）**：划定区域、执行采集、数据管理、导出
- **外勤人员（手机端）**：快速采集、查看数据、同步云端

---

## 二、架构设计

### 2.1 整体架构

```
┌─ client/ (React 18 + Vite) ──────────────────────┐
│  DesktopApp.tsx  │  MobileApp.tsx                  │
│  useAmap (地图)   │  useCollection (服务端采集)     │
│  useSSE (进度)    │  supabase.ts (云同步)           │
│  updater.ts (更新)│  api.ts (服务端通信)            │
├─ server/ (Express + sql.js WASM SQLite) ──────────┤
│  /api/collect   → 采集调度 (queue.ts)             │
│  /api/pois      → POI 查询 / 统计 / 合并 / 标记    │
│  /api/export    → Excel/GeoJSON 导出              │
├─ electron/ (Electron 42) ────────────────────────┤
│  main.js (Express 进程 + 窗口)                    │
│  preload.js (IPC: 文件保存 + 安装)                │
├─ shared/ (Supabase 云同步) ──────────────────────┤
│  桌面 ←→ Supabase ←→ 手机                         │
└──────────────────────────────────────────────────┘
```

### 2.2 双端策略

| 维度 | 桌面版 | 手机版 |
|------|--------|--------|
| 导航 | 左侧固定侧边栏 220px (6 视图) | 底部 Tab (4 标签) |
| 地图 | 右侧配置面板内嵌 | 全屏 + 底部 Sheet |
| 采集 | 服务端 Express 调度 | 客户端直调 REST API |
| 数据 | 本地 SQLite 数据库 | 内存 + localStorage 缓存 |
| 交互 | 鼠标 + Phosphor 图标 | 触摸 44px 目标 |

---

## 三、视觉系统

### 3.1 色彩 (oklch)

```css
:root {
  --bg:      oklch(99% 0.002 240);
  --surface: oklch(100% 0 0);
  --fg:      oklch(18% 0.012 250);
  --muted:   oklch(54% 0.012 250);
  --border:  oklch(92% 0.005 250);
  --accent:  oklch(58% 0.18 255);
  --success: oklch(58% 0.15 145);
  --warn:    oklch(58% 0.16 35);
}
.dark {
  --bg:      oklch(14% 0.008 250);
  --surface: oklch(18% 0.006 250);
  --fg:      oklch(92% 0.004 250);
  --accent:  oklch(64% 0.18 255);
}
```

### 3.2 图标系统

全局使用 Phosphor Icons，无 Unicode emoji。
按钮图标：Play/Pause/Stop/X/Square/Polygon/Circle/PushPin
导航图标：Cloud/DownloadSimple/ChartBar/ArrowsClockwise/Key/Gear
状态图标：Check/CheckCircle/Moon/Sun/Hourglass/Warning

---

## 四、桌面端视图

### 4.1 地图工作台

左侧地图 + 右侧配置面板 (220px sidebar + 300px panel)。

- **绘制工具**：矩形/多边形/圆形（两点点击+实时预览）+ 标注点 (PushPin)
  - 进入绘制 → 十字光标 + 蓝色提示框
  - 第一点 → 脉冲锚点 + 鼠标移动实时预览半透明形状
  - 第二点 → 图形保留 + 自动退出 + 绿色确认
  - Esc → 取消，退出绘制模式
- **POI 分类**：13 个 Chip 按钮（餐饮/购物/生活服务...），2 列网格
- **网格精度**：Slider (100-2000m) + 预设按钮 (500/1000/1500m) + 切分按钮
- **预估**：已选 X 类 · Y 格 · 预估请求次数
- **开始采集**：调用服务端 API，传 amapKey + skipDuplicates + debug

### 4.2 采集进度

环形进度图 + 4 统计卡片 + 进度表格。

- 统计卡：总数 / 已采集% / 待采集 / 重复项
- 环形图 conic-gradient 按百分比填充
- 区域进度条 + 分类明细
- 表格列：名称/类型/区域/地址/状态/采集时间，重复项橙色标记
- 控制按钮：暂停/继续/取消（仅在运行中/暂停时显示）

### 4.3 商户详情

左侧可搜索筛选列表 + 右侧详情卡片。

- 左侧：搜索框 + 分类 Chip 筛选（中文名+色块）
- 右侧：分类 badge + 名称 + 地址/电话/坐标/采集时间
- 操作：拨打电话 / 在地图中查看(flyTo) / 标记重复(toggle)
- 标记重复持久化到 manualDuplicateKeys Set

### 4.4 数据管理

顶部统计栏 + 左右双栏布局。

```
统计栏: [本地库 N] [已同步 N] [待上传 N] [重复 N]
左栏: ☁ 云同步 (上传全部/增量 + 从云端拉取合并)
      📥 数据导出 (Excel/CSV/GeoJSON)
右栏: 📊 按区域存储 (区县分组 + 点击钻取表格 + 按区域导出)
      🔄 重复检测 (DB 统计)
```

- **本地库统计**：服务端 `/api/pois/library/stats` 返回 total/byDistrict/byCategory/unsynced/synced/dupCount
- **上传**：`handleUpload(pois)` → Supabase → 成功后 `markPoisSynced(ids)`
- **从云端拉取**：`getTasks()` + `getPois(taskId)` → `POST /api/pois/merge` → INSERT 去重
- **区域钻取**：点击区县 → `queryPoiLibrary({district})` → 表格 + 导出按钮
- **重复检测**：`queryPoiLibraryStats().duplicateCount` (SQL GROUP BY name,address)

### 4.5 系统设置

- **API Key**：Web服务/JS API/安全密钥，三个 password 输入框共用一个 [保存 API 设置] 按钮
- **采集参数**：搜索半径 slider / 请求上限 / 请求间隔 / 调试模式 toggle
- **版本管理**：当前版本号 + 检查更新按钮(loading 态 + toast 反馈)
  - 新版本 → 弹窗下载 (4 镜像并行竞速 + 手动下载降级)
  - 红点持久化 (localStorage latest_known_version，直到更新才消)

---

## 五、数据库设计

### 5.1 SQLite (pois 表)

```sql
CREATE TABLE pois (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT,
  subcategory  TEXT,
  address      TEXT,
  lng          REAL NOT NULL,
  lat          REAL NOT NULL,
  phone        TEXT,
  rating       REAL,
  province     TEXT,        -- 从地址解析
  city         TEXT,
  district     TEXT,
  town         TEXT,
  sync_status  TEXT DEFAULT 'pending',  -- pending|synced
  collected_at TEXT DEFAULT (datetime('now'))
);
```

### 5.2 数据流

```
采集 → queue.ts → parseAddress() → insertPois(province/city/district/town)
                    ↓
              SQLite pois 表
                    ↓
    queryPoiLibrary / queryPoiLibraryStats / mergeCloudPois
                    ↓
              数据管理页展示
```

### 5.3 云端同步 (Supabase)

```
上传: handleUpload(pois) → createCloudTask → insertCloudPois
                          → markPoisSynced(ids) → refresh stats

下载: getTasks → getPois(taskId) → mergePoisToDb(mapped)
      → POST /api/pois/merge → INSERT WHERE NOT EXISTS (去重)
```

---

## 六、更新机制

- 启动时静默检测 + 每 30 分钟自动检测
- 手动检查：loading 态 + toast (已最新/发现新版/连接失败)
- 新版本检测 → 侧边栏设置旁红点 (持久化直到安装)
- 下载：4 个镜像并行竞速 (ghfast.top / ghp.ci / ghproxy.net / moeyy.xyz)
- 全部失败 → 引导手动下载 + kkgithub 镜像链接
- Electron：IPC saveAndOpenInstaller (写入临时目录 → shell.openPath)

---

## 七、技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + TypeScript + Vite |
| UI 图标 | Phosphor Icons |
| 地图 | 高德 JS API v2.0 (CDN 动态加载 key) |
| POI 搜索 | 高德 REST API v3 (place/around) |
| 服务端 | Express + sql.js (WASM SQLite) |
| 桌面打包 | Electron 42 + electron-builder (NSIS) |
| 移动打包 | Capacitor Android |
| 云同步 | Supabase (tasks + pois 表) |
| 更新 | GitHub Releases API + 多镜像下载 |
| 样式 | CSS 自定义属性 (oklch) + 暗色模式 |

---

## 八、决策记录

| 决策 | 理由 |
|------|------|
| 两点点击替代拖拽绘制 | 消除与地图平移的操作冲突 |
| 本地 SQLite 作为主数据源 | 离线可用、多任务累计、跨任务查询 |
| 服务端解析地址省市区 | SQL 统计快于前端临时计算 |
| 云端增量同步 (sync_status) | 避免重复上传，减少 Supabase 请求 |
| Phosphor 替代 emoji | 跨平台渲染一致，视觉更专业 |
| 多镜像并行下载 | GitHub CDN 在国内不稳定 |
| 红点持久化 | 用户不会因关闭弹窗而错过更新 |
| 调试模式 (mock POI) | 不消耗 API 额度即可测试全流程 |

---

## 九、版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v2.6.3 | 06-14 | 更新红点持久化 |
| v2.6.2 | 06-14 | 换用实测可用镜像站 |
| v2.6.1 | 06-14 | 并行镜像竞速下载 |
| v2.6.0 | 06-14 | Phosphor 图标替代 emoji |
| v2.5.x | 06-14 | 本地库升级/增量同步/区域钻取/UI重构 |
| v2.4.0 | 06-14 | 云端合并/数据管理页布局重构 |
| v2.3.0 | 06-14 | Key 传递链路修复/ErrorBoundary/调试模式 |
| v2.2.0 | 06-13 | 检查更新 + 底部Tab导航 |
