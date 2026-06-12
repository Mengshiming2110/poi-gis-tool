export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  amapKey: process.env.AMAP_KEY || '125c253ac5c0c03f9165bc3c721d130f',
  dbPath: process.env.DB_PATH || './data/pois.db',
  requestDelay: 200,
  maxRetries: 3,
  retryDelay: 1000,
};
