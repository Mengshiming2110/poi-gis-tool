export type TaskMode = 'grid' | 'region';
export type TaskStatus = 'pending' | 'running' | 'paused' | 'done' | 'cancelled' | 'failed';

export interface Bounds {
  southwest: { lng: number; lat: number };
  northeast: { lng: number; lat: number };
}

export interface GridCell {
  row: number;
  col: number;
  sw: { lng: number; lat: number };
  ne: { lng: number; lat: number };
}

export interface CollectRequest {
  mode: TaskMode;
  categories: string[];
  bounds: Bounds;
  gridSize?: number;
  region?: GeoJSON.Polygon;
  amapKey?: string;
  skipDuplicates?: boolean;
  debug?: boolean;
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

export interface AmapPoiItem {
  name: string;
  type: string;
  typecode: string;
  address: string;
  location: string;
  pname: string;
  cityname: string;
  adname: string;
  tel?: string;
  biz_ext?: { rating?: string };
}

export interface AmapSearchResponse {
  status: string;
  count: string;
  info: string;
  infocode?: string;
  pois: AmapPoiItem[];
}

export const CATEGORY_COLORS: Record<string, string> = {
  '050000': '#EF4444',
  '060000': '#F97316',
  '070000': '#EAB308',
  '080000': '#EF4444',
  '100000': '#8B5CF6',
  '110000': '#22C55E',
  '140000': '#3B82F6',
  '150000': '#EC4899',
  '160000': '#A855F7',
  '120000': '#6B7280',
  '130000': '#1E293B',
  '010000': '#14B8A6',
  '180000': '#84CC16',
};

export const CATEGORY_NAMES: Record<string, string> = {
  '010000': '汽车服务',
  '050000': '餐饮美食',
  '060000': '购物消费',
  '070000': '生活服务',
  '080000': '医疗保健',
  '100000': '酒店住宿',
  '110000': '旅游景点',
  '120000': '公司企业',
  '130000': '政府机构',
  '140000': '交通设施',
  '150000': '教育培训',
  '160000': '金融服务',
  '180000': '体育休闲',
};
