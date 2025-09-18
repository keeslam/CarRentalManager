// server/index.ts - Volledig ESM-compatible voor Docker
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs'; // ← FIX: ES6 import i.p.v. require()
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupAuth } from "./auth";

// ESM __dirname fix voor Docker
const __filename = fileURLToFileURL(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..'); // /app in Docker

// Setup Express app
const app = express();

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

  // Capture JSON responses for logging
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args: any[]) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Log completed requests
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (requestPath.startsWith("/api")) {
      let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(logLine);
    }
  });

  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API root endpoint (behoud, maar na static serving)
app.get('/api', (req: Request, res: Response) => {
  res.json({ 
    message: 'Car Rental Manager API', 
    version: '1.0.0',
    endpoints: ['/health', '/api/*'],
    frontend: '/'  // Nu op root!
  });
});

// Setup static file serving (CRUCIAAL FIX: Serveer op root '/', NIET '/public')
if (process.env.NODE_ENV === "production") {
  console.log('📦 Setting up production static files...');
  
  // FIX: Juiste pad naar frontend build (dubbele dist van nixpacks.toml)
  const publicPath = path.join(appRoot, 'dist', 'dist', 'public');  // ← Veranderd naar dubbele dist
  const assetsPath = path.join(publicPath, 'assets');
  
  console.log('📁 Static public path:', publicPath);
  console.log('📁 Assets path:', assetsPath);
  
  // Check of de build files bestaan
  try {
    if (fs.existsSync(publicPath)) {
      console.log('✅ Public directory found');
      
      // FIX: Serveer static files op ROOT ('/'), NIET '/public'
      app.use(express.static(publicPath, {
        index: false,
        maxAge: '1y',
        etag: true
      }));
      
      // Assets subroute (optioneel, maar voor caching)
      if (fs.existsSync(assetsPath)) {
        app.use('/assets', express.static(assetsPath, {
          maxAge: '1y',
          etag: true
        }));
        console.log('✅ Assets directory found');
      } else {
        console.warn('⚠️  Assets directory not found');
      }
      
      console.log('✅ Static files configured on root');
    } else {
      console.warn('⚠️  Public directory NOT found - frontend build missing');
      console.warn('   Run "npm run build" locally to generate /dist/dist/public');
    }
  } catch (fsError) {
    console.error('❌ File system error:', fsError);
  }

  // FIX: Volledige SPA fallback voor ALLE non-API routes
  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    const indexPath = path.join(publicPath, 'index.html');
    try {
      if (fs.existsSync(indexPath)) {
        console.log(`Serving SPA fallback for: ${req.path}`);
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ 
          error: 'Frontend not built', 
          message: 'Run "npm run build" to generate frontend assets'
        });
      }
    } catch (sendFileError) {
      console.error('SendFile error:', sendFileError);
      res.status(500).json({ error: 'File serving error' });
    }
  });
} else {
  // Development mode - Vite dev server
  console.log('🔄 Development mode - Vite dev server will handle frontend');
}

// API routes komen ná static serving (maar vóór fallback)
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  console.log(`🔗 API route: ${req.method} ${req.path}`);
  next();
});

// 404 handler voor API routes (na /api middleware)
app.use('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ 
    error: 'Not Found', 
    message: `API endpoint ${req.path} not found`,
    available: ['/api/health', '/api/cars', '/api/rentals']
  });
});

// Error handling middleware (blijft hetzelfde)
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

// Main startup function (blijft hetzelfde, maar met server.listen fix)
(async () => {
  try {
    console.log('🚀 Starting Car Rental Manager...');
    
    // Debug info voor Docker (blijft hetzelfde)
    if (process.env.NODE_ENV === 'production') {
      console.log('\n=== 🐳 DOCKER PRODUCTION STARTUP ===');
      console.log('📁 Working directory:', process.cwd());
      console.log('📂 App root:', appRoot);
      console.log('🌐 NODE_ENV:', process.env.NODE_ENV);
      console.log('🔌 PORT:', process.env.PORT || 3000);
      console.log('📊 DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');
      console.log('==============================\n');
    }

    // Register API routes
    console.log('📡 Registering API routes...');
    const server = await registerRoutes(app);
    console.log('✅ API routes registered');

    // Start server (FIX: Gebruik app.listen i.p.v. server.listen voor eenvoud)
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) || 3000 : 3000;
    
    app.listen(port, '0.0.0.0', () => {  // ← FIX: Gebruik app.listen, niet server.listen
      console.log('\n🎉 CAR RENTAL MANAGER STARTED SUCCESSFULLY!');
      console.log(`🌐 API Server:    http://0.0.0.0:${port}`);
      console.log(`📱 Frontend:     http://localhost:${port}/`);  // Nu root!
      console.log(`🔍 Health check: http://localhost:${port}/health`);
      console.log(`🐳 Docker mode:  ${process.env.NODE_ENV === 'production' ? '✅' : '❌'}`);
      console.log(`📊 Uptime:       ${Math.round(process.uptime())}s`);
      console.log('=======================================\n');
    });

    // Graceful shutdown (aanpassen voor app.close)
    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      app.close(() => {  // ← FIX: app.close
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      app.close(() => {  // ← FIX: app.close
        console.log('✅ Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('💥 FATAL STARTUP ERROR:', error);
    console.error('Stack:', (error as Error).stack);
    process.exit(1);
  }
})();
