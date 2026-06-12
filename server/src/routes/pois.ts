import { Router, Request, Response } from 'express';
import { queryPois } from '../db';

const router = Router();

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
