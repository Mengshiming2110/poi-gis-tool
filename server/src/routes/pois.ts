import { Router, Request, Response } from 'express';
import { queryPoiLibrary, queryPois, queryPoiLibraryStats, markPoisSynced, getUnsyncedPois, mergeCloudPois } from '../db';

const router = Router();

router.post('/merge', (req: Request, res: Response) => {
  const { pois } = req.body;
  if (!Array.isArray(pois) || pois.length === 0) {
    res.status(400).json({ error: '请提供要合并的 POI 列表' });
    return;
  }
  const result = mergeCloudPois(pois);
  res.json(result);
});

router.post('/mark-synced', (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: '请提供要标记的 POI ID 列表' });
    return;
  }
  const count = markPoisSynced(ids);
  res.json({ count });
});

router.get('/unsynced', (req: Request, res: Response) => {
  const { taskId } = req.query;
  const pois = getUnsyncedPois(taskId ? String(taskId) : undefined);
  res.json({ pois, total: pois.length });
});

router.get('/library/stats', (_req: Request, res: Response) => {
  const stats = queryPoiLibraryStats();
  res.json(stats);
});

router.get('/library', (req: Request, res: Response) => {
  const { page = '1', pageSize = '200', search, category, district } = req.query;

  const result = queryPoiLibrary({
    page: parseInt(String(page), 10),
    pageSize: Math.min(parseInt(String(pageSize), 10), 500),
    search: search ? String(search) : undefined,
    category: category ? String(category) : undefined,
    district: district ? String(district) : undefined,
  });

  res.json(result);
});

router.get('/', (req: Request, res: Response) => {
  const { taskId, page = '1', pageSize = '50', search, category } = req.query;

  if (!taskId) {
    res.status(400).json({ error: '缺少 taskId 参数' });
    return;
  }

  const result = queryPois({
    taskId: String(taskId),
    page: parseInt(String(page), 10),
    pageSize: Math.min(parseInt(String(pageSize), 10), 200),
    search: search ? String(search) : undefined,
    category: category ? String(category) : undefined,
  });

  res.json(result);
});

export default router;
