import { Router, Request, Response } from 'express';
import ExcelJS from 'exceljs';
import { getTaskPoisForExport, getTask } from '../db';

const router = Router();

router.get('/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  const format = (req.query.format as string) || 'xlsx';

  const task = getTask(taskId);
  if (!task) {
    res.status(404).json({ error: '任务不存在' });
    return;
  }

  const pois = getTaskPoisForExport(taskId);

  if (format === 'geojson') {
    const geojson = {
      type: 'FeatureCollection',
      features: pois.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: {
          name: p.name,
          category: p.category,
          subcategory: p.subcategory,
          address: p.address,
          phone: p.phone,
          rating: p.rating,
          collected_at: p.collected_at,
        },
      })),
    };

    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Content-Disposition', `attachment; filename="pois-${taskId}.geojson"`);
    res.json(geojson);
    return;
  }

  // Excel export
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('POI数据');

  sheet.columns = [
    { header: '名称', key: 'name', width: 30 },
    { header: '大类', key: 'category', width: 12 },
    { header: '中类', key: 'subcategory', width: 15 },
    { header: '地址', key: 'address', width: 40 },
    { header: '经度', key: 'lng', width: 12 },
    { header: '纬度', key: 'lat', width: 12 },
    { header: '电话', key: 'phone', width: 18 },
    { header: '评分', key: 'rating', width: 8 },
    { header: '采集时间', key: 'collected_at', width: 20 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE2E8F0' },
  };

  pois.forEach(p => sheet.addRow(p));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="pois-${taskId}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
});

export default router;
