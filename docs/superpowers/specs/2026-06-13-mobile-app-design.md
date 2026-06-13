# 手机端 APP 重新设计 — 设计文档 v2

**日期**: 2026-06-13
**状态**: 已实现（含多轮迭代修复）

---

## 1. 概述

当前手机端 APK 直接复用桌面版 UI（悬浮面板、小按钮、鼠标操作），触屏体验差。本次重新设计手机端交互，目标：**触屏优先、步骤引导、真正好用**。

### 核心原则

- 桌面版组件不动，新增 `mobile/` 目录放移动专属组件
- 同一套 React + Vite 代码，CSS 媒体查询区分平台
- Capacitor 打包 APK，Supabase 云同步，桌面手机互通

## 2. 交互模式：五步流程式

```
选择类别 → 绘制区域 → 网格切分 → 采集 → 查看结果
```

每步一个全屏视图，底部步骤条指示进度，可前进/后退。步骤间通过 React state 传递数据。

| 步骤 | 内容 | 操作 |
|------|------|------|
| 1 选择类别 | 全屏标签云+搜索 | 多选 POI 类别 → 下一步 |
| 2 绘制区域 | 全屏地图+底部绘图工具条 | 多边形/矩形/圆形 → 完成 → 下一步 |
| 3 网格切分 | 全屏地图+网格覆盖+精度调节 | 滑块调精度 → 切分 → 下一步 |
| 4 采集 | 全屏进度+动画+POI 计数 | 自动采集 → 可暂停/完成到下一步 |
| 5 查看结果 | POI 列表+导出+云同步 | 浏览/导出/分享/同步云端 → 完成 |

## 3. 技术架构

```
client/src/
├── App.tsx                    ← 媒体查询: 宽度<768px 用 MobileApp, >=768px 用 DesktopApp
├── components/
│   ├── ControlPanel.tsx       ← 桌面组件（位置不变）
│   ├── CategoryPicker.tsx
│   ├── CollectionMode.tsx
│   ├── DrawToolbar.tsx
│   ├── MapView.tsx
│   ├── ProgressDrawer.tsx
│   ├── DataTable.tsx
│   ├── SettingsDialog.tsx
│   ├── CloudPanel.tsx         ← 桌面端云端任务拉取面板
│   │
│   └── mobile/               ← 移动专属组件
│       ├── StepIndicator.tsx      ← 顶部步骤进度条
│       ├── StepCategories.tsx     ← 步骤1: 分类选择
│       ├── StepDraw.tsx           ← 步骤2: 区域绘制
│       ├── StepGrid.tsx           ← 步骤3: 网格切分
│       ├── StepCollect.tsx        ← 步骤4: 采集进度
│       ├── StepResults.tsx        ← 步骤5: 结果查看+导出+同步
│       └── MobileApp.tsx          ← 移动版 App 根组件
├── hooks/                    ← 共享
│   └── useAmap.ts            ← 核心地图 hook（map/绘图/网格/采集）
├── services/
│   ├── api.ts                ← 桌面后端 API
│   └── supabase.ts           ← Supabase 客户端（读写）
└── types/
    └── poi.ts                ← POI 类型 + CATEGORY_LIST
```

## 4. 数据流（迭代后）

```
手机 APK (Capacitor WebView)
    │
    ├─ 采集 ──→ 高德 REST API (fetch → restapi.amap.com)
    │              │
    │              ├─ WebView 不限制 CORS，fetch 直连可用
    │              └─ PlaceSearch (JSONP) 在 WebView 不可靠，已废弃
    │
    ├─ 同步云端 → Supabase (createCloudTask + insertCloudPois)
    │
    └─ 定位 ──→ navigator.geolocation (需 Android 权限)

桌面 Electron
    │
    ├─ CloudPanel ☁️ → 拉取 Supabase 任务列表 → 导出 CSV
    └─ 采集用桌面后端 Express + REST API
```

### 采集关键决策

- **不用 PlaceSearch**：AMap JS SDK 的 PlaceSearch 插件在 WebView 中 JSONP 调用不可靠，静默返回空
- **改用 REST API**：`fetch()` 直连 `restapi.amap.com/v3/place/around`，支持自动翻页
- **错误上浮**：API 错误不再静默吞掉，抛到 StepCollect 显示具体报错信息

## 5. 组件设计（实现版）

### 5.1 MobileApp.tsx（根组件）

- 共享单个 `useAmap('mobile-map')` 实例，步骤 2-3 共用同一地图
- 地图 div 在步骤 2-3 持续存在（display 切换，不销毁重建）
- 步骤 2/3 地图右下角显示 `⌖` 定位按钮，调用 `amap.locateMe()`
- `canNext()` 直接读取 `amap.gridCells.length`（避免双数据源不同步）
- 底部导航：步骤 1-3 显示"上一步/下一步"，步骤 4-5 由各自组件处理

### 5.2 StepIndicator.tsx

- 横向步骤条: ● 类别 — ● 区域 — ● 网格 — ○ 采集 — ○ 结果
- 当前步骤高亮蓝色，已完成绿色，未完成灰色
- 点击已完成步骤可跳回

### 5.3 StepCategories.tsx

- 全屏标签云（48dp 触控目标），搜索框实时过滤
- 标签用 category 对应的颜色，选中态显示实心

### 5.4 StepDraw.tsx

- 接收 amap API 作为 **props**（不自己调 useAmap）
- 底部浮动工具栏: ⬠ 多边形 / ▭ 矩形 / ◯ 圆形 / ✕ 清除
- **触屏绘制适配**（关键迭代）：
  - **多边形**：MouseTool 点击加点，触屏可用，保持不变
  - **矩形/圆形**：MouseTool 拖拽在触屏不走 `mousedown` 事件链 → 改用**两点点击法**（第一下打锚点→脉冲标记，第二下生成图形）
  - 绘制时 `map.setStatus({ dragEnable: false })` 禁用地图拖拽，绘制完成恢复
- 绘制完成自动退出绘制模式
- Poll `getDrawnShape()` 每 500ms 检测完成

### 5.5 StepGrid.tsx

- 接收 amap API 作为 **props**
- 底部面板: 精度滑块（100m-2000m）+ 预设按钮（500/1000/1500m）
- "执行切分" 按钮 → 地图上显示蓝色半透明网格 + 黄色网格数 badge
- 网格数从 `amap.gridCells` 直接读取（非本地 state，避免同步断裂）

### 5.6 StepCollect.tsx

- 接收 `collectPOIsClientSide` 和 `stopCollecting` 作为 props
- 调用高德 REST API 采集，每格×每类逐次搜索，200ms 间隔防限流
- 进度环 + 实时统计：**真实 POI 累计数**（非任务数）+ 当前搜索任务/总任务
- 异常处理：
  - 采集结果为空 → 显示错误页（含搜索统计）
  - API 报错 → 显示具体错误信息（如 `OVER_DAILY_QUOTA`）
- "查看结果(0条)" 按钮允许强制进入结果页

### 5.7 StepResults.tsx

- POI 列表（56dp 行高，左颜色点+名称+类别+地址）
- **四个导出按钮**：
  | 📤 分享 | 调起系统分享面板（Web Share API），传 CSV 文件 |
  | 📋 复制CSV | 复制 CSV 到剪贴板 |
  | 📄 CSV | 下载 .csv 文件 |
  | 🗺 GeoJSON | 下载 .geojson 文件 |
- **☁️ 同步云端**：上传到 Supabase（createCloudTask → insertCloudPois 批量写入），按钮变绿 ✅
- "完成" 按钮 → 回到步骤 1

## 6. 云同步（桌面 ↔ 手机）

```
手机采集完成 → 点 ☁️ 同步云端 → Supabase
桌面端右下角 ☁️ 按钮 → 拉取云端任务列表 → 点任务展开 → 📥 导出 CSV
```

- 使用 Supabase publishable key，客户端直接读写（RLS 全开）
- 写入分批 50 条/次避免请求体积过大
- 桌面 `CloudPanel` 组件独立浮动，不干扰采集流程

## 7. 移动端样式规范

| 属性 | 桌面 | 移动 |
|------|------|------|
| 最小触控尺寸 | - | 48dp × 48dp |
| 字体基准 | 13px | 16px |
| 按钮圆角 | 6px | 12px |
| 面板背景 | rgba(255,255,255,0.95) | #fff 不透明 |
| 间距单位 | 4px | 8px |
| 标签云标签 | 内联 | 自适应 grid |
| 定位按钮 | 地图右下角 | 地图右下角（步骤2-3显示） |

## 8. 已知限制 / 未纳入

- iOS 适配（当前仅 Android APK）
- 离线采集（无网络时缓存+同步）
- 地图 POI 标记渲染（步骤5列表查看，不做地图标注）
- REST API 有日配额限制（`125c253ac5c0c03f9165bc3c721d130f`），超额后需等次日重置
- 桌面 EXE 需关闭 Windows SmartScreen 或手动信任（无代码签名）
