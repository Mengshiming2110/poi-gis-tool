import express from 'express';
import cors from 'cors';
import collectionRoutes from './routes/collection';
import poisRoutes from './routes/pois';
import exportRoutes from './routes/export';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/collect', collectionRoutes);
app.use('/api/pois', poisRoutes);
app.use('/api/export', exportRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
