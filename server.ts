import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import routes from './routes';
import sequelize from './config/database';
import { apiLimiter } from './middleware/rateLimiter';
import './models';

dotenv.config();

// Fail fast instead of silently falling back to the well-known default
// secret ('f1n4nc3') in production — a known default lets anyone forge JWTs.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET must be set in production');
  process.exit(1);
}

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Behind hosting proxies (Render, Railway, etc.) so express-rate-limit sees
// the real client IP instead of the proxy's — without this every visitor
// shares one rate-limit bucket.
app.set('trust proxy', 1);

// CORS: allow the deployed frontend origin(s) via CORS_ORIGIN (comma-separated
// list). Unset = permissive, which is fine for local development only.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
  : undefined;
app.use(cors(corsOrigins ? { origin: corsOrigins } : {}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', apiLimiter, routes);

// Return JSON for handler errors (e.g. multer rejecting a non-image avatar or
// an oversized upload) instead of Express's default HTML stack trace.
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  const status = err instanceof multer.MulterError ? 400 : (err.status || 500);
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established');
    
    await sequelize.sync({ alter: false });
    console.log('Database synchronized');
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
