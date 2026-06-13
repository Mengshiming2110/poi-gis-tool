export type TaskMode = 'grid' | 'region';
export type TaskStatus = 'pending' | 'running' | 'paused' | 'done' | 'cancelled' | 'failed';

export interface Bounds {
  southwest: { lng: number; lat: number };
  northeast: { lng: number; lat: number };
}

export interface CollectRequest {
  mode: TaskMode;
  categories: string[];
  bounds: Bounds;
  gridSize?: number;
  region?: GeoJSON.Polygon;
}

export interface CollectResponse {
  taskId: string;
  totalCells: number;
  estimatedMinutes: number;
}

export interface Task {
  id: string;
  mode: TaskMode;
  categories: string;
  grid_size: number | null;
  region_geo: string | null;
  status: TaskStatus;
  total_cells: number;
  done_cells: number;
  total_pois: number;
  error_message?: string | null;
  created_at: string;
}

export interface PoiRecord {
  id: number;
  task_id: string;
  name: string;
  category: string;
  subcategory: string | null;
  address: string | null;
  lng: number;
  lat: number;
  phone: string | null;
  rating: number | null;
  collected_at: string;
}

export interface ProgressData {
  doneCells: number;
  totalCells: number;
  totalPois: number;
}

export interface PoiQueryResult {
  pois: PoiRecord[];
  total: number;
}

export const CATEGORY_LIST: { code: string; name: string; color: string }[] = [
  { code: '050000', name: '餐饮美食', color: '#EF4444' },
  { code: '060000', name: '购物消费', color: '#F97316' },
  { code: '070000', name: '生活服务', color: '#EAB308' },
  { code: '080000', name: '医疗保健', color: '#EF4444' },
  { code: '100000', name: '酒店住宿', color: '#8B5CF6' },
  { code: '110000', name: '旅游景点', color: '#22C55E' },
  { code: '140000', name: '交通设施', color: '#3B82F6' },
  { code: '150000', name: '教育培训', color: '#EC4899' },
  { code: '160000', name: '金融服务', color: '#A855F7' },
  { code: '120000', name: '公司企业', color: '#6B7280' },
  { code: '130000', name: '政府机构', color: '#1E293B' },
  { code: '010000', name: '汽车服务', color: '#14B8A6' },
  { code: '180000', name: '体育休闲', color: '#84CC16' },
];

export const GRID_SIZE_OPTIONS = [
  { value: 0.005, label: '0.005° (~550m)' },
  { value: 0.01, label: '0.01° (~1.1km)' },
  { value: 0.02, label: '0.02° (~2.2km)' },
  { value: 0.05, label: '0.05° (~5.5km)' },
];
