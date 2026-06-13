import { config } from '../config';
import type { GridCell, AmapSearchResponse, AmapPoiItem } from '../types';

const BASE_URL = 'https://restapi.amap.com/v3/place/polygon';

export class AmapApiError extends Error {
  constructor(
    message: string,
    public readonly info?: string,
    public readonly infocode?: string,
    public readonly fatal: boolean = true
  ) {
    super(message);
    this.name = 'AmapApiError';
  }
}

function formatAmapError(info?: string, infocode?: string): string {
  const code = infocode || info || 'UNKNOWN';
  if (info === 'USER_DAILY_QUERY_OVER_LIMIT' || infocode === '10044' || info === 'OVER_QUOTA') {
    return `高德 Web服务 API 今日调用额度已用完（${code}），请明天再试或更换有额度的 Web服务 Key。`;
  }
  if (info === 'USERKEY_PLAT_NOMATCH' || infocode === '10009') {
    return `高德 Key 类型不匹配（${code}），服务端采集必须使用绑定“Web服务”的 Key。`;
  }
  if (info === 'INVALID_USER_KEY' || infocode === '10001') {
    return `高德 Key 无效（${code}），请检查服务端 Web服务 Key 配置。`;
  }
  return `高德 API 调用失败（${code}）：${info || '未知错误'}`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function searchPoiInCell(
  cell: GridCell,
  categories: string[],
  page: number = 1,
  amapKey: string = config.amapKey
): Promise<AmapSearchResponse> {
  const polygon = `${cell.sw.lng},${cell.sw.lat}|${cell.ne.lng},${cell.ne.lat}`;
  const types = categories.join('|');

  const params = new URLSearchParams({
    key: amapKey,
    polygon,
    types,
    offset: '25',
    page: String(page),
    extensions: 'all',
  });

  const url = `${BASE_URL}?${params}`;
  console.log(`[Amap] 请求: cell[${cell.row},${cell.col}] page=${page}`);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`[Amap] HTTP ${response.status}: ${url}`);
    throw new Error(`Amap API HTTP error: ${response.status}`);
  }
  const json = await response.json() as AmapSearchResponse;
  console.log(`[Amap] 响应: status=${json.status} count=${json.count} pois=${json.pois?.length || 0} info=${json.info} infocode=${json.infocode || ''}`);
  return json;
}

export async function collectCellPois(
  cell: GridCell,
  categories: string[],
  amapKey?: string
): Promise<AmapPoiItem[]> {
  const allPois: AmapPoiItem[] = [];
  let page = 1;

  while (true) {
    const result = await searchPoiInCell(cell, categories, page, amapKey || config.amapKey);

    if (result.status !== '1') {
      throw new AmapApiError(formatAmapError(result.info, result.infocode), result.info, result.infocode, true);
    }

    const pois = result.pois || [];
    allPois.push(...pois);

    const total = parseInt(result.count, 10);
    if (allPois.length >= total || pois.length < 25) {
      break;
    }
    page++;
    await sleep(config.requestDelay);
  }

  return allPois;
}

export async function collectCellWithRetry(
  cell: GridCell,
  categories: string[],
  amapKey?: string
): Promise<AmapPoiItem[]> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await collectCellPois(cell, categories, amapKey);
    } catch (err: any) {
      if (err instanceof AmapApiError && err.fatal) {
        throw err;
      }
      if (attempt === config.maxRetries) {
        console.error(`Cell [${cell.row},${cell.col}] failed after ${config.maxRetries} retries`);
        return [];
      }
      await sleep(config.retryDelay * (attempt + 1));
    }
  }
  return [];
}
