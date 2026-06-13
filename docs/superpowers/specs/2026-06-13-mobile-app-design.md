# 手机端 APP 重新设计 — 设计文档

**日期**: 2026-06-13
**状态**: 已确认

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
| 4 采集 | 全屏进度+动画+POI 计数 | 自动采集 → 可暂停/取消 → 完成到下一步 |
| 5 查看结果 | POI 列表+地图标注+导出 | 浏览数据 → 导出 Excel/GeoJSON → 完成 |

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
│   │
│   └── mobile/               ← 新建移动专属组件
│       ├── StepIndicator.tsx      ← 顶部步骤进度条
│       ├── StepCategories.tsx     ← 步骤1: 分类选择
│       ├── StepDraw.tsx           ← 步骤2: 区域绘制
│       ├── StepGrid.tsx           ← 步骤3: 网格切分
│       ├── StepCollect.tsx        ← 步骤4: 采集进度
│       ├── StepResults.tsx        ← 步骤5: 结果查看
│       └── MobileApp.tsx          ← 移动版 App 根组件
├── hooks/                    ← 共享，不动
│   ├── useAmap.ts
│   ├── useCollection.ts
│   └── useSSE.ts
├── services/
│   ├── api.ts                ← 桌面后端 API
│   └── supabase.ts           ← Supabase 客户端 (新增)
└── types/
    └── poi.ts
```

## 4. 数据流

```
手机 APK (Capacitor)
    │
    ├─ 采集请求 ──→ 先试局域网桌面后端 (http://{desktop_ip}:3001)
    │                   │
    │                   ├─ 连上了 → Express + 高德 REST API → 完整采集
    │                   └─ 连不上 → PlaceSearch 降级采集 (轻量)
    │
    ├─ POI 数据写入 → Supabase (所有采集结果统一写入 Supabase)
    │
    └─ 数据读取 ← Supabase (任务列表、POI 数据)
    
桌面 Electron
    │
    ├─ POI 数据双写 → Supabase (已有 cloud.ts 实现)
    └─ 手机采的数据自动同步 ← Supabase Realtime
```

## 5. 组件设计

### 5.1 MobileApp.tsx（根组件）

- 管理当前步骤状态 `step: 1-5`
- 管理步骤间共享数据: `selectedCategories`, `drawnShape`, `gridCells`, `poiData`
- 渲染 `StepIndicator` + 当前步骤组件
- 底部"上一步/下一步"导航

### 5.2 StepIndicator.tsx

- 横向步骤条: ● 类别 — ● 区域 — ● 网格 — ○ 采集 — ○ 结果
- 当前步骤高亮蓝色，已完成绿色，未完成灰色
- 点击已完成步骤可跳回（编辑）

### 5.3 StepCategories.tsx

- 全屏标签云（大触控标签，至少 44dp 高）
- 顶部搜索框
- 已选数量显示
- 底部"下一步"按钮（至少选了1个才亮）
- 样式: 标签用 category 对应的颜色

### 5.4 StepDraw.tsx

- 全屏地图（高德 JS API in WebView）
- 底部浮动工具栏: ⬠ 多边形 / ▭ 矩形 / ◯ 圆形 / ✕ 清除
- 按钮最小 48x48dp 触控面积
- 绘制完成后地图上出现形状覆盖层
- Toast 提示"区域已绘制"
- "下一步"需要已绘制区域才亮

### 5.5 StepGrid.tsx

- 全屏地图（显示已绘制区域 + 网格覆盖层）
- 底部面板: 精度滑块（100m-2000m）+ 预设按钮（500/1000/1500）
- "执行切分" 按钮 → 地图上显示蓝色半透明网格
- 显示网格数量
- "下一步"需要已切分才亮

### 5.6 StepCollect.tsx

- 全屏采集进度视图
- 大圆形进度环（中文字体）
- 实时统计: POI 数量、当前格子/总格子、耗时
- 暂停 / 取消按钮
- 采集完成自动跳步骤5
- 后端连接状态指示（桌面后端 / PlaceSearch 降级）

### 5.7 StepResults.tsx

- POI 列表（大行高 56dp，左颜色点+名称+类别）
- 点击某条 → 回到步骤2地图标注该 POI
- 导出按钮: Excel / GeoJSON
- "完成"回到步骤1开始新采集

## 6. 后端连接策略

```typescript
// 双层降级
async function getCollector() {
  // 1. 先试桌面后端
  try {
    const res = await fetch(`http://${desktopIp}:3001/api/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) return 'desktop'; // 用 Express + REST API
  } catch {}
  
  // 2. 降级到 PlaceSearch
  return 'placesearch'; // 浏览器端 JS API
}
```

桌面后端 IP 通过 Settings 配置，存入 localStorage。

## 7. 移动端样式规范

| 属性 | 桌面 | 移动 |
|------|------|------|
| 最小触控尺寸 | - | 48dp × 48dp |
| 字体基准 | 13px | 16px |
| 按钮圆角 | 6px | 12px |
| 面板背景 | rgba(255,255,255,0.95) | #fff 不透明 |
| 间距单位 | 4px | 8px |
| 标签云标签 | 内联 | 自适应 grid |
| 地图高度 | 100vh | calc(100vh - 120px) 留底部空间 |

## 8. 未纳入范围

- iOS 适配（当前仅 Android APK）
- 离线采集（无网络时缓存+同步）
- 地图 POI 标记渲染（步骤2仅绘制，步骤5才看数据）
