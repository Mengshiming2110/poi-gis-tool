import { Router, Request, Response } from 'express';
import { startCollection, pauseCollection, resumeCollection, cancelCollection } from '../queue';
import { getTask } from '../db';
import type { CollectRequest } from '../types';

const router = Router();

// POST /api/collect — start collection task
router.post('/', (req: Request, res: Response) => {
  const body = req.body as CollectRequest;

  if (!body.categories || body.categories.length === 0) {
    res.status(400).json({ error: '请至少选择一个POI类别' });
    return;
  }
  if (!body.bounds) {
    res.status(400).json({ error: '请提供采集范围' });
    return;
  }

  try {
    const result = startCollection(
      body,
      () => {},
      () => {},
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/collect/:id — query task status
router.get('/:id', (req: Request, res: Response) => {
  const task = getTask(req.params.id);
  if (!task) {
    res.status(404).json({ error: '任务不存在' });
    return;
  }
  res.json(task);
});

// GET /api/collect/:id/progress — SSE progress stream
router.get('/:id/progress', (req: Request, res: Response) => {
  const taskId = req.params.id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Poll the database every second for progress updates
  const interval = setInterval(() => {
    const task = getTask(taskId);
    if (!task) {
      clearInterval(interval);
      sendEvent('error', { error: '任务不存在' });
      res.end();
      return;
    }
    sendEvent('progress', {
      doneCells: task.done_cells,
      totalCells: task.total_cells,
      totalPois: task.total_pois,
    });
    if (task.status === 'done') {
      sendEvent('complete', { totalPois: task.total_pois });
      clearInterval(interval);
      res.end();
    }
    if (task.status === 'cancelled') {
      sendEvent('cancelled', {});
      clearInterval(interval);
      res.end();
    }
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// POST /api/collect/:id/pause
router.post('/:id/pause', (req: Request, res: Response) => {
  pauseCollection(req.params.id);
  res.json({ status: 'paused' });
});

// POST /api/collect/:id/resume
router.post('/:id/resume', (req: Request, res: Response) => {
  resumeCollection(req.params.id);
  res.json({ status: 'running' });
});

// POST /api/collect/:id/cancel
router.post('/:id/cancel', (req: Request, res: Response) => {
  cancelCollection(req.params.id);
  res.json({ status: 'cancelled' });
});

export default router;
