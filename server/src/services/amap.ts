import { config } from '../config';
import type { GridCell, AmapSearchResponse, AmapPoiItem } from '../types';

const BASE_URL = 'https://restapi.amap.com/v3/place/polygon';

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function searchPoiInCell(
  cell: GridCell,
  categories: string[],
  page: number = 1
): Promise<AmapSearchResponse> {
  const polygon = `${cell.sw.lng},${cell.sw.lat}|${cell.ne.lng},${cell.ne.lat}`;
  const types = categories.join('|');

  const params = new URLSearchParams({
    key: config.amapKey,
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
  console.log(`[Amap] 响应: status=${json.status} count=${json.count} pois=${json.pois?.length || 0} info=${json.info}`);
  return json;
}

export async function collectCellPois(
  cell: GridCell,
  categories: string[]
): Promise<AmapPoiItem[]> {
  const allPois: AmapPoiItem[] = [];
  let page = 1;

  while (true) {
    const result = await searchPoiInCell(cell, categories, page);

    if (result.status !== '1') {
      if (result.info === 'OVER_QUOTA') {
        throw new Error('OVER_QUOTA');
      }
      break;
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
  categories: string[]
): Promise<AmapPoiItem[]> {
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await collectCellPois(cell, categories);
    } catch (err: any) {
      if (err.message === 'OVER_QUOTA' && attempt < config.maxRetries) {
        await sleep(config.retryDelay * (attempt + 1));
        continue;
      }
      if (attempt === config.maxRetries) {
        console.error(`Cell [${cell.row},${cell.col}] failed after ${config.maxRetries} retries`);
        return [];
      }
    }
  }
  return [];
}
