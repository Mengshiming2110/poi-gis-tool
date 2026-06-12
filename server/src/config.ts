export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  amapKey: process.env.AMAP_KEY || '35f0e1144644fbfba405c109db466cdc',
  dbPath: process.env.DB_PATH || './data/pois.db',
  requestDelay: 200,
  maxRetries: 3,
  retryDelay: 1000,
};
