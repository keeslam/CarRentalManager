import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import express, { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";

// ESM __dirname fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..'); // /app in Docker

// Setup Express
const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Setup authentication
const { requireAuth } = setupAuth(app);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const requestPath = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";
      console.log(logLine);
    }
  });

  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API root
app.get('/api', (_req, res) => {
  res.json({
    message: 'Car Rental Manager API',
    version: '1.0.0',
    endpoints: ['/health', '/api/*'],
    frontend: '/'
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  const publicPath = path.join(__dirname, 'public'); // server/dist/public
  console.log('📦 Serving static files from:', publicPath);

  try {
    if (fs.existsSync(publicPath)) {
      console.log('✅ Public directory found');

      app.use(express.static(publicPath, { index: false, maxAge: '1y', etag: true }));

      const assetsPath = path.join(publicPath, 'assets');
      if (fs.existsSync(assetsPath)) {
        app.use('/assets', express.static(assetsPath, { maxAge: '1y', etag: true }));
        console.log('✅ Assets directory found');
      } else {
        console.warn('⚠️ Assets directory not found');
      }
    } else {
      console.warn('⚠️ Public directory NOT found - frontend build missing');
    }
  } catch (fsError) {
    console.error('❌ File system error:', fsError);
  }

  // SPA fallback
  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API endpoint not found' });

    const indexPath = path.join(publicPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).json({
        error: 'Frontend not built',
        message: 'Run "npm run build" to generate frontend assets'
      });
    }
  });
} else {
  console.log('🔄 Development mode - Vite dev server handles frontend');
}

// Register API routes
await registerRoutes(app);

// 404 for API
app.use('/api/*', (_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint not found`,
    available: ['/api/health', '/api/cars', '/api/rentals']
  });
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('❌ Error:', err.message);
  console.error('Stack:', err.stack);

  const status = err.status || err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message;

  res.status(status).json({
    error: 'Server Error',
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Main startup
app.listen(port, '0.0.0.0', () => {
  console.log('\n🎉 CAR RENTAL MANAGER STARTED SUCCESSFULLY!');
  console.log(`🌐 API Server:    http://0.0.0.0:${port}`);
  console.log(`📱 Frontend:     http://localhost:${port}/`);
  console.log(`🔍 Health check: http://localhost:${port}/health`);
  console.log(`🐳 Docker mode:  ${process.env.NODE_ENV === 'production' ? '✅' : '❌'}`);
  console.log('=======================================\n');
});
