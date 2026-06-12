import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import collectionRoutes from './routes/collection';
import poisRoutes from './routes/pois';
import exportRoutes from './routes/export';

const app = express();
const PORT = process.env.PORT || 3001;
const clientDist = path.join(__dirname, '../../client/dist');
const hasClient = fs.existsSync(clientDist);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/collect', collectionRoutes);
app.use('/api/pois', poisRoutes);
app.use('/api/export', exportRoutes);

// Serve built frontend if available
if (hasClient) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}${hasClient ? '' : ' (API only)'}`);
});
